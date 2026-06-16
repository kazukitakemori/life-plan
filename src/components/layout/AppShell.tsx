import type { ReactNode } from 'react';
import type { AssetBuildingTabId } from '../../types/assetBuildingTabs';
import type { HeaderTabId } from '../../types/headerTabs';
import type { StepId } from '../../types/steps';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';

interface AppShellProps {
  activeStep: StepId;
  onStepChange: (step: StepId) => void;
  onAnalyze?: () => void;
  activeHeaderTab: HeaderTabId;
  onHeaderTabChange: (tab: HeaderTabId) => void;
  analysisUnlocked?: boolean;
  assetBuildingTab?: AssetBuildingTabId;
  onAssetBuildingTabChange?: (tab: AssetBuildingTabId) => void;
  showAssetBuildingSubTabs?: boolean;
  children: ReactNode;
}

export function AppShell({
  activeStep,
  onStepChange,
  onAnalyze,
  activeHeaderTab,
  onHeaderTabChange,
  analysisUnlocked,
  assetBuildingTab,
  onAssetBuildingTabChange,
  showAssetBuildingSubTabs,
  children,
}: AppShellProps) {
  const showSidebar = activeHeaderTab === 'input';

  return (
    <div className="shell">
      <TopHeader
        activeTab={activeHeaderTab}
        onTabChange={onHeaderTabChange}
        analysisUnlocked={analysisUnlocked}
        assetBuildingTab={assetBuildingTab}
        onAssetBuildingTabChange={onAssetBuildingTabChange}
        showAssetBuildingSubTabs={showAssetBuildingSubTabs}
      />
      <div className="shell-body">
        {showSidebar && (
          <Sidebar
            activeStep={activeStep}
            onStepChange={onStepChange}
            onAnalyze={onAnalyze}
          />
        )}
        <main className="shell-main">{children}</main>
      </div>
    </div>
  );
}
