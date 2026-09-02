import { Fragment, useMemo, useState, type CSSProperties } from 'react';

import type { CashFlowInput } from '../../lib/cashFlow';
import type {
  RequiredCoverageExpenseTotals,
  RequiredCoverageResult,
} from '../../lib/requiredCoverage';
import {
  COVERAGE_EXPENSE_KIND_COLORS,
  COVERAGE_EXPENSE_KIND_LABELS,
  COVERAGE_EXPENSE_KIND_ORDER,
  coverageLineRatePct,
  coverageTabRateId,
  coverageOwnedHoldingPartLineId,
  filterCoverageLines,
  getCoverageDesign,
  isCoverageLineIncluded,
  listCoverageDesignCatalog,
  listHousingHoldingCoverageParts,
  patchCoverageCategoryDesign,
  patchCoverageCategoryRate,
  patchCoverageLineOverride,
  patchCoverageTabRate,
  type CoverageDesignLine,
} from '../../lib/requiredCoverageDesign';
import type {
  RequiredCoverageDesignStage,
  RequiredCoverageExpenseKind,
  RequiredCoverageState,
  RequiredCoverageSubject,
} from '../../types/requiredCoverage';

interface RequiredCoverageExpenseDesignProps {
  cashFlowInput: CashFlowInput;
  result: RequiredCoverageResult;
  state: RequiredCoverageState;
  subject: RequiredCoverageSubject;
  stage?: RequiredCoverageDesignStage;
  onChange: (state: RequiredCoverageState) => void;
}

function formatMan(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0';
  return Number.isInteger(value)
    ? value.toLocaleString('ja-JP')
    : value.toLocaleString('ja-JP', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      });
}

/** ベース累計に対する万一後の実効残す割合（％） */
function effectiveRatePct(
  baseline: number,
  designed: number,
  included: boolean,
): number {
  if (!included) return 0;
  if (!Number.isFinite(baseline) || baseline === 0) return 100;
  if (!Number.isFinite(designed)) return 0;
  return (designed / baseline) * 100;
}

function formatRatePct(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toLocaleString('ja-JP', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      });
  return `${text}%`;
}

function mergeHoldingParts(
  baseline: { key: string; label: string; amount: number }[],
  designed: { key: string; label: string; amount: number }[],
): { key: string; label: string; baseline: number; designed: number }[] {
  const designedByKey = new Map(
    designed.map((part) => [part.key, part] as const),
  );
  const rows = baseline.map((part) => ({
    key: part.key,
    label: part.label,
    baseline: part.amount,
    designed: designedByKey.get(part.key)?.amount ?? 0,
  }));
  const seen = new Set(baseline.map((part) => part.key));
  for (const part of designed) {
    if (seen.has(part.key)) continue;
    rows.push({
      key: part.key,
      label: part.label,
      baseline: 0,
      designed: part.amount,
    });
  }
  return rows;
}

function collectDescendantLineIds(
  kind: RequiredCoverageExpenseKind,
  lines: CoverageDesignLine[],
  result: RequiredCoverageResult,
): string[] {
  const ids: string[] = [];
  for (const line of lines) {
    ids.push(line.id);
    if (kind === 'housing') {
      for (const part of mergeHoldingParts(
        listHousingHoldingCoverageParts(
          result.baselineExpenses.holdingDetailByItem?.[line.id],
        ),
        listHousingHoldingCoverageParts(
          result.expenses.holdingDetailByItem?.[line.id],
        ),
      )) {
        ids.push(coverageOwnedHoldingPartLineId(line.id, part.key));
      }
    }
  }
  return ids;
}

function categoryAmount(
  totals: RequiredCoverageExpenseTotals,
  kind: RequiredCoverageExpenseKind,
): number {
  switch (kind) {
    case 'living':
      return totals.living;
    case 'education':
      return totals.education;
    case 'housing':
      return totals.housing;
    case 'lifeEvent':
      return totals.lifeEvent;
    case 'vehicle':
      return totals.vehicle;
    case 'loanRepayment':
      return totals.loanRepayment;
    case 'insuranceOther':
      return totals.insuranceOther;
  }
}

