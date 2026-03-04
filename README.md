# School Attendance App

This project includes:
- `backend/`: Node.js + Express API with MySQL
- `frontend/studentPanel/`: React + Vite frontend

## Production Improvements Applied

- Added missing `students` table bootstrap in backend startup for fresh databases.
- Removed insecure login fallback to hardcoded/default credentials.
- Added production guards for required secrets (`JWT_SECRET`, `TEACHER_PASSWORD`).
- Added configurable CORS via `CORS_ORIGIN`.
- Added DB host port + SSL toggles (`DB_PORT`, `DB_SSL`, `DB_SSL_REJECT_UNAUTHORIZED`).
- Added `/health` endpoint for Render health checks.
- Added Render blueprint (`render.yaml`) and `.env.example` templates.

## Render Deployment

`render.yaml` is configured for:
- `school-backend` (Web Service)
- `school-frontend` (Static Site)

### 1. Prepare a MySQL database

Render does not provide managed MySQL. Use an external MySQL provider and collect:
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_SSL` (`true` for providers requiring TLS)
- `DB_SSL_REJECT_UNAUTHORIZED` (`true` unless provider docs require otherwise)

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
- `TEACHER_PASSWORD`

Optional:
- `DB_PORT` (default `3306`)
- `DB_SSL`, `DB_SSL_REJECT_UNAUTHORIZED`
- `TEACHER_USERNAME` (default `teacher`)
- `CORS_ORIGIN` (optional override; by default backend uses frontend `RENDER_EXTERNAL_URL` from blueprint wiring)

### 4. Set frontend API base URL

The blueprint now auto-wires frontend API URL to backend service URL.

Optional override on `school-frontend`:
- `VITE_API_BASE_URL`
  - Accepts either `https://<backend>.onrender.com` or `https://<backend>.onrender.com/api`

### 5. Deploy

Deploy both services. Backend startup will auto-create required tables if missing.

# futuresync
