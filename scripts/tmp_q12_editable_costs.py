from pathlib import Path


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f'marker not found: {label}')
    return text.replace(old, new, 1)

# 1) Persist editable supplemental housing costs.
p='src/types/secondLife.ts'
s=read(p)
s=replace_once(s,
"  includeMovingCost: boolean;\n  includePostPurchaseRenovation: boolean;\n  /** リフォームを選んだ場合の工事内容。金額とは連動させない */\n",
"  includeMovingCost: boolean;\n  /** 引越し費の試算額（万円） */\n  movingCostMan: number;\n  includePostPurchaseRenovation: boolean;\n  /** 購入・建て替え後に追加するリフォーム費（万円） */\n  postPurchaseRenovationCostMan: number;\n  /** リフォームを選んだ場合の工事内容 */\n",
'editable housing cost fields')
write(p,s)

# 2) Finance references by renovation scope.
p='src/lib/secondLifeHousingFinance.ts'
s=read(p)
s=replace_once(s,
"import type { SecondLifeState } from '../types/secondLife';\n",
"import type { SecondLifeRenovationScope, SecondLifeState } from '../types/secondLife';\n",
'import scope type')
s=replace_once(s,
"// 住宅リフォーム推進協議会 2025年度調査（50代以上・実施費用）。\n// 工事内容別の相場ではないため、リフォーム内容を変えても金額は自動変更しない。\nexport const SECOND_LIFE_RENOVATION_REFERENCE_MEDIAN_50PLUS_MAN = 220;\nexport const SECOND_LIFE_RENOVATION_REFERENCE_AVERAGE_50PLUS_MAN = 358.4;\nexport const SECOND_LIFE_RENOVATE_CURRENT_HOME_MAN =\n  SECOND_LIFE_RENOVATION_REFERENCE_MEDIAN_50PLUS_MAN;\nexport const SECOND_LIFE_RENOVATE_PARENTS_HOME_MAN =\n  SECOND_LIFE_RENOVATION_REFERENCE_MEDIAN_50PLUS_MAN;\n",
"// 住宅リフォーム推進協議会 2025年度調査では、50代以上の実施費用は\n// 中央値220万円・平均358.4万円。工事内容別相場ではないため、以下は\n// 最新の消費者調査と住まいるダイヤル2026見積事例を踏まえた「試算開始用の参考額」。\n// 実際の見積額が分かる場合は必ずユーザー入力を優先する。\nexport const SECOND_LIFE_RENOVATION_REFERENCE_MEDIAN_50PLUS_MAN = 220;\nexport const SECOND_LIFE_RENOVATION_REFERENCE_AVERAGE_50PLUS_MAN = 358.4;\n\nexport const SECOND_LIFE_RENOVATION_REFERENCE_BY_SCOPE_MAN: Record<\n  SecondLifeRenovationScope,\n  number\n> = {\n  repair_equipment: 220,\n  partial_room: 300,\n  performance: 300,\n  full: 1000,\n};\n\nexport function getSecondLifeRenovationReferenceCostMan(\n  scope: SecondLifeRenovationScope,\n): number {\n  return SECOND_LIFE_RENOVATION_REFERENCE_BY_SCOPE_MAN[scope];\n}\n\nexport const SECOND_LIFE_RENOVATE_CURRENT_HOME_MAN =\n  SECOND_LIFE_RENOVATION_REFERENCE_BY_SCOPE_MAN.repair_equipment;\nexport const SECOND_LIFE_RENOVATE_PARENTS_HOME_MAN =\n  SECOND_LIFE_RENOVATION_REFERENCE_BY_SCOPE_MAN.repair_equipment;\n",
'renovation reference map')
s=replace_once(s,
"    'housingScenario' | 'stayOption' | 'hometownOption' | 'newAreaOption'\n",
"    | 'housingScenario'\n    | 'stayOption'\n    | 'hometownOption'\n    | 'newAreaOption'\n    | 'renovationScope'\n",
'default cost pick scope')
s=replace_once(s,
"    return state.stayOption === 'renovate'\n      ? SECOND_LIFE_RENOVATE_CURRENT_HOME_MAN\n      : SECOND_LIFE_PURCHASE_REBUILD_MAN;\n",
"    return state.stayOption === 'renovate'\n      ? getSecondLifeRenovationReferenceCostMan(state.renovationScope)\n      : SECOND_LIFE_PURCHASE_REBUILD_MAN;\n",
'stay scoped cost')
s=replace_once(s,
"    return state.hometownOption === 'renovate_parents'\n      ? SECOND_LIFE_RENOVATE_PARENTS_HOME_MAN\n      : SECOND_LIFE_PURCHASE_REBUILD_MAN;\n",
"    return state.hometownOption === 'renovate_parents'\n      ? getSecondLifeRenovationReferenceCostMan(state.renovationScope)\n      : SECOND_LIFE_PURCHASE_REBUILD_MAN;\n",
'hometown scoped cost')
write(p,s)

