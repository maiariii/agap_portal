# Refactoring Blueprint & Folder Modularization Guide

This document outlines the architectural blueprint and execution plan to decompose the monolithic **AGAP Portal** codebase (originally featuring a 5,000+ line React frontend `App.jsx` and a 900+ line backend `server.js`) into a clean, modular monorepo structure.

---

## 📂 Feature-Based Monorepo Structure

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
│├── packages/
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

## 🛠️ Phase 1: Extracting Shared Assets (`packages/shared`)

Before breaking down views or routing layers, move all domain-agnostic computations, constants, and types to the shared packages workspace so both apps can refer to them.

1.  **Extract Constants**: Move constants like `DOC_REQUIREMENTS`, `QUAL_PIPELINE`, and `TOUR_STEPS` out of `App.jsx` and place them inside `packages/shared/src/constants.js`.
2.  **Extract Shared Calculators**: Keep computations like candidate fit analysis (`computeFit`) and display string helpers (`titleCase`, `scoreTone`) in `packages/shared/src/utils/`.
3.  **Export Entrypoint**: Update `packages/shared/src/index.js` to export these new folders.
4.  **Run Compilation**: Execute `npm run build:shared` to compile and link.

---

## ⚡ Phase 2: Backend Decomposition (`apps/api`)

To clean up `server.js`, convert handlers into Express routers and controller files:

### Step 1: Isolate Common Middlewares (`src/middleware/`)
1.  Move the `authenticateToken` JWT validator into `src/middleware/auth.middleware.js`.
2.  Create a unified `src/middleware/error.middleware.js` to handle server catch exceptions.

### Step 2: Extract Feature modules (`src/modules/`)
Partition resources one at a time. Group routes, database queries, and business logic into modular domains.
Start with the **Auth Module**:
1.  **Auth Routing**: Create `auth.router.js` and move the `login` and `verify-passcode` endpoints inside it.
2.  **Auth Controller**: Create `auth.controller.js` to handle parameter destructuring and response mapping.
3.  **Auth Repository**: Create database wrappers for user credential checks.

Follow the same sequence for the remaining domains:
*   **Vacancies Module** (`/api/vacancies`, scan, import, schedule calendar limits).
    *   `vacancies.router.js` - registers endpoints and validation.
    *   `vacancies.controller.js` - handles HTTP parsing and responses.
    *   `vacancies.service.js` - database queries (`SELECT * FROM vacancies...`).
*   **Applications Module** (`/api/applications`, reviews, appointments, pipeline status).

---

## ⚛️ Phase 3: Frontend Decomposition (`apps/web`)

Decompose the monolithic React frontend using feature modules, isolated subdirectories, and React Router configurations:

### Step 1: Setup React Contexts & Providers (`src/middleware/` / `src/context/`)
1.  **`AuthContext.jsx`** / `AuthProvider.jsx`: Extract the token state (`token`, `user`) and login/logout handlers.
2.  **`ToastContext.jsx`** / `ToastProvider.jsx`: Extract toast alert state (`toast`) and wrapper function (`setToast`).
3.  **Result**: Wrap the application root (`main.jsx`) in these Context Providers.

### Step 2: Setup Unified Router Configurations (`src/config/`)
*   `routes.jsx`: Define the React Router pathways. Use `React.lazy` imports to load page-level modules on demand.
*   `api.js`: Decouple `apiFetch` from layout contexts.

### Step 3: Extract Shared Components (`src/components/`)
*   Extract global presentation items like `NOSCAItemEditor`, `ModalBox`, or custom search dropdowns.

### Step 4: Split Monolithic Views into Isolated Modules (`src/modules/`)
Deconstruct each section block in `App.jsx` (triggered by `activeView` state) into a dedicated feature folder containing:
*   **`pages/`**: The route endpoint view matching a sidebar option.
*   **`components/`**: Houses sub-components unique to the feature.
*   **`hooks/`**: Local react state management.
*   **`services/`**: Encapsulates fetch wrappers (no raw fetches inside pages).

Features to split:
1.  **`VacanciesView.jsx`**: Move vacancy listing, table columns, filters, and calendar schedules setup.
2.  **`ApplicationsView.jsx`**: Move applicant search inputs, lists, and paginator triggers.
3.  **`AssessmentView.jsx`**: Move comparative scoring charts and HRMPSB deliberation sheets.

---

## 🛡️ Refactoring Safety Rules

To avoid breaking existing portal features during extraction, enforce the following workflow:
1.  **Incremental Commits**: Refactor only one module/file at a time. Never try to decompose frontend and backend simultaneously.
2.  **Continuous Build Verification**: Run `npm run build:web` after extracting each component to guarantee no import path is broken.
3.  **Local Testing**: Log in and out after each phase to verify token transmission remains intact.
