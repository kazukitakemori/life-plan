import { isOtherLoanForCashFlow } from './loanCashFlow';
import { LOAN_CATEGORY_LABELS } from './loanLabels';
import { SCHOOL_CATEGORY_LABELS } from './educationLabels';
import { getLivingScheduleBillableItems } from './livingDefaults';
import { HOUSEHOLD_HOUSING_KEY } from '../types/housing';
import { HOUSEHOLD_LIVING_KEY } from '../types/living';
import { INSURANCE_CATEGORY_LABELS } from './insuranceLabels';
import { LIFE_EVENT_TYPE_LABELS } from './lifeEventLabels';
import { getMemberTabLabel } from './memberDisplay';
import { VEHICLE_TYPE_LABELS } from './vehicleLabels';
import type { CashFlowInput } from './cashFlow';
import type { EducationByMember } from '../types/education';
import type { FamilyMember } from '../types/family';
import type { HousingState } from '../types/housing';
import type { InsuranceState } from '../types/insurance';
import type { LifeEventState } from '../types/lifeEvent';
import type { LoanState } from '../types/loan';
import type {
  RequiredCoverageCategoryDesign,
  RequiredCoverageExpenseDesigns,
  RequiredCoverageExpenseKind,
  RequiredCoverageLineOverride,
  RequiredCoverageDesignStage,
  RequiredCoverageState,
  RequiredCoverageSubject,
} from '../types/requiredCoverage';
import {
  formatOwnedPropertyCreditLifeHint,
  isHousingLoanCoverageLockedOff,
  isHousingLoanPaidByGroupCreditLife,
  isOwnedHousingLoanInForce,
  resolveOwnedPropertyCreditLifeKind,
} from './housingCreditLifeCoverage';
import { getHousingLinkedLoansForProperty } from './loanResolution';
import {
  HOUSING_OWNED_DIRECT_DETAIL_ROWS,
  HOUSING_OWNED_TAIL_DETAIL_ROWS,
  HOUSING_TAX_DETAIL_ROWS,
  type HousingExpenseDetail,
} from '../types/cashFlow';
import type { VehicleState } from '../types/vehicle';

export const COVERAGE_EXPENSE_KIND_ORDER: RequiredCoverageExpenseKind[] = [
  'living',
  'education',
  'housing',
  'lifeEvent',
  'vehicle',
  'loanRepayment',
  'insuranceOther',
];

export const COVERAGE_EXPENSE_KIND_LABELS: Record<
  RequiredCoverageExpenseKind,
  string
> = {
  living: '生活費',
  education: '教育費',
  housing: '住居費',
  lifeEvent: 'ライフイベント',
  vehicle: '乗り物',
  loanRepayment: 'ローン（住宅以外）',
  insuranceOther: '保険料（その他）',
};

/** 資産形成グラフ（ASSET_CHART_COLORS）と同じ凡例色 */
export const COVERAGE_EXPENSE_KIND_COLORS: Record<
  RequiredCoverageExpenseKind,
  string
> = {
  living: '#eda866',
  education: '#6db86d',
  housing: '#6a9fd8',
  vehicle: '#90c2e7',
  lifeEvent: '#ee9cba',
  loanRepayment: '#c4b5fd',
  insuranceOther: '#fb7185',
};

const LEGACY_ITEM_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createDefaultCategoryDesign(
  ratePct = 100,
): RequiredCoverageCategoryDesign {
  return {
    included: true,
    ratePct,
    items: {},
  };
}

export function createDefaultExpenseDesigns(): RequiredCoverageExpenseDesigns {
  return {
    living: createDefaultCategoryDesign(),
    education: createDefaultCategoryDesign(),
    housing: createDefaultCategoryDesign(),
    lifeEvent: createDefaultCategoryDesign(),
    vehicle: createDefaultCategoryDesign(),
    loanRepayment: createDefaultCategoryDesign(),
    insuranceOther: createDefaultCategoryDesign(),
  };
}

export function createDefaultCoverageDesigns(): Record<
  RequiredCoverageSubject,
  RequiredCoverageExpenseDesigns
> {
  return {
    head: createDefaultExpenseDesigns(),
    spouse: createDefaultExpenseDesigns(),
  };
}

