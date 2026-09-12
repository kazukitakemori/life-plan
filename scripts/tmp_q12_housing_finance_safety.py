from pathlib import Path

p = Path('src/lib/housingCashFlow.ts')
s = p.read_text(encoding='utf-8')

def repl(old, new, label):
    global s
    if old not in s:
        raise SystemExit(f'missing block: {label}')
    s = s.replace(old, new, 1)

repl(
'''import {\n  calcLoanRepaymentMonthYen,\n  calcRepaymentMonthIndex,\n''',
'''import {\n  calcLoanRepaymentBalanceAfterMonthYen,\n  calcLoanRepaymentMonthYen,\n  calcRepaymentMonthIndex,\n''',
'import balance helper',
)

repl(
'''function calcSecondLifeFinanceLoanMonth(\n''',
'''function isSecondLifeFinanceStartMonth(\n  property: OwnedProperty,\n  member: FamilyMember,\n  referenceDate: Date,\n  calendarYear: number,\n  calendarMonth: number,\n): boolean {\n  const plan = property.secondLifeFinancePlan;\n  if (!plan) return false;\n  const ageMonth = getMemberAgeMonth(\n    member,\n    referenceDate,\n    calendarYear,\n    calendarMonth,\n  );\n  if (!ageMonth) return false;\n  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);\n  return isSamePeriodAgeMonth(\n    ageMonth.age,\n    ageMonth.month,\n    plan.startAge,\n    plan.startMonth,\n    birthYear,\n    resolveMemberBirthMonth(member),\n  );\n}\n\nfunction isOwnedFinalMonth(\n  property: OwnedProperty,\n  member: FamilyMember,\n  referenceDate: Date,\n  calendarYear: number,\n  calendarMonth: number,\n): boolean {\n  const ageMonth = getMemberAgeMonth(\n    member,\n    referenceDate,\n    calendarYear,\n    calendarMonth,\n  );\n  if (!ageMonth) return false;\n  const end = getOwnedPeriodEnd(property, member);\n  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);\n  return isSamePeriodAgeMonth(\n    ageMonth.age,\n    ageMonth.month,\n    end.age,\n    end.month,\n    birthYear,\n    resolveMemberBirthMonth(member),\n  );\n}\n\nfunction calcSecondLifeFinanceLoanMonth(\n''',
'finance timing helpers',
)

repl(
'''  const result = calcLoanRepaymentMonthYen(\n    plan.loanPrincipalMan * 10_000,\n    totalMonths,\n    repaymentMonthIndex,\n    'equal_payment',\n    () => plan.interestRatePct ?? 0,\n    () => [],\n  );\n  return {\n    principal: yenToMan(result.principalYen),\n    interest: yenToMan(result.interestYen),\n  };\n}\n''',
'''  const principalYen = plan.loanPrincipalMan * 10_000;\n  const rateResolver = () => plan.interestRatePct ?? 0;\n  const result = calcLoanRepaymentMonthYen(\n    principalYen,\n    totalMonths,\n    repaymentMonthIndex,\n    'equal_payment',\n    rateResolver,\n    () => [],\n  );\n\n  // 住まいの計画期間が返済期間より先に終わる場合、残債を消さず最終月に計上する。\n  const residualYen =\n    repaymentMonthIndex < totalMonths &&\n    isOwnedFinalMonth(\n      property,\n      member,\n      referenceDate,\n      calendarYear,\n      calendarMonth,\n    )\n      ? calcLoanRepaymentBalanceAfterMonthYen(\n          principalYen,\n          totalMonths,\n          repaymentMonthIndex,\n          'equal_payment',\n          rateResolver,\n          () => [],\n        )\n      : 0;\n\n  return {\n    principal: yenToMan(result.principalYen + residualYen),\n    interest: yenToMan(result.interestYen),\n  };\n}\n''',
'loan residual handling',
)

repl(
'''  const isCurrentSimple =\n    property.usage === "current" &&\n    property.currentExpenseMode === "simple";\n  if (isCurrentSimple) {\n    detail.simpleMonthlyCost = property.simpleMonthlyExpenseMan;\n  }\n\n  // 居住中は過去の購入時支出を試算に含めない\n''',
'''  const isCurrentSimple =\n    property.usage === "current" &&\n    property.currentExpenseMode === "simple";\n  if (isCurrentSimple) {\n    detail.simpleMonthlyCost = property.simpleMonthlyExpenseMan;\n\n    // Q5の簡単入力はそのまま維持し、Q12で追加したリフォーム分だけ重ねる。\n    const q12Finance = property.secondLifeFinancePlan;\n    if (\n      q12Finance?.purpose === 'renovation' &&\n      isSecondLifeFinanceStartMonth(\n        property,\n        member,\n        referenceDate,\n        calendarYear,\n        calendarMonth,\n      )\n    ) {\n      detail.improvementCost = q12Finance.cashPaymentMan;\n    }\n    const q12Loan = calcSecondLifeFinanceLoanMonth(\n      property,\n      member,\n      referenceDate,\n      calendarYear,\n      calendarMonth,\n    );\n    detail.loanRepaymentDetail.principal += q12Loan.principal;\n    detail.loanRepaymentDetail.interest += q12Loan.interest;\n    return detail;\n  }\n\n  // 居住中は過去の購入時支出を試算に含めない\n''',
'current simple Q12 only',
)

repl(
'''  // 簡単入力の現在住宅でも、Q12のリフォーム費・ローンだけは追加してから返す。\n  if (isCurrentSimple) {\n    return detail;\n  }\n\n''',
'''  // current/simple は上で Q12 分だけ加算して返している。\n\n''',
'remove late simple return',
)

p.write_text(s, encoding='utf-8')
print('Q12 housing finance safety patch applied')
