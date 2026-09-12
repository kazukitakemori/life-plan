from pathlib import Path
import re


def replace_once(path: str, old: str, new: str, label: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'missing target {label} in {path}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


# App: persisted Q4/Q5 states remain raw. Only cashFlowInput receives the derived overlay.
p = Path('src/App.tsx')
text = p.read_text(encoding='utf-8')
old_import = "import {\n  addSecondLifeNursingTemplates,\n  applySecondLifeHousingDesign,\n  applySecondLifeLivingDesign,\n} from './lib/secondLifeTemplates';"
new_import = "import { addSecondLifeNursingTemplates } from './lib/secondLifeTemplates';\nimport { buildSecondLifeCalculationStates } from './lib/secondLifeCalculationOverlay';"
if old_import not in text:
    raise SystemExit('missing App second-life imports')
text = text.replace(old_import, new_import, 1)

cash_marker = "  const cashFlowInput = useMemo<CashFlowInput>(\n"
if cash_marker not in text:
    raise SystemExit('missing cashFlowInput marker')
overlay = """  const secondLifeCalculationStates = useMemo(
    () =>
      buildSecondLifeCalculationStates({
        housingState,
        livingState,
        secondLifeState,
        familyMembers,
        incomeByMember,
        pensionByMember,
        referenceDate,
      }),
    [
      housingState,
      livingState,
      secondLifeState,
      familyMembers,
      incomeByMember,
      pensionByMember,
      referenceDate,
    ],
  );

"""
text = text.replace(cash_marker, overlay + cash_marker, 1)

start = text.index(cash_marker)
end_marker = "  cashFlowInputRef.current = cashFlowInput;"
end = text.index(end_marker, start)
block = text[start:end]
raw_pair = "      priorYearIncomeByMember,\n      livingState,\n      housingState,\n      vehicleState,"
derived_pair = "      priorYearIncomeByMember,\n      livingState: secondLifeCalculationStates.livingState,\n      housingState: secondLifeCalculationStates.housingState,\n      vehicleState,"
if raw_pair not in block:
    raise SystemExit('missing cash flow object state pair')
block = block.replace(raw_pair, derived_pair, 1)
if raw_pair not in block:
    raise SystemExit('missing cash flow dependency state pair')
block = block.replace(
    raw_pair,
    "      priorYearIncomeByMember,\n      secondLifeCalculationStates,\n      vehicleState,",
    1,
)
text = text[:start] + block + text[end:]

# Q12 no longer has housing/living apply callbacks. Nursing projection remains explicit for now.
pattern = re.compile(
    r"\n\s*onApplySecondLifeLiving=\{\(\) => \{.*?\n\s*onApplySecondLifeNursing=",
    re.S,
)
text, count = pattern.subn("\n            onApplySecondLifeNursing=", text, count=1)
if count != 1:
    raise SystemExit('failed to remove Q12 housing/living apply handlers')
p.write_text(text, encoding='utf-8')


# Housing section: keep optional onApply in the public prop shape for old hidden Q5 caller,
# but Q12 itself has no apply action and the prop is intentionally ignored.
p = Path('src/components/secondLife/SecondLifeHousingSection.tsx')
text = p.read_text(encoding='utf-8')
text = text.replace("  onChange,\n  onApply,\n", "  onChange,\n", 1)
old = '''      {!placeholder && onApply ? (
        <div className="second-life-section-actions">
          <p className="second-life-apply-note">
            現在の住まい設定との重なりを確認してから反映します。今の住まいを継続する計画なら終了時期は変更せず、転居する計画なら切替時期を確認できます。
          </p>
          <button
            type="button"
            className="second-life-apply-btn"
            onClick={onApply}
          >
            住まい計画を確認して反映する
          </button>
        </div>
      ) : null}
'''
new = '''      <div className="second-life-section-actions">
        <p className="second-life-apply-note">
          {placeholder
            ? 'Q5「住まい」の現在の入力をそのまま計算に使用します。'
            : 'Q5「住まい」の入力自体は変更せず、該当年齢以降のキャッシュフロー計算だけこの設計を優先します。'}
        </p>
      </div>
'''
if old not in text:
    raise SystemExit('missing housing apply block')
text = text.replace(old, new, 1)
p.write_text(text, encoding='utf-8')


# Living section: same non-destructive behavior. Keep optional onApply only for compatibility.
p = Path('src/components/secondLife/SecondLifeLivingSection.tsx')
text = p.read_text(encoding='utf-8')
text = text.replace("  onChange,\n  onApply,\n", "  onChange,\n", 1)
text = text.replace(
    '生活水準の変更は、ページ上部のセカンドライフ開始 {state.startAge}歳から反映します。',
    '生活水準の変更は、ページ上部のセカンドライフ開始 {state.startAge}歳から計算上だけ優先します。',
    1,
)
old = '''      {!placeholder && onApply ? (
        <div className="second-life-section-actions">
          <p className="second-life-apply-note">
            選択した生活水準で、負担者（世帯主）の生活費スケジュールを開始年齢以降に組み直します（既存の開始前スケジュールは残ります）。
          </p>
          <button
            type="button"
            className="second-life-apply-btn"
            onClick={onApply}
          >
            この内容を生活費に反映する
          </button>
        </div>
      ) : null}
'''
new = '''      <div className="second-life-section-actions">
        <p className="second-life-apply-note">
          {placeholder
            ? 'Q4「生活費」の現在の入力をそのまま計算に使用します。'
            : 'Q4「生活費」の入力自体は変更せず、セカンドライフ開始年齢以降のキャッシュフロー計算だけこの生活水準を優先します。'}
        </p>
      </div>
'''
if old not in text:
    raise SystemExit('missing living apply block')
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
    raise SystemExit('failed to remove housing apply handlers')
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
    raise SystemExit('failed to remove housing confirm modal')
p.write_text(text, encoding='utf-8')


# Guide reports active calculation rule instead of expecting Q4/Q5 to contain generated rows.
p = Path('src/lib/secondLifeGuide.ts')
text = p.read_text(encoding='utf-8')
pattern = re.compile(
    r"export function buildSecondLifeGuide\(input: \{.*?\n\}\n\nexport function getSecondLifeChecklistStatusLabel",
    re.S,
)
replacement = '''export function buildSecondLifeGuide(input: {
  startAge: number;
  secondLifeState?: SecondLifeState;
  familyMembers: FamilyMember[];
  housingState: HousingState;
  livingState: LivingExpenseState;
  lifeEventState: LifeEventState;
  referenceDate: Date;
}): SecondLifeGuide {
  const startAge = input.startAge;
  const headId = input.familyMembers.find((m) => m.role === 'head')?.id;
  const design = input.secondLifeState;

  const housingItem: SecondLifeChecklistItem = design
    ? {
        id: 'housing',
        stepId: 'housing',
        stepLabel: '5',
        title: '住まい',
        status: 'done',
        summary: design.housingSkip
          ? 'Q5「住まい」の現在入力をそのまま計算に使用します'
          : design.housingScenario === 'stay' && design.stayOption === 'continue'
            ? 'Q5の現在の住まいをそのまま継続します'
            : `${design.housingActionAge}歳からQ12の住まい設計を計算時に優先します`,
        detailLines: design.housingSkip
          ? ['Q12による住まいの上書きは無効です。']
          : ['Q5の住まい入力自体は変更しません。'],
      }
    : buildHousingChecklistItem(input.housingState, startAge, headId);

  const livingItem: SecondLifeChecklistItem = design
    ? {
        id: 'living',
        stepId: 'living',
        stepLabel: '4',
        title: '生活水準',
        status: 'done',
        summary: design.livingSkip
          ? 'Q4「生活費」の現在入力をそのまま計算に使用します'
          : `${design.startAge}歳からQ12の生活水準を計算時に優先します`,
        detailLines: design.livingSkip
          ? ['Q12による生活費の上書きは無効です。']
          : ['Q4の生活費入力自体は変更しません。'],
      }
    : buildLivingChecklistItem({
        livingState: input.livingState,
        familyMembers: input.familyMembers,
        referenceDate: input.referenceDate,
        startAge,
      });

  return {
    startAge,
    items: [
      housingItem,
      livingItem,
      buildNursingChecklistItem(
        input.lifeEventState,
        input.familyMembers,
        design,
      ),
    ],
  };
}

export function getSecondLifeChecklistStatusLabel'''
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit('failed to replace buildSecondLifeGuide')
text = text.replace("      return '入力済み';", "      return '設定済み';", 1)
p.write_text(text, encoding='utf-8')


# Overlap between raw Q5 and Q12 is intentional: Q5 is baseline, Q12 is calculation overlay.
Path('src/lib/secondLifeHousingConsistency.ts').write_text('''import type {
  HousingState,
  OwnedProperty,
  RentalProperty,
} from '../types/housing';
import type { SecondLifeState } from '../types/secondLife';

export type SecondLifeHousingConsistencyStatus =
  | 'aligned'
  | 'attention'
  | 'missing'
  | 'skipped';

type HousingItem = {
  id: string;
  name: string;
  kind: 'rental' | 'owned';
  startAge: number;
  startMonth: number;
  endMode: 'lifetime' | 'until';
  endAge: number;
  endMonth: number;
};

export interface SecondLifeHousingConsistency {
  status: SecondLifeHousingConsistencyStatus;
  title: string;
  summary: string;
  detailLines: string[];
}

function toRentalItem(item: RentalProperty): HousingItem {
  return {
    id: item.id,
    name: item.name || '賃貸住宅',
    kind: 'rental',
    startAge: item.startAge,
    startMonth: item.startMonth,
    endMode: item.endMode,
    endAge: item.endAge,
    endMonth: item.endMonth,
  };
}

function toOwnedItem(item: OwnedProperty): HousingItem {
  return {
    id: item.id,
    name: item.name || '所有住宅',
    kind: 'owned',
    startAge: item.startAge,
    startMonth: item.startMonth,
    endMode: item.endMode,
    endAge: item.endAge,
    endMonth: item.endMonth,
  };
}

function collectHousingItems(housingState: HousingState): HousingItem[] {
  const byId = new Map<string, HousingItem>();
  for (const data of Object.values(housingState.byTarget)) {
    for (const rental of data.rentals) byId.set(rental.id, toRentalItem(rental));
    for (const property of data.owned) {
      if (property.type !== 'land') byId.set(property.id, toOwnedItem(property));
    }
  }
  return [...byId.values()];
}

function isActiveAtAge(item: HousingItem, age: number): boolean {
  if (item.startAge > age) return false;
  if (item.startAge === age && item.startMonth > 1) return false;
  if (item.endMode === 'lifetime') return true;
  if (item.endAge > age) return true;
  if (item.endAge < age) return false;
  return item.endMonth >= 1;
}

function formatHousingPeriod(item: HousingItem): string {
  const kind = item.kind === 'rental' ? '賃貸' : '所有';
  const end = item.endMode === 'lifetime' ? '一生涯' : `${item.endAge}歳${item.endMonth}月まで`;
  return `${item.name}（${kind}・${end}）`;
}

export function buildSecondLifeHousingConsistency(input: {
  housingState: HousingState;
  secondLifeState: SecondLifeState;
}): SecondLifeHousingConsistency {
  const { housingState, secondLifeState } = input;

  if (secondLifeState.housingSkip) {
    return {
      status: 'skipped',
      title: 'Q5の住まい入力をそのまま使用します',
      summary: 'Q12による住まいの上書きは無効です。Q5の入力内容は変更されません。',
      detailLines: [],
    };
  }

  const actionAge =
    secondLifeState.housingScenario === 'stay' && secondLifeState.stayOption === 'continue'
      ? secondLifeState.startAge
      : secondLifeState.housingActionAge;
  const activeHousing = collectHousingItems(housingState).filter((item) =>
    isActiveAtAge(item, actionAge),
  );

  if (secondLifeState.housingScenario === 'stay' && secondLifeState.stayOption === 'continue') {
    if (activeHousing.length === 0) {
      return {
        status: 'missing',
        title: `${secondLifeState.startAge}歳時点の住まいがQ5にありません`,
        summary: '今の住まいを継続する設計なので、Q5で現在の住まいを入力してください。',
        detailLines: [],
      };
    }
    return {
      status: 'aligned',
      title: 'Q5の現在の住まいをそのまま継続します',
      summary: 'セカンドライフ開始後もQ5の住まい入力をそのまま計算に使用します。',
      detailLines: activeHousing.map(formatHousingPeriod),
    };
  }

  if (secondLifeState.housingScenario === 'stay' && secondLifeState.stayOption === 'renovate') {
    const owned = activeHousing.filter((item) => item.kind === 'owned');
    if (owned.length === 0) {
      return {
        status: 'missing',
        title: `${actionAge}歳時点の持ち家がQ5にありません`,
        summary: '現在の住宅をリフォームする設計なので、Q5で対象となる持ち家を入力してください。',
        detailLines: activeHousing.map(formatHousingPeriod),
      };
    }
    return {
      status: 'aligned',
      title: `${actionAge}歳のリフォーム費を計算上追加します`,
      summary: 'Q5の持ち家データは変更せず、キャッシュフロー上の住まい支出としてQ12のリフォーム費を重ねます。',
      detailLines: owned.map(formatHousingPeriod),
    };
  }

  return {
    status: 'aligned',
    title: `${actionAge}歳からQ12の住まい設計を優先します`,
    summary:
      activeHousing.length > 0
        ? 'Q5の住まいがその後も続く入力でも、Q5自体は変更せず、計算上だけQ12の住まいへ切り替えます。'
        : 'Q5の入力自体は変更せず、計算上だけQ12の住まいを使用します。',
    detailLines: activeHousing.map(formatHousingPeriod),
  };
}

export function getSecondLifeHousingConsistencyStatusLabel(
  status: SecondLifeHousingConsistencyStatus,
): string {
  switch (status) {
    case 'aligned':
      return '計算OK';
    case 'attention':
      return '要確認';
    case 'missing':
      return '要入力';
    case 'skipped':
      return 'Q5を使用';
  }
}
''', encoding='utf-8')

print('second-life non-destructive overlay patch v2 applied')
