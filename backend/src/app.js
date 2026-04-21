const cors = require("cors");
const express = require("express");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const applicationRoutes = require("./routes/applicationRoutes");
const authRoutes = require("./routes/authRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const healthRoutes = require("./routes/healthRoutes");
const programRoutes = require("./routes/programRoutes");
const recommendationRoutes = require("./routes/recommendationRoutes");
const universityRoutes = require("./routes/universityRoutes");
const errorHandler = require("./middleware/errorHandler");
const notFound = require("./middleware/notFound");

const app = express();

// ──────────────────────────────────────────────
// Rate limiters
// ──────────────────────────────────────────────

// Strict limiter for auth endpoints — prevents brute-force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests from this IP. Please try again after 15 minutes.",
  },
});

// General API limiter
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Rate limit exceeded. Please slow down.",
  },
});

// ──────────────────────────────────────────────
// Global middleware
// ──────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use(generalLimiter);

// ──────────────────────────────────────────────
// Routes
// ──────────────────────────────────────────────
app.use("/api/health", healthRoutes);
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/universities", universityRoutes);
app.use("/api/programs", programRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
