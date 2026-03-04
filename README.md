# School Attendance App

This project includes:
- `backend/`: Node.js + Express API with MySQL
- `frontend/studentPanel/`: React + Vite frontend

## Production Improvements Applied

- Added missing `students` table bootstrap in backend startup for fresh databases.
- Removed insecure login fallback to hardcoded/default credentials.
- Added production guard for required secret (`JWT_SECRET`).
- Added configurable CORS via `CORS_ORIGIN`.
- Added DB host port + SSL toggles (`DB_PORT`, `DB_SSL`, `DB_SSL_REJECT_UNAUTHORIZED`).
- Added `/health` endpoint for Render health checks.
- Added Render blueprint (`render.yaml`) and `.env.example` templates.
- Switched password hashing to bcrypt with automatic migration for legacy PBKDF2 hashes on login.
- Added teacher self-registration by email with optional invite-code protection.
- Replaced custom token format with standard JWT (`jsonwebtoken`) auth tokens.

## Render Deployment

`render.yaml` is configured for:
- `school-backend` (Web Service)
- `school-frontend` (Static Site)

### 1. Prepare an Aiven MySQL database

Render does not provide managed MySQL. Use Aiven MySQL and collect:
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_SSL=true`
- `DB_SSL_REJECT_UNAUTHORIZED=true`
- `DB_CA_CERT` (paste Aiven CA certificate PEM, use `\n` for line breaks) or `DB_CA_CERT_PATH`
  - If no CA cert is provided, app defaults to `rejectUnauthorized=false` for SSL connections (Aiven quick-connect mode).

You can also provide Aiven-named variables directly:
- `AIVEN_MYSQL_HOST`, `AIVEN_MYSQL_PORT`, `AIVEN_MYSQL_USER`, `AIVEN_MYSQL_PASSWORD`, `AIVEN_MYSQL_DATABASE`
- `AIVEN_CA_CERT`

### 2. Create services from Blueprint

In Render:
1. New `+` -> Blueprint
2. Select this repo
3. Render reads `render.yaml` and creates both services

### 3. Set required backend environment variables

Set these on `school-backend`:
- `DB_HOST`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `JWT_SECRET`

Optional:
- `DB_PORT` (default `3306`)
- `DB_SSL`, `DB_SSL_REJECT_UNAUTHORIZED`
- `DB_CA_CERT` or `DB_CA_CERT_PATH`
- `TEACHER_USERNAME` (default `teacher`)
- `TEACHER_PASSWORD` (only needed if you want automatic bootstrap admin creation)
- `TEACHER_INVITE_CODE` (if set, teacher self-registration requires this code)
- `CORS_ORIGIN` or `FRONTEND_URL` (optional override; by default backend uses frontend `RENDER_EXTERNAL_URL` from blueprint wiring)

### 4. Set frontend API base URL

The blueprint now auto-wires frontend API URL to backend service URL.

Optional override on `school-frontend`:
- `VITE_API_BASE_URL`
  - Accepts either `https://<backend>.onrender.com` or `https://<backend>.onrender.com/api`

### 5. Deploy

Deploy both services. Backend startup will auto-create required tables if missing.

# futuresync
