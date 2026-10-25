# Security Model And Limitations

## Scope

This is a portfolio-grade API, not a complete identity provider. Assets are password hashes, signing keys, refresh credentials, account metadata and audit records. Threats include unauthenticated abuse, stolen tokens, privilege escalation, credential leakage, stale authorization and concurrent token replay.

## Controls

| Threat | Implemented control | Residual risk |
| --- | --- | --- |
| Password disclosure | bcrypt cost 12; safe response projections | Backups and privileged DB access still expose hashes |
| Refresh credential theft from DB | Random opaque tokens; indexed SHA-256 digest | Raw client tokens remain bearer credentials |
| Replay/concurrent refresh | Transactional conditional token consumption | No family-wide replay revocation; lost responses can lose a session |
| Stale admin JWT | Current active DB account and role checked | Requires DB availability on every protected request |
| Brute-force/abuse | Atomic per-IP/per-route Redis limits; fail closed | IP sharing, IPv6 rotation, distributed attacks and timing enumeration remain |
| Sensitive API serialization | Explicit safe DTO fields and tests | ADMIN still reads user emails; never publish admin credentials |
| Error/log leakage | Sanitized errors; request IDs; nested sensitive-key log redaction | Log messages must remain static; free-form secrets are not universally scrubbed |
| Proxy spoofing | No proxy trusted by default; explicit networks only | A wrong hosting trust policy can defeat per-IP limits |
| DB/audit inconsistency | Auth data and audit rows in one transaction | Audit storage failure deliberately blocks the operation |

## Session Policy

Access JWTs last 15 minutes and validate HS256, issuer, audience, expiry and claim shape. Refresh tokens last seven days per rotation. Revocation removes the presented refresh row only. Logout does **not** invalidate an existing access JWT, nor a different session. Deleted accounts and demoted admins are denied on subsequent protected requests. There is no logout-all endpoint, absolute session lifetime, family tracking or signing-key rotation mechanism.

The historical refresh-token migration preserves existing token values by hashing them in-place. Copies in old backups, logs or Git history do not disappear. Rotate affected credentials and address backup/history exposure separately when necessary.

## Browser And HTTP Policy

- HTTPS is mandatory outside localhost; terminate TLS at a verified hosting proxy.
- Bearer headers and JSON token bodies are used, not auth cookies. CORS does not grant credentialed cookie access. If cookies are introduced, design CSRF protection and Secure/HttpOnly/SameSite settings first.
- Do not put refresh credentials in browser localStorage for a production client. Swagger is a developer demo: use a disposable account and clear tokens after testing.
- CORS is a browser policy, not authentication or a firewall. Requests without Origin are allowed by default for CLI/server clients; protected resources still require authorization.
- For private docs, provide a distinct 32+ character `DOCS_ACCESS_TOKEN` through `X-Docs-Key`. Query keys are unsupported because URLs leak into history/logs. A browser needs a header-injecting proxy/client for all Swagger asset requests; there is no private-doc login page.
- Keep `TRUST_PROXY` empty until you know the trusted proxy IP/CIDRs. Do not set `true` or a guessed hop count. Hosts with changing ranges may require a different verified trust strategy before public write access.

## Data And Operations

No public admin seeding exists. Provision administration through controlled private operations only, with unique credentials and no public sharing. Account emails and IP/user-agent audit fields are personal data: define retention, access control and deletion policy before gathering real users. The API has no email verification, password reset, MFA, account deletion endpoint, session UI or scheduled retention/cleanup job.

Do not expose writable public signup until you implement an operator-owned cleanup/quota policy or restrict the demo to reviewed users. A free host, per-IP limits and a separate database do not by themselves bound storage/bcrypt costs. A read-only docs/health demonstration with recorded synthetic flows is safer until those controls exist.

Keep database and Redis off public ports. Local Compose uses one DB owner for convenience; production must separate the migration owner from a least-privilege runtime role (DML on required tables/sequences, no schema ownership). Configure managed-service TLS according to the provider.
The Redis adapter also accepts `REDIS_URL` (`redis://` or `rediss://`, including URL authentication); a URL takes precedence over host/port defaults. The selected Render deployment uses its private internal URL with external access blocked. Never disable TLS certificate verification for external managed stores. The free public blueprint disables auth writes and keeps docs/health public until the remaining deployment checks are complete.

The local dump is no longer tracked and all dump/environment/CA files are ignored. The dump has not been decoded or audited; its contents and repository history are not certified clean. Review historical exposure before making the repository public; rotating secrets may be necessary even after removing a file from the latest tree.

## Verification And Reporting

`npm audit --audit-level=high` is a CI gate; the dependency tree was clean at the local verification checkpoint, not forever. Repeat it before release. Audit is advisory matching, not a full vulnerability assessment; scan container OS packages separately before deployment. Report suspected issues privately to the repository owner rather than posting credentials or personal data in a public issue.