const schemaRef = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const requestIdHeader = {
    "X-Request-ID": { description: "Server-generated correlation ID", schema: { type: "string", format: "uuid" } },
};
const response = (description: string, schema: object = schemaRef("ErrorResponse")) => ({
    description, headers: requestIdHeader, content: { "application/json": { schema } },
});
const requestBody = (name: string) => ({
    required: true, content: { "application/json": { schema: schemaRef(name) } },
});
const failures = {
    "400": response("Invalid input or malformed JSON"),
    "403": response("Authentication writes disabled when DEMO_READ_ONLY=true"),
    "413": response("JSON body exceeds 10 KB"),
    "429": {
        ...response("Per-IP, per-route fixed-window limit exceeded"),
        headers: { ...requestIdHeader, "Retry-After": { description: "Seconds until retry", schema: { type: "integer", minimum: 1 } } },
    },
    "503": response("Redis rate limiter unavailable; authentication writes fail closed"),
    "500": response("Sanitized internal error"),
};
const protectedFailures = {
    "401": response("Missing, invalid, expired token or inactive account"),
    "500": response("Sanitized internal error"),
};
const bearer = [{ bearerAuth: [] }];

const openApiSpec = {
    openapi: "3.0.3",
    info: {
        title: "Auth Service API", version: "1.0.0",
        description: "Portfolio-grade authentication API. Access JWTs expire after 15 minutes; opaque refresh tokens expire after 7 days and rotate once. No public admin provisioning. All responses carry X-Request-ID. Use HTTPS outside local development.",
    },
    servers: [{ url: "/", description: "Current API origin" }],
    tags: ["Health", "Auth", "Profile", "Users", "Admin"].map((name) => ({ name })),
    components: {
        securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
        schemas: {
            Credentials: {
                type: "object", required: ["email", "password"],
                properties: {
                    email: { type: "string", format: "email", maxLength: 254, example: "visitor@example.com" },
                    password: { type: "string", format: "password", minLength: 8, maxLength: 72, description: "At most 72 UTF-8 bytes (bcrypt bound). Use a unique password for this demo." },
                },
            },
            SignupResponse: {
                type: "object", required: ["id", "email"], additionalProperties: false,
                properties: { id: { type: "integer" }, email: { type: "string", format: "email" } },
            },
            User: {
                type: "object", required: ["id", "email", "role", "createdAt"], additionalProperties: false,
                properties: {
                    id: { type: "integer" }, email: { type: "string", format: "email" },
                    role: { type: "string", enum: ["USER", "ADMIN"] }, createdAt: { type: "string", format: "date-time" },
                },
            },
            UserPage: {
                type: "object", required: ["items", "nextCursor"], additionalProperties: false,
                properties: {
                    items: { type: "array", items: schemaRef("User") },
                    nextCursor: { type: "integer", nullable: true, description: "ID cursor for the next request; null on the final page" },
                },
            },
            RefreshRequest: {
                type: "object", required: ["refreshToken"],
                properties: { refreshToken: { type: "string", minLength: 1, maxLength: 512, description: "Opaque token from login or the most recent refresh" } },
            },
            TokenResponse: {
                type: "object", required: ["accessToken", "refreshToken"], additionalProperties: false,
                properties: { accessToken: { type: "string" }, refreshToken: { type: "string" } },
            },
            AuthorizationContext: {
                type: "object", required: ["message", "user"],
                properties: {
                    message: { type: "string" },
                    user: { type: "object", required: ["userId", "role"], properties: { userId: { type: "integer" }, role: { type: "string", enum: ["USER", "ADMIN"] } } },
                },
            },
            ErrorResponse: {
                type: "object", required: ["message"],
                properties: {
                    message: { type: "string" },
                    requestId: { type: "string", format: "uuid", description: "Present for centrally handled errors; X-Request-ID is always available" },
                    issues: { type: "array", items: { type: "object", required: ["path", "message"], properties: { path: { type: "string" }, message: { type: "string" } } } },
                },
            },
        },
    },
    paths: {
        "/health/live": {
            get: { tags: ["Health"], summary: "Process liveness, independent of stores", responses: { "200": response("Alive", { type: "object", properties: { status: { type: "string", enum: ["ok"] } } }) } },
        },
        "/health/ready": {
            get: { tags: ["Health"], summary: "PostgreSQL and Redis readiness", responses: {
                "200": response("Both stores reachable", { type: "object", properties: { status: { type: "string", enum: ["ready"] } } }),
                "503": response("A required store is unavailable", { type: "object", properties: { status: { type: "string", enum: ["not_ready"] } } }),
            } },
        },
        "/auth/signup": {
            post: { tags: ["Auth"], summary: "Create a USER account", description: "3 requests per IP per 60 seconds. Client-supplied roles cannot grant privileges.", requestBody: requestBody("Credentials"), responses: { ...failures, "201": response("Created", schemaRef("SignupResponse")), "409": response("Email already registered") } },
        },
        "/auth/login": {
            post: { tags: ["Auth"], summary: "Create a session", description: "5 requests per IP per 60 seconds. Unknown account and wrong password use the same error message (not a timing-equivalence guarantee).", requestBody: requestBody("Credentials"), responses: { ...failures, "200": response("Token pair", schemaRef("TokenResponse")), "401": response("Invalid credentials") } },
        },
        "/auth/refresh": {
            post: { tags: ["Auth"], summary: "Consume and rotate a refresh token", description: "20 requests per IP per 60 seconds. Reuse, expiry, concurrent losers and inactive accounts receive 401. Replay does not revoke the winning replacement token.", requestBody: requestBody("RefreshRequest"), responses: { ...failures, "200": response("Replacement token pair", schemaRef("TokenResponse")), "401": response("Invalid refresh token") } },
        },
        "/auth/logout": {
            post: { tags: ["Auth"], summary: "Revoke the presented refresh token", description: "5 requests per IP per 60 seconds. Idempotent: unknown/already consumed tokens also receive 204. Other sessions and issued access JWTs remain valid.", requestBody: requestBody("RefreshRequest"), responses: { ...failures, "204": { description: "Token revoked or already absent; no response body", headers: requestIdHeader } } },
        },
        "/me": {
            get: { tags: ["Profile"], summary: "Current active user, safe DTO", security: bearer, responses: { ...protectedFailures, "200": response("Current user", schemaRef("User")) } },
        },
        "/profile": {
            get: { tags: ["Profile"], summary: "Legacy authorization-context endpoint; use /me for profile details", security: bearer, responses: { ...protectedFailures, "200": response("Current DB-backed authorization context", schemaRef("AuthorizationContext")) } },
        },
        "/users": {
            get: {
                tags: ["Users"], summary: "Admin-only active user listing", security: bearer,
                description: "Ordered by createdAt DESC, id DESC. Pass nextCursor unchanged with the same limit. This is keyset traversal, not a snapshot under concurrent deletions or edits.",
                parameters: [
                    { in: "query", name: "cursor", schema: { type: "integer", minimum: 1, maximum: 2147483647 } },
                    { in: "query", name: "limit", schema: { type: "integer", minimum: 1, maximum: 100, default: 10 } },
                ],
                responses: { ...protectedFailures, "200": response("Safe paginated users", schemaRef("UserPage")), "400": response("Invalid cursor or limit"), "403": response("Current role is not ADMIN") },
            },
        },
        "/admin/dashboard": {
            get: { tags: ["Admin"], summary: "Admin authorization probe", security: bearer, description: "Uses current DB role, not the stale JWT role claim.", responses: { ...protectedFailures, "200": response("Admin access granted", schemaRef("AuthorizationContext")), "403": response("Current role is not ADMIN") } },
        },
    },
} as const;

export default openApiSpec;