interface OwnerTab {
  id: string;
  label: string;
  baseline: number;
  designed: number;
}

function groupCoverageLines(
  lines: CoverageDesignLine[],
): { key: string; label: string; lines: CoverageDesignLine[] }[] {
  if (lines.length === 0) return [];
  const hasGroup = lines.some((line) => line.group);
  if (!hasGroup) {
    return [{ key: '', label: '内訳', lines }];
  }
  const byGroup = new Map<string, CoverageDesignLine[]>();
  for (const line of lines) {
    const key = line.group ?? 'その他';
    const current = byGroup.get(key) ?? [];
    current.push(line);
    byGroup.set(key, current);
  }
  const preferred = ['賃貸', '所有'];
  const keys = [
    ...preferred.filter((key) => byGroup.has(key)),
    ...[...byGroup.keys()].filter((key) => !preferred.includes(key)),
  ];
  return keys.map((key) => ({
    key,
    label: key,
    lines: byGroup.get(key) ?? [],
  }));
}

function buildOwnerTabs(
  lines: CoverageDesignLine[],
  baselineByItem: Record<string, number>,
  designedByItem: Record<string, number>,
): OwnerTab[] {
  const seen = new Set<string>();
  const tabs: OwnerTab[] = [];
  for (const line of lines) {
    if (!line.targetId || seen.has(line.targetId)) continue;
    seen.add(line.targetId);
    const tabLines = lines.filter((item) => item.targetId === line.targetId);
    tabs.push({
      id: line.targetId,
      label: line.ownerLabel,
      baseline: tabLines.reduce(
        (sum, item) => sum + (baselineByItem[item.id] ?? 0),
        0,
      ),
      designed: tabLines.reduce(
        (sum, item) => sum + (designedByItem[item.id] ?? 0),
        0,
      ),
    });
  }
  return tabs;
}

export function CoverageRateControls({
  included,
  ratePct,
  ariaLabel,
  onRatePct,
  tone = 'line',
}: {
  included: boolean;
  ratePct: number;
  ariaLabel: string;
  onRatePct: (ratePct: number) => void;
  tone?: 'group' | 'line';
}) {
  const sliderValue = Math.min(200, Math.max(0, ratePct));
  const setRate = (raw: number) => {
    onRatePct(Number.isFinite(raw) ? Math.min(200, Math.max(0, raw)) : 100);
  };

  return (
    <div
      className={
        tone === 'group'
          ? 'required-coverage-design-rate is-group'
          : 'required-coverage-design-rate is-line'
      }
    >
      <div className="required-coverage-rate-slider-wrap">
        <input
          type="range"
          className="required-coverage-rate-slider"
          min={0}
          max={200}
          step={1}
          disabled={!included}
          value={sliderValue}
          aria-valuemin={0}
          aria-valuemax={200}
          aria-valuenow={sliderValue}
          aria-label={`${ariaLabel}（スライダー）`}
          onChange={(event) => setRate(Number(event.target.value))}
        />
        <div className="required-coverage-rate-slider-scale" aria-hidden>
          <span>0%</span>
          <span>100%</span>
          <span>200%</span>
        </div>
      </div>
      <span className="rate-input-wrap">
        <input
          type="number"
          className="rate-input"
          min={0}
          max={200}
          step={1}
          disabled={!included}
          value={ratePct}
          aria-label={ariaLabel}
          onChange={(event) => setRate(Number(event.target.value))}
        />
        <span className="rate-unit">%</span>
      </span>
    </div>
  );
}

