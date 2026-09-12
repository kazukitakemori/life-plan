from pathlib import Path


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f'marker not found: {label}')
    return text.replace(old, new, 1)

# 1) Persist a renovation scope separately from the amount.
p = 'src/types/secondLife.ts'
s = read(p)
s = replace_once(
    s,
    "export type SecondLifeHousingPaymentMethod = 'undecided' | 'cash' | 'loan';\n",
    "export type SecondLifeHousingPaymentMethod = 'undecided' | 'cash' | 'loan';\n\n/** リフォーム内容。金額とは独立して保持する */\nexport type SecondLifeRenovationScope =\n  | 'repair_equipment'\n  | 'partial_room'\n  | 'performance'\n  | 'full';\n",
    'renovation scope type',
)
s = replace_once(
    s,
    "  includePostPurchaseRenovation: boolean;\n  /** リフォーム・購入など住まい本体の試算用目安額（万円） */\n",
    "  includePostPurchaseRenovation: boolean;\n  /** リフォームを選んだ場合の工事内容。金額とは連動させない */\n  renovationScope: SecondLifeRenovationScope;\n  /** リフォーム・購入など住まい本体の試算用目安額（万円） */\n",
    'renovation scope state field',
)
write(p, s)

# 2) Replace arbitrary renovation defaults with a sourced reference value.
p = 'src/lib/secondLifeHousingFinance.ts'
s = read(p)
s = replace_once(
    s,
    "export const SECOND_LIFE_MOVING_COST_MAN = 50;\nexport const SECOND_LIFE_POST_PURCHASE_RENOVATION_MAN = 300;\nexport const SECOND_LIFE_RENOVATE_CURRENT_HOME_MAN = 500;\nexport const SECOND_LIFE_PURCHASE_REBUILD_MAN = 2_500;\nexport const SECOND_LIFE_RENOVATE_PARENTS_HOME_MAN = 400;\nexport const SECOND_LIFE_DEFAULT_RENT_MAN = 8;\n",
    "export const SECOND_LIFE_MOVING_COST_MAN = 50;\nexport const SECOND_LIFE_POST_PURCHASE_RENOVATION_MAN = 300;\n\n// 住宅リフォーム推進協議会 2025年度調査（50代以上・実施費用）。\n// 工事内容別の相場ではないため、リフォーム内容を変えても金額は自動変更しない。\nexport const SECOND_LIFE_RENOVATION_REFERENCE_MEDIAN_50PLUS_MAN = 220;\nexport const SECOND_LIFE_RENOVATION_REFERENCE_AVERAGE_50PLUS_MAN = 358.4;\nexport const SECOND_LIFE_RENOVATE_CURRENT_HOME_MAN =\n  SECOND_LIFE_RENOVATION_REFERENCE_MEDIAN_50PLUS_MAN;\nexport const SECOND_LIFE_RENOVATE_PARENTS_HOME_MAN =\n  SECOND_LIFE_RENOVATION_REFERENCE_MEDIAN_50PLUS_MAN;\n\n// 購入・建て替え、家賃は地域・物件差が大きいため全国一律額を自動入力しない。\nexport const SECOND_LIFE_PURCHASE_REBUILD_MAN = 0;\nexport const SECOND_LIFE_DEFAULT_RENT_MAN = 0;\n",
    'housing reference constants',
)
write(p, s)

# 3) Defaults + backward-compatible migration.
p = 'src/lib/secondLifeDefaults.ts'
s = read(p)
s = replace_once(
    s,
    "  getDefaultSecondLifeHousingBaseCostMan,\n  SECOND_LIFE_DEFAULT_RENT_MAN,\n} from './secondLifeHousingFinance';\n",
    "  getDefaultSecondLifeHousingBaseCostMan,\n  SECOND_LIFE_DEFAULT_RENT_MAN,\n  SECOND_LIFE_RENOVATION_REFERENCE_MEDIAN_50PLUS_MAN,\n} from './secondLifeHousingFinance';\n",
    'default imports',
)
s = s.replace("const SECOND_LIFE_RENOVATE_CURRENT_HOME_MAN_FALLBACK = 500;\n", '')
s = replace_once(
    s,
    "    includePostPurchaseRenovation: false,\n    housingBaseCostMan: SECOND_LIFE_RENOVATE_CURRENT_HOME_MAN_FALLBACK,\n",
    "    includePostPurchaseRenovation: false,\n    renovationScope: 'repair_equipment',\n    housingBaseCostMan: SECOND_LIFE_RENOVATION_REFERENCE_MEDIAN_50PLUS_MAN,\n",
    'default renovation scope',
)
s = replace_once(
    s,
    "  const housingBaseCostMan =\n",
    "  const renovationScope =\n    value.renovationScope === 'repair_equipment' ||\n    value.renovationScope === 'partial_room' ||\n    value.renovationScope === 'performance' ||\n    value.renovationScope === 'full'\n      ? value.renovationScope\n      : defaults.renovationScope;\n\n  const housingBaseCostMan =\n",
    'migrate renovation scope',
)
s = replace_once(
    s,
    "    stayOption,\n    housingBaseCostMan,\n",
    "    stayOption,\n    renovationScope,\n    housingBaseCostMan,\n",
    'return renovation scope',
)
write(p, s)

