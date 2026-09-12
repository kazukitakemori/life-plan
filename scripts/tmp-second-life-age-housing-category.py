from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'missing target {label} in {path}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')

# 1. State model: one global second-life start age, separate housing action age,
#    and an explicit no-change option for staying in the current home.
replace_once(
    'src/types/secondLife.ts',
    "export type SecondLifeStayOption = 'renovate' | 'purchase_rebuild';",
    "export type SecondLifeStayOption = 'continue' | 'renovate' | 'purchase_rebuild';",
    'stay option continue',
)
replace_once(
    'src/types/secondLife.ts',
    "export interface SecondLifeQ3ApplySnapshot {\n  startAge: number;",
    "export interface SecondLifeQ3ApplySnapshot {\n  startAge: number;\n  /** 住まいを実際に変更・リフォームする世帯主年齢 */\n  housingActionAge: number;",
    'q3 housing action age',
)
replace_once(
    'src/types/secondLife.ts',
    "export interface SecondLifeDesignSnapshot {\n  priority: SecondLifePriority;\n  startAge: number;",
    "export interface SecondLifeDesignSnapshot {\n  priority: SecondLifePriority;\n  /** セカンドライフ全体の開始年齢。Q12でのみ編集する */\n  startAge: number;\n  /** 住まいを実際に変更・リフォームする世帯主年齢 */\n  housingActionAge: number;",
    'design housing action age',
)

# 2. Defaults / migration.
replace_once(
    'src/lib/secondLifeDefaults.ts',
    "    startAge: SECOND_LIFE_DEFAULT_START_AGE,\n\n    housingSkip: false,\n\n    housingScenario: 'stay',\n\n    stayOption: 'renovate',",
    "    startAge: SECOND_LIFE_DEFAULT_START_AGE,\n\n    housingActionAge: SECOND_LIFE_DEFAULT_START_AGE,\n\n    housingSkip: false,\n\n    housingScenario: 'stay',\n\n    stayOption: 'continue',",
    'default action age and continue',
)
replace_once(
    'src/lib/secondLifeDefaults.ts',
    "  return {\n\n    ...defaults,\n\n    ...rest,\n\n    startAge:\n\n      typeof value.startAge === 'number' && value.startAge >= 60\n\n        ? value.startAge\n\n        : defaults.startAge,\n\n    nursingByTarget,",
    "  const startAge =\n    typeof value.startAge === 'number' && value.startAge >= 60\n      ? value.startAge\n      : defaults.startAge;\n\n  const housingActionAge =\n    typeof value.housingActionAge === 'number' && value.housingActionAge >= startAge\n      ? value.housingActionAge\n      : startAge;\n\n  return {\n\n    ...defaults,\n\n    ...rest,\n\n    startAge,\n\n    housingActionAge,\n\n    nursingByTarget,",
    'migrate action age',
)

# 3. Labels/template kind.
replace_once(
    'src/lib/secondLifeLabels.ts',
    "    case 'stay':\n      return state.stayOption === 'renovate'\n        ? '現在の住宅をリフォーム'\n        : '住宅購入・建て替え';",
    "    case 'stay':\n      if (state.stayOption === 'continue') return '現在の住まいをそのまま継続';\n      return state.stayOption === 'renovate'\n        ? '現在の住宅をリフォーム'\n        : '住宅購入・建て替え';",
    'stay label continue',
)
replace_once(
    'src/lib/secondLifeLabels.ts',
    "export type SecondLifeHousingTemplateKind =\n  | 'skip'\n  | 'rent'",
    "export type SecondLifeHousingTemplateKind =\n  | 'skip'\n  | 'stay'\n  | 'rent'",
    'template stay kind',
)
replace_once(
    'src/lib/secondLifeLabels.ts',
    "  if (state.housingSkip) return 'skip';\n  if (isSecondLifeRentalHousingDesign(state)) return 'rent';",
    "  if (state.housingSkip) return 'skip';\n  if (state.housingScenario === 'stay' && state.stayOption === 'continue') {\n    return 'stay';\n  }\n  if (isSecondLifeRentalHousingDesign(state)) return 'rent';",
    'resolve stay kind',
)
replace_once(
    'src/lib/secondLifeLabels.ts',
    "  return option === 'renovate'\n    ? '現在の住宅をリフォーム'\n    : '住宅購入・建て替え';",
    "  if (option === 'continue') return '現在の住まいをそのまま継続';\n  return option === 'renovate'\n    ? '現在の住宅をリフォーム'\n    : '住宅購入・建て替え';",
    'stay option label',
)

