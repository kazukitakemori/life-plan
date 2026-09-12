from pathlib import Path
import re


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f'marker not found: {label}')
    return text.replace(old, new, 1)

# 1. Rename the user-facing Q12 container to an upper-level concept.
p = 'src/types/steps.ts'
s = read(p)
s = s.replace("{ id: 'other', number: 12, label: 'セカンドライフ' },", "{ id: 'other', number: 12, label: '老後の暮らし' },")
write(p, s)

# 2. Extend the third-life data model. Keep legacy annualCostMan only in migration, not as source of truth.
p = 'src/types/secondLife.ts'
s = read(p)
old = """/** 介護の想定 */
export type SecondLifeNursingScenario = 'home' | 'day_service' | 'facility';

export type SecondLifeNursingTarget = 'head' | 'spouse';

export interface SecondLifeNursingDesign {
  skip: boolean;
  scenario: SecondLifeNursingScenario;
  startAge: number;
  annualCostMan: number;
}
"""
new = """/** サードライフ（介護）の想定 */
export type SecondLifeNursingScenario =
  | 'home'
  | 'day_service'
  | 'special_nursing_home'
  | 'paid_care'
  | 'paid_residential'
  | 'serviced_elderly'
  | 'group_home'
  | 'other';

export type SecondLifeNursingDurationMode = 'lifetime' | 'years';
export type SecondLifeNursingTarget = 'head' | 'spouse';

export interface SecondLifeNursingDesign {
  skip: boolean;
  scenario: SecondLifeNursingScenario;
  startAge: number;
  /** Q4生活費・Q5住まいとは別に、介護開始時に追加で見込む費用（万円） */
  initialCostMan: number;
  /** Q4生活費・Q5住まいとは別に、介護で毎月追加して見込む費用（万円） */
  monthlyCostMan: number;
  durationMode: SecondLifeNursingDurationMode;
  /** durationMode=years のときだけ使用 */
  durationYears: number | null;
}
"""
s = replace_once(s, old, new, 'third life data model')
write(p, s)