function migrateLineOverride(
  raw: unknown,
): RequiredCoverageLineOverride | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as RequiredCoverageLineOverride;
  const override: RequiredCoverageLineOverride = {};
  if (value.included === false) override.included = false;
  if (typeof value.ratePct === 'number' && Number.isFinite(value.ratePct)) {
    override.ratePct = Math.min(200, Math.max(0, value.ratePct));
  }
  return override;
}

export function coverageLivingLineId(targetId: string, label: string): string {
  return `${targetId}::${label}`;
}

export function coverageTabRateId(targetId: string, tabGroup?: string): string {
  return tabGroup
    ? `${targetId}::__tab__::${tabGroup}`
    : `${targetId}::__tab__`;
}

export const coverageLivingTabRateId = coverageTabRateId;

export function migrateCategoryDesign(
  raw?: Partial<RequiredCoverageCategoryDesign> | null,
  options?: { livingCompositeKeysOnly?: boolean; defaultRatePct?: number },
): RequiredCoverageCategoryDesign {
  const defaults = createDefaultCategoryDesign(options?.defaultRatePct);
  if (!raw || typeof raw !== 'object') return defaults;
  const items: Record<string, RequiredCoverageLineOverride> = {};
  if (raw.items && typeof raw.items === 'object') {
    for (const [id, override] of Object.entries(raw.items)) {
      if (options?.livingCompositeKeysOnly) {
        if (!id.includes('::') || LEGACY_ITEM_UUID.test(id)) continue;
      }
      const migrated = migrateLineOverride(override);
      if (migrated && Object.keys(migrated).length > 0) {
        items[id] = migrated;
      }
    }
  }
  const ratePct =
    typeof raw.ratePct === 'number' && Number.isFinite(raw.ratePct)
      ? Math.min(200, Math.max(0, raw.ratePct))
      : defaults.ratePct;
  return {
    included: raw.included !== false,
    ratePct,
    items,
  };
}

export function migrateExpenseDesigns(
  raw?: Partial<RequiredCoverageExpenseDesigns> | null,
): RequiredCoverageExpenseDesigns {
  const defaults = createDefaultExpenseDesigns();
  if (!raw || typeof raw !== 'object') return defaults;
  return {
    living: migrateCategoryDesign(raw.living, {
      livingCompositeKeysOnly: true,
    }),
    education: migrateCategoryDesign(raw.education),
    housing: migrateCategoryDesign(raw.housing),
    lifeEvent: migrateCategoryDesign(raw.lifeEvent),
    vehicle: migrateCategoryDesign(raw.vehicle),
    loanRepayment: migrateCategoryDesign(raw.loanRepayment),
    insuranceOther: migrateCategoryDesign(raw.insuranceOther),
  };
}

export function migrateCoverageDesigns(
  raw?:
    | RequiredCoverageState['simpleDesigns']
    | RequiredCoverageState['detailDesigns']
    | null,
): Record<RequiredCoverageSubject, RequiredCoverageExpenseDesigns> {
  return {
    head: migrateExpenseDesigns(raw?.head),
    spouse: migrateExpenseDesigns(raw?.spouse),
  };
}

function readDesignsByStage(
  state: RequiredCoverageState,
  stage: RequiredCoverageDesignStage,
): Record<RequiredCoverageSubject, RequiredCoverageExpenseDesigns> {
  return migrateCoverageDesigns(
    stage === 'simple' ? state.simpleDesigns : state.detailDesigns,
  );
}

function writeDesignsByStage(
  state: RequiredCoverageState,
  stage: RequiredCoverageDesignStage,
  designs: Record<RequiredCoverageSubject, RequiredCoverageExpenseDesigns>,
): RequiredCoverageState {
  return stage === 'simple'
    ? { ...state, simpleDesigns: designs }
    : { ...state, detailDesigns: designs };
}

export function getCoverageDesign(
  state: RequiredCoverageState,
  subject: RequiredCoverageSubject,
  stage: RequiredCoverageDesignStage = 'detail',
): RequiredCoverageExpenseDesigns {
  return migrateExpenseDesigns(readDesignsByStage(state, stage)[subject]);
}

export function isCoverageLineIncluded(
  design: RequiredCoverageCategoryDesign,
  itemId: string,
): boolean {
  return design.items[itemId]?.included !== false;
}

