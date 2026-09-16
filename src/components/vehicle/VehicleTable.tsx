import { useEffect, useState } from 'react';
import type { FamilyMember } from '../../types/family';
import type { LoanEntry, LoanState, VehicleLinkedLoanView } from '../../types/loan';
import type { InsuranceEntry, InsuranceState } from '../../types/insurance';
import type { HousingState } from '../../types/housing';
import type { VehicleEntry, VehiclePresetId, VehicleState } from '../../types/vehicle';
import { duplicateVehicleEntry, type DuplicateVehicleOptions } from '../../lib/vehicleDuplicate';
import { AddVehicleCards } from './AddVehicleCards';
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
  onAdd: (presetId: VehiclePresetId) => void;
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
  onAdd,
  onAddLoan,
  onRemoveLoan,
  onUpdateLoan,
  onAddInsurance,
  onUpdateInsurance,
  onRemoveInsurance,
}: VehicleTableProps) {
  const [dragEntryId, setDragEntryId] = useState<string | null>(null);
  const [activeEntryId, setActiveEntryId] = useState(entries[0]?.id ?? '');

  useEffect(() => {
    if (entries.length === 0) {
      setActiveEntryId('');
      return;
    }
    if (!entries.some((entry) => entry.id === activeEntryId)) {
      setActiveEntryId(entries[0].id);
    }
  }, [entries, activeEntryId]);

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

    const remaining = entries.filter((entry) => entry.id !== entryId);
    if (activeEntryId === entryId) {
      setActiveEntryId(remaining[0]?.id ?? '');
    }
    onChange(remaining);
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
    setActiveEntryId(duplicate.id);
    onChange(next);
  };

  return (
    <>
      <div className="vehicle-workspace">
        <div className="life-event-table-card vehicle-table-card vehicle-detail-panel">
          {entries.length === 0 ? (
            <div className="life-event-table-empty vehicle-empty-state vehicle-detail-empty">
              <p>乗り物が登録されていません。右側の「乗り物を追加」から登録してください。</p>
            </div>
          ) : (
            <div className="life-event-table vehicle-table">
              <div className="life-event-table-header">
                <div className="life-event-header-cell life-event-col-drag" />
                <div className="life-event-header-cell vehicle-col-summary">名称</div>
                <div className="life-event-header-cell vehicle-col-type">種類</div>
                <div className="life-event-header-cell vehicle-col-period">利用期間</div>
                <div className="life-event-header-cell vehicle-col-purchase">購入費・返済額</div>
                <div className="life-event-header-cell vehicle-col-monthly">月次維持費</div>
                <div className="life-event-header-cell vehicle-col-annual">税金・メンテナンス費</div>
                <div className="life-event-header-cell vehicle-col-replace">買い替え</div>
                <div className="life-event-header-cell life-event-col-action" />
              </div>

              <div className="life-event-table-body">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className={`vehicle-detail-entry${
                      entry.id === activeEntryId ? ' is-active' : ''
                    }`}
                  >
                    <VehicleRow
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
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="vehicle-master-panel" aria-label="登録中の乗り物一覧">
          <div className="vehicle-master-heading">
            <span>登録中の乗り物</span>
            <span className="vehicle-master-count">{entries.length}台</span>
          </div>
          {entries.length === 0 ? (
            <p className="vehicle-master-empty">まだ登録されていません</p>
          ) : (
            <div className="vehicle-master-list">
              {entries.map((entry, index) => {
                const active = entry.id === activeEntryId;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    className={`vehicle-master-item${active ? ' is-active' : ''}${
                      dragEntryId === entry.id ? ' is-dragging' : ''
                    }`}
                    onClick={() => setActiveEntryId(entry.id)}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/plain', entry.id);
                      setDragEntryId(entry.id);
                    }}
                    onDragEnd={() => setDragEntryId(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const fromId = event.dataTransfer.getData('text/plain');
                      if (fromId) reorderEntries(fromId, entry.id);
                      setDragEntryId(null);
                    }}
                    aria-pressed={active}
                  >
                    <span className="vehicle-master-order">{index + 1}</span>
                    <span className="vehicle-master-copy">
                      <span className="vehicle-master-name">
                        {entry.label.trim() || `乗り物 ${index + 1}`}
                      </span>
                      <span className="vehicle-master-meta">ドラッグで並べ替え</span>
                    </span>
                    <span className="vehicle-master-arrow" aria-hidden>
                      ‹
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="vehicle-master-add">
            <AddVehicleCards onAdd={onAdd} />
          </div>
        </aside>
      </div>

      <div className="vehicle-mobile-add">
        <AddVehicleCards onAdd={onAdd} />
      </div>
    </>
  );
}