# 3. Central scenario metadata and calculation helpers.
p = 'src/lib/thirdLifeCare.ts'
write(p, """import type {
  SecondLifeNursingDesign,
  SecondLifeNursingScenario,
} from '../types/secondLife';

export interface ThirdLifeCareScenarioInfo {
  id: SecondLifeNursingScenario;
  label: string;
  description: string;
  note?: string;
  referenceLabel: string;
  referenceUrl: string;
}

export const THIRD_LIFE_CARE_SCENARIOS: ThirdLifeCareScenarioInfo[] = [
  {
    id: 'home',
    label: '在宅介護',
    description:
      '自宅で暮らしながら、訪問介護・訪問看護など必要なサービスを組み合わせる想定です。利用するサービス量や自己負担割合で費用が変わります。',
    referenceLabel: '介護サービス情報公表システム',
    referenceUrl: 'https://www.kaigokensaku.mhlw.go.jp/',
  },
  {
    id: 'day_service',
    label: '在宅＋デイサービス',
    description:
      '自宅での生活を続けながら、通所介護（デイサービス）などを利用する想定です。食事・入浴・機能訓練などを受けられ、家族の介護負担軽減にもつながります。',
    note: '利用できるサービスや自己負担は要介護度などで異なります。',
    referenceLabel: '厚生労働省：通所介護（デイサービス）',
    referenceUrl: 'https://www.kaigokensaku.mhlw.go.jp/publish/group7.html',
  },
  {
    id: 'special_nursing_home',
    label: '特別養護老人ホーム（特養）',
    description:
      '常時介護が必要な人向けの介護保険施設です。新規入所は原則として要介護3以上で、介護度・居室タイプ・所得区分などにより自己負担が変わります。',
    note: '厚生労働省の計算例では、要介護5・1割負担の場合でも多床室とユニット型個室で月額の目安が異なります。これは一例であり、自動入力には使用しません。',
    referenceLabel: '厚生労働省：介護サービスの利用料',
    referenceUrl: 'https://www.kaigokensaku.mhlw.go.jp/commentary/fee.html',
  },
  {
    id: 'paid_care',
    label: '介護付き有料老人ホーム',
    description:
      '特定施設入居者生活介護の指定を受けた有料老人ホームで、ホームが介護保険サービスを包括的に提供するタイプです。',
    referenceLabel: '厚生労働省：高齢者向け住まいの違い',
    referenceUrl: 'https://www.mhlw.go.jp/content/12300000/001447747.pdf',
  },
  {
    id: 'paid_residential',
    label: '住宅型有料老人ホーム',
    description:
      '生活支援付きの住まいで、介護保険サービスが必要な場合は外部の介護事業所と個別に契約して利用するタイプです。',
    note: '介護サービスの利用量によって追加費用が変わりやすい点に注意が必要です。',
    referenceLabel: '厚生労働省：高齢者向け住まいの違い',
    referenceUrl: 'https://www.mhlw.go.jp/content/12300000/001447747.pdf',
  },
  {
    id: 'serviced_elderly',
    label: 'サービス付き高齢者向け住宅（サ高住）',
    description:
      'バリアフリーの高齢者向け住宅で、安否確認と生活相談が必須です。介護・食事・生活支援など、それ以外のサービス内容は住宅ごとに異なります。',
    referenceLabel: '国土交通省：サービス付き高齢者向け住宅',
    referenceUrl: 'https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk3_000005.html',
  },
  {
    id: 'group_home',
    label: '認知症グループホーム',
    description:
      '認知症の人が少人数で共同生活し、日常生活上の支援や機能訓練などを受ける地域密着型サービスです。',
    note: '要支援2または要介護1〜5など、利用条件があります。食費・居住費などは介護サービス費とは別にかかります。',
    referenceLabel: '厚生労働省：認知症グループホーム',
    referenceUrl: 'https://www.kaigokensaku.mhlw.go.jp/publish/group18.html',
  },
  {
    id: 'other',
    label: 'その他・まだ決めていない',
    description:
      '施設種別をまだ決めていない場合や、上記に当てはまらない介護の形を想定する場合に使います。費用は分かる範囲で入力してください。',
    referenceLabel: '介護サービス情報公表システム',
    referenceUrl: 'https://www.kaigokensaku.mhlw.go.jp/',
  },
];

export const THIRD_LIFE_CARE_SCENARIO_LABELS = Object.fromEntries(
  THIRD_LIFE_CARE_SCENARIOS.map((scenario) => [scenario.id, scenario.label]),
) as Record<SecondLifeNursingScenario, string>;

export function getThirdLifeCareScenarioInfo(
  scenario: SecondLifeNursingScenario,
): ThirdLifeCareScenarioInfo {
  return (
    THIRD_LIFE_CARE_SCENARIOS.find((item) => item.id === scenario) ??
    THIRD_LIFE_CARE_SCENARIOS[THIRD_LIFE_CARE_SCENARIOS.length - 1]
  );
}

export function getThirdLifeAnnualAdditionalCostMan(
  design: Pick<SecondLifeNursingDesign, 'monthlyCostMan'>,
): number {
  return Math.round(Math.max(0, design.monthlyCostMan) * 12 * 100) / 100;
}

export function getThirdLifeCareEndAge(
  design: Pick<
    SecondLifeNursingDesign,
    'startAge' | 'durationMode' | 'durationYears'
  >,
  expectedLifespan: number,
): number {
  if (design.durationMode === 'lifetime') return expectedLifespan;
  const years = Math.max(1, Math.round(design.durationYears ?? 1));
  return Math.min(expectedLifespan, design.startAge + years - 1);
}

export function formatThirdLifeCareDuration(
  design: Pick<SecondLifeNursingDesign, 'durationMode' | 'durationYears'>,
): string {
  return design.durationMode === 'lifetime'
    ? '一生涯'
    : `${Math.max(1, Math.round(design.durationYears ?? 1))}年間`;
}
""")