# 4) Labels for summary. Scope is descriptive only and never changes the cost automatically.
p = 'src/lib/secondLifeLabels.ts'
s = read(p)
s = replace_once(
    s,
    "  SecondLifeNewAreaOption,\n  SecondLifeState,\n",
    "  SecondLifeNewAreaOption,\n  SecondLifeRenovationScope,\n  SecondLifeState,\n",
    'label type import',
)
s = replace_once(
    s,
    "export const SECOND_LIFE_LIVING_LEVEL_LABELS: Record<\n",
    "export const SECOND_LIFE_RENOVATION_SCOPE_LABELS: Record<\n  SecondLifeRenovationScope,\n  string\n> = {\n  repair_equipment: '設備交換・修繕中心',\n  partial_room: '一部の部屋をまとめて改修',\n  performance: '断熱・省エネ・耐震など性能向上',\n  full: '複数箇所・全面改修',\n};\n\nexport const SECOND_LIFE_LIVING_LEVEL_LABELS: Record<\n",
    'renovation labels',
)
s = replace_once(
    s,
    "    | 'newAreaOption'\n  >,\n): string {\n",
    "    | 'newAreaOption'\n    | 'renovationScope'\n  >,\n): string {\n",
    'summary pick renovation scope',
)
old = "  return `${SECOND_LIFE_HOUSING_SCENARIO_LABELS[state.housingScenario]}（${getSecondLifeHousingOptionLabel(state)}）`;\n}"
new = "  const base = `${SECOND_LIFE_HOUSING_SCENARIO_LABELS[state.housingScenario]}（${getSecondLifeHousingOptionLabel(state)}）`;\n  const isRenovation =\n    (state.housingScenario === 'stay' && state.stayOption === 'renovate') ||\n    (state.housingScenario === 'hometown' &&\n      state.hometownOption === 'renovate_parents');\n  return isRenovation\n    ? `${base}・${SECOND_LIFE_RENOVATION_SCOPE_LABELS[state.renovationScope]}`\n    : base;\n}"
s = replace_once(s, old, new, 'summary renovation scope label')
write(p, s)

