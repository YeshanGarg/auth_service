# Auth Service

A production-ready authentication service built with Node.js, Express, Prisma 7, and PostgreSQL.

It supports JWT-based authentication, refresh token rotation, RBAC-ready roles, rate limiting, audit logging, and security hardening.

## Tech Stack

- Node.js + Express
- TypeScript
- Prisma ORM (v7)
- PostgreSQL
- Docker & Docker Compose
- JWT Authentication

## Architecture

[ Client ]
     |
     v
[ Express API ]
     |
     v
[ Auth Service ]
     |
     +--> PostgreSQL
     +--> Redis


## Authentication Flow

1. User signs up → password hashed → user stored
2. Login issues short-lived access token + refresh token
3. Access token used via Authorization header
4. Refresh token rotates securely
5. Logout revokes refresh tokens

## Security

- Password hashing (bcrypt)
- JWT expiration & refresh rotation
- Rate limiting on auth endpoints
- Helmet security headers
- Strict CORS configuration
- Input validation with Zod

## Observability

- Structured JSON logging
- Request correlation IDs
- Persistent audit logs for auth events


## Running Locally

```bash
git clone https://github.com/YeshanGarg/auth_service.git
cd auth_service
cp .env.example .env
docker compose up --build