# 4. Backward-compatible defaults and migration.
p = 'src/lib/secondLifeDefaults.ts'
s = read(p)
old = """export function createDefaultSecondLifeNursingDesign(
  overrides: Partial<SecondLifeNursingDesign> = {},
): SecondLifeNursingDesign {
  return {
    skip: false,
    scenario: 'home',
    startAge: SECOND_LIFE_DEFAULT_NURSING_START_AGE,
    annualCostMan: 50,
    ...overrides,
  };
}
"""
new = """export function createDefaultSecondLifeNursingDesign(
  overrides: Partial<SecondLifeNursingDesign> = {},
): SecondLifeNursingDesign {
  return {
    skip: false,
    scenario: 'home',
    startAge: SECOND_LIFE_DEFAULT_NURSING_START_AGE,
    initialCostMan: 0,
    monthlyCostMan: 0,
    durationMode: 'lifetime',
    durationYears: null,
    ...overrides,
  };
}
"""
s = replace_once(s, old, new, 'nursing defaults')
# replace migration block functions before migrateSecondLifeState
pattern = re.compile(r"function migrateLegacyNursingFields\([\s\S]*?\n}\n\nfunction migrateNursingDesign\([\s\S]*?\n}\n\nexport function migrateSecondLifeState", re.M)
replacement = """function normalizeNursingScenario(value: unknown): SecondLifeNursingDesign['scenario'] {
  if (
    value === 'home' ||
    value === 'day_service' ||
    value === 'special_nursing_home' ||
    value === 'paid_care' ||
    value === 'paid_residential' ||
    value === 'serviced_elderly' ||
    value === 'group_home' ||
    value === 'other'
  ) {
    return value;
  }
  // 旧「施設介護」は施設種別を特定できないため「その他」へ移行する。
  if (value === 'facility') return 'other';
  return 'home';
}

function migrateLegacyNursingFields(
  value: Partial<SecondLifeState>,
  defaults: SecondLifeState,
): SecondLifeState['nursingByTarget'] {
  const legacy = value as Partial<SecondLifeState> & {
    nursingSkip?: boolean;
    nursingScenario?: unknown;
    nursingStartAge?: number;
    nursingAnnualCostMan?: number;
  };

  const annual =
    typeof legacy.nursingAnnualCostMan === 'number' && legacy.nursingAnnualCostMan >= 0
      ? legacy.nursingAnnualCostMan
      : 0;

  const head = createDefaultSecondLifeNursingDesign({
    skip:
      typeof legacy.nursingSkip === 'boolean'
        ? legacy.nursingSkip
        : defaults.nursingByTarget.head.skip,
    scenario: normalizeNursingScenario(legacy.nursingScenario),
    startAge:
      typeof legacy.nursingStartAge === 'number' && legacy.nursingStartAge >= 60
        ? legacy.nursingStartAge
        : defaults.nursingByTarget.head.startAge,
    monthlyCostMan: Math.round((annual / 12) * 100) / 100,
  });

  return {
    head,
    spouse: defaults.nursingByTarget.spouse,
  };
}

function migrateNursingDesign(
  value: Partial<SecondLifeNursingDesign> | undefined,
  fallback: SecondLifeNursingDesign,
): SecondLifeNursingDesign {
  if (!value) return fallback;

  const legacy = value as Partial<SecondLifeNursingDesign> & {
    annualCostMan?: number;
    scenario?: unknown;
  };
  const legacyAnnual =
    typeof legacy.annualCostMan === 'number' && legacy.annualCostMan >= 0
      ? legacy.annualCostMan
      : null;
  const monthlyCostMan =
    typeof value.monthlyCostMan === 'number' && value.monthlyCostMan >= 0
      ? value.monthlyCostMan
      : legacyAnnual != null
        ? Math.round((legacyAnnual / 12) * 100) / 100
        : fallback.monthlyCostMan;

  return createDefaultSecondLifeNursingDesign({
    skip: typeof value.skip === 'boolean' ? value.skip : fallback.skip,
    scenario: normalizeNursingScenario(legacy.scenario),
    startAge:
      typeof value.startAge === 'number' && value.startAge >= 60
        ? value.startAge
        : fallback.startAge,
    initialCostMan:
      typeof value.initialCostMan === 'number' && value.initialCostMan >= 0
        ? value.initialCostMan
        : fallback.initialCostMan,
    monthlyCostMan,
    durationMode: value.durationMode === 'years' ? 'years' : 'lifetime',
    durationYears:
      value.durationMode === 'years' &&
      typeof value.durationYears === 'number' &&
      value.durationYears > 0
        ? Math.min(50, Math.max(1, Math.round(value.durationYears)))
        : null,
  });
}

export function migrateSecondLifeState"""
if not pattern.search(s):
    raise RuntimeError('nursing migration block not found')
s = pattern.sub(replacement, s, count=1)
write(p, s)

# 5. New life-event labels; retain old label detection.
p = 'src/lib/lifeEventSource.ts'
s = read(p)
s = replace_once(
    s,
    "export const SECOND_LIFE_NURSING_EVENT_LABEL = 'セカンドライフ介護';\n",
    "export const SECOND_LIFE_NURSING_EVENT_LABEL = 'セカンドライフ介護'; // 旧データ互換\nexport const THIRD_LIFE_NURSING_RECURRING_EVENT_LABEL = 'サードライフ介護（月額費用）';\nexport const THIRD_LIFE_NURSING_INITIAL_EVENT_LABEL = 'サードライフ介護（開始時費用）';\n",
    'third life event labels',
)
s = replace_once(
    s,
    "  if (entry.label === SECOND_LIFE_NURSING_EVENT_LABEL) {\n    return 'second_life_nursing';\n  }\n",
    "  if (\n    entry.label === SECOND_LIFE_NURSING_EVENT_LABEL ||\n    entry.label === THIRD_LIFE_NURSING_RECURRING_EVENT_LABEL ||\n    entry.label === THIRD_LIFE_NURSING_INITIAL_EVENT_LABEL\n  ) {\n    return 'second_life_nursing';\n  }\n",
    'third life label fallback',
)
write(p, s)

