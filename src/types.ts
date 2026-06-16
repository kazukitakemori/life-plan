export interface SimulationInput {
  initialBalance: number;
  monthlyIncome: number;
  monthlyExpense: number;
  years: number;
}

export interface MonthlyResult {
  month: number;
  year: number;
  monthInYear: number;
  balance: number;
  income: number;
  expense: number;
  netFlow: number;
}

export interface SimulationSummary {
  finalBalance: number;
  minimumBalance: number;
  minimumBalanceMonth: number;
  totalIncome: number;
  totalExpense: number;
  totalNetFlow: number;
}

export interface SimulationOutput {
  monthly: MonthlyResult[];
  summary: SimulationSummary;
}

export interface YearlyResult {
  year: number;
  endBalance: number;
  totalIncome: number;
  totalExpense: number;
  totalNetFlow: number;
}

export interface ClientInfo {
  clientName: string;
  memo: string;
}
