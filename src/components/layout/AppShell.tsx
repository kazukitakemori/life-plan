import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  hasLocalPlanUndo,
  LOCAL_PLAN_UNDO_HISTORY_EVENT,
  undoLastLocalPlanChange,
} from '../../lib/localPlanRepository';
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
import './AppShellUndo.css';

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
    autosaveStatus = 'idle',
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
  const [undoAvailable, setUndoAvailable] = useState(() => hasLocalPlanUndo());
  const [undoBusy, setUndoBusy] = useState(false);
  const autosaveStatusRef = useRef<AutosaveStatus>(autosaveStatus);
  const undoRequestedRef = useRef(false);
  const showSidebar = activeHeaderTab === 'input';
  const showStatusBanner =
    showAnalysisStaleBanner &&
    activeHeaderTab !== 'admin' &&
    analysisStale &&
    !isAnalyzing;

  const refreshUndoAvailability = () => {
    const saving =
      autosaveStatusRef.current === 'pending' ||
      autosaveStatusRef.current === 'saving';
    setUndoAvailable(saving || hasLocalPlanUndo());
  };

  const performUndo = async () => {
    setUndoBusy(true);
    try {
      if (autosaveStatusRef.current === 'error' && !hasLocalPlanUndo()) {
        window.location.reload();
        return;
      }
      const undone = await undoLastLocalPlanChange();
      if (!undone) {
        setUndoBusy(false);
        refreshUndoAvailability();
        return;
      }
      window.location.reload();
    } catch (error) {
      console.error(error);
      setUndoBusy(false);
      refreshUndoAvailability();
      window.alert('操作を元に戻せませんでした。');
    }
  };

  const handleUndo = () => {
    if (undoBusy || !undoAvailable) return;
    const status = autosaveStatusRef.current;
    if (status === 'pending' || status === 'saving') {
      undoRequestedRef.current = true;
      setUndoBusy(true);
      return;
    }
    void performUndo();
  };

  useEffect(() => {
    autosaveStatusRef.current = autosaveStatus;
    refreshUndoAvailability();

    if (
      undoRequestedRef.current &&
      autosaveStatus !== 'pending' &&
      autosaveStatus !== 'saving'
    ) {
      undoRequestedRef.current = false;
      void performUndo();
    }
  }, [autosaveStatus]);

  useEffect(() => {
    const handleHistoryChanged = () => refreshUndoAvailability();
    window.addEventListener(LOCAL_PLAN_UNDO_HISTORY_EVENT, handleHistoryChanged);
    return () =>
      window.removeEventListener(
        LOCAL_PLAN_UNDO_HISTORY_EVENT,
        handleHistoryChanged,
      );
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isUndoShortcut =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'z';
      if (!isUndoShortcut || undoBusy || !undoAvailable) return;
      event.preventDefault();
      handleUndo();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undoAvailable, undoBusy, autosaveStatus]);

  const handleStepChange = (step: StepId) => {
    onStepChange(step);
    setMobileSidebarOpen(false);
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
      <div className="shell-undo-bar" aria-label="操作履歴">
        <button
          type="button"
          className="shell-undo-button"
          onClick={handleUndo}
          disabled={!undoAvailable || undoBusy}
          aria-label="直前の操作を元に戻す"
          aria-keyshortcuts="Control+Z Meta+Z"
          title="直前の操作を元に戻す（Ctrl/⌘ + Z）"
        >
          <span className="shell-undo-icon" aria-hidden="true">↶</span>
          <span>{undoBusy ? '元に戻しています…' : '元に戻す'}</span>
          <span className="shell-undo-shortcut" aria-hidden="true">Ctrl+Z</span>
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