# 6. Apply recurring + initial third-life costs with explicit duration.
p = 'src/lib/secondLifeApply.ts'
s = read(p)
s = s.replace("  SECOND_LIFE_NURSING_EVENT_LABEL,\n", "  THIRD_LIFE_NURSING_INITIAL_EVENT_LABEL,\n  THIRD_LIFE_NURSING_RECURRING_EVENT_LABEL,\n")
s = s.replace("  getDefaultNursingAnnualCostMan,\n", "")
s = replace_once(
    s,
    "import type { PensionByMember } from '../types/pension';\n",
    "import type { PensionByMember } from '../types/pension';\nimport {\n  getThirdLifeAnnualAdditionalCostMan,\n  getThirdLifeCareEndAge,\n} from './thirdLifeCare';\n",
    'third life apply helpers import',
)
pattern = re.compile(r"function upsertSecondLifeNursingEvent\([\s\S]*?\n}\n\nexport function applySecondLifeNursing", re.M)
replacement = """function upsertSecondLifeNursingEvent(
  lifeEventState: LifeEventState,
  member: FamilyMember,
  referenceMonth: number,
  design: SecondLifeNursingDesign,
): LifeEventState {
  const without = removeSecondLifeNursingEvent(
    lifeEventState,
    member,
  ).byMember[member.id] ?? [];

  const annualCost = getThirdLifeAnnualAdditionalCostMan(design);
  const initialCost = Math.max(0, design.initialCostMan);
  const generated = [] as (typeof without);

  if (annualCost > 0) {
    const recurring = createLifeEventEntryFromPreset(
      'nursing',
      member,
      referenceMonth,
    );
    const endAge = getThirdLifeCareEndAge(design, member.expectedLifespan);
    generated.push({
      ...recurring,
      label: THIRD_LIFE_NURSING_RECURRING_EVENT_LABEL,
      type: 'nursing',
      startAge: design.startAge,
      startMonth: 1,
      endMode: design.durationMode === 'years' ? 'until' : 'lifetime',
      endAge,
      endMonth: 12,
      amountMan: annualCost,
      source: 'second_life_nursing',
    });
  }

  if (initialCost > 0) {
    generated.push(
      createLifeEventEntry(member, referenceMonth, {
        label: THIRD_LIFE_NURSING_INITIAL_EVENT_LABEL,
        type: 'nursing',
        startAge: design.startAge,
        startMonth: 1,
        endMode: 'once',
        endAge: design.startAge,
        endMonth: 1,
        cycleInterval: 1,
        cycleUnit: 'year',
        amountMan: initialCost,
        increaseRate: null,
        source: 'second_life_nursing',
      }),
    );
  }

  return {
    ...lifeEventState,
    byMember: {
      ...lifeEventState.byMember,
      [member.id]: [...without, ...generated],
    },
  };
}

export function applySecondLifeNursing"""
if not pattern.search(s):
    raise RuntimeError('upsert nursing event block not found')
s = pattern.sub(replacement, s, count=1)
write(p, s)

