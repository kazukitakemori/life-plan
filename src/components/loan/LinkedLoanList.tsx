import { lazy, Suspense, useMemo, useState } from 'react';

import { getAllLoanEntries, resolveLoanContractorMember } from '../../lib/loanDefaults';
import {
  getLinkedHousingProperty,
  getLinkedVehicle,
} from '../../lib/loanResolution';
import { buildHousingLoanLinkDisplayRows } from '../../lib/pairLoanShare';
import type { FamilyMember } from '../../types/family';
import type { OwnedProperty } from '../../types/housing';
import type { HousingState } from '../../types/housing';
import type {
  HousingLinkedLoanView,
  LoanEntry,
  LoanState,
  VehicleLinkedLoanView,
} from '../../types/loan';
import type { VehicleState } from '../../types/vehicle';
import type { LoanEntryDetailVariant } from './LoanEntryDetail';

const LazyLoanEntryDetail = lazy(async () => {
  const module = await import('./LoanEntryDetail');
  return { default: module.LoanEntryDetail };
});

export type LinkedLoanLayout = 'card' | 'row';

interface LinkedLoanCallbacks {
  members: FamilyMember[];
  loanState: LoanState;
  housingState: HousingState;
  vehicleState: VehicleState;
  referenceDate: Date;
  housingPropertyName?: string;
  vehicleName?: string;
  onUpdateLoan: (entry: LoanEntry) => void;
  onUpdatePairPartnerLoan?: (entry: LoanEntry) => void;
  onPairShareChange?: (entry: LoanEntry, sharePct: number) => void;
  onJointDebtShareChange?: (entry: LoanEntry, sharePct: number) => void;
  onPropertyFeeChange?: (
    entry: LoanEntry,
    patch: Partial<Pick<OwnedProperty, 'brokerageFeeMan' | 'registrationFeeMan'>>,
  ) => void;
  onRemoveLoan: (entryId: string) => void;
}

interface LinkedLoanItemProps extends LinkedLoanCallbacks {
  itemLabel: string;
  summary: string;
  editEntryId: string;
  variant: Exclude<LoanEntryDetailVariant, 'full'>;
  layout?: LinkedLoanLayout;
  rowClassName: string;
  itemClassName: string;
  nameClassName: string;
  removeClassName: string;
}

