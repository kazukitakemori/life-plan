from pathlib import Path

ROOT = Path('.')

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8')

def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing block: {label}')
    return text.replace(old, new, 1)

# 1) SecondLife types
p = 'src/types/secondLife.ts'
s = read(p)
s = replace_once(s,
"export type SecondLifeNewAreaOption = 'rent' | 'purchase';\n",
"export type SecondLifeNewAreaOption = 'rent' | 'purchase';\n\n/** Q12の住まい本体費用の支払い方法 */\nexport type SecondLifeHousingPaymentMethod = 'undecided' | 'cash' | 'loan';\n",
'payment method type')
s = replace_once(s,
"  includeMovingCost: boolean;\n  includePostPurchaseRenovation: boolean;\n  livingSkip: boolean;\n",
"  includeMovingCost: boolean;\n  includePostPurchaseRenovation: boolean;\n  /** リフォーム・購入など住まい本体の試算用目安額（万円） */\n  housingBaseCostMan: number;\n  /** 新しい土地で賃貸を選ぶ場合の月額家賃（万円） */\n  housingRentMonthlyMan: number;\n  housingPaymentMethod: SecondLifeHousingPaymentMethod;\n  /** ローンを選ぶ場合の頭金（万円） */\n  housingLoanDownPaymentMan: number;\n  /** ローンを選ぶ場合の固定金利の試算値（%）。未入力は null */\n  housingLoanInterestRatePct: number | null;\n  /** ローンを選ぶ場合の返済期間（年）。未入力は null */\n  housingLoanYears: number | null;\n  livingSkip: boolean;\n",
'design finance fields')
write(p, s)

# 2) Finance helper module
write('src/lib/secondLifeHousingFinance.ts', r'''import type { SecondLifeState } from '../types/secondLife';
import type { SecondLifeHousingFinancePlan } from '../types/housing';
import { getSecondLifeHousingTemplateKind } from './secondLifeLabels';

export const SECOND_LIFE_MOVING_COST_MAN = 50;
export const SECOND_LIFE_POST_PURCHASE_RENOVATION_MAN = 300;
export const SECOND_LIFE_RENOVATE_CURRENT_HOME_MAN = 500;
export const SECOND_LIFE_PURCHASE_REBUILD_MAN = 2_500;
export const SECOND_LIFE_RENOVATE_PARENTS_HOME_MAN = 400;
export const SECOND_LIFE_DEFAULT_RENT_MAN = 8;

export function getDefaultSecondLifeHousingBaseCostMan(
  state: Pick<
    SecondLifeState,
    'housingScenario' | 'stayOption' | 'hometownOption' | 'newAreaOption'
  >,
): number {
  if (state.housingScenario === 'stay') {
    if (state.stayOption === 'continue') return 0;
    return state.stayOption === 'renovate'
      ? SECOND_LIFE_RENOVATE_CURRENT_HOME_MAN
      : SECOND_LIFE_PURCHASE_REBUILD_MAN;
  }
  if (state.housingScenario === 'hometown') {
    return state.hometownOption === 'renovate_parents'
      ? SECOND_LIFE_RENOVATE_PARENTS_HOME_MAN
      : SECOND_LIFE_PURCHASE_REBUILD_MAN;
  }
  return state.newAreaOption === 'rent' ? 0 : SECOND_LIFE_PURCHASE_REBUILD_MAN;
}

export function getSecondLifeHousingLoanPrincipalMan(
  state: Pick<
    SecondLifeState,
    'housingBaseCostMan' | 'housingLoanDownPaymentMan'
  >,
): number {
  const cost = Math.max(0, state.housingBaseCostMan);
  const down = Math.min(cost, Math.max(0, state.housingLoanDownPaymentMan));
  return Math.max(0, cost - down);
}

export function isSecondLifeHousingLoanConfigured(
  state: Pick<
    SecondLifeState,
    | 'housingPaymentMethod'
    | 'housingBaseCostMan'
    | 'housingLoanDownPaymentMan'
    | 'housingLoanInterestRatePct'
    | 'housingLoanYears'
  >,
): boolean {
  return (
    state.housingPaymentMethod === 'loan' &&
    getSecondLifeHousingLoanPrincipalMan(state) > 0 &&
    state.housingLoanInterestRatePct != null &&
    Number.isFinite(state.housingLoanInterestRatePct) &&
    state.housingLoanInterestRatePct >= 0 &&
    state.housingLoanYears != null &&
    Number.isFinite(state.housingLoanYears) &&
    state.housingLoanYears > 0
  );
}

/**
 * ローン未設定・支払方法未定の場合は、借入を勝手に作らず全額を一括支出として扱う。
 */
export function getSecondLifeHousingCashPaymentMan(
  state: Pick<
    SecondLifeState,
    | 'housingPaymentMethod'
    | 'housingBaseCostMan'
    | 'housingLoanDownPaymentMan'
    | 'housingLoanInterestRatePct'
    | 'housingLoanYears'
  >,
): number {
  const cost = Math.max(0, state.housingBaseCostMan);
  if (!isSecondLifeHousingLoanConfigured(state)) return cost;
  return Math.min(cost, Math.max(0, state.housingLoanDownPaymentMan));
}

export function buildSecondLifeHousingFinancePlan(
  state: Pick<
    SecondLifeState,
    | 'housingPaymentMethod'
    | 'housingBaseCostMan'
    | 'housingLoanDownPaymentMan'
    | 'housingLoanInterestRatePct'
    | 'housingLoanYears'
  >,
  purpose: SecondLifeHousingFinancePlan['purpose'],
  startAge: number,
): SecondLifeHousingFinancePlan {
  const configured = isSecondLifeHousingLoanConfigured(state);
  return {
    purpose,
    paymentMethod: state.housingPaymentMethod,
    totalCostMan: Math.max(0, state.housingBaseCostMan),
    cashPaymentMan: getSecondLifeHousingCashPaymentMan(state),
    loanPrincipalMan: configured ? getSecondLifeHousingLoanPrincipalMan(state) : 0,
    interestRatePct: configured ? state.housingLoanInterestRatePct : null,
    years: configured ? state.housingLoanYears : null,
    startAge,
    startMonth: 1,
  };
}

/** Q12表示用。固定金利・元利均等・ボーナス返済なしの概算月額（万円）。 */
export function estimateSecondLifeHousingLoanMonthlyMan(
  state: Pick<
    SecondLifeState,
    | 'housingPaymentMethod'
    | 'housingBaseCostMan'
    | 'housingLoanDownPaymentMan'
    | 'housingLoanInterestRatePct'
    | 'housingLoanYears'
  >,
): number | null {
  if (!isSecondLifeHousingLoanConfigured(state)) return null;
  const principal = getSecondLifeHousingLoanPrincipalMan(state);
  const months = Math.round((state.housingLoanYears ?? 0) * 12);
  if (principal <= 0 || months <= 0) return null;
  const monthlyRate = (state.housingLoanInterestRatePct ?? 0) / 100 / 12;
  const payment =
    monthlyRate === 0
      ? principal / months
      : (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
        (Math.pow(1 + monthlyRate, months) - 1);
  return Math.round(payment * 10) / 10;
}

export function getSecondLifeHousingBaseCostLabel(
  state: Pick<
    SecondLifeState,
    'housingScenario' | 'stayOption' | 'hometownOption' | 'newAreaOption'
  >,
): string {
  const kind = getSecondLifeHousingTemplateKind({ ...state, housingSkip: false });
  return kind === 'renovate' ? 'リフォーム費の目安' : '住宅費の目安';
}
''')

