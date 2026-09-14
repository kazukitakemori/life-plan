import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AdminTabId } from '../../types/adminTabs';
import type { AssetBuildingTabId } from '../../types/assetBuildingTabs';
import type { HeaderTabId } from '../../types/headerTabs';
import type { PlanStatus } from '../../types/plan';
import type { RequiredCoverageRiskKind } from '../../types/requiredCoverage';
import type { StepId } from '../../types/steps';
import { AnalysisStatusBanner } from '../shared/AnalysisStatusBanner';
import { RequiredCoverageReadyBanner } from '../shared/RequiredCoverageReadyBanner';
import {
  ShellFullscreenProvider,
  useShellFullscreen,
} from './ShellFullscreenContext';
import { Sidebar } from './Sidebar';
import { TopHeader, type AutosaveStatus } from './TopHeader';
import './AppShellNavigation.css';

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
  isLicensed?: boolean;
  adminTab?: AdminTabId;
  onAdminTabChange?: (tab: AdminTabId) => void;
  assetBuildingTab?: AssetBuildingTabId;
  onAssetBuildingTabChange?: (tab: AssetBuildingTabId) => void;
  requiredCoverageRiskKind?: RequiredCoverageRiskKind;
  onRequiredCoverageRiskKindChange?: (kind: RequiredCoverageRiskKind) => void;
  children: ReactNode;
}

interface ShellNavigationState {
  headerTab: HeaderTabId;
  activeStep?: StepId;
  adminTab?: AdminTabId;
  assetBuildingTab?: AssetBuildingTabId;
  requiredCoverageRiskKind?: RequiredCoverageRiskKind;
}

const MAX_NAVIGATION_HISTORY = 50;

function isSameNavigationState(
  left: ShellNavigationState,
  right: ShellNavigationState,
): boolean {
  return (
    left.headerTab === right.headerTab &&
    left.activeStep === right.activeStep &&
    left.adminTab === right.adminTab &&
    left.assetBuildingTab === right.assetBuildingTab &&
    left.requiredCoverageRiskKind === right.requiredCoverageRiskKind
  );
}

