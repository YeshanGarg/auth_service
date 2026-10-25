# Auth Service Backend

A portfolio-grade authentication and user-management API built with TypeScript, Express 5, PostgreSQL, Prisma 7, Redis, and JWTs. Backend-first: Swagger is the interactive client, not a separate frontend.

**Deployment status:** local verification and [hosted CI](https://github.com/YeshanGarg/auth_service/actions/runs/40186201708) passed. Neon Free is connected and its PostgreSQL-only policy is applied, but cloud migrations and public API deployment are not complete. Do not treat this as a production identity provider.

**Hosting budget: strictly $0.** The [free deployment instructions](docs/deployment.md#zero-budget-deployment) use Render Free for the API/private Key Value and Neon Free for PostgreSQL. The blueprint starts with auth writes disabled for a safe public preview. No paid trial, credit-card billing, custom domain purchase or uptime workaround is required or authorized.

## Quick Start

Requires Docker with Compose v2. Host-native tooling supports Node 22.12+ or 24; Docker and CI use Node 24. The committed lockfile is the dependency source of truth.

1. Clone the repository and create local configuration:

```sh
git clone https://github.com/YeshanGarg/auth_service.git
cd auth_service
cp .env.example .env
openssl rand -hex 32
openssl rand -hex 32
```

2. Put the two different generated values into `POSTGRES_PASSWORD` and `JWT_SECRET` in your local environment file. Never post them in chat or commit them. Empty placeholders intentionally prevent a working shared-secret configuration. Keep `PORT=3000` for this Compose mapping. Existing database volumes retain their original credentials; changing the environment does not change an existing database password.

3. Build images, start dependencies, run migrations separately, then start the API:

```sh
docker compose -p auth-service-learning --profile tools build api migrate
docker compose -p auth-service-learning up -d --wait db redis
docker compose -p auth-service-learning run --rm migrate
docker compose -p auth-service-learning up -d --wait api
curl --fail http://127.0.0.1:18080/health/ready
```

Open [interactive docs](http://127.0.0.1:18080/docs/) or [OpenAPI JSON](http://127.0.0.1:18080/openapi.json). Only the API is published, on localhost port 18080. PostgreSQL and Redis stay on the Compose network. Keep the same project name so commands address the same database volume.

On a corporate network that requires an approved CA, use the optional override on **build commands**:

```sh
docker compose -p auth-service-learning -f docker-compose.yml -f docker-compose.corporate.yml --profile tools build api migrate
```

The override reads `CORPORATE_CA_FILE` or the local ignored CA file. The CA is mounted as a BuildKit secret, not copied into the image. Do not disable TLS verification. Normal builds do not require this file.

Stop with `docker compose -p auth-service-learning down`. Do not add `-v` unless you deliberately want to delete this project's database.

## API

| Method | Path | Access / Contract |
| --- | --- | --- |
| GET | `/health/live` | Dependency-free liveness |
| GET | `/health/ready` | PostgreSQL + Redis check, 200 or 503 |
| POST | `/auth/signup` | Creates USER; returns only id and email |
| POST | `/auth/login` | Access and refresh token pair |
| POST | `/auth/refresh` | One-time refresh rotation |
| POST | `/auth/logout` | Idempotent revocation of presented refresh token, 204 |
| GET | `/me` | Current active user's safe profile |
| GET | `/profile` | Legacy current authorization-context response |
| GET | `/users?limit=10&cursor=123` | ADMIN only; `{ items, nextCursor }` |
| GET | `/admin/dashboard` | Current ADMIN role required |
| GET | `/docs/`, `/openapi.json` | Public, private by header, or disabled |

There is **no admin seed HTTP endpoint**, regardless of demo flags. Follow the [safe demo](docs/demo.md) using a self-created USER account. Private admin behavior is demonstrated by isolated integration fixtures, never shared credentials.

## Security Decisions

- Passwords: bcrypt cost 12, minimum 8 characters and maximum 72 UTF-8 bytes; never serialized.
- Access JWTs: HS256, issuer/audience checks, validated claims, 15-minute expiry. Protected requests check the current active DB account and current role.
- Refresh tokens: 32 random bytes, SHA-256 digest at rest, 7-day sliding expiry. A conditional delete in a transaction gives one winner on simultaneous refresh; replay receives 401, not family-wide revocation.
- Logout revokes only the presented refresh token. Other sessions and issued access tokens remain usable. Logout-all and immediate access-session revocation are not implemented.
- Redis Lua makes counter/expiry changes atomic. Per-IP, per-route limits per minute: signup 3, login 5, refresh 20, logout 5. Store failure returns 503 rather than bypassing limits.
- Safe user projections, transactional auth audit events, structured redacted logs, response request IDs, validation errors, 10 KB JSON limit, Helmet, explicit CORS allowlist, and opt-in trusted proxy networks.

Read the [threat model and limitations](docs/security.md) before hosting writable signup publicly. Per-IP limits are not a complete abuse or account-retention policy.

## Verification

With Node installed and a valid local `DATABASE_URL` for generation:

```sh
npm ci
npm run lint
npm run typecheck
npm run build
npm run test:unit
npm audit --audit-level=high
```

For generation-only commands, `DATABASE_URL=postgresql://unused:unused@localhost:5432/build_only npm ci` is sufficient; that value does not configure a working runtime database. `typecheck` also checks test code, not just application code.

Run the **real-store suite and coverage** in the built tool image against this project's healthy dependencies:

```sh
docker compose -p auth-service-learning run --rm --no-deps --user root \
  -e REDIS_HOST=redis -e JWT_SECRET=integration-test-only-not-for-deployment \
  migrate npm run test:coverage
```

The fixed key above is only for test fixtures, never deployment. Rebuild the `migrate` image after source changes; source is not bind-mounted. Root is used only for the disposable coverage container to write reports; the API and migration command run as `node` by default. Reports from this disposable container are not persisted on the host. CI uploads its report as an artifact.

`npm test` skips store tests unless explicitly enabled. `npm run test:integration` and `npm run test:coverage` enable them and require an already migrated, **isolated test database** and Redis. Tests create unique fixtures and remove only their own records/keys; never point them at production. `npm run check` is build plus tests, not a substitute for lint or store coverage.

CI defines clean installation, lint, app/test typechecking, build, store-independent unit tests, migration deploy, real-store coverage, dependency audit, and both Docker targets. Coverage gates cover controllers, middleware, services and utilities: 75% lines/statements, 70% functions, 65% branches. They do not claim coverage of the process lifecycle or every configuration path.

Local checkpoint (2026-10-26): **68 tests passed**, 93.60% line / 89.74% branch coverage in that scope, and zero reported npm audit vulnerabilities. Both images built; local migrations, legacy-token migration compatibility, runtime readiness and clean SIGTERM restart were previously verified. The free Render blueprint passed the published schema check; Redis URL routing, the read-only preview guard and Neon launcher configuration guards are tested. Store integration tests use isolated local PostgreSQL/Redis, not Neon. Hosted CI separately passed for commit `07ec97d`; no public-deployment claim is made.

## Configuration And Operations

Use the tracked example for variable descriptions. Runtime startup rejects missing DB configuration, short JWT secrets, invalid ports and incomplete private-doc settings. `TRUST_PROXY` is empty by default: do not trust arbitrary forwarded IP headers. Configure only hosting-provided proxy IPs/CIDRs after verifying the topology.

For host-native development, supply real PostgreSQL/Redis connection settings (`REDIS_HOST=127.0.0.1`); the default Compose stack deliberately does not publish those ports. `npm run build && npm start` serves the compiled application. Run `npm run prisma:migrate:deploy` as a controlled release step, not on every API process startup.

For the linked Neon database, follow the [isolated environment workflow](docs/deployment.md#2-apply-migrations-locally). `npm run prisma:migrate:neon` uses the saved direct migration-owner URL; `npm run start:neon` uses the pulled runtime URL. Both enforce certificate verification without rewriting environment files. Append `-- --check` to validate configuration without connecting. A valid JWT secret and reachable Redis are still required to run the API; the local Compose stores are private.

- [Architecture and implementation walkthrough](docs/architecture.md)
- [Security policy and remaining tradeoffs](docs/security.md)
- [Reviewer demo](docs/demo.md)
- [Deployment and incident runbook](docs/deployment.md)
- [Upgrade plan and implementation status](AUTH_SERVICE_PORTFOLIO_UPGRADE_PLAN.md)

The Redis dump is intentionally untracked and ignored. Removing a file from current tracking does not erase Git history; historical data still needs an owner review before publication. Commented legacy implementations remain for learning comparison and are not enabled features.