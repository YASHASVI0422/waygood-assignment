const express = require("express");
const {
  createApplication,
  listApplications,
  updateApplicationStatus,
  getApplicationById,
} = require("../controllers/applicationController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// All application routes require authentication
router.use(requireAuth);

router.get("/", listApplications);
router.post("/", createApplication);
router.get("/:id", getApplicationById);
router.patch("/:id/status", updateApplicationStatus);

module.exports = router;
