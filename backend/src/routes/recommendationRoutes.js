const express = require("express");
const { getRecommendations } = require("../controllers/recommendationController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// GET /api/recommendations/me  — recommendations for the logged-in student
router.get("/me", requireAuth, getRecommendations);

// GET /api/recommendations/:studentId  — for counselor use
router.get("/:studentId", requireAuth, getRecommendations);

module.exports = router;
