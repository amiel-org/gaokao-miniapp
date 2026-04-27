const districtOptions = [
  "东城区",
  "西城区",
  "朝阳区",
  "海淀区",
  "丰台区",
  "石景山区",
  "通州区",
  "大兴区",
];

const rankingBasisLabels = {
  same_track: "同类选科排名",
  full_grade: "全年级排名",
  unknown: "不确定口径",
};

function entityTypeLabel(entityType) {
  if (entityType === "branch_school") return "分校";
  if (entityType === "campus") return "校区";
  if (entityType === "co_branded_school") return "合作校";
  return "主校";
}

module.exports = {
  districtOptions,
  rankingBasisLabels,
  entityTypeLabel,
};
