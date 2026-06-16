import type {
  MonthlyResult,
  SimulationInput,
  SimulationOutput,
  SimulationSummary,
  YearlyResult,
} from '../types';

export function simulate(input: SimulationInput): SimulationOutput {
  const months = input.years * 12;
  const monthly: MonthlyResult[] = [];
  let balance = input.initialBalance;

  let minimumBalance = balance;
  let minimumBalanceMonth = 0;
  let totalIncome = 0;
  let totalExpense = 0;

  for (let m = 1; m <= months; m++) {
    const year = Math.ceil(m / 12);
    const monthInYear = ((m - 1) % 12) + 1;
    const income = input.monthlyIncome;
    const expense = input.monthlyExpense;
    const netFlow = income - expense;

    balance += netFlow;
    totalIncome += income;
    totalExpense += expense;

    if (balance < minimumBalance) {
      minimumBalance = balance;
      minimumBalanceMonth = m;
    }

    monthly.push({
      month: m,
      year,
      monthInYear,
      balance,
      income,
      expense,
      netFlow,
    });
  }

  const summary: SimulationSummary = {
    finalBalance: balance,
    minimumBalance,
    minimumBalanceMonth,
    totalIncome,
    totalExpense,
    totalNetFlow: totalIncome - totalExpense,
  };

  return { monthly, summary };
}

export function aggregateByYear(monthly: MonthlyResult[]): YearlyResult[] {
  const byYear = new Map<number, MonthlyResult[]>();

  for (const row of monthly) {
    const existing = byYear.get(row.year) ?? [];
    existing.push(row);
    byYear.set(row.year, existing);
  }

  return Array.from(byYear.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, rows]) => {
      const last = rows[rows.length - 1];
      return {
        year,
        endBalance: last.balance,
        totalIncome: rows.reduce((sum, r) => sum + r.income, 0),
        totalExpense: rows.reduce((sum, r) => sum + r.expense, 0),
        totalNetFlow: rows.reduce((sum, r) => sum + r.netFlow, 0),
      };
    });
}

export function formatYen(value: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatYearMonth(month: number): string {
  const year = Math.ceil(month / 12);
  const monthInYear = ((month - 1) % 12) + 1;
  return `${year}年${monthInYear}月`;
}

export function formatManYen(value: number): string {
  if (Math.abs(value) >= 10_000) {
    const man = value / 10_000;
    return `${man.toLocaleString('ja-JP', { maximumFractionDigits: 1 })}万円`;
  }
  return formatYen(value);
}