function LinkedLoanItem({
  itemLabel,
  summary,
  editEntryId,
  variant,
  layout = 'row',
  members,
  loanState,
  housingState,
  vehicleState,
  referenceDate,
  housingPropertyName,
  vehicleName,
  rowClassName,
  itemClassName,
  nameClassName,
  removeClassName,
  onUpdateLoan,
  onUpdatePairPartnerLoan,
  onPairShareChange,
  onJointDebtShareChange,
  onPropertyFeeChange,
  onRemoveLoan,
}: LinkedLoanItemProps) {
  const [expanded, setExpanded] = useState(false);
  const contractor = resolveLoanContractorMember(loanState, members, editEntryId);
  const entry = useMemo(
    () => getAllLoanEntries(loanState).find((item) => item.id === editEntryId),
    [loanState, editEntryId],
  );
  const linkedHousingProperty = entry
    ? getLinkedHousingProperty(housingState, entry)
    : undefined;
  const linkedVehicle = entry ? getLinkedVehicle(vehicleState, entry) : undefined;
  const isCard = layout === 'card';

  const openButtonClass = isCard
    ? `housing-owned-loan-open-btn${expanded ? ' housing-owned-loan-open-btn--active' : ''}`
    : `loan-entry-open-btn linked-loan-open-btn${expanded ? ' loan-entry-open-btn--active' : ''}`;

  const detail =
    expanded && contractor && entry ? (
      <div
        className={
          isCard
            ? 'housing-owned-loan-card-detail'
            : 'linked-loan-item-detail'
        }
      >
        <Suspense fallback={<p className="linked-loan-loading">読み込み中…</p>}>
          <LazyLoanEntryDetail
            entry={entry}
            housingPropertyName={housingPropertyName}
            vehicleName={vehicleName}
            linkedHousingProperty={linkedHousingProperty}
            linkedVehicle={linkedVehicle}
            referenceDate={referenceDate}
            member={contractor}
            members={members}
            loanState={loanState}
            variant={variant}
            onChange={onUpdateLoan}
            onPairPartnerChange={onUpdatePairPartnerLoan}
            onPairShareChange={
              onPairShareChange
                ? (sharePct) => onPairShareChange(entry, sharePct)
                : undefined
            }
            onJointDebtShareChange={
              onJointDebtShareChange
                ? (sharePct) => onJointDebtShareChange(entry, sharePct)
                : undefined
            }
            onPropertyFeeChange={
              onPropertyFeeChange
                ? (patch) => onPropertyFeeChange(entry, patch)
                : undefined
            }
          />
        </Suspense>
      </div>
    ) : null;

  if (isCard) {
    return (
      <div
        className={`housing-owned-loan-card${expanded ? ' housing-owned-loan-card--expanded' : ''} ${itemClassName}`}
      >
        <div className="housing-owned-loan-card-header">
          <span className="housing-owned-loan-label">{itemLabel}</span>
          <span className="housing-owned-loan-meta">{summary}</span>
          <button
            type="button"
            className={openButtonClass}
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            disabled={!contractor || !entry}
          >
            {expanded ? '閉じる' : '開く'}
          </button>
          <button
            type="button"
            className="housing-row-remove"
            onClick={() => onRemoveLoan(editEntryId)}
            aria-label="ローンを削除"
          >
            −
          </button>
        </div>
        {detail}
      </div>
    );
  }

  return (
    <div
      className={`linked-loan-item${expanded ? ' linked-loan-item--expanded' : ''} ${itemClassName}`}
    >
      <div className={`linked-loan-item-row ${rowClassName}`}>
        <span className={nameClassName}>{itemLabel}</span>
        <span className="linked-loan-summary">{summary}</span>
        <button
          type="button"
          className={openButtonClass}
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          disabled={!contractor || !entry}
        >
          <span aria-hidden>{expanded ? '∧' : '›'}</span>
          {expanded ? '閉じる' : '開く'}
        </button>
        <button
          type="button"
          className={removeClassName}
          onClick={() => onRemoveLoan(editEntryId)}
          aria-label="ローンを削除"
        >
          −
        </button>
      </div>
      {detail}
    </div>
  );
}

interface HousingLinkedLoanListProps extends LinkedLoanCallbacks {
  loans: HousingLinkedLoanView[];
  itemLabel: string;
  layout?: LinkedLoanLayout;
  rowClassName: string;
  itemClassName: string;
  nameClassName: string;
  removeClassName: string;
}

export function HousingLinkedLoanList({
  loans,
  itemLabel,
  layout = 'card',
  ...rest
}: HousingLinkedLoanListProps) {
  const rows = useMemo(
    () => buildHousingLoanLinkDisplayRows(loans),
    [loans],
  );

  if (rows.length === 0) {
    return null;
  }

  const listClassName =
    layout === 'card' ? 'housing-owned-loan-list' : 'linked-loan-list';

  return (
    <div className={listClassName}>
      {rows.map((row) => (
        <LinkedLoanItem
          key={row.key}
          itemLabel={itemLabel}
          summary={row.meta}
          editEntryId={row.editEntryId}
          variant="housing-linked"
          layout={layout}
          {...rest}
        />
      ))}
    </div>
  );
}

interface VehicleLinkedLoanListProps extends LinkedLoanCallbacks {
  loans: VehicleLinkedLoanView[];
  itemLabel: string;
  layout?: LinkedLoanLayout;
  rowClassName: string;
  itemClassName: string;
  nameClassName: string;
  removeClassName: string;
}

export function VehicleLinkedLoanList({
  loans,
  itemLabel,
  layout = 'card',
  ...rest
}: VehicleLinkedLoanListProps) {
  if (loans.length === 0) {
    return null;
  }

  const listClassName =
    layout === 'card' ? 'housing-owned-loan-list' : 'linked-loan-list';

  return (
    <div className={listClassName}>
      {loans.map((loan) => (
        <LinkedLoanItem
          key={loan.entry.id}
          itemLabel={itemLabel}
          summary={`契約者：${loan.contractorLabel}`}
          editEntryId={loan.entry.id}
          variant="vehicle-linked"
          layout={layout}
          {...rest}
        />
      ))}
    </div>
  );
}
