import type {
  GraduateProgramType,
  SchoolType,
  UniversityHousingType,
} from '../types/education';
import { getLivingExpenses } from './universityCostReference';

export interface GraduateCostLineItem {
  label: string;
  amount: number;
  paymentCycle: 'monthly' | 'yearly';
  enrollmentYear?: number;
}

export interface GraduateEducationBreakdown {
  label: string;
  annualAmount: number;
}

export type GraduateReferenceBasis = 'mext_survey' | 'statutory' | 'estimated';

/**
 * 大学院の費用スケジュール。
 * 学費: 文部科学省「私立大学等の令和5年度入学者に係る学生納付金等調査」（大学院）
 *       国立大学等の授業料その他の費用に関する省令（標準額）
 * 生活費: 全国大学生活協同組合連合会「第61回学生生活実態調査」（2025年）
 */
export interface GraduateFeeSchedule {
  entranceFee: number;
  tuitionAnnual: number;
  otherExpenses: GraduateCostLineItem[];
  schoolEducationBreakdown: GraduateEducationBreakdown[];
  sourceLabel: string;
  referenceBasis: GraduateReferenceBasis;
}

// ─── 令和5年度・私立大学大学院（文科省調査） ─────────────────────────
//
// 博士前期課程（修士課程）:
//   授業料 798,465円、入学料 201,752円、施設設備費 75,589円
//   実験実習料 27,108円、その他 31,676円、初年度合計 1,134,590円
//
// 博士後期課程（博士課程）:
//   授業料 604,592円、入学料 192,686円、施設設備費 49,733円
//   実験実習料 25,304円、その他 21,279円、初年度合計 893,594円

interface GraduateProgramFees {
  entranceFee: number;
  tuitionAnnual: number;
  facilityAnnual: number;
  practicalAnnual: number;
  otherAnnual: number;
  programLabel: string;
}

const MASTERS_PROGRAM_FEES: GraduateProgramFees = {
  entranceFee: 201_752,
  tuitionAnnual: 798_465,
  facilityAnnual: 75_589,
  practicalAnnual: 27_108,
  otherAnnual: 31_676,
  programLabel: '博士前期課程（修士課程）',
};

const DOCTORAL_PROGRAM_FEES: GraduateProgramFees = {
  entranceFee: 192_686,
  tuitionAnnual: 604_592,
  facilityAnnual: 49_733,
  practicalAnnual: 25_304,
  otherAnnual: 21_279,
  programLabel: '博士後期課程（博士課程）',
};

// 私立大学院の学部系統別倍率（博士前期平均をベースに推計）
const PRIVATE_GRADUATE_MULTIPLIERS: Partial<Record<SchoolType, number>> = {
  graduate_private_liberal_arts: 1.0,
  graduate_private_science: 1.28,
  graduate_private_medical: 2.0,
};

const NATIONAL_GRADUATE_MATERIALS: Partial<Record<SchoolType, number>> = {
  graduate_national_other: 60_000,
  graduate_national_medical: 120_000,
};

function scaleAmount(amount: number, multiplier: number): number {
  return Math.round(amount * multiplier);
}

function getProgramFees(programType: GraduateProgramType): GraduateProgramFees {
  if (programType === 'doctoral') {
    return DOCTORAL_PROGRAM_FEES;
  }
  return MASTERS_PROGRAM_FEES;
}