# 3) Defaults + migration
p = 'src/lib/secondLifeDefaults.ts'
s = read(p)
s = replace_once(s,
"import { captureSecondLifeQ3ApplySnapshot } from './secondLifeApplyStatus';\n",
"import { captureSecondLifeQ3ApplySnapshot } from './secondLifeApplyStatus';\nimport {\n  getDefaultSecondLifeHousingBaseCostMan,\n  SECOND_LIFE_DEFAULT_RENT_MAN,\n} from './secondLifeHousingFinance';\n",
'default imports')
s = replace_once(s,
"    includeMovingCost: false,\n    includePostPurchaseRenovation: false,\n    // 生活費も同様に、明示的に見直すまでは Q4 の原本を使う。\n",
"    includeMovingCost: false,\n    includePostPurchaseRenovation: false,\n    housingBaseCostMan: SECOND_LIFE_RENOVATE_CURRENT_HOME_MAN_FALLBACK,\n    housingRentMonthlyMan: SECOND_LIFE_DEFAULT_RENT_MAN,\n    // 支払い方法は未定を初期値にし、勝手にローンを作らない。\n    housingPaymentMethod: 'undecided',\n    housingLoanDownPaymentMan: 0,\n    housingLoanInterestRatePct: null,\n    housingLoanYears: null,\n    // 生活費も同様に、明示的に見直すまでは Q4 の原本を使う。\n",
'default finance fields')
# Avoid importing another constant just for the default; compute through local constant then normalize below.
s = s.replace("export const SECOND_LIFE_DEFAULT_NURSING_START_AGE = 80;\n", "export const SECOND_LIFE_DEFAULT_NURSING_START_AGE = 80;\nconst SECOND_LIFE_RENOVATE_CURRENT_HOME_MAN_FALLBACK = 500;\n", 1)
needle = "  const storedStayOption = value.stayOption ?? defaults.stayOption;\n"
insert = """  const housingScenario = value.housingScenario ?? defaults.housingScenario;\n  const hometownOption = value.hometownOption ?? defaults.hometownOption;\n  const newAreaOption = value.newAreaOption ?? defaults.newAreaOption;\n\n"""
s = replace_once(s, needle, insert + needle, 'migration selection values')
needle = "  const stayOption =\n    !housingSkip && storedStayOption === 'continue'\n      ? 'renovate'\n      : storedStayOption;\n\n  return {\n"
insert = """  const stayOption =\n    !housingSkip && storedStayOption === 'continue'\n      ? 'renovate'\n      : storedStayOption;\n\n  const housingBaseCostMan =\n    typeof value.housingBaseCostMan === 'number' && value.housingBaseCostMan >= 0\n      ? value.housingBaseCostMan\n      : getDefaultSecondLifeHousingBaseCostMan({\n          housingScenario,\n          stayOption,\n          hometownOption,\n          newAreaOption,\n        });\n  const housingRentMonthlyMan =\n    typeof value.housingRentMonthlyMan === 'number' && value.housingRentMonthlyMan >= 0\n      ? value.housingRentMonthlyMan\n      : defaults.housingRentMonthlyMan;\n  const housingPaymentMethod =\n    value.housingPaymentMethod === 'cash' ||\n    value.housingPaymentMethod === 'loan' ||\n    value.housingPaymentMethod === 'undecided'\n      ? value.housingPaymentMethod\n      : defaults.housingPaymentMethod;\n  const housingLoanDownPaymentMan = Math.min(\n    housingBaseCostMan,\n    typeof value.housingLoanDownPaymentMan === 'number' &&\n      value.housingLoanDownPaymentMan >= 0\n      ? value.housingLoanDownPaymentMan\n      : defaults.housingLoanDownPaymentMan,\n  );\n  const housingLoanInterestRatePct =\n    typeof value.housingLoanInterestRatePct === 'number' &&\n    value.housingLoanInterestRatePct >= 0\n      ? value.housingLoanInterestRatePct\n      : null;\n  const housingLoanYears =\n    typeof value.housingLoanYears === 'number' && value.housingLoanYears > 0\n      ? Math.min(50, Math.max(1, Math.round(value.housingLoanYears)))\n      : null;\n\n  return {\n"""
s = replace_once(s, needle, insert, 'migration finance values')
s = replace_once(s,
"    startAge,\n    housingActionAge,\n    housingSkip,\n    livingSkip,\n    stayOption,\n",
"    startAge,\n    housingActionAge,\n    housingSkip,\n    housingScenario,\n    hometownOption,\n    newAreaOption,\n    livingSkip,\n    stayOption,\n    housingBaseCostMan,\n    housingRentMonthlyMan,\n    housingPaymentMethod,\n    housingLoanDownPaymentMan,\n    housingLoanInterestRatePct,\n    housingLoanYears,\n",
'migration return finance')
write(p, s)

