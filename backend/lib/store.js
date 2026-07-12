const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const file = path.join(__dirname, '..', 'data', 'database.json');
const hash = password => crypto.scryptSync(password, 'transitops-demo-salt', 32).toString('hex');
const initial = () => ({
  users: [{ id: 'USR-DEMO', name: 'Saumitra Kapoor', email: 'demo@transitops.ai', passwordHash: hash('Transit@2026'), role: 'Fleet Manager', createdAt: '2026-07-12T00:00:00.000Z' }],
  vehicles: [
    { id: 'VEH-102', registration: 'TRK-102', name: 'Atlas Hauler', type: 'Truck', capacity: 12000, fuel: 'Diesel', odometer: 84692, status: 'On Trip', health: 94 },
    { id: 'VEH-114', registration: 'TRK-114', name: 'Zenith Cargo', type: 'Truck', capacity: 10000, fuel: 'Diesel', odometer: 61244, status: 'Available', health: 98 },
    { id: 'VEH-078', registration: 'TRK-078', name: 'Northstar LX', type: 'Truck', capacity: 8500, fuel: 'Diesel', odometer: 110182, status: 'On Trip', health: 89 },
    { id: 'VEH-021', registration: 'VAN-021', name: 'Swift Line', type: 'Van', capacity: 4200, fuel: 'Petrol', odometer: 44812, status: 'Available', health: 96 },
    { id: 'VEH-044', registration: 'TRK-044', name: 'Pioneer 7', type: 'Truck', capacity: 9000, fuel: 'Diesel', odometer: 128080, status: 'Maintenance', health: 72 }
  ],
  drivers: [
    { id: 'DRV-001', name: 'Neha Singh', phone: '+91 98765 10211', email: 'neha.singh@transitops.in', licenseExpiry: '2027-03-18', safety: 96, status: 'Available' },
    { id: 'DRV-002', name: 'Alex Kumar', phone: '+91 98765 10312', email: 'alex.kumar@transitops.in', licenseExpiry: '2026-07-17', safety: 92, status: 'On Trip' },
    { id: 'DRV-003', name: 'Rohan Shah', phone: '+91 98765 10413', email: 'rohan.shah@transitops.in', licenseExpiry: '2026-12-22', safety: 89, status: 'On Trip' },
    { id: 'DRV-004', name: 'Priya Rao', phone: '+91 98765 10514', email: 'priya.rao@transitops.in', licenseExpiry: '2027-01-05', safety: 98, status: 'Available' },
    { id: 'DRV-005', name: 'Vikram Das', phone: '+91 98765 10615', email: 'vikram.das@transitops.in', licenseExpiry: '2026-07-29', safety: 84, status: 'Off Duty' }
  ],
  trips: [
    { id: 'TRP-2841', source: 'Delhi', destination: 'Jaipur', vehicle: 'TRK-102 · Atlas Hauler', driver: 'Alex Kumar', status: 'In Transit', eta: '1h 42m', cargoWeight: 8400, revenue: 85000, distance: 281 },
    { id: 'TRP-2840', source: 'Mumbai', destination: 'Pune', vehicle: 'TRK-078 · Northstar LX', driver: 'Rohan Shah', status: 'In Transit', eta: '2h 18m', cargoWeight: 6200, revenue: 63000, distance: 149 },
    { id: 'TRP-2839', source: 'Bengaluru', destination: 'Mysuru', vehicle: 'VAN-021 · Swift Line', driver: 'Priya Rao', status: 'Dispatched', eta: '3h 05m', cargoWeight: 2200, revenue: 28000, distance: 145 }
  ],
  maintenance: [{ id: 'MNT-301', vehicle: 'TRK-044', type: 'Brake inspection', technician: 'Harish Auto Works', cost: 12400, date: '2026-07-12', status: 'In Progress' }, { id: 'MNT-300', vehicle: 'TRK-102', type: 'Oil Change', technician: 'FleetCare', cost: 5600, date: '2026-07-08', status: 'Closed' }],
  expenses: [{ id: 'EXP-501', category: 'Fuel', vehicle: 'TRK-102', amount: 6840, date: '2026-07-12' }, { id: 'EXP-502', category: 'Toll', vehicle: 'TRK-078', amount: 1290, date: '2026-07-12' }, { id: 'EXP-503', category: 'Repair', vehicle: 'TRK-044', amount: 12400, date: '2026-07-12' }],
  activities: [{ title: 'TRK-102 completed its route', detail: 'Mumbai → Pune · 14 min ago', type: 'trip', at: '14 min ago' }, { title: 'Maintenance scheduled', detail: 'Brake inspection · TRK-044', type: 'maintenance', at: '32 min ago' }, { title: 'New fuel log recorded', detail: '₹6,840 · TRK-119', type: 'fuel', at: '1 hour ago' }, { title: 'Driver licence renewal due', detail: 'Alex Kumar · expires in 5 days', type: 'alert', at: '2 hours ago' }],
  notifications: [{ id: 'NOT-001', level: 'warning', title: 'Licence expiry', message: 'Alex Kumar’s licence expires in 5 days.', read: false }, { id: 'NOT-002', level: 'info', title: 'Maintenance due', message: 'TRK-044 is in maintenance.', read: false }]
});
function load() { if (!fs.existsSync(file)) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(initial(), null, 2)); } const value = JSON.parse(fs.readFileSync(file, 'utf8')); if (!value.users) { value.users = initial().users; fs.writeFileSync(file, JSON.stringify(value, null, 2)); } return value; }
let state = load(); const save = () => fs.writeFileSync(file, JSON.stringify(state, null, 2));
exports.db = { get: table => state[table] || [], find: (table, id) => (state[table] || []).find(row => row.id === id), insert: (table, item) => { state[table].unshift(item); save(); return item; }, update: (table, id, changes) => { const item = exports.db.find(table, id); if (item) Object.assign(item, changes); save(); return item; } };
exports.seed = () => { state = initial(); save(); };
