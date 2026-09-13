from pathlib import Path


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f'marker not found: {label}')
    return text.replace(old, new, 1)

# ---- Types: port PR #7's explicit "unset" state onto the current Q12 model. ----
p = 'src/types/secondLife.ts'
s = read(p)
s = replace_once(
    s,
    'export interface SecondLifeNursingDesign {\n  skip: boolean;',
    'export interface SecondLifeNursingDesign {\n  /** false はまだ介護の想定を確定していない状態 */\n  configured?: boolean;\n  skip: boolean;',
    'nursing configured type',
)
s = replace_once(
    s,
    'export interface SecondLifeState extends SecondLifeDesignSnapshot {\n  /** 最後に Q3 へ反映した設計（未設定＝一度も反映していない） */',
    'export interface SecondLifeState extends SecondLifeDesignSnapshot {\n  /** false は老後の住まい方をまだ選んでいない状態 */\n  housingConfigured?: boolean;\n  /** false は老後の生活費の扱いをまだ選んでいない状態 */\n  livingConfigured?: boolean;\n  /** 最後に Q3 へ反映した設計（未設定＝一度も反映していない） */',
    'state configured flags',
)
write(p, s)

# ---- Defaults/migration: new plans start unset; existing saved plans remain configured. ----
p = 'src/lib/secondLifeDefaults.ts'
s = read(p)
s = replace_once(
    s,
    '  return {\n    skip: false,\n    scenario: \'home\'',
    '  return {\n    configured: false,\n    skip: false,\n    scenario: \'home\'',
    'nursing default configured false',
)
s = replace_once(
    s,
    '    // 新規プランでは Q5 の原本を優先。ユーザーが「見直す」を選んだ時だけ Q12 を重ねる。\n    housingSkip: true,',
    '    // 新規プランでは選択済みに見せず、明示的に選ぶまで未設定扱い。\n    housingConfigured: false,\n    // 未設定の間は計算上 Q5 の原本をそのまま使う。\n    housingSkip: true,',
    'housing default configured false',
)
s = replace_once(
    s,
    '    // 生活費も同様に、明示的に見直すまでは Q4 の原本を使う。\n    livingSkip: true,',
    '    livingConfigured: false,\n    // 未設定の間は計算上 Q4 の原本をそのまま使う。\n    livingSkip: true,',
    'living default configured false',
)
s = replace_once(
    s,
    '  const head = createDefaultSecondLifeNursingDesign({\n    skip:',
    '  const head = createDefaultSecondLifeNursingDesign({\n    configured: true,\n    skip:',
    'legacy head configured',
)
s = replace_once(
    s,
    '  return {\n    head,\n    spouse: defaults.nursingByTarget.spouse,\n  };',
    '  return {\n    head,\n    // 旧データは従来の状態を壊さないため設定済みとして扱う。\n    spouse: createDefaultSecondLifeNursingDesign({ configured: true }),\n  };',
    'legacy spouse configured',
)
s = replace_once(
    s,
    '  return createDefaultSecondLifeNursingDesign({\n    skip: typeof value.skip === \'boolean\' ? value.skip : fallback.skip,',
    '  return createDefaultSecondLifeNursingDesign({\n    // フラグがない旧データは、既存設定を維持するため設定済みとみなす。\n    configured: typeof value.configured === \'boolean\' ? value.configured : true,\n    skip: typeof value.skip === \'boolean\' ? value.skip : fallback.skip,',
    'migrate nursing configured',
)
s = replace_once(
    s,
    '  const housingSkip =\n    typeof value.housingSkip === \'boolean\'\n      ? value.housingSkip\n      : defaults.housingSkip;\n  const livingSkip =',
    '  const housingConfigured =\n    typeof value.housingConfigured === \'boolean\' ? value.housingConfigured : true;\n  const livingConfigured =\n    typeof value.livingConfigured === \'boolean\' ? value.livingConfigured : true;\n\n  const housingSkip =\n    typeof value.housingSkip === \'boolean\'\n      ? value.housingSkip\n      : defaults.housingSkip;\n  const livingSkip =',
    'migrate configured vars',
)
s = replace_once(
    s,
    '    startAge,\n    housingActionAge,\n    housingSkip,',
    '    startAge,\n    housingActionAge,\n    housingConfigured,\n    livingConfigured,\n    housingSkip,',
    'return configured vars',
)
write(p, s)

