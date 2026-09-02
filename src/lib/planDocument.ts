import {
  PLAN_SCHEMA_VERSION,
  getDefaultCreateStatus,
  type PlanAppState,
  type PlanPayload,
  type PlanPurpose,
  type PlanRecord,
  type PlanStatus,
} from '../types/plan';
import { createDefaultEducationByMember } from './educationDefaults';
import {
  createDefaultFamily,
  migrateFamilyMembers,
} from './familyDefaults';
import { createDefaultHousingState, migrateHousingState } from './housingDefaults';
import { migrateIncomeByMember } from './incomeDefaults';
import { createDefaultInsuranceState, migrateInsuranceState } from './insuranceDefaults';
import { createDefaultLifeEventState, migrateLifeEventState } from './lifeEventDefaults';
import {
  createDefaultLivingState,
  migrateLivingExpenseState,
} from './livingDefaults';
import { createDefaultLoanState, migrateLoanState } from './loanDefaults';
import { createDefaultPensionByMember } from './pensionDefaults';
import {
  createDefaultRequiredCoverageState,
  migrateRequiredCoverageState,
} from './requiredCoverage';
import {
  createDefaultSecondLifeState,
  migrateSecondLifeState,
} from './secondLifeDefaults';
import { createDefaultSavingsState } from './savingsDefaults';
import { createDefaultTaxSocialState } from './taxSocialDefaults';
import {
  getDefaultPlanPurposes,
  normalizePlanPurposes,
} from './planPurpose';
import { createDefaultVehicleState, migrateVehicleState } from './vehicleDefaults';
import type { FamilyMember } from '../types/family';
import type { IncomeByMember } from '../types/income';

function createReferenceDate(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseReferenceDate(value: string | undefined): Date {
  if (!value) return createReferenceDate();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return createReferenceDate();
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return createReferenceDate();
  }
  return new Date(year, month - 1, day);
}

function initializeIncome(
  _members: FamilyMember[],
  _referenceDate: Date,
): IncomeByMember {
  // 新規入力は収入未登録（追加ボタンから開始）
  return {};
}

/** 新規プラン用の空（既定）入力 */
export function createEmptyPlanAppState(now = new Date()): PlanAppState {
  const referenceDate = createReferenceDate(now);
  const familyMembers = createDefaultFamily();
  const head = familyMembers.find((m) => m.role === 'head');
  const referenceMonth = referenceDate.getMonth() + 1;

  return {
    familyMembers,
    incomeByMember: initializeIncome(familyMembers, referenceDate),
    priorYearIncomeByMember: {},
    livingState: migrateLivingExpenseState(
      createDefaultLivingState(head, referenceMonth),
    ),
    housingState: createDefaultHousingState(head, referenceMonth),
    vehicleState: migrateVehicleState(createDefaultVehicleState()),
    loanState: createDefaultLoanState(),
    insuranceState: createDefaultInsuranceState(),
    savingsState: createDefaultSavingsState(),
    educationByMember: createDefaultEducationByMember(familyMembers),
    lifeEventState: migrateLifeEventState(createDefaultLifeEventState()),
    pensionByMember: createDefaultPensionByMember(familyMembers),
    taxSocialState: createDefaultTaxSocialState(head?.age, referenceMonth),
    requiredCoverageState: createDefaultRequiredCoverageState(),
    secondLifeState: createDefaultSecondLifeState(),
    referenceDate,
  };
}

export function createEmptyPlanPayload(now = new Date()): PlanPayload {
  return toPlanPayload(createEmptyPlanAppState(now));
}

export function toPlanPayload(state: PlanAppState): PlanPayload {
  return {
    familyMembers: state.familyMembers,
    incomeByMember: state.incomeByMember,
    priorYearIncomeByMember: state.priorYearIncomeByMember,
    livingState: state.livingState,
    housingState: state.housingState,
    vehicleState: state.vehicleState,
    loanState: state.loanState,
    insuranceState: state.insuranceState,
    savingsState: state.savingsState,
    educationByMember: state.educationByMember,
    lifeEventState: state.lifeEventState,
    pensionByMember: state.pensionByMember,
    taxSocialState: state.taxSocialState,
    requiredCoverageState: migrateRequiredCoverageState(
      state.requiredCoverageState,
    ),
    secondLifeState: migrateSecondLifeState(state.secondLifeState),
    referenceDate: toIsoDate(state.referenceDate),
  };
}

function migratePayloadToCurrent(payload: PlanPayload): PlanPayload {
  return {
    ...payload,
    requiredCoverageState: migrateRequiredCoverageState(
      payload.requiredCoverageState,
    ),
    secondLifeState: migrateSecondLifeState(payload.secondLifeState),
  };
}

