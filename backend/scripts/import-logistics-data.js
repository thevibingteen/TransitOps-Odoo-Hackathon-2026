/* Imports meaningful columns from the supplied Kaggle CSVs into TransitOps' normalized demo store. */
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.LOGISTICS_DATA_ROOT || 'C:/Users/Saumitra/Downloads/Logistics data odoo';
const maintenanceRoot = process.env.MAINTENANCE_DATA_ROOT || 'C:/Users/Saumitra/Downloads/Logistics vehicle mainatance data';
const dbPath = path.join(__dirname, '..', 'data', 'database.json');
function rows(file, max = 500) { const [head, ...data] = fs.readFileSync(file, 'utf8').split(/\r?\n/); const keys = head.split(','); return data.filter(Boolean).slice(0, max).map(line => Object.fromEntries(keys.map((key, i) => [key, line.split(',')[i] || '']))); }
function number(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function main() {
  const current = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const routes = new Map(rows(path.join(root, 'routes.csv'), 1000).map(r => [r.route_id, r]));
  const loads = new Map(rows(path.join(root, 'loads.csv'), 2500).map(r => [r.load_id, r]));
  const vehicles = rows(path.join(root, 'trucks.csv'), 120).map((r, i) => ({ id: r.truck_id, registration: `TRK-${r.unit_number}`, name: `${r.make} ${r.model_year}`, type: 'Truck', capacity: Math.round(number(r.tank_capacity_gallons, 180) * 65), fuel: r.fuel_type || 'Diesel', odometer: number(r.acquisition_mileage), status: i % 9 === 0 ? 'Maintenance' : i % 3 === 0 ? 'On Trip' : 'Available', health: 78 + (i % 21) }));
  const drivers = rows(path.join(root, 'drivers.csv'), 180).map((r, i) => ({ id: r.driver_id, name: `${r.first_name} ${r.last_name}`, phone: `+1 555 ${String(1000000 + i).slice(-7)}`, email: `${r.first_name}.${r.last_name}@transitops.demo`.toLowerCase(), licenseExpiry: `202${7 + (i % 2)}-${String(1 + i % 12).padStart(2, '0')}-15`, safety: 82 + (i % 18), status: i % 3 === 0 ? 'On Trip' : 'Available' }));
  const vehicleMap = new Map(vehicles.map(v => [v.id, v])); const driverMap = new Map(drivers.map(d => [d.id, d]));
  const trips = rows(path.join(root, 'trips.csv'), 300).map((r, i) => { const load = loads.get(r.load_id) || {}; const route = routes.get(load.route_id) || {}; const vehicle = vehicleMap.get(r.truck_id); const driver = driverMap.get(r.driver_id); return { id: r.trip_id, source: route.origin_city || 'Regional Hub', destination: route.destination_city || 'Distribution Center', vehicleId: r.truck_id, driverId: r.driver_id, vehicle: vehicle ? `${vehicle.registration} · ${vehicle.name}` : r.truck_id, driver: driver?.name || r.driver_id, cargoWeight: Math.round(number(load.weight_lbs) * .453592), revenue: number(load.revenue), distance: number(r.actual_distance_miles) * 1.60934, status: r.trip_status === 'Completed' ? 'Completed' : i % 2 ? 'In Transit' : 'Dispatched', eta: `${1 + i % 6}h ${10 + i % 50}m` }; });
  const maintenance = rows(path.join(root, 'maintenance_records.csv'), 300).map(r => ({ id: r.maintenance_id, vehicle: vehicleMap.get(r.truck_id)?.registration || r.truck_id, type: r.maintenance_type, technician: r.facility_location, cost: number(r.total_cost), date: r.maintenance_date.slice(0, 10), status: number(r.downtime_hours) > 12 ? 'In Progress' : 'Closed' }));
  const expenses = rows(path.join(root, 'fuel_purchases.csv'), 500).map(r => ({ id: r.fuel_purchase_id, category: 'Fuel', vehicle: vehicleMap.get(r.truck_id)?.registration || r.truck_id, amount: number(r.total_cost), date: r.purchase_date.slice(0, 10) }));
  const predictive = rows(path.join(maintenanceRoot, 'logistics_dataset_with_maintenance_required.csv'), 300).filter(r => r.Maintenance_Required === '1').slice(0, 24).map((r, i) => ({ id: `PRED-${i + 1}`, vehicle: vehicles[i % vehicles.length]?.registration, score: Math.round(number(r.Predictive_Score) * 100), type: r.Maintenance_Type, confidence: Math.round(70 + number(r.Predictive_Score) * 25), reason: `Engine ${r.Engine_Temperature}°C · brake condition ${r.Brake_Condition}` }));
  Object.assign(current, { vehicles, drivers, trips, maintenance, expenses, predictions: predictive, activities: [{ title: 'Kaggle logistics data imported', detail: `${vehicles.length} vehicles · ${trips.length} trips · ${predictive.length} AI maintenance alerts`, type: 'trip', at: 'Just now' }, ...current.activities.slice(0, 3)] });
  fs.writeFileSync(dbPath, JSON.stringify(current, null, 2)); console.log(JSON.stringify({ vehicles: vehicles.length, drivers: drivers.length, trips: trips.length, maintenance: maintenance.length, fuelExpenses: expenses.length, predictions: predictive.length }, null, 2));
}
main();
