/**
 * University & Program Discovery API Tests
 */

const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../app");
const University = require("../models/University");
const Program = require("../models/Program");

const TEST_DB = process.env.MONGODB_URI_TEST || "mongodb://127.0.0.1:27017/waygood-test";

beforeAll(async () => {
  await mongoose.connect(TEST_DB);

  await University.insertMany([
    { name: "Alpha University", country: "Canada", city: "Toronto", partnerType: "direct", qsRanking: 100, scholarshipAvailable: true, popularScore: 90 },
    { name: "Beta College", country: "UK", city: "London", partnerType: "direct", qsRanking: 200, scholarshipAvailable: false, popularScore: 80 },
    { name: "Gamma Institute", country: "Australia", city: "Sydney", partnerType: "direct", qsRanking: 150, scholarshipAvailable: true, popularScore: 70 },
  ]);
});

afterAll(async () => {
  await University.deleteMany({});
  await Program.deleteMany({});
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe("GET /api/universities", () => {
  it("returns paginated list of universities", async () => {
    const res = await request(app).get("/api/universities");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toMatchObject({ page: 1 });
  });

  it("filters by country", async () => {
    const res = await request(app).get("/api/universities?country=Canada");

    expect(res.status).toBe(200);
    expect(res.body.data.every((u) => u.country === "Canada")).toBe(true);
  });

  it("filters by scholarshipAvailable=true", async () => {
    const res = await request(app).get("/api/universities?scholarshipAvailable=true");

    expect(res.status).toBe(200);
    expect(res.body.data.every((u) => u.scholarshipAvailable === true)).toBe(true);
  });

  it("supports text search via q parameter", async () => {
    const res = await request(app).get("/api/universities?q=alpha");

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it("respects pagination with page and limit", async () => {
    const res = await request(app).get("/api/universities?page=1&limit=2");

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.meta.limit).toBe(2);
  });

  it("returns total pages in meta", async () => {
    const res = await request(app).get("/api/universities?limit=1");

    expect(res.body.meta.totalPages).toBeGreaterThanOrEqual(1);
  });
});

describe("GET /api/universities/popular", () => {
  it("returns up to 6 popular universities", async () => {
    const res = await request(app).get("/api/universities/popular");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(6);
  });

  it("returns a cache status in meta", async () => {
    await request(app).get("/api/universities/popular"); // warm
    const res = await request(app).get("/api/universities/popular"); // should hit cache

    expect(res.body.meta.cache).toBeDefined();
  });
});
