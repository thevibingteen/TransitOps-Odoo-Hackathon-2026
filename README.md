# TransitOps AI

TransitOps AI is a dark, responsive fleet-operations SaaS prototype built for hackathon evaluation. It combines a premium command-centre UI with server-side validation, persistent demo data, dispatch business rules, AI-style operational guidance, and a production PostgreSQL schema.

## Running application

The application is running locally at **http://localhost:5050**.

```powershell
cd D:\TransitOps-Odoo-Hackathon-2026\backend
npm start
```

It has no external runtime dependency for the demo, so it starts with Node.js alone.

## What is implemented

- Responsive purple-on-black fleet dashboard inspired by the supplied reference
- Dynamic dashboard, vehicles, drivers, trips, maintenance, expenses, analytics, settings, and AI assistant views
- Persistent local demo store (`backend/data/database.json`) that survives server restarts
- REST API endpoints for dashboard data, fleet records, vehicles, dispatching, AI chat, and validated login
- Graceful validation feedback for invalid email/password, invalid vehicle details, missing trip details, unavailable assets, expired licences, and excess cargo capacity
- Dispatch business rules that update vehicle and driver statuses atomically in the local demo store
- AI copilot endpoint with fleet availability, fuel-cost, licence-expiry, and health responses
- Command palette (`Ctrl+K`), notifications, toasts, modal workflows, role-aware settings presentation, and responsive navigation

## Database design

[`database/schema.postgres.sql`](database/schema.postgres.sql) contains the production PostgreSQL design: enums, UUID primary keys, foreign keys, check constraints, unique constraints, and indexes for operational queries. The included JSON store is an intentionally dependency-free local adapter for a runnable demo; replace `backend/lib/store.js` with a PostgreSQL/Supabase repository using that schema and environment credentials for deployment.

## API samples

| Route | Purpose |
| --- | --- |
| `GET /api/dashboard` | Dynamic dashboard aggregates and activity feed |
| `GET /api/vehicles`, `/api/drivers`, `/api/trips` | Operational records |
| `POST /api/vehicles` | Validated vehicle creation |
| `POST /api/trips` | Validated dispatch with safety/business checks |
| `POST /api/auth/login` | Validated login endpoint |
| `POST /api/ai/chat` | Fleet copilot answers |

## Verification completed

- JavaScript syntax checks passed for frontend and backend.
- `GET /api/dashboard` returned seeded live state.
- Invalid login returned `422` and a valid login returned `200`.