/** 保障期間中の累計が0の行は内訳に出さない */
export function filterCoverageLines(
  lines: CoverageDesignLine[],
  byItem: Record<string, number>,
): CoverageDesignLine[] {
  return lines.filter((line) => (byItem[line.id] ?? 0) !== 0);
}

export const filterCoverageLivingLines = filterCoverageLines;

export function coverageCategoryFactor(
  design: RequiredCoverageCategoryDesign,
): number {
  if (!design.included) return 0;
  return design.ratePct / 100;
}

export function coverageLineRatePct(
  design: RequiredCoverageCategoryDesign,
  itemId: string,
  targetId?: string,
  parentId?: string,
  tabGroup?: string,
): number {
  const override = design.items[itemId]?.ratePct;
  if (typeof override === 'number' && Number.isFinite(override)) {
    return override;
  }
  if (parentId) {
    return coverageLineRatePct(design, parentId, targetId, undefined, tabGroup);
  }
  if (targetId) {
    const tabRate = design.items[coverageTabRateId(targetId, tabGroup)]?.ratePct;
    if (typeof tabRate === 'number' && Number.isFinite(tabRate)) {
      return tabRate;
    }
  }
  return design.ratePct;
}

export const livingEffectiveRatePct = coverageLineRatePct;

/** 1項目の万一後倍率。項目 → 親項目 → タブ → カテゴリの順で割合を見る */
export function coverageLineFactor(
  design: RequiredCoverageCategoryDesign,
  itemId: string,
  targetId?: string,
  parentId?: string,
  tabGroup?: string,
): number {
  if (!design.included) return 0;
  const override = design.items[itemId];
  if (override?.included === false) return 0;
  if (parentId && design.items[parentId]?.included === false) return 0;
  return coverageLineRatePct(design, itemId, targetId, parentId, tabGroup) / 100;
}

export const livingItemFactor = coverageLineFactor;

export function overlayLivingItems<
  T extends { targetId: string; label: string; amount: number },
>(items: T[], design: RequiredCoverageCategoryDesign): T[] {
  if (!design.included) return [];
  return items.map((item) => ({
    ...item,
    amount:
      item.amount *
      livingItemFactor(
        design,
        coverageLivingLineId(item.targetId, item.label),
        item.targetId,
      ),
  }));
}

function filterMemberEntries<T extends { id: string }>(
  byMember: Record<string, T[]> | undefined,
  design: RequiredCoverageCategoryDesign,
): Record<string, T[]> {
  const next: Record<string, T[]> = {};
  if (!design.included) return next;
  for (const [memberId, entries] of Object.entries(byMember ?? {})) {
    next[memberId] = entries.filter((entry) =>
      isCoverageLineIncluded(design, entry.id),
    );
  }
  return next;
}

function applyVehicleDesign(
  vehicleState: VehicleState,
  design: RequiredCoverageCategoryDesign,
): VehicleState {
  return { byMember: filterMemberEntries(vehicleState.byMember, design) };
}

function applyHousingDesign(
  housingState: HousingState,
  design: RequiredCoverageCategoryDesign,
): HousingState {
  if (!design.included) {
    return { byTarget: {} };
  }
  const byTarget: HousingState['byTarget'] = {};
  for (const [targetId, target] of Object.entries(housingState.byTarget)) {
    byTarget[targetId] = {
      ...target,
      rentals: target.rentals.filter((entry) =>
        isCoverageLineIncluded(design, entry.id),
      ),
      owned: target.owned.filter((entry) =>
        isCoverageLineIncluded(design, entry.id),
      ),
    };
  }
  return { ...housingState, byTarget };
}

function applyEducationDesign(
  educationByMember: EducationByMember,
  design: RequiredCoverageCategoryDesign,
): EducationByMember {
  return filterMemberEntries(educationByMember, design);
}

function applyLifeEventDesign(
  lifeEventState: LifeEventState,
  design: RequiredCoverageCategoryDesign,
): LifeEventState {
  return {
    ...lifeEventState,
    byMember: filterMemberEntries(lifeEventState.byMember, design),
  };
}

