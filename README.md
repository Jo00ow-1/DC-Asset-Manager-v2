# 🏢 DC Asset Manager v2
[한국어](./README_ko.md)

> A full-stack web application for managing data center (IDC) asset inventory across multiple locations — including stock check-in/check-out, monthly physical inspections, and full change history tracking.

Built to replace spreadsheet-based inventory tracking with a searchable, transaction-safe web interface.

### Dashboard
![Dashboard](./docs/DAM2.png)

### DC-wise Stock Status
![DC-wise Stock Status](./docs/DAM4.png)

### Inter-Location Stock Transfer
![Inter-Location Stock Transfer](./docs/DAM7.png)

### Monthly Batch Inspection
![Monthly Batch Inspection](./docs/DAM3.png)

### Add Asset Item (Admin only)
![Add Asset Item](./docs/DAM5.png)

### Delete Asset Item (Admin only)
![Delete Asset Item](./docs/DAM6.png)

### Login
![Login](./docs/login.png)

### Sign Up
![Sign Up](./docs/signup.png)

---

---

## 🛠️ Tech Stack

- **Backend:** Node.js (Express)
- **Database:** PostgreSQL (`pg` driver)
- **Auth:** express-session, bcrypt (password hashing)
- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Reporting:** xlsx (SheetJS) — server-side Excel export

---

## ✨ Key Features

### 1. Multi-Location Asset & Stock Overview
- Uses `LEFT JOIN` and `COALESCE` to reliably aggregate stock quantities by IDC location and category, even when records are missing
- Dashboard view summarizing total inventory stats per location

### 2. Concurrency-Safe Stock Transactions
- PostgreSQL **transactions** (`BEGIN` / `COMMIT` / `ROLLBACK`) ensure atomic updates and automatic rollback on failure
- **Upsert** logic (`ON CONFLICT DO UPDATE`) automates stock record creation/updates
- Every stock change (timestamp, user, quantity delta) is logged to a `stock_logs` table for full audit history

### 3. Batch Inventory Inspection
- Tracks monthly physical inspection progress per location (`monthly_inspections`)
- Compares inspection results against system records and auto-generates logs for any discrepancies found

### 4. Authentication & Access Control
- Passwords stored with one-way `bcrypt` hashing
- Session-based login via `express-session`, with middleware-enforced API authorization

### 5. Role-Based Access Control (Admin / User)
- `users.role` column distinguishes `admin` and `user` accounts, checked via session on every request
- Admin-only actions (adding or deleting asset items) are protected server-side by a `checkAdmin` middleware — not just hidden in the UI
- The "Manage Asset Items" button is dynamically shown/hidden based on the logged-in user's role, fetched via `/api/me`

### 6. Inter-Location Stock Transfer
- Added a "Transfer" option alongside Use/Return, allowing stock to move directly between IDC locations
- Each transfer creates a paired log entry — `이전(출고)` (transfer-out) at the source and `이전(입고)` (transfer-in) at the destination — both within the same transaction for consistency

### 7. Requester Tracking
- Use/Return/Transfer actions now require a requester name, stored alongside the operator (`updated_by`) for full accountability
- Batch monthly inspections intentionally omit requester, since they reconcile overall stock counts rather than track individual requests

### 8. Excel Export
- Generates a downloadable `.xlsx` report of the current month's full inspection data across all locations, using the `xlsx` (SheetJS) library on the server
- Open to all logged-in users (not admin-restricted) since it's meant for sharing inspection results across the team

### 9. Account Management
- Users can change their own password from a dropdown menu under their username, with current-password verification
- Logout moved into the same dropdown for a cleaner header UI

### 10. Full History Search
- Dedicated modal for searching all stock change history across locations, with filters by location, category, and free-text search on spec/vendor
- Paginated results (25 per page) for large history sets

---

## 📐 Database Schema (Summary)

| Table | Description |
|---|---|
| `users` | User accounts, hashed passwords, and role (`admin` / `user`) |
| `locations` | Data center (IDC) location info |
| `items` | Asset categories, manufacturers, specs |
| `stock` | Per-location stock quantities (composite key: `location_id`, `item_id`) |
| `stock_logs` | History of all stock changes (check-in/out, inspections) |
| `monthly_inspections` | Per-location monthly inspection completion status and owner |
| `stock_logs` | History of all stock changes (check-in/out, transfers, inspections), including requester for check-in/out/transfer |

---

## 🚀 Getting Started

```bash
# 1. Clone the repo
git clone https://github.com/Jo00ow-1/DC-Asset-Manager-v2.git
cd DC-Asset-Manager-v2

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# then fill in your DB credentials and session secret in .env

# 4. Set up the database schema
psql -U your_username -d your_dbname -f schema.sql

# 5. Start the server
npm start
```

The app will be available at `http://localhost:3000` (or whichever port is set in `.env`).

---

## 📌 Project Status

This is an active personal project (v2 rebuild of an internal tool originally built at work) and is still under development. Current focus areas:
- [x] Finalize `.env.example` and setup docs
- [ ] Add automated tests
- [ ] Deploy a live demo
