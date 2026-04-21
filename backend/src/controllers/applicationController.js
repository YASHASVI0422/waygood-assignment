const Application = require("../models/Application");
const Program = require("../models/Program");
const asyncHandler = require("../utils/asyncHandler");
const HttpError = require("../utils/httpError");
const { validStatusTransitions } = require("../config/constants");

const listApplications = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const filters = { student: req.user._id };

  if (status) {
    filters.status = status;
  }

  const pageNumber = Math.max(Number(page), 1);
  const pageSize = Math.min(Math.max(Number(limit), 1), 50);

  const [applications, total] = await Promise.all([
    Application.find(filters)
      .populate("program", "title degreeLevel tuitionFeeUsd field intakes")
      .populate("university", "name country city qsRanking")
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Application.countDocuments(filters),
  ]);

  res.json({
    success: true,
    data: applications,
    meta: {
      page: pageNumber,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

const createApplication = asyncHandler(async (req, res) => {
  const { programId, intake } = req.body;

  if (!programId || !intake) {
    throw new HttpError(400, "programId and intake are required.");
  }

  const program = await Program.findById(programId).lean();
  if (!program) {
    throw new HttpError(404, "Program not found.");
  }

  if (!program.intakes.includes(intake)) {
    throw new HttpError(400, `Intake '${intake}' is not available for this program. Available: ${program.intakes.join(", ")}`);
  }

  // Prevent duplicate applications
  const existing = await Application.findOne({
    student: req.user._id,
    program: programId,
    intake,
  });
  if (existing) {
    throw new HttpError(409, "You have already applied to this program for the selected intake.");
  }

  const application = await Application.create({
    student: req.user._id,
    program: programId,
    university: program.university,
    destinationCountry: program.country,
    intake,
    status: "draft",
    timeline: [{ status: "draft", note: "Application created." }],
  });

  await application.populate([
    { path: "program", select: "title degreeLevel tuitionFeeUsd field" },
    { path: "university", select: "name country city" },
  ]);

  res.status(201).json({
    success: true,
    data: application,
  });
});

const updateApplicationStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body;

  if (!status) {
    throw new HttpError(400, "status is required.");
  }

  const application = await Application.findOne({
    _id: id,
    student: req.user._id,
  });

  if (!application) {
    throw new HttpError(404, "Application not found.");
  }

  const allowedNext = validStatusTransitions[application.status];
  if (!allowedNext || !allowedNext.includes(status)) {
    throw new HttpError(
      400,
      `Cannot transition from '${application.status}' to '${status}'. Allowed next states: [${allowedNext?.join(", ") || "none"}]`
    );
  }

  application.status = status;
  application.timeline.push({
    status,
    note: note || `Status updated to ${status}.`,
    changedAt: new Date(),
  });

  await application.save();

  res.json({
    success: true,
    data: application,
  });
});

const getApplicationById = asyncHandler(async (req, res) => {
  const application = await Application.findOne({
    _id: req.params.id,
    student: req.user._id,
  })
    .populate("program", "title degreeLevel tuitionFeeUsd field intakes durationMonths")
    .populate("university", "name country city qsRanking websiteUrl")
    .lean();

  if (!application) {
    throw new HttpError(404, "Application not found.");
  }

  res.json({ success: true, data: application });
});

module.exports = {
  createApplication,
  listApplications,
  updateApplicationStatus,
  getApplicationById,
};
