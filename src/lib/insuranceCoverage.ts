import type { InsuranceState } from '../types/insurance';

export interface RegisteredInsuranceCoverage {
  deathBenefitMan: number;
  medicalHospitalDailyYen: number;
  cancerDiagnosisBenefitMan: number;
}

export function resolveRegisteredInsuranceCoverage(
  insuranceState: InsuranceState | undefined,
  insuredMemberId: string,
): RegisteredInsuranceCoverage {
  const coverage: RegisteredInsuranceCoverage = {
    deathBenefitMan: 0,
    medicalHospitalDailyYen: 0,
    cancerDiagnosisBenefitMan: 0,
  };

  if (!insuranceState) return coverage;

  for (const [contractorMemberId, entries] of Object.entries(
    insuranceState.byMember ?? {},
  )) {
    for (const entry of entries) {
      const targetMemberId = entry.insuredMemberId ?? contractorMemberId;
      if (targetMemberId !== insuredMemberId) continue;

      if (entry.category === 'life') {
        coverage.deathBenefitMan += Math.max(0, entry.deathBenefitMan ?? 0);
      } else if (entry.category === 'medical') {
        coverage.medicalHospitalDailyYen += Math.max(
          0,
          entry.medicalHospitalDailyYen ?? 0,
        );
      } else if (entry.category === 'cancer') {
        coverage.cancerDiagnosisBenefitMan += Math.max(
          0,
          entry.cancerDiagnosisBenefitMan ?? 0,
        );
      }
    }
  }

  return coverage;
}

export function resolveRegisteredDeathBenefitAtAge(
  insuranceState: InsuranceState | undefined,
  insuredMemberId: string,
  insuredAge: number,
): number {
  if (!insuranceState) return 0;
  let total = 0;

  for (const [contractorMemberId, entries] of Object.entries(
    insuranceState.byMember ?? {},
  )) {
    for (const entry of entries) {
      if (entry.category !== 'life') continue;
      const targetMemberId = entry.insuredMemberId ?? contractorMemberId;
      if (targetMemberId !== insuredMemberId) continue;
      const benefit = Math.max(0, entry.deathBenefitMan ?? 0);
      if (benefit <= 0) continue;
      if (entry.deathCoverageEndMode === 'lifetime') {
        total += benefit;
        continue;
      }
      if (
        entry.deathCoverageEndMode === 'until' &&
        Number.isFinite(entry.deathCoverageEndAge) &&
        insuredAge <= (entry.deathCoverageEndAge ?? -1)
      ) {
        total += benefit;
      }
    }
  }

  return total;
}

export function calcRegisteredMedicalHospitalBenefitMan(
  medicalHospitalDailyYen: number,
  inpatientDays: number,
): number {
  const dailyYen = Math.max(0, medicalHospitalDailyYen || 0);
  const days = Math.max(0, inpatientDays || 0);
  return (dailyYen * days) / 10_000;
}

/**
 * 必要保障額の医療シナリオへ反映するQ10既契約保障。
 * 入院給付金は全シナリオ、がん診断一時金はがんシナリオだけ加算する。
 */
export function calcRegisteredMedicalScenarioBenefitMan(
  coverage: Pick<
    RegisteredInsuranceCoverage,
    'medicalHospitalDailyYen' | 'cancerDiagnosisBenefitMan'
  >,
  inpatientDays: number,
  isCancerScenario: boolean,
): number {
  return (
    calcRegisteredMedicalHospitalBenefitMan(
      coverage.medicalHospitalDailyYen,
      inpatientDays,
    ) +
    (isCancerScenario
      ? Math.max(0, coverage.cancerDiagnosisBenefitMan || 0)
      : 0)
  );
}