# 5) Housing UI: renovation type, on-demand source, and no arbitrary purchase/rent default copy.
p = 'src/components/secondLife/SecondLifeHousingSection.tsx'
s = read(p)
s = replace_once(
    s,
    "import { getSecondLifeHousingTemplateKind } from '../../lib/secondLifeLabels';\n",
    "import {\n  getSecondLifeHousingTemplateKind,\n  SECOND_LIFE_RENOVATION_SCOPE_LABELS,\n} from '../../lib/secondLifeLabels';\n",
    'housing labels import',
)
s = replace_once(
    s,
    "  SECOND_LIFE_MOVING_COST_MAN,\n  SECOND_LIFE_POST_PURCHASE_RENOVATION_MAN,\n",
    "  SECOND_LIFE_MOVING_COST_MAN,\n  SECOND_LIFE_POST_PURCHASE_RENOVATION_MAN,\n  SECOND_LIFE_RENOVATION_REFERENCE_AVERAGE_50PLUS_MAN,\n  SECOND_LIFE_RENOVATION_REFERENCE_MEDIAN_50PLUS_MAN,\n",
    'housing reference import',
)
s = replace_once(
    s,
    "  const needsBaseCost = housingKind === 'renovate' || housingKind === 'purchase';\n",
    "  const needsBaseCost = housingKind === 'renovate' || housingKind === 'purchase';\n  const isRenovation = housingKind === 'renovate';\n",
    'is renovation',
)
marker = "          {needsBaseCost ? (\n"
insert = """          {isRenovation ? (\n            <div className=\"second-life-renovation-scope\">\n              <p className=\"second-life-renovation-scope-title\">\n                どのようなリフォームを考えますか？\n              </p>\n              <div\n                className=\"second-life-renovation-scope-grid\"\n                role=\"radiogroup\"\n                aria-label=\"リフォーム内容\"\n              >\n                {Object.entries(SECOND_LIFE_RENOVATION_SCOPE_LABELS).map(\n                  ([scope, label]) => (\n                    <label key={scope} className=\"second-life-renovation-scope-option\">\n                      <input\n                        type=\"radio\"\n                        name=\"second-life-renovation-scope\"\n                        checked={state.renovationScope === scope}\n                        onChange={() =>\n                          onChange({\n                            renovationScope:\n                              scope as SecondLifeState['renovationScope'],\n                          })\n                        }\n                      />\n                      <span>{label}</span>\n                    </label>\n                  ),\n                )}\n              </div>\n              <p className=\"second-life-apply-note\">\n                工事内容は計画を整理するための分類です。選択を変えても費用は自動では変わりません。\n              </p>\n            </div>\n          ) : null}\n\n"""
if marker not in s:
    raise RuntimeError('housing base cost marker missing')
s = s.replace(marker, insert + marker, 1)
old = """              <p className=\"second-life-apply-note\">\n                最初に入っている金額は比較用の仮設定です。見積額や希望額が分かる場合は、ここを変更してください。\n              </p>\n"""
new = """              <p className=\"second-life-apply-note\">\n                {isRenovation\n                  ? `参考初期値は${SECOND_LIFE_RENOVATION_REFERENCE_MEDIAN_50PLUS_MAN}万円です。見積額や希望額が分かる場合は、その金額を優先してください。`\n                  : '住宅購入・建て替えは地域や物件条件による差が大きいため、全国一律の金額は自動入力していません。見積額や希望額を入力してください。'}\n              </p>\n              {isRenovation ? (\n                <details className=\"second-life-reference-details\">\n                  <summary>参考値の根拠を見る</summary>\n                  <div className=\"second-life-reference-body\">\n                    <p>\n                      住宅リフォーム推進協議会の2025年度調査では、50代以上のリフォーム実施費用は中央値\n                      {SECOND_LIFE_RENOVATION_REFERENCE_MEDIAN_50PLUS_MAN}万円、平均\n                      {SECOND_LIFE_RENOVATION_REFERENCE_AVERAGE_50PLUS_MAN}万円でした。\n                    </p>\n                    <p>\n                      これは工事内容別の相場ではありません。そのため、このソフトでは工事内容を選んでも金額を自動変更しません。\n                    </p>\n                    <a\n                      href=\"https://j-reform.com/publish/pdf/jitsurei-R7-c.pdf\"\n                      target=\"_blank\"\n                      rel=\"noreferrer\"\n                    >\n                      調査資料を確認する\n                    </a>\n                  </div>\n                </details>\n              ) : null}\n"""
s = replace_once(s, old, new, 'housing amount reference note')
write(p, s)

# 6) Third-life language in the nursing area.
p = 'src/components/secondLife/SecondLifeNursingSection.tsx'
s = read(p)
s = s.replace('介護の設計</p>', 'サードライフ（介護）の設計</p>')
s = replace_once(
    s,
    '        介護の設計はこのセカンドライフ画面を本体にします。ライフイベントには計算用の連動データとして自動反映します。',
    '        このソフトでは、介護が必要になった後の時期を「サードライフ」として分けて整理します。介護費はライフイベントへ計算用データとして反映します。',
    'third life description',
)
write(p, s)

