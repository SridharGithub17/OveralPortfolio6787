# Real Estate Portfolio Project - Run and Maintenance Guide
If you want both together, use npm run dev:full
## Overview

This project is a React frontend powered by Vite and a Node.js backend that stores application state in SQLite.

- Frontend entry: [`App.jsx`](App.jsx)
- Frontend bootstrap: [`main.jsx`](main.jsx)
- Backend server: [`server.js`](server.js)
- Client storage/API helper: [`storage.js`](storage.js)
- SQLite database file: [`portfolio.db`](portfolio.db)

## Tech Stack

- React 18
- Vite 5
- Express
- SQLite via [`better-sqlite3`](package.json:12)

## Project Structure

- [`App.jsx`](App.jsx): main application logic and UI state orchestration
- [`storage.js`](storage.js): frontend API client, encryption helpers, and legacy browser-data migration logic
- [`server.js`](server.js): backend API and SQLite persistence
- [`SettingsTab.jsx`](SettingsTab.jsx): settings, import/export, security, and maintenance actions
- [`package.json`](package.json): scripts and dependencies

## Prerequisites

Install these before running the project:

- Node.js 18+ recommended
- npm 9+ recommended

## First-Time Setup

From the project root, install dependencies:

```bash
npm install
```

This installs both frontend and backend packages listed in [`package.json`](package.json).

## How to Run the Project End to End

You need two processes:

1. SQLite backend server
2. Vite frontend dev server

### Option 1: Run backend and frontend in separate terminals

Terminal 1:

```bash
npm run server
```

This starts the backend defined in [`server.js`](server.js).

Terminal 2:

```bash
npm run dev
```

This starts the Vite frontend.

Then open the URL shown by Vite, typically:

```text
http://localhost:5173
```

The frontend talks to the backend at:

```text
http://localhost:3001
```

### Option 2: Use the combined helper script

```bash
npm run dev:full
```

This uses the helper script in [`package.json`](package.json:8) to start [`server.js`](server.js) and then launch Vite.

## Production Build

To create a production frontend bundle:

```bash
npm run build
```

The output is written to [`dist`](dist).

To preview the built frontend:

```bash
npm run preview
```

Note: the backend must still be running separately with [`npm run server`](package.json:7).

## SQLite Storage Details

The SQLite database file is:

- [`portfolio.db`](portfolio.db)

It is configured in [`server.js`](server.js:8).

The main table is:

- [`app_state`](server.js:40)

This table stores one JSON document containing the current application state, including:

- properties
- maintenance records
- expenses
- Ohio analysis data
- finances
- settings
- encryption metadata, if enabled

## Legacy Browser Data Migration

The app includes one-time migration logic from legacy browser storage to SQLite.

On startup, [`App.jsx`](App.jsx:47) calls migration logic from [`storage.js`](storage.js:100).

What happens:

1. The app checks for old browser [`localStorage`](storage.js:68) data.
2. If SQLite is still empty, that legacy data is copied into [`portfolio.db`](portfolio.db).
3. The old browser data is removed.
4. The migrated data is loaded into React automatically.

## API Endpoints

The backend currently exposes these endpoints in [`server.js`](server.js):

- `GET /api/state` - get the full saved state
- `PUT /api/state` - replace the full saved state
- `POST /api/reset` - reset the saved state to defaults

## Security / Encryption Behavior

Encryption is still performed in the browser using Web Crypto helpers in [`storage.js`](storage.js:121).

Important behavior:

- If the user enables encryption, the app encrypts the portfolio payload in the browser.
- SQLite stores the encrypted vault blob and metadata.
- The backend does not know the encryption password.
- Password changes and unlock flow remain client-side.

## Daily Maintenance Tasks

### 1. Start the environment

Use:

```bash
npm run server
npm run dev
```

### 2. Check that the backend is reachable

If the frontend shows a backend connection error, verify that [`server.js`](server.js) is running on port `3001`.

### 3. Back up the SQLite database

Back up [`portfolio.db`](portfolio.db) regularly.

Project backup options:

- Run [`npm run backup:db`](package.json:9) to create a timestamped copy in [`backups`](backups)
- Use the **Back up SQLite DB** button in [`SettingsTab.jsx`](SettingsTab.jsx) to trigger the backend backup route

The backup utility script is [`backup-db.js`](backup-db.js).

Generated files include:

- a timestamped copy of [`portfolio.db`](portfolio.db)
- [`portfolio.db-wal`](portfolio.db-wal), if present
- [`portfolio.db-shm`](portfolio.db-shm), if present

You may also back up exported JSON or Excel from the settings screen in [`SettingsTab.jsx`](SettingsTab.jsx).

### 4. Review dependencies

Occasionally run:

```bash
npm audit
```

and:

```bash
npm outdated
```

If updating packages, re-test both [`npm run build`](package.json:9) and the live app flow.

### 5. Rebuild after changes

Whenever you modify frontend or backend logic, run:

```bash
npm run build
```

## Common Maintenance Scenarios

### Reset all stored data

You can reset from the UI using the utilities inside [`SettingsTab.jsx`](SettingsTab.jsx), or call the backend reset endpoint.

UI reset clears the stored SQLite application state back to defaults.

### Move the database to another machine

To move the saved data:

1. Stop the backend
2. Copy [`portfolio.db`](portfolio.db)
3. Place it in the root of the same project on the target machine
4. Start [`server.js`](server.js) again

### Restore from backup

To restore:

1. Stop the backend
2. Replace [`portfolio.db`](portfolio.db) with the backup copy
3. Start the backend again

## Troubleshooting

### Frontend says it cannot connect to backend

Check that:

- [`npm run server`](package.json:7) is running
- port `3001` is available
- [`server.js`](server.js:96) CORS settings still allow the frontend origin

### Old browser data did not migrate

Migration only runs automatically when SQLite is empty.

If the database already contains data, legacy browser storage will not overwrite it. In that case you can:

1. Back up [`portfolio.db`](portfolio.db)
2. Reset the SQLite state
3. Reload the app with the old browser data still present

### Encryption unlock fails

If unlock fails, verify the password being used. The backend only stores the encrypted vault blob; decryption happens in [`storage.js`](storage.js:114).

## Recommended Operational Practice

- Keep [`portfolio.db`](portfolio.db) backed up
- Export JSON or Excel periodically from the settings page
- Test [`npm run build`](package.json:9) after code changes
- Keep backend and frontend versions in sync when deploying
- Avoid manually editing [`portfolio.db`](portfolio.db) unless necessary

## Quick Command Reference

Install dependencies:

```bash
npm install
```

Run backend:

```bash
npm run server
```

Run frontend:

```bash
npm run dev
```

Run both:

```bash
npm run dev:full
```

Build frontend:

```bash
npm run build
```

Preview build:

```bash
npm run preview
```
To access this from other system use the below commands:
Fastest working command pattern:

backend: npm run server
frontend: npm run dev -- --host
then browse to http://YOUR-PC-IP:5173/app.html

Output:
 ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.214:5173/

  If the backend is also needed remotely, use the same PC IP on port 3001 and ensure firewall access is allowed.

  If you want a clean permanent setup, the two code changes are:

update storage.js to use the current hostname instead of localhost
update CORS handling in server.js so requests from http://YOUR-PC-IP:5173 are allowed
After that, the existing data in portfolio.db will be visible from any device on your local network using your PC IP.
