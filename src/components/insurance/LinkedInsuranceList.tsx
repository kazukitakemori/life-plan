import { lazy, Suspense, useState } from 'react';

import { formatInsurancePremiumSummary } from '../../lib/insuranceLabels';
import { resolveInsuranceContractorMember } from '../../lib/insuranceDefaults';
import type { FamilyMember } from '../../types/family';
import type { HousingState } from '../../types/housing';
import type {
  InsuranceEntry,
  InsuranceState,
} from '../../types/insurance';
import type { VehicleState } from '../../types/vehicle';
import type { InsuranceEntryDetailVariant } from './InsuranceEntryDetail';

const LazyInsuranceEntryDetail = lazy(async () => {
  const module = await import('./InsuranceEntryDetail');
  return { default: module.InsuranceEntryDetail };
});

export type LinkedInsuranceLayout = 'card' | 'row';

interface LinkedInsuranceListProps {
  insurances: InsuranceEntry[];
  itemLabel: string;
  variant: Exclude<InsuranceEntryDetailVariant, 'full'>;
  layout?: LinkedInsuranceLayout;
  members: FamilyMember[];
  insuranceState: InsuranceState;
  housingState: HousingState;
  vehicleState: VehicleState;
  referenceDate: Date;
  housingPropertyName?: string;
  vehicleName?: string;
  rowClassName: string;
  itemClassName: string;
  nameClassName: string;
  removeClassName: string;
  onUpdateInsurance: (entry: InsuranceEntry) => void;
  onRemoveInsurance: (entryId: string) => void;
}

interface LinkedInsuranceItemProps
  extends Omit<
    LinkedInsuranceListProps,
    'insurances' | 'rowClassName' | 'itemClassName'
  > {
  insurance: InsuranceEntry;
  rowClassName: string;
  itemClassName: string;
}

function LinkedInsuranceItem({
  insurance,
  itemLabel,
  variant,
  layout = 'row',
  members,
  insuranceState,
  housingState,
  vehicleState,
  referenceDate,
  housingPropertyName,
  vehicleName,
  rowClassName,
  itemClassName,
  nameClassName,
  removeClassName,
  onUpdateInsurance,
  onRemoveInsurance,
}: LinkedInsuranceItemProps) {
  const [expanded, setExpanded] = useState(false);
  const contractor = resolveInsuranceContractorMember(
    insuranceState,
    members,
    insurance.id,
  );
  const summary = formatInsurancePremiumSummary(insurance);
  const isCard = layout === 'card';

  const openButtonClass = isCard
    ? `housing-owned-insurance-open-btn${expanded ? ' housing-owned-insurance-open-btn--active' : ''}`
    : `insurance-entry-open-btn linked-insurance-open-btn${expanded ? ' insurance-entry-open-btn--active' : ''}`;

  const detail = expanded && contractor ? (
    <div
      className={
        isCard
          ? 'housing-owned-insurance-card-detail'
          : 'linked-insurance-item-detail'
      }
    >
      <Suspense fallback={<p className="linked-insurance-loading">読み込み中…</p>}>
        <LazyInsuranceEntryDetail
          entry={insurance}
          member={contractor}
          members={members}
          housingState={housingState}
          vehicleState={vehicleState}
          referenceDate={referenceDate}
          housingPropertyName={housingPropertyName}
          vehicleName={vehicleName}
          variant={variant}
          onChange={onUpdateInsurance}
        />
      </Suspense>
    </div>
  ) : null;

  if (isCard) {
    return (
      <div
        className={`housing-owned-insurance-card${expanded ? ' housing-owned-insurance-card--expanded' : ''} ${itemClassName}`}
      >
        <div className="housing-owned-insurance-card-header">
          <span className="housing-owned-insurance-label">{itemLabel}</span>
          <span className="housing-owned-insurance-meta">{summary}</span>
          <button
            type="button"
            className={openButtonClass}
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            disabled={!contractor}
          >
            {expanded ? '閉じる' : '開く'}
          </button>
          <button
            type="button"
            className="housing-row-remove"
            onClick={() => onRemoveInsurance(insurance.id)}
            aria-label="保険を削除"
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
      className={`linked-insurance-item${expanded ? ' linked-insurance-item--expanded' : ''} ${itemClassName}`}
    >
      <div className={`linked-insurance-item-row ${rowClassName}`}>
        <span className={nameClassName}>{itemLabel}</span>
        <span className="linked-insurance-summary">{summary}</span>
        <button
          type="button"
          className={openButtonClass}
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          disabled={!contractor}
        >
          <span aria-hidden>{expanded ? '∧' : '›'}</span>
          {expanded ? '閉じる' : '開く'}
        </button>
        <button
          type="button"
          className={removeClassName}
          onClick={() => onRemoveInsurance(insurance.id)}
          aria-label="保険を削除"
        >
          −
        </button>
      </div>
      {detail}
    </div>
  );
}

export function LinkedInsuranceList({
  insurances,
  itemLabel,
  variant,
  layout = 'row',
  members,
  insuranceState,
  housingState,
  vehicleState,
  referenceDate,
  housingPropertyName,
  vehicleName,
  rowClassName,
  itemClassName,
  nameClassName,
  removeClassName,
  onUpdateInsurance,
  onRemoveInsurance,
}: LinkedInsuranceListProps) {
  if (insurances.length === 0) {
    return null;
  }

  const listClassName =
    layout === 'card'
      ? 'housing-owned-insurance-list'
      : 'linked-insurance-list';

  return (
    <div className={listClassName}>
      {insurances.map((insurance) => (
        <LinkedInsuranceItem
          key={insurance.id}
          insurance={insurance}
          itemLabel={itemLabel}
          variant={variant}
          layout={layout}
          members={members}
          insuranceState={insuranceState}
          housingState={housingState}
          vehicleState={vehicleState}
          referenceDate={referenceDate}
          housingPropertyName={housingPropertyName}
          vehicleName={vehicleName}
          rowClassName={rowClassName}
          itemClassName={itemClassName}
          nameClassName={nameClassName}
          removeClassName={removeClassName}
          onUpdateInsurance={onUpdateInsurance}
          onRemoveInsurance={onRemoveInsurance}
        />
      ))}
    </div>
  );
}
