export interface LateElderlyHealthViewConfig {

  fiscalYearLabel: string;

  memberAge: number | null;

  isApplicable: boolean;

  statusLabel: string;

  statusNote: string | null;

  pensionRevenueYen: number;

  pensionIncomeYen: number;

  salaryIncomeYen: number;

  otherIncomeYen: number;

  incomeBaseYen: number;

  incomeLevyRate: number;

  incomeLevyYen: number;

  rawPerCapitaYen: number;

  fixedYen: number;

  memberPremiumYen: number;

  householdIncomeYen: number;

  lateElderlyInsuredCount: number;

  reductionLabel: string;

  flatPayRate: number;

  levyIncomeYear: number;

  notes: string[];

}

