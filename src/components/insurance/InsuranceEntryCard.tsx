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
  isDragging?: boolean;
  onChange: (entry: InsuranceEntry) => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOverCard: (insertBefore: boolean) => void;
  onDropOnCard: () => void;
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
  isDragging = false,
  onChange,
  onRemove,
  onDragStart,
  onDragEnd,
  onDragOverCard,
  onDropOnCard,
}: InsuranceEntryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isFireLinked = Boolean(entry.housingLink && housingPropertyName);
  const isAutoLinked = Boolean(entry.vehicleLink && vehicleName);
  const displayName = isFireLinked
    ? formatFireInsuranceName(housingPropertyName!)
    : isAutoLinked
      ? formatAutoInsuranceName(vehicleName!)
      : entry.name;
  const sector = INSURANCE_CATEGORY_SECTOR[entry.category];

  return (
    <div
      className={`insurance-entry-card-wrap${expanded ? ' insurance-entry-card-wrap--expanded' : ''}${sector === 'life' ? ' insurance-entry-card-wrap--life' : ' insurance-entry-card-wrap--nonlife'}${isDragging ? ' insurance-entry-card-wrap--dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = e.currentTarget.getBoundingClientRect();
        const insertBefore = e.clientY < rect.top + rect.height / 2;
        onDragOverCard(insertBefore);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDropOnCard();
      }}
    >
      <div className="insurance-entry-card">
        <span
          className="insurance-entry-drag-handle"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', entry.id);
            e.dataTransfer.effectAllowed = 'move';
            onDragStart();
          }}
          onDragEnd={onDragEnd}
          role="button"
          tabIndex={0}
          aria-label="並べ替え"
        >
          ⠿
        </span>
        {isFireLinked || isAutoLinked ? (
          <span className="insurance-entry-name-label">{displayName}</span>
        ) : (
          <input
            type="text"
            className="insurance-entry-name-input"
            value={entry.name}
            draggable={false}
            onChange={(e) => onChange({ ...entry, name: e.target.value })}
          />
        )}
        <span className={`insurance-entry-sector-badge insurance-entry-sector-badge--${sector}`}>
          {INSURANCE_SECTOR_LABELS[sector]}
        </span>
        <span className="insurance-entry-category-badge">
          {INSURANCE_CATEGORY_LABELS[entry.category]}
        </span>
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
        <button
          type="button"
          className="housing-row-remove"
          onClick={onRemove}
          aria-label="保険を削除"
        >
          −
        </button>
      </div>

      {expanded ? (
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
      ) : null}
    </div>
  );
}
