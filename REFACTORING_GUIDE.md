# Refactoring Blueprint: Monolith to Modular Structure

This document provides a step-by-step execution plan to decompose the monolithic frontend (`App.jsx`) and backend (`server.js`) codebases into a clean, modular monorepo structure.

---

## 🛠️ Phase 1: Extracting Shared Assets (`packages/shared`)

Before breaking down views or routing layers, move all domain-agnostic computations, constants, and types to the shared packages workspace so both apps can refer to them.

1.  **Extract Constants**: Move constants like `DOC_REQUIREMENTS`, `QUAL_PIPELINE`, and `TOUR_STEPS` out of `App.jsx` and place them inside `packages/shared/src/constants.js`.
2.  **Extract Shared Calculators**: Keep computations like candidate fit analysis (`computeFit`) and display string helpers (`titleCase`, `scoreTone`) in `packages/shared/src/utils/`.
3.  **Export Entrypoint**: Update `packages/shared/src/index.js` to export these new folders.
4.  **Run Compilation**: Execute `npm run build:shared` to compile and link.

---

## ⚡ Phase 2: Backend Decomposition (`apps/api`)

Decompose the `server.js` monolith sequentially to isolate routes and queries:

### Step 1: Isolate Common Middlewares (`src/middleware/`)
1.  Move the `authenticateToken` JWT validator into `src/middleware/auth.middleware.js`.
2.  Create a unified `src/middleware/error.middleware.js` to handle server catch exceptions.

### Step 2: Extract Feature modules (`src/modules/`)
Partition resources one at a time. Start with the **Auth Module**:
1.  **Auth Routing**: Create `auth.router.js` and move the `login` and `verify-passcode` endpoints inside it.
2.  **Auth Controller**: Create `auth.controller.js` to handle parameter destructuring and response mapping.
3.  **Auth Repository**: Create database wrappers for user credential checks.

Follow the same sequence for the remaining domains:
*   **Vacancies Module** (`/api/vacancies`, scan, import).
*   **Applications Module** (`/api/applications`, reviews, appointments).

---

## ⚛️ Phase 3: Frontend Decomposition (`apps/web`)

Decompose the massive `App.jsx` by extracting state context and view features:

### Step 1: Setup React Contexts (`src/context/`)
1.  **`AuthContext.jsx`**: Extract the token state (`token`, `user`) and login/logout handlers (`handleLogin`, `handleLogout`).
2.  **`ToastContext.jsx`**: Extract toast alert state (`toast`) and wrapper function (`setToast`).
3.  **Result**: Wrap the application root (`main.jsx`) in these Context Providers.

### Step 2: Extract Shared Components (`src/components/`)
*   Extract global presentation items like `NOSCAItemEditor`, `ModalBox`, or custom combobox search dropdowns.

### Step 3: Split Monolithic Views (`src/features/`)
Deconstruct each section block in `App.jsx` (triggered by `activeView` state) into a dedicated view file:
1.  **`VacanciesView.jsx`**: Move vacancy listing, table columns, filters, and calendar schedules setup.
2.  **`ApplicationsView.jsx`**: Move applicant search inputs, lists, and paginator triggers.
3.  **`AssessmentView.jsx`**: Move comparative scoring charts and HRMPSB deliberation sheets.

---

## 🛡️ Refactoring Safety Rules

To avoid breaking existing portal features during extraction, enforce the following workflow:
1.  **Incremental Commits**: Refactor only one module/file at a time. Never try to decompose frontend and backend simultaneously.
2.  **Continuous Build Verification**: Run `npm run build:web` after extracting each component to guarantee no import path is broken.
3.  **Local Testing**: Log in and out after each phase to verify token transmission remains intact.
