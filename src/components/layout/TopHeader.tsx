import { useEffect, useRef, useState } from 'react';

import { ADMIN_TABS, type AdminTabId } from '../../types/adminTabs';
import { ASSET_BUILDING_TABS, type AssetBuildingTabId } from '../../types/assetBuildingTabs';
import { HEADER_TABS, type HeaderTabId } from '../../types/headerTabs';
import {
  REQUIRED_COVERAGE_RISK_KINDS,
  type RequiredCoverageRiskKind,
} from '../../types/requiredCoverage';
import {
  formatPlanDisplayName,
  getPlanStatusLabel,
  type PlanStatus,
} from '../../types/plan';

export type AutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface TopHeaderProps {
  activeTab: HeaderTabId;
  onTabChange: (tab: HeaderTabId) => void;
  analysisUnlocked?: boolean;
  /** 分析なしでも必要保障額タブを開ける（手術・入院目的） */
  requiredCoverageUnlocked?: boolean;
  /** 必要保障額サブメニューに出すリスク種別（省略時は両方） */
  requiredCoverageRiskKinds?: RequiredCoverageRiskKind[];
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
}

function isHeaderTabEnabled(
  tabId: HeaderTabId,
  analysisUnlocked: boolean,
  requiredCoverageUnlocked: boolean,
  hasOpenPlan: boolean,
): boolean {
  if (tabId === 'admin') return true;
  if (tabId === 'input') return hasOpenPlan;
  if (tabId === 'required-coverage') {
    return analysisUnlocked || requiredCoverageUnlocked;
  }
  return analysisUnlocked;
}

function autosaveLabel(status: AutosaveStatus): string {
  switch (status) {
    case 'pending':
      return '未保存の変更あり';
    case 'saving':
      return '保存中…';
    case 'saved':
      return '保存済み';
    case 'error':
      return '保存に失敗';
    default:
      return '保存済み';
  }
}

