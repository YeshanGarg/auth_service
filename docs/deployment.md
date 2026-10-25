# Deployment And Operations Runbook

## Status And Release Boundary

Local Docker builds, migrations and real-store tests are verified. No cloud resources, live URL or hosted CI result have been verified. Do not infer those from local test success. No paid resources should be provisioned without the owner's approval.

**Budget constraint: $0, with no paid trials, card-backed overages or automatic upgrades.** If an account flow requires a payment card, stop rather than continue. Existing paid workspaces must not be used for this setup.

## Zero-Budget Deployment

Selected setup: Render Free Docker web service + Render Free private Key Value (Valkey, Redis-compatible), with Neon Free PostgreSQL. The root blueprint explicitly sets both Render services to `plan: free`, disables previews and automatic deploys, and creates no Render Postgres, disk, cron job or paid migration service. Use a workspace with no billing method and enough remaining free capacity; Render allows only one free Key Value instance per workspace.

The initial public preview sets `DEMO_READ_ONLY=true`: signup, login, refresh and logout return 403 before reaching stores. Docs, liveness and on-demand readiness remain available. Full interactive flows remain locally tested. This is deliberate until hosting proxy trust, storage quotas and cleanup are addressed; do not disable it merely to make Swagger requests succeed.

### 1. Create The Free Database