# 4) Estimates: source visible amounts from SecondLifeState instead of hidden fixed values.
p = 'src/lib/secondLifeEstimates.ts'
s = read(p)
s = replace_once(s,
"import { getMemberAgeAtYearEnd } from './memberYearIncome';\n\nconst MOVING_COST_MAN = 50;\nconst POST_PURCHASE_RENOVATION_MAN = 300;\nconst RENOVATE_CURRENT_HOME_MAN = 500;\nconst PURCHASE_REBUILD_MAN = 2_500;\nconst RENOVATE_PARENTS_HOME_MAN = 400;\n",
"import { getMemberAgeAtYearEnd } from './memberYearIncome';\nimport {\n  SECOND_LIFE_MOVING_COST_MAN,\n  SECOND_LIFE_POST_PURCHASE_RENOVATION_MAN,\n} from './secondLifeHousingFinance';\n",
'estimate constants')
# Remove obsolete base estimator function.
start = s.find('function estimateBaseHousingCostMan(')
end = s.find('export function estimateSecondLifeHousingTotalMan(', start)
if start < 0 or end < 0:
    raise SystemExit('missing estimateBaseHousingCostMan block')
s = s[:start] + s[end:]
s = replace_once(s,
"    | 'includeMovingCost'\n    | 'includePostPurchaseRenovation'\n  >,\n): number | null {\n  let total = estimateBaseHousingCostMan(\n    state.housingScenario,\n    state.stayOption,\n    state.hometownOption,\n    state.newAreaOption,\n  );\n\n  const needsMoving = state.includeMovingCost;\n  if (needsMoving) {\n    total += MOVING_COST_MAN;\n  }\n",
"    | 'includeMovingCost'\n    | 'includePostPurchaseRenovation'\n    | 'housingBaseCostMan'\n  >,\n): number | null {\n  let total = Math.max(0, state.housingBaseCostMan);\n\n  const needsMoving = state.includeMovingCost;\n  if (needsMoving) {\n    total += SECOND_LIFE_MOVING_COST_MAN;\n  }\n",
'estimate state base cost')
s = s.replace('total += POST_PURCHASE_RENOVATION_MAN;', 'total += SECOND_LIFE_POST_PURCHASE_RENOVATION_MAN;', 1)
write(p, s)

# 5) Housing type: derived Q12 financing metadata.
p = 'src/types/housing.ts'
s = read(p)
marker = "export interface OwnedProperty {\n"
finance_type = """/** Q12の計算専用オーバーレイ。Q5原本には保存しない。 */\nexport interface SecondLifeHousingFinancePlan {\n  purpose: 'purchase' | 'renovation';\n  paymentMethod: 'undecided' | 'cash' | 'loan';\n  totalCostMan: number;\n  cashPaymentMan: number;\n  loanPrincipalMan: number;\n  interestRatePct: number | null;\n  years: number | null;\n  startAge: number;\n  startMonth: number;\n}\n\n"""
s = replace_once(s, marker, finance_type + marker, 'housing finance type')
s = replace_once(s,
"  /** Q12 の転居反映前に設定されていた終了条件 */\n  secondLifeEndOverride?: SecondLifeEndOverride;\n  buildingMan: number;\n",
"  /** Q12 の転居反映前に設定されていた終了条件 */\n  secondLifeEndOverride?: SecondLifeEndOverride;\n  /** Q12の計算専用ローン・支払方法（原本には保存しない） */\n  secondLifeFinancePlan?: SecondLifeHousingFinancePlan;\n  /** Q12購入時に別途一括で見込む引越し等（万円） */\n  secondLifeInitialCashCostMan?: number;\n  buildingMan: number;\n",
'owned finance fields')
write(p, s)

# 6) Preserve derived metadata through housing migration.
p = 'src/lib/housingDefaults.ts'
s = read(p)
s = replace_once(s,
"    ...(property.secondLifeEndOverride\n      ? { secondLifeEndOverride: property.secondLifeEndOverride }\n      : {}),\n",
"    ...(property.secondLifeEndOverride\n      ? { secondLifeEndOverride: property.secondLifeEndOverride }\n      : {}),\n    ...(property.secondLifeFinancePlan\n      ? { secondLifeFinancePlan: property.secondLifeFinancePlan }\n      : {}),\n    ...(typeof property.secondLifeInitialCashCostMan === 'number'\n      ? { secondLifeInitialCashCostMan: property.secondLifeInitialCashCostMan }\n      : {}),\n",
'preserve finance metadata')
write(p, s)