# 4. Housing estimates: continuing current home has no extra one-time housing cost.
replace_once(
    'src/lib/secondLifeEstimates.ts',
    "  if (scenario === 'stay') {\n    return stayOption === 'renovate'\n      ? RENOVATE_CURRENT_HOME_MAN\n      : PURCHASE_REBUILD_MAN;\n  }",
    "  if (scenario === 'stay') {\n    if (stayOption === 'continue') return 0;\n    return stayOption === 'renovate'\n      ? RENOVATE_CURRENT_HOME_MAN\n      : PURCHASE_REBUILD_MAN;\n  }",
    'estimate continue',
)

# 5. Q12 housing UI: remove duplicate global start age and add separate action timing.
p = Path('src/components/secondLife/SecondLifeHousingSection.tsx')
text = p.read_text(encoding='utf-8')
text = text.replace("import { SECOND_LIFE_SKIP_LABEL } from '../../lib/secondLifeLabels';", "import {\n  getSecondLifeHousingTemplateKind,\n  SECOND_LIFE_SKIP_LABEL,\n} from '../../lib/secondLifeLabels';", 1)
text = text.replace("import { SecondLifeStartAgeField } from './SecondLifeStartAgeField';\n", '', 1)
text = text.replace(
    "  const total = estimateSecondLifeHousingTotalMan(state);\n  const placeholder = state.housingSkip;",
    "  const total = estimateSecondLifeHousingTotalMan(state);\n  const placeholder = state.housingSkip;\n  const housingKind = getSecondLifeHousingTemplateKind(state);\n  const hasHousingAction = housingKind !== 'stay' && housingKind !== 'skip';",
    1,
)
old_toolbar = '''      <div className="second-life-section-toolbar">\n        <SecondLifeStartAgeField\n          value={state.startAge}\n          onChange={(startAge) => onChange({ startAge })}\n        />\n      </div>\n\n'''
if old_toolbar not in text:
    raise SystemExit('missing housing duplicate start age toolbar')
text = text.replace(old_toolbar, '', 1)
skip_end = '''        {SECOND_LIFE_SKIP_LABEL}\n      </label>\n\n'''
insert = '''        {SECOND_LIFE_SKIP_LABEL}\n      </label>\n\n      {!placeholder ? (\n        <div className="second-life-section-toolbar">\n          <p className="second-life-apply-note">\n            セカンドライフ開始：{state.startAge}歳（開始年齢はこのページ上部で変更）\n          </p>\n          {hasHousingAction ? (\n            <label className="second-life-timing">\n              <span>住まいを変える年齢（世帯主）</span>\n              <input\n                type="number"\n                className="second-life-age-input"\n                min={state.startAge}\n                max={110}\n                value={state.housingActionAge}\n                onChange={(event) =>\n                  onChange({\n                    housingActionAge: Math.max(\n                      state.startAge,\n                      Number(event.target.value) || state.startAge,\n                    ),\n                  })\n                }\n              />\n              <span>歳</span>\n            </label>\n          ) : (\n            <p className="second-life-apply-note">\n              今の住まいをそのまま継続するため、住まい変更年齢の入力は不要です。\n            </p>\n          )}\n        </div>\n      ) : null}\n\n'''
if skip_end not in text:
    raise SystemExit('missing housing skip block')
text = text.replace(skip_end, insert, 1)
stay_marker = '''                  {scenario.id === 'stay' ? (\n                    <>\n                      <label className="second-life-inline-option">\n                        <input\n                          type="radio"\n                          name="second-life-stay"\n                          checked={state.stayOption === 'renovate'}'''
stay_replacement = '''                  {scenario.id === 'stay' ? (\n                    <>\n                      <label className="second-life-inline-option">\n                        <input\n                          type="radio"\n                          name="second-life-stay"\n                          checked={state.stayOption === 'continue'}\n                          onChange={() =>\n                            onChange({\n                              housingScenario: 'stay',\n                              stayOption: 'continue',\n                            })\n                          }\n                        />\n                        今の住まいにそのまま住み続ける\n                      </label>\n                      <label className="second-life-inline-option">\n                        <input\n                          type="radio"\n                          name="second-life-stay"\n                          checked={state.stayOption === 'renovate'}'''
if stay_marker not in text:
    raise SystemExit('missing stay option marker')
