/**
 * Auth API Integration Tests
 * Run with: npm test
 *
 * NOTE: These tests require a running MongoDB instance.
 * Set MONGODB_URI_TEST or MONGODB_URI in your environment.
 * Tests use a dedicated test database that gets cleaned up after each suite.
 */

const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../app");
const Student = require("../models/Student");

const TEST_DB = process.env.MONGODB_URI_TEST || "mongodb://127.0.0.1:27017/waygood-test";

beforeAll(async () => {
  await mongoose.connect(TEST_DB);
});

afterEach(async () => {
  await Student.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

const validUser = {
  fullName: "Test Student",
  email: "test@waygood.io",
  password: "securepass123",
  targetCountries: ["Canada"],
  interestedFields: ["Computer Science"],
  preferredIntake: "September",
  maxBudgetUsd: 30000,
};

// ──────────────────────────────────────────────
// POST /api/auth/register
// ──────────────────────────────────────────────
describe("POST /api/auth/register", () => {
  it("returns 201 and a JWT token on successful registration", async () => {
    const res = await request(app).post("/api/auth/register").send(validUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.student.email).toBe(validUser.email);
    expect(res.body.data.student.password).toBeUndefined(); // never leak password
  });

  it("returns 400 if required fields are missing", async () => {
    const res = await request(app).post("/api/auth/register").send({ email: "x@x.com" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBeFalsy();
  });

  it("returns 400 if password is shorter than 8 characters", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validUser, password: "short" });

    expect(res.status).toBe(400);
  });

  it("returns 409 when email is already registered", async () => {
    await request(app).post("/api/auth/register").send(validUser);
    const res = await request(app).post("/api/auth/register").send(validUser);

    expect(res.status).toBe(409);
  });
});

// ──────────────────────────────────────────────
// POST /api/auth/login
// ──────────────────────────────────────────────
describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/api/auth/register").send(validUser);
  });

  it("returns 200 and a JWT token with valid credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: validUser.email,
      password: validUser.password,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
  });

  it("returns 401 with wrong password", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: validUser.email,
      password: "wrongpassword",
    });

    expect(res.status).toBe(401);
  });

  it("returns 401 with unknown email", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "nobody@example.com",
      password: "anything",
    });

    expect(res.status).toBe(401);
  });
});

// ──────────────────────────────────────────────
// GET /api/auth/me
// ──────────────────────────────────────────────
describe("GET /api/auth/me", () => {
  let token;

  beforeEach(async () => {
    const res = await request(app).post("/api/auth/register").send(validUser);
    token = res.body.data.token;
  });

  it("returns 200 with user profile when authenticated", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.student.email).toBe(validUser.email);
    expect(res.body.data.student.password).toBeUndefined();
  });

  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/auth/me");

    expect(res.status).toBe(401);
  });

  it("returns 401 with an invalid/malformed token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer not.a.real.token");

    expect(res.status).toBe(401);
  });
});