# ---- Two-choice mode selector supports an unselected initial state. ----
p = 'src/components/secondLife/SecondLifeModeSelector.tsx'
s = read(p)
s = replace_once(
    s,
    'interface SecondLifeModeSelectorProps {\n  title?: string;\n  useCurrent: boolean;',
    'interface SecondLifeModeSelectorProps {\n  title?: string;\n  /** false のときはどちらの選択肢も選択済みに見せない */\n  configured?: boolean;\n  useCurrent: boolean;',
    'mode configured prop',
)
s = replace_once(
    s,
    'export function SecondLifeModeSelector({\n  title,\n  useCurrent,',
    'export function SecondLifeModeSelector({\n  title,\n  configured = true,\n  useCurrent,',
    'mode configured destructure',
)
s = replace_once(s, '          active={useCurrent}', '          active={configured && useCurrent}', 'mode current active')
s = replace_once(s, '          active={!useCurrent}', '          active={configured && !useCurrent}', 'mode review active')
write(p, s)

# ---- Housing UI: preserve PR #6 UX while porting the explicit unset state from #7. ----
p = 'src/components/secondLife/SecondLifeHousingSection.tsx'
s = read(p)
s = replace_once(
    s,
    '  const total = estimateSecondLifeHousingTotalMan(state);\n  const useCurrentPlan = state.housingSkip;',
    '  const total = estimateSecondLifeHousingTotalMan(state);\n  const configured = state.housingConfigured !== false;\n  const useCurrentPlan = configured && state.housingSkip;',
    'housing configured const',
)
s = replace_once(
    s,
    "    const patch: Partial<SecondLifeState> = { housingSkip: false };",
    "    const patch: Partial<SecondLifeState> = {\n      housingConfigured: true,\n      housingSkip: false,\n    };",
    'housing review configured',
)
s = replace_once(
    s,
    '        title="これからの住まいはどうしますか？"\n        useCurrent={useCurrentPlan}',
    '        title="これからの住まいはどうしますか？"\n        configured={configured}\n        useCurrent={useCurrentPlan}',
    'housing mode configured',
)
s = replace_once(
    s,
    '        onUseCurrent={() => onChange({ housingSkip: true })}',
    '        onUseCurrent={() =>\n          onChange({ housingConfigured: true, housingSkip: true })\n        }',
    'housing current configured',
)
s = replace_once(s, '      {useCurrentPlan ? null : (', '      {!configured || useCurrentPlan ? null : (', 'housing hide until configured')
write(p, s)

# ---- Living UI: unset state + do not present 0万円 as a valid estimate. ----
p = 'src/components/secondLife/SecondLifeLivingSection.tsx'
s = read(p)
s = replace_once(
    s,
    '  const currentMonthly =\n    options.find((option) => option.level === \'same\')?.monthlyMan ?? 0;\n  const useCurrentPlan = state.livingSkip;',
    '  const currentMonthly =\n    options.find((option) => option.level === \'same\')?.monthlyMan ?? 0;\n  const configured = state.livingConfigured !== false;\n  const useCurrentPlan = configured && state.livingSkip;\n  const hasLivingBase = currentMonthly > 0;',
    'living configured const',
)
s = replace_once(
    s,
    '        title={`${state.startAge}歳以降の生活費はどうしますか？`}\n        useCurrent={useCurrentPlan}',
    '        title={`${state.startAge}歳以降の生活費はどうしますか？`}\n        configured={configured}\n        useCurrent={useCurrentPlan}',
    'living mode configured',
)
s = replace_once(
    s,
    '        onUseCurrent={() => onChange({ livingSkip: true })}\n        onReview={() => onChange({ livingSkip: false })}',
    '        onUseCurrent={() =>\n          onChange({ livingConfigured: true, livingSkip: true })\n        }\n        onReview={() =>\n          onChange({ livingConfigured: true, livingSkip: false })\n        }',
    'living callbacks configured',
)
s = replace_once(s, '      {useCurrentPlan ? null : (', '      {!configured || useCurrentPlan ? null : (', 'living hide until configured')
s = replace_once(
    s,
    '              基準となる現在の生活費：月{formatSecondLifeMan(currentMonthly)}万円。{state.startAge}歳以降の生活費を下から選んでください。',
    "              {hasLivingBase\n                ? `基準となる現在の生活費：月${formatSecondLifeMan(currentMonthly)}万円。${state.startAge}歳以降の生活費を下から選んでください。`\n                : '現在の生活費が未入力です。Q4「生活費」を入力すると、老後の生活費を試算できます。'}",
    'living zero guidance',
)
s = replace_once(
    s,
    "                    月々 <strong>{formatSecondLifeMan(option.monthlyMan)}</strong>{' '}\n                    万円",
    "                    月々{' '}\n                    {option.monthlyMan > 0 ? (\n                      <>\n                        <strong>{formatSecondLifeMan(option.monthlyMan)}</strong>{' '}\n                        万円\n                      </>\n                    ) : (\n                      <strong>未設定</strong>\n                    )}",
    'living unset amount display',
)
s = replace_once(
    s,
    "                      <p className=\"second-life-breakdown-empty\">内訳なし</p>",
    "                      <p className=\"second-life-breakdown-empty\">\n                        {option.monthlyMan > 0\n                          ? '内訳なし'\n                          : '現在の生活費を入力すると計算されます'}\n                      </p>",
    'living empty breakdown',
)
write(p, s)