function AppShellFrame(props: AppShellProps) {
  const {
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
    isLicensed = false,
    adminTab,
    onAdminTabChange,
    assetBuildingTab,
    onAssetBuildingTabChange,
    requiredCoverageRiskKind,
    onRequiredCoverageRiskKindChange,
    children,
  } = props;

  const { shellRef } = useShellFullscreen();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const navigationHistoryRef = useRef<ShellNavigationState[]>([]);
  const previousNavigationRef = useRef<ShellNavigationState | null>(null);
  const restoringNavigationRef = useRef<ShellNavigationState | null>(null);
  const showSidebar = activeHeaderTab === 'input';
  const showStatusBanner =
    showAnalysisStaleBanner &&
    activeHeaderTab !== 'admin' &&
    analysisStale &&
    !isAnalyzing;

  const currentNavigation: ShellNavigationState = {
    headerTab: activeHeaderTab,
    activeStep: activeHeaderTab === 'input' ? activeStep : undefined,
    adminTab: activeHeaderTab === 'admin' ? adminTab : undefined,
    assetBuildingTab:
      activeHeaderTab === 'asset-building' ? assetBuildingTab : undefined,
    requiredCoverageRiskKind:
      activeHeaderTab === 'required-coverage'
        ? requiredCoverageRiskKind
        : undefined,
  };

  const isNavigationStateAvailable = (state: ShellNavigationState): boolean => {
    if (state.headerTab === 'admin') {
      return isLicensed || state.adminTab === 'license' || state.adminTab == null;
    }
    if (state.headerTab === 'input') {
      return Boolean(hasOpenPlan) &&
        (state.activeStep == null || enabledSteps.includes(state.activeStep));
    }
    if (state.headerTab === 'required-coverage') {
      if (!(analysisUnlocked || requiredCoverageUnlocked)) return false;
      return (
        state.requiredCoverageRiskKind == null ||
        requiredCoverageRiskKinds == null ||
        requiredCoverageRiskKinds.includes(state.requiredCoverageRiskKind)
      );
    }
    return Boolean(analysisUnlocked);
  };

  const refreshCanGoBack = () => {
    setCanGoBack(
      navigationHistoryRef.current.some((state) =>
        isNavigationStateAvailable(state),
      ),
    );
  };

  useEffect(() => {
    const previous = previousNavigationRef.current;
    if (previous == null) {
      previousNavigationRef.current = currentNavigation;
      return;
    }

    if (isSameNavigationState(previous, currentNavigation)) return;

    const restoring = restoringNavigationRef.current;
    if (restoring != null) {
      if (isSameNavigationState(restoring, currentNavigation)) {
        restoringNavigationRef.current = null;
        previousNavigationRef.current = currentNavigation;
      }
      return;
    }

    navigationHistoryRef.current.push(previous);
    if (navigationHistoryRef.current.length > MAX_NAVIGATION_HISTORY) {
      navigationHistoryRef.current.shift();
    }
    previousNavigationRef.current = currentNavigation;
    refreshCanGoBack();
  }, [
    activeHeaderTab,
    activeStep,
    adminTab,
    assetBuildingTab,
    requiredCoverageRiskKind,
  ]);

  useEffect(() => {
    refreshCanGoBack();
  }, [
    analysisUnlocked,
    requiredCoverageUnlocked,
    hasOpenPlan,
    isLicensed,
    enabledSteps,
    requiredCoverageRiskKinds,
  ]);

  const handleStepChange = (step: StepId) => {
    onStepChange(step);
    setMobileSidebarOpen(false);
  };

  const handleGoBack = () => {
    let target: ShellNavigationState | undefined;
    while (navigationHistoryRef.current.length > 0) {
      const candidate = navigationHistoryRef.current.pop();
      if (candidate != null && isNavigationStateAvailable(candidate)) {
        target = candidate;
        break;
      }
    }

    refreshCanGoBack();
    if (target == null) return;

    restoringNavigationRef.current = target;

    if (target.headerTab === 'input' && target.activeStep != null) {
      onStepChange(target.activeStep);
      setMobileSidebarOpen(false);
    }
    if (target.headerTab === 'admin' && target.adminTab != null) {
      onAdminTabChange?.(target.adminTab);
    }
    if (
      target.headerTab === 'asset-building' &&
      target.assetBuildingTab != null
    ) {
      onAssetBuildingTabChange?.(target.assetBuildingTab);
    }
    if (
      target.headerTab === 'required-coverage' &&
      target.requiredCoverageRiskKind != null
    ) {
      onRequiredCoverageRiskKindChange?.(target.requiredCoverageRiskKind);
    }

    onHeaderTabChange(target.headerTab);
  };

  return (
    <div
      ref={shellRef}
      className={`shell ${mobileSidebarOpen ? 'mobile-sidebar-open' : ''}`}
    >
      <TopHeader
        activeTab={activeHeaderTab}
        onTabChange={(tab) => {
          setMobileSidebarOpen(false);
          onHeaderTabChange(tab);
        }}
        analysisUnlocked={analysisUnlocked}
        requiredCoverageUnlocked={requiredCoverageUnlocked}
        requiredCoverageRiskKinds={requiredCoverageRiskKinds}
        hasOpenPlan={hasOpenPlan}
        customerName={customerName}
        planStatus={planStatus}
        autosaveStatus={autosaveStatus}
        showHonorific={showHonorific}
        isLicensed={isLicensed}
        adminTab={adminTab}
        onAdminTabChange={onAdminTabChange}
        assetBuildingTab={assetBuildingTab}
        onAssetBuildingTabChange={onAssetBuildingTabChange}
        requiredCoverageRiskKind={requiredCoverageRiskKind}
        onRequiredCoverageRiskKindChange={onRequiredCoverageRiskKindChange}
      />
      <div className="shell-history-bar" aria-label="画面履歴">
        <button
          type="button"
          className="shell-history-back"
          onClick={handleGoBack}
          disabled={!canGoBack}
          aria-label="1つ前の画面に戻る"
        >
          <span className="shell-history-back-icon" aria-hidden="true">←</span>
          <span>1つ前に戻る</span>
        </button>
      </div>
      <div className="shell-body">
        {showSidebar && (
          <>
            <button
              type="button"
              className="mobile-sidebar-toggle"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="入力メニューを開く"
              aria-expanded={mobileSidebarOpen}
            >
              <span aria-hidden="true">☰</span>
              <span>入力メニュー</span>
            </button>
            <button
              type="button"
              className="mobile-sidebar-backdrop"
              aria-label="入力メニューを閉じる"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <Sidebar
              activeStep={activeStep}
              enabledSteps={enabledSteps}
              requiredSteps={requiredSteps}
              showRequiredMarkers={showRequiredStepMarkers}
              onStepChange={handleStepChange}
              onAnalyze={onAnalyze}
              analyzeDisabled={analyzeDisabled}
              showAnalyze={showAnalyze}
            />
          </>
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

export function AppShell(props: AppShellProps) {
  return (
    <ShellFullscreenProvider>
      <AppShellFrame {...props} />
    </ShellFullscreenProvider>
  );
}