# 3) Defaults/migration keep legacy 50/300 and store new fields.
p='src/lib/secondLifeDefaults.ts'
s=read(p)
s=replace_once(s,
"  SECOND_LIFE_DEFAULT_RENT_MAN,\n  SECOND_LIFE_RENOVATION_REFERENCE_MEDIAN_50PLUS_MAN,\n",
"  SECOND_LIFE_DEFAULT_RENT_MAN,\n  SECOND_LIFE_MOVING_COST_MAN,\n  SECOND_LIFE_POST_PURCHASE_RENOVATION_MAN,\n  SECOND_LIFE_RENOVATION_REFERENCE_MEDIAN_50PLUS_MAN,\n",
'default cost imports')
s=replace_once(s,
"    includeMovingCost: false,\n    includePostPurchaseRenovation: false,\n",
"    includeMovingCost: false,\n    movingCostMan: SECOND_LIFE_MOVING_COST_MAN,\n    includePostPurchaseRenovation: false,\n    postPurchaseRenovationCostMan: SECOND_LIFE_POST_PURCHASE_RENOVATION_MAN,\n",
'default editable costs')
s=replace_once(s,
"  const housingBaseCostMan =\n",
"  const movingCostMan =\n    typeof value.movingCostMan === 'number' && value.movingCostMan >= 0\n      ? value.movingCostMan\n      : defaults.movingCostMan;\n  const postPurchaseRenovationCostMan =\n    typeof value.postPurchaseRenovationCostMan === 'number' &&\n    value.postPurchaseRenovationCostMan >= 0\n      ? value.postPurchaseRenovationCostMan\n      : defaults.postPurchaseRenovationCostMan;\n\n  const housingBaseCostMan =\n",
'migrate editable costs')
s=replace_once(s,
"          newAreaOption,\n        });\n",
"          newAreaOption,\n          renovationScope,\n        });\n",
'migration scoped default')
s=replace_once(s,
"    renovationScope,\n    housingBaseCostMan,\n",
"    renovationScope,\n    movingCostMan,\n    postPurchaseRenovationCostMan,\n    housingBaseCostMan,\n",
'return editable costs')
write(p,s)

# 4) Totals use editable values.
p='src/lib/secondLifeEstimates.ts'
s=read(p)
s=s.replace("import {\n  SECOND_LIFE_MOVING_COST_MAN,\n  SECOND_LIFE_POST_PURCHASE_RENOVATION_MAN,\n} from './secondLifeHousingFinance';\n","")
s=replace_once(s,
"    | 'includeMovingCost'\n    | 'includePostPurchaseRenovation'\n    | 'housingBaseCostMan'\n",
"    | 'includeMovingCost'\n    | 'movingCostMan'\n    | 'includePostPurchaseRenovation'\n    | 'postPurchaseRenovationCostMan'\n    | 'housingBaseCostMan'\n",
'total pick editable costs')
s=replace_once(s,
"    total += SECOND_LIFE_MOVING_COST_MAN;\n",
"    total += Math.max(0, state.movingCostMan);\n",
'total moving')
s=replace_once(s,
"    total += SECOND_LIFE_POST_PURCHASE_RENOVATION_MAN;\n",
"    total += Math.max(0, state.postPurchaseRenovationCostMan);\n",
'total post purchase')
write(p,s)

