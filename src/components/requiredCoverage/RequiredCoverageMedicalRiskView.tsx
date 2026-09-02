import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { HousingManInput } from '../housing/HousingManInput';
import { HousingYenInput } from '../housing/HousingYenInput';
import type { CashFlowInput } from '../../lib/cashFlow';
import {
  HIGH_COST_BRACKET_CAP_FORMULAS,
  HIGH_COST_BRACKET_ORDER,
  HIGH_COST_BRACKET_RANGE_LABELS,
  HIGH_COST_BRACKET_SHORT_LABELS,
  calcHighCostMonthlySelfPayYen,
  manToYen,
  yenToMan,
  type HighCostIncomeBracket,
} from '../../lib/highCostMedicalExpenses';
import {
  MEDICAL_RISK_ASSUMED_MONTHLY_MEDICAL_MAN,
  MEDICAL_RISK_FIXED_COPAY_RATE,
  MEDICAL_RISK_REFERENCE_MONTHLY_TOTAL_MEDICAL_MAN,
  calcMedicalRiskCoverage,
  calcSickLeaveAllowance,
  quoteMemberMonthlyIncomeMan,
  resolveMedicalRiskMonthlyIncomeMan,
  sumStoppableExpenseManPerMonth,
  type MedicalRiskCoverageResult,
} from '../../lib/requiredCoverage';
import {
  MEDICAL_DISEASE_CATEGORY_LABELS,
  MEDICAL_DISEASE_CATEGORY_ORDER,
  MEDICAL_DISEASE_PRESET_HELP,
  MEDICAL_TREATMENT_GUIDELINE_LINKS,
  getMedicalDiseasePresetsByCategory,
  getMedicalDiseasePresetByKey,
  type MedicalDiseaseCategory,
  type MedicalDiseasePreset,
  type MedicalReferenceLink,
} from '../../lib/medicalDiseasePresets';
import type {
  MedicalEmploymentType,
  RequiredCoverageMedicalDesign,
  RequiredCoverageState,
  RequiredCoverageSubject,
} from '../../types/requiredCoverage';
import {
  MEDICAL_STOPPABLE_EXPENSE_LABELS,
  MEDICAL_STOPPABLE_EXPENSE_NOTES,
  MEDICAL_STOPPABLE_EXPENSE_ORDER,
} from '../../types/requiredCoverage';

interface RequiredCoverageMedicalRiskViewProps {
  cashFlowInput: CashFlowInput;
  state: RequiredCoverageState;
  subject: RequiredCoverageSubject;
  subjectLabel: string;
  onChange: (state: RequiredCoverageState) => void;
}

type FlashTarget = 'treatment' | 'inpatient' | 'incomeLoss';

function formatManTenths(value: number): string {
  return (Math.round(value * 10) / 10).toLocaleString('ja-JP');
}

function formatYen(value: number): string {
  return Math.round(value).toLocaleString('ja-JP');
}

function manToDisplayYen(man: number): number {
  return Math.round(man * 10_000);
}

type MedicalHelpKind =
  | 'diseasePreset'
  | 'treatmentMonths'
  | 'sickLeave'
  | 'extraBed'
  | 'meal'
  | 'clothing'
  | 'transport'
  | 'consumables';

type MedicalHelpLinkGroup = {
  heading: string;
  links: MedicalReferenceLink[];
};

type MedicalHelpContent = {
  title: string;
  body: string;
  linkGroups?: MedicalHelpLinkGroup[];
};

const MEDICAL_HELP_CONTENT: Record<
  Exclude<MedicalHelpKind, 'diseasePreset'>,
  MedicalHelpContent
> = {
  treatmentMonths: {
    title: '治療月数について',
    body: '治療費が毎月どれほどかかるかは、病気や治療内容によって大きく変わり、正確に予測するのは難しいものです。そのためこの試算では、最悪のケースを想定し、「毎月自己負担が限度額いっぱいになる」として医療費を見積もっています。ここで入力する治療月数は、入院・手術・通院を含め、そうした月が続く期間です。年あたりではなく、このシナリオ全体の月数を入れてください。4か月目以降は多数回該当により、自己負担が軽減されます。\n\nなお「高額療養費が発生する月数」そのものの公的統計はありません。がんの術後補助化学療法が約6か月など、治療期間の目安は診療ガイドライン等にあります。この試算の治療月数はそれらを参考にした目安値です。',
    linkGroups: [
      {
        heading: '治療月数の参考（診療ガイドライン）',
        links: MEDICAL_TREATMENT_GUIDELINE_LINKS,
      },
    ],
  },
  sickLeave: {
    title: '傷病手当金について',
    body: '傷病手当金は、会社員・公務員など健康保険（協会けんぽ・健保組合など）に加入している人が、業務外の病気やケガで働けなくなったときに、給与の代わりとして支給される給付です。\n\n支給額の目安は、おおむね月収の2/3です。支給期間は、支給開始日から通算して最長1年6か月です。\n\nこの試算では、会社員の場合「収入の目減り（月額）」の初期値を「月収 − 傷病手当金（月収の2/3）」＝月収の約1/3として自動セットします。合計は「目減り額 × 治療月数」で表示します。個人事業主など、傷病手当金の対象外の方には傷病手当の行は出ません。\n\nなお、実際には連続して3日間仕事を休んだあとの4日目から支給される「待期期間」があります。この試算では待期期間の3日間は考慮していません。また、給与が一部支給される場合の調整なども簡略化しています。参考値としてご確認ください。',
    linkGroups: [
      {
        heading: '参考リンク',
        links: [
          {
            label: '協会けんぽ 傷病手当金',
            url: 'https://www.kyoukaikenpo.or.jp/benefit/injury_and_sickness_allowance/index.html',
          },
        ],
      },
    ],
  },
  extraBed: {
    title: '差額ベッド代について',
    body: '差額ベッド代とは、個室を希望した場合にのみかかる費用です。個室の代金の平均額は、1人個室で約8,000円、2〜4人部屋で約3,000円です。差額ベッド代は医療費と関係ないので、全て自己負担です。既定値は1人個室の平均である8,000円／日としています。',
  },
  meal: {
    title: '食事代について',
    body: '入院時の食事代は法令で1食あたり460円と定められています。1日3食として、460円 × 3食 = 1,380円／日を既定値としています。',
  },
  clothing: {
    title: '着替え代について',
    body: '病院内でサニタリーグッズ専門の業者が提携しているところもあり、着替え・タオル・ティッシュ・箸やスプーンなどが使い放題で、おおよそ日額500円です。これを既定値としています。',
  },
  transport: {
    title: '交通費について',
    body: 'お見舞いの頻度が多く、高速道路やタクシーを利用しなければならない場合など、費用がかかることが想定されるときに入力してください。既定値は0円です。',
  },
  consumables: {
    title: '消耗品代について',
    body: 'テレビカード代、スキンケア用品、コンビニ代などの細かい費用です。手持ちの現金で補えば十分のため、既定値は0円としています。',
  },
};

