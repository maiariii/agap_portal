# Troubleshooting & Debugging Guide: Web and API

This document provides a systematic guide for debugging and troubleshooting issues across the **AGAP Portal** frontend and backend stacks.

---

## 💻 Frontend Debugging (`apps/web`)

### 1. Intercepting API & Network Errors
When an action fails (e.g., status code `403 Forbidden` or `500 Internal Error` on requests):
1.  Open Chrome/Firefox **Developer Tools** (`F12` or `Ctrl + Shift + I`).
2.  Navigate to the **Network** tab.
3.  Filter by **Fetch/XHR** requests.
4.  Select the failed request (red line) and check:
    *   **Headers**: Ensure `Authorization: Bearer <token>` is present and properly formed.
    *   **Payload**: Verify the JSON payload matches the structure expected by the server.
    *   **Response**: The backend outputs detailed error descriptions in the JSON response (e.g. `{ error: "Invalid token" }` or `{ error: "column does not exist" }`).

### 2. Inspecting Component State & Re-renders
*   Install the **React Developer Tools** browser extension.
*   Use the **Components** tab to inspect state values, context providers, and hooks in real-time.
*   Use the **Profiler** tab to identify bottleneck components triggering excessive re-renders.

---

## ⚙️ Backend Debugging (`apps/api`)

### 1. Inspecting Live Logs & Nodemon Stack Traces
*   When running the dev environment (`npm run dev`), the terminal outputs the live logs.
*   Look for database connection errors or syntax errors. If a route throws an unhandled exception, Express's global error handler logs the stack trace to stdout:
    ```
    error: select * from invalid_table ...
    at Pool.query (node_modules/pg/lib/client.js...)
    ```

### 2. Interactive Node Debugging
To debug the backend using breakpoints:
1.  Run the API server with the `--inspect` flag:
    ```bash
    node --inspect src/server.js
    ```
2.  Open `chrome://inspect` in Google Chrome and click **Open dedicated DevTools for Node**.
3.  Set breakpoints directly inside your controller and service files to inspect active variables.

---

## 🗄️ Database Debugging (PostgreSQL)

### 1. Logging Database Queries
To view exactly what SQL queries are executed against the database, add a wrapper function or helper inside the repository logic or database configuration file:
```javascript
const query = async (text, params) => {
  const start = Date.now();
  console.log(`[SQL Execute] query: ${text} | params: ${JSON.stringify(params)}`);
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log(`[SQL Completed] took ${duration}ms | rows: ${res.rowCount}`);
  return res;
};
```

### 2. Live Database Console Connection
To manually inspect database tables, run query commands, or clear tables directly, connect to your PostgreSQL database using the `DATABASE_URL` found in your `.env` file via `psql` or graphical utilities like **DBeaver** or **pgAdmin**:
```bash
psql "postgres://username:password@host:port/database?sslmode=require"
```
Useful diagnostic commands:
*   `\dt` : Lists all active tables.
*   `SELECT * FROM pg_stat_activity;` : Shows active transactions and query locks.

---

## 🚨 Common Debugging Scenarios

### 1. "Server returned status 403" / "Invalid Token"
*   **Cause**: The JWT login session has expired (tokens are configured to expire in 2 hours).
*   **Resolution**: Clean your local states by logging out and logging back in to get a fresh token.

### 2. "Connection refused" / "Failed to Fetch"
*   **Cause**: The Express backend API server is offline, or Vite is trying to proxy to the wrong port.
*   **Resolution**: 
    *   Verify the backend is running (`npm run dev:api`).
    *   Ensure the proxy target in `apps/web/vite.config.js` matches the active port in `apps/api/src/server.js` (default: `http://localhost:5000`).