/** 保存データを App 用に復元（既存 migrate* を適用） */
export function fromPlanPayload(raw: PlanPayload): PlanAppState {
  const payload = migratePayloadToCurrent(raw);
  const referenceDate = parseReferenceDate(payload.referenceDate);
  const familyMembers = migrateFamilyMembers(
    payload.familyMembers ?? createDefaultFamily(),
  );
  const memberRoles = Object.fromEntries(
    familyMembers.map((m) => [m.id, m.role]),
  );
  const head = familyMembers.find((m) => m.role === 'head');
  const referenceMonth = referenceDate.getMonth() + 1;

  return {
    familyMembers,
    incomeByMember: migrateIncomeByMember(
      payload.incomeByMember ?? {},
      memberRoles,
    ),
    priorYearIncomeByMember: payload.priorYearIncomeByMember ?? {},
    livingState: migrateLivingExpenseState(
      payload.livingState ?? createDefaultLivingState(head, referenceMonth),
    ),
    housingState: migrateHousingState(
      payload.housingState ?? createDefaultHousingState(head, referenceMonth),
    ),
    vehicleState: migrateVehicleState(
      payload.vehicleState ?? createDefaultVehicleState(),
    ),
    loanState: migrateLoanState(payload.loanState ?? createDefaultLoanState()),
    insuranceState: migrateInsuranceState(payload.insuranceState),
    savingsState: payload.savingsState ?? createDefaultSavingsState(),
    educationByMember:
      payload.educationByMember ?? createDefaultEducationByMember(familyMembers),
    lifeEventState: migrateLifeEventState(
      payload.lifeEventState ?? createDefaultLifeEventState(),
    ),
    pensionByMember:
      payload.pensionByMember ?? createDefaultPensionByMember(familyMembers),
    taxSocialState:
      payload.taxSocialState ??
      createDefaultTaxSocialState(head?.age, referenceMonth),
    requiredCoverageState: migrateRequiredCoverageState(
      payload.requiredCoverageState,
    ),
    secondLifeState: migrateSecondLifeState(payload.secondLifeState),
    referenceDate,
  };
}

export function normalizePlanStatus(value: unknown): PlanStatus {
  if (value === 'in_progress' || value === 'simulated') return value;
  // 旧ステータスからの移行
  if (value === 'completed' || value === 'archived') return 'simulated';
  if (value === 'draft') return 'in_progress';
  return getDefaultCreateStatus();
}

export function createPlanRecord(input: {
  id?: string;
  customerName: string;
  phone?: string;
  email?: string;
  note?: string;
  purposes?: PlanPurpose[];
  /** @deprecated use purposes */
  purpose?: PlanPurpose;
  status?: PlanStatus;
  payload: PlanPayload;
  createdAt?: string;
  now?: Date;
}): PlanRecord {
  const now = input.now ?? new Date();
  const iso = now.toISOString();
  const purposes = normalizePlanPurposes(input.purposes, input.purpose);
  return {
    id: input.id ?? crypto.randomUUID(),
    customerName: input.customerName.trim() || '名称未設定',
    phone: (input.phone ?? '').trim(),
    email: (input.email ?? '').trim(),
    note: (input.note ?? '').trim(),
    purposes,
    status: normalizePlanStatus(input.status),
    schemaVersion: PLAN_SCHEMA_VERSION,
    payload: input.payload,
    createdAt: input.createdAt ?? iso,
    updatedAt: iso,
  };
}

/** 古い schemaVersion のレコードを現行へ寄せる入口 */
export function migratePlanRecord(record: PlanRecord): PlanRecord {
  const purposes = normalizePlanPurposes(record.purposes, record.purpose);
  return {
    ...record,
    phone: typeof record.phone === 'string' ? record.phone : '',
    email: typeof record.email === 'string' ? record.email : '',
    note: typeof record.note === 'string' ? record.note : '',
    purposes,
    purpose: undefined,
    status: normalizePlanStatus(record.status),
    schemaVersion: PLAN_SCHEMA_VERSION,
    payload: migratePayloadToCurrent(record.payload),
  };
}

export function toPlanSummary(record: PlanRecord) {
  const migrated = migratePlanRecord(record);
  return {
    id: migrated.id,
    customerName: migrated.customerName,
    phone: migrated.phone,
    email: migrated.email,
    note: migrated.note,
    purposes: migrated.purposes ?? getDefaultPlanPurposes(),
    status: migrated.status,
    updatedAt: migrated.updatedAt,
  };
}
