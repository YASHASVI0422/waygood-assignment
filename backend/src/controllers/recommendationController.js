const asyncHandler = require("../utils/asyncHandler");
const cacheService = require("../services/cacheService");
const { buildProgramRecommendations } = require("../services/recommendationService");

const getRecommendations = asyncHandler(async (req, res) => {
  const studentId = req.params.studentId || req.user._id.toString();
  const cacheKey = `recommendations:${studentId}`;

  const cached = cacheService.get(cacheKey);
  if (cached) {
    return res.json({ success: true, ...cached, meta: { ...cached.meta, cache: "hit" } });
  }

  const payload = await buildProgramRecommendations(studentId);

  // Cache for 5 minutes (profile doesn't change that often)
  cacheService.set(cacheKey, payload, 300);

  res.json({
    success: true,
    ...payload,
    meta: { ...payload.meta, cache: "miss" },
  });
});

module.exports = { getRecommendations };
