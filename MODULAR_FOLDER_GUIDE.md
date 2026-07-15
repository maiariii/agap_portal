# Architectural Guide: Modular Folder Structure (Monorepo)

This document outlines the architectural blueprint to modularize the **AGAP Portal** codebase. Currently, the system has a large monolithic component file (`App.jsx` with 5,000+ lines) and server file (`server.js` with 900+ lines). Transitioning to a modular, feature-based directory structure will improve maintainability, speed up local development, and simplify scaling.

---

## 📂 Proposed Feature-Based Monorepo Structure

```
agap_portal/
├── apps/
│   ├── web/                     # React Frontend App
│   │   ├── src/
│   │   │   ├── main.jsx         # React bootstrap
│   │   │   ├── App.jsx          # Root Layout & Shell
│   │   │   ├── index.css        # Global CSS system
│   │   │   │
│   │   │   ├── config/          # Configurations (api.js, routes.jsx)
│   │   │   ├── middleware/      # Auth and Notification Providers
│   │   │   │
│   │   │   └── modules/         # Isolated Feature Modules
│   │   │       ├── vacancies/
│   │   │       │   ├── pages/       # Entry Views
│   │   │       │   ├── components/  # Sub-components
│   │   │       │   ├── hooks/       # Custom hooks
│   │   │       │   └── services/    # API Fetches
│   │   │       │
│   │   │       └── applications/
│   │   │           ├── pages/
│   │   │           ├── components/
│   │   │           ├── hooks/
│   │   │           └── services/
│   │   └── package.json
│   │
│   └── api/                     # Node.js Express Backend
│       └── src/
│           ├── server.js        # Entrypoint (initializes Express, db pool, and mounts routers)
│           │
│           ├── config/          # System Configurations
│           │   └── db.js        # Database Pool export
│           │
│           ├── middleware/      # Request Interceptors
│           │   ├── auth.middleware.js       # JWT validation (authenticateToken)
│           │   └── error.middleware.js      # Global error handling logic
│           │
│           └── modules/         # Feature-Based Modules
│               ├── auth/
│               │   ├── auth.router.js       # /api/auth endpoints (login, passcode check)
│               │   └── auth.controller.js   # Request parsing & validation logic
│               │
│               ├── vacancies/
│               │   ├── vacancies.router.js  # /api/vacancies endpoints (schedules, scanner, import)
│               │   ├── vacancies.controller.js
│               │   └── vacancies.service.js # SQL Queries for vacancies & limits checks
│               │
│               └── applications/
│                   ├── apps.router.js       # /api/applications endpoints (reviews, pipeline, appts)
│                   ├── apps.controller.js
│                   └── apps.service.js      # SQL Queries for getHydratedApplications, updates
│
├── packages/
│   └── shared/                  # Common library shared across Web & API
│       ├── src/
│       │   ├── utils/           # Shared helper functions
│       │   ├── constants/       # Pipeline stages, document rules
│       │   └── index.js         # Workspace entrypoint export
│       └── package.json
│
└── package.json                 # Monorepo workspaces configuration
```

---

## 🛠️ Frontend Modularization Strategy (`apps/web`)

Decompose the monolithic `App.jsx` using feature modules, isolated subdirectories, and React Router configurations:

### 1. Unified Router Configurations (`src/config/`)
- `routes.jsx`: Define the React Router pathways. Use `React.lazy` imports to load page-level modules on demand.
- `api.js`: Decouple `apiFetch` from layout contexts.

### 2. Context Providers & Hooks (`src/middleware/`)
- `AuthProvider.jsx`: Provides session validations, JWT checks, login controls.
- `ToastProvider.jsx`: Handles alert rendering.

### 3. Feature Isolation (`src/modules/`)
Each directory encapsulates its full stack of visual and logic concerns:
- **`pages/`**: Serves as the route endpoint view matching a sidebar option.
- **`components/`**: Houses sub-components unique to the feature (e.g. `NoscaItemEditor`).
- **`hooks/`**: Local react state management.
- **`services/`**: Encapsulates fetch wrappers (no raw fetches inside pages).

---

## ⚡ Backend Modularization Strategy (`apps/api`)

To clean up `server.js`, convert handlers into Express routers and controller files:

### 1. `src/middleware/`
Decouple request filters from route definitions:
*   `auth.middleware.js`: Implements the `authenticateToken` JWT validator.
*   `error.middleware.js`: Catch-all express error handler.

### 2. `src/modules/`
Group routes, database queries, and business logic into modular domains:
*   **Router (`*.router.js`)**: Registers endpoints and attaches validation middlewares.
*   **Controller (`*.controller.js`)**: Extracts parameters from requests and formats responses.
*   **Service (`*.service.js`)**: Executes database queries and calculations (e.g. smart limit validations).

Example structure for Vacancies module:
```
modules/vacancies/
├── vacancies.router.js      # app.use('/api/vacancies', router)
├── vacancies.controller.js  # handleScan, handleImport, handleUpdate
└── vacancies.service.js     # DB queries: SELECT * FROM vacancies...
```

---

## 🤝 Monorepo Workspace Configuration

Maintain workspaces in the root `package.json` to manage dependencies seamlessly:
```json
{
  "name": "agap-portal",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```
This configuration allows you to import common assets (e.g., `@agap/shared`) into both the web portal and the API server without copying files.