function applyLoanDesign(
  loanState: LoanState | undefined,
  design: RequiredCoverageCategoryDesign,
): LoanState | undefined {
  if (!loanState) return loanState;
  const byMember: LoanState['byMember'] = {};
  for (const [memberId, entries] of Object.entries(loanState.byMember)) {
    byMember[memberId] = entries.filter((entry) => {
      if (!isOtherLoanForCashFlow(entry)) return true;
      if (!design.included) return false;
      return isCoverageLineIncluded(design, entry.id);
    });
  }
  return { ...loanState, byMember };
}

function applyInsuranceDesign(
  insuranceState: InsuranceState | undefined,
  design: RequiredCoverageCategoryDesign,
): InsuranceState | undefined {
  if (!insuranceState) return insuranceState;
  const byMember: InsuranceState['byMember'] = {};
  for (const [memberId, entries] of Object.entries(
    insuranceState.byMember ?? {},
  )) {
    byMember[memberId] = entries.filter((entry) =>
      isCoverageLineIncluded(design, entry.id),
    );
  }
  return { ...insuranceState, byMember };
}

/**
 * 生活費以外の除外を CF 入力へ反映したコピー。
 * 生活費は累計への上書きなので、入力は変更しない。
 */
export function applyCoverageExpenseDesign(
  input: CashFlowInput,
  design: RequiredCoverageExpenseDesigns,
): CashFlowInput {
  return {
    ...input,
    vehicleState: applyVehicleDesign(
      input.vehicleState ?? { byMember: {} },
      design.vehicle,
    ),
    housingState: applyHousingDesign(input.housingState, design.housing),
    educationByMember: applyEducationDesign(
      input.educationByMember,
      design.education,
    ),
    lifeEventState: applyLifeEventDesign(
      input.lifeEventState,
      design.lifeEvent,
    ),
    loanState: applyLoanDesign(input.loanState, design.loanRepayment),
    insuranceState: applyInsuranceDesign(
      input.insuranceState,
      design.insuranceOther,
    ),
  };
}

function targetLabel(
  targetId: string,
  familyMembers: FamilyMember[],
  householdLabel: string,
): string {
  if (
    targetId === HOUSEHOLD_HOUSING_KEY ||
    targetId === HOUSEHOLD_LIVING_KEY
  ) {
    return householdLabel;
  }
  const member = familyMembers.find((item) => item.id === targetId);
  return member ? getMemberTabLabel(member) : householdLabel;
}

export interface CoverageDesignLine {
  id: string;
  label: string;
  ownerLabel: string;
  targetId?: string;
  /** 所有物件など、入力から汲み取った前提（団信の扱い） */
  assumptionHint?: string;
  /** 住居費内訳のグループ（賃貸 / 所有） */
  group?: string;
  /** 既契約の団信で消滅するため、必要保障額に含められずチェック不可 */
  includeLockedOff?: boolean;
  /** この万一で団信が効く借入。チェックオフ時に「団信でローン消滅」を出す */
  creditLifePaysOff?: boolean;
}

export const HOUSING_COVERAGE_GROUPS = ['賃貸', '所有'] as const;

export function coverageOwnedHoldingLineId(propertyId: string): string {
  return `${propertyId}::__holding__`;
}

export function coverageOwnedHoldingPartLineId(
  holdingLineId: string,
  partKey: string,
): string {
  return `${holdingLineId}::${partKey}`;
}

export function isCoverageOwnedHoldingLineId(id: string): boolean {
  return id.endsWith('::__holding__');
}

export interface HousingHoldingCoveragePart {
  key: string;
  label: string;
  amount: number;
}

/** 所有物件の維持費など（ローン残元金以外）の内訳。0円は出さない */
export function listHousingHoldingCoverageParts(
  detail: HousingExpenseDetail | undefined,
): HousingHoldingCoveragePart[] {
  if (!detail) return [];
  const parts: HousingHoldingCoveragePart[] = [];
  for (const row of HOUSING_OWNED_DIRECT_DETAIL_ROWS) {
    const amount = Math.round(detail[row.key]);
    if (amount !== 0) parts.push({ key: row.key, label: row.label, amount });
  }
  for (const row of HOUSING_TAX_DETAIL_ROWS) {
    const amount = Math.round(detail.taxDetail[row.key]);
    if (amount !== 0) {
      parts.push({ key: `tax.${row.key}`, label: row.label, amount });
    }
  }
  for (const row of HOUSING_OWNED_TAIL_DETAIL_ROWS) {
    const amount = Math.round(detail[row.key]);
    if (amount !== 0) parts.push({ key: row.key, label: row.label, amount });
  }
  return parts;
}

