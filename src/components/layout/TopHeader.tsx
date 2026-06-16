import { ASSET_BUILDING_TABS, type AssetBuildingTabId } from '../../types/assetBuildingTabs';
import { HEADER_TABS, type HeaderTabId } from '../../types/headerTabs';

interface TopHeaderProps {
  activeTab: HeaderTabId;
  onTabChange: (tab: HeaderTabId) => void;
  analysisUnlocked?: boolean;
  assetBuildingTab?: AssetBuildingTabId;
  onAssetBuildingTabChange?: (tab: AssetBuildingTabId) => void;
  showAssetBuildingSubTabs?: boolean;
}

function isHeaderTabEnabled(tabId: HeaderTabId, analysisUnlocked: boolean): boolean {
  return tabId === 'input' || analysisUnlocked;
}

export function TopHeader({
  activeTab,
  onTabChange,
  analysisUnlocked = false,
  assetBuildingTab = 'simulation',
  onAssetBuildingTabChange,
  showAssetBuildingSubTabs = false,
}: TopHeaderProps) {
  const showSubTabs =
    activeTab === 'asset-building' &&
    showAssetBuildingSubTabs &&
    onAssetBuildingTabChange != null;

  return (
    <header
      className={`top-header${showSubTabs ? ' top-header--with-subtabs' : ''}`}
    >
      <div className="top-header-main">
        <h1 className="top-header-title">LIFE PLAN</h1>
        <nav className="top-header-tabs" aria-label="メインナビゲーション">
          {HEADER_TABS.map((tab) => {
            const enabled = isHeaderTabEnabled(tab.id, analysisUnlocked);

            return (
              <button
                key={tab.id}
                type="button"
                className={`top-header-tab${activeTab === tab.id ? ' active' : ''}`}
                disabled={!enabled}
                aria-disabled={!enabled}
                onClick={() => enabled && onTabChange(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {showSubTabs && (
        <div className="top-header-subtabs-wrap">
          <nav
            className="top-header-subtabs"
            role="tablist"
            aria-label="資産形成の表示切替"
          >
            {ASSET_BUILDING_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`asset-building-tab-${tab.id}`}
                aria-selected={assetBuildingTab === tab.id}
                aria-controls={`asset-building-panel-${tab.id}`}
                className={`top-header-subtab${assetBuildingTab === tab.id ? ' active' : ''}`}
                onClick={() => onAssetBuildingTabChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