text = text.replace(stay_marker, stay_replacement, 1)
p.write_text(text, encoding='utf-8')

# 6. Q12 living UI: remove duplicate global start-age input and display the single source read-only.
p = Path('src/components/secondLife/SecondLifeLivingSection.tsx')
text = p.read_text(encoding='utf-8')
text = text.replace("import { SecondLifeStartAgeField } from './SecondLifeStartAgeField';\n", '', 1)
old_toolbar = '''      <div className="second-life-section-toolbar">\n        <SecondLifeStartAgeField\n          value={state.startAge}\n          onChange={(startAge) => onChange({ startAge })}\n        />\n      </div>\n\n'''
if old_toolbar not in text:
    raise SystemExit('missing living duplicate start age toolbar')
text = text.replace(
    old_toolbar,
    '''      <div className="second-life-section-toolbar">\n        <p className="second-life-apply-note">\n          生活水準の変更は、ページ上部のセカンドライフ開始 {state.startAge}歳から反映します。\n        </p>\n      </div>\n\n''',
    1,
)
p.write_text(text, encoding='utf-8')

# 7. Top start age is the single editor; changing it never leaves housing action before start.
p = Path('src/components/secondLife/SecondLifeGuideStep.tsx')
text = p.read_text(encoding='utf-8')
old = '''            onChange={(event) =>\n              onSecondLifeChange({\n                ...secondLifeState,\n                startAge:\n                  Number(event.target.value) || SECOND_LIFE_DEFAULT_START_AGE,\n              })\n            }'''
new = '''            onChange={(event) => {\n              const startAge =\n                Number(event.target.value) || SECOND_LIFE_DEFAULT_START_AGE;\n              onSecondLifeChange({\n                ...secondLifeState,\n                startAge,\n                housingActionAge: Math.max(\n                  startAge,\n                  secondLifeState.housingActionAge ?? startAge,\n                ),\n              });\n            }}'''
if old not in text:
    raise SystemExit('missing Q12 top start age handler')
text = text.replace(old, new, 1)
p.write_text(text, encoding='utf-8')

# 8. Apply snapshot includes housing-specific timing.
replace_once(
    'src/lib/secondLifeApplyStatus.ts',
    "    startAge: state.startAge,\n    housingSkip: state.housingSkip,",
    "    startAge: state.startAge,\n    housingActionAge: state.housingActionAge,\n    housingSkip: state.housingSkip,",
    'snapshot action age',
)

# 9. Housing consistency uses the housing action age when an action exists.
p = Path('src/lib/secondLifeHousingConsistency.ts')
text = p.read_text(encoding='utf-8')
text = text.replace(
    "  const startAge = secondLifeState.startAge;",
    "  const startAge =\n    secondLifeState.housingScenario === 'stay' &&\n    secondLifeState.stayOption === 'continue'\n      ? secondLifeState.startAge\n      : secondLifeState.housingActionAge;",
    1,
)
text = text.replace(
    "  if (secondLifeState.housingScenario === 'stay') {\n    if (secondLifeState.stayOption === 'purchase_rebuild') {",
    "  if (secondLifeState.housingScenario === 'stay') {\n    if (secondLifeState.stayOption === 'continue') {\n      if (activeHousing.length === 0) {\n        return {\n          status: 'missing',\n          title: `${secondLifeState.startAge}歳時点の住まいが未設定です`,\n          summary: '今の住まいをそのまま継続する計画ですが、セカンドライフ開始時点の住まいが見つかりません。',\n          detailLines: [],\n        };\n      }\n      return {\n        status: 'aligned',\n        title: '現在の住まいをそのまま継続できます',\n        summary: `${secondLifeState.startAge}歳からセカンドライフを始めても、住まいの変更は発生しません。`,\n        detailLines: activeHousing.map(formatHousingPeriod),\n      };\n    }\n\n    if (secondLifeState.stayOption === 'purchase_rebuild') {",
    1,
)
# The old generic stay aligned branch now only applies to renovate, so make wording action-specific.
text = text.replace(
    "      title: '現在の住まいをそのまま継続できます',\n      summary: `${startAge}歳からセカンドライフを始めても、住み替えは発生しません。`,",
    "      title: '現在の住まいにリフォーム費を反映できます',\n      summary: `${startAge}歳に現在の持ち家をリフォームする計画です。住み替えは発生しません。`,",
    1,
)
text = text.replace('セカンドライフ計画を優先すると、現在の住まいを${previousMonthLabel(startAge)}で終了し', '住まい計画を優先すると、現在の住まいを${previousMonthLabel(startAge)}で終了し', 1)
p.write_text(text, encoding='utf-8')

