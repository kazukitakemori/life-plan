import { useMemo, useState } from 'react';

import type { CashFlowInput } from '../../lib/cashFlow';
import type { CashFlowTableData } from '../../types/cashFlow';
import { getMemberTabLabel } from '../../lib/memberDisplay';
import {
  REQUIRED_COVERAGE_CUSTOM_OPTION,
  buildRequiredCoverageResult,
  formatCoverageYearMonth,
  resolveCoverageSubject,
} from '../../lib/requiredCoverage';
import {
  getCoverageDesign,
  patchCoverageLivingRateFromSimpleDesign,
} from '../../lib/requiredCoverageDesign';
import type {
  RequiredCoverageChartView,
  RequiredCoverageDetailPane,
  RequiredCoverageHorizonKind,
  RequiredCoveragePageView,
  RequiredCoverageRiskKind,
  RequiredCoverageState,
  RequiredCoverageSubject,
} from '../../types/requiredCoverage';
import {
  REQUIRED_COVERAGE_CHART_VIEWS,
  REQUIRED_COVERAGE_DETAIL_SECTIONS,
  REQUIRED_COVERAGE_PAGE_VIEWS,
  isRequiredCoverageChartView,
} from '../../types/requiredCoverage';
import {
  CoverageRateControls,
  RequiredCoverageExpenseDesign,
} from './RequiredCoverageExpenseDesign';
import { RequiredCoverageMedicalRiskView } from './RequiredCoverageMedicalRiskView';
import { RequiredCoverageNeedChart } from './RequiredCoverageNeedChart';
import { RequiredCoverageCategoryCharts } from './RequiredCoverageCategoryChart';
import { RequiredCoverageWorkDesign } from './RequiredCoverageWorkDesign';
import { RequiredCoverageYearNetChart } from './RequiredCoverageYearNetChart';

interface RequiredCoverageViewProps {
  cashFlowInput: CashFlowInput;
  cashFlowData?: CashFlowTableData;
  state: RequiredCoverageState;
  pageView: RequiredCoveragePageView;
  /** 部分目的（万が一保障）では詳細設計を出せない */
  simpleDesignOnly?: boolean;
  onChange: (state: RequiredCoverageState) => void;
  onPageViewChange: (view: RequiredCoveragePageView) => void;
}