function uniqueLinks(links: MedicalReferenceLink[]): MedicalReferenceLink[] {
  const map = new Map<string, MedicalReferenceLink>();
  for (const link of links) {
    map.set(link.url, link);
  }
  return [...map.values()];
}

function resolveMedicalHelpContent(
  kind: MedicalHelpKind,
  preset?: MedicalDiseasePreset | null,
): MedicalHelpContent {
  if (kind === 'diseasePreset') {
    const parts: string[] = [MEDICAL_DISEASE_PRESET_HELP.body];
    const inpatientLinks = [...MEDICAL_DISEASE_PRESET_HELP.inpatientLinks];
    const treatmentLinks = [...MEDICAL_DISEASE_PRESET_HELP.treatmentLinks];

    if (preset) {
      parts.push('', `【選択中: ${preset.label}】`);
      if (preset.inpatientDaysSource) {
        parts.push(`入院日数: ${preset.inpatientDaysSource.summary}`);
        inpatientLinks.push(...preset.inpatientDaysSource.links);
      }
      if (preset.treatmentMonthsSource) {
        parts.push(`治療月数: ${preset.treatmentMonthsSource.summary}`);
        treatmentLinks.push(...preset.treatmentMonthsSource.links);
      }
    }

    return {
      title: MEDICAL_DISEASE_PRESET_HELP.title,
      body: parts.join('\n'),
      linkGroups: [
        {
          heading: '入院日数の参照',
          links: uniqueLinks(inpatientLinks),
        },
        {
          heading: '治療月数の参照',
          links: uniqueLinks(treatmentLinks),
        },
      ],
    };
  }
  return MEDICAL_HELP_CONTENT[kind];
}

