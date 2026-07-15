# Full-Stack Engineering Playbook: Production Systems & Integration Architecture

This playbook defines the systems engineering, integration standards, and operational guidelines for full-stack engineers working on the **AGAP Portal**. It outlines end-to-end integration patterns, state synchronization, data flow, performance optimization, and enterprise security.

---

## 🔄 1. Full-Stack Data Lifecycle & Type Sharing

To maintain synchronization between database schemas, REST payloads, and frontend UI states, the application uses strict data mapping layers:

```
  [Database Schema] ──► [Repository Layer] ──► [Controller Mapper]
                                                     │
                                                     ▼ (REST JSON Payload)
  [Frontend View]   ◄── [Custom State Hook] ◄── [apiFetch Interceptor]
```

### Shared Type Contracts (`packages/shared`)
Establish unified data model definitions in the shared library so both frontend and backend handle data contracts identically:
*   **Mappers**: Keep mapping functions (such as database row mappers like `mapVacancy` or fit evaluators like `computeFit`) in the shared library.
*   **Schemas**: Define validation rules for REST payloads (e.g., checking that a School ID contains exactly 6 digits, or that an item number conforms to the scanned regex format).

---

## ⚡ 2. State Synchronization & Request Coordination

Managing state transitions in multi-step workflows (e.g. Scanning a NOSCA -> Confirming allocations -> School deployment) requires synchronized transactional boundaries across the full stack.

### 1. Optimistic UI Updates vs. Pessimistic Locking
*   **Pessimistic Operations**: Critical limit checks (e.g. validating vacancy allocations against division caps in `/api/nosca/check-limit`) must block the frontend UI (show loaders) and run under database row locks (`SELECT FOR UPDATE` inside transactions) on the backend to prevent concurrent double-allocations.
*   **Optimistic Actions**: Status updates and local checkbox toggling can update the UI instantly, with background rollback handlers if the API call fails.

### 2. Consolidated Refetching Patterns
Avoid scattered API fetching. When a mutative transaction completes successfully (such as deploying a vacant item):
*   Trigger a single consolidated reload call (`loadAllData()`) from the parent View container.
*   Let the context provider broadcast the fresh dataset to all child components, ensuring uniform updates.

---

## 🔒 3. Enterprise-Grade Security Architecture

### 1. Transport Security & Session Lifecycle
*   **Token Transport**: JWT access tokens must be sent via the `Authorization` header (`Bearer <token>`).
*   **Auto-Expiration Interceptors**: The frontend `apiFetch` client intercepts `401 Unauthorized` and `403 Forbidden` responses. If a session expires, it immediately purges local tokens and redirects to the login screen.

### 2. Query Parameter Binding
*   **SQL Injection Defense**: Raw query strings must never use string interpolation (`${param}`). Use strict parameterized queries (`$1`, `$2`) provided by the `pg` driver:
    ```javascript
    await pool.query('SELECT * FROM vacancies WHERE id = $1', [vacancyId]);
    ```

---

## 🚀 4. Performance Tuning & Scale Optimizations

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
