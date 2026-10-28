const STORAGE_KEY = "myVolunteerListV1";
function normalizeItem(item) {
  if (!item || !item.candidateId || !item.collegeName || !item.targetGroupName) return null;
  return { candidateId: String(item.candidateId), collegeName: item.collegeName, targetGroupName: item.targetGroupName,
    collegeLevel: item.collegeLevel || "本科院校", level: item.level || "稳", subjectRequirement: item.subjectRequirement || "以目录为准",
    referenceRankText: item.referenceRankText || "待核对", majorAcceptance: ["unknown", "selected", "all"].includes(item.majorAcceptance) ? item.majorAcceptance : "unknown", adjustmentIntent: item.adjustmentIntent || "unknown", eligibleMajorNames: item.eligibleMajorNames || [], eligibleMajorCount: item.eligibleMajorCount || 0, matchedMajorText: item.matchedMajorText || "以招生目录为准", addedAt: item.addedAt || new Date().toISOString() };
}
function readList() { try { const value = wx.getStorageSync(STORAGE_KEY); return Array.isArray(value) ? value.map(normalizeItem).filter(Boolean) : []; } catch (error) { return []; } }
function writeList(items) { const normalized = (items || []).map(normalizeItem).filter(Boolean); wx.setStorageSync(STORAGE_KEY, normalized); return normalized; }
function toggleItem(item) { const list = readList(); const index = list.findIndex((entry) => entry.candidateId === item.candidateId); if (index >= 0) { list.splice(index, 1); return { items: writeList(list), saved: false }; } const normalized = normalizeItem(item); if (!normalized) throw new Error("invalid volunteer item"); list.push(normalized); return { items: writeList(list), saved: true }; }
function moveItem(candidateId, delta) { const list = readList(); const index = list.findIndex((entry) => entry.candidateId === candidateId); const next = index + delta; if (index < 0 || next < 0 || next >= list.length) return list; const item = list[index]; list[index] = list[next]; list[next] = item; return writeList(list); }
function setDecision(candidateId, field, value) { const list = readList(); const item = list.find((entry) => entry.candidateId === candidateId); if (!item) return list; if (field === "majorAcceptance" && ["unknown", "selected", "all"].includes(value)) item.majorAcceptance = value; if (field === "adjustmentIntent" && ["unknown", "accept", "reject"].includes(value)) item.adjustmentIntent = value; return writeList(list); }
function removeItem(candidateId) { return writeList(readList().filter((entry) => entry.candidateId !== candidateId)); }
function decorate(items, savedItems) { const savedIds = (savedItems || []).map((entry) => entry.candidateId); return (items || []).map((item, index) => Object.assign({}, item, { saved: savedIds.indexOf(item.candidateId) >= 0, expanded: false, compactRank: index + 1 })); }
module.exports = { STORAGE_KEY, readList, writeList, toggleItem, moveItem, setDecision, removeItem, decorate };
