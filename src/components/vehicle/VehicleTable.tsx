import { useState } from 'react';
import type { FamilyMember } from '../../types/family';
import type { LoanEntry, LoanState, VehicleLinkedLoanView } from '../../types/loan';
import type { InsuranceEntry, InsuranceState } from '../../types/insurance';
import type { HousingState } from '../../types/housing';
import type { VehicleEntry, VehicleState } from '../../types/vehicle';
import { duplicateVehicleEntry, type DuplicateVehicleOptions } from '../../lib/vehicleDuplicate';
import { VehicleRow } from './VehicleRow';

interface VehicleTableProps {
  entries: VehicleEntry[];
  member: FamilyMember;
  members: FamilyMember[];
  referenceDate: Date;
  linkedLoansByVehicleId: Record<string, VehicleLinkedLoanView[]>;
  linkedInsurancesByVehicleId?: Record<string, InsuranceEntry[]>;
  insuranceState?: InsuranceState;
  loanState: LoanState;
  housingState: HousingState;
  vehicleState: VehicleState;
  onChange: (entries: VehicleEntry[]) => void;
  onAddLoan: (entry: VehicleEntry) => void;
  onRemoveLoan: (entryId: string) => void;
  onUpdateLoan?: (entry: LoanEntry) => void;
  onAddInsurance?: (entry: VehicleEntry) => void;
  onUpdateInsurance?: (entry: InsuranceEntry) => void;
  onRemoveInsurance?: (entryId: string) => void;
}

export function VehicleTable({
  entries,
  member,
  members,
  referenceDate,
  linkedLoansByVehicleId,
  linkedInsurancesByVehicleId = {},
  insuranceState,
  loanState,
  housingState,
  vehicleState,
  onChange,
  onAddLoan,
  onRemoveLoan,
  onUpdateLoan,
  onAddInsurance,
  onUpdateInsurance,
  onRemoveInsurance,
}: VehicleTableProps) {
  const [dragEntryId, setDragEntryId] = useState<string | null>(null);

  const updateEntry = (entryId: string, updated: VehicleEntry) => {
    onChange(entries.map((entry) => (entry.id === entryId ? updated : entry)));
  };

  const removeEntry = (entryId: string) => {
    const linked = linkedLoansByVehicleId[entryId] ?? [];
    for (const loan of linked) {
      onRemoveLoan(loan.entry.id);
    }
    const linkedInsurances = linkedInsurancesByVehicleId[entryId] ?? [];
    for (const insurance of linkedInsurances) {
      onRemoveInsurance?.(insurance.id);
    }
    onChange(entries.filter((entry) => entry.id !== entryId));
  };

  const reorderEntries = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const fromIndex = entries.findIndex((entry) => entry.id === fromId);
    const toIndex = entries.findIndex((entry) => entry.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;

    const next = [...entries];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onChange(next);
  };

  const duplicateEntry = (entryId: string, options: DuplicateVehicleOptions) => {
    const index = entries.findIndex((entry) => entry.id === entryId);
    if (index < 0) return;
    const source = entries[index];
    const { source: updatedSource, duplicate } = duplicateVehicleEntry(
      source,
      member,
      referenceDate,
      options,
    );
    const next = [...entries];
    next[index] = updatedSource;
    next.splice(index + 1, 0, duplicate);
    onChange(next);
  };

  if (entries.length === 0) {
    return (
      <div className="life-event-table-empty">
        <p>乗り物が登録されていません。下のカードから追加してください。</p>
      </div>
    );
  }

  return (
    <div className="life-event-table-card vehicle-table-card">
      <div className="life-event-table vehicle-table">
        <div className="life-event-table-header">
          <div className="life-event-header-cell life-event-col-drag" />
          <div className="life-event-header-cell vehicle-col-summary">名称</div>
          <div className="life-event-header-cell vehicle-col-type">種類</div>
          <div className="life-event-header-cell vehicle-col-period">
            利用期間
            <span
              className="housing-help-icon"
              title="この1台をいつからいつまで使うかです"
            >
              ?
            </span>
          </div>
          <div className="life-event-header-cell vehicle-col-purchase">
            購入費・返済額
          </div>
          <div className="life-event-header-cell vehicle-col-replace">
            買い替え
            <span
              className="housing-help-icon"
              title="自動車・バイクは新車/中古、自転車・その他はあり/なしで指定します。利用期間の終わりの翌月から同条件で次の台を追加します。ローン・保険は複製されません"
            >
              ?
            </span>
          </div>
          <div className="life-event-header-cell vehicle-col-monthly">
            月次維持費
          </div>
          <div className="life-event-header-cell vehicle-col-annual">
            税金・メンテナンス費
          </div>
          <div className="life-event-header-cell life-event-col-action" />
        </div>

        <div className="life-event-table-body">
          {entries.map((entry) => (
            <VehicleRow
              key={entry.id}
              entry={entry}
              member={member}
              members={members}
              referenceDate={referenceDate}
              linkedLoans={linkedLoansByVehicleId[entry.id] ?? []}
              linkedInsurances={linkedInsurancesByVehicleId[entry.id] ?? []}
              insuranceState={insuranceState}
              loanState={loanState}
              housingState={housingState}
              vehicleState={vehicleState}
              canRemove
              isDragging={dragEntryId === entry.id}
              onChange={(updated) => updateEntry(entry.id, updated)}
              onDuplicate={(options) => duplicateEntry(entry.id, options)}
              onRemove={() => removeEntry(entry.id)}
              onAddLoan={() => onAddLoan(entry)}
              onRemoveLoan={onRemoveLoan}
              onUpdateLoan={onUpdateLoan}
              onAddInsurance={
                onAddInsurance ? () => onAddInsurance(entry) : undefined
              }
              onUpdateInsurance={onUpdateInsurance}
              onRemoveInsurance={onRemoveInsurance}
              onDragStart={() => setDragEntryId(entry.id)}
              onDragEnd={() => setDragEntryId(null)}
              onDropOn={(fromId) => {
                reorderEntries(fromId, entry.id);
                setDragEntryId(null);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
