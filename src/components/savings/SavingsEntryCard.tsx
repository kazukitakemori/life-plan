import { useEffect, useRef, useState } from 'react';
import {
  SAVINGS_CATEGORY_LABELS,
  SAVINGS_CATEGORY_SECTOR,
  SAVINGS_SECTOR_LABELS,
} from '../../lib/savingsLabels';
import type { FamilyMember } from '../../types/family';
import type { IncomeEntry } from '../../types/income';
import type { SavingsEntry } from '../../types/savings';
import {
  formatSavingsEntrySummary,
  SavingsEntryDetail,
} from './SavingsEntryDetail';

interface SavingsEntryCardProps {
  entry: SavingsEntry;
  member: FamilyMember;
  memberEntries: SavingsEntry[];
  incomeEntries: IncomeEntry[];
  referenceDate: Date;
  isDragging?: boolean;
  /**
   * 親からの開く要求。id 一致で展開・一致しなければ閉じる。
   * nonce が増えると同じ口座でも再展開・スクロールする。
   */
  expandRequest?: { id: string; nonce: number } | null;
  onChange: (entry: SavingsEntry) => void;
  onChangeMemberEntries: (entries: SavingsEntry[]) => void;
  onRequestExpandEntry?: (entryId: string) => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOverCard: (insertBefore: boolean) => void;
  onDropOnCard: () => void;
}

export function SavingsEntryCard({
  entry,
  member,
  memberEntries,
  incomeEntries,
  referenceDate,
  isDragging = false,
  expandRequest = null,
  onChange,
  onChangeMemberEntries,
  onRequestExpandEntry,
  onRemove,
  onDragStart,
  onDragEnd,
  onDragOverCard,
  onDropOnCard,
}: SavingsEntryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const sector = SAVINGS_CATEGORY_SECTOR[entry.category];

  useEffect(() => {
    if (!expandRequest) return;
    if (expandRequest.id === entry.id) {
      setExpanded(true);
      return;
    }
    setExpanded(false);
  }, [expandRequest?.id, expandRequest?.nonce, entry.id]);

  useEffect(() => {
    if (!expandRequest || expandRequest.id !== entry.id || !expanded) return;
    const node = wrapRef.current;
    if (!node) return;
    requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, [expanded, expandRequest?.id, expandRequest?.nonce, entry.id]);

  return (
    <div
      ref={wrapRef}
      className={`savings-entry-card-wrap${expanded ? ' savings-entry-card-wrap--expanded' : ''}${sector === 'invest' ? ' savings-entry-card-wrap--invest' : ' savings-entry-card-wrap--deposit'}${isDragging ? ' savings-entry-card-wrap--dragging' : ''}`}
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
      <div className="savings-entry-card">
        <span
          className="savings-entry-drag-handle"
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
        <input
          type="text"
          className="savings-entry-name-input"
          value={entry.name}
          draggable={false}
          onChange={(e) => onChange({ ...entry, name: e.target.value })}
        />
        <span
          className={`savings-entry-sector-badge savings-entry-sector-badge--${sector}`}
        >
          {SAVINGS_SECTOR_LABELS[sector]}
        </span>
        <span className="savings-entry-category-badge">
          {SAVINGS_CATEGORY_LABELS[entry.category]}
        </span>
        <span className="savings-entry-summary">
          {formatSavingsEntrySummary(entry, memberEntries)}
        </span>
        <button
          type="button"
          className={`savings-entry-open-btn${expanded ? ' savings-entry-open-btn--active' : ''}`}
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
          aria-label="貯蓄・運用を削除"
        >
          −
        </button>
      </div>

      {expanded ? (
        <SavingsEntryDetail
          entry={entry}
          member={member}
          memberEntries={memberEntries}
          incomeEntries={incomeEntries}
          referenceDate={referenceDate}
          onChange={onChange}
          onChangeMemberEntries={onChangeMemberEntries}
          onRequestExpandEntry={onRequestExpandEntry}
        />
      ) : null}
    </div>
  );
}
