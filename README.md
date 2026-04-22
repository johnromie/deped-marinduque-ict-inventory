# DepEd Marinduque ICT Inventory

## Tech
- Frontend: HTML/CSS/Vanilla JS
- Backend: Node.js (Express)
- Database: SQLite

## Local Run
1. Open terminal in this folder.
2. Install dependencies:
   ```powershell
   npm.cmd install
   ```
3. Start the server:
   ```powershell
   npm.cmd start
   ```
4. Open `http://localhost:3000/` (or `/index.php`).

## Default Accounts
- `ICT` / `admin`

## Features
- Login/logout with session auth
- Change password (current + new + confirm)
- Add/edit/delete ICT inventory records
- Search/filter and dashboard stats
- CSV export

## Public Link Deployment (Render)
1. Push this folder to a GitHub repository.
2. Sign in at `https://render.com`.
3. Click `New +` -> `Blueprint`.
4. Select your GitHub repo.
5. Render will detect `render.yaml` and create the web service.
6. Wait for deploy to finish, then open the generated public URL (example: `https://deped-marinduque-ict-inventory.onrender.com`).

## Important
- Data persistence is enabled via mounted disk at `/var/data`.
- Change default passwords after first login.
- If you want a custom domain, add it in Render service settings.

## Production Notes
- DB file path is configurable via environment variable `DB_PATH`.
- Default local DB path is `data/database.sqlite`.

## Hostinger Deployment (Node.js Add-on)
This repo is now a **Node.js (Express)** app, so Hostinger’s Node.js add-on can import and run it.

Recommended setup on Hostinger:
1. Import the Git repo in the **Node.js** add-on.
2. Set **Startup file** to `server.js` (or run command `npm start`).
3. Add environment variables:
   - `SESSION_SECRET`: a long random secret (required for secure logins)
   - `DB_PATH` (optional): custom DB path; default is `data/database.sqlite`
   - `COOKIE_SECURE` (optional): set to `1` if your site is HTTPS and cookies are not sticking
4. Deploy, then open your domain.
