const CURRENT_POSITION_SCHEMA_VERSION = 2;

function isCurrentPositionPayload(payload) {
  return !!(
    payload
    && payload.schemaVersion === CURRENT_POSITION_SCHEMA_VERSION
    && payload.input
    && payload.input.subjectCombination
    && payload.result
    && payload.result.minRank
    && payload.result.maxRank
    && payload.result.positionSource
  );
}

function removeStalePositionPayload() {
  if (typeof wx !== "undefined" && wx.removeStorageSync) {
    try {
      wx.removeStorageSync("latestPositionResult");
    } catch (error) {
      // Storage cleanup failure should not prevent the page from showing an empty state.
    }
  }
}

module.exports = {
  CURRENT_POSITION_SCHEMA_VERSION,
  isCurrentPositionPayload,
  removeStalePositionPayload,
};