export interface CoverageDesignCategoryCatalog {
  kind: RequiredCoverageExpenseKind;
  label: string;
  lines: CoverageDesignLine[];
}

export function listCoverageDesignCatalog(
  input: CashFlowInput,
  subject: RequiredCoverageSubject = 'head',
): CoverageDesignCategoryCatalog[] {
  const livingLines: CoverageDesignLine[] = [];
  const livingSeen = new Set<string>();
  const livingTargetIds = [
    HOUSEHOLD_LIVING_KEY,
    ...input.familyMembers.map((member) => member.id),
  ];
  for (const extraId of Object.keys(input.livingState.byTarget)) {
    if (!livingTargetIds.includes(extraId)) livingTargetIds.push(extraId);
  }
  for (const targetId of livingTargetIds) {
    const schedules = input.livingState.byTarget[targetId] ?? [];
    if (schedules.length === 0) continue;
    const ownerLabel = targetLabel(targetId, input.familyMembers, 'ご家族');
    for (const schedule of schedules) {
      const labels =
        schedule.inputMode === 'simple'
          ? ['生活費']
          : getLivingScheduleBillableItems(schedule).map(
              (item) => item.label.trim() || '（無題）',
            );
      for (const label of labels) {
        const id = coverageLivingLineId(targetId, label);
        if (livingSeen.has(id)) continue;
        livingSeen.add(id);
        livingLines.push({ id, label, ownerLabel, targetId });
      }
    }
  }

  const educationLines: CoverageDesignLine[] = [];
  for (const [memberId, entries] of Object.entries(input.educationByMember)) {
    const member = input.familyMembers.find((item) => item.id === memberId);
    if (!member) continue;
    const ownerLabel = getMemberTabLabel(member);
    for (const entry of entries) {
      const school = SCHOOL_CATEGORY_LABELS[entry.schoolCategory];
      const name = entry.schoolName.trim();
      educationLines.push({
        id: entry.id,
        label: name ? `${school}（${name}）` : school,
        ownerLabel,
        targetId: memberId,
      });
    }
  }

  const housingLines: CoverageDesignLine[] = [];
  for (const [targetId, target] of Object.entries(
    input.housingState.byTarget,
  )) {
    const ownerLabel = targetLabel(targetId, input.familyMembers, 'ご家族');
    for (const rental of target.rentals) {
      housingLines.push({
        id: rental.id,
        label: rental.name.trim() || '賃貸',
        ownerLabel,
        targetId,
        group: '賃貸',
      });
    }
    for (const owned of target.owned) {
      const linkedLoans = input.loanState
        ? getHousingLinkedLoansForProperty(
            input.loanState,
            input.familyMembers,
            targetId,
            owned.id,
          )
        : [];
      const propertyName = owned.name.trim() || '持ち家';
      if (linkedLoans.length === 0) {
        const creditLifeKind = resolveOwnedPropertyCreditLifeKind(
          linkedLoans,
          subject,
        );
        housingLines.push({
          id: owned.id,
          label: propertyName,
          ownerLabel,
          targetId,
          group: '所有',
          assumptionHint: formatOwnedPropertyCreditLifeHint(
            creditLifeKind,
            subject,
            input.familyMembers,
            linkedLoans,
          ),
        });
        continue;
      }

      housingLines.push({
        id: coverageOwnedHoldingLineId(owned.id),
        label: `${propertyName}（維持費など）`,
        ownerLabel,
        targetId,
        group: '所有',
      });
      for (const loan of linkedLoans) {
        const paid = isHousingLoanPaidByGroupCreditLife(
          loan.entry,
          loan.contractorRole,
          subject,
        );
        const inForce = isOwnedHousingLoanInForce(owned);
        const lockedOff = isHousingLoanCoverageLockedOff(paid, inForce);
        const loanTargetId = loan.contractorId ?? targetId;
        housingLines.push({
          id: loan.entry.id,
          label: loan.entry.name.trim() || `${propertyName}のローン`,
          ownerLabel: loan.contractorLabel,
          targetId: loanTargetId,
          group: '所有',
          includeLockedOff: lockedOff,
          creditLifePaysOff: paid,
          assumptionHint: paid
            ? undefined
            : loan.entry.structureType === 'pair'
              ? 'ペアローン残債'
              : '団信対象外',
        });
      }
    }
  }

  const lifeEventLines: CoverageDesignLine[] = [];
  for (const [memberId, entries] of Object.entries(
    input.lifeEventState.byMember,
  )) {
    const member = input.familyMembers.find((item) => item.id === memberId);
    if (!member) continue;
    const ownerLabel = getMemberTabLabel(member);
    for (const entry of entries) {
      const typeLabel = LIFE_EVENT_TYPE_LABELS[entry.type];
      const name = entry.label.trim();
      lifeEventLines.push({
        id: entry.id,
        label: name || typeLabel,
        ownerLabel,
        targetId: memberId,
      });
    }
  }

  const vehicleLines: CoverageDesignLine[] = [];
  for (const [memberId, entries] of Object.entries(
    input.vehicleState?.byMember ?? {},
  )) {
    const member = input.familyMembers.find((item) => item.id === memberId);
    if (!member) continue;
    const ownerLabel = getMemberTabLabel(member);
    for (const entry of entries) {
      const typeLabel = VEHICLE_TYPE_LABELS[entry.type];
      const name = entry.label.trim();
      vehicleLines.push({
        id: entry.id,
        label: name || typeLabel,
        ownerLabel,
        targetId: memberId,
      });
    }
  }

  const loanLines: CoverageDesignLine[] = [];
  const head = input.familyMembers.find((member) => member.role === 'head');
  for (const [memberId, entries] of Object.entries(
    input.loanState?.byMember ?? {},
  )) {
    const targetId = memberId === '__legacy__' ? (head?.id ?? memberId) : memberId;
    const member = input.familyMembers.find((item) => item.id === targetId);
    const ownerLabel = member
      ? getMemberTabLabel(member)
      : LOAN_CATEGORY_LABELS.free;
    for (const entry of entries) {
      if (!isOtherLoanForCashFlow(entry)) continue;
      loanLines.push({
        id: entry.id,
        label: entry.name.trim() || LOAN_CATEGORY_LABELS[entry.category],
        ownerLabel,
        targetId,
      });
    }
  }

  const insuranceLines: CoverageDesignLine[] = [];
  for (const [memberId, entries] of Object.entries(
    input.insuranceState?.byMember ?? {},
  )) {
    const member = input.familyMembers.find((item) => item.id === memberId);
    if (!member) continue;
    const ownerLabel = getMemberTabLabel(member);
    for (const entry of entries) {
      const category = INSURANCE_CATEGORY_LABELS[entry.category];
      const name = entry.name.trim();
      insuranceLines.push({
        id: entry.id,
        label: name || category,
        ownerLabel,
        targetId: memberId,
      });
    }
  }

  return [
    { kind: 'living', label: COVERAGE_EXPENSE_KIND_LABELS.living, lines: livingLines },
    {
      kind: 'education',
      label: COVERAGE_EXPENSE_KIND_LABELS.education,
      lines: educationLines,
    },
    { kind: 'housing', label: COVERAGE_EXPENSE_KIND_LABELS.housing, lines: housingLines },
    {
      kind: 'lifeEvent',
      label: COVERAGE_EXPENSE_KIND_LABELS.lifeEvent,
      lines: lifeEventLines,
    },
    { kind: 'vehicle', label: COVERAGE_EXPENSE_KIND_LABELS.vehicle, lines: vehicleLines },
    {
      kind: 'loanRepayment',
      label: COVERAGE_EXPENSE_KIND_LABELS.loanRepayment,
      lines: loanLines,
    },
    {
      kind: 'insuranceOther',
      label: COVERAGE_EXPENSE_KIND_LABELS.insuranceOther,
      lines: insuranceLines,
    },
  ];
}