# 7) Q12 becomes a tabbed workspace.
p = 'src/components/secondLife/SecondLifeGuideStep.tsx'
s = read(p)
s = replace_once(s, "import { useMemo } from 'react';", "import { useMemo, useState } from 'react';", 'useState import')
s = replace_once(
    s,
    "import { SecondLifeNursingSection } from './SecondLifeNursingSection';\n",
    "import { SecondLifeNursingSection } from './SecondLifeNursingSection';\nimport './SecondLifeWorkspaceTabs.css';\n",
    'workspace css import',
)
s = replace_once(
    s,
    "}\n\nfunction ChecklistCard({",
    "}\n\ntype SecondLifeWorkspaceTab = 'housing' | 'living' | 'third-life' | 'summary';\n\nconst SECOND_LIFE_WORKSPACE_TABS: { id: SecondLifeWorkspaceTab; label: string }[] = [\n  { id: 'housing', label: '住まい' },\n  { id: 'living', label: '生活費' },\n  { id: 'third-life', label: 'サードライフ' },\n  { id: 'summary', label: 'まとめ' },\n];\n\nfunction ChecklistCard({",
    'workspace tab type',
)
s = replace_once(
    s,
    "  const head = members.find((member) => member.role === 'head');\n",
    "  const head = members.find((member) => member.role === 'head');\n  const [activeTab, setActiveTab] = useState<SecondLifeWorkspaceTab>('housing');\n",
    'workspace tab state',
)
s = s.replace(
    'lead="老後の住まい・生活費・介護を、今の計画と比べながら整理します"',
    'lead="これからの住まい・生活費と、その先の介護まで整理します"',
)
s = s.replace(
    'まず、何歳からセカンドライフとして考えるかを決めます。住まいと生活費は、今の計画を続けるか、その年齢以降を見直すかを選べます。元の入力は消えません。',
    'まず、何歳からセカンドライフとして考えるかを決めます。住まい・生活費はその時期以降を設計し、介護は「サードライフ」として別に整理します。元の入力は消えません。',
)
start = s.index('      <SecondLifeHousingSection')
end = s.rindex('\n    </div>\n  );\n}')
workspace = r'''      <div className="second-life-workspace-tabs" role="tablist" aria-label="セカンドライフ設計">
        {SECOND_LIFE_WORKSPACE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            id={`second-life-tab-${tab.id}`}
            className={
              activeTab === tab.id
                ? 'second-life-workspace-tab is-active'
                : 'second-life-workspace-tab'
            }
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`second-life-panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'housing' ? (
        <div
          id="second-life-panel-housing"
          className="second-life-workspace-panel"
          role="tabpanel"
          aria-labelledby="second-life-tab-housing"
        >
          <SecondLifeHousingSection
            state={secondLifeState}
            onChange={(patch) =>
              onSecondLifeChange({ ...secondLifeState, ...patch })
            }
          />

          <section
            className={`second-life-consistency second-life-consistency--${housingConsistency.status}`}
            aria-labelledby="second-life-housing-consistency-title"
          >
            <div className="second-life-consistency-head">
              <div>
                <p className="second-life-consistency-kicker">現在の住まいとの確認</p>
                <h3 id="second-life-housing-consistency-title">
                  {housingConsistency.title}
                </h3>
              </div>
              <span
                className={`second-life-consistency-status second-life-consistency-status--${housingConsistency.status}`}
              >
                {getSecondLifeHousingConsistencyStatusLabel(housingConsistency.status)}
              </span>
            </div>
            <p className="second-life-consistency-summary">
              {housingConsistency.summary}
            </p>
            {housingConsistency.detailLines.length > 0 ? (
              <ul className="second-life-consistency-details">
                {housingConsistency.detailLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
            <div className="second-life-consistency-actions">
              <span className="second-life-consistency-design">
                今回の設定：{getSecondLifeHousingDesignSummary(secondLifeState)}
              </span>
              <button
                type="button"
                className="second-life-guide-nav-btn"
                onClick={() => onNavigateToStep('housing')}
              >
                現在の住まい入力を確認する →
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === 'living' ? (
        <div
          id="second-life-panel-living"
          className="second-life-workspace-panel"
          role="tabpanel"
          aria-labelledby="second-life-tab-living"
        >
          <SecondLifeLivingSection
            state={secondLifeState}
            onChange={(patch) =>
              onSecondLifeChange({ ...secondLifeState, ...patch })
            }
            options={livingOptions}
          />
        </div>
      ) : null}

      {activeTab === 'third-life' ? (
        <div
          id="second-life-panel-third-life"
          className="second-life-workspace-panel"
          role="tabpanel"
          aria-labelledby="second-life-tab-third-life"
        >
          <SecondLifeNursingSection
            members={members}
            state={secondLifeState}
            onChange={onSecondLifeChange}
            applyStatus={guide.items.find((item) => item.id === 'nursing')?.status ?? 'missing'}
            onApply={onApplySecondLifeNursing}
            onOpenLifeEvent={() => onNavigateToStep('life-event')}
          />
        </div>
      ) : null}

      {activeTab === 'summary' ? (
        <div
          id="second-life-panel-summary"
          className="second-life-workspace-panel second-life-workspace-panel--summary"
          role="tabpanel"
          aria-labelledby="second-life-tab-summary"
        >
          <h3 className="second-life-guide-checklist-title">設定内容の確認</h3>
          <p className="second-life-guide-checklist-lead">
            「今の計画をそのまま使う」を選んだ項目は現在の入力で計算します。「見直す」を選んだ項目は、指定した年齢から今回の設定に切り替えて試算します。
          </p>

          <div className="second-life-guide-grid">
            {guide.items.map((item) => (
              <ChecklistCard
                key={item.id}
                item={item}
                designNote={
                  item.id === 'housing'
                    ? getSecondLifeHousingDesignSummary(secondLifeState)
                    : item.id === 'living'
                      ? getSecondLifeLivingDesignSummary(secondLifeState)
                      : undefined
                }
                actionLabel={
                  item.id === 'housing'
                    ? '住まいを編集する →'
                    : item.id === 'living'
                      ? '生活費を編集する →'
                      : 'サードライフを編集する →'
                }
                onNavigate={() =>
                  setActiveTab(
                    item.id === 'housing'
                      ? 'housing'
                      : item.id === 'living'
                        ? 'living'
                        : 'third-life',
                  )
                }
              />
            ))}
          </div>
        </div>
      ) : null}
'''
s = s[:start] + workspace + s[end:]
write(p, s)

