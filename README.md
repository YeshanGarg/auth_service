# Auth Service Backend

Production-grade authentication and authorization API built with Node.js, Express, TypeScript, Prisma, PostgreSQL, and Redis.

This project demonstrates how to design and ship a secure auth backend with layered architecture, token lifecycle management, role-based access control, auditability, and automated quality checks.

## What This Project Demonstrates

- Secure signup and login flows with password hashing
- JWT access token + refresh token rotation
- RBAC enforcement with USER and ADMIN roles
- Abuse protection with route-level rate limiting
- Request traceability with request IDs and structured logs
- Persistent audit logs for security-sensitive events
- Interactive API demo experience with Swagger UI
- Automated CI build and test pipeline

## Tech Stack

- Node.js 20 + Express 5
- TypeScript
- Prisma ORM 7 + PostgreSQL
- Redis (rate limiting)
- Vitest + Supertest
- Docker + Docker Compose

## Architecture

```text
Client / Swagger UI
        |
        v
Express Routes -> Controllers -> Services -> Prisma/Data Stores
   |             (validation)     (business logic)
   |
Middlewares (auth, role, context, rate limit, error handling)

Data Stores:
- PostgreSQL (users, refresh tokens, audit logs)
- Redis (rate limit counters)
```

## Core Flows

1. Signup: validate input -> hash password -> create user -> audit event
2. Login: verify credentials -> issue access token -> create refresh token -> audit event
3. Refresh: validate refresh token -> rotate refresh token -> issue new access token -> audit event
4. Authorization: bearer token validation + role checks at middleware layer

## Interactive Demo

- Swagger Docs: http://localhost:3000/docs
- OpenAPI JSON: http://localhost:3000/openapi.json

### Guided Reviewer Flow

1. Open Swagger docs.
2. Call POST /auth/demo/seed-admin to bootstrap demo credentials.
3. Call POST /auth/login with seeded credentials.
4. Click Authorize and paste Bearer accessToken.
5. Call GET /profile.
6. Call POST /auth/refresh.
7. Call GET /users to demonstrate ADMIN-only access.

Note: demo seed route is disabled in production unless ENABLE_DEMO_ROUTES=true.

## Local Setup

### Option A: Docker (recommended)

```bash
git clone https://github.com/YeshanGarg/auth_service.git
cd auth_service
cp .env.example .env
docker compose up --build
```

### Option B: Local runtime

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run build
npm start
```

## Environment Variables

Defined in .env.example:

- PORT
- DATABASE_URL
- JWT_SECRET
- REDIS_HOST
- REDIS_PORT
- ENABLE_DEMO_ROUTES
- DEMO_ADMIN_EMAIL
- DEMO_ADMIN_PASSWORD

## Quality Checks

```bash
# run test suite
npm test

# compile and type-check
npm run build

# run both (showcase command)
npm run check
```

## CI

GitHub Actions workflow at .github/workflows/ci.yml runs:

1. npm ci
2. npm run build
3. npm test

## Security Highlights

- bcrypt password hashing
- JWT verification middleware
- Refresh token rotation
- Role-based authorization middleware
- Helmet + HPP hardening
- Auth endpoint rate limiting
- Centralized error handling
- Audit log persistence for security-relevant actions

## API Endpoints (Summary)

- GET /
- GET /docs
- POST /auth/signup
- POST /auth/login
- POST /auth/refresh
- POST /auth/demo/seed-admin
- GET /profile
- GET /users (ADMIN only)
- GET /admin/dashboard (ADMIN only)

## Challenges and Design Decisions

1. Token Security vs User Experience:
        Short-lived access tokens were chosen for reduced blast radius, while refresh token rotation keeps sessions usable without forcing frequent logins.
2. Thin Controllers, Rich Services:
        Business logic is concentrated in services so controllers stay focused on validation and transport concerns, improving maintainability and testability.
3. Demo Safety:
        The demo seed endpoint is intentionally gated behind environment checks so demo convenience does not leak into production behavior.
4. Auditable Auth Events:
        Security-critical flows write audit records to support incident investigation and operational visibility.

## Resume and LinkedIn Highlights

Use any of these directly in your profile:

- Built a production-style authentication backend using Node.js, Express, TypeScript, Prisma, PostgreSQL, and Redis with layered architecture and centralized error handling.
- Implemented JWT access tokens with refresh token rotation, role-based authorization (USER and ADMIN), and route-level rate limiting for secure auth flows.
- Added observability features including structured logging, request correlation IDs, and persistent audit logs for security-relevant actions.
- Delivered an interactive backend demo via Swagger/OpenAPI with guided flows, plus CI automation (build + tests) using GitHub Actions.
- Wrote integration tests with Vitest and Supertest to validate auth boundaries, protected routes, and demo-route gating behavior.

## Interview Talking Points

When discussing this project, emphasize:

1. Why refresh token rotation is safer than long-lived access tokens.
2. How middleware enforces cross-cutting concerns (auth, role checks, rate limiting, error handling).
3. How service-layer design improves testability and future feature work.
4. How the Swagger demo and CI pipeline improve reviewer confidence and developer onboarding.

## Portfolio Notes

This repository is intentionally backend-focused and demonstrates:

- system design clarity
- secure coding practices
- testability and automation
- production-minded API engineering