Sign in at [Neon](https://console.neon.tech/) yourself. Create a separate project on the **Free** plan, ideally in an AWS region near Singapore. Keep scale-to-zero enabled and use minimum compute. Do not enable paid features, attach a card, upgrade to Launch/Scale, or use a paid organization. Free compute/transfer exhaustion suspends service instead of charging; storage caps reject writes. Current official [Free plan limits](https://neon.com/docs/introduction/plans) are not a promise of unlimited uptime.

Keep the connection strings private. For migration, obtain the **direct/non-pooled** owner's connection string. For serving, provision a separate restricted role after migrations and obtain its **pooled** connection string. Keep the provider's TLS settings and use certificate verification (`sslmode=verify-full`); never add `rejectUnauthorized=false` or disable TLS.

### 2. Apply Migrations Locally

Render Free has no shell/one-off job or paid pre-deploy dependency in this setup. Use the already built migration image locally with an ignored **new** environment file containing only `DATABASE_URL` set to the direct migration-owner connection string. Name it `.env.deploy`, keep it out of source control, and enter the value directly in your editor, not in chat or shell history.

```sh
docker run --rm --env-file .env.deploy auth-service:migrations
```

Build the image first using the README's corporate override if required. Do not point this command at the local Compose URL or a real customer database. Check that all migrations succeed before proceeding. Do not run the integration suite against this deployed database. Configure/grant a restricted runtime role using Neon's private SQL editor; it needs schema usage, DML on application tables, and sequence access, not schema ownership or role/database creation privileges.

### 3. Publish And Create The Blueprint

Commit/push the reviewed changes and get a passing GitHub Actions run first. In [Render](https://dashboard.render.com/), use **New > Blueprint**, connect this repository and branch, and select the root blueprint. It creates the API and private Key Value in Singapore. Review the cost summary: both resources must be Free/$0 and there must be no payment method or paid add-on. Stop if the dashboard shows a charge or asks for a card.

When prompted, enter the pooled restricted-role Neon connection string directly into Render's `DATABASE_URL` field. The blueprint generates a strong JWT key privately and wires the Key Value internal URL automatically. Do not copy those values into chat. The Key Value's external allowlist is empty; keep it that way. No external Redis port or public Redis credentials are necessary.

The blueprint uses `/health/live` for frequent hosting probes, avoiding a database query on every probe. This conserves Neon's free compute allowance but means a green hosting status alone is **not** proof that stores/migrations work. Explicitly check `/health/ready` after deploy and when diagnosing a failure; do not set a frequent external monitor on it. Keep Render's idle sleep and Neon's scale-to-zero; no keep-alive bots.

`TRUST_PROXY` remains empty and auth writes stay disabled until ingress trust is verified. The same-origin Swagger client needs no cross-origin allowlist; the blueprint's non-routable placeholder deliberately grants no external browser origin. Render supplies its free HTTPS hostname and port.

### 4. Verify The Public Preview

Open the assigned HTTPS URL: `/docs/`, `/openapi.json`, `/health/live` and `/health/ready`. Verify readiness explicitly returns 200, auth writes return the documented read-only 403, and the removed admin seed still returns 404. Record the actual URL only after verification. Initial requests may take about a minute to wake Render; Neon can add another cold start and an initial dependency request can fail within this app's bounded timeout. Retry manually, not with a background keep-alive loop.

Free Key Value is memory-only, 25 MB with 50 connections. Restart resets rate counters, not users/sessions. `noeviction` avoids silently dropping counters under memory pressure; Redis write failure remains fail-closed. This is an explicit free-demo reliability limitation, not production-grade persistence. Neon free storage/compute/transfer quotas and Render shared free-instance/build/bandwidth quotas still apply. If limits are hit, accept downtime; never upgrade automatically.

Keep the interactive local demonstration available alongside this public preview. Publishing a writable anonymous demo is a separate release gate, not enabled by this blueprint.

Choose a container host with a persistent PostgreSQL database, private Redis and an explicit migration/release job. A host offering only a short-lived free database is not a durable demo. Review **current** official pricing and terms immediately before selecting one: sleeping/wakeup behavior, database expiry, backups, Redis network/TLS requirements, egress, quotas and spend controls. This document deliberately makes no unverified free-tier promise.

### Provider Research Checkpoint: 2026-10-25

- [Render free-service terms](https://render.com/docs/free): web services sleep after 15 idle minutes and can take about a minute to wake. Free Postgres is limited to 1 GB, expires after 30 days, and has no backups. Free Key Value is memory-only and loses counters on restart. Free web services cannot run one-off jobs. Included bandwidth/build limits and payment-method rules apply. This is a temporary preview, not a durable zero-cost database recommendation.
- [Railway pricing plans](https://docs.railway.com/reference/pricing/plans): the free plan includes $1 monthly credit; the initial trial grant is separate. Hobby starts at $5/month including $5 usage, but resource usage beyond that is additional. That is not a $5 maximum for this three-service stack. Check actual measured use and enforce an approved spend policy before provisioning.

These are dated readings of official documentation, not reserved capacity, an availability guarantee or an approved purchase. Railway paid plans are excluded by the $0 constraint. The selected free setup above avoids Render's expiring Postgres; no resources have yet been provisioned. Provider account eligibility and end-to-end connectivity still require actual verification.

## Release Checklist

1. Select the provider/region and approve a spending limit. Supply credentials through that provider's secret manager, not source control or chat.
2. Use a separate demo database with no real users. Decide whether to allow writable public signup; until cleanup/account quotas exist, restrict write access at the edge or run a read-only recorded demo.
3. Provision private stores, backup/restore policy and TLS as required. Use separate schema-owner migration credentials and least-privilege runtime DB credentials. Use a trusted private Redis endpoint unless its required TLS/ACL configuration is explicitly implemented and tested.
4. Generate a unique 32+ character JWT key. Set production `DATABASE_URL`, `JWT_SECRET`, Redis host/port, `NODE_ENV=production`, hosting `PORT`, CORS allowlist and docs visibility. Set trusted proxy networks from verified provider documentation, not `true` or arbitrary hop counts.
5. Run CI and review the dependency audit. Scan the image's Debian packages as well. Build and tag both `runtime` and `migrations` stages with the same immutable release identifier. Neither image needs runtime corporate CA material; approved CA secrets are optional build inputs only.
6. Run the migration image once as a controlled release job using migration-owner credentials. Never run `migrate dev` in production and never reset a production database.
7. Deploy the runtime image with its restricted DB role. Configure HTTPS, readiness `/health/ready`, liveness `/health/live`, a termination grace period longer than 10 seconds and appropriate resource limits. The app listens on the platform-supplied port.
8. Verify the public smoke checklist below. Record the release/image identifier, date, actual URL and real CI link in the README only after success.

```sh
docker build --target runtime -t auth-service:RELEASE .
docker build --target migrations -t auth-service:migrations-RELEASE .
# Provider release job: run the migration image with its private DATABASE_URL.
# Provider web service: run the runtime image with runtime secrets injected.
```

Build-time generation uses a nonfunctional, command-scoped database URL. It is not an image-level runtime connection setting. Runtime images contain compiled code and production dependencies and run as a non-root user; migration images deliberately retain build/dev tools and schema files.

## Public Smoke Checklist

- HTTPS is valid; live/ready return 200; unavailable-store readiness is generic and does not reveal connection settings.
- Docs use the current origin, contain logout/profile/health schemas and do not advertise seeding. Private or disabled docs enforce the chosen policy.
- Synthetic USER signup/login/me/refresh/logout works if writes are enabled. Admin probes return 403. Replay and revoked refresh receive 401.
- A spoofed `X-Forwarded-For` from an untrusted client cannot bypass rate limits. Verify this through the actual ingress, not just localhost.
- Responses have request IDs; logs/audits do not contain password/token values. Do not paste token outputs into issues.
- SIGTERM drains in-flight requests and stops cleanly. Scaling multiple API replicas preserves shared Redis limits and PostgreSQL token consumption.
- Backup/restore has been exercised; alerts and a cleanup/retention owner are assigned before inviting visitors.

## Diagnosis And Recovery

`/health/live` 200 but `/health/ready` 503 means the process is alive but a store is unhealthy. Check private network reachability, credentials, migrations and store quotas. Logs intentionally avoid raw connection errors; investigate through restricted provider tooling, never by publishing environment output. Auth 503 can also be the fail-closed Redis limiter.

429 is expected enforcement: honor `Retry-After`. A login 401 does not disclose which credential was wrong. A refresh 401 can indicate expiry, logout, rotation or a concurrent loser; do not retry an old token indefinitely.

On leaked signing credentials, replace the key through the secret manager and restart all replicas, invalidating existing JWTs. Refresh tokens are independent: revoke affected rows (or all sessions through a reviewed private operation) and preserve a safe audit trail. This service has no automated key ring or logout-all API.

Before database recovery, stop writes and take a backup if possible. Prefer a forward migration. Rolling back an image does not roll back the schema. The refresh-hashing migration is irreversible without invalidating/reissuing sessions; never restore plaintext token storage as a routine rollback.

## Local Notes

Use `docker compose -p auth-service-learning` consistently. Rebuild after code changes. `down` keeps data; `down -v` deletes this project's volume. Existing volumes retain original passwords even when environment values change.

During verification the original local JWT key was rejected as too short. The assistant did not read or rewrite it; the running verified container uses an independently generated temporary key passed through the shell. Set your own strong key in local configuration before a normal Compose recreation. Recreating with a different key invalidates previously issued access JWTs.