export function patchCoverageCategoryDesign(
  state: RequiredCoverageState,
  subject: RequiredCoverageSubject,
  kind: RequiredCoverageExpenseKind,
  patch: Partial<RequiredCoverageCategoryDesign>,
  stage: RequiredCoverageDesignStage = 'detail',
): RequiredCoverageState {
  const designs = readDesignsByStage(state, stage);
  return writeDesignsByStage(state, stage, {
    ...designs,
    [subject]: {
      ...designs[subject],
      [kind]: {
        ...designs[subject][kind],
        ...patch,
      },
    },
  });
}

function retainOnlyInclusionOverrides(
  items: Record<string, RequiredCoverageLineOverride>,
): Record<string, RequiredCoverageLineOverride> {
  const next: Record<string, RequiredCoverageLineOverride> = {};
  for (const [id, override] of Object.entries(items)) {
    if (override.included === false) {
      next[id] = { included: false };
    }
  }
  return next;
}

function clearLineRateOverrides(
  items: Record<string, RequiredCoverageLineOverride>,
  lineIds: string[],
): Record<string, RequiredCoverageLineOverride> {
  const next = { ...items };
  for (const lineId of lineIds) {
    const current = next[lineId];
    if (!current) continue;
    const stripped: RequiredCoverageLineOverride = { ...current };
    delete stripped.ratePct;
    if (Object.keys(stripped).length === 0) {
      delete next[lineId];
    } else {
      next[lineId] = stripped;
    }
  }
  return next;
}

