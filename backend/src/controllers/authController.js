const jwt = require("jsonwebtoken");
const asyncHandler = require("../utils/asyncHandler");
const HttpError = require("../utils/httpError");
const Student = require("../models/Student");
const env = require("../config/env");

function signToken(userId) {
  return jwt.sign({ sub: userId }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

const register = asyncHandler(async (req, res) => {
  const {
    fullName,
    email,
    password,
    targetCountries,
    interestedFields,
    preferredIntake,
    maxBudgetUsd,
    englishTest,
  } = req.body;

  if (!fullName || !email || !password) {
    throw new HttpError(400, "fullName, email, and password are required.");
  }

  if (password.length < 8) {
    throw new HttpError(400, "Password must be at least 8 characters.");
  }

  const existing = await Student.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    throw new HttpError(409, "An account with this email already exists.");
  }

  const student = await Student.create({
    fullName,
    email,
    password,
    targetCountries: targetCountries || [],
    interestedFields: interestedFields || [],
    preferredIntake: preferredIntake || null,
    maxBudgetUsd: maxBudgetUsd || null,
    englishTest: englishTest || { exam: "IELTS", score: 0 },
    profileComplete: !!(targetCountries?.length && interestedFields?.length && maxBudgetUsd),
  });

  const token = signToken(student._id);

  res.status(201).json({
    success: true,
    data: {
      token,
      student: {
        id: student._id,
        fullName: student.fullName,
        email: student.email,
        role: student.role,
        profileComplete: student.profileComplete,
      },
    },
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new HttpError(400, "email and password are required.");
  }

  const student = await Student.findOne({ email: email.toLowerCase().trim() });
  if (!student) {
    throw new HttpError(401, "Invalid email or password.");
  }

  const isMatch = await student.comparePassword(password);
  if (!isMatch) {
    throw new HttpError(401, "Invalid email or password.");
  }

  const token = signToken(student._id);

  res.json({
    success: true,
    data: {
      token,
      student: {
        id: student._id,
        fullName: student.fullName,
        email: student.email,
        role: student.role,
        profileComplete: student.profileComplete,
      },
    },
  });
});

const me = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      student: req.user,
    },
  });
});

module.exports = { register, login, me };
