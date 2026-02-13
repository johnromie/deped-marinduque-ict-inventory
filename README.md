# DepEd Marinduque ICT Inventory

## Tech
- Frontend: HTML/CSS/Vanilla JS
- Backend: PHP 8+
- Database: SQLite

## Local Run
1. Open terminal in this folder.
2. Start PHP server:
   ```powershell
   php -S localhost:8000
   ```
3. Open `http://localhost:8000/index.php`.

## Default Accounts
- `admin` / `admin123`
- `staff` / `staff123`

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