# 5) Housing transformations use editable values.
p='src/lib/secondLifeTemplates.ts'
s=read(p)
s=s.replace("  SECOND_LIFE_MOVING_COST_MAN,\n  SECOND_LIFE_POST_PURCHASE_RENOVATION_MAN,\n","")
s=replace_once(s,
"      (input.secondLifeState.includeMovingCost\n        ? SECOND_LIFE_MOVING_COST_MAN\n        : 0);\n",
"      (input.secondLifeState.includeMovingCost\n        ? Math.max(0, input.secondLifeState.movingCostMan)\n        : 0);\n",
'renovation moving editable')
s=replace_once(s,
"        movingCostMan: includeMoving ? SECOND_LIFE_MOVING_COST_MAN : 0,\n",
"        movingCostMan: includeMoving\n          ? Math.max(0, input.secondLifeState.movingCostMan)\n          : 0,\n",
'rent moving editable')
s=replace_once(s,
"        secondLifeInitialCashCostMan: includeMoving\n          ? SECOND_LIFE_MOVING_COST_MAN\n          : 0,\n",
"        secondLifeInitialCashCostMan: includeMoving\n          ? Math.max(0, input.secondLifeState.movingCostMan)\n          : 0,\n",
'purchase moving editable')
s=replace_once(s,
"              amountMan: SECOND_LIFE_POST_PURCHASE_RENOVATION_MAN,\n",
"              amountMan: Math.max(\n                0,\n                input.secondLifeState.postPurchaseRenovationCostMan,\n              ),\n",
'post purchase editable')
write(p,s)

