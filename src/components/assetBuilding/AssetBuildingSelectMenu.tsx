import type { ReactNode, RefObject } from 'react';

export interface AssetBuildingSelectOption<T extends string> {
  id: T;
  label: string;
}

interface AssetBuildingSelectMenuProps<T extends string> {
  value: T;
  options: ReadonlyArray<AssetBuildingSelectOption<T>>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: T) => void;
  ariaLabel: string;
  secondary?: boolean;
  fallbackLabel?: string;
}

function SelectCaret() {
  return (
    <span className="asset-building-title-trigger-caret" aria-hidden>
      <svg viewBox="0 0 12 12" width="9" height="9" focusable="false">
        <path
          d="M2.5 4.25L6 7.75L9.5 4.25"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function AssetBuildingSelectMenu<T extends string>({
  value,
  options,
  open,
  onOpenChange,
  onChange,
  ariaLabel,
  secondary = false,
  fallbackLabel,
}: AssetBuildingSelectMenuProps<T>) {
  const label =
    options.find((option) => option.id === value)?.label ??
    fallbackLabel ??
    value;

  return (
    <div
      className={`asset-building-title-menu${secondary ? ' asset-building-title-menu--secondary' : ''}${open ? ' is-open' : ''}`}
    >
      <button
        type="button"
        className={`asset-building-title-trigger${secondary ? ' asset-building-title-trigger--secondary' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => onOpenChange(!open)}
      >
        <span className="asset-building-title-trigger-text">
          <span className="asset-building-title-trigger-label">{label}</span>
          {secondary ? null : (
            <span className="asset-building-title-trigger-underline" aria-hidden />
          )}
        </span>
        <SelectCaret />
      </button>
      <div className="asset-building-title-dropdown" role="menu">
        {options.map((option) => {
          const isActive = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              role="menuitemradio"
              aria-checked={isActive}
              className={`asset-building-title-dropdown-item${isActive ? ' is-active' : ''}`}
              onClick={() => {
                onChange(option.id);
                onOpenChange(false);
              }}
            >
              <span className="asset-building-title-dropdown-dot" aria-hidden />
              <span className="asset-building-title-dropdown-label">
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AssetBuildingTitleRow({
  children,
  rowRef,
}: {
  children: ReactNode;
  rowRef?: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="asset-building-top" ref={rowRef}>
      {children}
    </div>
  );
}