# ---- Calculation layer: an unconfigured Q12 item must never affect cash flow. ----
p = 'src/lib/secondLifeCalculationOverlay.ts'
s = read(p)
s = replace_once(
    s,
    "import type { SecondLifeState } from '../types/secondLife';\n",
    "import type { SecondLifeState } from '../types/secondLife';\nimport { getPreSecondLifeMonthlyLivingMan } from './secondLifeEstimates';\n",
    'overlay living helper import',
)
s = replace_once(
    s,
    '  const housingState =\n    input.secondLifeState.housingSkip || !head',
    '  const housingState =\n    input.secondLifeState.housingConfigured === false ||\n    input.secondLifeState.housingSkip ||\n    !head',
    'overlay housing configured guard',
)
s = replace_once(
    s,
    "  const livingState = input.secondLifeState.livingSkip\n    ? input.livingState\n    : applySecondLifeLivingDesign({",
    "  const livingBaseMonthly = getPreSecondLifeMonthlyLivingMan({\n    livingState: input.livingState,\n    familyMembers: input.familyMembers,\n    referenceDate: input.referenceDate,\n    startAge: input.secondLifeState.startAge,\n  });\n\n  const livingState =\n    input.secondLifeState.livingConfigured === false ||\n    input.secondLifeState.livingSkip ||\n    livingBaseMonthly <= 0\n      ? input.livingState\n      : applySecondLifeLivingDesign({",
    'overlay living guards',
)
s = replace_once(
    s,
    '        referenceDate: input.referenceDate,\n      });\n\n  return { housingState, livingState };',
    '          referenceDate: input.referenceDate,\n        });\n\n  return { housingState, livingState };',
    'overlay indentation',
)
write(p, s)

# ---- Summary labels: unconfigured must read as 未設定 rather than a chosen plan. ----
p = 'src/lib/secondLifeLabels.ts'
s = read(p)
s = replace_once(
    s,
    "    | 'housingSkip'\n    | 'housingScenario'",
    "    | 'housingConfigured'\n    | 'housingSkip'\n    | 'housingScenario'",
    'housing summary pick configured',
)
s = replace_once(
    s,
    '): string {\n  if (state.housingSkip) {',
    "): string {\n  if (state.housingConfigured === false) return '未設定';\n  if (state.housingSkip) {",
    'housing summary unset',
)
s = replace_once(
    s,
    "  state: Pick<SecondLifeState, 'livingSkip' | 'livingLevel'>,",
    "  state: Pick<SecondLifeState, 'livingConfigured' | 'livingSkip' | 'livingLevel'>,",
    'living summary pick configured',
)
s = replace_once(
    s,
    '): string {\n  if (state.livingSkip) {',
    "): string {\n  if (state.livingConfigured === false) return '未設定';\n  if (state.livingSkip) {",
    'living summary unset',
)
write(p, s)

