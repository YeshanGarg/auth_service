# Auth Service — Portfolio-Ready Upgrade Plan

**Repository:** https://github.com/YeshanGarg/auth_service  
**Prepared:** 2026-10-23  
**Status:** Local implementation and automated verification complete (2026-10-26), with deployment-specific gates still open. The original audit below is historical, not a statement of current defects. Hosted CI is verified; public deployment remains pending.

### Implementation Checkpoint

- Implemented: supported Node/container layout; optional build CA secret; separate migrations; private store ports and health checks; removal of public seeding; safe DTOs; current-account authorization; hashed one-time refresh rotation and logout; atomic Redis limits; validation/error mapping; stable paginated responses; liveness/readiness; startup validation and graceful shutdown.
- Implemented: unit and real-store HTTP/session/Redis coverage; lint and test typechecking; dependency updates with a clean local audit; CI service/coverage/audit/image gates; accurate relative OpenAPI; safe environment template; architecture, security, demo and release docs.
- Local verification checkpoint: **68 tests passed**, including real PostgreSQL/Redis HTTP/session/concurrency/pagination coverage, managed Redis URL / read-only preview cases and six Neon launcher configuration cases; **93.60% lines, 89.74% branches** across the configured business-code scope; zero reported npm audit vulnerabilities; lint and strict app/test typechecking passed. Both images build; six migrations are applied locally; a temporary-table regression verified legacy token preservation; runtime imports/non-root/secret exclusions, readiness and clean SIGTERM restart were previously verified. Swagger was opened and visually checked. The free Render blueprint passed the provider's published schema check. Re-run before release; these figures are dated evidence, not a permanent claim.
- Hosted CI verified: [successful run for commit 07ec97d](https://github.com/YeshanGarg/auth_service/actions/runs/40186201708). Neon Free project `auth-service-demo` is authenticated in Singapore, production policy deploy is a no-op, and only PostgreSQL is declared. Generated cloud env values are isolated in ignored `.env.neon`; supplied `.env` and `.env.deploy` were preserved.
- Budget locked to $0: selected Render Free API/private Key Value plus Neon Free PostgreSQL, with auth writes disabled for first public preview. No paid trial, card-backed overage, keep-alive bot or automatic upgrade. User authorized commit/push. Neon service-side access succeeds, but local/Docker PostgreSQL SSL handshakes time out, the cloud database has no application tables, and no cloud migrations were applied. Render account sign-in is still pending.
- Remaining external gates: PostgreSQL protocol reachability from an approved network, cloud migrations and synthetic end-to-end auth; restricted runtime DB role; Render Free creation/deployment and public smoke evidence/screenshots; strong persistent secret configuration; historical dump/secret review; deployment-specific proxy/abuse controls before enabling writes.
- Intentionally deferred: full frontend, OAuth/MFA/reset flows, logout-all, family-wide replay revocation and session UI. These were optional, not silently implemented.

## 1. Executive decision

**Keep Auth Service as a backend-first portfolio project. Do not build a large UI just to make it look like a product.**

The existing repository has Express routes, Swagger/OpenAPI documentation, PostgreSQL/Prisma models, Redis rate limiting, JWT authentication, and some tests. It does **not** contain a frontend application. A polished Swagger demonstration plus a *small optional* demo console is sufficient if the API is secure, deployed, reproducible, and well tested.

**Portfolio positioning:** “Secure Authentication & User Management API — TypeScript, Express, PostgreSQL, Prisma, Redis, JWT, RBAC, automated tests, and containerized deployment.”

The existing README describes the project as “production-grade.” Until the security, lifecycle, and operational issues below are resolved, describe it as **production-inspired** or **portfolio-grade**, not production-ready.

### Definition of done

A reviewer should be able to:
1. Open a live landing page or `/docs` without installing anything.
2. See a documented API and architecture diagram.
3. Run a safe signup → login → authenticated profile → refresh → logout demonstration.
4. See that a normal user cannot access admin resources.
5. Read automated tests that prove token rotation, replay rejection, authorization, validation, and rate limiting.
6. Clone the repo and start it using documented commands and sample environment configuration.
7. See green CI and a deployment status/health endpoint.
8. Understand which security and scaling tradeoffs remain.

---

## 2. Evidence-based current-state audit

The following observations were made by inspecting files on the default branch via the connected GitHub repository. They are **source findings, not runtime verification**.

| Area | Existing implementation | Finding / required action | Priority |
|---|---|---|---|
| Frontend | No frontend directory/app in inspected structure; Swagger at `/docs` | A full frontend is optional. Prioritize reliable API demo. | P2 |
| Runtime | `Dockerfile` and CI use Node 20; Prisma 7 dependencies | Move to a supported modern LTS version (Node 24 recommended), pin compatible dependency versions and test. | P0 |
| Docker | Unconditional `COPY zscaler-root-ca.pem` | Build fails if corporate certificate is absent. Remove company-specific trust material from public image. | P0 |
| Docker database | Dockerfile embeds a placeholder `DATABASE_URL` | Remove embedded database credentials; inject configuration at runtime. | P0 |
| Compose | Postgres credentials hardcoded, `depends_on` without readiness checks | Use environment variables, DB health check, startup ordering, and persistent volume. | P1 |
| Prisma | Prisma 7 schema/config and generated client output | Verify `prisma generate`, migrations, build output, and runtime module paths in a clean container. | P0 |
| Migrations | Migration files exist, no clear deployment migration step | Run `prisma migrate deploy` as a controlled release step; avoid `migrate dev` in production. | P0 |
| Demo admin | `POST /auth/demo/seed-admin` enabled with `DEMO_MODE=true`; default known password; response includes credentials | **Critical for public hosting.** Remove public admin seeding; provision demo users only through controlled private setup. | P0 |
| User listing | `getUsers()` calls Prisma `findMany()` without `select` | **Likely leaks password hashes and other private fields** to admin API clients. Use explicit safe DTO projections. | P0 |
| Authorization | JWT role claim trusted for RBAC; no DB recheck | Deleted users or demoted admins may retain access until token expiry. Decide and implement revocation/role-change semantics. | P0 |
| Refresh tokens | Opaque UUID stored in plaintext; rotated transactionally | Hash refresh tokens at rest; implement logout/revoke; test replay and concurrent refresh. | P1 |
| Rate limiting | Redis `INCR` followed by `EXPIRE` in two calls | Make increment/TTL atomic; test Redis failure policy and trusted proxy IP handling. | P1 |
| Validation | Zod used in controllers; error handler doesn't explicitly format `ZodError` | Invalid input can surface as HTTP 500 rather than 400; add validation error mapping. | P0 |
| Pagination | `take: limit + 1`, ordered by `createdAt` only | No `nextCursor` response, nonunique sort key, and potentially `limit + 1` records exposed; use stable `(createdAt,id)` ordering and next-page contract. | P1 |
| Tests | `tests/app.test.ts`, `tests/demo-seed.test.ts` | Current tests focus on smoke/unauthorized routes and demo seeding; add real DB/Redis-backed auth integration coverage. | P0 |
| CI | Install, build, test on Node 20 | Use supported Node, add typecheck, lint, test coverage, and integration services; verify Docker build. | P1 |
| OpenAPI | Hardcoded `http://localhost:3000` | Make server URL deployment-aware or relative; align documented responses with implementation. | P1 |
| Observability | Request context, logs, audit events | Avoid sensitive fields in logs; add request IDs to responses and documented error schema. | P1 |
| Deployment | No verified live API deployment | Select a host after runtime tests and free-tier/terms checks. | P0 |

### Particularly important source-level observations

- `src/services/user.service.ts` returns full `User` rows. The Prisma `User` model includes `password`. Unless an unseen response filter intervenes, the `GET /users` controller serializes password hashes. Treat this as a **security defect** and add a regression test.
- `src/controllers/auth.controller.ts` checks `DEMO_MODE` or `ENABLE_DEMO_ROUTES` but does not require authentication to seed an admin. `src/services/auth.service.ts` uses fallback credentials. The checked-in `.env.example` sets `DEMO_MODE=true`. **Never deploy this configuration publicly.**
- `src/middlewares/auth.middleware.ts` validates the JWT signature and attaches claims, but doesn't check whether the account is deleted or whether the current role has changed.
- `src/middlewares/rateLimit.middleware.ts` uses separate Redis calls. A crash between `INCR` and `EXPIRE` may leave a key without expiration.
- `src/middlewares/error.middleware.ts` handles Prisma unique conflicts and custom `AppError` but has no explicit Zod validation-error branch.
- `src/utils/pagination.ts` requests `limit + 1` rows; `src/controllers/user.controller.ts` returns the array directly rather than trimming it and emitting a cursor.
- `src/docs/openapi.ts` hardcodes a localhost server and still documents the unsafe demo-seed endpoint.

---

## 3. Recommended product scope

### Must-have API (v1 portfolio milestone)

| Feature | Proposed endpoints | Acceptance criteria |
|---|---|---|
| Health | `GET /health/live`, `GET /health/ready` | Liveness works without DB; readiness reflects required dependencies without exposing secrets. |
| Signup | `POST /auth/signup` | Validated inputs, unique email handling, hashed password, safe response. |
| Login | `POST /auth/login` | Generic invalid-credentials response; access + refresh tokens; audit event. |
| Refresh | `POST /auth/refresh` | One-time token rotation; old token cannot be reused; concurrent use handled deterministically. |
| Logout | `POST /auth/logout` | Revokes the presented refresh token/session; repeat requests have defined behavior. |
| Logout all | `POST /auth/logout-all` | Revokes all sessions for authenticated user. Optional if time-constrained. |
| Profile | `GET /me` (can retain `/profile` alias) | Fetches current safe user DTO; deleted users denied. |
| User list | `GET /users?limit=&cursor=` | Admin-only; no password hashes; stable pagination and `nextCursor`. |
| Admin test | `GET /admin/dashboard` | USER → 403; ADMIN → 200; deleted/demoted account denied according to chosen policy. |
| Docs | `GET /docs`, `GET /openapi.json` | Accurate requests, responses, auth, errors, rate limits, and live server URL. |

**Do not add OAuth, social login, email verification, password reset, MFA, multi-tenancy, or a complex RBAC permission engine to the first milestone.** Those are legitimate future extensions, but unnecessary to show competence now.

### Session/security design decisions to document

1. **Refresh token storage:** Generate cryptographically random opaque tokens; store only a SHA-256 digest or another appropriate keyed representation in PostgreSQL; compare via indexed digest lookup. Never log raw tokens.
2. **Rotation/replay:** On refresh, atomically consume the old token and issue a new one. Decide whether reuse revokes the entire token family or simply returns 401; test the decision. A transaction alone does not prove concurrency safety—test two simultaneous refresh requests.
3. **Access tokens:** Short expiry (e.g. 15 minutes). Validate issuer, audience, allowed algorithm, expiry, and expected payload shape. Document whether role changes take effect immediately or at token expiry; for immediate revocation, check DB/session state or a version claim.
4. **Password security:** bcrypt cost calibrated for environment, reasonable length bounds, never echo password/hash; avoid user enumeration through login errors.
5. **Rate limiting:** Separate policies for signup, login, refresh, and demo. Use Redis atomic operations and define behavior when Redis is unavailable.
6. **Logging/audit:** Store event type, actor, request ID, timestamp, and limited metadata; redact tokens, passwords, and sensitive user data.
7. **HTTP security:** Tight CORS allowlist, HTTPS, safe proxy configuration, body-size limits, Helmet, no unnecessary cookies. If later using cookies, add CSRF protection and appropriate `SameSite`, `Secure`, and `HttpOnly` settings.
8. **Database access:** Principle-of-least-privilege DB account and schema migrations run separately from app serving.

---

## 4. Demo UX: no full UI required

### Recommended first version: Swagger-first

A backend engineering portfolio does not need a full dashboard. Provide:
- A polished README with a **Live API Docs** link and 2–3 screenshots.
- Accurate Swagger UI with grouped operations, examples, bearer authorization, and response schemas.
- A clear “Try it” flow using **self-signup as USER**, login, profile, refresh, and logout.
- An admin-only example documented as a test, not a publicly accessible known-password admin account.
- A public landing page (even simple HTML) that explains the service and links to docs/source/architecture.
- A small architecture diagram and a sequence diagram for refresh-token rotation.

### Optional second version: minimal demo console

Only after backend is stable, build a small Next.js/React UI with:
1. Signup/login panel.
2. Current user and role view.
3. Refresh and logout controls.
4. Session state and audit-event timeline (show only the logged-in user's safe events).
5. Admin access demonstration with a **restricted, safe sandbox**.

Keep this UI to 3–5 screens. No complex styling or dashboard charts are necessary. **Do not persist refresh tokens in `localStorage` in a production-like demo.** Prefer a secure cookie-based design if implementing a browser client, or explicitly label a developer-only token console as non-production.

### Safe public demo strategy

**Recommended:** Let visitors create limited USER accounts in an isolated demo database, with per-IP/account quotas, cleanup, no email delivery, no admin seeding, and no real user data. Alternatively, provide a read-only recorded demo plus live health/docs if free hosting cannot safely support writable anonymous traffic.

If demonstrating ADMIN access is important, use a privately provisioned account that is not publicly shared, or a **separate synthetic, read-only sandbox** with no privilege to mutate actual user records. Never ship known reusable admin credentials.

---

## 5. Architecture and code changes

Target structure (adapt existing files rather than rewriting everything):

```text
src/
  app.ts
  index.ts
  config/
    env.ts                 # validated environment configuration
    prisma.ts
    redis.ts
  routes/
    auth.routes.ts
    user.routes.ts
    health.routes.ts
  controllers/
    auth.controller.ts
    user.controller.ts
  services/
    auth.service.ts
    session.service.ts
    user.service.ts
    audit.service.ts
  repositories/            # optional; add only if it improves testing
  middlewares/
    auth.middleware.ts
    role.middleware.ts
    rateLimit.middleware.ts
    requestContext.middleware.ts
    error.middleware.ts
  utils/
    token.ts
    validators.ts
    pagination.ts
    logger.ts
  docs/
    openapi.ts
tests/
  unit/
  integration/
  fixtures/
prisma/
  schema.prisma
  migrations/
.github/workflows/ci.yml
Dockerfile
docker-compose.yml
.env.example
README.md
docs/
  architecture.md
  security.md
  demo.md
```

**Do not introduce unnecessary abstractions.** Controllers/services are already present; only add a repository layer if testing and separation genuinely benefit.

### Specific file-level change list

| File | Required work |
|---|---|
| `Dockerfile` | Supported Node base; multistage build; no Zscaler `COPY`; no embedded DB URL; use `npm ci`; generate Prisma; install only runtime dependencies in final image; run as non-root; expose health endpoint. Verify Prisma generated-client runtime files are copied. |
| `docker-compose.yml` | Parameterize credentials; health checks; persistent DB volume; `REDIS_HOST=redis`; `DATABASE_URL` targets `db`, not localhost; explicit migration step. |
| `.env.example` | Safe placeholders, no working shared credentials, `DEMO_MODE=false`, documented production settings. |
| `.dockerignore` / `.gitignore` | Exclude secrets, generated artifacts, local dumps, company CA files; remove tracked `dump.rdb` from repo if unnecessary and assess whether it contains sensitive data. |
| `package.json` | Pin supported Node engine, scripts for typecheck/lint/test/integration/migrate, avoid redundant Prisma generation and mismatched Prisma packages. |
| `.github/workflows/ci.yml` | Supported Node; install, generate, build, lint, unit tests, integration tests with PostgreSQL/Redis, Docker build. |
| `prisma/schema.prisma` | Store refresh-token digest instead of plaintext token; optionally add `revokedAt`, `familyId`, `lastUsedAt`, and session metadata if needed by chosen semantics; index appropriately. |
| `prisma.config.ts` | Keep Prisma 7 configuration, validate `DATABASE_URL`, ensure build and migration commands work in CI and deployment. |
| `src/config/prisma.ts` | Validate connection string; lifecycle disconnect on graceful shutdown; verify generated client path. |
| `src/config/redis.ts` | Bounded reconnect behavior, error handling, and health visibility; avoid unhandled startup connection noise. |
| `src/services/auth.service.ts` | Remove unsafe public admin seed path; transactional signup + audit (or explicitly handle audit failure); hash refresh tokens; implement logout; safe error handling; test concurrent refresh. |
| `src/routes/auth.routes.ts` | Remove public demo admin endpoint; add logout route; rate-limit refresh as appropriate. |
| `src/controllers/auth.controller.ts` | Return consistent safe DTOs; never return seeded admin password; validation errors become 400. |
| `src/middlewares/auth.middleware.ts` | Validate JWT claims and account status; define role-change invalidation behavior. |
| `src/middlewares/role.middleware.ts` | Enforce role based on validated current authorization context. |
| `src/middlewares/rateLimit.middleware.ts` | Atomic Redis TTL logic, predictable 429 response, trusted proxy configuration. |
| `src/middlewares/error.middleware.ts` | Explicit ZodError → 400, Prisma conflicts → 409, unexpected → sanitized 500; log request ID. |
| `src/services/user.service.ts` | Explicit Prisma `select` excluding password and tokens; stable cursor pagination and safe response. |
| `src/controllers/user.controller.ts` | Emit `{ items, nextCursor }`; document behavior. |
| `src/utils/pagination.ts` | Stable ordering; avoid leaking the extra fetched record. |
| `src/docs/openapi.ts` | Relative/live server URLs, remove demo seed docs, document logout, safe schemas, error cases, rate limits. |
| `src/app.ts` | Health routes, environment-driven docs/CORS, safe demo configuration, request ID header. |
| `src/index.ts` | Graceful shutdown: stop HTTP server, disconnect Prisma/Redis, handle signals. |
| `README.md` | Honest capability matrix, verified setup steps, live demo link, screenshots, architecture, threat model, limitations. |

---

## 6. Testing plan: make quality visible

### Unit tests
- Signup/login/refresh validation.
- Token generation/verification including malformed and expired claims.
- Pagination cursor encoding/decoding.
- Role authorization and status mapping.
- Redis rate limiter boundary conditions and failure handling.
- Audit event payload redaction.

### Integration tests (real isolated PostgreSQL + Redis)
1. Signup succeeds; duplicate email → 409.
2. Password stored as hash; never returned by any API.
3. Wrong password → 401 without disclosing whether email exists.
4. Login creates a valid access token and stored **hashed** refresh token.
5. Refresh rotates token; old token reuse → 401.
6. Concurrent refresh requests cannot both successfully reuse the same token.
7. Logout invalidates refresh token; logout-all revokes all sessions if implemented.
8. USER cannot access `/users` or `/admin/dashboard`.
9. ADMIN can access permitted resources; user list contains **no password or refresh-token fields**.
10. Soft-deleted users cannot authenticate/refresh; current access token behavior follows documented policy.
11. Role downgrade takes effect according to documented policy.
12. Invalid Zod request → 400; internal exception → sanitized 500.
13. Rate-limit boundary → 429 and recovery after TTL.
14. Pagination yields no duplicates/missing records with identical timestamps.
15. Audit events are written and contain no secrets.
16. `/health/ready` responds correctly to unavailable dependencies.

### CI acceptance gates
- `npm ci` passes on a clean supported Node runtime.
- `prisma generate` and `tsc` pass.
- Unit tests pass without needing a live database.
- Integration tests pass using ephemeral Postgres/Redis services.
- Docker image builds without any company certificate.
- No tracked secrets or known credentials.
- Dependency audit is reviewed; no unresolved critical/high exploitable findings.
- Deploy smoke test passes.

**Note:** Existing tests use Vitest/Supertest but do not establish full auth-flow correctness. Do not call them comprehensive integration tests until the above cases run against actual isolated stores.

---

## 7. Deployment plan: zero upfront cost, not unlimited free usage

### Deployment requirements
- Public HTTPS endpoint.
- PostgreSQL persistent storage (or explicitly ephemeral disposable demo data).
- Redis reachable by API, or a deliberately implemented fallback with documented limitations.
- Persistent secrets stored in host environment settings, never Git.
- Database migrations executed exactly once per release.
- Configured health checks, basic request logs, resource limits, and demo abuse controls.
- CORS configured for actual frontend/portfolio origin.
- Deployment automatically updated only after green CI.

### Hosting selection
**Do not commit to a provider yet.** Free-tier quotas, sleeping, database availability, commercial-use restrictions, and outbound networking change. Evaluate current terms for:
- Static/Next.js frontend hosting (existing Vercel site may remain).
- Node backend service hosting.
- Free managed PostgreSQL.
- Free Redis/KV service, if needed.
- Alternatives: a static recorded walkthrough plus local Docker Compose if no safe zero-cost persistent deployment is available.

Do not use your personal Mac as an always-on public server, expose company-network resources, or embed API/database credentials in client-side code.

### Deployment runbook
1. Complete P0 security fixes.
2. Run tests and Docker build locally.
3. Select a provider and document resource constraints.
4. Provision isolated database and Redis; use unique secrets.
5. Apply migrations with `prisma migrate deploy`.
6. Deploy API and verify `/health/live`, `/health/ready`, `/docs`.
7. Execute the safe reviewer flow and capture screenshots.
8. Confirm no publicly callable admin seed route.
9. Test redeployment and data persistence.
10. Add deployment link and verified status to README and portfolio.

---

## 8. Phased implementation roadmap

### Phase 0 — Baseline and reproducibility (1–2 focused sessions)
- Create `portfolio-hardening` branch.
- Document existing API contract and current tests.
- Upgrade Node in Docker/CI and confirm Prisma version compatibility.
- Remove Zscaler dependency and placeholder `DATABASE_URL`.
- Fix Docker Compose configuration and migration workflow.
- Capture baseline build/test results.

**Exit:** Clean clone builds, tests run, containers start, migrations apply.

### Phase 1 — Security blockers (2–4 sessions)
- Disable/remove public admin seeding and known credentials.
- Fix `/users` sensitive-field exposure.
- Fix Zod error mapping.
- Define and enforce deleted-user/role-change authorization policy.
- Implement hashed refresh tokens and safe logout.
- Add regression tests for all of these.

**Exit:** No obvious critical auth/demo exposures; tests prove intended behavior.

### Phase 2 — API correctness and reliability (2–3 sessions)
- Atomic rate limiting and Redis failure policy.
- Stable pagination with `nextCursor`.
- Graceful shutdown, readiness, request ID in errors.
- Consistent error schema and OpenAPI update.
- End-to-end auth/role/rate-limit integration suite.

**Exit:** CI reliably proves core use cases; API contract is accurate.

### Phase 3 — Portfolio demo and deployment (2–3 sessions)
- Deploy backend + data stores within verified free-tier limits.
- Publish safe Swagger demo and guided walkthrough.
- Add architecture/sequence diagrams, screenshots, README, limitations.
- Link from portfolio and GitHub pinned repos.

**Exit:** Stranger can verify the project in under five minutes.

### Phase 4 — Optional polish, only if justified
- Minimal UI demo console.
- Session listing/revocation.
- Password reset or email verification.
- OpenTelemetry/metrics.
- More sophisticated permissions or audit exploration.

**Exit:** Optional; do not delay client outreach waiting for this phase.

---

## 9. Suggested implementation PR sequence

Prefer small reviewable pull requests:

1. **PR-01 — Reproducible build:** Node/Prisma alignment, Docker cleanup, Compose, migrations, CI runtime.
2. **PR-02 — Security hotfix:** remove public admin seed, redact `/users` output, Zod error mapping, tests.
3. **PR-03 — Session lifecycle:** hashed refresh tokens, logout, replay/concurrency tests.
4. **PR-04 — Authorization correctness:** deleted user, role changes, JWT validation, tests.
5. **PR-05 — Reliability:** atomic rate limit, pagination, health, graceful shutdown.
6. **PR-06 — Documentation and deployment:** OpenAPI, README, architecture, hosting, smoke tests.
7. **PR-07 — Optional tiny UI:** only after working API is live.

Keep main protected by PR review and passing checks if repository settings allow.

---

## 10. Portfolio presentation deliverables

### README structure
1. Clear one-line problem statement.
2. Live demo and API docs links.
3. Feature matrix marked **implemented/tested**.
4. Architecture diagram.
5. Security and session lifecycle decisions.
6. Quick-start with Docker Compose.
7. Example requests/responses (no real secrets).
8. Test commands and CI badge.
9. Deployment notes and known limitations.
10. Engineering lessons and tradeoffs.

### Case-study narrative
**Problem:** Authentication is more than hashing passwords and issuing JWTs; secure session lifecycle, revocation, abuse protection, and operational correctness are required.

**Solution:** A modular TypeScript API with PostgreSQL-backed identity/session records, Redis-backed throttling, explicit authorization, structured audit events, and verified test coverage.

**Engineering highlights:** Refresh rotation and replay handling; authorization correctness after account changes; isolated integration tests; containerized deployment; safe public demo design.

**Do not claim:** “production-grade,” “zero vulnerabilities,” “highly scalable,” or “enterprise-ready” without evidence.

### Portfolio card (after completion)
**Authentication & User Management API**  
TypeScript · Express · Prisma · PostgreSQL · Redis · Docker  
A documented, tested authentication service featuring short-lived JWTs, rotating refresh sessions, role-based access control, rate limiting, and audit events. Includes an interactive API demo and reproducible local setup.

Links: **Live API Docs** · **GitHub** · **Architecture / Case Study**

---

## 11. Verification gaps and constraints

This audit inspected repository source through GitHub. It **did not**:
- Clone or execute the repository locally.
- Run npm installation, Prisma generation, migrations, tests, or Docker.
- Inspect live database contents or Redis state.
- Validate an actual deployed Auth Service endpoint.
- Complete a full dependency/security audit.
- Verify current hosting provider free-tier terms.

The source-level issues are sufficiently concrete to prioritize, but final fixes must be tested before claiming the project is ready.

### Immediate next action

**Start with PR-01 and PR-02.** In particular, fix the admin-seed route and sensitive user-list response **before** publishing any public backend URL. Then run a clean Docker-based integration test, and only then decide whether a UI is worth the effort.