# 6) UI: direct edit fields + scoped reference behavior.
p='src/components/secondLife/SecondLifeHousingSection.tsx'
s=read(p)
s=s.replace("  SECOND_LIFE_MOVING_COST_MAN,\n  SECOND_LIFE_POST_PURCHASE_RENOVATION_MAN,\n","")
s=replace_once(s,
"  getSecondLifeHousingBaseCostLabel,\n",
"  getSecondLifeHousingBaseCostLabel,\n  getSecondLifeRenovationReferenceCostMan,\n",
'import renovation ref helper')
# add handler after setBaseCost
marker="  const estimatedLoanEndAge =\n"
insert="""  const selectRenovationScope = (scope: SecondLifeState['renovationScope']) => {\n    const currentReference = getSecondLifeRenovationReferenceCostMan(\n      state.renovationScope,\n    );\n    const nextReference = getSecondLifeRenovationReferenceCostMan(scope);\n    const shouldUpdateReference =\n      state.housingBaseCostMan === 0 ||\n      state.housingBaseCostMan === currentReference ||\n      state.housingBaseCostMan === SECOND_LIFE_RENOVATION_REFERENCE_MEDIAN_50PLUS_MAN;\n    if (shouldUpdateReference) {\n      onChange({\n        renovationScope: scope,\n        housingBaseCostMan: nextReference,\n        housingLoanDownPaymentMan: Math.min(\n          nextReference,\n          Math.max(0, state.housingLoanDownPaymentMan),\n        ),\n      });\n      return;\n    }\n    onChange({ renovationScope: scope });\n  };\n\n"""
if marker not in s: raise RuntimeError('estimated age marker missing')
s=s.replace(marker,insert+marker,1)
# replace static post-purchase labels in 3 occurrences
old="""                          購入・建て替え後のリフォーム（仮に\n                          {SECOND_LIFE_POST_PURCHASE_RENOVATION_MAN}万円）\n"""
new="""                          購入・建て替え後のリフォームを見込む\n"""
if s.count(old) != 3: raise RuntimeError(f'post purchase labels count {s.count(old)}')
s=s.replace(old,new)
# replace moving labels in 2 occurrences
old="""                        引越し費を見込む（仮に{SECOND_LIFE_MOVING_COST_MAN}万円）\n"""
new="""                        引越し費を見込む\n"""
if s.count(old) != 2: raise RuntimeError(f'moving labels count {s.count(old)}')
s=s.replace(old,new)
# insert editable moving amount after each moving checkbox label
moving_block="""                      </label>\n                      {state.hometownOption === 'purchase_rebuild' ? (\n"""
moving_insert="""                      </label>\n                      {state.includeMovingCost ? (\n                        <label className=\"second-life-inline-cost\">\n                          <span>引越し費</span>\n                          <input\n                            type=\"number\"\n                            min={0}\n                            step={10}\n                            value={state.movingCostMan}\n                            onChange={(event) =>\n                              onChange({\n                                movingCostMan: Math.max(\n                                  0,\n                                  Number(event.target.value) || 0,\n                                ),\n                              })\n                            }\n                          />\n                          <span>万円</span>\n                        </label>\n                      ) : null}\n                      {state.hometownOption === 'purchase_rebuild' ? (\n"""
s=replace_once(s,moving_block,moving_insert,'hometown moving input')
# new area moving amount before purchase conditional
old="""                      </label>\n                      {state.newAreaOption === 'purchase' ? (\n"""
new="""                      </label>\n                      {state.includeMovingCost ? (\n                        <label className=\"second-life-inline-cost\">\n                          <span>引越し費</span>\n                          <input\n                            type=\"number\"\n                            min={0}\n                            step={10}\n                            value={state.movingCostMan}\n                            onChange={(event) =>\n                              onChange({\n                                movingCostMan: Math.max(\n                                  0,\n                                  Number(event.target.value) || 0,\n                                ),\n                              })\n                            }\n                          />\n                          <span>万円</span>\n                        </label>\n                      ) : null}\n                      {state.newAreaOption === 'purchase' ? (\n"""
s=replace_once(s,old,new,'newarea moving input')
# post-purchase amount: add after each checkbox label using scenario-specific following markers
pairs=[
("""                        </label>\n                      ) : null}\n                    </>\n                  ) : null}\n\n                  {scenario.id === 'hometown' ? (\n""",
"""                        </label>\n                      ) : null}\n                      {state.stayOption === 'purchase_rebuild' &&\n                      state.includePostPurchaseRenovation ? (\n                        <label className=\"second-life-inline-cost\">\n                          <span>追加リフォーム費</span>\n                          <input type=\"number\" min={0} step={10} value={state.postPurchaseRenovationCostMan} onChange={(event) => onChange({ postPurchaseRenovationCostMan: Math.max(0, Number(event.target.value) || 0) })} />\n                          <span>万円</span>\n                        </label>\n                      ) : null}\n                    </>\n                  ) : null}\n\n                  {scenario.id === 'hometown' ? (\n"""),
("""                        </label>\n                      ) : null}\n                    </>\n                  ) : null}\n\n                  {scenario.id === 'new_area' ? (\n""",
"""                        </label>\n                      ) : null}\n                      {state.hometownOption === 'purchase_rebuild' &&\n                      state.includePostPurchaseRenovation ? (\n                        <label className=\"second-life-inline-cost\">\n                          <span>追加リフォーム費</span>\n                          <input type=\"number\" min={0} step={10} value={state.postPurchaseRenovationCostMan} onChange={(event) => onChange({ postPurchaseRenovationCostMan: Math.max(0, Number(event.target.value) || 0) })} />\n                          <span>万円</span>\n                        </label>\n                      ) : null}\n                    </>\n                  ) : null}\n\n                  {scenario.id === 'new_area' ? (\n"""),
("""                        </label>\n                      ) : null}\n                    </>\n                  ) : null}\n                </SecondLifeChoiceCard>\n""",
"""                        </label>\n                      ) : null}\n                      {state.newAreaOption === 'purchase' &&\n                      state.includePostPurchaseRenovation ? (\n                        <label className=\"second-life-inline-cost\">\n                          <span>追加リフォーム費</span>\n                          <input type=\"number\" min={0} step={10} value={state.postPurchaseRenovationCostMan} onChange={(event) => onChange({ postPurchaseRenovationCostMan: Math.max(0, Number(event.target.value) || 0) })} />\n                          <span>万円</span>\n                        </label>\n                      ) : null}\n                    </>\n                  ) : null}\n                </SecondLifeChoiceCard>\n""")]
for i,(old,new) in enumerate(pairs):
    s=replace_once(s,old,new,f'post purchase input {i}')
