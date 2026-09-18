# AIV Support Portal

A full-featured customer support ticket management system built with React, TypeScript, Vite, and Supabase.

## Features

- **Customer Portal** — create tickets, track status, reply to agents
- **Agent Dashboard** — ticket queue, assignment, SLA tracking, internal notes
- **Admin Panel** — manage accounts, users, support plans, SLA policies, teams, calendars
- **Dual Priority System** — separate Customer Priority and AIV (operational) Priority per ticket
- **SLA Engine** — automatic SLA snapshots, breach tracking, pause/resume support
- **Rich Text Editor** — formatted messages with image/file attachments
- **Role-Based Access** — customer_user, customer_admin, agent, manager, account_manager, admin

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm (comes with Node.js)
- **Option A:** A [Supabase](https://supabase.com/) cloud project (free tier works)
- **Option B:** [Docker](https://www.docker.com/) installed (for local PostgreSQL via Supabase CLI)

---

## Local Setup (Option A — Supabase Cloud)

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd aiv-support-portal
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root with your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

You can find these values in your Supabase project dashboard under **Settings > API**.

### 4. Apply database migrations

Run the SQL migration files (located in `supabase/migrations/`) against your Supabase database in order. You can do this via the Supabase Dashboard SQL Editor:

1. `001_foundation_tables.sql` — profiles, accounts, support plans, teams, categories
2. `002_ticketing_tables.sql` — tickets, messages, attachments, SLA tables, audit logs
3. `003_ticket_sequence_and_sla.sql` — ticket number sequence, SLA helper functions
4. `004_seed_data.sql` — initial seed data (admin user, demo accounts, sample plans)
5. `005_fix_profile_creation.sql` — profile creation trigger fix
6. `006_fix_profile_select.sql` — profile select policy fix
7. `007_storage_policies.sql` — storage bucket and access policies for attachments
8. `008_fix_helper_functions_auth_uid.sql` — auth helper function corrections
9. `009_add_profiles_fk.sql` — profile foreign key to auth.users
10. `010_add_dual_priority_columns.sql` — customer_priority and aiv_priority columns
11. `011_add_accounts_fk_constraints.sql` — foreign keys for account relationships

### 5. Start the development server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Local Setup (Option B — Local PostgreSQL without Supabase)

This option uses a standalone PostgreSQL server on your machine. You apply the same migration SQL files directly.

### Prerequisites

- PostgreSQL 14 or later installed locally
- `psql` command-line tool (comes with PostgreSQL)

### 1. Install PostgreSQL

```bash
# macOS
brew install postgresql@16
brew services start postgresql@16

# Ubuntu / Debian
sudo apt update && sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# Windows — download installer from https://www.postgresql.org/download/windows/

# Docker (any platform)
docker run --name aiv-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
```

### 2. Create the database

```bash
psql -U postgres -c "CREATE DATABASE aiv_support;"
```

### 3. Create the `auth` schema stub

The migrations reference Supabase's `auth.uid()` function for row-level security. To satisfy those references on plain PostgreSQL, create a minimal stub:

```bash
psql -U postgres -d aiv_support -c "
CREATE SCHEMA IF NOT EXISTS auth;

-- Stub: returns NULL (no authenticated user in raw PG context)
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS \$\$
  SELECT current_setting('app.current_user_id', true)::uuid;
\$\$;
"
```

> When running queries locally, you can simulate an authenticated user by setting the session variable:
> `SET app.current_user_id = 'your-user-uuid-here';`

### 4. Apply migrations

Run all migration files in order:

```bash
for file in supabase/migrations/*.sql; do
  psql -U postgres -d aiv_support -f "$file"
done
```

Or apply them one by one if you prefer:

```bash
psql -U postgres -d aiv_support -f supabase/migrations/20260820101034_001_foundation_tables.sql
psql -U postgres -d aiv_support -f supabase/migrations/20260820101113_002_ticketing_tables.sql
psql -U postgres -d aiv_support -f supabase/migrations/20260820101134_003_ticket_sequence_and_sla.sql
psql -U postgres -d aiv_support -f supabase/migrations/20260820101345_004_seed_data.sql
psql -U postgres -d aiv_support -f supabase/migrations/20260820103347_005_fix_profile_creation.sql
psql -U postgres -d aiv_support -f supabase/migrations/20260820103506_006_fix_profile_select.sql
psql -U postgres -d aiv_support -f supabase/migrations/20260824093133_007_storage_policies.sql
psql -U postgres -d aiv_support -f supabase/migrations/20260824094424_008_fix_helper_functions_auth_uid.sql
psql -U postgres -d aiv_support -f supabase/migrations/20260824094924_009_add_profiles_fk.sql
psql -U postgres -d aiv_support -f supabase/migrations/20260824095414_010_add_dual_priority_columns.sql
psql -U postgres -d aiv_support -f supabase/migrations/20260824100045_011_add_accounts_fk_constraints.sql
```

### 5. Verify the schema

```bash
psql -U postgres -d aiv_support -c "\dt public.*"
```

You should see tables like `accounts`, `profiles`, `tickets`, `ticket_messages`, `support_plans`, etc.

### 6. Connect with a GUI tool (optional)

Use pgAdmin, DBeaver, TablePlus, or any PostgreSQL client:

```
Host:     localhost
Port:     5432
Database: aiv_support
User:     postgres
Password: postgres
```

### 7. Notes on running the frontend app

The frontend app connects to a Supabase-hosted API (PostgREST + GoTrue) rather than directly to PostgreSQL. To run the full app locally against your PostgreSQL database, you would need to also run PostgREST and GoTrue locally — the simplest way to do that is via `docker compose` with the official Supabase self-hosted images.

For database schema inspection, data seeding, writing backend scripts, or preparing for a self-hosted deployment, the steps above are all you need.

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build locally |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run lint` | Run ESLint |

---

## Project Structure

```
src/
├── components/
│   ├── layout/         # App shell, sidebar, navigation
│   └── ui/             # Reusable UI components (Button, Card, Modal, etc.)
├── contexts/           # React context providers (Auth)
├── lib/                # Supabase client, constants, utilities
├── pages/
│   ├── admin/          # Admin panel pages
│   ├── agent/          # Agent dashboard and queue
│   ├── auth/           # Login page
│   ├── manager/        # Reports
│   ├── portal/         # Customer-facing pages
│   └── shared/         # Shared pages (TicketDetail)
├── types/              # TypeScript type definitions
├── App.tsx             # Router and route definitions
└── main.tsx            # Entry point
```

---

## Default Login

After running the seed migration, you can log in with:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@aivsupport.com | admin123 |

Additional test users are created by the seed data — check `004_seed_data.sql` for details.

---

## Tech Stack

- **Frontend** — React 18, TypeScript, Vite
- **Styling** — Tailwind CSS
- **Routing** — React Router v7
- **Icons** — Lucide React
- **Backend** — Supabase (PostgreSQL, Auth, Storage, RLS)

---

## Deployment

Build the production bundle:

```bash
npm run build
```

The output is in the `dist/` folder, ready to deploy to any static hosting provider (Netlify, Vercel, Cloudflare Pages, etc.). Make sure your hosting environment has the `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` environment variables set.
