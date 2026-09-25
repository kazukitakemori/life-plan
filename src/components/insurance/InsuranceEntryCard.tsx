import { useState } from 'react';
import {
  formatAutoInsuranceName,
  formatFireInsuranceName,
  formatInsurancePremiumSummary,
  INSURANCE_CATEGORY_LABELS,
  INSURANCE_CATEGORY_SECTOR,
  INSURANCE_SECTOR_LABELS,
} from '../../lib/insuranceLabels';
import type { FamilyMember } from '../../types/family';
import type { HousingState } from '../../types/housing';
import type { InsuranceEntry } from '../../types/insurance';
import type { VehicleState } from '../../types/vehicle';
import { InsuranceEntryDetail } from './InsuranceEntryDetail';

interface InsuranceEntryCardProps {
  entry: InsuranceEntry;
  member: FamilyMember;
  members: FamilyMember[];
  housingState: HousingState;
  vehicleState: VehicleState;
  referenceDate: Date;
  housingPropertyName?: string;
  vehicleName?: string;
  initiallyExpanded?: boolean;
  onChange: (entry: InsuranceEntry) => void;
  onRemove: () => void;
}

export function InsuranceEntryCard({
  entry,
  member,
  members,
  housingState,
  vehicleState,
  referenceDate,
  housingPropertyName,
  vehicleName,
  initiallyExpanded = false,
  onChange,
  onRemove,
}: InsuranceEntryCardProps) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const isFireLinked = Boolean(entry.housingLink && housingPropertyName);
  const isAutoLinked = Boolean(entry.vehicleLink && vehicleName);
  const displayName = isFireLinked
    ? formatFireInsuranceName(housingPropertyName!)
    : isAutoLinked
      ? formatAutoInsuranceName(vehicleName!)
      : entry.name;
  const sector = INSURANCE_CATEGORY_SECTOR[entry.category];

  const confirmRemove = () => {
    const target = displayName.trim() || 'この保険';
    if (window.confirm(`「${target}」を削除しますか？`)) {
      onRemove();
    }
  };

  return (
    <div
      className={`insurance-entry-card-wrap${expanded ? ' insurance-entry-card-wrap--expanded' : ''}${sector === 'life' ? ' insurance-entry-card-wrap--life' : ' insurance-entry-card-wrap--nonlife'}`}
    >
      <div className="insurance-entry-card">
        <span className="insurance-entry-name-label">{displayName}</span>

        <div className="insurance-entry-badges">
          <span
            className={`insurance-entry-sector-badge insurance-entry-sector-badge--${sector}`}
          >
            {INSURANCE_SECTOR_LABELS[sector]}
          </span>
          <span className="insurance-entry-category-badge">
            {INSURANCE_CATEGORY_LABELS[entry.category]}
          </span>
          {isFireLinked ? (
            <span className="insurance-entry-link-badge">住まい連携</span>
          ) : null}
          {isAutoLinked ? (
            <span className="insurance-entry-link-badge">乗り物連携</span>
          ) : null}
        </div>

        <span className="insurance-entry-summary">
          {formatInsurancePremiumSummary(entry)}
        </span>

        <button
          type="button"
          className={`insurance-entry-open-btn${expanded ? ' insurance-entry-open-btn--active' : ''}`}
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          <span aria-hidden>{expanded ? '∧' : '›'}</span>
          {expanded ? '閉じる' : '開く'}
        </button>
      </div>

      {expanded ? (
        <>
          <InsuranceEntryDetail
            entry={entry}
            member={member}
            members={members}
            housingState={housingState}
            vehicleState={vehicleState}
            referenceDate={referenceDate}
            housingPropertyName={housingPropertyName}
            vehicleName={vehicleName}
            onChange={onChange}
          />
          <div className="insurance-entry-actions">
            <button
              type="button"
              className="ui-btn ui-btn--danger insurance-entry-delete-button"
              onClick={confirmRemove}
            >
              この保険を削除
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
