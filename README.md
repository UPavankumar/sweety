# Sweety - Blood Glucose Tracking System

Sweety is a full-stack web app for daily blood glucose monitoring. A patient signs in, logs up to 4 readings per day (one per meal slot), sees their complete history in a ledger, and gets reports (daily, month-to-date, previous month) with highest, lowest and average values.

## Features

- **Patient accounts** - register and sign in with email and password (JWT authentication, bcrypt password hashing).
- **Log readings** - record a glucose value for a date and meal slot. The API enforces the intake rules listed under Validation rules below.
- **Glucose Ledger** - full history of readings with a per-reading status label, date filter, edit and delete.
- **Reports & Analytics** - daily, month-to-date and previous-month reports with count, highest, lowest and average glucose, computed with SQL aggregations.
- **Demo account** - one command seeds a demo patient with sample readings so a reviewer can try the app immediately.

## Tech stack

| Layer    | Technology                                   |
|----------|----------------------------------------------|
| Frontend | React 19, Vite 8 (dev server on port 5173)   |
| Backend  | Node.js, Express 5 (API server on port 5000) |
| Database | PostgreSQL (local or Neon serverless)        |
| Auth     | JSON Web Tokens + bcrypt                     |

## Prerequisites

- **Node.js 20.19+ within 20.x, or Node.js 22.12+** (tested with 22.23.4) - required by Vite 8 (`^20.19.0 || >=22.12.0`). The backend itself needs only Node 18+, so the Vite requirement is the binding one.
- A PostgreSQL database. Either works:
  - a local PostgreSQL install, or
  - a free [Neon](https://neon.tech) serverless database (the `.env.example` shows the Neon URL format)

## Quick start

```bash
# 1. Clone the repository
git clone https://github.com/UPavankumar/sweety.git
cd sweety

# 2. Set up the backend
cd server
npm install
cp .env.example .env        # then edit .env - see "Environment variables" below
                            # Windows PowerShell/CMD: copy .env.example .env

# 3. Create the tables and load the demo data
npm run db:migrate
npm run db:seed

# 4. Start the API server (leave this terminal running)
npm run dev                 # or: npm start

# 5. In a second terminal, from the folder where you cloned the repo:
cd sweety/client
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

On the sign-in page, click **"Fill Demo Credentials"** (or type them yourself) and sign in:

- **Email:** `demo@sweety.com`
- **Password:** `Password123!`

You will land on the Log Reading screen with 16 demo readings already in the ledger and reports ready to view.

## Environment variables

The server reads `server/.env`. Copy `server/.env.example` and fill in:

| Variable       | What it is                                 | Example                                                        |
|----------------|--------------------------------------------|----------------------------------------------------------------|
| `PORT`         | Port for the API server (default 5000)     | `5000`                                                         |
| `DATABASE_URL` | PostgreSQL connection string               | `postgresql://user:password@host:5432/sweety` (local) or the Neon URL from `.env.example` |
| `JWT_SECRET`   | Any long random string used to sign tokens | pick your own                                                  |

`.env.example` also documents optional settings (CORS origins, reverse-proxy trust, login/register rate limits) that have sensible local defaults.

The frontend needs **no environment variables** - in development, the Vite dev server proxies `/auth`, `/readings`, `/reports` and `/health` to `http://localhost:5000` automatically (see `client/vite.config.js`).

## Database setup

Run these from the `server/` directory:

```bash
npm run db:migrate   # creates the users and readings tables (schema.sql)
npm run db:seed      # creates the demo account + 16 sample readings (seed.js)
```

What the seed creates:

- Demo user `demo@sweety.com` / `Password123!` (bcrypt-hashed, 10 rounds)
- Up to 16 readings on dates relative to when you seed: all 4 slots for today, readings from earlier this month (days 1, 5 and 10, only when they are before today), and 6 readings from the previous month - so daily, month-to-date and previous-month reports all have data whenever you seed

The seed is repeatable: it deletes any existing `demo@sweety.com` user first, so you can run it again any time to reset the demo.

Schema (simplified):

- **users** - id, name, email (unique), password_hash, created_at
- **readings** - id, user_id (foreign key), date, slot, value, created_at, with a UNIQUE(user_id, date, slot) constraint

## Using the app

After signing in, the sidebar has five sections:

1. **Log Reading** (default) - the intake form: pick a date, a meal window slot, enter the glucose value.
2. **Glucose Ledger** - every reading you have logged, with its status label color-coded. Filter by date, edit or delete entries.
3. **Reports & Analytics** - pick a report type (Daily, Month-to-Date, Monthly - previous month) and a reference date.
4. **Patient Account** - account details.
5. **Settings** - preferences.

### Validation rules

All rules below are enforced by the API (`server/middleware/validateReading.js`). Three of them are also enforced at the database level: the one-reading-per-slot-per-day rule by a UNIQUE(user_id, date, slot) constraint, and the value range (40-600) and allowed slots by CHECK constraints (see `server/schema.sql` and `server/constraints.sql`).

- Date must be in `YYYY-MM-DD` format and cannot be in the future
- Slot must be one of: `Morning (fasting)`, `After breakfast`, `After lunch`, `After dinner`
- Only **one reading per slot per day** (a second one is rejected with an error)
- Maximum **4 readings per day** (one per slot)
- Glucose value must be a whole number between **40 and 600 mg/dL**

## API reference

All endpoints except `/auth/*` and `/health` require an `Authorization: Bearer <token>` header from login.

| Method | Endpoint           | Description                                             |
|--------|--------------------|---------------------------------------------------------|
| GET    | `/health`          | Health check                                            |
| POST   | `/auth/register`   | Create an account (name, email, password)               |
| POST   | `/auth/login`      | Sign in, returns a JWT                                  |
| GET    | `/readings`        | List your readings (`?date=YYYY-MM-DD` to filter)       |
| POST   | `/readings`        | Add a reading (date, slot, value)                       |
| PUT    | `/readings/:id`    | Edit a reading                                          |
| DELETE | `/readings/:id`    | Delete a reading                                        |
| GET    | `/reports`         | `?type=daily\|month-to-date\|monthly&date=YYYY-MM-DD` - returns count, highest, lowest, average and the matching readings |

## Project structure

```
sweety/
├── client/                  # React + Vite frontend
│   └── src/
│       ├── components/      # Navbar, Sidebar, forms, lists
│       │   └── views/       # LogReading, Ledger, Reports, Account, Settings
│       ├── context/         # auth state
│       └── api.js           # fetch wrappers for the API
├── server/                  # Express API
│   ├── routes/              # auth.js, readings.js, reports.js
│   ├── middleware/          # auth.js (JWT), validateReading.js (intake rules)
│   ├── schema.sql           # table definitions
│   ├── migrate.js           # applies schema.sql
│   ├── seed.js              # demo user + sample readings
│   └── .env.example         # copy to .env and fill in
└── neon.ts                  # optional Neon branch config (only used by the Neon CLI)
```

## Tests

The server has an automated API test suite (Jest + Supertest) covering authentication, reading validation (all five intake rules), reading CRUD, reports, and security hardening.

The suite runs against a **separate test database** - it drops and recreates tables, so it never touches your dev data. It refuses to start unless the database name contains "test".

```bash
cd server

# point the suite at a dedicated test database, either:
export TEST_DATABASE_URL=postgresql://user:password@localhost:5432/sweety_test
# or create server/.env.test.local with that line (git-ignored)

npm test
```

`npm test` runs Jest with `--runInBand --detectOpenHandles` (see `server/tests/` for the suites and helpers).


## Notes

- **Demo credentials are intentional.** `demo@sweety.com` / `Password123!` is seeded sample data so reviewers can sign in instantly; it is not a real user. The sign-in page shows a "Fill Demo Credentials" button for convenience.
- **Status labels are demo logic, not medical guidance.** The Normal / Elevated / High Risk / Hypoglycemia labels in the ledger and the target ranges on the intake screen are simple threshold classifications built for this demo. They are not medical advice.
- **Seed dates are relative to when you run the seed**, so all three report types have data immediately: the Daily report for today and the Month-to-Date report work out of the box.
- **"Monthly" report** always covers the calendar month before the reference date's month.
- **Production deployment is out of scope** for this take-home - the app runs locally in development mode. The Neon `DATABASE_URL` format is supported so the same code works against a hosted database.
- `neon.ts` at the repo root is optional configuration for the Neon CLI's branch management. The app does not read it at runtime; it is safe to ignore for local setup.
