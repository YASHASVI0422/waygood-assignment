// Minimal test setup — uses in-memory mongoose mock via jest-in-process or
// direct mongoose connection to a test DB if MONGODB_URI_TEST is set.
// For CI, set MONGODB_URI_TEST=mongodb://127.0.0.1:27017/waygood-test

process.env.JWT_SECRET = "test-secret-do-not-use-in-production";
process.env.JWT_EXPIRES_IN = "1h";
process.env.CACHE_TTL_SECONDS = "60";
