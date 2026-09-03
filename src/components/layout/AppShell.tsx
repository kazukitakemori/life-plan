import type { ReactNode } from 'react';
import type { AdminTabId } from '../../types/adminTabs';
import type { AssetBuildingTabId } from '../../types/assetBuildingTabs';
import type { HeaderTabId } from '../../types/headerTabs';
import type { PlanStatus } from '../../types/plan';
import type { RequiredCoverageRiskKind } from '../../types/requiredCoverage';
import type { StepId } from '../../types/steps';
import { AnalysisStatusBanner } from '../shared/AnalysisStatusBanner';
import { RequiredCoverageReadyBanner } from '../shared/RequiredCoverageReadyBanner';
import { Sidebar } from './Sidebar';
import { TopHeader, type AutosaveStatus } from './TopHeader';

interface AppShellProps {
  activeStep: StepId;
  enabledSteps: StepId[];
  requiredSteps?: StepId[];
  showRequiredStepMarkers?: boolean;
  onStepChange: (step: StepId) => void;
  onAnalyze?: () => void;
  analyzeDisabled?: boolean;
  showAnalyze?: boolean;
  showAnalysisStaleBanner?: boolean;
  activeHeaderTab: HeaderTabId;
  onHeaderTabChange: (tab: HeaderTabId) => void;
  analysisUnlocked?: boolean;
  requiredCoverageUnlocked?: boolean;
  /** 必須入力完了で必要保障額が開けるとき、入力画面に案内を出す */
  showRequiredCoverageReadyBanner?: boolean;
  requiredCoverageRiskKinds?: RequiredCoverageRiskKind[];
  analysisStale?: boolean;
  isAnalyzing?: boolean;
  hasOpenPlan?: boolean;
  customerName?: string;
  planStatus?: PlanStatus;
  autosaveStatus?: AutosaveStatus;
  showHonorific?: boolean;
  adminTab?: AdminTabId;
  onAdminTabChange?: (tab: AdminTabId) => void;
  assetBuildingTab?: AssetBuildingTabId;
  onAssetBuildingTabChange?: (tab: AssetBuildingTabId) => void;
  requiredCoverageRiskKind?: RequiredCoverageRiskKind;
  onRequiredCoverageRiskKindChange?: (kind: RequiredCoverageRiskKind) => void;
  children: ReactNode;
}

export function AppShell({
  activeStep,
  enabledSteps,
  requiredSteps = [],
  showRequiredStepMarkers = false,
  onStepChange,
  onAnalyze,
  analyzeDisabled,
  showAnalyze = true,
  showAnalysisStaleBanner = true,
  activeHeaderTab,
  onHeaderTabChange,
  analysisUnlocked,
  requiredCoverageUnlocked,
  showRequiredCoverageReadyBanner = false,
  requiredCoverageRiskKinds,
  analysisStale = false,
  isAnalyzing = false,
  hasOpenPlan,
  customerName,
  planStatus,
  autosaveStatus,
  showHonorific,
  adminTab,
  onAdminTabChange,
  assetBuildingTab,
  onAssetBuildingTabChange,
  requiredCoverageRiskKind,
  onRequiredCoverageRiskKindChange,
  children,
}: AppShellProps) {
  const showSidebar = activeHeaderTab === 'input';
  const showStatusBanner =
    showAnalysisStaleBanner &&
    activeHeaderTab !== 'admin' &&
    analysisStale &&
    !isAnalyzing;

  return (
    <div className="shell">
      <TopHeader
        activeTab={activeHeaderTab}
        onTabChange={onHeaderTabChange}
        analysisUnlocked={analysisUnlocked}
        requiredCoverageUnlocked={requiredCoverageUnlocked}
        requiredCoverageRiskKinds={requiredCoverageRiskKinds}
        hasOpenPlan={hasOpenPlan}
        customerName={customerName}
        planStatus={planStatus}
        autosaveStatus={autosaveStatus}
        showHonorific={showHonorific}
        adminTab={adminTab}
        onAdminTabChange={onAdminTabChange}
        assetBuildingTab={assetBuildingTab}
        onAssetBuildingTabChange={onAssetBuildingTabChange}
        requiredCoverageRiskKind={requiredCoverageRiskKind}
        onRequiredCoverageRiskKindChange={onRequiredCoverageRiskKindChange}
      />
      <div className="shell-body">
        {showSidebar && (
          <Sidebar
            activeStep={activeStep}
            enabledSteps={enabledSteps}
            requiredSteps={requiredSteps}
            showRequiredMarkers={showRequiredStepMarkers}
            onStepChange={onStepChange}
            onAnalyze={onAnalyze}
            analyzeDisabled={analyzeDisabled}
            showAnalyze={showAnalyze}
          />
        )}
        <main className="shell-main">
          {showStatusBanner && (
            <AnalysisStatusBanner stale={analysisStale} />
          )}
          {showRequiredCoverageReadyBanner ? (
            <RequiredCoverageReadyBanner />
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