/** カテゴリの残す割合。行・タブの ratePct はクリアし、除外指定だけ残す */
export function patchCoverageCategoryRate(
  state: RequiredCoverageState,
  subject: RequiredCoverageSubject,
  kind: RequiredCoverageExpenseKind,
  ratePct: number,
  options?: {
    included?: boolean;
    stage?: RequiredCoverageDesignStage;
  },
): RequiredCoverageState {
  const stage = options?.stage ?? 'detail';
  const category = readDesignsByStage(state, stage)[subject][kind];
  return patchCoverageCategoryDesign(
    state,
    subject,
    kind,
    {
      ratePct,
      items: retainOnlyInclusionOverrides(category.items),
      ...(options?.included !== undefined ? { included: options.included } : {}),
    },
    stage,
  );
}

/** タブの残す割合。配下の行 ratePct はクリアし、除外指定だけ残す */
export function patchCoverageTabRate(
  state: RequiredCoverageState,
  subject: RequiredCoverageSubject,
  kind: RequiredCoverageExpenseKind,
  tabRateId: string,
  ratePct: number,
  descendantLineIds: string[],
  stage: RequiredCoverageDesignStage = 'detail',
): RequiredCoverageState {
  const category = readDesignsByStage(state, stage)[subject][kind];
  let items = clearLineRateOverrides(category.items, descendantLineIds);
  const tabCurrent = items[tabRateId] ?? {};
  items = {
    ...items,
    [tabRateId]: { ...tabCurrent, ratePct },
  };
  return patchCoverageCategoryDesign(state, subject, kind, { items }, stage);
}

/** 簡易設計の生活費割合。行・タブの ratePct はクリアし、除外指定だけ残す */
export function patchCoverageLivingRateFromSimpleDesign(
  state: RequiredCoverageState,
  subject: RequiredCoverageSubject,
  ratePct: number,
): RequiredCoverageState {
  return patchCoverageCategoryRate(state, subject, 'living', ratePct, {
    included: true,
    stage: 'simple',
  });
}

export function patchCoverageLineOverride(
  state: RequiredCoverageState,
  subject: RequiredCoverageSubject,
  kind: RequiredCoverageExpenseKind,
  itemId: string,
  patch: RequiredCoverageLineOverride,
  stage: RequiredCoverageDesignStage = 'detail',
): RequiredCoverageState {
  const category = readDesignsByStage(state, stage)[subject][kind];
  const current = category.items[itemId] ?? {};
  const next: RequiredCoverageLineOverride = { ...current, ...patch };
  if (next.included !== false) delete next.included;
  if (next.ratePct == null) delete next.ratePct;
  const items = { ...category.items };
  if (Object.keys(next).length === 0) {
    delete items[itemId];
  } else {
    items[itemId] = next;
  }
  return patchCoverageCategoryDesign(state, subject, kind, { items }, stage);
}
