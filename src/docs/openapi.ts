const openApiSpec = {
    openapi: "3.0.3",
    info: {
        title: "Auth Service API",
        version: "1.0.0",
        description: "Interactive demo docs for the auth service backend",
    },
    servers: [
        {
            url: "http://localhost:3000",
            description: "Local development",
        },
    ],
    tags: [
        { name: "Health" },
        { name: "Auth" },
        { name: "Demo" },
        { name: "Users" },
        { name: "Profile" },
        { name: "Admin" },
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
            },
        },
        schemas: {
            SignupRequest: {
                type: "object",
                required: ["email", "password"],
                properties: {
                    email: { type: "string", format: "email", example: "demo@example.com" },
                    password: { type: "string", minLength: 8, example: "demoPass123" },
                },
            },
            SignupResponse: {
                type: "object",
                properties: {
                    id: { type: "number", example: 1 },
                    email: { type: "string", example: "demo@example.com" },
                },
            },
            LoginRequest: {
                type: "object",
                required: ["email", "password"],
                properties: {
                    email: { type: "string", format: "email", example: "demo@example.com" },
                    password: { type: "string", minLength: 8, example: "demoPass123" },
                },
            },
            RefreshRequest: {
                type: "object",
                required: ["refreshToken"],
                properties: {
                    refreshToken: { type: "string", example: "1f10fa4d-d5cd-44cf-8358-7f4ae4a7d7f5" },
                },
            },
            TokenResponse: {
                type: "object",
                properties: {
                    accessToken: { type: "string" },
                    refreshToken: { type: "string" },
                },
            },
            ErrorResponse: {
                type: "object",
                properties: {
                    message: { type: "string", example: "Unauthorized" },
                },
            },
        },
    },
    paths: {
        "/": {
            get: {
                tags: ["Health"],
                summary: "Service status",
                responses: {
                    "200": {
                        description: "Service is running",
                        content: {
                            "text/plain": {
                                schema: { type: "string", example: "Auth service running" },
                            },
                        },
                    },
                },
            },
        },
        "/auth/signup": {
            post: {
                tags: ["Auth"],
                summary: "Create new user",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/SignupRequest" },
                        },
                    },
                },
                responses: {
                    "201": {
                        description: "User created",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/SignupResponse" },
                            },
                        },
                    },
                    "409": {
                        description: "Duplicate email",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorResponse" },
                            },
                        },
                    },
                },
            },
        },
        "/auth/login": {
            post: {
                tags: ["Auth"],
                summary: "Login user",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/LoginRequest" },
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "Access and refresh token",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/TokenResponse" },
                            },
                        },
                    },
                    "401": {
                        description: "Invalid credentials",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorResponse" },
                            },
                        },
                    },
                },
            },
        },
        "/auth/refresh": {
            post: {
                tags: ["Auth"],
                summary: "Rotate refresh token",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/RefreshRequest" },
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "New access and refresh token",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/TokenResponse" },
                            },
                        },
                    },
                    "401": {
                        description: "Invalid refresh token",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorResponse" },
                            },
                        },
                    },
                },
            },
        },
        "/auth/demo/seed-admin": {
            post: {
                tags: ["Demo"],
                summary: "Seed demo admin user",
                description: "Development/demo only. Disabled in production unless ENABLE_DEMO_ROUTES=true.",
                responses: {
                    "201": {
                        description: "Demo admin credentials",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        email: { type: "string", example: "admin.demo@example.com" },
                                        password: { type: "string", example: "DemoAdmin123!" },
                                        role: { type: "string", example: "ADMIN" },
                                    },
                                },
                            },
                        },
                    },
                    "404": {
                        description: "Demo route disabled",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorResponse" },
                            },
                        },
                    },
                },
            },
        },
        "/profile": {
            get: {
                tags: ["Profile"],
                summary: "Get current user profile",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": {
                        description: "Authenticated user details",
                    },
                    "401": {
                        description: "Unauthorized",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorResponse" },
                            },
                        },
                    },
                },
            },
        },
        "/users": {
            get: {
                tags: ["Users"],
                summary: "List users (admin only)",
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        in: "query",
                        name: "cursor",
                        schema: { type: "number" },
                        required: false,
                    },
                    {
                        in: "query",
                        name: "limit",
                        schema: { type: "number", default: 10 },
                        required: false,
                    },
                ],
                responses: {
                    "200": {
                        description: "List of users",
                    },
                    "401": {
                        description: "Unauthorized",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorResponse" },
                            },
                        },
                    },
                    "403": {
                        description: "Forbidden",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorResponse" },
                            },
                        },
                    },
                },
            },
        },
        "/admin/dashboard": {
            get: {
                tags: ["Admin"],
                summary: "Admin-only dashboard",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": {
                        description: "Admin access granted",
                    },
                    "401": {
                        description: "Unauthorized",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorResponse" },
                            },
                        },
                    },
                    "403": {
                        description: "Forbidden",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorResponse" },
                            },
                        },
                    },
                },
            },
        },
    },
} as const;

export default openApiSpec;