from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise RuntimeError(f'pattern not found in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1))


# 1) Living level: add 80% as an explicit, typed option.
replace(
    'src/types/secondLife.ts',
    "export type SecondLifeLivingLevel = 'same' | 'seventy_percent' | 'pension_based';",
    "export type SecondLifeLivingLevel =\n  | 'same'\n  | 'eighty_percent'\n  | 'seventy_percent'\n  | 'pension_based';",
)

replace(
    'src/lib/secondLifeLabels.ts',
    "  same: '現在と同水準の生活費',\n  seventy_percent: '現在の7割の生活費',\n  pension_based: '年金収入に応じた生活費',",
    "  same: '現在と同じ生活費（100%）',\n  eighty_percent: '現在の80%の生活費',\n  seventy_percent: '現在の70%の生活費',\n  pension_based: '年金収入を目安にした生活費',",
)

# 2) Baseline semantics: if current Q4 living cost exists, use it. Only fall back
#    to entered pre-second-life schedules when nothing is active today.
replace(
    'src/lib/secondLifeEstimates.ts',
    ' * 「現在と同水準」「7割」の基準となる生活費（月額・万円）。',
    ' * 「現在と同水準」「8割」「7割」の基準となる生活費（月額・万円）。',
)
replace(
    'src/lib/secondLifeEstimates.ts',
    "  const baseline = Math.max(atReference, enteredTotal);\n  if (baseline > 0) {\n    return baseline;\n  }",
    "  if (atReference > 0) {\n    return atReference;\n  }\n  if (enteredTotal > 0) {\n    return enteredTotal;\n  }",
)
replace(
    'src/lib/secondLifeEstimates.ts',
    "  const seventyMonthly = roundMan(currentMonthly * 0.7);",
    "  const eightyMonthly = roundMan(currentMonthly * 0.8);\n  const seventyMonthly = roundMan(currentMonthly * 0.7);",
)
replace(
    'src/lib/secondLifeEstimates.ts',
    "  return [\n    {\n      level: 'same',\n      label: '現在と同水準の生活費',\n      monthlyMan: roundMan(currentMonthly),\n      breakdown: q4Breakdown,\n      breakdownNote:\n        q4Breakdown.length > 0 ? 'Q4 生活費の内訳' : undefined,\n    },\n    {\n      level: 'seventy_percent',\n      label: '現在の7割の生活費',\n      monthlyMan: seventyMonthly,\n      breakdown: scaleLivingBreakdown(q4Breakdown, 0.7),\n      breakdownNote:\n        q4Breakdown.length > 0 ? 'Q4 生活費の内訳（7割）' : undefined,\n    },\n    {\n      level: 'pension_based',\n      label: '年金収入に応じた生活費',\n      monthlyMan: pensionMonthly,\n      breakdown: buildPensionLivingBreakdown(pensionMonthly),\n      breakdownNote: '年金からの目安配分',\n      pensionAnnualMan: roundMan(pensionAnnual),\n    },\n  ];",
    "  const options: SecondLifeLivingOption[] = [\n    {\n      level: 'same',\n      label: '現在と同じ生活費（100%）',\n      monthlyMan: roundMan(currentMonthly),\n      breakdown: q4Breakdown,\n      breakdownNote:\n        q4Breakdown.length > 0 ? '現在の生活費の内訳' : undefined,\n    },\n    {\n      level: 'eighty_percent',\n      label: '現在の80%の生活費',\n      monthlyMan: eightyMonthly,\n      breakdown: scaleLivingBreakdown(q4Breakdown, 0.8),\n      breakdownNote:\n        q4Breakdown.length > 0 ? '現在の生活費の内訳（80%）' : undefined,\n    },\n    {\n      level: 'seventy_percent',\n      label: '現在の70%の生活費',\n      monthlyMan: seventyMonthly,\n      breakdown: scaleLivingBreakdown(q4Breakdown, 0.7),\n      breakdownNote:\n        q4Breakdown.length > 0 ? '現在の生活費の内訳（70%）' : undefined,\n    },\n  ];\n\n  // 年金額が未入力のときに「0万円で暮らす」選択肢を出さない。\n  if (pensionAnnual > 0) {\n    options.push({\n      level: 'pension_based',\n      label: '年金収入を目安にする',\n      monthlyMan: pensionMonthly,\n      breakdown: buildPensionLivingBreakdown(pensionMonthly),\n      breakdownNote: '年金月額と同額を生活費の目安として配分',\n      pensionAnnualMan: roundMan(pensionAnnual),\n    });\n  }\n\n  return options;",
)

# 3) Keep baseline amount and breakdown consistent: use active schedules globally;
#    only when none are active do we fall back to entered schedules.
replace(
    'src/lib/secondLifeLivingTotal.ts',
    "  secondLifeStartAge?: number,\n): LivingExpenseSchedule[] {",
    "  secondLifeStartAge?: number,\n  allowFallback = true,\n): LivingExpenseSchedule[] {",
)
replace(
    'src/lib/secondLifeLivingTotal.ts',
    "  if (active.length > 0) {\n    return active;\n  }\n\n  const entered = schedules.find(",
    "  if (active.length > 0) {\n    return active;\n  }\n  if (!allowFallback) {\n    return [];\n  }\n\n  const entered = schedules.find(",
)
replace(
    'src/lib/secondLifeLivingTotal.ts',
    "  const byLabel = new Map<string, number>();\n\n  for (const targetId of collectLivingTargetIds(\n    input.familyMembers,\n    input.livingState,\n  )) {",
    "  const byLabel = new Map<string, number>();\n  const targetIds = collectLivingTargetIds(\n    input.familyMembers,\n    input.livingState,\n  );\n  const hasAnyActiveBaseline = targetIds.some((targetId) => {\n    const schedules = input.livingState.byTarget[targetId] ?? [];\n    const member = resolveLivingTargetMember(targetId, input.familyMembers);\n    if (!member) return false;\n    return getTargetLivingSchedulesAtMonth(\n      schedules,\n      member,\n      input.referenceDate,\n      input.calendarYear,\n      input.calendarMonth,\n    ).some(\n      (schedule) =>\n        isPreSecondLifeLivingSchedule(schedule, input.secondLifeStartAge) &&\n        getLivingScheduleMonthlyMan(schedule) > 0,\n    );\n  });\n\n  for (const targetId of targetIds) {",
)
replace(
    'src/lib/secondLifeLivingTotal.ts',
    "      input.calendarMonth,\n      input.secondLifeStartAge,\n    )) {",
    "      input.calendarMonth,\n      input.secondLifeStartAge,\n      !hasAnyActiveBaseline,\n    )) {",
)

# 4) Mode selector: ask a concrete question instead of generic internal wording.
replace(
    'src/components/secondLife/SecondLifeModeSelector.tsx',
    "interface SecondLifeModeSelectorProps {\n  useCurrent: boolean;",
    "interface SecondLifeModeSelectorProps {\n  title?: string;\n  useCurrent: boolean;",
)
replace(
    'src/components/secondLife/SecondLifeModeSelector.tsx',
    "export function SecondLifeModeSelector({\n  useCurrent,",
    "export function SecondLifeModeSelector({\n  title,\n  useCurrent,",
)
replace(
    'src/components/secondLife/SecondLifeModeSelector.tsx',
    '<p className="second-life-mode-selector-title">この項目をどう扱いますか？</p>',
    '<p className="second-life-mode-selector-title">{title ?? \'この項目をどうしますか？\'}</p>',
)

# 5) Living UX: plain language, visible baseline, 100/80/70 comparison, safe pension note.
replace(
    'src/components/secondLife/SecondLifeLivingSection.tsx',
    "      <SecondLifeModeSelector\n        useCurrent={useCurrentPlan}\n        currentLabel='Q4「生活費」の現在の計画をそのまま使う'\n        reviewLabel=\"セカンドライフの生活費を見直す\"\n        currentDescription={\n          currentMonthly > 0\n            ? `Q4で入力している生活費（現在の目安 ${formatSecondLifeMan(currentMonthly)}万円／月）を、そのまま計算に使います。`\n            : 'Q4で入力している生活費スケジュールを、そのままキャッシュフロー計算に使います。'\n        }\n        reviewDescription=\"セカンドライフ開始年齢以降の生活水準を、現在と同じ・8割・7割などから改めて設定します。\"",
    "      <SecondLifeModeSelector\n        title={`${state.startAge}歳以降の生活費はどうしますか？`}\n        useCurrent={useCurrentPlan}\n        currentLabel=\"今の生活費計画をそのまま使う\"\n        reviewLabel={`${state.startAge}歳以降の生活費を設定する`}\n        currentDescription={\n          currentMonthly > 0\n            ? `「生活費」で入力している現在の目安（月${formatSecondLifeMan(currentMonthly)}万円）を、そのまま使います。`\n            : '「生活費」で入力している計画を、そのまま使います。'\n        }\n        reviewDescription=\"現在の生活費を基準に、100%・80%・70%で比較できます。年金額が入力済みなら、年金収入を目安にした試算も選べます。\"",
)
replace(
    'src/components/secondLife/SecondLifeLivingSection.tsx',
    '            Q4「生活費」の入力を変更せず、その計画をそのまま計算に使用します。',
    '            「生活費」で入力した内容のまま計算します。元の入力は変更しません。',
)
replace(
    'src/components/secondLife/SecondLifeLivingSection.tsx',
    "              下で選んだ生活水準は、ページ上部のセカンドライフ開始 {state.startAge}歳から計算上だけ優先します。",
    "              基準となる現在の生活費：月{formatSecondLifeMan(currentMonthly)}万円。{state.startAge}歳以降の生活費を下から選んでください。",
)
replace(
    'src/components/secondLife/SecondLifeLivingSection.tsx',
    '            className="second-life-choice-grid"',
    '            className="second-life-choice-grid second-life-choice-grid--living"',
)
replace(
    'src/components/secondLife/SecondLifeLivingSection.tsx',
    "              「現在と同じ水準」を選んだ場合も、Q4の入力を書き換えるのではなく、Q12で確認した生活水準として開始年齢以降の計算に使用します。",
    "              80%・70%は比較用の目安です。生活費が自動的にその割合まで下がるという意味ではありません。元の「生活費」の入力は残したまま、{state.startAge}歳以降だけ選んだ金額で試算します。",
)
replace(
    'src/components/secondLife/SecondLifeLivingSection.tsx',
    "          </div>\n        </>\n      )}",
    "          </div>\n          {!options.some((option) => option.level === 'pension_based') ? (\n            <p className=\"second-life-apply-note\">\n              年金額がまだ入力されていないため、「年金収入を目安にする」は表示していません。\n            </p>\n          ) : null}\n        </>\n      )}",
)

# 6) Two-by-two living choices on desktop.
p = Path('src/components/secondLife/SecondLifeModeSelector.css')
css = p.read_text()
css += "\n.second-life-choice-grid--living {\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n}\n\n@media (max-width: 960px) {\n  .second-life-choice-grid--living {\n    grid-template-columns: 1fr;\n  }\n}\n"
p.write_text(css)

# 7) Housing UX + make moving checkbox actually control the calculation.
replace(
    'src/components/secondLife/SecondLifeHousingSection.tsx',
    "    if (state.housingScenario === 'stay' && state.stayOption === 'continue') {\n      patch.stayOption = 'renovate';\n    }",
    "    if (state.housingScenario === 'stay') {\n      patch.includeMovingCost = false;\n      if (state.stayOption === 'continue') {\n        patch.stayOption = 'renovate';\n      }\n    }",
)
replace(
    'src/components/secondLife/SecondLifeHousingSection.tsx',
    "    if (scenario === 'stay' && state.stayOption === 'continue') {\n      patch.stayOption = 'renovate';\n    }",
    "    if (scenario === 'stay') {\n      patch.includeMovingCost = false;\n      if (state.stayOption === 'continue') {\n        patch.stayOption = 'renovate';\n      }\n    }",
)
replace(
    'src/components/secondLife/SecondLifeHousingSection.tsx',
    "      <SecondLifeModeSelector\n        useCurrent={useCurrentPlan}\n        currentLabel='Q5「住まい」の現在の計画をそのまま使う'\n        reviewLabel=\"セカンドライフの住まいを見直す\"\n        currentDescription=\"Q5で入力している住まいの期間・費用を、そのままキャッシュフロー計算に使います。\"\n        reviewDescription=\"リフォーム・建て替え・転居など、セカンドライフ用の住まい方をここで設定します。\"",
    "      <SecondLifeModeSelector\n        title=\"これからの住まいはどうしますか？\"\n        useCurrent={useCurrentPlan}\n        currentLabel=\"今の住まい計画をそのまま使う\"\n        reviewLabel=\"これからの住まいを見直す\"\n        currentDescription=\"「住まい」で入力している期間・費用のまま計算します。\"\n        reviewDescription=\"リフォーム・建て替え・転居など、今の計画から変える内容を設定します。\"",
)
replace(
    'src/components/secondLife/SecondLifeHousingSection.tsx',
    '            Q5「住まい」の入力を変更せず、その計画をそのまま計算に使用します。',
    '            「住まい」で入力した内容のまま計算します。元の入力は変更しません。',
)
replace(
    'src/components/secondLife/SecondLifeHousingSection.tsx',
    "              セカンドライフ開始：{state.startAge}歳（開始年齢はこのページ上部で変更）",
    "              住まいを変える時期を設定してください（{state.startAge}歳以降）。",
)
replace(
    'src/components/secondLife/SecondLifeHousingSection.tsx',
    "              Q5「住まい」の入力自体は変更せず、住まいを変える年齢以降のキャッシュフロー計算だけこの設計を優先します。",
    "              元の「住まい」の入力は残ります。計算では、{state.housingActionAge}歳から上で選んだ住まい方に切り替わります。",
)
replace(
    'src/lib/secondLifeEstimates.ts',
    "  const needsMoving =\n    state.housingScenario === 'hometown' ||\n    state.housingScenario === 'new_area' ||\n    state.includeMovingCost;",
    "  const needsMoving = state.includeMovingCost;",
)
replace(
    'src/lib/secondLifeTemplates.ts',
    "  const includeMoving =\n    input.secondLifeState.includeMovingCost ||\n    input.secondLifeState.housingScenario === 'hometown' ||\n    input.secondLifeState.housingScenario === 'new_area';",
    "  const includeMoving = input.secondLifeState.includeMovingCost;",
)

# 8) Replace internal-engine language in housing confirmation with user outcomes.
replace(
    'src/lib/secondLifeHousingConsistency.ts',
    "      title: 'Q5の現在の計画をそのまま使います',\n      summary:\n        'Q12では住まいを見直さず、Q5「住まい」の入力をそのままキャッシュフロー計算に使用します。',",
    "      title: '今の住まい計画で計算します',\n      summary:\n        '「住まい」で入力した内容をそのまま使います。元の入力は変更しません。',",
)
replace(
    'src/lib/secondLifeHousingConsistency.ts',
    "        summary:\n          'Q5の現在計画を使うため、Q5で現在の住まいを入力してください。',",
    "        summary:\n          '今の住まい計画を使うため、先に「住まい」で現在の住まいを入力してください。',",
)
replace(
    'src/lib/secondLifeHousingConsistency.ts',
    "      title: 'Q5の現在の住まいをそのまま継続します',\n      summary:\n        'セカンドライフ開始後もQ5の住まい入力をそのまま計算に使用します。',",
    "      title: '今の住まいをそのまま継続して計算します',\n      summary:\n        '現在入力している住まいの期間・費用をそのまま使います。',",
)
replace(
    'src/lib/secondLifeHousingConsistency.ts',
    "        summary:\n          '現在の住宅をリフォームする設計なので、Q5で対象となる持ち家を入力してください。',",
    "        summary:\n          '現在の住宅をリフォームするため、先に「住まい」で対象となる持ち家を入力してください。',",
)
replace(
    'src/lib/secondLifeHousingConsistency.ts',
    "      summary:\n        'Q5の持ち家データは変更せず、キャッシュフロー上の住まい支出としてQ12のリフォーム費を重ねます。',",
    "      summary:\n        '元の持ち家設定は残したまま、この年齢にリフォーム費を追加して試算します。',",
)
replace(
    'src/lib/secondLifeHousingConsistency.ts',
    "    title: `${actionAge}歳からQ12の住まい設計を優先します`,\n    summary:\n      activeHousing.length > 0\n        ? 'Q5の住まいがその後も続く入力でも、Q5自体は変更せず、計算上だけQ12の住まいへ切り替えます。'\n        : 'Q5の入力自体は変更せず、計算上だけQ12の住まいを使用します。',",
    "    title: `${actionAge}歳から、選んだ住まい方に切り替えて計算します`,\n    summary:\n      activeHousing.length > 0\n        ? '元の住まい設定は残したまま、この年齢から上で選んだ住まい方へ切り替えて試算します。'\n        : '元の入力は変更せず、この年齢から上で選んだ住まい方で試算します。',",
)
replace(
    'src/lib/secondLifeHousingConsistency.ts',
    "    case 'aligned':\n      return '計算OK';",
    "    case 'aligned':\n      return '設定済み';",
)
replace(
    'src/lib/secondLifeHousingConsistency.ts',
    "    case 'skipped':\n      return 'Q5を使用';",
    "    case 'skipped':\n      return '変更なし';",
)

# 9) Q12 page language: explain the user's result, not Q4/Q5/Q12 engine precedence.
replace(
    'src/components/secondLife/SecondLifeGuideStep.tsx',
    '        lead="これからの暮らし方をここで具体化し、元の入力を残したまま計算へ反映します"',
    '        lead="老後の住まい・生活費・介護を、今の計画と比べながら整理します"',
)
replace(
    'src/components/secondLife/SecondLifeGuideStep.tsx',
    '        セカンドライフ開始年齢を基準に、老後の住まい・生活水準・介護をこの画面で設計します。住まい・生活費はそれぞれ「現在の計画をそのまま使う」か「セカンドライフ用に見直す」かを選べます。',
    '        まず、何歳からセカンドライフとして考えるかを決めます。住まいと生活費は、今の計画を続けるか、その年齢以降を見直すかを選べます。元の入力は消えません。',
)
replace(
    'src/components/secondLife/SecondLifeGuideStep.tsx',
    '<p className="second-life-consistency-kicker">住まいの計算ルール</p>',
    '<p className="second-life-consistency-kicker">住まいの確認</p>',
)
replace(
    'src/components/secondLife/SecondLifeGuideStep.tsx',
    '            Q12：{getSecondLifeHousingDesignSummary(secondLifeState)}',
    '            今回の設定：{getSecondLifeHousingDesignSummary(secondLifeState)}',
)
replace(
    'src/components/secondLife/SecondLifeGuideStep.tsx',
    '<h3 className="second-life-guide-checklist-title">計算ルール・反映状況</h3>',
    '<h3 className="second-life-guide-checklist-title">設定内容の確認</h3>',
)
replace(
    'src/components/secondLife/SecondLifeGuideStep.tsx',
    '        「現在の計画をそのまま使う」を選んだ項目はQ4・Q5の入力をそのまま使用します。「見直す」を選んだ項目だけ、Q12の設計をキャッシュフロー計算時に優先します。',
    '        「今の計画をそのまま使う」を選んだ項目は現在の入力で計算します。「見直す」を選んだ項目は、指定した年齢から今回の設定に切り替えて試算します。',
)

replace(
    'src/lib/secondLifeGuide.ts',
    "          ? 'Q5「住まい」の現在入力をそのまま計算に使用します'",
    "          ? '今の住まい計画をそのまま使います'",
)
replace(
    'src/lib/secondLifeGuide.ts',
    "            ? 'Q5の現在の住まいをそのまま継続します'\n            : `${design.housingActionAge}歳からQ12の住まい設計を計算時に優先します`,",
    "            ? '今の住まいをそのまま継続します'\n            : `${design.housingActionAge}歳から、見直した住まい方で計算します`,",
)
replace(
    'src/lib/secondLifeGuide.ts',
    "          ? ['Q12による住まいの上書きは無効です。']\n          : ['Q5の住まい入力自体は変更しません。'],",
    "          ? ['現在入力している住まいの期間・費用をそのまま使います。']\n          : ['元の住まい入力は残したまま試算します。'],",
)
replace(
    'src/lib/secondLifeGuide.ts',
    "          ? 'Q4「生活費」の現在入力をそのまま計算に使用します'\n          : `${design.startAge}歳からQ12の生活水準を計算時に優先します`,",
    "          ? '今の生活費計画をそのまま使います'\n          : `${design.startAge}歳から、選んだ生活費で計算します`,",
)
replace(
    'src/lib/secondLifeGuide.ts',
    "          ? ['Q12による生活費の上書きは無効です。']\n          : ['Q4の生活費入力自体は変更しません。'],",
    "          ? ['現在入力している生活費計画をそのまま使います。']\n          : ['元の生活費入力は残したまま試算します。'],",
)

print('Q12 UX/accuracy patch applied successfully')
