# Waygood — Study Abroad Platform (Backend Assignment)

A production-grade MERN backend for a study-abroad platform, built for the Waygood internship assignment.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Environment Configuration](#environment-configuration)
3. [API Reference](#api-reference)
4. [Architecture Decisions](#architecture-decisions)
5. [Database Indexing Strategy](#database-indexing-strategy)
6. [Performance & Caching](#performance--caching)
7. [Security Measures](#security-measures)
8. [Running Tests](#running-tests)
9. [Docker Deployment](#docker-deployment)
10. [Assumptions](#assumptions)

---

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB 6+ (local or Atlas)

### Local Setup

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd waygood

# 2. Install backend dependencies
cd backend
npm install

# 3. Copy and configure environment
cp .env.example .env
# Edit .env and set your JWT_SECRET and MONGODB_URI

# 4. Seed the database with sample data
npm run seed

# 5. Start the development server
npm run dev
# Server starts on http://localhost:4000
```

### With Docker (recommended for evaluation)

```bash
# From the project root
docker-compose up --build

# Seed data (in a separate terminal)
docker exec waygood-backend node src/scripts/seed.js
```

---

## Environment Configuration

```env
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/waygood-evaluation
JWT_SECRET=replace-with-a-long-random-secret-min-32-chars
JWT_EXPIRES_IN=1d
CACHE_TTL_SECONDS=300
```

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP server port | `4000` |
| `MONGODB_URI` | MongoDB connection string | local |
| `JWT_SECRET` | Secret key for signing JWTs | `dev-secret` |
| `JWT_EXPIRES_IN` | JWT expiry duration | `1d` |
| `CACHE_TTL_SECONDS` | In-memory cache TTL | `300` |

---

## API Reference

All responses follow a consistent envelope:

```json
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 }
}
```

Errors use:
```json
{ "success": false, "message": "Human-readable error description" }
```

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | ❌ | Register a new student account |
| `POST` | `/api/auth/login` | ❌ | Login and receive a JWT token |
| `GET` | `/api/auth/me` | ✅ | Get authenticated student's profile |

**Register** — `POST /api/auth/register`
```json
{
  "fullName": "Arjun Sharma",
  "email": "arjun@example.com",
  "password": "securepass123",
  "targetCountries": ["Canada", "UK"],
  "interestedFields": ["Computer Science", "Data Science"],
  "preferredIntake": "September",
  "maxBudgetUsd": 30000,
  "englishTest": { "exam": "IELTS", "score": 7.0 }
}
```

**Login** — `POST /api/auth/login`
```json
{ "email": "arjun@example.com", "password": "securepass123" }
```

**Using the token:**
```
Authorization: Bearer <token>
```

---

### University Discovery

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/universities` | ❌ | Filterable, paginated university list |
| `GET` | `/api/universities/popular` | ❌ | Top 6 universities (cached) |

**Query parameters for `/api/universities`:**

| Param | Type | Example |
|---|---|---|
| `country` | string | `?country=Canada` |
| `partnerType` | string | `?partnerType=direct` |
| `scholarshipAvailable` | boolean | `?scholarshipAvailable=true` |
| `q` | string | `?q=toronto` |
| `sortBy` | `popular\|name\|ranking` | `?sortBy=ranking` |
| `page` | number | `?page=2` |
| `limit` | number (max 50) | `?limit=5` |

---

### Program Discovery

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/programs` | ❌ | Filterable, paginated program list |

**Query parameters:**

| Param | Type | Example |
|---|---|---|
| `country` | string | `?country=Australia` |
| `degreeLevel` | `bachelor\|master\|diploma\|certificate` | `?degreeLevel=master` |
| `field` | string | `?field=Computer Science` |
| `intake` | string | `?intake=September` |
| `maxTuition` | number | `?maxTuition=25000` |
| `scholarshipAvailable` | boolean | `?scholarshipAvailable=true` |
| `q` | string | text search |
| `sortBy` | `tuitionAsc\|tuitionDesc\|relevance` | `?sortBy=tuitionAsc` |

---

### Recommendations

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/recommendations/me` | ✅ | Personalised program recommendations |
| `GET` | `/api/recommendations/:studentId` | ✅ | Recommendations for a specific student |

Recommendations are powered by a **MongoDB Aggregation Pipeline** that scores programs based on:

| Signal | Weight |
|---|---|
| Country match | 35 pts |
| Field of study match | 30 pts |
| Within budget | 20 pts |
| Preferred intake available | 10 pts |
| IELTS score meets minimum | 5 pts |

Results are cached per student for 5 minutes to avoid re-running the aggregation on every request.

---

### Applications

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/applications` | ✅ | List own applications (with filters) |
| `POST` | `/api/applications` | ✅ | Apply to a program |
| `GET` | `/api/applications/:id` | ✅ | Get a single application with timeline |
| `PATCH` | `/api/applications/:id/status` | ✅ | Update application status |

**Create application** — `POST /api/applications`
```json
{ "programId": "<ObjectId>", "intake": "September" }
```

**Update status** — `PATCH /api/applications/:id/status`
```json
{ "status": "submitted", "note": "All documents uploaded." }
```

**Valid status transitions:**

```
draft → submitted
submitted → under-review | rejected
under-review → offer-received | rejected
offer-received → visa-processing | rejected
visa-processing → enrolled | rejected
enrolled → (terminal)
rejected → (terminal)
```

The API enforces these transitions and returns `400` for invalid moves. Every status change is appended to a `timeline` array with a timestamp and optional note.

---

### Dashboard

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/dashboard/overview` | ❌ | Platform-wide stats (cached) |

---

## Architecture Decisions

### 1. Controller → Service → Model layering

Controllers handle HTTP concerns (parsing request, sending response). Business logic lives in services (`recommendationService`). Models own schema and data access. This keeps controllers thin and services testable independently.

### 2. MongoDB Aggregation for recommendations

Rather than fetching programs into Node and scoring them in JS (the starter approach), recommendations use a single aggregation pipeline. This pushes computation to the database engine where indexes are available, reduces network payload, and scales as the program catalogue grows. The scoring logic is expressed as `$addFields` + `$cond` expressions so it's a single round-trip.

### 3. In-memory cache (MemoryCacheService)

A lightweight TTL-based Map cache is used for frequently read, rarely changing endpoints: popular universities, dashboard overview, and per-student recommendations. This avoids setting up Redis as an external dependency while still demonstrating the caching pattern. In production, this would be swapped for Redis (the `REDIS_URL` env var is already provisioned).

### 4. Compound unique index on Applications

```js
applicationSchema.index({ student: 1, program: 1, intake: 1 }, { unique: true });
```

Duplicate application prevention is enforced at the database level (not just application code), which prevents race conditions under concurrent requests.

### 5. JWT stateless authentication

JWTs are signed with `HS256` and validated on every protected request without a database lookup (only the `sub` claim needs the DB to load the user object). This keeps auth fast and horizontally scalable.

### 6. Role field on Student model

Both students and counselors share the `Student` collection, differentiated by `role: "student" | "counselor"`. This avoids a second User model while leaving room to add counselor-only route guards.

---

## Database Indexing Strategy

| Collection | Index | Reason |
|---|---|---|
| `University` | `{ country: 1 }` | Country filter is the most common query param |
| `University` | `{ popularScore: -1 }` | Popular sort used in list + popular endpoints |
| `University` | `text(name, country, city)` | Text search via `q` param |
| `Program` | `{ country: 1, degreeLevel: 1, field: 1, tuitionFeeUsd: 1 }` | Compound index covers all common filter combos |
| `Program` | `{ university: 1 }` | Lookup by university |
| `Application` | `{ student: 1, program: 1, intake: 1 }` (unique) | Duplicate prevention + student's application list |
| `Application` | `{ student: 1 }`, `{ status: 1 }` | Filtering own applications by status |

**Why compound indexes?**

The program discovery query typically combines `country + degreeLevel + field + tuitionFeeUsd`. A compound index on these four fields allows MongoDB to satisfy the entire query from the index without touching the collection. The order follows ESR (Equality → Sort → Range): equality fields first, range (`tuitionFeeUsd: { $lte }`) last.

---

## Performance & Caching

| Endpoint | Cache Key | TTL |
|---|---|---|
| `GET /api/universities/popular` | `popular-universities` | 5 min |
| `GET /api/dashboard/overview` | `dashboard-overview` | 5 min |
| `GET /api/recommendations/me` | `recommendations:<studentId>` | 5 min |

Cache is invalidated automatically via TTL expiry. To manually bust a key (e.g., after an admin update), call `cacheService.delete(key)`.

The recommendation cache is keyed per student so profile changes don't serve stale results across users.

---

## Security Measures

1. **Password hashing** — bcrypt with salt rounds = 10 (configured in `Student` model pre-save hook)
2. **JWT authentication** — tokens verified on every protected route; expired/tampered tokens return `401`
3. **Rate limiting**:
   - Auth endpoints: 20 requests / 15 min per IP (brute-force protection)
   - All other API endpoints: 100 requests / min per IP
4. **Input validation** — required fields checked in controllers before DB operations
5. **Ownership checks** — application queries always include `student: req.user._id` to prevent IDOR (users can only see/modify their own applications)
6. **Password never returned** — `select("-password")` in auth middleware; never serialised in response bodies

---

## Running Tests

```bash
cd backend

# Run all tests (requires MongoDB running)
npm test

# With coverage report
npm run test:coverage
```

Tests cover:
- `auth.test.js` — register, login, /me endpoint (happy paths + edge cases)
- `applications.test.js` — create, list, status transitions, duplicate prevention, ownership
- `universities.test.js` — filtering, pagination, search, caching

Each test file spins up its own isolated test database (`waygood-test`) and cleans up after itself.

---

## Docker Deployment

```bash
# Build and start all services (MongoDB + Backend + Frontend)
docker-compose up --build

# Seed data into the Dockerised MongoDB
docker exec waygood-backend node src/scripts/seed.js

# Stop everything
docker-compose down

# Stop and delete volumes (clean slate)
docker-compose down -v
```

Services:
- **MongoDB** → `localhost:27017`
- **Backend API** → `http://localhost:4000`
- **Frontend** → `http://localhost:5173`

---

## Assumptions

1. **Authentication scope** — All application routes require a valid JWT. University and program discovery endpoints are intentionally public to support unauthenticated browsing (common in study-abroad platforms where students explore before signing up).

2. **Role-based access** — Counselors and students share the `/api/auth/me` endpoint. Route-level role guards (`requireRole("counselor")`) are scaffolded but not enforced in this submission to keep scope clear.

3. **Recommendation engine** — The aggregation pipeline uses `$regexMatch` for field matching because program fields in the seed data are free-text strings ("Computer Science", "Business Analytics") rather than a controlled enum. In production, an enum or taxonomy would allow exact matching.

4. **Cache implementation** — In-memory TTL cache is used instead of Redis. The `REDIS_URL` env var is provisioned and the `CacheService` interface is designed to be drop-in replaceable with an `ioredis` implementation.

5. **Duplicate prevention** — Uniqueness is enforced on `(student, program, intake)`. The same student can apply to the same program for a *different* intake (e.g. September 2025 and January 2026), which reflects real study-abroad workflows.

6. **Seeded data** — The `npm run seed` script is idempotent: it clears and re-inserts universities and programs, but does not delete existing student accounts or applications.