export function TopHeader({
  activeTab,
  onTabChange,
  analysisUnlocked = false,
  requiredCoverageUnlocked = false,
  requiredCoverageRiskKinds = REQUIRED_COVERAGE_RISK_KINDS.map((k) => k.id),
  hasOpenPlan = false,
  customerName = '',
  planStatus = 'in_progress',
  autosaveStatus = 'idle',
  showHonorific = false,
  adminTab = 'plans',
  onAdminTabChange,
  assetBuildingTab = 'simulation',
  onAssetBuildingTabChange,
  requiredCoverageRiskKind = 'death',
  onRequiredCoverageRiskKindChange,
}: TopHeaderProps) {
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [assetMenuOpen, setAssetMenuOpen] = useState(false);
  const [coverageMenuOpen, setCoverageMenuOpen] = useState(false);
  const adminMenuRef = useRef<HTMLDivElement>(null);
  const assetMenuRef = useRef<HTMLDivElement>(null);
  const coverageMenuRef = useRef<HTMLDivElement>(null);
  const coverageUnlocked = analysisUnlocked || requiredCoverageUnlocked;
  const coverageKinds = REQUIRED_COVERAGE_RISK_KINDS.filter((k) =>
    requiredCoverageRiskKinds.includes(k.id),
  );
  const showAdminMenu = onAdminTabChange != null;
  const showAssetMenu =
    analysisUnlocked && onAssetBuildingTabChange != null;
  const showCoverageMenu =
    coverageUnlocked && onRequiredCoverageRiskKindChange != null;

  useEffect(() => {
    if (!adminMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (adminMenuRef.current?.contains(target)) return;
      setAdminMenuOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [adminMenuOpen]);

  useEffect(() => {
    if (!assetMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (assetMenuRef.current?.contains(target)) return;
      setAssetMenuOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [assetMenuOpen]);

  useEffect(() => {
    if (!coverageMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (coverageMenuRef.current?.contains(target)) return;
      setCoverageMenuOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [coverageMenuOpen]);

  const handleAdminClick = () => {
    if (!showAdminMenu) {
      onTabChange('admin');
      return;
    }
    onTabChange('admin');
    setAdminMenuOpen(true);
  };

  const handleAdminSubClick = (id: AdminTabId) => {
    onTabChange('admin');
    onAdminTabChange?.(id);
    setAdminMenuOpen(false);
  };

  const handleAssetClick = () => {
    if (!showAssetMenu) return;
    onTabChange('asset-building');
    setAssetMenuOpen(true);
  };

  const handleAssetSubClick = (id: AssetBuildingTabId) => {
    onTabChange('asset-building');
    onAssetBuildingTabChange?.(id);
    setAssetMenuOpen(false);
  };

  const handleCoverageClick = () => {
    if (!coverageUnlocked) return;
    onTabChange('required-coverage');
    if (showCoverageMenu && coverageKinds.length > 1) {
      setCoverageMenuOpen(true);
    }
  };

  const handleCoverageSubClick = (id: RequiredCoverageRiskKind) => {
    onTabChange('required-coverage');
    onRequiredCoverageRiskKindChange?.(id);
    setCoverageMenuOpen(false);
  };

  return (
    <header className="top-header">
      <div className="top-header-primary">
        <div className="top-header-brand">
          <h1 className="top-header-title">LIFE PLAN</h1>
          {activeTab !== 'admin' && hasOpenPlan ? (
            <div className="top-header-context" aria-live="polite">
              <span className="top-header-customer">
                {formatPlanDisplayName(customerName, { honorific: showHonorific })}
              </span>
              <span
                className={`top-header-status-badge top-header-status-badge--${planStatus}`}
              >
                {getPlanStatusLabel(planStatus)}
              </span>
              <span
                className={`top-header-autosave top-header-autosave--${autosaveStatus}`}
              >
                {autosaveLabel(autosaveStatus)}
              </span>
            </div>
          ) : activeTab === 'admin' && !hasOpenPlan ? (
            <p className="top-header-hint">
              管理タブでプランを作成・開くと入力できます
            </p>
          ) : null}
        </div>
        <nav className="top-header-nav" aria-label="メインナビゲーション">
          {HEADER_TABS.map((tab) => {
            const enabled = isHeaderTabEnabled(
              tab.id,
              analysisUnlocked,
              requiredCoverageUnlocked,
              hasOpenPlan,
            );
            const inputLockedHint =
              tab.id === 'input' && !hasOpenPlan
                ? '管理からプランを開くと入力できます'
                : undefined;
            const isActive = activeTab === tab.id;

            if (tab.id === 'admin' && showAdminMenu) {
              return (
                <div
                  key={tab.id}
                  ref={adminMenuRef}
                  className={`top-header-nav-item-wrap${isActive ? ' active' : ''}${adminMenuOpen ? ' is-open' : ''}`}
                  onMouseEnter={() => setAdminMenuOpen(true)}
                  onMouseLeave={() => setAdminMenuOpen(false)}
                >
                  <button
                    type="button"
                    className={`top-header-nav-item has-submenu${isActive ? ' active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                    aria-expanded={adminMenuOpen}
                    aria-haspopup="true"
                    onClick={handleAdminClick}
                  >
                    {tab.label}
                    <span className="top-header-nav-chevron" aria-hidden />
                  </button>
                  <div className="top-header-dropdown" role="menu">
                    {ADMIN_TABS.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        role="menuitem"
                        className={`top-header-dropdown-item${adminTab === sub.id && isActive ? ' active' : ''}`}
                        onClick={() => handleAdminSubClick(sub.id)}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            }

            if (tab.id === 'asset-building' && showAssetMenu) {
              return (
                <div
                  key={tab.id}
                  ref={assetMenuRef}
                  className={`top-header-nav-item-wrap${isActive ? ' active' : ''}${assetMenuOpen ? ' is-open' : ''}`}
                  onMouseEnter={() => setAssetMenuOpen(true)}
                  onMouseLeave={() => setAssetMenuOpen(false)}
                >
                  <button
                    type="button"
                    className={`top-header-nav-item has-submenu${isActive ? ' active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                    aria-expanded={assetMenuOpen}
                    aria-haspopup="true"
                    onClick={handleAssetClick}
                  >
                    {tab.label}
                    <span className="top-header-nav-chevron" aria-hidden />
                  </button>
                  <div className="top-header-dropdown" role="menu">
                    {ASSET_BUILDING_TABS.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        role="menuitem"
                        className={`top-header-dropdown-item${assetBuildingTab === sub.id && isActive ? ' active' : ''}`}
                        onClick={() => handleAssetSubClick(sub.id)}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            }

            if (tab.id === 'required-coverage' && coverageUnlocked) {
              if (coverageKinds.length > 1) {
                return (
                  <div
                    key={tab.id}
                    ref={coverageMenuRef}
                    className={`top-header-nav-item-wrap${isActive ? ' active' : ''}${coverageMenuOpen ? ' is-open' : ''}`}
                    onMouseEnter={() => setCoverageMenuOpen(true)}
                    onMouseLeave={() => setCoverageMenuOpen(false)}
                  >
                    <button
                      type="button"
                      className={`top-header-nav-item has-submenu${isActive ? ' active' : ''}`}
                      aria-current={isActive ? 'page' : undefined}
                      aria-expanded={coverageMenuOpen}
                      aria-haspopup="true"
                      onClick={handleCoverageClick}
                    >
                      {tab.label}
                      <span className="top-header-nav-chevron" aria-hidden />
                    </button>
                    <div className="top-header-dropdown" role="menu">
                      {coverageKinds.map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          role="menuitem"
                          className={`top-header-dropdown-item${requiredCoverageRiskKind === sub.id && isActive ? ' active' : ''}`}
                          onClick={() => handleCoverageSubClick(sub.id)}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`top-header-nav-item${isActive ? ' active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => {
                    const only = coverageKinds[0]?.id;
                    if (only) onRequiredCoverageRiskKindChange?.(only);
                    onTabChange('required-coverage');
                  }}
                >
                  {tab.label}
                </button>
              );
            }

            return (
              <button
                key={tab.id}
                type="button"
                className={`top-header-nav-item${isActive ? ' active' : ''}`}
                disabled={!enabled}
                aria-disabled={!enabled}
                aria-current={isActive ? 'page' : undefined}
                title={inputLockedHint}
                onClick={() => enabled && onTabChange(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
