import { useEffect, useRef, useState } from 'react';

import { ASSET_BUILDING_TABS, type AssetBuildingTabId } from '../../types/assetBuildingTabs';
import type { CashFlowTableData } from '../../types/cashFlow';
import type { ContentCaptureDisplayState } from '../../lib/contentCaptureRuntime';
import type { EducationByMember } from '../../types/education';
import type { FamilyMember } from '../../types/family';
import type { IncomeByMember, PriorYearIncomeByMember } from '../../types/income';
import type { LifeEventState } from '../../types/lifeEvent';
import type { LivingExpenseState } from '../../types/living';
import type { PensionByMember } from '../../types/pension';
import type { SecondLifeState } from '../../types/secondLife';
import { CashFlowTableView } from '../analysis/CashFlowTableView';
import { AssetBuildingChartsPanel } from './AssetBuildingChartsPanel';
import {
  AssetBuildingSelectMenu,
  AssetBuildingTitleRow,
} from './AssetBuildingSelectMenu';
import {
  ASSET_CHART_AGGREGATION_OPTIONS,
  type AssetChartAggregation,
} from './assetBuildingChartShared';
import {
  LifetimeSimulationPanel,
  SIMULATION_BELOW_CHART_VIEWS,
  type SimulationBelowChartView,
} from './LifetimeSimulationPanel';

interface AssetBuildingViewProps {
  data: CashFlowTableData;
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  priorYearIncomeByMember: PriorYearIncomeByMember;
  livingState: LivingExpenseState;
  educationByMember: EducationByMember;
  lifeEventState: LifeEventState;
  pensionByMember: PensionByMember;
  referenceDate: Date;
  secondLifeState?: SecondLifeState | null;
  analysisSession: number;
  activeTab: AssetBuildingTabId;
  onTabChange: (tab: AssetBuildingTabId) => void;
  captureDisplayState?: ContentCaptureDisplayState;
}

type OpenMenu = 'tab' | 'below' | 'aggregation' | null;

export function AssetBuildingView({
  data,
  familyMembers,
  incomeByMember,
  priorYearIncomeByMember,
  livingState,
  educationByMember,
  lifeEventState,
  pensionByMember,
  referenceDate,
  secondLifeState = null,
  analysisSession,
  activeTab,
  onTabChange,
  captureDisplayState,
}: AssetBuildingViewProps) {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [belowChartView, setBelowChartView] =
    useState<SimulationBelowChartView>('table');
  const [aggregation, setAggregation] =
    useState<AssetChartAggregation>('year');
  const titleRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab !== 'simulation') {
      setBelowChartView('table');
      setOpenMenu((menu) => (menu === 'below' ? null : menu));
    }
    if (activeTab !== 'income-expense') {
      setOpenMenu((menu) => (menu === 'aggregation' ? null : menu));
    }
  }, [activeTab]);

  useEffect(() => {
    if (openMenu == null) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (titleRowRef.current?.contains(target)) return;
      setOpenMenu(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenu]);

  return (
    <div className="asset-building-page">
      {openMenu != null ? (
        <button
          type="button"
          className="asset-building-title-scrim"
          aria-label="メニューを閉じる"
          onClick={() => setOpenMenu(null)}
        />
      ) : null}
      <AssetBuildingTitleRow rowRef={titleRowRef}>
        <AssetBuildingSelectMenu
          value={activeTab}
          options={ASSET_BUILDING_TABS.map((tab) => ({
            id: tab.id,
            label: tab.label,
          }))}
          open={openMenu === 'tab'}
          onOpenChange={(open) => setOpenMenu(open ? 'tab' : null)}
          onChange={onTabChange}
          ariaLabel="資産形成の表示切替"
          fallbackLabel="資産形成"
        />

        {activeTab === 'simulation' ? (
          <AssetBuildingSelectMenu
            value={belowChartView}
            options={SIMULATION_BELOW_CHART_VIEWS}
            open={openMenu === 'below'}
            onOpenChange={(open) => setOpenMenu(open ? 'below' : null)}
            onChange={setBelowChartView}
            ariaLabel="グラフ下の表示切替"
            secondary
            fallbackLabel="収支サマリー"
          />
        ) : null}

        {activeTab === 'income-expense' ? (
          <AssetBuildingSelectMenu
            value={aggregation}
            options={ASSET_CHART_AGGREGATION_OPTIONS}
            open={openMenu === 'aggregation'}
            onOpenChange={(open) => setOpenMenu(open ? 'aggregation' : null)}
            onChange={setAggregation}
            ariaLabel="単年・累計の切替"
            secondary
            fallbackLabel="単年"
          />
        ) : null}
      </AssetBuildingTitleRow>

      <div className="asset-building-panel-wrap">
        {activeTab === 'simulation' && (
          <div
            role="tabpanel"
            id="asset-building-panel-simulation"
            aria-labelledby="asset-building-tab-simulation"
            className="asset-building-panel"
            data-content-capture-target="lifetime-balance"
          >
            <LifetimeSimulationPanel
              cashFlowData={data}
              familyMembers={familyMembers}
              incomeByMember={incomeByMember}
              livingState={livingState}
              educationByMember={educationByMember}
              lifeEventState={lifeEventState}
              pensionByMember={pensionByMember}
              referenceDate={referenceDate}
              secondLifeState={secondLifeState}
              showHeader={false}
              belowChartView={belowChartView}
              onBelowChartViewChange={setBelowChartView}
              captureStartAge={captureDisplayState?.startAge}
            />
          </div>
        )}

        {activeTab === 'income-expense' && (
          <div
            role="tabpanel"
            id="asset-building-panel-income-expense"
            aria-labelledby="asset-building-tab-income-expense"
            className="asset-building-panel"
          >
            <AssetBuildingChartsPanel
              cashFlowData={data}
              group="income-expense"
              aggregation={aggregation}
            />
          </div>
        )}

        {activeTab === 'savings-assets' && (
          <div
            role="tabpanel"
            id="asset-building-panel-savings-assets"
            aria-labelledby="asset-building-tab-savings-assets"
            className="asset-building-panel"
          >
            <AssetBuildingChartsPanel
              cashFlowData={data}
              group="savings-assets"
            />
          </div>
        )}

        {activeTab === 'cashflow' && (
          <div
            role="tabpanel"
            id="asset-building-panel-cashflow"
            aria-labelledby="asset-building-tab-cashflow"
            className="asset-building-panel"
            data-content-capture-target="cash-flow-table"
          >
            <CashFlowTableView
              key={analysisSession}
              data={data}
              showBackButton={false}
              showTitle={false}
              captureStartAge={captureDisplayState?.startAge}
              captureDisplayRange={captureDisplayState?.displayRange}
              taxSocialBreakdown={{
                members: familyMembers,
                incomeByMember,
                priorYearIncomeByMember,
                pensionByMember,
                referenceDate,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
