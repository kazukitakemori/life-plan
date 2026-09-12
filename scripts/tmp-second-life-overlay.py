from pathlib import Path
import re


def replace_once(path: str, old: str, new: str, label: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'missing target {label} in {path}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


# App: keep persisted Q4/Q5 states raw, derive calculation-only states for cash flow.
replace_once(
    'src/App.tsx',
    "import {\n  addSecondLifeNursingTemplates,\n  applySecondLifeHousingDesign,\n  applySecondLifeLivingDesign,\n} from './lib/secondLifeTemplates';",
    "import { addSecondLifeNursingTemplates } from './lib/secondLifeTemplates';\nimport { buildSecondLifeCalculationStates } from './lib/secondLifeCalculationOverlay';",
    'App second-life imports',
)

replace_once(
    'src/App.tsx',
    "  const cashFlowInput = useMemo<CashFlowInput>(\n",
    "  const secondLifeCalculationStates = useMemo(\n    () =>\n      buildSecondLifeCalculationStates({\n        housingState,\n        livingState,\n        secondLifeState,\n        familyMembers,\n        incomeByMember,\n        pensionByMember,\n        referenceDate,\n      }),\n    [\n      housingState,\n      livingState,\n      secondLifeState,\n      familyMembers,\n      incomeByMember,\n      pensionByMember,\n      referenceDate,\n    ],\n  );\n\n  const cashFlowInput = useMemo<CashFlowInput>(\n",
    'App calculation overlay memo',
)

replace_once(
    'src/App.tsx',
    "      priorYearIncomeByMember,\n      livingState,\n      housingState,\n      vehicleState,",
    "      priorYearIncomeByMember,\n      livingState: secondLifeCalculationStates.livingState,\n      housingState: secondLifeCalculationStates.housingState,\n      vehicleState,",
    'App cash flow derived states',
)

# This occurrence is now the dependency array, because the object occurrence was replaced above.
replace_once(
    'src/App.tsx',
    "      priorYearIncomeByMember,\n      livingState,\n      housingState,\n      vehicleState,",
    "      priorYearIncomeByMember,\n      livingState,\n      housingState,\n      secondLifeState,\n      secondLifeCalculationStates,\n      vehicleState,",
    'App cash flow deps',
)

p = Path('src/App.tsx')
text = p.read_text(encoding='utf-8')
pattern = re.compile(
    r"\n\s*onApplySecondLifeLiving=\{\(\) => \{.*?\n\s*onApplySecondLifeNursing=",
    re.S,
)
text, count = pattern.subn("\n            onApplySecondLifeNursing=", text, count=1)
if count != 1:
    raise SystemExit('failed to remove Q12 housing/living apply handlers')
p.write_text(text, encoding='utf-8')


# Housing section: design changes automatically affect calculation; no mutation/apply button.
p = Path('src/components/secondLife/SecondLifeHousingSection.tsx')
text = p.read_text(encoding='utf-8')
text = text.replace("  onApply?: () => void;\n", '', 1)
text = text.replace("  onChange,\n  onApply,\n", "  onChange,\n", 1)
old = '''      {!placeholder && onApply ? (\n        <div className="second-life-section-actions">\n          <p className="second-life-apply-note">\n            現在の住まい設定との重なりを確認してから反映します。今の住まいを継続する計画なら終了時期は変更せず、転居する計画なら切替時期を確認できます。\n          </p>\n          <button\n            type="button"\n            className="second-life-apply-btn"\n            onClick={onApply}\n          >\n            住まい計画を確認して反映する\n          </button>\n        </div>\n      ) : null}\n'''
new = '''      <div className="second-life-section-actions">\n        <p className="second-life-apply-note">\n          {placeholder\n            ? 'Q5「住まい」の現在の入力をそのまま計算に使用します。'\n            : 'Q5「住まい」の入力自体は変更せず、該当年齢以降のキャッシュフロー計算だけこの設計を優先します。'}\n        </p>\n      </div>\n'''
if old not in text:
    raise SystemExit('missing housing apply action block')
text = text.replace(old, new, 1)
p.write_text(text, encoding='utf-8')


# Living section: same non-destructive overlay behavior.
p = Path('src/components/secondLife/SecondLifeLivingSection.tsx')
text = p.read_text(encoding='utf-8')
text = text.replace("  onApply?: () => void;\n", '', 1)
text = text.replace("  onChange,\n  onApply,\n", "  onChange,\n", 1)
text = text.replace(
    '生活水準の変更は、ページ上部のセカンドライフ開始 {state.startAge}歳から反映します。',
    '生活水準の変更は、ページ上部のセカンドライフ開始 {state.startAge}歳から計算上だけ優先します。',
    1,
)
old = '''      {!placeholder && onApply ? (\n        <div className="second-life-section-actions">\n          <p className="second-life-apply-note">\n            選択した生活水準で、負担者（世帯主）の生活費スケジュールを開始年齢以降に組み直します（既存の開始前スケジュールは残ります）。\n          </p>\n          <button\n            type="button"\n            className="second-life-apply-btn"\n            onClick={onApply}\n          >\n            この内容を生活費に反映する\n          </button>\n        </div>\n      ) : null}\n'''
new = '''      <div className="second-life-section-actions">\n        <p className="second-life-apply-note">\n          {placeholder\n            ? 'Q4「生活費」の現在の入力をそのまま計算に使用します。'\n            : 'Q4「生活費」の入力自体は変更せず、セカンドライフ開始年齢以降のキャッシュフロー計算だけこの生活水準を優先します。'}\n        </p>\n      </div>\n'''
if old not in text:
    raise SystemExit('missing living apply action block')
text = text.replace(old, new, 1)
p.write_text(text, encoding='utf-8')


# Q12 step: remove housing/living apply plumbing and confirmation modal.
p = Path('src/components/secondLife/SecondLifeGuideStep.tsx')
text = p.read_text(encoding='utf-8')
text = text.replace("import { useMemo, useState } from 'react';", "import { useMemo } from 'react';", 1)
text = re.sub(
    r"import \{\n  formatSecondLifeHousingApplyPreviewLines,\n  getSecondLifeHousingApplyWarnings,\n\} from '../../lib/secondLifeHousingApplySummary';\n",
    '',
    text,
    count=1,
)
text = text.replace("import type { SecondLifeHousingApplyResult } from '../../lib/secondLifeTemplates';\n", '', 1)
text = text.replace("import { HousingSecondLifeApplyConfirmModal } from '../housing/HousingSecondLifeApplyConfirmModal';\n", '', 1)
for line in [
    "  onApplySecondLifeHousing?: () => SecondLifeHousingApplyResult | void;\n",
    "  onPreviewSecondLifeHousing?: () => SecondLifeHousingApplyResult | void;\n",
    "  onApplySecondLifeLiving?: () => void;\n",
]:
    text = text.replace(line, '', 1)
for line in [
    "  onApplySecondLifeHousing,\n",
    "  onPreviewSecondLifeHousing,\n",
    "  onApplySecondLifeLiving,\n",
]:
    text = text.replace(line, '', 1)
text = text.replace("  const [housingConfirmOpen, setHousingConfirmOpen] = useState(false);\n", '', 1)
text = text.replace("  const [housingPreviewLines, setHousingPreviewLines] = useState<string[]>([]);\n", '', 1)
text = text.replace("  const [housingWarnings, setHousingWarnings] = useState<string[]>([]);\n", '', 1)
text, count = re.subn(
    r"\n  const beginHousingApply = \(\) => \{.*?\n  return \(",
    "\n  return (",
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit('failed to remove housing apply modal handlers')
text = text.replace("        onApply={onApplySecondLifeHousing ? beginHousingApply : undefined}\n", '', 1)
text = text.replace("        onApply={onApplySecondLifeLiving}\n", '', 1)
text = text.replace(
    'lead="これからの暮らし方をここで具体化し、住まい・生活費・介護へ反映します"',
    'lead="これからの暮らし方をここで具体化し、元の入力を残したまま計算へ反映します"',
    1,
)
text = text.replace(
    'セカンドライフ開始年齢を基準に、老後の住まい・生活水準・介護をこの画面で設計します。Q4・Q5・Q3は詳細データや反映結果を確認する画面として使います。',
    'セカンドライフ開始年齢を基準に、老後の住まい・生活水準・介護をこの画面で設計します。住まい・生活費はQ4・Q5の元入力を書き換えず、キャッシュフロー計算時だけQ12の設計を優先します。',
    1,
)
text = text.replace('住まいとの整合性', '住まいの計算ルール', 1)
text = text.replace('希望：{getSecondLifeHousingDesignSummary(secondLifeState)}', 'Q12：{getSecondLifeHousingDesignSummary(secondLifeState)}', 1)
text = text.replace('整合性・反映状況', '計算ルール・反映状況', 1)
text = text.replace(
    'Q12で決めた内容が、計算用データへ正しく反映されているか確認できます。',
    '住まい・生活費はQ12の設計を計算時に優先します。チェックを入れた項目はQ4・Q5の現在入力をそのまま使います。',
    1,
)
text, count = re.subn(
    r"\n      <HousingSecondLifeApplyConfirmModal\n        open=\{housingConfirmOpen\}.*?\n      />",
    '',
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit('failed to remove housing confirm modal jsx')
p.write_text(text, encoding='utf-8')


# Guide: when Q12 design exists, report overlay state instead of expecting Q4/Q5 mutation.
p = Path('src/lib/secondLifeGuide.ts')
text = p.read_text(encoding='utf-8')
pattern = re.compile(
    r"export function buildSecondLifeGuide\(input: \{.*?\n\}\n\nexport function getSecondLifeChecklistStatusLabel",
    re.S,
)
replacement = '''export function buildSecondLifeGuide(input: {\n  startAge: number;\n  secondLifeState?: SecondLifeState;\n  familyMembers: FamilyMember[];\n  housingState: HousingState;\n  livingState: LivingExpenseState;\n  lifeEventState: LifeEventState;\n  referenceDate: Date;\n}): SecondLifeGuide {\n  const startAge = input.startAge;\n  const headId = input.familyMembers.find((m) => m.role === 'head')?.id;\n  const design = input.secondLifeState;\n\n  const housingItem: SecondLifeChecklistItem = design\n    ? {\n        id: 'housing',\n        stepId: 'housing',\n        stepLabel: '5',\n        title: '住まい',\n        status: 'done',\n        summary: design.housingSkip\n          ? 'Q5「住まい」の現在入力をそのまま計算に使用します'\n          : design.housingScenario === 'stay' && design.stayOption === 'continue'\n            ? 'Q5の現在の住まいをそのまま継続します'\n            : `${design.housingActionAge}歳からQ12の住まい設計を計算時に優先します`,\n        detailLines: design.housingSkip\n          ? ['Q12による住まいの上書きは無効です。']\n          : ['Q5の住まい入力自体は変更しません。'],\n      }\n    : buildHousingChecklistItem(input.housingState, startAge, headId);\n\n  const livingItem: SecondLifeChecklistItem = design\n    ? {\n        id: 'living',\n        stepId: 'living',\n        stepLabel: '4',\n        title: '生活水準',\n        status: 'done',\n        summary: design.livingSkip\n          ? 'Q4「生活費」の現在入力をそのまま計算に使用します'\n          : `${design.startAge}歳からQ12の生活水準を計算時に優先します`,\n        detailLines: design.livingSkip\n          ? ['Q12による生活費の上書きは無効です。']\n          : ['Q4の生活費入力自体は変更しません。'],\n      }\n    : buildLivingChecklistItem({\n        livingState: input.livingState,\n        familyMembers: input.familyMembers,\n        referenceDate: input.referenceDate,\n        startAge,\n      });\n\n  return {\n    startAge,\n    items: [\n      housingItem,\n      livingItem,\n      buildNursingChecklistItem(\n        input.lifeEventState,\n        input.familyMembers,\n        design,\n      ),\n    ],\n  };\n}\n\nexport function getSecondLifeChecklistStatusLabel'''
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit('failed to replace buildSecondLifeGuide')
text = text.replace("      return '入力済み';", "      return '設定済み';", 1)
p.write_text(text, encoding='utf-8')


# Consistency becomes an explanation of which source wins; overlaps are intentional under overlay.
Path('src/lib/secondLifeHousingConsistency.ts').write_text('''import type {\n  HousingState,\n  OwnedProperty,\n  RentalProperty,\n} from '../types/housing';\nimport type { SecondLifeState } from '../types/secondLife';\n\nexport type SecondLifeHousingConsistencyStatus =\n  | 'aligned'\n  | 'attention'\n  | 'missing'\n  | 'skipped';\n\ntype HousingItem = {\n  id: string;\n  name: string;\n  kind: 'rental' | 'owned';\n  startAge: number;\n  startMonth: number;\n  endMode: 'lifetime' | 'until';\n  endAge: number;\n  endMonth: number;\n};\n\nexport interface SecondLifeHousingConsistency {\n  status: SecondLifeHousingConsistencyStatus;\n  title: string;\n  summary: string;\n  detailLines: string[];\n}\n\nfunction toRentalItem(item: RentalProperty): HousingItem {\n  return {\n    id: item.id,\n    name: item.name || '賃貸住宅',\n    kind: 'rental',\n    startAge: item.startAge,\n    startMonth: item.startMonth,\n    endMode: item.endMode,\n    endAge: item.endAge,\n    endMonth: item.endMonth,\n  };\n}\n\nfunction toOwnedItem(item: OwnedProperty): HousingItem {\n  return {\n    id: item.id,\n    name: item.name || '所有住宅',\n    kind: 'owned',\n    startAge: item.startAge,\n    startMonth: item.startMonth,\n    endMode: item.endMode,\n    endAge: item.endAge,\n    endMonth: item.endMonth,\n  };\n}\n\nfunction collectHousingItems(housingState: HousingState): HousingItem[] {\n  const byId = new Map<string, HousingItem>();\n  for (const data of Object.values(housingState.byTarget)) {\n    for (const rental of data.rentals) byId.set(rental.id, toRentalItem(rental));\n    for (const property of data.owned) {\n      if (property.type !== 'land') byId.set(property.id, toOwnedItem(property));\n    }\n  }\n  return [...byId.values()];\n}\n\nfunction isActiveAtAge(item: HousingItem, age: number): boolean {\n  if (item.startAge > age) return false;\n  if (item.startAge === age && item.startMonth > 1) return false;\n  if (item.endMode === 'lifetime') return true;\n  if (item.endAge > age) return true;\n  if (item.endAge < age) return false;\n  return item.endMonth >= 1;\n}\n\nfunction formatHousingPeriod(item: HousingItem): string {\n  const kind = item.kind === 'rental' ? '賃貸' : '所有';\n  const end = item.endMode === 'lifetime' ? '一生涯' : `${item.endAge}歳${item.endMonth}月まで`;\n  return `${item.name}（${kind}・${end}）`;\n}\n\nexport function buildSecondLifeHousingConsistency(input: {\n  housingState: HousingState;\n  secondLifeState: SecondLifeState;\n}): SecondLifeHousingConsistency {\n  const { housingState, secondLifeState } = input;\n\n  if (secondLifeState.housingSkip) {\n    return {\n      status: 'skipped',\n      title: 'Q5の住まい入力をそのまま使用します',\n      summary: 'Q12による住まいの上書きは無効です。Q5の入力内容は変更されません。',\n      detailLines: [],\n    };\n  }\n\n  const actionAge =\n    secondLifeState.housingScenario === 'stay' && secondLifeState.stayOption === 'continue'\n      ? secondLifeState.startAge\n      : secondLifeState.housingActionAge;\n  const activeHousing = collectHousingItems(housingState).filter((item) =>\n    isActiveAtAge(item, actionAge),\n  );\n\n  if (secondLifeState.housingScenario === 'stay' && secondLifeState.stayOption === 'continue') {\n    if (activeHousing.length === 0) {\n      return {\n        status: 'missing',\n        title: `${secondLifeState.startAge}歳時点の住まいがQ5にありません`,\n        summary: '今の住まいを継続する設計なので、Q5で現在の住まいを入力してください。',\n        detailLines: [],\n      };\n    }\n    return {\n      status: 'aligned',\n      title: 'Q5の現在の住まいをそのまま継続します',\n      summary: 'セカンドライフ開始後もQ5の住まい入力をそのまま計算に使用します。',\n      detailLines: activeHousing.map(formatHousingPeriod),\n    };\n  }\n\n  if (secondLifeState.housingScenario === 'stay' && secondLifeState.stayOption === 'renovate') {\n    const owned = activeHousing.filter((item) => item.kind === 'owned');\n    if (owned.length === 0) {\n      return {\n        status: 'missing',\n        title: `${actionAge}歳時点の持ち家がQ5にありません`,\n        summary: '現在の住宅をリフォームする設計なので、Q5で対象となる持ち家を入力してください。',\n        detailLines: activeHousing.map(formatHousingPeriod),\n      };\n    }\n    return {\n      status: 'aligned',\n      title: `${actionAge}歳のリフォーム費を計算上追加します`,\n      summary: 'Q5の持ち家データは変更せず、キャッシュフロー上の住まい支出としてQ12のリフォーム費を重ねます。',\n      detailLines: owned.map(formatHousingPeriod),\n    };\n  }\n\n  return {\n    status: 'aligned',\n    title: `${actionAge}歳からQ12の住まい設計を優先します`,\n    summary:\n      activeHousing.length > 0\n        ? 'Q5の住まいがその後も続く入力でも、Q5自体は変更せず、計算上だけQ12の住まいへ切り替えます。'\n        : 'Q5の入力自体は変更せず、計算上だけQ12の住まいを使用します。',\n    detailLines: activeHousing.map(formatHousingPeriod),\n  };\n}\n\nexport function getSecondLifeHousingConsistencyStatusLabel(\n  status: SecondLifeHousingConsistencyStatus,\n): string {\n  switch (status) {\n    case 'aligned':\n      return '計算OK';\n    case 'attention':\n      return '要確認';\n    case 'missing':\n      return '要入力';\n    case 'skipped':\n      return 'Q5を使用';\n  }\n}\n''', encoding='utf-8')

print('second-life non-destructive overlay patch applied')
