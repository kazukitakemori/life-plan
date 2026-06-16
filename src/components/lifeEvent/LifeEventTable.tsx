import { useState } from 'react';
import { isCelebrationGiftLifeEventType } from '../../lib/lifeEventLabels';
import type { FamilyMember } from '../../types/family';
import type { LifeEventEntry } from '../../types/lifeEvent';
import { CelebrationGiftBlock } from './CelebrationGiftBlock';
import { LifeEventRow } from './LifeEventRow';

interface LifeEventTableProps {
  entries: LifeEventEntry[];
  member: FamilyMember;
  familyMembers: FamilyMember[];
  referenceDate: Date;
  onChange: (entries: LifeEventEntry[]) => void;
}

export function LifeEventTable({
  entries,
  member,
  familyMembers,
  referenceDate,
  onChange,
}: LifeEventTableProps) {
  const [dragEntryId, setDragEntryId] = useState<string | null>(null);

  const celebrationEntries = entries.filter((entry) =>
    isCelebrationGiftLifeEventType(entry.type),
  );
  const regularEntries = entries.filter(
    (entry) => !isCelebrationGiftLifeEventType(entry.type),
  );

  const updateEntry = (entryId: string, updated: LifeEventEntry) => {
    onChange(entries.map((entry) => (entry.id === entryId ? updated : entry)));
  };

  const removeEntry = (entryId: string) => {
    onChange(entries.filter((entry) => entry.id !== entryId));
  };

  const reorderEntries = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const fromIndex = regularEntries.findIndex((entry) => entry.id === fromId);
    const toIndex = regularEntries.findIndex((entry) => entry.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;

    const nextRegular = [...regularEntries];
    const [moved] = nextRegular.splice(fromIndex, 1);
    nextRegular.splice(toIndex, 0, moved);
    onChange([...celebrationEntries, ...nextRegular]);
  };

  if (entries.length === 0) {
    return (
      <div className="life-event-table-empty">
        <p>
          ライフイベントが登録されていません。下のカードから追加してください。
        </p>
      </div>
    );
  }

  return (
    <div className="life-event-entries">
      {celebrationEntries.length > 0 && (
        <div className="life-event-celebration-list">
          {celebrationEntries.map((entry) => (
            <CelebrationGiftBlock
              key={entry.id}
              entry={entry}
              familyMembers={familyMembers}
              onChange={(updated) => updateEntry(entry.id, updated)}
              onRemove={() => removeEntry(entry.id)}
            />
          ))}
        </div>
      )}

      {regularEntries.length > 0 && (
        <div className="life-event-table-card">
          <div className="life-event-table">
            <div className="life-event-table-header">
              <div className="life-event-header-cell life-event-col-drag" />
              <div className="life-event-header-cell life-event-col-summary">
                摘要
              </div>
              <div className="life-event-header-cell life-event-col-type">
                タイプ
              </div>
              <div className="life-event-header-cell life-event-col-period">
                実施期間
              </div>
              <div className="life-event-header-cell life-event-col-cycle">
                周期
              </div>
              <div className="life-event-header-cell life-event-col-amount">
                一回当たりの金額（税込）
              </div>
              <div className="life-event-header-cell life-event-col-emergency">
                万が一時の金額（税込）
              </div>
              <div className="life-event-header-cell life-event-col-action" />
            </div>

            <div className="life-event-table-body">
              {regularEntries.map((entry) => (
                <LifeEventRow
                  key={entry.id}
                  entry={entry}
                  member={member}
                  referenceDate={referenceDate}
                  canRemove
                  isDragging={dragEntryId === entry.id}
                  onChange={(updated) => updateEntry(entry.id, updated)}
                  onRemove={() => removeEntry(entry.id)}
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
      )}
    </div>
  );
}