function buildPrivateGraduateSchedule(
  schoolType: SchoolType,
  programType: GraduateProgramType,
): Omit<GraduateFeeSchedule, 'otherExpenses'> {
  const program = getProgramFees(programType);
  const multiplier = PRIVATE_GRADUATE_MULTIPLIERS[schoolType] ?? 1.0;
  const programNote =
    programType === 'working_adult'
      ? '（社会人入試は博士前期課程が一般的）'
      : '';

  const tuitionAnnual = scaleAmount(program.tuitionAnnual, multiplier);
  const facilityAnnual = scaleAmount(program.facilityAnnual, multiplier);
  const practicalAnnual = scaleAmount(program.practicalAnnual, multiplier);
  const otherAnnual = scaleAmount(program.otherAnnual, multiplier);

  const schoolTypeLabel =
    schoolType === 'graduate_private_science'
      ? '私立理系'
      : schoolType === 'graduate_private_medical'
        ? '私立医'
        : '私立文系';

  return {
    entranceFee: program.entranceFee,
    tuitionAnnual,
    schoolEducationBreakdown: [
      { label: '授業料', annualAmount: tuitionAnnual },
      { label: '施設設備費', annualAmount: facilityAnnual },
      { label: '実験実習料', annualAmount: practicalAnnual },
      { label: 'その他学校納付金', annualAmount: otherAnnual },
    ],
    sourceLabel: `${schoolTypeLabel}大学院・${program.programLabel}${programNote}（文科省令和5年度調査＋理系・医系は平均をベースに推計）`,
    referenceBasis: schoolType === 'graduate_private_liberal_arts' ? 'mext_survey' : 'estimated',
  };
}

function buildNationalGraduateSchedule(
  schoolType: SchoolType,
  programType: GraduateProgramType,
): Omit<GraduateFeeSchedule, 'otherExpenses'> {
  const program = getProgramFees(programType);
  const materials =
    NATIONAL_GRADUATE_MATERIALS[schoolType] ??
    (programType === 'doctoral' ? 70_000 : 60_000);
  const schoolTypeLabel =
    schoolType === 'graduate_national_medical' ? '国立医' : '国立他';

  return {
    entranceFee: 282_000,
    tuitionAnnual: 535_800,
    schoolEducationBreakdown: [
      { label: '授業料（省令標準額）', annualAmount: 535_800 },
      { label: '教材・研究費（推計）', annualAmount: materials },
    ],
    sourceLabel: `${schoolTypeLabel}大学院・${program.programLabel}（国立大学等の授業料省令標準額）`,
    referenceBasis: 'statutory',
  };
}

function buildSchoolOtherExpenses(
  base: Omit<GraduateFeeSchedule, 'otherExpenses'>,
): GraduateCostLineItem[] {
  return base.schoolEducationBreakdown
    .filter((item) => !item.label.startsWith('授業料'))
    .map((item) => ({
      label: item.label,
      amount: item.annualAmount,
      paymentCycle: 'yearly' as const,
    }));
}

function assembleSchedule(
  base: Omit<GraduateFeeSchedule, 'otherExpenses'>,
  housingType: UniversityHousingType,
): GraduateFeeSchedule {
  return {
    ...base,
    otherExpenses: [
      ...buildSchoolOtherExpenses(base),
      ...getLivingExpenses(housingType),
    ],
  };
}

export function isNationalGraduateType(schoolType: SchoolType): boolean {
  return (
    schoolType === 'graduate_national_other' ||
    schoolType === 'graduate_national_medical'
  );
}

export function isGraduateMedicalType(schoolType: SchoolType): boolean {
  return (
    schoolType === 'graduate_national_medical' ||
    schoolType === 'graduate_private_medical'
  );
}

export function getGraduateFeeSchedule(
  schoolType: SchoolType,
  programType: GraduateProgramType,
  housingType: UniversityHousingType,
): GraduateFeeSchedule {
  const base = isNationalGraduateType(schoolType)
    ? buildNationalGraduateSchedule(schoolType, programType)
    : buildPrivateGraduateSchedule(schoolType, programType);
  return assembleSchedule(base, housingType);
}

export function buildGraduateFetchedAmounts(
  schedule: GraduateFeeSchedule,
): {
  tuitionAnnual: number;
  otherExpenses: GraduateCostLineItem[];
} {
  return {
    tuitionAnnual: schedule.tuitionAnnual,
    otherExpenses: [...schedule.otherExpenses],
  };
}
