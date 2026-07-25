<aside>
⚡

Execute this prompt verbatim against the STRIDE deployment on the VM behind Nginx (server `stride.deped.gov.ph`) and its frontend/deploy pipeline. The symptom: code works on localhost but the VM serves an **old build** no matter how many times it is redeployed — a stale-artifact / cache-layer problem, not a logic bug. Make ONLY the changes described. Where a line says **STOP AND ASK**, halt on that specific value and request it before implementing that sub-part — implement everything else. Act on the changes only; do not restate this prompt.

</aside>

## 0. OBJECTIVE & NON-NEGOTIABLES

**Scope:** Eliminate stale-build serving on the VM by making every cache layer between edited source and the browser invalidate on deploy. Six fixes (R1–R6): Nginx cache-control for the HTML entrypoint (R1), the service worker (R2), and hashed static assets (R3); remediation of the `/api/asset/` `proxy_cache` staleness (R4); a deterministic rebuild→reload→purge deploy pipeline (R5); and a self-updating service worker (R6, only if a service worker exists).

**Preserve-list (must NOT change unless a task explicitly says so), grounded in the NGINX Config synthesis:**

- The SSL config block: `ssl_certificate /etc/nginx/ssl/fullchain3.pem`, `ssl_certificate_key /etc/nginx/ssl/privatekey3.pem`, `ssl_protocols TLSv1.2 TLSv1.3`, ciphers, and `listen 443 ssl http2 default_server`.
- Every `upstream` pool and its `server 127.0.0.1:<port>` + `keepalive` values (`stride_backend` 3002, `opdash_backend` 3001, `production_backend` 5000, and all sub-app/staging pools).
- The HTTP→HTTPS redirect server on `:80` (`return 301 https://$host$request_uri`).
- `/api/auth/` routing to `stride_backend/api/auth/` with its 60s timeouts.
- The `/api/asset/` `upstream`, `proxy_cache binary_cache`, `proxy_cache_key`, `proxy_cache_lock`, and the `X-Cache-Status` header — ONLY the cache-freshness behavior named in R4 may change; the proxy target and dedup semantics stay.
- The `/api/` global fallback to `production_backend` (no cache) and its `100M` / `600s` limits.
- The hidden-file `deny` block, `/nginx_status` stub, the legacy `location ^~ /uploads/` `410` block, and the `HealthProbe|Azure|LoadBalancer|TrafficManager` health-check shortcut.
- All backend API paths and response shapes. No DB schema changes. No application business logic changes.

**Hard rules:** never guess/invent — use **STOP AND ASK**; ground every change in the real Nginx config, files, ports, and endpoints from the synthesis; reuse existing directives/style verbatim; preserve contracts; keep one source of truth per value (one cache policy per asset class).

**Single allowed exception:** R4 is the ONLY change to the semantics of an existing block (`/api/asset/`), and only its freshness/versioning — not its proxy target, key, or the `unified_binaries` pipeline it fronts.

---

## 1. TARGET CODEBASE MAP

**Confirmed from the NGINX Config synthesis (verbatim):**

- **Server block:** `listen 443 ssl http2 default_server; server_name stride.deped.gov.ph; client_max_body_size 100M;`
- **HTML/JS entrypoint routing:** `location = /` and `location /` both `proxy_pass http://stride_backend/;` → PM2 process serving on `127.0.0.1:3002`. Comment in file: *"Root paths routing to PM2 stride-dashboard (3002)"* → the frontend HTML/JS is served by the **Node/PM2 process `stride-dashboard`**, NOT by Nginx static file serving. Therefore a stale build persists if `stride-dashboard` is not rebuilt AND reloaded.
- **Binary asset cache:** `location ~ ^/api/asset/(.*)$` → `proxy_pass http://production_backend/api/asset/$1;` with `proxy_cache binary_cache; proxy_cache_valid 200 10m; proxy_cache_valid 404 1m; proxy_cache_use_stale error timeout updating; proxy_cache_lock on; proxy_cache_key "$request_uri"; add_header X-Cache-Status $upstream_cache_status;`
- **Upstream:** `upstream stride_backend { server 127.0.0.1:3002; keepalive 128; }`

**Files/targets to edit:**

- The Nginx server-block config file for `stride.deped.gov.ph` (contains the blocks above). **STOP AND ASK:** exact path of this file on the VM (e.g. `/etc/nginx/sites-available/stride`, `/etc/nginx/conf.d/stride.conf`, or `nginx.conf`).
- The frontend build output served by `stride-dashboard`. **STOP AND ASK:** the frontend repo/dir, its build command (e.g. `pnpm build`), and the build output directory (e.g. `dist/`) plus how `stride-dashboard` serves it (static middleware vs. framework).
- The deploy script/pipeline that redeploys the VM. **STOP AND ASK:** its path (e.g. a `deploy.sh`, CI job, or PM2 `ecosystem.config.js`).