# 7. Replace the nursing UI with detailed third-life design + collapsible explanations.
p = 'src/components/secondLife/SecondLifeNursingSection.tsx'
write(p, """import { getMemberTabLabel } from '../../lib/memberDisplay';
import {
  formatThirdLifeCareDuration,
  getThirdLifeCareScenarioInfo,
  THIRD_LIFE_CARE_SCENARIOS,
} from '../../lib/thirdLifeCare';
import type { FamilyMember } from '../../types/family';
import type {
  SecondLifeNursingDesign,
  SecondLifeNursingScenario,
  SecondLifeNursingTarget,
  SecondLifeState,
} from '../../types/secondLife';

type NursingApplyStatus = 'missing' | 'partial' | 'done';

interface SecondLifeNursingSectionProps {
  members: FamilyMember[];
  state: SecondLifeState;
  applyStatus: NursingApplyStatus;
  onChange: (state: SecondLifeState) => void;
  onApply: () => void;
  onOpenLifeEvent?: () => void;
}

export function SecondLifeNursingSection({
  members,
  state,
  applyStatus,
  onChange,
  onApply,
  onOpenLifeEvent,
}: SecondLifeNursingSectionProps) {
  const targets = ([
    ['head', 'head'],
    ['spouse', 'spouse'],
  ] as const)
    .map(([key, role]) => ({
      key,
      member: members.find((member) => member.role === role),
    }))
    .filter(
      (
        item,
      ): item is {
        key: SecondLifeNursingTarget;
        member: FamilyMember;
      } => Boolean(item.member),
    );

  const updateTarget = (
    target: SecondLifeNursingTarget,
    patch: Partial<SecondLifeNursingDesign>,
  ) => {
    onChange({
      ...state,
      nursingByTarget: {
        ...state.nursingByTarget,
        [target]: {
          ...state.nursingByTarget[target],
          ...patch,
        },
      },
    });
  };

  const hasUnpricedDesign = targets.some(({ key }) => {
    const design = state.nursingByTarget[key];
    return (
      !design.skip &&
      design.initialCostMan <= 0 &&
      design.monthlyCostMan <= 0
    );
  });

  const applyMessage = hasUnpricedDesign
    ? '介護費を見込む人は、開始時費用または月額追加費用を入力してください。金額が0のままでは反映しません。'
    : applyStatus === 'done'
      ? '現在のサードライフ設計はキャッシュフローへ反映済みです。'
      : applyStatus === 'partial'
        ? 'サードライフ設計と現在の連動データに差分があります。下のボタンで最新内容を反映してください。'
        : 'サードライフ設計をキャッシュフローへ反映してください。';

  return (
    <section className="second-life-section" aria-labelledby="second-life-nursing-title">
      <div className="second-life-section-toolbar">
        <div>
          <p className="second-life-consistency-kicker">介護・サードライフの設計</p>
          <h3 id="second-life-nursing-title">誰に・いつから・どの介護を見込むか</h3>
        </div>
      </div>

      <p className="second-life-apply-note">
        このソフトでは、介護が必要になった後の時期を「サードライフ」と呼び、元気に暮らすセカンドライフとは分けて整理します。
      </p>

      <details className="third-life-reference-details">
        <summary>介護・施設の選択肢の違いを見る</summary>
        <div className="third-life-reference-list">
          {THIRD_LIFE_CARE_SCENARIOS.map((scenario) => (
            <section key={scenario.id} className="third-life-reference-item">
              <h4>{scenario.label}</h4>
              <p>{scenario.description}</p>
              {scenario.note ? <p>{scenario.note}</p> : null}
              <a href={scenario.referenceUrl} target="_blank" rel="noreferrer">
                {scenario.referenceLabel}
              </a>
            </section>
          ))}
        </div>
      </details>

      <details className="third-life-reference-details">
        <summary>費用の入力方法を見る</summary>
        <div className="third-life-cost-note">
          <p>
            ここで入力する費用は、「生活費」「住まい」で既に計上している金額とは別に、介護によって追加で家計から出る金額です。
          </p>
          <p>
            施設の公表月額には食費・居住費などが含まれる場合があります。その総額をそのまま追加すると二重計上になることがあるため、自動では入力しません。実際の見積や現在の生活費との差額が分かる場合は、その追加分を入力してください。
          </p>
        </div>
      </details>

      <div className="second-life-guide-grid third-life-person-grid">
        {targets.map(({ key, member }) => {
          const design = state.nursingByTarget[key];
          const scenarioInfo = getThirdLifeCareScenarioInfo(design.scenario);
          const hasCost = design.initialCostMan > 0 || design.monthlyCostMan > 0;
          return (
            <article
              key={key}
              className={
                design.skip
                  ? 'second-life-guide-card second-life-guide-card--missing'
                  : hasCost
                    ? 'second-life-guide-card second-life-guide-card--done'
                    : 'second-life-guide-card second-life-guide-card--partial'
              }
            >
              <div className="second-life-guide-card-head">
                <div>
                  <p className="second-life-guide-card-step">
                    {getMemberTabLabel(member)}
                  </p>
                  <p className="second-life-guide-card-summary">
                    {design.skip
                      ? '今回は介護費を見込まない'
                      : hasCost
                        ? `${design.startAge}歳〜 ${scenarioInfo.label}・月${design.monthlyCostMan}万円＋開始時${design.initialCostMan}万円（${formatThirdLifeCareDuration(design)}）`
                        : `${design.startAge}歳〜 ${scenarioInfo.label}（費用未入力）`}
                  </p>
                </div>
              </div>

              <label className="second-life-skip">
                <input
                  type="checkbox"
                  checked={design.skip}
                  onChange={(event) =>
                    updateTarget(key, { skip: event.target.checked })
                  }
                />
                今回は介護費を見込まない
              </label>

              {!design.skip ? (
                <div className="third-life-fields">
                  <label className="second-life-inline-option third-life-field-row">
                    <span>介護の想定</span>
                    <select
                      className="select-input"
                      value={design.scenario}
                      onChange={(event) =>
                        updateTarget(key, {
                          scenario: event.target.value as SecondLifeNursingScenario,
                        })
                      }
                    >
                      {THIRD_LIFE_CARE_SCENARIOS.map((scenario) => (
                        <option key={scenario.id} value={scenario.id}>
                          {scenario.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <details className="third-life-selected-description">
                    <summary>この選択肢について</summary>
                    <p>{scenarioInfo.description}</p>
                    {scenarioInfo.note ? <p>{scenarioInfo.note}</p> : null}
                    <a
                      href={scenarioInfo.referenceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {scenarioInfo.referenceLabel}
                    </a>
                  </details>

                  <label className="second-life-inline-option third-life-field-row">
                    <span>開始年齢</span>
                    <span>
                      <input
                        type="number"
                        className="second-life-age-input"
                        min={60}
                        max={110}
                        value={design.startAge}
                        onChange={(event) =>
                          updateTarget(key, {
                            startAge: Math.max(60, Number(event.target.value) || 60),
                          })
                        }
                      />
                      歳〜
                    </span>
                  </label>

                  <label className="second-life-inline-option third-life-field-row">
                    <span>開始時に追加でかかる費用</span>
                    <span>
                      <input
                        type="number"
                        className="amount-input"
                        min={0}
                        step={1}
                        value={design.initialCostMan}
                        onChange={(event) =>
                          updateTarget(key, {
                            initialCostMan: Math.max(
                              0,
                              Number(event.target.value) || 0,
                            ),
                          })
                        }
                      />
                      万円
                    </span>
                  </label>

                  <label className="second-life-inline-option third-life-field-row">
                    <span>毎月追加でかかる費用</span>
                    <span>
                      <input
                        type="number"
                        className="amount-input"
                        min={0}
                        step={0.1}
                        value={design.monthlyCostMan}
                        onChange={(event) =>
                          updateTarget(key, {
                            monthlyCostMan: Math.max(
                              0,
                              Number(event.target.value) || 0,
                            ),
                          })
                        }
                      />
                      万円／月
                    </span>
                  </label>

                  <label className="second-life-inline-option third-life-field-row">
                    <span>想定期間</span>
                    <select
                      className="select-input"
                      value={design.durationMode}
                      onChange={(event) => {
                        const durationMode =
                          event.target.value === 'years' ? 'years' : 'lifetime';
                        updateTarget(key, {
                          durationMode,
                          durationYears:
                            durationMode === 'years'
                              ? design.durationYears ?? 5
                              : null,
                        });
                      }}
                    >
                      <option value="lifetime">一生涯</option>
                      <option value="years">年数を指定</option>
                    </select>
                  </label>

                  {design.durationMode === 'years' ? (
                    <label className="second-life-inline-option third-life-field-row">
                      <span>介護を見込む年数</span>
                      <span>
                        <input
                          type="number"
                          className="second-life-age-input"
                          min={1}
                          max={50}
                          value={design.durationYears ?? 5}
                          onChange={(event) =>
                            updateTarget(key, {
                              durationYears: Math.min(
                                50,
                                Math.max(1, Number(event.target.value) || 1),
                              ),
                            })
                          }
                        />
                        年間
                      </span>
                    </label>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="second-life-section-actions">
        <p className="second-life-apply-note">{applyMessage}</p>
        <button
          type="button"
          className="second-life-apply-btn"
          onClick={onApply}
          disabled={applyStatus === 'done' || hasUnpricedDesign}
        >
          {applyStatus === 'done'
            ? 'サードライフ設計は反映済み'
            : 'このサードライフ設計を反映する'}
        </button>
        {onOpenLifeEvent ? (
          <button
            type="button"
            className="second-life-guide-nav-btn"
            onClick={onOpenLifeEvent}
          >
            反映先のライフイベントを確認する →
          </button>
        ) : null}
      </div>
    </section>
  );
}
""")