function MedicalReferenceLinks({ links }: { links: MedicalReferenceLink[] }) {
  if (links.length === 0) return null;
  return (
    <ul className="required-coverage-medical-source-links">
      {links.map((link) => (
        <li key={link.url}>
          <a href={link.url} target="_blank" rel="noopener noreferrer">
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

function MedicalHelpLinkGroups({ groups }: { groups: MedicalHelpLinkGroup[] }) {
  const visible = groups.filter((group) => group.links.length > 0);
  if (visible.length === 0) return null;
  return (
    <div className="required-coverage-medical-source-groups">
      {visible.map((group) => (
        <section
          key={group.heading}
          className="required-coverage-medical-source-group"
        >
          <h4 className="required-coverage-medical-source-group-title">
            {group.heading}
          </h4>
          <MedicalReferenceLinks links={group.links} />
        </section>
      ))}
    </div>
  );
}

function MedicalHelpModal({
  kind,
  preset,
  onClose,
}: {
  kind: MedicalHelpKind;
  preset?: MedicalDiseasePreset | null;
  onClose: () => void;
}) {
  const content = resolveMedicalHelpContent(kind, preset);
  return (
    <div className="education-ref-modal-overlay" onClick={onClose}>
      <div
        className="education-ref-modal required-coverage-medical-help-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`required-coverage-medical-help-${kind}`}
      >
        <button
          type="button"
          className="education-ref-modal-close"
          onClick={onClose}
          aria-label="閉じる"
        >
          ×
        </button>
        <h3
          id={`required-coverage-medical-help-${kind}`}
          className="education-ref-modal-title"
        >
          {content.title}
        </h3>
        <div className="required-coverage-medical-help-scroll">
          <p className="required-coverage-medical-help-body">
            {content.body.split('\n').map((line, index) =>
              line ? (
                <span key={index}>
                  {index > 0 ? <br /> : null}
                  {line}
                </span>
              ) : (
                <br key={index} />
              ),
            )}
          </p>
          {content.linkGroups ? (
            <MedicalHelpLinkGroups groups={content.linkGroups} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MedicalHelpButton({
  kind,
  onOpen,
  label,
}: {
  kind: MedicalHelpKind;
  onOpen: (kind: MedicalHelpKind) => void;
  label?: string;
}) {
  const content = resolveMedicalHelpContent(kind);
  return (
    <button
      type="button"
      className="required-coverage-help-icon"
      aria-label={label ?? content.title}
      aria-haspopup="dialog"
      onClick={() => onOpen(kind)}
    >
      ?
    </button>
  );
}

function patchMedicalDesign(
  state: RequiredCoverageState,
  subject: RequiredCoverageSubject,
  patch: Partial<RequiredCoverageMedicalDesign>,
): RequiredCoverageState {
  const current = state.medicalDesigns[subject];
  return {
    ...state,
    medicalDesigns: {
      ...state.medicalDesigns,
      [subject]: {
        ...current,
        ...patch,
      },
    },
  };
}

function MedicalLineRow({
  label,
  labelExtra,
  note,
  input,
  formula,
  amountYen,
  tone,
  flash,
  indented,
  onToggle,
  expanded,
}: {
  label: string;
  labelExtra?: ReactNode;
  note?: string;
  input?: ReactNode;
  formula?: string | null;
  amountYen: number | null;
  tone?: 'need' | 'benefit' | 'computed' | 'section';
  flash?: boolean;
  indented?: boolean;
  onToggle?: () => void;
  expanded?: boolean;
}) {
  const classNames = [
    'required-coverage-medical-line',
    tone ? `is-${tone}` : null,
    flash ? 'is-flash' : null,
    indented ? 'is-indented' : null,
    onToggle ? 'is-toggle' : null,
  ]
    .filter(Boolean)
    .join(' ');

  const labelContent = (
    <>
      <span className="required-coverage-medical-line-label-main">
        <span>{label}</span>
        {labelExtra}
        {onToggle ? (
          <span className="required-coverage-medical-line-toggle-action">
            {expanded ? '閉じる' : '詳細を開く'}
            <span aria-hidden>{expanded ? '▴' : '▾'}</span>
          </span>
        ) : null}
      </span>
      {note ? (
        <span className="required-coverage-medical-line-note">{note}</span>
      ) : null}
    </>
  );

  return (
    <div className={classNames}>
      {onToggle ? (
        <button
          type="button"
          className="required-coverage-medical-line-label is-button"
          aria-expanded={expanded}
          onClick={onToggle}
        >
          {labelContent}
        </button>
      ) : (
        <div className="required-coverage-medical-line-label">{labelContent}</div>
      )}
      <div className="required-coverage-medical-line-input">
        {input ?? <span className="required-coverage-medical-line-empty">—</span>}
      </div>
      <div className="required-coverage-medical-line-formula">
        {formula ? (
          formula
        ) : (
          <span className="required-coverage-medical-line-empty">—</span>
        )}
      </div>
      <div className="required-coverage-medical-line-amount">
        {amountYen == null ? (
          <span className="required-coverage-medical-line-empty">—</span>
        ) : (
          <>
            {formatYen(amountYen)}
            <span className="amount-unit">円</span>
          </>
        )}
      </div>
    </div>
  );
}

function MedicalSection({
  id,
  title,
  reflect,
  children,
  defaultOpen = true,
  collapsible = false,
  summary,
}: {
  id: string;
  title: string;
  reflect?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  collapsible?: boolean;
  summary?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const headingId = `required-coverage-medical-section-${id}`;

  if (!collapsible) {
    return (
      <section
        className="required-coverage-medical-section"
        aria-labelledby={headingId}
      >
        <div className="required-coverage-medical-section-head">
          <h4 id={headingId} className="required-coverage-medical-section-title">
            {title}
          </h4>
          {reflect ? (
            <p className="required-coverage-medical-section-reflect">{reflect}</p>
          ) : null}
          {summary}
        </div>
        <div className="required-coverage-medical-section-body">{children}</div>
      </section>
    );
  }

  return (
    <section
      className={
        open
          ? 'required-coverage-medical-section is-collapsible is-open'
          : 'required-coverage-medical-section is-collapsible is-collapsed'
      }
      aria-labelledby={headingId}
    >
      <button
        type="button"
        className="required-coverage-medical-section-toggle"
        aria-expanded={open}
        aria-controls={`${headingId}-body`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="required-coverage-medical-section-toggle-main">
          <h4 id={headingId} className="required-coverage-medical-section-title">
            {title}
          </h4>
          {reflect ? (
            <span className="required-coverage-medical-section-reflect">
              {reflect}
            </span>
          ) : null}
        </span>
        <span className="required-coverage-medical-section-toggle-side">
          {summary}
          <span className="required-coverage-medical-section-toggle-action">
            <span className="required-coverage-medical-section-toggle-label">
              {open ? '閉じる' : '詳細を開く'}
            </span>
            <span
              className="required-coverage-medical-section-chevron"
              aria-hidden
            >
              {open ? '▴' : '▾'}
            </span>
          </span>
        </span>
      </button>
      {open ? (
        <div
          id={`${headingId}-body`}
          className="required-coverage-medical-section-body"
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}

function bracketCapsForTotalMan(
  bracket: HighCostIncomeBracket,
  totalMan: number,
): {
  normalMan: number;
  multipleMan: number;
} {
  const totalMedicalYen = manToYen(totalMan);
  return {
    normalMan: yenToMan(
      calcHighCostMonthlySelfPayYen({
        bracket,
        totalMedicalYen,
        copayRate: MEDICAL_RISK_FIXED_COPAY_RATE,
        multipleTimesApplicable: false,
      }),
    ),
    multipleMan: yenToMan(
      calcHighCostMonthlySelfPayYen({
        bracket,
        totalMedicalYen,
        copayRate: MEDICAL_RISK_FIXED_COPAY_RATE,
        multipleTimesApplicable: true,
      }),
    ),
  };
}

function buildTreatmentFormula(result: MedicalRiskCoverageResult): string {
  const { normalSelfPayMonths, multipleTimesSelfPayMonths } = result;
  if (normalSelfPayMonths <= 0 && multipleTimesSelfPayMonths <= 0) {
    return '—';
  }
  const parts: string[] = [];
  if (normalSelfPayMonths > 0) {
    parts.push(
      `${normalSelfPayMonths}か月 × ${formatYen(manToDisplayYen(result.normalMonthlySelfPayMan))}円`,
    );
  }
  if (
    multipleTimesSelfPayMonths > 0 &&
    result.multipleTimesMonthlySelfPayMan != null
  ) {
    parts.push(
      `${multipleTimesSelfPayMonths}か月 × ${formatYen(manToDisplayYen(result.multipleTimesMonthlySelfPayMan))}円`,
    );
  }
  return parts.join(' ＋ ');
}

const EMPLOYMENT_TYPE_OPTIONS: {
  id: MedicalEmploymentType;
  label: string;
}[] = [
  { id: 'employee', label: '会社員・公務員' },
  { id: 'selfEmployed', label: '個人事業主' },
  { id: 'other', label: 'その他' },
];

const FLASH_MS = 1600;

export function RequiredCoverageMedicalRiskView({
  cashFlowInput,
  state,
  subject,
  subjectLabel,
  onChange,
}: RequiredCoverageMedicalRiskViewProps) {
  const design = state.medicalDesigns[subject];
  const [selectedCategory, setSelectedCategory] =
    useState<MedicalDiseaseCategory>('average');
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>(
    () => getMedicalDiseasePresetsByCategory('average')[0]?.key ?? '',
  );
  const [helpKind, setHelpKind] = useState<MedicalHelpKind | null>(null);
  const [stoppableOpen, setStoppableOpen] = useState(false);
  const [flashTargets, setFlashTargets] = useState<Set<FlashTarget>>(
    () => new Set(),
  );

  useEffect(() => {
    if (flashTargets.size === 0) return;
    const timer = window.setTimeout(() => {
      setFlashTargets(new Set());
    }, FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [flashTargets]);

  const triggerFlash = (targets: FlashTarget[]) => {
    setFlashTargets(new Set(targets));
  };

  const quotedMonthlyIncomeMan = useMemo(
    () => quoteMemberMonthlyIncomeMan(cashFlowInput, subject),
    [cashFlowInput, subject],
  );
  const effectiveMonthlyIncomeMan = useMemo(
    () => resolveMedicalRiskMonthlyIncomeMan(design, quotedMonthlyIncomeMan),
    [design, quotedMonthlyIncomeMan],
  );
  const usingQuotedIncome =
    design.monthlyIncomeMan <= 0 && quotedMonthlyIncomeMan > 0;
  const displayedIncomeMan =
    design.monthlyIncomeMan > 0
      ? design.monthlyIncomeMan
      : quotedMonthlyIncomeMan;

  const presetsForCategory = getMedicalDiseasePresetsByCategory(selectedCategory);

  const sickLeaveMonthlyEstimate =
    design.employmentType === 'employee' && effectiveMonthlyIncomeMan > 0
      ? Math.round((effectiveMonthlyIncomeMan * (2 / 3)) * 10) / 10
      : null;
  const suggestedIncomeLossManPerMonth =
    design.employmentType === 'employee' && effectiveMonthlyIncomeMan > 0
      ? Math.max(
          0,
          Math.round((effectiveMonthlyIncomeMan / 3) * 10) / 10,
        )
      : null;
  const showSickLeaveRows = sickLeaveMonthlyEstimate != null;
  const effectiveIncomeLossManPerMonth =
    !design.incomeLossManual && suggestedIncomeLossManPerMonth != null
      ? suggestedIncomeLossManPerMonth
      : design.incomeLossManPerMonth;

  const coverageDesign = useMemo(
    () =>
      effectiveIncomeLossManPerMonth === design.incomeLossManPerMonth
        ? design
        : {
            ...design,
            incomeLossManPerMonth: effectiveIncomeLossManPerMonth,
          },
    [design, effectiveIncomeLossManPerMonth],
  );
  const result: MedicalRiskCoverageResult = useMemo(
    () => calcMedicalRiskCoverage(coverageDesign, quotedMonthlyIncomeMan),
    [coverageDesign, quotedMonthlyIncomeMan],
  );
  const sickLeaveTotal =
    design.employmentType === 'employee'
      ? calcSickLeaveAllowance(
          effectiveMonthlyIncomeMan,
          design.hospitalMonthsPerYear,
        )
      : 0;

  const netIncomeLossManPerMonth = Math.max(
    0,
    Math.round(
      (effectiveIncomeLossManPerMonth -
        sumStoppableExpenseManPerMonth(design.stoppableExpensesYen)) *
        10,
    ) / 10,
  );
  const stoppableExpenseManPerMonth = sumStoppableExpenseManPerMonth(
    design.stoppableExpensesYen,
  );
  const incomeLossCoveredByStoppable =
    effectiveIncomeLossManPerMonth > 0 &&
    stoppableExpenseManPerMonth >= effectiveIncomeLossManPerMonth;

  const handleLoadPreset = () => {
    const preset = getMedicalDiseasePresetByKey(selectedPresetKey);
    if (!preset) return;
    onChange(
      patchMedicalDesign(state, subject, {
        hospitalMonthsPerYear: preset.treatmentMonthsPerYear,
        inpatientDays: preset.inpatientDays,
        diseasePreset: preset.key,
      }),
    );
    triggerFlash(['treatment', 'inpatient']);
  };

  const inpatientDays = result.inpatientDays;

  return (
    <div className="required-coverage-medical">
      <div className="required-coverage-medical-intro">
        <h3
          id="required-coverage-medical-heading"
          className="required-coverage-card-title"
        >
          手術・入院の必要保障額
        </h3>
        <p className="required-coverage-card-note">
          {subjectLabel}
          の入院・手術は
          <a
            href="https://www.kyoukaikenpo.or.jp/benefit/high_cost_medical_expenses/002/#heading-3"
            target="_blank"
            rel="noopener noreferrer"
          >
            高額療養費制度
          </a>
          （令和8年8月〜・70歳未満）で試算します。
        </p>
      </div>

      <MedicalSection
        id="preset"
        title="1. 疾患の前提"
        reflect="反映先: 治療月数・入院日数"
      >
        <div className="required-coverage-medical-preset">
          <div className="required-coverage-medical-preset-title">
            <span className="required-coverage-medical-preset-title-main">
              疾患プリセット
              <MedicalHelpButton kind="diseasePreset" onOpen={setHelpKind} />
            </span>
            <span className="required-coverage-medical-preset-badge">
              参考値（統計ベース）
            </span>
          </div>
          <p className="required-coverage-medical-preset-note">
            三大疾病の代表的な疾患を選ぶと、平均的な治療月数・入院日数が「2.
            医療費」に自動入力されます。入力後は自由に変更できます。
          </p>
          <div className="required-coverage-medical-preset-selects">
            <div className="required-coverage-medical-preset-row">
              <label className="required-coverage-medical-field-label">
                疾病カテゴリ
              </label>
              <select
                className="required-coverage-medical-preset-select"
                value={selectedCategory}
                onChange={(e) => {
                  const cat = e.target.value as MedicalDiseaseCategory;
                  setSelectedCategory(cat);
                  const first = getMedicalDiseasePresetsByCategory(cat)[0];
                  if (first) setSelectedPresetKey(first.key);
                }}
              >
                {MEDICAL_DISEASE_CATEGORY_ORDER.map((cat) => (
                  <option key={cat} value={cat}>
                    {MEDICAL_DISEASE_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>
            <div className="required-coverage-medical-preset-row">
              <label className="required-coverage-medical-field-label">
                疾患
              </label>
              <select
                className="required-coverage-medical-preset-select is-wide"
                value={selectedPresetKey}
                onChange={(e) => setSelectedPresetKey(e.target.value)}
              >
                {presetsForCategory.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}（入院約{p.inpatientDays}日・治療約
                    {p.treatmentMonthsPerYear}か月）
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="button"
            className="required-coverage-medical-preset-load"
            onClick={handleLoadPreset}
          >
            この疾患の参考値を読み込む
          </button>
        </div>
      </MedicalSection>

      <MedicalSection
        id="income-base"
        title="2. 月収・就業形態"
        reflect="反映先: 高額療養費の所得区分・傷病手当の試算"
      >
        <div className="required-coverage-medical-income">
          <div className="required-coverage-medical-income-fields">
            <label className="required-coverage-medical-income-field">
              <span className="required-coverage-medical-field-label">月収</span>
              <HousingManInput
                compact
                value={displayedIncomeMan}
                step={1}
                unit="万円"
                onChange={(monthlyIncomeMan) =>
                  onChange(
                    patchMedicalDesign(state, subject, { monthlyIncomeMan }),
                  )
                }
              />
            </label>
            <label className="required-coverage-medical-income-field">
              <span className="required-coverage-medical-field-label">
                就業形態
              </span>
              <select
                className="required-coverage-medical-employment-select"
                value={design.employmentType}
                onChange={(e) =>
                  onChange(
                    patchMedicalDesign(state, subject, {
                      employmentType: e.target.value as MedicalEmploymentType,
                    }),
                  )
                }
              >
                {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="required-coverage-medical-low-income">
            <input
              type="checkbox"
              checked={design.isLowIncome}
              onChange={(event) =>
                onChange(
                  patchMedicalDesign(state, subject, {
                    isLowIncome: event.target.checked,
                  }),
                )
              }
            />
            住民税非課税（区分オ）
          </label>
          {!quotedMonthlyIncomeMan && design.monthlyIncomeMan <= 0 && (
            <p className="required-coverage-medical-income-quote">
              月収を入力してください。ライフプランに収入があれば、あとから引用できます。
            </p>
          )}
          {usingQuotedIncome && (
            <p className="required-coverage-medical-income-quote">
              ライフプランの月収を引用中です（手入力で上書きできます）。
            </p>
          )}
          {quotedMonthlyIncomeMan > 0 && !usingQuotedIncome && (
            <button
              type="button"
              className="required-coverage-medical-quote-reset"
              onClick={() =>
                onChange(
                  patchMedicalDesign(state, subject, {
                    monthlyIncomeMan: 0,
                  }),
                )
              }
            >
              ライフプランの月収に戻す
            </button>
          )}
        </div>
      </MedicalSection>

      <MedicalSection
        id="medical"
        title="3. 医療費"
        reflect="疾患プリセットの治療月数・入院日数がここに入ります"
        summary={
          <span className="required-coverage-medical-section-amount">
            {formatYen(manToDisplayYen(result.annualMedicalSelfPayMan))}円
          </span>
        }
      >
        <div
          className="required-coverage-medical-lines"
          role="table"
          aria-label="医療費の試算"
        >
          <div className="required-coverage-medical-line is-header" role="row">
            <div className="required-coverage-medical-line-label">項目</div>
            <div className="required-coverage-medical-line-input">入力</div>
            <div className="required-coverage-medical-line-formula">計算根拠</div>
            <div className="required-coverage-medical-line-amount">金額</div>
          </div>

          <MedicalLineRow
            label="治療月数"
            labelExtra={
              <MedicalHelpButton kind="treatmentMonths" onOpen={setHelpKind} />
            }
            note={`試算医療費 ${formatManTenths(result.monthlyTotalMedicalCostMan)}万円／月（${HIGH_COST_BRACKET_SHORT_LABELS[result.incomeBracket]}）`}
            flash={flashTargets.has('treatment')}
            input={
              <div className="housing-man-input housing-man-input--inline">
                <input
                  type="number"
                  className="amount-input amount-input--compact"
                  min={0}
                  max={12}
                  step={1}
                  value={design.hospitalMonthsPerYear}
                  aria-label="治療月数"
                  onChange={(event) => {
                    const newTreatment = Math.max(
                      0,
                      Math.min(12, Number(event.target.value) || 0),
                    );
                    const maxDays = newTreatment * 30;
                    onChange(
                      patchMedicalDesign(state, subject, {
                        hospitalMonthsPerYear: newTreatment,
                        inpatientDays: Math.min(
                          design.inpatientDays,
                          maxDays || design.inpatientDays,
                        ),
                        diseasePreset: null,
                      }),
                    );
                  }}
                />
                <span className="amount-unit">か月</span>
              </div>
            }
            formula={buildTreatmentFormula(result)}
            amountYen={manToDisplayYen(result.annualMedicalSelfPayMan)}
          />

          <MedicalLineRow
            label="入院日数"
            note="差額ベッド代・食事代などの計算に使用"
            flash={flashTargets.has('inpatient')}
            input={
              <div className="housing-man-input housing-man-input--inline">
                <input
                  type="number"
                  className="amount-input amount-input--compact"
                  min={0}
                  max={Math.max(1, design.hospitalMonthsPerYear * 30)}
                  step={1}
                  value={design.inpatientDays}
                  aria-label="入院日数"
                  onChange={(event) => {
                    const maxDays = design.hospitalMonthsPerYear * 30;
                    onChange(
                      patchMedicalDesign(state, subject, {
                        inpatientDays: Math.max(
                          0,
                          Math.min(
                            maxDays || Number(event.target.value) || 0,
                            Number(event.target.value) || 0,
                          ),
                        ),
                        diseasePreset: null,
                      }),
                    );
                  }}
                />
                <span className="amount-unit">日</span>
              </div>
            }
            formula={null}
            amountYen={null}
          />
        </div>

        <MedicalSection
          id="bracket"
          title="高額療養費の所得区分"
          collapsible
          defaultOpen={false}
          reflect={`いまの区分: ${HIGH_COST_BRACKET_SHORT_LABELS[result.incomeBracket]}`}
        >
          <div
            className="required-coverage-medical-bracket-table-wrap"
            role="region"
            aria-label="高額療養費の所得区分"
          >
            <table className="required-coverage-medical-bracket-table">
              <thead>
                <tr>
                  <th>区分</th>
                  <th>対象</th>
                  <th>自己負担限度額</th>
                  <th>試算で用いる医療費</th>
                  <th>
                    総医療費{MEDICAL_RISK_REFERENCE_MONTHLY_TOTAL_MEDICAL_MAN}
                    万円のとき
                  </th>
                  <th>多数回該当</th>
                </tr>
              </thead>
              <tbody>
                {HIGH_COST_BRACKET_ORDER.map((bracket) => {
                  const caps100 = bracketCapsForTotalMan(
                    bracket,
                    MEDICAL_RISK_REFERENCE_MONTHLY_TOTAL_MEDICAL_MAN,
                  );
                  const current = result.incomeBracket === bracket;
                  return (
                    <tr
                      key={bracket}
                      className={current ? 'is-current' : undefined}
                    >
                      <th scope="row">
                        {HIGH_COST_BRACKET_SHORT_LABELS[bracket]}
                        {current ? (
                          <span className="required-coverage-medical-bracket-current">
                            いまの区分
                          </span>
                        ) : null}
                      </th>
                      <td>{HIGH_COST_BRACKET_RANGE_LABELS[bracket]}</td>
                      <td>{HIGH_COST_BRACKET_CAP_FORMULAS[bracket]}</td>
                      <td>
                        {formatManTenths(
                          MEDICAL_RISK_ASSUMED_MONTHLY_MEDICAL_MAN[bracket],
                        )}
                        万円
                      </td>
                      <td>{formatManTenths(caps100.normalMan)}万円</td>
                      <td>{formatManTenths(caps100.multipleMan)}万円</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="required-coverage-medical-bracket-footnote">
            試算では区分ごとの「試算で用いる医療費」を1〜3か月目の自己負担とし、4か月目以降は多数回該当の額を使います。多数回該当は総医療費の額によらず定額です。
          </p>
        </MedicalSection>
      </MedicalSection>

      <MedicalSection
        id="incidental"
        title="4. 雑費（保険外・付帯費用）"
        reflect={`入院${inpatientDays}日ベース`}
        summary={
          <span className="required-coverage-medical-section-amount">
            {formatYen(manToDisplayYen(result.extraCosts.incidentalMan))}円
          </span>
        }
      >
        <div
          className="required-coverage-medical-lines"
          role="table"
          aria-label="雑費の試算"
        >
          <div className="required-coverage-medical-line is-header" role="row">
            <div className="required-coverage-medical-line-label">項目</div>
            <div className="required-coverage-medical-line-input">入力</div>
            <div className="required-coverage-medical-line-formula">計算根拠</div>
            <div className="required-coverage-medical-line-amount">金額</div>
          </div>
          <MedicalLineRow
            label="差額ベッド代"
            labelExtra={
              <MedicalHelpButton kind="extraBed" onOpen={setHelpKind} />
            }
            input={
              <HousingYenInput
                compact
                value={design.extraBedCostYenPerDay}
                unit="円/日"
                onChange={(extraBedCostYenPerDay) =>
                  onChange(
                    patchMedicalDesign(state, subject, {
                      extraBedCostYenPerDay,
                      diseasePreset: null,
                    }),
                  )
                }
              />
            }
            formula={`${inpatientDays}日 × ${formatYen(design.extraBedCostYenPerDay)}円`}
            amountYen={manToDisplayYen(result.extraCosts.extraBedMan)}
          />
          <MedicalLineRow
            label="食事代"
            labelExtra={<MedicalHelpButton kind="meal" onOpen={setHelpKind} />}
            input={
              <HousingYenInput
                compact
                value={design.mealCostYenPerDay}
                unit="円/日"
                onChange={(mealCostYenPerDay) =>
                  onChange(
                    patchMedicalDesign(state, subject, {
                      mealCostYenPerDay,
                      diseasePreset: null,
                    }),
                  )
                }
              />
            }
            formula={`${inpatientDays}日 × ${formatYen(design.mealCostYenPerDay)}円`}
            amountYen={manToDisplayYen(result.extraCosts.mealMan)}
          />
          <MedicalLineRow
            label="着替え代"
            labelExtra={
              <MedicalHelpButton kind="clothing" onOpen={setHelpKind} />
            }
            input={
              <HousingYenInput
                compact
                value={design.clothingCostYenPerDay}
                unit="円/日"
                onChange={(clothingCostYenPerDay) =>
                  onChange(
                    patchMedicalDesign(state, subject, {
                      clothingCostYenPerDay,
                      diseasePreset: null,
                    }),
                  )
                }
              />
            }
            formula={`${inpatientDays}日 × ${formatYen(design.clothingCostYenPerDay)}円`}
            amountYen={manToDisplayYen(result.extraCosts.clothingMan)}
          />
          <MedicalLineRow
            label="交通費"
            labelExtra={
              <MedicalHelpButton kind="transport" onOpen={setHelpKind} />
            }
            input={
              <HousingYenInput
                compact
                value={design.transportCostYenPerDay}
                unit="円/日"
                onChange={(transportCostYenPerDay) =>
                  onChange(
                    patchMedicalDesign(state, subject, {
                      transportCostYenPerDay,
                      diseasePreset: null,
                    }),
                  )
                }
              />
            }
            formula={`${inpatientDays}日 × ${formatYen(design.transportCostYenPerDay)}円`}
            amountYen={manToDisplayYen(result.extraCosts.transportMan)}
          />
          <MedicalLineRow
            label="消耗品代"
            labelExtra={
              <MedicalHelpButton kind="consumables" onOpen={setHelpKind} />
            }
            input={
              <HousingYenInput
                compact
                value={design.consumablesCostYenPerDay}
                unit="円/日"
                onChange={(consumablesCostYenPerDay) =>
                  onChange(
                    patchMedicalDesign(state, subject, {
                      consumablesCostYenPerDay,
                      diseasePreset: null,
                    }),
                  )
                }
              />
            }
            formula={`${inpatientDays}日 × ${formatYen(design.consumablesCostYenPerDay)}円`}
            amountYen={manToDisplayYen(result.extraCosts.consumablesMan)}
          />
        </div>
      </MedicalSection>

      <MedicalSection
        id="cashflow"
        title="5. 収入の純不足"
        summary={
          <span className="required-coverage-medical-section-amount">
            {formatYen(manToDisplayYen(result.extraCosts.incomeLossMan))}円
          </span>
        }
      >
        {design.employmentType === 'selfEmployed' && (
          <p className="required-coverage-medical-sick-leave-note required-coverage-medical-sick-leave-note--warn">
            個人事業主には傷病手当金がありません。療養中の収入の目減りは手動で入力してください。
          </p>
        )}

        <div
          className="required-coverage-medical-lines"
          role="table"
          aria-label="収入の純不足"
        >
          <div className="required-coverage-medical-line is-header" role="row">
            <div className="required-coverage-medical-line-label">項目</div>
            <div className="required-coverage-medical-line-input">入力</div>
            <div className="required-coverage-medical-line-formula">計算根拠</div>
            <div className="required-coverage-medical-line-amount">金額</div>
          </div>
          {showSickLeaveRows ? (
            <>
              <MedicalLineRow
                label="月収"
                note="就業不能時に失う想定の月収"
                formula="2. 月収・就業形態の入力"
                amountYen={manToDisplayYen(effectiveMonthlyIncomeMan)}
              />
              <MedicalLineRow
                label="傷病手当金（見込）"
                labelExtra={
                  <MedicalHelpButton kind="sickLeave" onOpen={setHelpKind} />
                }
                note={`月収の2/3。治療月数${design.hospitalMonthsPerYear}か月で合計約${formatManTenths(sickLeaveTotal)}万円`}
                formula="月収 × 2/3"
                amountYen={manToDisplayYen(sickLeaveMonthlyEstimate ?? 0)}
              />
            </>
          ) : null}
          <MedicalLineRow
            label="収入の目減り"
            note={
              showSickLeaveRows
                ? design.incomeLossManual
                  ? '手入力中（傷病手当から再計算できます）'
                  : '初期値は月収 − 傷病手当金（月収の約1/3）'
                : '療養中に減ると見込む月額'
            }
            flash={flashTargets.has('incomeLoss')}
            input={
              <div className="required-coverage-medical-income-loss-input">
                <HousingManInput
                  compact
                  value={effectiveIncomeLossManPerMonth}
                  step={0.1}
                  unit="万円/月"
                  onChange={(incomeLossManPerMonth) =>
                    onChange(
                      patchMedicalDesign(state, subject, {
                        incomeLossManPerMonth,
                        incomeLossManual: true,
                      }),
                    )
                  }
                />
                {showSickLeaveRows && design.incomeLossManual ? (
                  <button
                    type="button"
                    className="required-coverage-medical-income-loss-reset"
                    onClick={() => {
                      onChange(
                        patchMedicalDesign(state, subject, {
                          incomeLossManPerMonth:
                            suggestedIncomeLossManPerMonth ?? 0,
                          incomeLossManual: false,
                        }),
                      );
                      triggerFlash(['incomeLoss']);
                    }}
                  >
                    傷病手当から再計算
                  </button>
                ) : null}
              </div>
            }
            formula={`${formatManTenths(effectiveIncomeLossManPerMonth)}万円 × ${design.hospitalMonthsPerYear}か月`}
            amountYen={manToDisplayYen(
              effectiveIncomeLossManPerMonth * design.hospitalMonthsPerYear,
            )}
          />
          <MedicalLineRow
            label="止められる支出"
            note="療養中に止められる月額の合計"
            amountYen={manToDisplayYen(result.extraCosts.stoppableExpenseMan)}
            tone="section"
            onToggle={() => setStoppableOpen((open) => !open)}
            expanded={stoppableOpen}
          />
          {stoppableOpen
            ? MEDICAL_STOPPABLE_EXPENSE_ORDER.map((kind) => (
                <MedicalLineRow
                  key={kind}
                  label={MEDICAL_STOPPABLE_EXPENSE_LABELS[kind]}
                  note={MEDICAL_STOPPABLE_EXPENSE_NOTES[kind]}
                  indented
                  input={
                    <HousingYenInput
                      compact
                      value={design.stoppableExpensesYen[kind]}
                      unit="円/月"
                      onChange={(value) =>
                        onChange(
                          patchMedicalDesign(state, subject, {
                            stoppableExpensesYen: {
                              ...design.stoppableExpensesYen,
                              [kind]: value,
                            },
                          }),
                        )
                      }
                    />
                  }
                  formula={`${design.hospitalMonthsPerYear}か月 × ${formatYen(design.stoppableExpensesYen[kind])}円`}
                  amountYen={
                    design.stoppableExpensesYen[kind] *
                    design.hospitalMonthsPerYear
                  }
                />
              ))
            : null}
          <MedicalLineRow
            label="収入の純不足"
            note={
              incomeLossCoveredByStoppable
                ? '止められる支出で目減りを相殺できるため、必要保障には含めません'
                : `月あたり ${formatManTenths(netIncomeLossManPerMonth)}万円`
            }
            formula="収入の目減り − 止められる支出"
            amountYen={manToDisplayYen(result.extraCosts.incomeLossMan)}
            tone="computed"
          />
        </div>
      </MedicalSection>

      <section
        className="required-coverage-medical-section required-coverage-medical-need"
        aria-labelledby="required-coverage-medical-section-need"
      >
        <div className="required-coverage-medical-need-summary">
          <div className="required-coverage-medical-need-summary-main">
            <h4
              id="required-coverage-medical-section-need"
              className="required-coverage-medical-need-summary-label"
            >
              6. 必要保障額
            </h4>
            <strong className="required-coverage-medical-need-summary-value">
              {formatYen(manToDisplayYen(result.requiredAmountMan))}
              <span className="amount-unit">円</span>
            </strong>
          </div>
          <p className="required-coverage-medical-need-summary-note">
            医療費 {formatManTenths(result.annualMedicalSelfPayMan)}万円 ＋ 雑費{' '}
            {formatManTenths(result.extraCosts.incidentalMan)}万円 ＋ 収入の純不足{' '}
            {formatManTenths(result.extraCosts.incomeLossMan)}万円
          </p>
        </div>
      </section>

      {helpKind ? (
        <MedicalHelpModal
          kind={helpKind}
          preset={getMedicalDiseasePresetByKey(selectedPresetKey)}
          onClose={() => setHelpKind(null)}
        />
      ) : null}
    </div>
  );
}
