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
