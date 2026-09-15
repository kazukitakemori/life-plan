import { useEffect, useMemo, useState } from 'react';
import {
  isCelebrationGiftLifeEventType,
  LIFE_EVENT_TYPE_LABELS,
} from '../../lib/lifeEventLabels';
import {
  sortLifeEventEntries,
  type LifeEventSortMode,
} from '../../lib/lifeEventOrder';
import {
  getSecondLifeManagedLifeEventSource,
  getSecondLifeManagedLifeEventSourceLabel,
  isSecondLifeManagedLifeEvent,
} from '../../lib/lifeEventSource';
import type { FamilyMember } from '../../types/family';
import type { LifeEventEntry } from '../../types/lifeEvent';
import { SegmentedControl } from '../ui';
import { CelebrationGiftBlock } from './CelebrationGiftBlock';
import { LifeEventRow } from './LifeEventRow';

interface LifeEventTableProps {
  entries: LifeEventEntry[];
  member: FamilyMember;
  familyMembers: FamilyMember[];
  referenceDate: Date;
  autoExpandEntryId?: string | null;
  onChange: (entries: LifeEventEntry[]) => void;
}

const AMOUNT_FORMATTER = new Intl.NumberFormat('ja-JP', {
  maximumFractionDigits: 1,
});

const SORT_OPTIONS = [
  { value: 'time', label: '時期順' },
  { value: 'genre', label: 'ジャンル順' },
] as const;

function formatLifeEventPeriod(entry: LifeEventEntry): string {
  const start = `${entry.startAge}歳${entry.startMonth}月`;
  if (entry.endMode === 'once') return `${start}・1回限り`;
  if (entry.endMode === 'lifetime') return `${start}〜生涯`;
  return `${start}〜${entry.endAge}歳${entry.endMonth}月`;
}

export function LifeEventTable({
  entries,
  member,
  familyMembers,
  referenceDate,
  autoExpandEntryId,
  onChange,
}: LifeEventTableProps) {
  const [sortMode, setSortMode] = useState<LifeEventSortMode>('time');
  const [expandedEntryIds, setExpandedEntryIds] = useState<Set<string>>(
    () => new Set(),
  );

  const { managedEntries, celebrationEntries, regularEntries } = useMemo(() => {
    const managed: LifeEventEntry[] = [];
    const celebration: LifeEventEntry[] = [];
    const regular: LifeEventEntry[] = [];

    for (const entry of entries) {
      if (isSecondLifeManagedLifeEvent(entry)) {
        managed.push(entry);
      } else if (isCelebrationGiftLifeEventType(entry.type)) {
        celebration.push(entry);
      } else {
        regular.push(entry);
      }
    }

    return {
      managedEntries: managed,
      celebrationEntries: celebration,
      regularEntries: sortLifeEventEntries(regular, sortMode),
    };
  }, [entries, sortMode]);

  const regularEntryIds = useMemo(
    () => new Set(regularEntries.map((entry) => entry.id)),
    [regularEntries],
  );

  useEffect(() => {
    if (!autoExpandEntryId || !regularEntryIds.has(autoExpandEntryId)) return;
    setExpandedEntryIds((current) => {
      if (current.has(autoExpandEntryId)) return current;
      const next = new Set(current);
      next.add(autoExpandEntryId);
      return next;
    });
  }, [autoExpandEntryId, regularEntryIds]);

  useEffect(() => {
    setExpandedEntryIds((current) => {
      const next = new Set(
        [...current].filter((entryId) => regularEntryIds.has(entryId)),
      );
      if (next.size === current.size) return current;
      return next;
    });
  }, [regularEntryIds]);

  const updateEntry = (entryId: string, updated: LifeEventEntry) => {
    onChange(entries.map((entry) => (entry.id === entryId ? updated : entry)));
  };

  const removeEntry = (entryId: string) => {
    onChange(entries.filter((entry) => entry.id !== entryId));
  };

  const toggleEntry = (entryId: string) => {
    setExpandedEntryIds((current) => {
      const next = new Set(current);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  if (entries.length === 0) {
    return (
      <div className="life-event-table-empty">
        <p>ライフイベントが登録されていません。下のボタンから追加してください。</p>
      </div>
    );
  }

  return (
    <div className="life-event-entries">
      {managedEntries.length > 0 ? (
        <div
          className="second-life-apply-status second-life-apply-status--applied"
          role="note"
        >
          <strong>セカンドライフ連動データ</strong>
          <p className="second-life-apply-note">
            以下はセカンドライフ設計を計算へ反映するための行です。この画面では直接編集・削除せず、セカンドライフ側の設計を変更して再反映します。
          </p>
          <ul className="housing-second-life-apply-summary-list">
            {managedEntries.map((entry) => {
              const source = getSecondLifeManagedLifeEventSource(entry);
              return (
                <li key={entry.id}>
                  <strong>{entry.label}</strong>
                  {'：'}
                  {entry.startAge}歳〜
                  {entry.endMode === 'once' ? '1回' : '継続'} / {entry.amountMan}万円
                  {source ? `（${getSecondLifeManagedLifeEventSourceLabel(source)}）` : ''}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

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
          {regularEntries.length > 1 ? (
            <div className="life-event-sort-tools">
              <SegmentedControl
                className="life-event-sort-control"
                ariaLabel="ライフイベントの表示順"
                value={sortMode}
                options={SORT_OPTIONS}
                onChange={(value) => setSortMode(value as LifeEventSortMode)}
              />
            </div>
          ) : null}

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
              <div className="life-event-header-cell life-event-col-rate">
                上昇率
              </div>
              <div className="life-event-header-cell life-event-col-action" />
            </div>

            <div className="life-event-table-body">
              {regularEntries.map((entry) => {
                const expanded = expandedEntryIds.has(entry.id);
                const typeLabel = LIFE_EVENT_TYPE_LABELS[entry.type];
                const title = entry.label.trim() || typeLabel;
                const period = formatLifeEventPeriod(entry);
                const amount = `1回 ${AMOUNT_FORMATTER.format(entry.amountMan)}万円`;

                return (
                  <div
                    key={entry.id}
                    className={`life-event-mobile-accordion-item${expanded ? ' is-expanded' : ''}`}
                  >
                    <button
                      type="button"
                      className="life-event-mobile-summary"
                      aria-expanded={expanded}
                      onClick={() => toggleEntry(entry.id)}
                    >
                      <span className="life-event-mobile-summary-copy">
                        <span className="life-event-mobile-summary-title">{title}</span>
                        <span className="life-event-mobile-summary-type">{typeLabel}</span>
                        <span className="life-event-mobile-summary-meta">
                          {period} ・ {amount}
                        </span>
                      </span>
                      <span className="life-event-mobile-summary-action">
                        <span>{expanded ? '閉じる' : '詳細を開く'}</span>
                        <span aria-hidden>{expanded ? '−' : '＋'}</span>
                      </span>
                    </button>

                    {expanded ? (
                      <LifeEventRow
                        entry={entry}
                        member={member}
                        referenceDate={referenceDate}
                        canRemove
                        onChange={(updated) => updateEntry(entry.id, updated)}
                        onRemove={() => removeEntry(entry.id)}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