# ---- Third-life UI: explicit unset state from PR #7, adapted to the detailed care model. ----
p = 'src/components/secondLife/SecondLifeNursingSection.tsx'
s = read(p)
s = replace_once(
    s,
    '        [target]: {\n          ...state.nursingByTarget[target],\n          ...patch,',
    '        [target]: {\n          ...state.nursingByTarget[target],\n          configured: true,\n          ...patch,',
    'nursing update configures',
)
s = replace_once(
    s,
    '  const hasUnpricedDesign = targets.some(({ key }) => {\n    const design = state.nursingByTarget[key];\n    return (\n      !design.skip &&',
    '  const allConfigured =\n    targets.length > 0 &&\n    targets.every(({ key }) => state.nursingByTarget[key].configured !== false);\n\n  const hasUnpricedDesign = targets.some(({ key }) => {\n    const design = state.nursingByTarget[key];\n    return (\n      design.configured !== false &&\n      !design.skip &&',
    'nursing all configured',
)
s = replace_once(
    s,
    '  const applyMessage = hasUnpricedDesign\n    ? \'介護費を見込む人は、開始時費用または月額追加費用を入力してください。金額が0のままでは反映しません。\'',
    "  const applyMessage = !allConfigured\n    ? '介護の想定が未設定です。本人・配偶者それぞれについて、介護費を見込むかどうかを選んでください。'\n    : hasUnpricedDesign\n      ? '介護費を見込む人は、開始時費用または月額追加費用を入力してください。金額が0のままでは反映しません。'",
    'nursing apply message configured',
)
s = replace_once(
    s,
    '          const design = state.nursingByTarget[key];\n          const scenarioInfo =',
    '          const design = state.nursingByTarget[key];\n          const configured = design.configured !== false;\n          const scenarioInfo =',
    'nursing card configured const',
)
s = replace_once(
    s,
    "                design.skip\n                  ? 'second-life-guide-card second-life-guide-card--missing'\n                  : hasCost",
    "                !configured\n                  ? 'second-life-guide-card second-life-guide-card--missing'\n                  : design.skip\n                    ? 'second-life-guide-card second-life-guide-card--done'\n                    : hasCost",
    'nursing card class',
)
s = replace_once(
    s,
    "                    {design.skip\n                      ? '今回は介護費を見込まない'",
    "                    {!configured\n                      ? '未設定'\n                      : design.skip\n                        ? '今回は介護費を見込まない'",
    'nursing summary unset',
)
s = replace_once(s, '                  checked={design.skip}', '                  checked={configured && design.skip}', 'nursing skip checked')
s = replace_once(
    s,
    "          disabled={applyStatus === 'done' || hasUnpricedDesign}",
    "          disabled={!allConfigured || applyStatus === 'done' || hasUnpricedDesign}",
    'nursing apply disabled',
)
s = replace_once(
    s,
    "          {applyStatus === 'done'\n            ? 'サードライフ設計は反映済み'\n            : 'このサードライフ設計を反映する'}",
    "          {!allConfigured\n            ? '介護の想定を設定してください'\n            : applyStatus === 'done'\n              ? 'サードライフ設計は反映済み'\n              : 'このサードライフ設計を反映する'}",
    'nursing button text',
)
write(p, s)

# ---- Checklist/guide: unconfigured items are shown as 未設定. ----
p = 'src/lib/secondLifeGuide.ts'
s = read(p)
s = replace_once(
    s,
    "      {\n        id: 'housing',\n        stepId: 'housing',\n        stepLabel: '5',\n        title: '住まい',\n        status: 'done',\n        summary: design.housingSkip",
    "      {\n        id: 'housing',\n        stepId: 'housing',\n        stepLabel: '5',\n        title: '住まい',\n        status: design.housingConfigured === false ? 'missing' : 'done',\n        summary: design.housingConfigured === false\n          ? '未設定です'\n          : design.housingSkip",
    'guide housing configured',
)
s = replace_once(
    s,
    "        detailLines: design.housingSkip\n          ? ['現在入力している住まいの期間・費用をそのまま使います。']\n          : ['元の住まい入力は残したまま試算します。'],",
    "        detailLines:\n          design.housingConfigured === false\n            ? []\n            : design.housingSkip\n              ? ['現在入力している住まいの期間・費用をそのまま使います。']\n              : ['元の住まい入力は残したまま試算します。'],",
    'guide housing details',
)
s = replace_once(
    s,
    "      {\n        id: 'living',\n        stepId: 'living',\n        stepLabel: '4',\n        title: '生活水準',\n        status: 'done',\n        summary: design.livingSkip",
    "      {\n        id: 'living',\n        stepId: 'living',\n        stepLabel: '4',\n        title: '生活水準',\n        status: design.livingConfigured === false ? 'missing' : 'done',\n        summary: design.livingConfigured === false\n          ? '未設定です'\n          : design.livingSkip",
    'guide living configured',
)
s = replace_once(
    s,
    "        detailLines: design.livingSkip\n          ? ['現在入力している生活費計画をそのまま使います。']\n          : ['元の生活費入力は残したまま試算します。'],",
    "        detailLines:\n          design.livingConfigured === false\n            ? []\n            : design.livingSkip\n              ? ['現在入力している生活費計画をそのまま使います。']\n              : ['元の生活費入力は残したまま試算します。'],",
    'guide living details',
)
s = replace_once(
    s,
    '    const projections = findNursingProjections(\n      lifeEventState.byMember[member.id] ?? [],\n    );\n\n    if (design.skip) {',
    "    const projections = findNursingProjections(\n      lifeEventState.byMember[member.id] ?? [],\n    );\n\n    if (design.configured === false) {\n      needsCost += 1;\n      detailLines.push(`${getMemberTabLabel(member)}：未設定`);\n      continue;\n    }\n\n    if (design.skip) {",
    'guide nursing unset',
)
write(p, s)

print('Integrated PR #7 semantics onto current Q12 successfully')