# 8) Local Q12 workspace styling; no global CSS expansion.
css = r'''.second-life-workspace-tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 16px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--color-surface);
}

.second-life-workspace-tab {
  min-height: 46px;
  padding: 10px 14px;
  border: 0;
  border-right: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-muted);
  font-weight: 700;
}

.second-life-workspace-tab:last-child {
  border-right: 0;
}

.second-life-workspace-tab:hover {
  background: var(--color-soft);
}

.second-life-workspace-tab.is-active {
  background: var(--color-brand-soft);
  color: var(--color-brand);
  box-shadow: inset 0 -3px 0 var(--color-brand);
}

.second-life-workspace-tab:focus-visible {
  outline: 2px solid var(--color-brand);
  outline-offset: -3px;
}

.second-life-workspace-panel {
  margin-top: 14px;
}

.second-life-workspace-panel--summary {
  padding-top: 4px;
}

.second-life-renovation-scope {
  margin-top: 14px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
}

.second-life-renovation-scope-title {
  margin: 0 0 10px;
  font-weight: 700;
  color: var(--color-ink);
}

.second-life-renovation-scope-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.second-life-renovation-scope-option {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
}

.second-life-renovation-scope-option:has(input:checked) {
  border-color: var(--color-brand);
  background: var(--color-brand-soft);
}

.second-life-renovation-scope-option input {
  margin-top: 3px;
}

.second-life-reference-details {
  margin-top: 10px;
  font-size: var(--text-sm);
  color: var(--color-muted);
}

.second-life-reference-details summary {
  display: inline-block;
  cursor: pointer;
  color: var(--color-brand);
  font-weight: 700;
}

.second-life-reference-body {
  margin-top: 8px;
  padding: 10px 12px;
  border-left: 3px solid var(--color-brand-soft);
  background: #fafafa;
  line-height: 1.65;
}

.second-life-reference-body p {
  margin: 0 0 6px;
}

.second-life-reference-body p:last-of-type {
  margin-bottom: 8px;
}

.second-life-reference-body a {
  color: var(--color-brand);
}

@media (max-width: 960px) {
  .second-life-workspace-tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .second-life-workspace-tab:nth-child(2) {
    border-right: 0;
  }

  .second-life-workspace-tab:nth-child(-n + 2) {
    border-bottom: 1px solid var(--color-border);
  }

  .second-life-renovation-scope-grid {
    grid-template-columns: 1fr;
  }
}
'''
write('src/components/secondLife/SecondLifeWorkspaceTabs.css', css)

print('Q12 tabs/renovation patch applied')