# 10. Housing application uses housingActionAge and never creates a generic life-event housing expense.
p = Path('src/lib/secondLifeTemplates.ts')
text = p.read_text(encoding='utf-8')
text = text.replace('  const startAge = input.secondLifeState.startAge;', '  const startAge = input.secondLifeState.housingActionAge;', 1)
text = text.replace("  if (kind === 'skip') {", "  if (kind === 'skip' || kind === 'stay') {", 1)
p.write_text(text, encoding='utf-8')

p = Path('src/lib/secondLifeApply.ts')
text = p.read_text(encoding='utf-8')
text = text.replace('  estimateSecondLifeHousingTotalMan,\n', '', 1)
old = '''export function applySecondLifeHousing(\n  lifeEventState: LifeEventState,\n  secondLifeState: SecondLifeState,\n  head: FamilyMember | undefined,\n  referenceMonth: number,\n): LifeEventState {\n  if (!head || secondLifeState.housingSkip) {\n    return lifeEventState;\n  }\n\n  const total = estimateSecondLifeHousingTotalMan(secondLifeState);\n  return upsertOneTimeLifeEvent(\n    lifeEventState,\n    head,\n    referenceMonth,\n    SECOND_LIFE_HOUSING_EVENT_LABEL,\n    'second_life_housing',\n    secondLifeState.startAge,\n    total ?? 0,\n  );\n}'''
new = '''export function applySecondLifeHousing(\n  lifeEventState: LifeEventState,\n  _secondLifeState: SecondLifeState,\n  head: FamilyMember | undefined,\n  referenceMonth: number,\n): LifeEventState {\n  if (!head) return lifeEventState;\n\n  // 住まい関連費用は Q5 / housingState を唯一の計算元にする。\n  // 旧バージョンで作成した「セカンドライフ住まい」ライフイベントだけを削除する。\n  return upsertOneTimeLifeEvent(\n    lifeEventState,\n    head,\n    referenceMonth,\n    SECOND_LIFE_HOUSING_EVENT_LABEL,\n    'second_life_housing',\n    0,\n    0,\n  );\n}'''
if old not in text:
    raise SystemExit('missing applySecondLifeHousing body')
text = text.replace(old, new, 1)
p.write_text(text, encoding='utf-8')

# 11. Summary wording and exhaustive stay-kind handling.
p = Path('src/lib/secondLifeHousingApplySummary.ts')
text = p.read_text(encoding='utf-8')
text = text.replace(
    "    lines.push('転居のため、既存の住まいを開始年齢の直前で終了します');",
    "    lines.push('転居のため、既存の住まいを住まい変更年齢の直前で終了します');",
    1,
)
text = text.replace(
    "    case 'rent':",
    "    case 'stay':\n      lines.push('現在の住まいをそのまま継続します');\n      break;\n    case 'rent':",
    1,
)
text = text.replace("    | 'startAge'\n", "    | 'startAge'\n    | 'housingActionAge'\n", 1)
text = text.replace(
    "      `${names}はセカンドライフ開始後も続く住まい設定です。今回の転居計画を優先すると、${formatAgeMonth(end.endAge, end.endMonth)}で終了します。`,",
    "      `${names}は住まい変更年齢以降も続く設定です。今回の転居計画を優先すると、${formatAgeMonth(end.endAge, end.endMonth)}で終了します。`,",
    1,
)
p.write_text(text, encoding='utf-8')

print('second-life timing/category patch applied')