function SubjectSwitchButton({
  active,
  disabled,
  title,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      className={
        active
          ? 'required-coverage-chart-switch-tab is-active'
          : 'required-coverage-chart-switch-tab'
      }
      disabled={disabled}
      title={title}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function TabButton({
  className,
  active,
  onClick,
  children,
}: {
  className: string;
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      className={active ? `${className} is-active` : className}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function buildCustomYearOptions(
  startYear: number,
  extraYears: number[],
): number[] {
  const endYear = startYear + 60;
  const years = new Set<number>();
  for (let year = startYear; year <= endYear; year += 1) {
    years.add(year);
  }
  for (const year of extraYears) {
    if (year > 0) years.add(year);
  }
  return [...years].sort((left, right) => left - right);
}

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

export function RequiredCoverageView({
  cashFlowInput,
  cashFlowData,
  state,
  pageView,
  simpleDesignOnly = false,
  onChange,
  onPageViewChange,
}: RequiredCoverageViewProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chartView, setChartView] =
    useState<RequiredCoverageChartView>('sweep');
  const [detailPane, setDetailPane] =
    useState<RequiredCoverageDetailPane>('expense');

  const showDetail = !simpleDesignOnly && pageView === 'detail';
  const effectivePageView: RequiredCoveragePageView = showDetail
    ? 'detail'
    : 'simple';

  const result = useMemo(
    () =>
      buildRequiredCoverageResult(cashFlowInput, state, {
        designStage: effectivePageView,
        cashFlowData,
      }),
    [cashFlowInput, cashFlowData, state, effectivePageView],
  );

  const subject = resolveCoverageSubject(
    state.subject,
    cashFlowInput.familyMembers,
  );
  const riskKind: RequiredCoverageRiskKind =
    state.riskKind === 'medical' ? 'medical' : 'death';
  const isMedicalRisk = riskKind === 'medical';
  const livingDesign = getCoverageDesign(state, subject, 'simple').living;
  const headMember = cashFlowInput.familyMembers.find(
    (member) => member.role === 'head',
  );
  const spouseMember = cashFlowInput.familyMembers.find(
    (member) => member.role === 'spouse',
  );
  const headLabel = headMember
    ? getMemberTabLabel(headMember)
    : '世帯主さん';
  const spouseLabel = spouseMember
    ? getMemberTabLabel(spouseMember)
    : '配偶者さん';
  const hasSpouse = spouseMember != null;
  const subjectLabel = subject === 'spouse' ? spouseLabel : headLabel;
  const chartKey = `${result.coverageStart.year}-${result.coverageEnd?.year ?? 0}-${result.coverageEnd?.month ?? 0}`;
  const showExpenseForm = detailPane === 'expense';
  const showIncomeForm = detailPane === 'income';
  const showForm = showExpenseForm || showIncomeForm;
  const activeChartView = showForm
    ? chartView
    : isRequiredCoverageChartView(detailPane)
      ? detailPane
      : chartView;

  const selectedPreset = result.horizons.find((row) => row.kind === state.kind);
  const customYearOptions = buildCustomYearOptions(
    result.coverageStart.year,
    [
      state.customEndYear,
      ...result.horizons.map((row) => row.end?.year ?? 0),
    ],
  );
  const customYear =
    state.customEndYear > 0
      ? state.customEndYear
      : result.coverageStart.year;
  const customMonth =
    state.customEndMonth >= 1 && state.customEndMonth <= 12
      ? state.customEndMonth
      : result.coverageStart.month;

  const handleKindChange = (kind: RequiredCoverageHorizonKind) => {
    if (kind !== 'custom') {
      onChange({ ...state, kind });
      return;
    }
    const presetEnd =
      selectedPreset?.end ??
      result.horizons.find((row) => row.available && row.end)?.end ??
      result.coverageEnd;
    onChange({
      ...state,
      kind,
      customEndYear:
        state.customEndYear > 0
          ? state.customEndYear
          : (presetEnd?.year ?? result.coverageStart.year),
      customEndMonth:
        state.customEndMonth > 0
          ? state.customEndMonth
          : (presetEnd?.month ?? result.coverageStart.month),
    });
  };

  const needChart =
    !showForm &&
    result.chartPoints.length > 0 &&
    activeChartView !== 'yearNet' ? (
      <RequiredCoverageNeedChart
        key={`need-${chartKey}-${effectivePageView}-${activeChartView}`}
        points={result.chartPoints}
        hasSpouse={hasSpouse}
        variant={activeChartView === 'line' ? 'line' : 'sweep'}
      />
    ) : null;

  const settingsPanelLabel = isMedicalRisk
    ? '前提条件（手術・入院）'
    : effectivePageView === 'simple'
      ? '前提条件（簡易設定）'
      : '前提条件（詳細設定）';

  return (
    <div className="required-coverage-page">
      <div className="required-coverage-workspace">
        <aside
          className={
            settingsOpen
              ? 'required-coverage-settings-panel is-open'
              : 'required-coverage-settings-panel is-collapsed'
          }
        >
          <button
            type="button"
            className="required-coverage-settings-rail"
            onClick={() => setSettingsOpen((open) => !open)}
            aria-expanded={settingsOpen}
            aria-controls="required-coverage-settings-drawer"
            aria-label={
              settingsOpen
                ? `${settingsPanelLabel}を閉じる`
                : `${settingsPanelLabel}を開く`
            }
            title={
              settingsOpen
                ? `${settingsPanelLabel}を閉じる`
                : `${settingsPanelLabel}を開く`
            }
          >
            <span
              className="required-coverage-settings-rail-chevron"
              aria-hidden
            />
            <span className="required-coverage-settings-rail-title">
              {settingsPanelLabel}
            </span>
          </button>

          <div
            id="required-coverage-settings-drawer"
            className="required-coverage-settings-drawer"
            aria-hidden={!settingsOpen}
          >
            <div className="required-coverage-settings-panel-body">
              {!isMedicalRisk && !simpleDesignOnly ? (
                <section
                  className="required-coverage-settings-block"
                  aria-labelledby="required-coverage-design-heading"
                >
                  <h3
                    id="required-coverage-design-heading"
                    className="required-coverage-card-title"
                  >
                    設計の種類
                  </h3>
                  <div className="required-coverage-horizon-select-row">
                    <select
                      id="required-coverage-design-kind"
                      className="select-input select-input--wide"
                      value={pageView}
                      aria-labelledby="required-coverage-design-heading"
                      onChange={(event) => {
                        const next =
                          event.target.value as RequiredCoveragePageView;
                        if (next === 'detail' && pageView !== 'detail') {
                          setDetailPane('expense');
                        }
                        onPageViewChange(next);
                      }}
                    >
                      {REQUIRED_COVERAGE_PAGE_VIEWS.map((tab) => (
                        <option key={tab.id} value={tab.id}>
                          {tab.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </section>
              ) : null}

              <section
                className="required-coverage-settings-block"
                aria-labelledby="required-coverage-subject-heading"
              >
                <h3
                  id="required-coverage-subject-heading"
                  className="required-coverage-card-title"
                >
                  {isMedicalRisk ? '対象' : '万一の対象'}
                </h3>
                <div
                  className="required-coverage-chart-switch"
                  role="group"
                  aria-labelledby="required-coverage-subject-heading"
                >
                  <SubjectSwitchButton
                    active={subject === 'head'}
                    onClick={() =>
                      onChange({
                        ...state,
                        subject: 'head' as RequiredCoverageSubject,
                      })
                    }
                  >
                    {isMedicalRisk
                      ? `${headLabel}が入院・手術`
                      : `${headLabel}に万一`}
                  </SubjectSwitchButton>
                  <SubjectSwitchButton
                    active={subject === 'spouse'}
                    disabled={!hasSpouse}
                    title={
                      hasSpouse ? undefined : '配偶者が登録されていません'
                    }
                    onClick={() =>
                      onChange({
                        ...state,
                        subject: 'spouse' as RequiredCoverageSubject,
                      })
                    }
                  >
                    {isMedicalRisk
                      ? `${spouseLabel}が入院・手術`
                      : `${spouseLabel}に万一`}
                  </SubjectSwitchButton>
                </div>
              </section>

              {!isMedicalRisk ? (
                <section
                  className="required-coverage-settings-block"
                  aria-labelledby="required-coverage-horizon-heading"
                >
                  <h3
                    id="required-coverage-horizon-heading"
                    className="required-coverage-card-title"
                  >
                    保障が必要な期間
                  </h3>
                  <div className="required-coverage-horizon-select-row">
                    <select
                      id="required-coverage-horizon-kind"
                      className="select-input select-input--wide"
                      value={state.kind}
                      aria-labelledby="required-coverage-horizon-heading"
                      onChange={(event) =>
                        handleKindChange(
                          event.target.value as RequiredCoverageHorizonKind,
                        )
                      }
                    >
                      {result.horizons.map((row) => {
                        const suffix =
                          row.available && row.end
                            ? `（${formatCoverageYearMonth(row.end)}）`
                            : '（該当なし）';
                        return (
                          <option key={row.kind} value={row.kind}>
                            {row.label}
                            {suffix}
                          </option>
                        );
                      })}
                      <option value={REQUIRED_COVERAGE_CUSTOM_OPTION.kind}>
                        {REQUIRED_COVERAGE_CUSTOM_OPTION.label}
                      </option>
                    </select>
                  </div>

                  {state.kind === 'custom' ? (
                    <div className="required-coverage-custom-end">
                      <div className="required-coverage-custom-end-fields">
                        <select
                          className="select-input select-input--compact"
                          value={customYear}
                          aria-label="保障終了年"
                          onChange={(event) =>
                            onChange({
                              ...state,
                              customEndYear: Number(event.target.value),
                              customEndMonth: customMonth,
                            })
                          }
                        >
                          {customYearOptions.map((year) => (
                            <option key={year} value={year}>
                              {year}年
                            </option>
                          ))}
                        </select>
                        <span className="required-coverage-custom-end-slash">
                          /
                        </span>
                        <select
                          className="select-input select-input--compact"
                          value={customMonth}
                          aria-label="保障終了月"
                          onChange={(event) =>
                            onChange({
                              ...state,
                              customEndYear: customYear,
                              customEndMonth: Number(event.target.value),
                            })
                          }
                        >
                          {MONTHS.map((month) => (
                            <option key={month} value={month}>
                              {month}月
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : null}
            </div>
          </div>
        </aside>

        <main
          className="required-coverage-main"
          aria-label={isMedicalRisk ? '手術・入院の試算' : '試算結果'}
        >
          {isMedicalRisk ? (
            <div className="required-coverage-body">
              <RequiredCoverageMedicalRiskView
                cashFlowInput={cashFlowInput}
                state={state}
                subject={subject}
                subjectLabel={subjectLabel}
                onChange={onChange}
              />
            </div>
          ) : (
            <>
              <header className="required-coverage-main-header">
                <nav
                  className="required-coverage-section-tabs"
                  aria-label={showDetail ? '詳細の画面' : '簡易の画面'}
                >
                  {REQUIRED_COVERAGE_DETAIL_SECTIONS.map((item) => (
                    <TabButton
                      key={item.id}
                      className="required-coverage-section-tab"
                      active={detailPane === item.id}
                      onClick={() => setDetailPane(item.id)}
                    >
                      {item.label}
                    </TabButton>
                  ))}
                  <TabButton
                    className="required-coverage-section-tab"
                    active={!showForm}
                    onClick={() => setDetailPane(chartView)}
                  >
                    グラフ
                  </TabButton>
                </nav>
              </header>

              <div className="required-coverage-body">
                {showForm ? (
                  <>
                    <div className="required-coverage-detail-forms">
                      {showExpenseForm ? (
                        showDetail ? (
                          <RequiredCoverageExpenseDesign
                            cashFlowInput={cashFlowInput}
                            result={result}
                            state={state}
                            subject={subject}
                            onChange={onChange}
                          />
                        ) : (
                          <section
                            className="required-coverage-card"
                            aria-labelledby="required-coverage-living-rate-heading"
                          >
                            <h3
                              id="required-coverage-living-rate-heading"
                              className="required-coverage-card-title"
                            >
                              生活費の残す割合
                            </h3>
                            <p className="required-coverage-card-note">
                              万一後も続く生活費を、いまの家計の何割残すかで指定します。
                            </p>
                            <CoverageRateControls
                              included={livingDesign.included}
                              ratePct={livingDesign.ratePct}
                              ariaLabel="生活費の残す割合"
                              onRatePct={(ratePct) =>
                                onChange(
                                  patchCoverageLivingRateFromSimpleDesign(
                                    state,
                                    subject,
                                    ratePct,
                                  ),
                                )
                              }
                            />
                          </section>
                        )
                      ) : (
                        <RequiredCoverageWorkDesign
                          cashFlowInput={cashFlowInput}
                          result={result}
                          state={state}
                          subject={subject}
                          onChange={onChange}
                          readonly={!showDetail}
                        />
                      )}
                    </div>
                    {result.chartPoints.length > 0 ? (
                      <RequiredCoverageCategoryCharts
                        key={`category-${chartKey}-${detailPane}-${effectivePageView}`}
                        kind={showExpenseForm ? 'expense' : 'income'}
                        points={result.chartPoints}
                        hasSpouse={hasSpouse}
                      />
                    ) : null}
                  </>
                ) : null}

                {!showForm ? (
                  <>
                    <nav
                      className="required-coverage-chart-switch"
                      aria-label="グラフの種類"
                    >
                      {REQUIRED_COVERAGE_CHART_VIEWS.map((item) => (
                        <TabButton
                          key={item.id}
                          className="required-coverage-chart-switch-tab"
                          active={activeChartView === item.id}
                          onClick={() => {
                            setChartView(item.id);
                            setDetailPane(item.id);
                          }}
                        >
                          {item.label}
                        </TabButton>
                      ))}
                    </nav>
                    {needChart}
                    {activeChartView === 'yearNet' &&
                    result.chartPoints.length > 0 ? (
                      <RequiredCoverageYearNetChart
                        key={`year-net-${chartKey}`}
                        points={result.chartPoints}
                        hasSpouse={hasSpouse}
                      />
                    ) : null}
                    {result.chartPoints.length === 0 ? (
                      <p className="required-coverage-main-empty">
                        保障期間を選ぶと、ここにグラフが表示されます。
                      </p>
                    ) : null}
                  </>
                ) : null}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
