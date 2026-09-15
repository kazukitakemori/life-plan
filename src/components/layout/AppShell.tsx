import { useEffect, useState, type ReactNode } from 'react';
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
  undoAvailable?: boolean;
  redoAvailable?: boolean;
  undoBusy?: boolean;
  onUndo?: () => void | Promise<void>;
  onRedo?: () => void | Promise<void>;
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
    undoAvailable = false,
    redoAvailable = false,
    undoBusy = false,
    onUndo,
    onRedo,
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
  const [undoQueued, setUndoQueued] = useState(false);
  const [redoQueued, setRedoQueued] = useState(false);
  const showSidebar = activeHeaderTab === 'input';
  const showStatusBanner =
    showAnalysisStaleBanner &&
    activeHeaderTab !== 'admin' &&
    analysisStale &&
    !isAnalyzing;
  const autosaveBusy = autosaveStatus === 'pending' || autosaveStatus === 'saving';
  const historyWaiting = undoBusy || undoQueued || redoQueued;

  const requestUndo = () => {
    if (!onUndo || !undoAvailable || historyWaiting) return;
    if (autosaveBusy) {
      setUndoQueued(true);
      return;
    }
    void onUndo();
  };

  const requestRedo = () => {
    if (!onRedo || !redoAvailable || historyWaiting) return;
    if (autosaveBusy) {
      setRedoQueued(true);
      return;
    }
    void onRedo();
  };

  useEffect(() => {
    if (!undoQueued || autosaveBusy || !onUndo) return;
    setUndoQueued(false);
    void onUndo();
  }, [undoQueued, autosaveBusy, onUndo]);

  useEffect(() => {
    if (!redoQueued || autosaveBusy || !onRedo) return;
    setRedoQueued(false);
    void onRedo();
  }, [redoQueued, autosaveBusy, onRedo]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((!event.ctrlKey && !event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      const isUndoShortcut = !event.shiftKey && key === 'z';
      const isRedoShortcut = event.shiftKey && key === 'z';

      if (isUndoShortcut && undoAvailable && !historyWaiting && onUndo) {
        event.preventDefault();
        requestUndo();
        return;
      }

      if (isRedoShortcut && redoAvailable && !historyWaiting && onRedo) {
        event.preventDefault();
        requestRedo();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    undoAvailable,
    redoAvailable,
    historyWaiting,
    autosaveBusy,
    onUndo,
    onRedo,
  ]);

  const handleStepChange = (step: StepId) => {
    onStepChange(step);
    setMobileSidebarOpen(false);
  };

  return (
    <div
      ref={shellRef}
      className={`shell ${mobileSidebarOpen ? 'mobile-sidebar-open' : ''}`}
    >
      <div className="shell-top-region">
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
        <div className="shell-history-controls" aria-label="操作履歴">
          <button
            type="button"
            className="shell-history-button"
            onClick={requestUndo}
            disabled={!undoAvailable || historyWaiting}
            aria-label={undoQueued ? '保存後に元に戻します' : '直前の操作を元に戻す'}
            aria-keyshortcuts="Control+Z Meta+Z"
            aria-busy={undoQueued || undefined}
            title={undoQueued ? '保存後に元に戻します' : '元に戻す（Ctrl/⌘ + Z）'}
          >
            <span className="shell-history-icon" aria-hidden="true">↶</span>
          </button>
          <button
            type="button"
            className="shell-history-button"
            onClick={requestRedo}
            disabled={!redoAvailable || historyWaiting}
            aria-label={redoQueued ? '保存後にやり直します' : '元に戻した操作をやり直す'}
            aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z"
            aria-busy={redoQueued || undefined}
            title={redoQueued ? '保存後にやり直します' : 'やり直す（Ctrl/⌘ + Shift + Z）'}
          >
            <span className="shell-history-icon" aria-hidden="true">↷</span>
          </button>
        </div>
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