# 7) Templates: visible rent/base cost and explicit finance plan.
p = 'src/lib/secondLifeTemplates.ts'
s = read(p)
s = replace_once(s,
"import { estimateSecondLifeHousingTotalMan } from './secondLifeEstimates';\n",
"import { estimateSecondLifeHousingTotalMan } from './secondLifeEstimates';\nimport {\n  buildSecondLifeHousingFinancePlan,\n  getSecondLifeHousingCashPaymentMan,\n  SECOND_LIFE_MOVING_COST_MAN,\n  SECOND_LIFE_POST_PURCHASE_RENOVATION_MAN,\n} from './secondLifeHousingFinance';\n",
'template finance imports')
s = s.replace("const DEFAULT_SECOND_LIFE_RENT_MAN = 8;\nconst PURCHASE_BUILDING_MAN = 2_000;\nconst PURCHASE_LAND_MAN = 500;\n", "const SECOND_LIFE_POST_PURCHASE_IMPROVEMENT_ID = 'second-life-post-purchase-renovation';\n", 1)
s = replace_once(s,
"        improvements: property.maintenance.improvements.filter(\n          (entry) => entry.id !== SECOND_LIFE_IMPROVEMENT_ID,\n        ),\n",
"        improvements: property.maintenance.improvements.filter(\n          (entry) =>\n            entry.id !== SECOND_LIFE_IMPROVEMENT_ID &&\n            entry.id !== SECOND_LIFE_POST_PURCHASE_IMPROVEMENT_ID,\n        ),\n",
'strip finance improvements')
# Remove rent resolver function.
start = s.find('function resolveMonthlyRentMan(')
end = s.find('function stripSecondLifeHousingItems(', start)
if start >= 0 and end >= 0:
    s = s[:start] + s[end:]

s = replace_once(s,
"    const amountMan = estimateSecondLifeHousingTotalMan(input.secondLifeState) ?? 0;\n",
"    const amountMan =\n      getSecondLifeHousingCashPaymentMan(input.secondLifeState) +\n      (input.secondLifeState.includeMovingCost\n        ? SECOND_LIFE_MOVING_COST_MAN\n        : 0);\n",
'renovation cash amount')
# attach finance to hometown generated property
s = replace_once(s,
"          paymentMethod: 'cash',\n          currentExpenseMode: 'simple',\n          simpleMonthlyExpenseMan: 0,\n",
"          paymentMethod: 'cash',\n          currentExpenseMode: 'simple',\n          simpleMonthlyExpenseMan: 0,\n          secondLifeFinancePlan: buildSecondLifeHousingFinancePlan(\n            input.secondLifeState,\n            'renovation',\n            startAge,\n          ),\n",
'hometown renovation finance')
# attach to current owned property update
s = replace_once(s,
"        const updated = {\n          ...property,\n          maintenance: {\n",
"        const updated = {\n          ...property,\n          secondLifeFinancePlan: buildSecondLifeHousingFinancePlan(\n            input.secondLifeState,\n            'renovation',\n            startAge,\n          ),\n          maintenance: {\n",
'current renovation finance')
# rent amount explicit
s = replace_once(s,
"    const monthlyRentMan = resolveMonthlyRentMan(stripped.rentals, startAge);\n",
"    const monthlyRentMan = Math.max(0, input.secondLifeState.housingRentMonthlyMan);\n",
'rent monthly input')
s = s.replace('movingCostMan: includeMoving ? 50 : 0,', 'movingCostMan: includeMoving ? SECOND_LIFE_MOVING_COST_MAN : 0,', 1)
# purchase block values + custom finance
s = replace_once(s,
"        buildingMan: PURCHASE_BUILDING_MAN,\n        landMan: PURCHASE_LAND_MAN,\n        paymentMethod: 'loan',\n        brokerageFeeMan: includeMoving ? 50 : 0,\n",
"        // Q12では土地・建物の内訳を仮定せず、住まい本体の目安額を建物側に集約する。\n        buildingMan: Math.max(0, input.secondLifeState.housingBaseCostMan),\n        landMan: 0,\n        // 標準Q5ローンを自動作成せず、Q12専用の明示条件で計算する。\n        paymentMethod: 'cash',\n        brokerageFeeMan: 0,\n        secondLifeFinancePlan: buildSecondLifeHousingFinancePlan(\n          input.secondLifeState,\n          'purchase',\n          startAge,\n        ),\n        secondLifeInitialCashCostMan: includeMoving\n          ? SECOND_LIFE_MOVING_COST_MAN\n          : 0,\n",
'purchase finance values')
# add post-purchase renovation improvement before pushing property. Need property mutable.
s = s.replace("    const property = createOwnedProperty(\n      'detached_house',", "    let property = createOwnedProperty(\n      'detached_house',", 1)
needle = """      { rentals, owned },\n    );\n    owned = [...owned, property];\n    changes.push({\n      type: 'added',\n      propertyKind: 'owned',\n"""
replacement = """      { rentals, owned },\n    );\n    if (input.secondLifeState.includePostPurchaseRenovation) {\n      const birthYear = calcBirthYear(\n        input.member.age,\n        input.member.birthMonth,\n        input.referenceDate,\n      );\n      const improvementYear = calcYearAtAge(\n        birthYear,\n        input.member.birthMonth ?? 1,\n        startAge,\n        1,\n      );\n      property = {\n        ...property,\n        maintenance: {\n          ...property.maintenance,\n          improvements: [\n            ...property.maintenance.improvements,\n            createOwnedImprovementEntry(improvementYear, 1, {\n              id: SECOND_LIFE_POST_PURCHASE_IMPROVEMENT_ID,\n              amountMan: SECOND_LIFE_POST_PURCHASE_RENOVATION_MAN,\n            }),\n          ],\n        },\n      };\n    }\n    owned = [...owned, property];\n    changes.push({\n      type: 'added',\n      propertyKind: 'owned',\n"""
s = replace_once(s, needle, replacement, 'purchase post renovation')
write(p, s)

