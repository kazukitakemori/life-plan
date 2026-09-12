from pathlib import Path


def rw(path):
    return Path(path).read_text(encoding='utf-8')


def ww(path, text):
    Path(path).write_text(text, encoding='utf-8')


def rep(text, old, new, label):
    if old not in text:
        raise RuntimeError(f'missing marker: {label}')
    return text.replace(old, new, 1)

# Centralize lifespan-safe start/end age.
p = 'src/lib/thirdLifeCare.ts'
s = rw(p)
s = rep(
    s,
    "export function getThirdLifeCareEndAge(\n",
    "export function getThirdLifeCareStartAge(\n  design: Pick<SecondLifeNursingDesign, 'startAge'>,\n  expectedLifespan: number,\n): number {\n  return Math.min(\n    Math.max(60, expectedLifespan),\n    Math.max(60, Math.round(design.startAge || 60)),\n  );\n}\n\nexport function getThirdLifeCareEndAge(\n",
    'start helper',
)
s = rep(
    s,
    "  if (design.durationMode === 'lifetime') return expectedLifespan;\n  const years = Math.max(1, Math.round(design.durationYears ?? 1));\n  return Math.min(expectedLifespan, design.startAge + years - 1);\n",
    "  const startAge = getThirdLifeCareStartAge(design, expectedLifespan);\n  if (design.durationMode === 'lifetime') return Math.max(startAge, expectedLifespan);\n  const years = Math.max(1, Math.round(design.durationYears ?? 1));\n  return Math.min(Math.max(startAge, expectedLifespan), startAge + years - 1);\n",
    'safe end age',
)
ww(p, s)

# Calculation must use the safe age even for legacy/corrupt saved values.
p = 'src/lib/secondLifeApply.ts'
s = rw(p)
s = rep(
    s,
    "  getThirdLifeAnnualAdditionalCostMan,\n  getThirdLifeCareEndAge,\n",
    "  getThirdLifeAnnualAdditionalCostMan,\n  getThirdLifeCareEndAge,\n  getThirdLifeCareStartAge,\n",
    'apply import',
)
s = rep(
    s,
    "  const annualCost = getThirdLifeAnnualAdditionalCostMan(design);\n  const initialCost = Math.max(0, design.initialCostMan);\n",
    "  const annualCost = getThirdLifeAnnualAdditionalCostMan(design);\n  const initialCost = Math.max(0, design.initialCostMan);\n  const startAge = getThirdLifeCareStartAge(design, member.expectedLifespan);\n",
    'apply safe start const',
)
# Only in this function block, next four occurrences.
start = s.index('function upsertSecondLifeNursingEvent(')
end = s.index('\nexport function applySecondLifeNursing', start)
block = s[start:end]
block = block.replace('startAge: design.startAge,', 'startAge,')
block = block.replace('endAge: design.startAge,', 'endAge: startAge,')
s = s[:start] + block + s[end:]
ww(p, s)

# Guide/status comparisons must mirror the calculation guard.
p = 'src/lib/secondLifeGuide.ts'
s = rw(p)
s = rep(
    s,
    "  getThirdLifeCareEndAge,\n",
    "  getThirdLifeCareEndAge,\n  getThirdLifeCareStartAge,\n",
    'guide import',
)
needle = """    const expectedEndAge = getThirdLifeCareEndAge(
      design,
      member.expectedLifespan,
    );
"""
replacement = """    const expectedStartAge = getThirdLifeCareStartAge(
      design,
      member.expectedLifespan,
    );
    const expectedEndAge = getThirdLifeCareEndAge(
      design,
      member.expectedLifespan,
    );
"""
s = rep(s, needle, replacement, 'guide expected start')
# Limit replacements to nursing block after active designs.
start = s.index('function buildNursingChecklistItem(')
end = s.index('\nexport function buildSecondLifeGuide', start)
block = s[start:end]
block = block.replace('projections.recurring.startAge === design.startAge', 'projections.recurring.startAge === expectedStartAge')
block = block.replace('projections.initial.startAge === design.startAge', 'projections.initial.startAge === expectedStartAge')
block = block.replace('`${getMemberTabLabel(member)}：${design.startAge}歳〜 ${THIRD_LIFE_CARE_SCENARIO_LABELS[design.scenario]}・月', '`${getMemberTabLabel(member)}：${expectedStartAge}歳〜 ${THIRD_LIFE_CARE_SCENARIO_LABELS[design.scenario]}・月')
s = s[:start] + block + s[end:]
ww(p, s)

# UI summary/input must display the same effective start age as calculation.
p = 'src/components/secondLife/SecondLifeNursingSection.tsx'
s = rw(p)
s = rep(
    s,
    "  getThirdLifeCareScenarioInfo,\n",
    "  getThirdLifeCareScenarioInfo,\n  getThirdLifeCareStartAge,\n",
    'ui import',
)
s = rep(
    s,
    "          const hasCost = design.initialCostMan > 0 || design.monthlyCostMan > 0;\n          const maxStartAge = Math.max(60, member.expectedLifespan);\n",
    "          const hasCost = design.initialCostMan > 0 || design.monthlyCostMan > 0;\n          const effectiveStartAge = getThirdLifeCareStartAge(\n            design,\n            member.expectedLifespan,\n          );\n          const maxStartAge = Math.max(60, member.expectedLifespan);\n",
    'ui effective start',
)
s = s.replace('${design.startAge}歳〜 ${scenarioInfo.label}', '${effectiveStartAge}歳〜 ${scenarioInfo.label}')
s = s.replace('value={Math.min(design.startAge, maxStartAge)}', 'value={effectiveStartAge}')
s = s.replace('member.expectedLifespan - Math.min(design.startAge, maxStartAge) + 1', 'member.expectedLifespan - effectiveStartAge + 1')
ww(p, s)

print('third-life lifespan guard applied')