# 8. Q12 title and tab wording.
p = 'src/components/secondLife/SecondLifeGuideStep.tsx'
s = read(p)
s = s.replace("{ id: 'third-life', label: 'サードライフ' },", "{ id: 'third-life', label: '介護・サードライフ' },")
s = s.replace('title="セカンドライフ"', 'title="老後の暮らし"')
s = s.replace(
    'lead="これからの住まい・生活費と、その先の介護まで整理します"',
    'lead="元気に暮らす時期と、介護が必要になった後まで分けて整理します"',
)
s = s.replace(
    'まず、何歳からセカンドライフとして考えるかを決めます。住まい・生活費はその時期以降を設計し、介護は「サードライフ」として別に整理します。元の入力は消えません。',
    '元気に暮らす時期を「セカンドライフ」、介護が必要になった後をこのソフトでは「サードライフ」と呼び、同じ「老後の暮らし」の中で分けて設計します。元の入力は消えません。',
)
s = s.replace("? 'サードライフを編集する →'", "? '介護・サードライフを編集する →'")
write(p, s)

# 9. Guide/status: projections now consist of recurring + initial entries.
p = 'src/lib/secondLifeGuide.ts'
s = read(p)
s = s.replace("import { getSecondLifeManagedLifeEventSource } from './lifeEventSource';", "import {\n  getSecondLifeManagedLifeEventSource,\n  THIRD_LIFE_NURSING_INITIAL_EVENT_LABEL,\n  THIRD_LIFE_NURSING_RECURRING_EVENT_LABEL,\n} from './lifeEventSource';")
s = s.replace("  getDefaultNursingAnnualCostMan,\n", "")
s = replace_once(
    s,
    "import type { StepId } from '../types/steps';\n",
    "import type { StepId } from '../types/steps';\nimport {\n  formatThirdLifeCareDuration,\n  getThirdLifeAnnualAdditionalCostMan,\n  getThirdLifeCareEndAge,\n  THIRD_LIFE_CARE_SCENARIO_LABELS,\n} from './thirdLifeCare';\n",
    'guide third life import',
)
# remove old scenario labels const
s = re.sub(r"\nconst NURSING_SCENARIO_LABELS: Record<SecondLifeNursingScenario, string> = \{[\s\S]*?\n\};\n", "\n", s, count=1)
s = s.replace("  SecondLifeNursingScenario,\n", "")
start = s.index('function findNursingProjection(')
end = s.index('\nexport function buildSecondLifeGuide', start)
new_block = r'''function findNursingProjections(entries: LifeEventEntry[]) {
  const managed = entries.filter(
    (entry) =>
      getSecondLifeManagedLifeEventSource(entry) === 'second_life_nursing',
  );
  return {
    all: managed,
    recurring: managed.find(
      (entry) =>
        entry.label === THIRD_LIFE_NURSING_RECURRING_EVENT_LABEL ||
        entry.endMode !== 'once',
    ),
    initial: managed.find(
      (entry) =>
        entry.label === THIRD_LIFE_NURSING_INITIAL_EVENT_LABEL ||
        entry.endMode === 'once',
    ),
  };
}

function buildNursingChecklistItem(
  lifeEventState: LifeEventState,
  members: FamilyMember[],
  secondLifeState?: SecondLifeState,
): SecondLifeChecklistItem {
  const targets = ([
    ['head', 'head'],
    ['spouse', 'spouse'],
  ] as const)
    .map(([key, role]) => ({
      key,
      member: members.find((member) => member.role === role),
    }))
    .filter(
      (
        item,
      ): item is {
        key: SecondLifeNursingTarget;
        member: FamilyMember;
      } => Boolean(item.member),
    );

  const detailLines: string[] = [];

  if (!secondLifeState) {
    let configured = 0;
    for (const { member } of targets) {
      const projection = findNursingProjections(
        lifeEventState.byMember[member.id] ?? [],
      );
      if (projection.all.length === 0) continue;
      configured += 1;
      detailLines.push(`${getMemberTabLabel(member)}：介護費の連動データあり`);
    }
    return {
      id: 'nursing',
      stepId: 'life-event',
      stepLabel: '3',
      title: '介護・サードライフ',
      status:
        configured === targets.length && targets.length > 0
          ? 'done'
          : configured > 0
            ? 'partial'
            : 'missing',
      summary:
        configured > 0
          ? `介護費 ${configured}/${targets.length}人 反映済み`
          : '介護費が未反映です',
      detailLines,
    };
  }

  let activeDesigns = 0;
  let applied = 0;
  let needsRefresh = 0;
  let needsCost = 0;

  for (const { key, member } of targets) {
    const design = secondLifeState.nursingByTarget[key];
    const projections = findNursingProjections(
      lifeEventState.byMember[member.id] ?? [],
    );

    if (design.skip) {
      if (projections.all.length > 0) {
        needsRefresh += 1;
        detailLines.push(
          `${getMemberTabLabel(member)}：介護費を見込まない / 既存の連動データ削除の反映が必要`,
        );
      } else {
        detailLines.push(`${getMemberTabLabel(member)}：介護費を見込まない`);
      }
      continue;
    }

    activeDesigns += 1;
    const annualCost = getThirdLifeAnnualAdditionalCostMan(design);
    const initialCost = Math.max(0, design.initialCostMan);
    if (annualCost <= 0 && initialCost <= 0) {
      needsCost += 1;
      detailLines.push(
        `${getMemberTabLabel(member)}：${design.startAge}歳〜 ${THIRD_LIFE_CARE_SCENARIO_LABELS[design.scenario]} / 費用未入力`,
      );
      continue;
    }

    const expectedEndAge = getThirdLifeCareEndAge(
      design,
      member.expectedLifespan,
    );
    const recurringApplied =
      annualCost <= 0
        ? projections.recurring == null
        : projections.recurring != null &&
          projections.recurring.startAge === design.startAge &&
          projections.recurring.amountMan === annualCost &&
          projections.recurring.endMode ===
            (design.durationMode === 'years' ? 'until' : 'lifetime') &&
          (design.durationMode === 'lifetime' ||
            projections.recurring.endAge === expectedEndAge);
    const initialApplied =
      initialCost <= 0
        ? projections.initial == null
        : projections.initial != null &&
          projections.initial.startAge === design.startAge &&
          projections.initial.amountMan === initialCost &&
          projections.initial.endMode === 'once';
    const isApplied = recurringApplied && initialApplied;

    if (isApplied) {
      applied += 1;
    } else if (projections.all.length > 0) {
      needsRefresh += 1;
    }

    detailLines.push(
      `${getMemberTabLabel(member)}：${design.startAge}歳〜 ${THIRD_LIFE_CARE_SCENARIO_LABELS[design.scenario]}・月${design.monthlyCostMan}万円＋開始時${initialCost}万円（${formatThirdLifeCareDuration(design)}） / ${
        isApplied ? '反映済み' : projections.all.length > 0 ? '再反映が必要' : '未反映'
      }`,
    );
  }

  const allSkipped = activeDesigns === 0;
  const allApplied =
    activeDesigns > 0 &&
    applied === activeDesigns &&
    needsRefresh === 0 &&
    needsCost === 0;
  const status: SecondLifeChecklistStatus =
    (allSkipped && needsRefresh === 0) || allApplied ? 'done' : 'partial';

  return {
    id: 'nursing',
    stepId: 'life-event',
    stepLabel: '3',
    title: '介護・サードライフ',
    status,
    summary: allSkipped
      ? needsRefresh > 0
        ? '介護費を見込まない設定へ変更したため、既存の連動データ削除の反映が必要です'
        : '介護費は見込まない設定です'
      : needsCost > 0
        ? '介護の想定はありますが、追加費用が未入力です'
        : allApplied
          ? `サードライフ設計 ${applied}/${activeDesigns}人 反映済み`
          : needsRefresh > 0
            ? 'サードライフ設計を変更したため、最新内容の再反映が必要です'
            : 'サードライフ設計はありますが、まだ反映されていません',
    detailLines,
  };
}
'''
s = s[:start] + new_block + s[end:]
write(p, s)