# 8) Housing cash flow: honor Q12 finance plan and current-simple renovations.
p = 'src/lib/housingCashFlow.ts'
s = read(p)
s = replace_once(s,
"  calcRepaymentMonthIndex,\n  getLoanRepaymentStartCalendar,\n",
"  calcLoanRepaymentMonthYen,\n  calcRepaymentMonthIndex,\n  getLoanRepaymentStartCalendar,\n",
'cashflow amortization import')
# Insert helper after improvement calculator.
marker = """function getOwnedOwnershipStartYear(\n"""
helper = r'''function calcSecondLifeFinanceLoanMonth(
  property: OwnedProperty,
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): { principal: number; interest: number } {
  const plan = property.secondLifeFinancePlan;
  if (
    !plan ||
    plan.paymentMethod !== 'loan' ||
    plan.loanPrincipalMan <= 0 ||
    plan.interestRatePct == null ||
    plan.years == null ||
    plan.years <= 0
  ) {
    return { principal: 0, interest: 0 };
  }

  const birthMonth = resolveMemberBirthMonth(member);
  const birthYear = calcBirthYear(member.age, birthMonth, referenceDate);
  const startYear = calcYearAtAge(
    birthYear,
    birthMonth,
    plan.startAge,
    plan.startMonth,
  );
  const startIndex = startYear * 12 + plan.startMonth;
  const currentIndex = calendarYear * 12 + calendarMonth;
  const repaymentMonthIndex = currentIndex - startIndex + 1;
  const totalMonths = Math.round(plan.years * 12);
  if (repaymentMonthIndex <= 0 || repaymentMonthIndex > totalMonths) {
    return { principal: 0, interest: 0 };
  }

  const result = calcLoanRepaymentMonthYen(
    plan.loanPrincipalMan * 10_000,
    totalMonths,
    repaymentMonthIndex,
    'equal_payment',
    () => plan.interestRatePct ?? 0,
    () => [],
  );
  return {
    principal: yenToMan(result.principalYen),
    interest: yenToMan(result.interestYen),
  };
}

'''
s = replace_once(s, marker, helper + marker, 'finance cashflow helper')
# Current simple should not early-return before Q12 improvement/finance.
s = replace_once(s,
"  if (\n    property.usage === \"current\" &&\n    property.currentExpenseMode === \"simple\"\n  ) {\n    detail.simpleMonthlyCost = property.simpleMonthlyExpenseMan;\n    return detail;\n  }\n\n  // 居住中は過去の購入時支出を試算に含めない\n",
"  const isCurrentSimple =\n    property.usage === \"current\" &&\n    property.currentExpenseMode === \"simple\";\n  if (isCurrentSimple) {\n    detail.simpleMonthlyCost = property.simpleMonthlyExpenseMan;\n  }\n\n  // 居住中は過去の購入時支出を試算に含めない\n",
'current simple delayed return')
# Custom purchase initial.
s = replace_once(s,
"    detail.purchaseInitial =\n      property.paymentMethod === \"cash\"\n        ? calcOwnedCashPurchaseInitialMan(property)\n        : calcOwnedLoanDownPaymentMan(\n            property,\n            loanState && targetId\n              ? resolveOwnedPropertyLoanSettings(property, loanState, targetId)\n              : property.loan,\n            loanState,\n            targetId,\n          );\n",
"    const q12Finance = property.secondLifeFinancePlan;\n    detail.purchaseInitial =\n      q12Finance?.purpose === 'purchase'\n        ? q12Finance.cashPaymentMan +\n          Math.max(0, property.secondLifeInitialCashCostMan ?? 0)\n        : property.paymentMethod === \"cash\"\n          ? calcOwnedCashPurchaseInitialMan(property)\n          : calcOwnedLoanDownPaymentMan(\n              property,\n              loanState && targetId\n                ? resolveOwnedPropertyLoanSettings(property, loanState, targetId)\n                : property.loan,\n              loanState,\n              targetId,\n            );\n",
'custom purchase initial')
# Add Q12 finance after improvement cost, then return for simple current.
needle = """  detail.improvementCost = calcOwnedImprovementCostMan(\n    property,\n    calendarYear,\n    calendarMonth,\n  );\n\n  if (\n    property.usage !== \"current\" &&\n"""
replacement = """  detail.improvementCost = calcOwnedImprovementCostMan(\n    property,\n    calendarYear,\n    calendarMonth,\n  );\n\n  const q12Loan = calcSecondLifeFinanceLoanMonth(\n    property,\n    member,\n    referenceDate,\n    calendarYear,\n    calendarMonth,\n  );\n  detail.loanRepaymentDetail.principal += q12Loan.principal;\n  detail.loanRepaymentDetail.interest += q12Loan.interest;\n\n  // 簡単入力の現在住宅でも、Q12のリフォーム費・ローンだけは追加してから返す。\n  if (isCurrentSimple) {\n    return detail;\n  }\n\n  if (\n    property.usage !== \"current\" &&\n"""
s = replace_once(s, needle, replacement, 'q12 finance calculation')
write(p, s)

