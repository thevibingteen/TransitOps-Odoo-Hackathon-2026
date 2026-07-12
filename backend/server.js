const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { db, seed } = require('./lib/store');
const { validateLogin, validateRegister, validateTrip, validateVehicle } = require('./lib/validation');
const { dispatchRecommendation, askFleet } = require('./services/ai');
const crypto = require('node:crypto');

const clientRoot = path.join(__dirname, '..', 'frontend');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };
const send = (res, status, payload) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(payload)); };
const uid = (prefix) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
const passwordHash = password => crypto.scryptSync(password, 'transitops-demo-salt', 32).toString('hex');
const listeners = new Set();
const broadcast = event => { for (const res of listeners) res.write(`event: fleet\ndata: ${JSON.stringify(event)}\n\n`); };
const body = (req) => new Promise((resolve, reject) => { let raw = ''; req.on('data', c => { raw += c; if (raw.length > 1_000_000) reject(new Error('Payload too large')); }); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Invalid JSON body')); } }); });
const route = (method, url) => `${method} ${url.split('?')[0]}`;

function overview() {
  const vehicles = db.get('vehicles'); const drivers = db.get('drivers'); const trips = db.get('trips'); const expenses = db.get('expenses');
  const today = expenses.filter(e => e.date === '2026-07-12').reduce((n, e) => n + e.amount, 0);
  return { metrics: { vehicles: vehicles.length, onTrip: vehicles.filter(v => v.status === 'On Trip').length, driversOnDuty: drivers.filter(d => d.status === 'On Trip' || d.status === 'Available').length, expensesToday: today, health: 88 }, vehicles, drivers, trips, expenses, activities: db.get('activities'), notifications: db.get('notifications') };
}

async function api(req, res, pathname) {
  const key = route(req.method, pathname);
  if (key === 'GET /api/health') return send(res, 200, { ok: true, service: 'TransitOps AI', database: 'local relational demo store', realtime: true });
  if (key === 'GET /api/dashboard') return send(res, 200, overview());
  if (key === 'GET /api/vehicles') return send(res, 200, { items: db.get('vehicles') });
  if (key === 'GET /api/drivers') return send(res, 200, { items: db.get('drivers') });
  if (key === 'GET /api/trips') return send(res, 200, { items: db.get('trips') });
  if (key === 'GET /api/maintenance') return send(res, 200, { items: db.get('maintenance') });
  if (key === 'GET /api/expenses') return send(res, 200, { items: db.get('expenses') });
  if (key === 'GET /api/notifications') return send(res, 200, { items: db.get('notifications') });
  if (key === 'POST /api/auth/login') { const input = await body(req); const errors = validateLogin(input); if (Object.keys(errors).length) return send(res, 422, { message: 'Please correct the highlighted fields.', errors }); const user = db.get('users').find(u => u.email.toLowerCase() === input.email.trim().toLowerCase()); if (!user || user.passwordHash !== passwordHash(input.password)) return send(res, 401, { message: 'Email or password is incorrect.', errors: { password: 'Check your credentials and try again.' } }); return send(res, 200, { token: 'demo-jwt-' + Date.now(), user: { name: user.name, role: user.role, email: user.email } }); }
  if (key === 'POST /api/auth/register') { const input = await body(req); const errors = validateRegister(input); if (db.get('users').some(u => u.email.toLowerCase() === String(input.email || '').trim().toLowerCase())) errors.email = 'An account already exists with this email.'; if (Object.keys(errors).length) return send(res, 422, { message: 'Please correct the highlighted fields.', errors }); const user = { id: uid('USR'), name: input.name.trim(), email: input.email.trim().toLowerCase(), passwordHash: passwordHash(input.password), role: 'Fleet Manager', createdAt: new Date().toISOString() }; db.insert('users', user); return send(res, 201, { token: 'demo-jwt-' + Date.now(), user: { name: user.name, role: user.role, email: user.email } }); }
  if (key === 'POST /api/vehicles') { const input = await body(req); const errors = validateVehicle(input); if (Object.keys(errors).length) return send(res, 422, { message: 'Vehicle validation failed.', errors }); const vehicle = { id: uid('VEH'), registration: input.registration.toUpperCase(), name: input.name, type: input.type, capacity: Number(input.capacity), fuel: input.fuel || 'Diesel', odometer: Number(input.odometer || 0), status: 'Available', health: 100 }; db.insert('vehicles', vehicle); db.insert('activities', { title: `Vehicle ${vehicle.registration} added`, detail: `${vehicle.name} is available for dispatch`, type: 'vehicle', at: 'Just now' }); broadcast({ type: 'vehicle.created', id: vehicle.id }); return send(res, 201, { item: vehicle }); }
  if (key === 'POST /api/trips') { const input = await body(req); const errors = validateTrip(input); if (Object.keys(errors).length) return send(res, 422, { message: 'Trip validation failed. No fleet status was changed.', errors }); const vehicle = db.find('vehicles', input.vehicleId); const driver = db.find('drivers', input.driverId); if (!vehicle || vehicle.status !== 'Available') errors.vehicleId = 'Select a vehicle that is currently available.'; if (!driver || driver.status !== 'Available') errors.driverId = 'Select a driver that is currently available.'; if (vehicle && Number(input.cargoWeight) > vehicle.capacity) errors.cargoWeight = `Cargo must be within ${vehicle.capacity.toLocaleString()} kg capacity.`; if (driver && new Date(driver.licenseExpiry) < new Date('2026-07-12')) errors.driverId = 'Selected driver has an expired licence.'; if (Object.keys(errors).length) return send(res, 422, { message: 'Dispatch safety checks failed.', errors }); const trip = { id: uid('TRP'), source: input.source, destination: input.destination, vehicleId: vehicle.id, driverId: driver.id, vehicle: `${vehicle.registration} · ${vehicle.name}`, driver: driver.name, cargoWeight: Number(input.cargoWeight), revenue: Number(input.revenue), distance: Number(input.distance), status: 'In Transit', eta: '3h 15m', createdAt: new Date().toISOString() }; db.insert('trips', trip); db.update('vehicles', vehicle.id, { status: 'On Trip' }); db.update('drivers', driver.id, { status: 'On Trip' }); db.insert('activities', { title: `${trip.id} dispatched`, detail: `${trip.source} → ${trip.destination} · ${vehicle.registration}`, type: 'trip', at: 'Just now' }); db.insert('notifications', { id: uid('NOT'), level: 'info', title: 'Trip dispatched', message: `${trip.id} is now in transit.`, read: false }); broadcast({ type: 'trip.dispatched', id: trip.id }); return send(res, 201, { item: trip, recommendation: dispatchRecommendation(input, db.get('vehicles'), db.get('drivers')) }); }
  if (key === 'POST /api/ai/chat') { const input = await body(req); if (!input.question || input.question.trim().length < 3) return send(res, 422, { message: 'Enter a question with at least 3 characters.', errors: { question: 'Please enter a more specific fleet question.' } }); return send(res, 200, { answer: askFleet(input.question, overview()) }); }
  if (key === 'POST /api/demo/reset') { seed(); return send(res, 200, { message: 'Demo data restored.' }); }
  return send(res, 404, { message: 'API route not found.' });
}

http.createServer(async (req, res) => {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  if (pathname === '/api/events') { res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' }); res.write('retry: 3000\n\n'); listeners.add(res); req.on('close', () => listeners.delete(res)); return; }
  try { if (pathname.startsWith('/api/')) return await api(req, res, pathname); } catch (error) { return send(res, error.message === 'Invalid JSON body' ? 400 : 500, { message: error.message || 'Unexpected server error.' }); }
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''); const target = path.resolve(clientRoot, requested);
  if (!target.startsWith(clientRoot) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' }); fs.createReadStream(target).pipe(res);
}).listen(process.env.PORT || 5050, () => console.log(`TransitOps AI running at http://localhost:${process.env.PORT || 5050}`));