# 10. Existing annual default helper must remain type-safe for any compatibility callers, but no longer supplies hidden money.
p = 'src/lib/secondLifeEstimates.ts'
s = read(p)
s = re.sub(
    r"const NURSING_DEFAULT_ANNUAL_MAN: Record<SecondLifeNursingScenario, number> = \{[\s\S]*?\n\};\n",
    "",
    s,
    count=1,
)
s = replace_once(
    s,
    "export function getDefaultNursingAnnualCostMan(\n  scenario: SecondLifeNursingScenario,\n): number {\n  return NURSING_DEFAULT_ANNUAL_MAN[scenario];\n}\n",
    "export function getDefaultNursingAnnualCostMan(\n  _scenario: SecondLifeNursingScenario,\n): number {\n  // 介護費は施設・利用条件による差が大きいため、Q12では自動設定しない。\n  return 0;\n}\n",
    'legacy nursing default helper',
)
write(p, s)

# 11. CSS for collapsible explanations and detailed fields.
p = 'src/components/secondLife/SecondLifeWorkspaceTabs.css'
s = read(p)
s += r'''

.third-life-reference-details {
  margin-top: 12px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 9px;
  background: #fff;
}

.third-life-reference-details > summary,
.third-life-selected-description > summary {
  cursor: pointer;
  font-weight: 700;
  color: var(--color-brand);
}

.third-life-reference-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.third-life-reference-item {
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: #fafafa;
}

.third-life-reference-item h4 {
  margin: 0 0 6px;
  font-size: var(--text-sm);
}

.third-life-reference-item p,
.third-life-cost-note p,
.third-life-selected-description p {
  margin: 0 0 6px;
  font-size: var(--text-sm);
  line-height: 1.65;
  color: var(--color-muted);
}

.third-life-reference-item a,
.third-life-selected-description a {
  font-size: var(--text-sm);
  color: var(--color-brand);
}

.third-life-person-grid {
  margin-top: 14px;
}

.third-life-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}

.third-life-field-row {
  justify-content: space-between;
  gap: 12px;
}

.third-life-field-row > span:first-child {
  font-weight: 600;
}

.third-life-selected-description {
  margin: 2px 0 6px;
  padding: 8px 10px;
  border-left: 3px solid var(--color-brand-soft);
  background: #fafafa;
}

.third-life-selected-description[open] > summary {
  margin-bottom: 8px;
}

@media (max-width: 960px) {
  .third-life-reference-list {
    grid-template-columns: 1fr;
  }

  .third-life-field-row {
    align-items: flex-start;
    flex-direction: column;
  }
}
'''
write(p, s)

print('old-age/third-life patch applied')