# 9) Rebuild the Q12 housing section with explicit assumptions and financing UX.
write('src/components/secondLife/SecondLifeHousingSection.tsx', r'''import type { SecondLifeState } from '../../types/secondLife';
import {
  estimateSecondLifeHousingTotalMan,
  formatSecondLifeMan,
} from '../../lib/secondLifeEstimates';
import { getSecondLifeHousingTemplateKind } from '../../lib/secondLifeLabels';
import {
  estimateSecondLifeHousingLoanMonthlyMan,
  getDefaultSecondLifeHousingBaseCostMan,
  getSecondLifeHousingBaseCostLabel,
  getSecondLifeHousingLoanPrincipalMan,
  isSecondLifeHousingLoanConfigured,
  SECOND_LIFE_MOVING_COST_MAN,
  SECOND_LIFE_POST_PURCHASE_RENOVATION_MAN,
} from '../../lib/secondLifeHousingFinance';
import { SecondLifeChoiceCard } from './SecondLifeChoiceCard';
import { SecondLifeModeSelector } from './SecondLifeModeSelector';

interface SecondLifeHousingSectionProps {
  state: SecondLifeState;
  onChange: (patch: Partial<SecondLifeState>) => void;
  onApply?: () => void;
}

const HOUSING_SCENARIOS: {
  id: SecondLifeState['housingScenario'];
  label: string;
}[] = [
  { id: 'stay', label: '今の場所でリフォーム・建て替え' },
  { id: 'hometown', label: '地元に帰る' },
  { id: 'new_area', label: '新しい土地で暮らす' },
];

export function SecondLifeHousingSection({
  state,
  onChange,
}: SecondLifeHousingSectionProps) {
  const total = estimateSecondLifeHousingTotalMan(state);
  const useCurrentPlan = state.housingSkip;
  const housingKind = getSecondLifeHousingTemplateKind(state);
  const hasHousingAction = housingKind !== 'stay' && housingKind !== 'skip';
  const isRent = housingKind === 'rent';
  const needsBaseCost = housingKind === 'renovate' || housingKind === 'purchase';
  const loanConfigured = isSecondLifeHousingLoanConfigured(state);
  const loanPrincipalMan = getSecondLifeHousingLoanPrincipalMan(state);
  const loanMonthlyMan = estimateSecondLifeHousingLoanMonthlyMan(state);

  const withSelectionDefaults = (patch: Partial<SecondLifeState>) => {
    const next = { ...state, ...patch };
    onChange({
      ...patch,
      housingBaseCostMan: getDefaultSecondLifeHousingBaseCostMan(next),
    });
  };

  const startHousingReview = () => {
    const patch: Partial<SecondLifeState> = { housingSkip: false };
    if (state.housingScenario === 'stay') {
      patch.includeMovingCost = false;
      if (state.stayOption === 'continue') {
        patch.stayOption = 'renovate';
      }
    }
    const next = { ...state, ...patch };
    onChange({
      ...patch,
      housingBaseCostMan:
        state.housingBaseCostMan > 0
          ? state.housingBaseCostMan
          : getDefaultSecondLifeHousingBaseCostMan(next),
    });
  };

  const selectHousingScenario = (scenario: SecondLifeState['housingScenario']) => {
    const patch: Partial<SecondLifeState> = { housingScenario: scenario };
    if (scenario === 'stay') {
      patch.includeMovingCost = false;
      if (state.stayOption === 'continue') patch.stayOption = 'renovate';
    }
    withSelectionDefaults(patch);
  };

  const setBaseCost = (value: number) => {
    const housingBaseCostMan = Math.max(0, value || 0);
    onChange({
      housingBaseCostMan,
      housingLoanDownPaymentMan: Math.min(
        housingBaseCostMan,
        Math.max(0, state.housingLoanDownPaymentMan),
      ),
    });
  };

  const estimatedLoanEndAge =
    state.housingLoanYears != null
      ? state.housingActionAge + state.housingLoanYears
      : null;

  return (
    <section className="second-life-section">
      <SecondLifeModeSelector
        title="これからの住まいはどうしますか？"
        useCurrent={useCurrentPlan}
        currentLabel="今の住まい計画をそのまま使う"
        reviewLabel="これからの住まいを見直す"
        currentDescription="「住まい」で入力している期間・費用のまま計算します。"
        reviewDescription="リフォーム・建て替え・転居など、今の計画から変える内容を設定します。"
        name="second-life-housing-mode"
        onUseCurrent={() => onChange({ housingSkip: true })}
        onReview={startHousingReview}
      />

      {useCurrentPlan ? (
        <div className="second-life-section-actions">
          <p className="second-life-apply-note">
            「住まい」で入力した内容のまま計算します。元の入力は変更しません。
          </p>
        </div>
      ) : (
        <>
          <div className="second-life-section-toolbar">
            <p className="second-life-apply-note">
              住まいを変える時期を設定してください（{state.startAge}歳以降）。
            </p>
            {hasHousingAction ? (
              <label className="second-life-timing">
                <span>住まいを変える年齢（世帯主）</span>
                <input
                  type="number"
                  className="second-life-age-input"
                  min={state.startAge}
                  max={110}
                  value={state.housingActionAge}
                  onChange={(event) =>
                    onChange({
                      housingActionAge: Math.max(
                        state.startAge,
                        Number(event.target.value) || state.startAge,
                      ),
                    })
                  }
                />
                <span>歳</span>
              </label>
            ) : null}
          </div>

          <div
            className="second-life-choice-grid"
            role="radiogroup"
            aria-label="セカンドライフの住まい方"
          >
            {HOUSING_SCENARIOS.map((scenario) => {
              const active = state.housingScenario === scenario.id;
              return (
                <SecondLifeChoiceCard
                  key={scenario.id}
                  active={active}
                  label={scenario.label}
                  name="second-life-housing-scenario"
                  onSelect={() => selectHousingScenario(scenario.id)}
                >
                  {scenario.id === 'stay' ? (
                    <>
                      <label className="second-life-inline-option">
                        <input
                          type="radio"
                          name="second-life-stay"
                          checked={state.stayOption === 'renovate'}
                          onChange={() =>
                            withSelectionDefaults({
                              housingScenario: 'stay',
                              stayOption: 'renovate',
                              includeMovingCost: false,
                            })
                          }
                        />
                        現在の住宅をリフォームしながら住む
                      </label>
                      <label className="second-life-inline-option">
                        <input
                          type="radio"
                          name="second-life-stay"
                          checked={state.stayOption === 'purchase_rebuild'}
                          onChange={() =>
                            withSelectionDefaults({
                              housingScenario: 'stay',
                              stayOption: 'purchase_rebuild',
                              includeMovingCost: false,
                            })
                          }
                        />
                        新たに住宅購入・建て替え（増改築含む）
                      </label>
                      {state.stayOption === 'purchase_rebuild' ? (
                        <label className="second-life-inline-option">
                          <input
                            type="checkbox"
                            checked={state.includePostPurchaseRenovation}
                            onChange={(event) =>
                              onChange({
                                includePostPurchaseRenovation:
                                  event.target.checked,
                              })
                            }
                          />
                          購入・建て替え後のリフォーム（仮に
                          {SECOND_LIFE_POST_PURCHASE_RENOVATION_MAN}万円）
                        </label>
                      ) : null}
                    </>
                  ) : null}

                  {scenario.id === 'hometown' ? (
                    <>
                      <label className="second-life-inline-option">
                        <input
                          type="radio"
                          name="second-life-hometown"
                          checked={state.hometownOption === 'renovate_parents'}
                          onChange={() =>
                            withSelectionDefaults({
                              housingScenario: 'hometown',
                              hometownOption: 'renovate_parents',
                            })
                          }
                        />
                        実家をリフォームしながら住む
                      </label>
                      <label className="second-life-inline-option">
                        <input
                          type="radio"
                          name="second-life-hometown"
                          checked={state.hometownOption === 'purchase_rebuild'}
                          onChange={() =>
                            withSelectionDefaults({
                              housingScenario: 'hometown',
                              hometownOption: 'purchase_rebuild',
                            })
                          }
                        />
                        新たに住宅購入・建て替え（増改築含む）
                      </label>
                      <label className="second-life-inline-option">
                        <input
                          type="checkbox"
                          checked={state.includeMovingCost}
                          onChange={(event) =>
                            onChange({ includeMovingCost: event.target.checked })
                          }
                        />
                        引越し費を見込む（仮に{SECOND_LIFE_MOVING_COST_MAN}万円）
                      </label>
                      {state.hometownOption === 'purchase_rebuild' ? (
                        <label className="second-life-inline-option">
                          <input
                            type="checkbox"
                            checked={state.includePostPurchaseRenovation}
                            onChange={(event) =>
                              onChange({
                                includePostPurchaseRenovation:
                                  event.target.checked,
                              })
                            }
                          />
                          購入・建て替え後のリフォーム（仮に
                          {SECOND_LIFE_POST_PURCHASE_RENOVATION_MAN}万円）
                        </label>
                      ) : null}
                    </>
                  ) : null}

                  {scenario.id === 'new_area' ? (
                    <>
                      <label className="second-life-inline-option">
                        <input
                          type="radio"
                          name="second-life-new-area"
                          checked={state.newAreaOption === 'rent'}
                          onChange={() =>
                            withSelectionDefaults({
                              housingScenario: 'new_area',
                              newAreaOption: 'rent',
                            })
                          }
                        />
                        賃貸住宅に住む
                      </label>
                      <label className="second-life-inline-option">
                        <input
                          type="radio"
                          name="second-life-new-area"
                          checked={state.newAreaOption === 'purchase'}
                          onChange={() =>
                            withSelectionDefaults({
                              housingScenario: 'new_area',
                              newAreaOption: 'purchase',
                            })
                          }
                        />
                        新たに住宅購入・建て替え（増改築含む）
                      </label>
                      <label className="second-life-inline-option">
                        <input
                          type="checkbox"
                          checked={state.includeMovingCost}
                          onChange={(event) =>
                            onChange({ includeMovingCost: event.target.checked })
                          }
                        />
                        引越し費を見込む（仮に{SECOND_LIFE_MOVING_COST_MAN}万円）
                      </label>
                      {state.newAreaOption === 'purchase' ? (
                        <label className="second-life-inline-option">
                          <input
                            type="checkbox"
                            checked={state.includePostPurchaseRenovation}
                            onChange={(event) =>
                              onChange({
                                includePostPurchaseRenovation:
                                  event.target.checked,
                              })
                            }
                          />
                          購入・建て替え後のリフォーム（仮に
                          {SECOND_LIFE_POST_PURCHASE_RENOVATION_MAN}万円）
                        </label>
                      ) : null}
                    </>
                  ) : null}
                </SecondLifeChoiceCard>
              );
            })}
          </div>

          {isRent ? (
            <div className="second-life-section-toolbar">
              <label className="second-life-timing">
                <span>想定する月額家賃</span>
                <input
                  type="number"
                  className="second-life-age-input"
                  min={0}
                  step={0.1}
                  value={state.housingRentMonthlyMan}
                  onChange={(event) =>
                    onChange({
                      housingRentMonthlyMan: Math.max(
                        0,
                        Number(event.target.value) || 0,
                      ),
                    })
                  }
                />
                <span>万円</span>
              </label>
              <p className="second-life-apply-note">
                敷金1か月・礼金1か月・仲介手数料0.5か月を試算用の仮設定にしています。実際の契約条件とは異なる場合があります。
              </p>
              <p className="second-life-apply-note">
                初期費用の仮試算：{formatSecondLifeMan(
                  state.housingRentMonthlyMan * 2.5 +
                    (state.includeMovingCost ? SECOND_LIFE_MOVING_COST_MAN : 0),
                )}万円
              </p>
            </div>
          ) : null}

          {needsBaseCost ? (
            <div className="second-life-section-toolbar">
              <label className="second-life-timing">
                <span>{getSecondLifeHousingBaseCostLabel(state)}</span>
                <input
                  type="number"
                  className="second-life-age-input"
                  min={0}
                  step={10}
                  value={state.housingBaseCostMan}
                  onChange={(event) => setBaseCost(Number(event.target.value))}
                />
                <span>万円</span>
              </label>
              <p className="second-life-apply-note">
                最初に入っている金額は比較用の仮設定です。見積額や希望額が分かる場合は、ここを変更してください。
              </p>

              <div role="radiogroup" aria-label="住まい費用の支払い方法">
                <label className="second-life-inline-option">
                  <input
                    type="radio"
                    name="second-life-housing-payment"
                    checked={state.housingPaymentMethod === 'cash'}
                    onChange={() => onChange({ housingPaymentMethod: 'cash' })}
                  />
                  現金で支払う
                </label>
                <label className="second-life-inline-option">
                  <input
                    type="radio"
                    name="second-life-housing-payment"
                    checked={state.housingPaymentMethod === 'loan'}
                    onChange={() => onChange({ housingPaymentMethod: 'loan' })}
                  />
                  ローンを利用する
                </label>
                <label className="second-life-inline-option">
                  <input
                    type="radio"
                    name="second-life-housing-payment"
                    checked={state.housingPaymentMethod === 'undecided'}
                    onChange={() =>
                      onChange({ housingPaymentMethod: 'undecided' })
                    }
                  />
                  まだ決めていない
                </label>
              </div>

              {state.housingPaymentMethod === 'loan' ? (
                <>
                  <label className="second-life-timing">
                    <span>頭金</span>
                    <input
                      type="number"
                      className="second-life-age-input"
                      min={0}
                      max={state.housingBaseCostMan}
                      step={10}
                      value={state.housingLoanDownPaymentMan}
                      onChange={(event) =>
                        onChange({
                          housingLoanDownPaymentMan: Math.min(
                            state.housingBaseCostMan,
                            Math.max(0, Number(event.target.value) || 0),
                          ),
                        })
                      }
                    />
                    <span>万円</span>
                  </label>
                  <label className="second-life-timing">
                    <span>金利（固定で仮試算）</span>
                    <input
                      type="number"
                      className="second-life-age-input"
                      min={0}
                      max={20}
                      step={0.1}
                      value={state.housingLoanInterestRatePct ?? ''}
                      placeholder="例 2.0"
                      onChange={(event) =>
                        onChange({
                          housingLoanInterestRatePct:
                            event.target.value === ''
                              ? null
                              : Math.max(0, Number(event.target.value)),
                        })
                      }
                    />
                    <span>%</span>
                  </label>
                  <label className="second-life-timing">
                    <span>返済期間</span>
                    <input
                      type="number"
                      className="second-life-age-input"
                      min={1}
                      max={50}
                      value={state.housingLoanYears ?? ''}
                      placeholder="例 10"
                      onChange={(event) =>
                        onChange({
                          housingLoanYears:
                            event.target.value === ''
                              ? null
                              : Math.min(
                                  50,
                                  Math.max(1, Math.round(Number(event.target.value))),
                                ),
                        })
                      }
                    />
                    <span>年</span>
                  </label>
                  <p className="second-life-apply-note">
                    借入予定額：{formatSecondLifeMan(loanPrincipalMan)}万円
                    {loanMonthlyMan != null
                      ? ` ／ 月々の返済目安：約${formatSecondLifeMan(loanMonthlyMan)}万円`
                      : ''}
                  </p>
                  {!loanConfigured ? (
                    <p className="second-life-apply-note">
                      金利と返済期間がそろうまでは、ローンを勝手に作らず、住まい本体の目安額を一括支出として仮計算します。
                    </p>
                  ) : null}
                  {estimatedLoanEndAge != null && estimatedLoanEndAge > 80 ? (
                    <p className="second-life-apply-note">
                      返済終了は世帯主{estimatedLoanEndAge}歳ごろの設定です。実際に借りられる期間・金利・審査条件は金融機関や商品で異なるため、実際の条件を確認してください。
                    </p>
                  ) : null}
                  <p className="second-life-apply-note">
                    ローン返済は固定金利・元利均等・ボーナス返済なしの簡易試算です。実際の借入条件を保証するものではありません。
                  </p>
                </>
              ) : state.housingPaymentMethod === 'undecided' ? (
                <p className="second-life-apply-note">
                  支払い方法が未定の間は、借入を自動設定せず、住まい本体の目安額をその年の一括支出として保守的に試算します。
                </p>
              ) : (
                <p className="second-life-apply-note">
                  住まい本体の目安額を、住まいを変える年の一括支出として試算します。
                </p>
              )}

              <p className="second-life-apply-note">
                試算する住まい関連費の合計：{formatSecondLifeMan(total)}万円
                {state.includeMovingCost || state.includePostPurchaseRenovation
                  ? '（住まい本体＋選択した追加費用）'
                  : ''}
              </p>
              {state.includeMovingCost || state.includePostPurchaseRenovation ? (
                <p className="second-life-apply-note">
                  引越し費・購入後リフォーム費は、現時点ではローンに含めず一括支出として試算します。
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="second-life-section-actions">
            <p className="second-life-apply-note">
              元の「住まい」の入力は残ります。計算では、{state.housingActionAge}歳から上で選んだ住まい方に切り替わります。
            </p>
          </div>
        </>
      )}
    </section>
  );
}
''')

print('Q12 housing finance patch applied')
