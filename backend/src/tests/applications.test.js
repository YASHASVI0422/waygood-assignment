/**
 * Applications API Integration Tests
 */

const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../app");
const Student = require("../models/Student");
const University = require("../models/University");
const Program = require("../models/Program");
const Application = require("../models/Application");

const TEST_DB = process.env.MONGODB_URI_TEST || "mongodb://127.0.0.1:27017/waygood-test";

let token;
let programId;
let universityId;

beforeAll(async () => {
  await mongoose.connect(TEST_DB);

  // Create test university
  const uni = await University.create({
    name: "Test University",
    country: "Canada",
    city: "Toronto",
    partnerType: "direct",
  });
  universityId = uni._id;

  // Create test program
  const prog = await Program.create({
    university: uni._id,
    universityName: "Test University",
    country: "Canada",
    city: "Toronto",
    title: "MSc Computer Science",
    field: "Computer Science",
    degreeLevel: "master",
    tuitionFeeUsd: 20000,
    intakes: ["September", "January"],
    minimumIelts: 6.5,
  });
  programId = prog._id.toString();

  // Register and log in a student
  const regRes = await request(app).post("/api/auth/register").send({
    fullName: "App Tester",
    email: "apptester@waygood.io",
    password: "password123",
    targetCountries: ["Canada"],
    interestedFields: ["Computer Science"],
  });
  token = regRes.body.data.token;
});

afterEach(async () => {
  await Application.deleteMany({});
});

afterAll(async () => {
  await Application.deleteMany({});
  await Program.deleteMany({});
  await University.deleteMany({});
  await Student.deleteMany({});
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

// ──────────────────────────────────────────────
// POST /api/applications
// ──────────────────────────────────────────────
describe("POST /api/applications", () => {
  it("creates an application and returns 201", async () => {
    const res = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ programId, intake: "September" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("draft");
    expect(res.body.data.timeline).toHaveLength(1);
  });

  it("returns 401 without authentication", async () => {
    const res = await request(app)
      .post("/api/applications")
      .send({ programId, intake: "September" });

    expect(res.status).toBe(401);
  });

  it("prevents duplicate applications for same program + intake", async () => {
    await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ programId, intake: "September" });

    const res = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ programId, intake: "September" });

    expect(res.status).toBe(409);
  });

  it("returns 400 for an invalid intake", async () => {
    const res = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ programId, intake: "March" }); // not in intakes array

    expect(res.status).toBe(400);
  });

  it("returns 400 if programId is missing", async () => {
    const res = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ intake: "September" });

    expect(res.status).toBe(400);
  });
});

// ──────────────────────────────────────────────
// PATCH /api/applications/:id/status
// ──────────────────────────────────────────────
describe("PATCH /api/applications/:id/status", () => {
  let appId;

  beforeEach(async () => {
    const res = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ programId, intake: "September" });
    appId = res.body.data._id;
  });

  it("transitions from draft → submitted successfully", async () => {
    const res = await request(app)
      .patch(`/api/applications/${appId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "submitted", note: "Ready to submit" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("submitted");
    expect(res.body.data.timeline).toHaveLength(2);
  });

  it("rejects invalid status transition (draft → enrolled)", async () => {
    const res = await request(app)
      .patch(`/api/applications/${appId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "enrolled" });

    expect(res.status).toBe(400);
  });

  it("rejects update when application belongs to another user", async () => {
    // Register a second user
    const res2 = await request(app).post("/api/auth/register").send({
      fullName: "Other User",
      email: "other@waygood.io",
      password: "password123",
    });
    const otherToken = res2.body.data.token;

    const res = await request(app)
      .patch(`/api/applications/${appId}/status`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ status: "submitted" });

    expect(res.status).toBe(404); // application not found for this user
  });
});

// ──────────────────────────────────────────────
// GET /api/applications
// ──────────────────────────────────────────────
describe("GET /api/applications", () => {
  it("returns only the authenticated user's applications", async () => {
    await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ programId, intake: "September" });

    const res = await request(app)
      .get("/api/applications")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it("filters applications by status", async () => {
    await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ programId, intake: "September" });

    const draftRes = await request(app)
      .get("/api/applications?status=draft")
      .set("Authorization", `Bearer ${token}`);

    expect(draftRes.body.data).toHaveLength(1);

    const submittedRes = await request(app)
      .get("/api/applications?status=submitted")
      .set("Authorization", `Bearer ${token}`);

    expect(submittedRes.body.data).toHaveLength(0);
  });
});
