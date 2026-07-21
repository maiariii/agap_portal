# Systems Architecture & Full-Stack Playbook

This document defines the production-grade architectural standards, design patterns, integration systems, and operational guidelines for the **AGAP Portal**. Written for full-stack and principal-level engineers, it details how the codebase is structured, integrated, and optimized for scale and security.

---

## 🏛️ System Architecture Overview

The system transitions from a traditional monolithic monorepo setup to a strict **Layered Clean Architecture** combined with **Domain-Driven Design (DDD)** concepts.

```
                  ┌─────────────────────────────────────────┐
                  │              apps/web (UI)              │
                  │   Contexts ➔ Views ➔ Components ➔ Hooks  │
                  └────────────────────┬────────────────────┘
                                       │ (HTTPS / REST)
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │              apps/api (I/O)             │
                  │ Routers ➔ Controllers ➔ Services ➔ Repo  │
                  └────────────────────┬────────────────────┘
                                       │ (SQL / TX)
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │           PostgreSQL Database           │
                  │   Tables ➔ Indexes ➔ Locking / TXs      │
                  └─────────────────────────────────────────┘
```

---

## ⚛️ Frontend Architecture: Modular React Structure (`apps/web`)

The frontend separates state management, layouts, pages, and API logic to maintain render efficiency and a clean dependency graph.

### 1. Unified State & Context Providers (`src/context`)
Cross-cutting concerns (authentication, active user session, global notification toasts) are isolated from layouts and view components.
*   **`AuthContext.jsx`**: Handles token lifecycle, login/logout logic, and role-based permissions.
*   **`ToastContext.jsx`**: Exposes a hook-based API (`useToast()`) to trigger alerts from any component layer without prop drilling.

### 2. Domain Partitioning (`src/features`)
Components, custom hooks, and business logic are grouped into self-contained domain directories:
*   **`/features/vacancies`**: Handles vacancy tables, calendar schedule setups, and the character-by-character NOSCA scanner.
*   **`/features/applications`**: Contains initial evaluations, checklists, and evaluation state management.
*   **`/features/assessment`**: Contains assessment score inputs, comparative evaluation formulas, and ranking ledgers.

### 3. Separation of Concerns inside Components
Each feature module separates pure layout markup from data fetching and logic:
1.  **Views (`*View.jsx`)**: Container components that connect to context providers and load data.
2.  **Logic Components (`*Table.jsx`, `*Modal.jsx`)**: Presentational layout blocks receiving clean props.
3.  **Hooks (`hooks/use*.js`)**: State management, calculation logic, and API calls abstracted into functional hooks.

---

## ⚙️ Backend Architecture: Layered Express Design (`apps/api`)

The API server decouples database transactions from route handling by dividing logic into three primary layers:

### 1. Layered Architecture Pattern
*   **Routing Layer (`*.router.js`)**: Matches incoming REST endpoints, parses request objects, validates tokens using `authenticateToken`, and delegates to controllers.
*   **Controller Layer (`*.controller.js`)**: Extracts parameters from request payloads, performs basic validation, triggers services, and handles HTTP response outputs.
*   **Service Layer (`*.service.js`)**: Encapsulates core business rules (e.g., computing candidate fit scores, parsing scanner output).
*   **Repository Layer (`*.repository.js`)**: Interfaces directly with the PostgreSQL pool, separating raw SQL strings from service logic.

### 2. Advanced Concurrency & Transaction Control (Race Conditions)
During bulk NOSCA imports or school assignments, concurrent requests could trigger race conditions or cap overruns. To prevent this, services must lock parent records inside a transaction using row-level locking:
```sql
BEGIN;
SELECT allocated_slots, total_limit 
FROM division_allocations 
WHERE division = $1 
FOR UPDATE; -- Locks the row until the transaction commits or rolls back.

-- Perform validation checks in the service layer...

INSERT INTO vacancies (...);
UPDATE division_allocations SET allocated_slots = allocated_slots + 1 WHERE division = $1;
COMMIT;
```

---

## 🔄 Full-Stack Data Lifecycle & Type Sharing

The application uses strict data mapping layers to synchronize database schemas, REST payloads, and frontend UI states:

```
  [Database Schema] ──► [Repository Layer] ──► [Controller Mapper]
                                                     │
                                                     ▼ (REST JSON Payload)
  [Frontend View]   ◄── [Custom State Hook] ◄── [apiFetch Interceptor]
```

### Shared Type Contracts (`packages/shared`)
Unified data definitions reside in the shared library so both frontend and backend handle contracts identically:
*   **Mappers**: Mapping functions (such as database row mappers like `mapVacancy` or fit evaluators like `computeFit`) are located in the shared library.
*   **Schemas**: Define validation rules for REST payloads (e.g., checking that a School ID contains exactly 6 digits, or that an item number conforms to the scanned regex format).

---

## ⚡ State Synchronization & Request Coordination

Managing state transitions in multi-step workflows requires synchronized transactional boundaries across the full stack.

### 1. Optimistic UI Updates vs. Pessimistic Locking
*   **Pessimistic Operations**: Critical limit checks (e.g. validating vacancy allocations against division caps in `/api/nosca/check-limit`) must block the frontend UI (show loaders) and run under database row locks (`SELECT FOR UPDATE` inside transactions) on the backend to prevent concurrent double-allocations.
*   **Optimistic Actions**: Status updates and local checkbox toggling can update the UI instantly, with background rollback handlers if the API call fails.

### 2. Consolidated Refetching Patterns
Avoid scattered API fetching. When a mutative transaction completes successfully (such as deploying a vacant item):
*   Trigger a single consolidated reload call (`loadAllData()`) from the parent View container.
*   Let the context provider broadcast the fresh dataset to all child components, ensuring uniform updates.

---

## 🔒 Enterprise-Grade Security Architecture

### 1. Transport Security & Session Lifecycle
*   **Token Transport**: JWT access tokens must be sent via the `Authorization` header (`Bearer <token>`).
*   **Auto-Expiration Interceptors**: The frontend `apiFetch` client intercepts `401 Unauthorized` and `403 Forbidden` responses. If a session expires, it immediately purges local tokens and redirects to the login screen.

### 2. Query Parameter Binding
*   **SQL Injection Defense**: Raw query strings must never use string interpolation (`${param}`). Use strict parameterized queries (`$1`, `$2`) provided by the `pg` driver:
    ```javascript
    await pool.query('SELECT * FROM vacancies WHERE id = $1', [vacancyId]);
    ```

---

## 🚀 Performance Tuning & Scale Optimizations

### 1. Connection Pool Optimization (`apps/api`)
Tuning node-postgres client pool constraints:
```javascript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                  // Max active clients in pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000 // Raise alert if connection takes > 2s
});
```

### 2. Frontend Code-Splitting (`apps/web`)
Utilize React dynamic imports (`React.lazy` and `Suspense`) to split bundle chunks by view. This prevents loading heavy page resources (e.g., dashboard charts, calendar overlays) on the initial login load:
```javascript
const VacanciesView = React.lazy(() => import('./features/vacancies/VacanciesView'));
const AssessmentView = React.lazy(() => import('./features/assessment/AssessmentView'));
```