# rent total uses moving state field
s=replace_once(s,
"                    (state.includeMovingCost ? SECOND_LIFE_MOVING_COST_MAN : 0),\n",
"                    (state.includeMovingCost ? state.movingCostMan : 0),\n",
'rent total editable moving')
# scope handler
old="""                        onChange={() =>\n                          onChange({\n                            renovationScope:\n                              scope as SecondLifeState['renovationScope'],\n                          })\n                        }\n"""
new="""                        onChange={() =>\n                          selectRenovationScope(\n                            scope as SecondLifeState['renovationScope'],\n                          )\n                        }\n"""
s=replace_once(s,old,new,'scope handler')
# scope note: auto/reference behavior
s=replace_once(s,
"                工事内容は計画を整理するための分類です。選択を変えても費用は自動では変わりません。\n",
"                工事内容を変えると参考初期値も切り替わります。見積額などを手入力済みの場合は、その金額を保持します。\n",
'scope note')
# reference note becomes scope-specific and offers apply button
old="""                {isRenovation\n                  ? `参考初期値は${SECOND_LIFE_RENOVATION_REFERENCE_MEDIAN_50PLUS_MAN}万円です。見積額や希望額が分かる場合は、その金額を優先してください。`\n                  : '住宅購入・建て替えは地域や物件条件による差が大きいため、全国一律の金額は自動入力していません。見積額や希望額を入力してください。'}\n"""
new="""                {isRenovation\n                  ? `この工事内容の参考初期値は${getSecondLifeRenovationReferenceCostMan(state.renovationScope)}万円です。見積額や希望額が分かる場合は、その金額を優先してください。`\n                  : '住宅購入・建て替えは地域や物件条件による差が大きいため、全国一律の金額は自動入力していません。見積額や希望額を入力してください。'}\n"""
s=replace_once(s,old,new,'scope reference note')
# insert apply reference button after note when custom
marker="""              {isRenovation ? (\n                <details className=\"second-life-reference-details\">\n"""
insert="""              {isRenovation &&\n              state.housingBaseCostMan !==\n                getSecondLifeRenovationReferenceCostMan(state.renovationScope) ? (\n                <button\n                  type=\"button\"\n                  className=\"second-life-reference-apply-btn\"\n                  onClick={() =>\n                    setBaseCost(\n                      getSecondLifeRenovationReferenceCostMan(\n                        state.renovationScope,\n                      ),\n                    )\n                  }\n                >\n                  参考額\n                  {getSecondLifeRenovationReferenceCostMan(state.renovationScope)}万円を反映\n                </button>\n              ) : null}\n              {isRenovation ? (\n                <details className=\"second-life-reference-details\">\n"""
s=replace_once(s,marker,insert,'reference apply button')
# update details copy to explain not market price
s=replace_once(s,
"                      これは工事内容別の相場ではありません。そのため、このソフトでは工事内容を選んでも金額を自動変更しません。\n",
"                      これは工事内容別の全国相場ではありません。工事規模に合わせた参考初期値を置いていますが、実際の住宅条件・地域・仕様で大きく変わるため、見積額がある場合はそちらを優先してください。\n",
'reference details copy')
write(p,s)

# 7) Minimal styling for inline editable extras and reference action.
p='src/index.css'
s=read(p)
append="""\n\n/* Q12: supplemental housing costs are editable next to the selected option */\n.second-life-inline-cost {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  margin: 6px 0 10px 28px;\n  color: var(--color-muted);\n  font-size: var(--text-sm);\n}\n\n.second-life-inline-cost input {\n  width: 92px;\n  min-height: 36px;\n  padding: 6px 8px;\n  border: 1px solid var(--color-border);\n  border-radius: 8px;\n  background: #fff;\n  color: var(--color-ink);\n}\n\n.second-life-reference-apply-btn {\n  margin: 2px 0 8px;\n  padding: 6px 10px;\n  border: 1px solid var(--color-border);\n  border-radius: 8px;\n  background: #fff;\n  color: var(--color-brand);\n  font-size: var(--text-sm);\n  font-weight: 700;\n}\n\n.second-life-reference-apply-btn:hover {\n  background: var(--color-brand-soft);\n}\n"""
if '.second-life-inline-cost {' not in s:
    s += append
write(p,s)

print('editable costs and scoped renovation references applied')
