# Safe Reviewer Demo

Use the local [Swagger UI](http://127.0.0.1:18080/docs/). A public URL will be added only after a real deployment is verified. Use a disposable unique email and password, never your normal credentials. Do not use real customer data.

The free hosting blueprint defaults to `DEMO_READ_ONLY=true`: public auth writes return a documented 403. Run the full walkthrough locally; the hosted preview exposes docs/health until ingress and abuse controls are verified. Do not mistake its deliberate 403 for an authentication bug.

1. Check `GET /health/live` and `GET /health/ready`; expect 200. Liveness alone does not establish store availability.
2. Call `POST /auth/signup` with your unique email and an 8+ character password, at most 72 UTF-8 bytes. Expect 201 with only id/email. Repeating the email gives 409.
3. Call `POST /auth/login`. Keep both returned tokens privately. Click Swagger's Authorize button and paste the **access token alone**; Swagger supplies the Bearer prefix.
4. Call `GET /me`. Expect id, email, USER role and createdAt, with no password/hash/tokens. `GET /profile` is a different legacy authorization-context response.
5. Call `GET /users` and `GET /admin/dashboard`; both should return 403 for this USER. This is the intended privilege boundary, not a broken demo.
6. Call `POST /auth/refresh` with the login refresh token. Expect a new pair. Update your saved refresh token and Swagger authorization to the replacement values.
7. Submit the **old** refresh token again; expect 401. The replacement remains valid under this service's replay policy.
8. Call `POST /auth/logout` using the replacement refresh token; expect 204 with no body. Repeat it; expect 204 again. Refreshing that token now gives 401.
9. An already-issued access JWT may still call `/me` until expiry or account deactivation. Logout does not implement immediate access-session revocation. Clear Swagger authorization and close the demo afterward.

Rate limits per IP per minute: signup 3, login 5, refresh 20, logout 5. A 429 carries `Retry-After`; do not continually retry. A 503 on an auth route can indicate Redis is unavailable. Every response supplies `X-Request-ID` for diagnosis.

## Admin And Concurrency Evidence

Do not create a publicly shared admin account. The real-store tests privately create/promote synthetic fixtures and prove USER denial, ADMIN success, immediate demotion and soft-deletion denial, safe user listing and tied-timestamp pagination. They also submit two refresh requests concurrently and require exactly one success.

Run the coverage command in the README against isolated stores. Fixtures are cleaned up afterward. There is no admin seed route to enable with legacy demo flags.

## Portfolio Evidence Still To Publish

Capture screenshots only with synthetic data and redacted token values: the Swagger route list, a safe `/me` result and USER-to-admin denial. Do not photograph login token responses, environment files or private admin data. A hosted CI badge and a live URL should only be added after the associated run/deployment actually succeeds.