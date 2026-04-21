const mongoose = require("mongoose");
const Program = require("../models/Program");
const Student = require("../models/Student");
const HttpError = require("../utils/httpError");

/**
 * Build program recommendations using MongoDB Aggregation Pipeline.
 * Scoring weights:
 *  - Country match:      35 pts
 *  - Field match:        30 pts
 *  - Budget fit:         20 pts
 *  - Intake match:       10 pts
 *  - IELTS score meets:   5 pts
 */
async function buildProgramRecommendations(studentId) {
  if (!mongoose.Types.ObjectId.isValid(studentId)) {
    throw new HttpError(400, "Invalid studentId format.");
  }

  const student = await Student.findById(studentId).lean();
  if (!student) {
    throw new HttpError(404, "Student not found.");
  }

  const {
    targetCountries = [],
    interestedFields = [],
    preferredIntake,
    maxBudgetUsd,
    englishTest,
  } = student;

  const ieltsScore = englishTest?.score || 0;

  // Build field regex patterns for partial matching
  const fieldPatterns = interestedFields.map((f) => new RegExp(f, "i"));

  const pipeline = [
    // Stage 1 — Pre-filter: only programs in target countries (index hit)
    {
      $match: {
        ...(targetCountries.length > 0 && { country: { $in: targetCountries } }),
      },
    },

    // Stage 2 — Compute match score using $addFields
    {
      $addFields: {
        countryScore: {
          $cond: [{ $in: ["$country", targetCountries] }, 35, 0],
        },
        fieldScore: {
          $cond: [
            {
              $gt: [
                {
                  $size: {
                    $filter: {
                      input: fieldPatterns.map((r) => r.source),
                      as: "pat",
                      cond: {
                        $regexMatch: {
                          input: "$field",
                          regex: "$$pat",
                          options: "i",
                        },
                      },
                    },
                  },
                },
                0,
              ],
            },
            30,
            0,
          ],
        },
        budgetScore: {
          $cond: [
            maxBudgetUsd != null
              ? { $lte: ["$tuitionFeeUsd", maxBudgetUsd] }
              : { $literal: false },
            20,
            0,
          ],
        },
        intakeScore: {
          $cond: [
            preferredIntake
              ? { $in: [preferredIntake, "$intakes"] }
              : { $literal: false },
            10,
            0,
          ],
        },
        ieltsScore: {
          $cond: [{ $gte: [ieltsScore, "$minimumIelts"] }, 5, 0],
        },
      },
    },

    // Stage 3 — Sum into matchScore
    {
      $addFields: {
        matchScore: {
          $add: [
            "$countryScore",
            "$fieldScore",
            "$budgetScore",
            "$intakeScore",
            "$ieltsScore",
          ],
        },
      },
    },

    // Stage 4 — Only return programs with at least some relevance
    { $match: { matchScore: { $gt: 0 } } },

    // Stage 5 — Sort by score desc, then tuition asc as tiebreaker
    { $sort: { matchScore: -1, tuitionFeeUsd: 1 } },

    // Stage 6 — Top 8 results
    { $limit: 8 },

    // Stage 7 — Lookup university details
    {
      $lookup: {
        from: "universities",
        localField: "university",
        foreignField: "_id",
        as: "universityDetails",
      },
    },
    { $unwind: { path: "$universityDetails", preserveNullAndEmpty: true } },

    // Stage 8 — Shape final output
    {
      $project: {
        _id: 1,
        title: 1,
        field: 1,
        degreeLevel: 1,
        tuitionFeeUsd: 1,
        intakes: 1,
        minimumIelts: 1,
        durationMonths: 1,
        scholarshipAvailable: 1,
        stem: 1,
        country: 1,
        city: 1,
        universityName: 1,
        matchScore: 1,
        scoreBreakdown: {
          country: "$countryScore",
          field: "$fieldScore",
          budget: "$budgetScore",
          intake: "$intakeScore",
          ielts: "$ieltsScore",
        },
        university: {
          _id: "$universityDetails._id",
          name: "$universityDetails.name",
          qsRanking: "$universityDetails.qsRanking",
          websiteUrl: "$universityDetails.websiteUrl",
        },
      },
    },
  ];

  const recommendations = await Program.aggregate(pipeline);

  return {
    data: {
      student: {
        id: student._id,
        fullName: student.fullName,
        targetCountries,
        interestedFields,
        preferredIntake,
        maxBudgetUsd,
        ieltsScore,
      },
      recommendations,
      totalMatches: recommendations.length,
    },
    meta: {
      implementationStatus: "mongodb-aggregation-pipeline",
      scoringWeights: {
        countryMatch: 35,
        fieldMatch: 30,
        budgetFit: 20,
        intakeMatch: 10,
        ieltsMet: 5,
      },
    },
  };
}

module.exports = { buildProgramRecommendations };