**Must NOT modify:** every upstream/port, the SSL block, `/api/auth/`, the `/api/` fallback, the `/api/asset/` proxy target + key + `unified_binaries` dedup/compression pipeline, the `/uploads/` 410 block, and any backend endpoint path or response shape.

---

## 2. VERBATIM REFERENCE MATERIAL

Existing root routing block (edit alongside, do not delete):

```
location / {
    proxy_pass http://stride_backend/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade    $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host       $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Existing binary asset cache block (R4 target — change freshness only):

```
location ~ ^/api/asset/(.*)$ {
    proxy_pass http://production_backend/api/asset/$1;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_cache             binary_cache;
    proxy_cache_valid       200 10m;
    proxy_cache_valid       404 1m;
    proxy_cache_use_stale   error timeout updating;
    proxy_cache_lock        on;
    proxy_cache_methods     GET;
    proxy_cache_key         "$request_uri";
    add_header              X-Cache-Status $upstream_cache_status;
}
```

**STOP AND ASK:** the `proxy_cache_path ... keys_zone=binary_cache:...` directive is not present in the supplied config excerpt. Provide the full `proxy_cache_path` line (cache directory + zone name) so R4-B can target the correct directory for purging.

---

## 3. LAYOUT / INTERACTION CONTRACT

Not applicable — no UI template supplied. Preserve the existing Nginx block ordering (Upstreams → :80 redirect → :443 core → prod → staging) and insert new `location` blocks in the core `:443` server block near the existing root/asset locations.

---

## 4. NUMBERED REVISIONS

### R1 — HTML entrypoint must never be cached

- **Where:** the `stride.deped.gov.ph` `:443` server block, adjacent to the existing `location /` root block (Section 2).
- **Do:** add an exact-match location for the HTML entrypoint that proxies to `stride_backend` and forces no-store, so browsers always re-fetch the document that references the current hashed bundles.

```
location = /index.html {
    proxy_pass http://stride_backend/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header Cache-Control "no-store, no-cache, must-revalidate" always;
    expires -1;
}
```

- **Data bindings:** none (static document served by `stride_backend` on 3002).
- **Preserve:** the existing `location /` and `location = /` blocks and their health-probe shortcut; do not remove them.

### R2 — Service worker must never be cached

- **Where:** same `:443` server block.
- **Do:** if a service worker is served, add a no-store exact-match location for it so clients always pick up a new worker.

```
location = /sw.js {
    proxy_pass http://stride_backend/;
    add_header Cache-Control "no-store" always;
}
```

- **STOP AND ASK:** confirm (a) whether STRIDE registers a service worker at all, and (b) its exact served filename/path (e.g. `sw.js`, `service-worker.js`, or a vite-plugin-pwa name like `registerSW.js` + `workbox-*.js`). Do not create this block for a filename you have not confirmed.
- **Data bindings:** none.
- **Preserve:** all other `location` blocks.

### R3 — Hashed static assets cache long and immutable

- **Where:** same `:443` server block.
- **Do:** add a location that lets content-hashed build assets cache aggressively (safe because each build emits new filenames).

```
location ~* /assets/.*\.(js|css|woff2?|png|svg|jpg|jpeg|gif|ico)$ {
    proxy_pass http://stride_backend;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
}
```

- **STOP AND ASK:** confirm the built asset directory/URL prefix is `/assets/` (Vite default). If the frontend emits to a different prefix, provide it before adding this block.
- **Data bindings:** none.
- **Preserve:** the root `location /` fallback; assets not matching this regex continue to flow through it.

### R4 — Remediate `/api/asset/` `proxy_cache` staleness

- **Where:** the existing `location ~ ^/api/asset/(.*)$` block (Section 2) + deploy pipeline (R5).
- **Problem:** `proxy_cache_valid 200 10m` plus `proxy_cache_use_stale ... updating` can serve an overwritten asset for up to 10 minutes after deploy.
- **Do (pick ONE; A preferred):**
    1. **A — Bust the URL (preferred):** version asset URLs at the call site (`/api/asset/:id?v=<contentHash|buildId>`). Keeps `proxy_cache_key "$request_uri"` intact so a new version is a new key = instant refresh, no purge needed. **STOP AND ASK:** confirm the frontend can append a stable per-asset version (content hash or build id) and where asset URLs are generated.
    2. **B — Purge on deploy:** in the deploy script (R5), remove the `binary_cache` directory contents, then reload Nginx. Requires the `proxy_cache_path` directory (STOP AND ASK in Section 2).
    3. **C — Shorten TTL (debug only):** change `proxy_cache_valid 200 10m;` to `proxy_cache_valid 200 1m;` while diagnosing. Not a permanent fix.
- **Data bindings:** GET `/api/asset/:id` → `production_backend`; the `unified_binaries` store and dedup pipeline are unchanged.
- **Preserve:** `proxy_pass` target, `proxy_cache_key`, `proxy_cache_lock`, `proxy_cache_methods`, and the `X-Cache-Status` header. Only freshness/versioning changes.

### R5 — Deterministic rebuild → reload → purge deploy pipeline

- **Where:** the VM deploy script/pipeline (path per STOP AND ASK in Section 1).
- **Do:** ensure every deploy, in order: (1) installs deps, (2) rebuilds the frontend, (3) **reloads the PM2 process so new code leaves memory**, (4) reloads Nginx (and purges the asset cache if R4-B chosen), then (5) verifies the served bundle hash equals the freshly built one.

```bash
pnpm install
pnpm build                      # STOP AND ASK: confirm build command + output dir
pm2 reload stride-dashboard --update-env
# If R4-B chosen: sudo rm -rf <binary_cache_dir>/*   # STOP AND ASK: dir
sudo nginx -t && sudo nginx -s reload
# Verify server is no longer stale:
curl -s https://stride.deped.gov.ph/ | grep -oE '/assets/[^"]+\.js'
```

- **STOP AND ASK:** confirm the PM2 process name is exactly `stride-dashboard` (implied by the config comment) and the frontend build command + output directory.
- **Data bindings:** none (process/build orchestration only).
- **Preserve:** the PM2 process set, all ports, and the Nginx block structure. A file change without `pm2 reload` is the primary root cause of "redeploy changes nothing" — the reload step is mandatory.

### R6 — Self-updating service worker (only if a service worker exists)

- **Where:** the frontend service-worker registration/lifecycle code.
- **Do:** make a new worker take over immediately instead of waiting: bump the SW/precache version string per build, call `self.skipWaiting()` in `install` and `clients.claim()` in `activate` (or a plugin equivalent), and optionally surface a "new version available" prompt on `controllerchange`.
- **STOP AND ASK:** confirm the service worker toolchain (hand-written `sw.js`, Workbox, or vite-plugin-pwa) before editing — the exact API differs per tool. Skip R6 entirely if R2's STOP AND ASK confirms there is no service worker.
- **Data bindings:** none.
- **Preserve:** all offline/runtime caching routes already configured in the worker except the activation/version behavior named here.

---

## 5. CONFLICT-PREVENTION CHECKLIST

- [ ]  R1: `location = /index.html` returns `Cache-Control: no-store, no-cache, must-revalidate` and still proxies to `stride_backend`; root `location /` untouched.
- [ ]  R2: service worker file (confirmed name) returns `Cache-Control: no-store`; no block added for an unconfirmed filename.
- [ ]  R3: `/assets/*` hashed files return `Cache-Control: public, max-age=31536000, immutable`; prefix confirmed.
- [ ]  R4: exactly one option (A/B/C) applied; `/api/asset/` proxy target, `proxy_cache_key`, and `X-Cache-Status` preserved; `unified_binaries` pipeline untouched.
- [ ]  R5: deploy runs build → `pm2 reload stride-dashboard` → `nginx -t && nginx -s reload` (+ purge if R4-B); post-deploy served bundle hash equals freshly built hash.
- [ ]  R6: applied only if a service worker is confirmed; new worker activates immediately; existing runtime caches preserved.
- [ ]  No upstream, port, SSL directive, `/api/auth/`, `/api/` fallback, `/uploads/` 410, or health-probe block changed.
- [ ]  `nginx -t` passes before every reload; no DB schema or backend contract changed.

## 6. ACCEPTANCE CRITERIA

- After a deploy, `curl -sI https://stride.deped.gov.ph/index.html` shows `Cache-Control: no-store...`, and `curl -s https://stride.deped.gov.ph/ | grep -oE '/assets/[^"]+\.js'` returns the SAME bundle hash present in the freshly built output directory (server no longer stale).
- A hard-reloaded browser (and incognito) shows the new build immediately; a normal reload shows it after the no-store `index.html` re-fetch pulls new hashed bundles.
- `/api/asset/` no longer serves an overwritten binary past the chosen refresh mechanism; `X-Cache-Status` still reports `HIT`/`MISS` and the dedup/compression pipeline is unchanged.
- If a service worker exists, a redeploy causes the client to activate the new worker without a manual unregister.
- All preserved blocks (upstreams, SSL, `/api/auth/`, `/api/` fallback, `/uploads/` 410, health probe) behave exactly as before; `nginx -t` passes.
- Every unresolved required value (config file path, `proxy_cache_path` dir, build command/output dir, PM2 process name, service-worker existence/filename/toolchain) remains a visible **STOP AND ASK**, not a fabricated value.