export function RequiredCoverageExpenseDesign({
  cashFlowInput,
  result,
  state,
  subject,
  stage = 'detail',
  onChange,
}: RequiredCoverageExpenseDesignProps) {
  const catalog = useMemo(
    () => listCoverageDesignCatalog(cashFlowInput, subject),
    [cashFlowInput, subject],
  );
  const design = getCoverageDesign(state, subject, stage);
  const [expanded, setExpanded] = useState<
    Partial<Record<RequiredCoverageExpenseKind, boolean>>
  >({});
  const [activeTabByKey, setActiveTabByKey] = useState<Record<string, string>>(
    {},
  );
  const linesByKind = useMemo(() => {
    const next: Record<RequiredCoverageExpenseKind, CoverageDesignLine[]> = {
      living: [],
      education: [],
      housing: [],
      lifeEvent: [],
      vehicle: [],
      loanRepayment: [],
      insuranceOther: [],
    };
    for (const category of catalog) {
      next[category.kind] = filterCoverageLines(
        category.lines,
        result.baselineExpenses.byItem,
      );
    }
    return next;
  }, [catalog, result.baselineExpenses.byItem]);

  return (
    <section
      className="required-coverage-card required-coverage-expense-card"
      aria-labelledby="required-coverage-expense-heading"
    >
      <h3
        id="required-coverage-expense-heading"
        className="required-coverage-card-title"
      >
        万一後の支出
      </h3>
      <p className="required-coverage-card-note">
        左がいまの家計の期間累計、右が万一後に残す額です。所有物件のローンは、団信で消えない残元金（まだ借りていなければ借入額）を算入し、将来の利息は含めません。残す割合の初期値は100%です。親の残す割合を変えると、内訳の割合指定はリセットされます。
      </p>

      <table className="required-coverage-expense-table required-coverage-design-totals">
        <colgroup>
          <col className="required-coverage-col-item" />
          <col className="required-coverage-col-num" />
          <col className="required-coverage-col-rate" />
          <col className="required-coverage-col-num" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">項目</th>
            <th scope="col" className="required-coverage-num">
              <span className="required-coverage-th-stack">
                <span>ベース累計</span>
                <span className="required-coverage-th-unit">（万円）</span>
              </span>
            </th>
            <th scope="col" className="required-coverage-rate-heading">
              残す割合
            </th>
            <th scope="col" className="required-coverage-num">
              <span className="required-coverage-th-stack">
                <span>万一後</span>
                <span className="required-coverage-th-unit">（万円）</span>
              </span>
            </th>
          </tr>
        </thead>
        {COVERAGE_EXPENSE_KIND_ORDER.map((kind) => {
            const categoryDesign = design[kind];
            const isOpen = expanded[kind] === true;
            const allLines = linesByKind[kind];
            const groups = groupCoverageLines(allLines);
            const kindStyle = {
              '--coverage-kind-color': COVERAGE_EXPENSE_KIND_COLORS[kind],
            } as CSSProperties;
            return (
              <tbody
                key={kind}
                className="required-coverage-expense-kind"
                style={kindStyle}
              >
                <tr
                  className={
                    isOpen
                      ? 'required-coverage-design-parent-row is-open'
                      : 'required-coverage-design-parent-row'
                  }
                >
                  <th scope="row">
                    <div className="required-coverage-design-parent">
                      <label className="required-coverage-design-include">
                        <input
                          type="checkbox"
                          checked={categoryDesign.included}
                          onChange={(event) =>
                            onChange(
                              patchCoverageCategoryDesign(
                                state,
                                subject,
                                kind,
                                { included: event.target.checked },
                                stage,
                              ),
                            )
                          }
                        />
                        <span className="required-coverage-design-kind-swatch" aria-hidden />
                        <span>{COVERAGE_EXPENSE_KIND_LABELS[kind]}</span>
                      </label>
                      {allLines.length > 0 ? (
                        <button
                          type="button"
                          className="required-coverage-design-fold"
                          aria-expanded={isOpen}
                          onClick={() =>
                            setExpanded((current) => ({
                              ...current,
                              [kind]: !isOpen,
                            }))
                          }
                        >
                          {isOpen
                            ? '内訳を閉じる'
                            : `内訳（${allLines.length}）`}
                        </button>
                      ) : null}
                    </div>
                  </th>
                  <td className="required-coverage-num">
                    {formatMan(categoryAmount(result.baselineExpenses, kind))}
                  </td>
                  <td className="required-coverage-design-rate-summary">
                    {formatRatePct(
                      effectiveRatePct(
                        categoryAmount(result.baselineExpenses, kind),
                        categoryAmount(result.expenses, kind),
                        categoryDesign.included,
                      ),
                    )}
                  </td>
                  <td className="required-coverage-num required-coverage-total">
                    {formatMan(categoryAmount(result.expenses, kind))}
                  </td>
                </tr>
                {isOpen
                  ? groups.map((group) => {
                      const ownerTabs = buildOwnerTabs(
                        group.lines,
                        result.baselineExpenses.byItem,
                        result.expenses.byItem,
                      );
                      const showOwnerTabs = ownerTabs.length > 1;
                      const tabKey = `${kind}::${group.key}`;
                      const selectedTabId = activeTabByKey[tabKey];
                      const activeTabId =
                        selectedTabId &&
                        ownerTabs.some((tab) => tab.id === selectedTabId)
                          ? selectedTabId
                          : (ownerTabs[0]?.id ?? null);
                      const activeTab =
                        ownerTabs.find((tab) => tab.id === activeTabId) ??
                        null;
                      const lines = showOwnerTabs
                        ? group.lines.filter(
                            (line) => line.targetId === activeTabId,
                          )
                        : group.lines;
                      const breakdownBaseline = activeTab
                        ? activeTab.baseline
                        : group.lines.reduce(
                            (sum, line) =>
                              sum +
                              (result.baselineExpenses.byItem[line.id] ?? 0),
                            0,
                          );
                      const breakdownDesigned = activeTab
                        ? activeTab.designed
                        : group.lines.reduce(
                            (sum, line) =>
                              sum + (result.expenses.byItem[line.id] ?? 0),
                            0,
                          );
                      const tabEffectiveRatePct = effectiveRatePct(
                        breakdownBaseline,
                        breakdownDesigned,
                        categoryDesign.included,
                      );
                      return (
                        <Fragment key={`${kind}-${group.key}`}>
                          <tr className="required-coverage-design-breakdown-head">
                            <th scope="row">
                              <div className="required-coverage-design-breakdown-bar">
                                <span className="required-coverage-design-breakdown-label">
                                  {group.label}
                                </span>
                                {ownerTabs.length > 0 ? (
                                  <div
                                    className="required-coverage-owner-tabs"
                                    role={
                                      showOwnerTabs ? 'tablist' : undefined
                                    }
                                    aria-label={`${COVERAGE_EXPENSE_KIND_LABELS[kind]}の${group.label || '対象'}`}
                                  >
                                    {showOwnerTabs
                                      ? ownerTabs.map((tab) => (
                                          <button
                                            key={tab.id}
                                            type="button"
                                            role="tab"
                                            aria-selected={
                                              tab.id === activeTabId
                                            }
                                            className={
                                              tab.id === activeTabId
                                                ? 'required-coverage-owner-tab is-active'
                                                : 'required-coverage-owner-tab'
                                            }
                                            onClick={() =>
                                              setActiveTabByKey(
                                                (current) => ({
                                                  ...current,
                                                  [tabKey]: tab.id,
                                                }),
                                              )
                                            }
                                          >
                                            <span className="required-coverage-owner-tab-name">
                                              {tab.label}
                                            </span>
                                            <span className="required-coverage-owner-tab-total">
                                              {formatMan(tab.baseline)}
                                              <span
                                                className="required-coverage-owner-tab-arrow"
                                                aria-hidden="true"
                                              >
                                                →
                                              </span>
                                              {formatMan(tab.designed)}
                                            </span>
                                          </button>
                                        ))
                                      : activeTab ? (
                                          <span
                                            className="required-coverage-owner-tab is-active is-static"
                                            aria-label={activeTab.label}
                                          >
                                            <span className="required-coverage-owner-tab-name">
                                              {activeTab.label}
                                            </span>
                                            <span className="required-coverage-owner-tab-total">
                                              {formatMan(activeTab.baseline)}
                                              <span
                                                className="required-coverage-owner-tab-arrow"
                                                aria-hidden="true"
                                              >
                                                →
                                              </span>
                                              {formatMan(activeTab.designed)}
                                            </span>
                                          </span>
                                        ) : null}
                                  </div>
                                ) : null}
                              </div>
                            </th>
                            <td className="required-coverage-num">
                              {formatMan(breakdownBaseline)}
                            </td>
                            <td className="required-coverage-design-rate-cell">
                              <CoverageRateControls
                                included={categoryDesign.included}
                                ratePct={Math.round(tabEffectiveRatePct)}
                                tone="group"
                                ariaLabel={
                                  activeTab
                                    ? `${activeTab.label}の残す割合`
                                    : `${COVERAGE_EXPENSE_KIND_LABELS[kind]}の残す割合`
                                }
                                onRatePct={(ratePct) => {
                                  if (activeTabId) {
                                    onChange(
                                      patchCoverageTabRate(
                                        state,
                                        subject,
                                        kind,
                                        coverageTabRateId(
                                          activeTabId,
                                          group.key || undefined,
                                        ),
                                        ratePct,
                                        collectDescendantLineIds(
                                          kind,
                                          lines,
                                          result,
                                        ),
                                        stage,
                                      ),
                                    );
                                    return;
                                  }
                                  onChange(
                                    patchCoverageCategoryRate(
                                      state,
                                      subject,
                                      kind,
                                      ratePct,
                                      { stage },
                                    ),
                                  );
                                }}
                              />
                            </td>
                            <td className="required-coverage-num">
                              {formatMan(breakdownDesigned)}
                            </td>
                          </tr>
                          {lines.map((line) => {
                            const lockedOff = line.includeLockedOff === true;
                            const lineIncluded = lockedOff
                              ? false
                              : isCoverageLineIncluded(
                                  categoryDesign,
                                  line.id,
                                );
                            const included =
                              categoryDesign.included && lineIncluded;
                            const lineRate = coverageLineRatePct(
                              categoryDesign,
                              line.id,
                              line.targetId,
                              undefined,
                              group.key || undefined,
                            );
                            const baselineLine =
                              result.baselineExpenses.byItem[line.id] ?? 0;
                            const designedLine =
                              result.expenses.byItem[line.id] ?? 0;
                            const assumptionLabel = !lineIncluded
                              && line.creditLifePaysOff
                              ? '団信でローン消滅'
                              : lineIncluded
                                ? (line.assumptionHint ?? null)
                                : null;
                            const holdingParts =
                              kind === 'housing'
                                ? mergeHoldingParts(
                                    listHousingHoldingCoverageParts(
                                      result.baselineExpenses
                                        .holdingDetailByItem?.[line.id],
                                    ),
                                    listHousingHoldingCoverageParts(
                                      result.expenses.holdingDetailByItem?.[
                                        line.id
                                      ],
                                    ),
                                  )
                                : [];
                            return (
                              <Fragment key={`${kind}-${line.id}`}>
                              <tr
                                className={
                                  included
                                    ? 'required-coverage-design-child'
                                    : 'required-coverage-design-child required-coverage-design-row-off'
                                }
                              >
                                <th scope="row">
                                  <div className="required-coverage-design-child-main">
                                    <span
                                      className="required-coverage-design-indent"
                                      aria-hidden="true"
                                    />
                                    <label className="required-coverage-design-include">
                                      <input
                                        type="checkbox"
                                        checked={lineIncluded}
                                        disabled={
                                          !categoryDesign.included ||
                                          lockedOff
                                        }
                                        title={
                                          lockedOff
                                            ? '既契約の団信でローンが消滅するため、必要保障額に含められません'
                                            : undefined
                                        }
                                        aria-label={
                                          assumptionLabel
                                            ? `${line.label}（${assumptionLabel}）を含める`
                                            : `${line.label}を含める`
                                        }
                                        onChange={(event) => {
                                          if (lockedOff) return;
                                          onChange(
                                            patchCoverageLineOverride(
                                              state,
                                              subject,
                                              kind,
                                              line.id,
                                              {
                                                included: event.target.checked,
                                              },
                                              stage,
                                            ),
                                          );
                                        }}
                                      />
                                      <span>
                                        <span className="required-coverage-design-item-label">
                                          <span className="required-coverage-design-item-name">
                                            {line.label}
                                          </span>
                                          {assumptionLabel ? (
                                            <span className="required-coverage-design-item-assumption">
                                              （{assumptionLabel}）
                                            </span>
                                          ) : null}
                                        </span>
                                      </span>
                                    </label>
                                  </div>
                                </th>
                                <td className="required-coverage-num">
                                  {formatMan(baselineLine)}
                                </td>
                                <td className="required-coverage-design-rate-cell">
                                  <CoverageRateControls
                                    included={included}
                                    ratePct={lineRate}
                                    tone="line"
                                    ariaLabel={`${line.label}の残す割合`}
                                    onRatePct={(ratePct) =>
                                      onChange(
                                        patchCoverageLineOverride(
                                          state,
                                          subject,
                                          kind,
                                          line.id,
                                          { ratePct },
                                          stage,
                                        ),
                                      )
                                    }
                                  />
                                </td>
                                <td className="required-coverage-num">
                                  {formatMan(designedLine)}
                                </td>
                              </tr>
                              {holdingParts.map((part) => {
                                const partId = coverageOwnedHoldingPartLineId(
                                  line.id,
                                  part.key,
                                );
                                const partLineIncluded = isCoverageLineIncluded(
                                  categoryDesign,
                                  partId,
                                );
                                const partIncluded =
                                  included && partLineIncluded;
                                const partRate = coverageLineRatePct(
                                  categoryDesign,
                                  partId,
                                  line.targetId,
                                  line.id,
                                  group.key || undefined,
                                );
                                return (
                                <tr
                                  key={`${kind}-${line.id}-${part.key}`}
                                  className={
                                    partIncluded
                                      ? 'required-coverage-design-holding-part'
                                      : 'required-coverage-design-holding-part required-coverage-design-row-off'
                                  }
                                >
                                  <th scope="row">
                                    <div className="required-coverage-design-child-main">
                                      <span
                                        className="required-coverage-design-indent required-coverage-design-indent-deep"
                                        aria-hidden="true"
                                      />
                                      <label className="required-coverage-design-include">
                                        <input
                                          type="checkbox"
                                          checked={partIncluded}
                                          disabled={!included}
                                          aria-label={`${part.label}を含める`}
                                          onChange={(event) =>
                                            onChange(
                                              patchCoverageLineOverride(
                                                state,
                                                subject,
                                                kind,
                                                partId,
                                                {
                                                  included:
                                                    event.target.checked,
                                                },
                                                stage,
                                              ),
                                            )
                                          }
                                        />
                                        <span>{part.label}</span>
                                      </label>
                                    </div>
                                  </th>
                                  <td className="required-coverage-num">
                                    {formatMan(part.baseline)}
                                  </td>
                                  <td className="required-coverage-design-rate-cell">
                                    <CoverageRateControls
                                      included={partIncluded}
                                      ratePct={partRate}
                                      tone="line"
                                      ariaLabel={`${part.label}の残す割合`}
                                      onRatePct={(ratePct) =>
                                        onChange(
                                          patchCoverageLineOverride(
                                            state,
                                            subject,
                                            kind,
                                            partId,
                                            { ratePct },
                                            stage,
                                          ),
                                        )
                                      }
                                    />
                                  </td>
                                  <td className="required-coverage-num">
                                    {formatMan(part.designed)}
                                  </td>
                                </tr>
                                );
                              })}
                              </Fragment>
                            );
                          })}
                        </Fragment>
                      );
                    })
                  : null}
              </tbody>
            );
          })}
        <tfoot>
          <tr>
            <th scope="row">支出合計</th>
            <td className="required-coverage-num">
              {formatMan(result.baselineExpenses.total)}
            </td>
            <td className="required-coverage-design-rate-summary">
              {formatRatePct(
                effectiveRatePct(
                  result.baselineExpenses.total,
                  result.expenses.total,
                  true,
                ),
              )}
            </td>
            <td className="required-coverage-num required-coverage-total">
              {formatMan(result.expenses.total)}
            </td>
          </tr>
        </tfoot>
      </table>
      <p className="required-coverage-card-note">
        万一後に残す支出の累計です。必要保障額タブでは、この支出から準備済を差し引いて足りない金額を必要保障額（不足額）とします。
      </p>
    </section>
  );
}
