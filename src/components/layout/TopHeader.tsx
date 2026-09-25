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
import { useShellFullscreen } from './ShellFullscreenContext';

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
  isLicensed?: boolean;
  adminTab?: AdminTabId;
  onAdminTabChange?: (tab: AdminTabId) => void;
  assetBuildingTab?: AssetBuildingTabId;
  onAssetBuildingTabChange?: (tab: AssetBuildingTabId) => void;
  requiredCoverageRiskKind?: RequiredCoverageRiskKind;
  onRequiredCoverageRiskKindChange?: (kind: RequiredCoverageRiskKind) => void;
  operatorPersonalInfoHidden?: boolean;
  onOperatorPersonalInfoHiddenChange?: (hidden: boolean) => void;
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
  isLicensed = false,
  adminTab = 'plans',
  onAdminTabChange,
  assetBuildingTab = 'simulation',
  onAssetBuildingTabChange,
  requiredCoverageRiskKind = 'death',
  onRequiredCoverageRiskKindChange,
  operatorPersonalInfoHidden = false,
  onOperatorPersonalInfoHiddenChange,
}: TopHeaderProps) {
  const { isFullscreen, toggleFullscreen } = useShellFullscreen();
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [assetMenuOpen, setAssetMenuOpen] = useState(false);
  const [coverageMenuOpen, setCoverageMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileExpandedTab, setMobileExpandedTab] = useState<HeaderTabId | null>(null);
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
  const adminTabs = isLicensed
    ? ADMIN_TABS
    : ADMIN_TABS.filter((item) => item.id === 'license');
  const activeTabLabel = HEADER_TABS.find((tab) => tab.id === activeTab)?.label ?? '';

  const anyMenuOpen = adminMenuOpen || assetMenuOpen || coverageMenuOpen;

  const closeAllMenus = () => {
    setAdminMenuOpen(false);
    setAssetMenuOpen(false);
    setCoverageMenuOpen(false);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    setMobileExpandedTab(null);
  };

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

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMobileMenu();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

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
    // ホバーで開閉。クリックでは閉じない（暗転のチカチカ防止）
    if (!showAssetMenu) return;
    setAssetMenuOpen(true);
  };

  const handleAssetSubClick = (id: AssetBuildingTabId) => {
    onTabChange('asset-building');
    onAssetBuildingTabChange?.(id);
    setAssetMenuOpen(false);
  };

  const handleCoverageClick = () => {
    if (!showCoverageMenu || coverageKinds.length === 0) return;
    setCoverageMenuOpen(true);
  };

  const handleCoverageSubClick = (id: RequiredCoverageRiskKind) => {
    onTabChange('required-coverage');
    onRequiredCoverageRiskKindChange?.(id);
    setCoverageMenuOpen(false);
  };

  const openMobileMenu = () => {
    setMobileMenuOpen(true);
    if (
      activeTab === 'admin' ||
      activeTab === 'asset-building' ||
      activeTab === 'required-coverage'
    ) {
      setMobileExpandedTab(activeTab);
    } else {
      setMobileExpandedTab(null);
    }
  };

  const handleMobileTabClick = (tabId: HeaderTabId) => {
    const enabled = isHeaderTabEnabled(
      tabId,
      analysisUnlocked,
      requiredCoverageUnlocked,
      hasOpenPlan,
    );
    if (!enabled) return;

    if (tabId === 'admin' && adminTabs.length === 1) {
      onAdminTabChange?.(adminTabs[0].id);
    }
    onTabChange(tabId);
    closeMobileMenu();
  };

  const renderMobileSubmenu = (tabId: HeaderTabId) => {
    if (mobileExpandedTab !== tabId) return null;

    if (tabId === 'admin' && showAdminMenu && adminTabs.length > 1) {
      return (
        <div className="top-header-mobile-submenu">
          {adminTabs.map((sub) => (
            <button
              key={sub.id}
              type="button"
              className={`top-header-mobile-subitem${adminTab === sub.id && activeTab === 'admin' ? ' active' : ''}`}
              onClick={() => {
                handleAdminSubClick(sub.id);
                closeMobileMenu();
              }}
            >
              {sub.label}
            </button>
          ))}
        </div>
      );
    }

    if (tabId === 'asset-building' && showAssetMenu) {
      return (
        <div className="top-header-mobile-submenu">
          {ASSET_BUILDING_TABS.map((sub) => (
            <button
              key={sub.id}
              type="button"
              className={`top-header-mobile-subitem${assetBuildingTab === sub.id && activeTab === 'asset-building' ? ' active' : ''}`}
              onClick={() => {
                handleAssetSubClick(sub.id);
                closeMobileMenu();
              }}
            >
              {sub.label}
            </button>
          ))}
        </div>
      );
    }

    if (tabId === 'required-coverage' && showCoverageMenu && coverageKinds.length > 0) {
      return (
        <div className="top-header-mobile-submenu">
          {coverageKinds.map((sub) => (
            <button
              key={sub.id}
              type="button"
              className={`top-header-mobile-subitem${requiredCoverageRiskKind === sub.id && activeTab === 'required-coverage' ? ' active' : ''}`}
              onClick={() => {
                handleCoverageSubClick(sub.id);
                closeMobileMenu();
              }}
            >
              {sub.label}
            </button>
          ))}
        </div>
      );
    }

    return null;
  };

  const renderPrivacyToggle = (className: string) =>
    isLicensed && onOperatorPersonalInfoHiddenChange ? (
      <button
        type="button"
        className={className}
        aria-pressed={operatorPersonalInfoHidden}
        title="顧客名・連絡先・プランメモを画面上で隠します。保存・書き出し内容は変更しません"
        onClick={() => onOperatorPersonalInfoHiddenChange(!operatorPersonalInfoHidden)}
      >
        {operatorPersonalInfoHidden ? '個人情報：非表示' : '個人情報：表示'}
      </button>
    ) : null;

  return (
    <header className={`top-header${anyMenuOpen ? ' has-menu-open' : ''}`}>
      {anyMenuOpen ? (
        <button
          type="button"
          className="top-header-menu-scrim"
          aria-label="メニューを閉じる"
          onClick={closeAllMenus}
        />
      ) : null}

      <div className="top-header-mobile-bar">
        <span className="top-header-mobile-brand">LIFE PLAN</span>
        <span className="top-header-mobile-current" aria-current="page">
          {activeTabLabel}
        </span>
        <button
          type="button"
          className="top-header-mobile-menu-btn"
          aria-label="メインメニューを開く"
          aria-expanded={mobileMenuOpen}
          onClick={openMobileMenu}
        >
          <span aria-hidden="true">☰</span>
        </button>
      </div>

      {mobileMenuOpen ? (
        <>
          <button
            type="button"
            className="top-header-mobile-scrim"
            aria-label="メインメニューを閉じる"
            onClick={closeMobileMenu}
          />
          <div className="top-header-mobile-menu" role="dialog" aria-modal="true" aria-label="メインメニュー">
            <div className="top-header-mobile-menu-head">
              <div>
                <span className="top-header-mobile-menu-kicker">LIFE PLAN</span>
                <strong>メニュー</strong>
              </div>
              <button
                type="button"
                className="top-header-mobile-close"
                aria-label="メインメニューを閉じる"
                onClick={closeMobileMenu}
              >
                ×
              </button>
            </div>
            <nav className="top-header-mobile-nav" aria-label="モバイルメインナビゲーション">
              {HEADER_TABS.map((tab) => {
                const enabled = isHeaderTabEnabled(
                  tab.id,
                  analysisUnlocked,
                  requiredCoverageUnlocked,
                  hasOpenPlan,
                );
                const isActive = activeTab === tab.id;
                const hasSubmenu =
                  (tab.id === 'admin' && showAdminMenu && adminTabs.length > 1) ||
                  (tab.id === 'asset-building' && showAssetMenu) ||
                  (tab.id === 'required-coverage' && showCoverageMenu && coverageKinds.length > 0);
                const expanded = mobileExpandedTab === tab.id;

                return (
                  <div key={tab.id} className="top-header-mobile-group">
                    <div className="top-header-mobile-row">
                      <button
                        type="button"
                        className={`top-header-mobile-item${isActive ? ' active' : ''}`}
                        disabled={!enabled}
                        aria-disabled={!enabled}
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => handleMobileTabClick(tab.id)}
                      >
                        <span>{tab.label}</span>
                        {!enabled ? <small>未開放</small> : null}
                      </button>
                      {hasSubmenu ? (
                        <button
                          type="button"
                          className={`top-header-mobile-expand${expanded ? ' is-open' : ''}`}
                          disabled={!enabled}
                          aria-label={`${tab.label}のサブメニューを${expanded ? '閉じる' : '開く'}`}
                          aria-expanded={expanded}
                          onClick={() =>
                            setMobileExpandedTab((current) =>
                              current === tab.id ? null : tab.id,
                            )
                          }
                        >
                          <span aria-hidden="true">⌄</span>
                        </button>
                      ) : null}
                    </div>
                    {renderMobileSubmenu(tab.id)}
                  </div>
                );
              })}
              {renderPrivacyToggle(`top-header-mobile-item${operatorPersonalInfoHidden ? ' active' : ''}`)}
            </nav>
          </div>
        </>
      ) : null}

      <div className="top-header-primary">
        <div className="top-header-brand">
          <h1 className="top-header-title">LIFE PLAN</h1>
          {hasOpenPlan ? (
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
          ) : activeTab === 'admin' ? (
            <p className="top-header-hint">
              {isLicensed
                ? '管理タブでプランを作成・開くと入力できます'
                : 'ライセンスから体験をはじめると入力できます'}
            </p>
          ) : null}
        </div>
        <div className="top-header-primary-right">
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
                  ? isLicensed
                    ? '管理からプランを開くと入力できます'
                    : 'ライセンスから体験をはじめると入力できます'
                  : undefined;
              const isActive = activeTab === tab.id;

              if (tab.id === 'admin' && showAdminMenu) {
                if (adminTabs.length === 1) {
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      className={`top-header-nav-item${isActive ? ' active' : ''}`}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => {
                        onAdminTabChange?.(adminTabs[0].id);
                        onTabChange('admin');
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                }

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
                      {adminTabs.map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          role="menuitem"
                          className={`top-header-dropdown-item${adminTab === sub.id && isActive ? ' active' : ''}`}
                          onClick={() => handleAdminSubClick(sub.id)}
                        >
                          <span className="top-header-dropdown-dot" aria-hidden />
                          <span className="top-header-dropdown-label">{sub.label}</span>
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
                      aria-haspopup="menu"
                      aria-label={`${tab.label}のメニューを開く`}
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
                          <span className="top-header-dropdown-dot" aria-hidden />
                          <span className="top-header-dropdown-label">{sub.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }

              if (tab.id === 'required-coverage' && showCoverageMenu) {
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
                      aria-haspopup="menu"
                      aria-label={`${tab.label}のメニューを開く`}
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
                          <span className="top-header-dropdown-dot" aria-hidden />
                          <span className="top-header-dropdown-label">{sub.label}</span>
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
          {renderPrivacyToggle(`top-header-fullscreen-btn${operatorPersonalInfoHidden ? ' is-active' : ''}`)}
          <button
            type="button"
            className={
              isFullscreen
                ? 'top-header-fullscreen-btn is-active'
                : 'top-header-fullscreen-btn'
            }
            aria-pressed={isFullscreen}
            onClick={() => {
              void toggleFullscreen();
            }}
          >
            {isFullscreen ? '全画面終了' : '全画面'}
          </button>
        </div>
      </div>
    </header>
  );
}
