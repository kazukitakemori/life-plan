import type { CSSProperties } from 'react';
import { useState } from 'react';
import {
  calcBirthYear,
  formatEndYearLabel,
  formatYearAtAgeLabel,
} from '../../lib/birthDate';
import {
  calcMonthlyEquivalentMan,
  formatManAmount,
} from '../../lib/livingAmount';
import {
  createLivingExpenseItem,
  getLivingAgeOptions,
  getLivingScheduleBillableItems,
  hasLivingDetailSummary,
  syncLivingDetailSummary,
} from '../../lib/livingDefaults';
import type { FamilyMember } from '../../types/family';
import type {
  LivingCycleUnit,
  LivingExpenseItem,
  LivingExpenseSchedule,
} from '../../types/living';
import { AddLivingItemModal } from './AddLivingItemModal';
import { DebouncedTextInput } from '../shared/DebouncedTextInput';

interface LivingScheduleCardProps {
  schedule: LivingExpenseSchedule;
  member: FamilyMember;
  referenceDate: Date;
  canRemoveSchedule: boolean;
  onChange: (schedule: LivingExpenseSchedule) => void;
  onRemoveSchedule: () => void;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const END_AGES = Array.from({ length: 101 }, (_, i) => i);

export function LivingScheduleCard({
  schedule,
  member,
  referenceDate,
  canRemoveSchedule,
  onChange,
  onRemoveSchedule,
}: LivingScheduleCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [dragItemId, setDragItemId] = useState<string | null>(null);

  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const ageOptions = getLivingAgeOptions(member);
  const hasSummary = hasLivingDetailSummary(schedule);
  const billableItems = getLivingScheduleBillableItems(schedule);
  const monthlyTotal = calcMonthlyEquivalentMan(billableItems);
  const itemCount = Math.max(1, schedule.items.length);
  const firstItem = schedule.items[0];

  const commit = (
    next: LivingExpenseSchedule,
    syncSummary = true,
  ) => {
    onChange(syncSummary ? syncLivingDetailSummary(next) : next);
  };

  const updateItem = (
    itemId: string,
    updated: LivingExpenseItem,
    options?: { syncSummary?: boolean },
  ) => {
    const next = {
      ...schedule,
      items: schedule.items.map((item) =>
        item.id === itemId ? updated : item,
      ),
    };
    commit(next, options?.syncSummary !== false);
  };

  const updateFirstItemRate = (increaseRate: number | null) => {
    if (!firstItem) return;
    updateItem(firstItem.id, { ...firstItem, increaseRate });
  };

  const removeItem = (itemId: string) => {
    if (schedule.items.length <= 1) return;
    if (hasSummary && firstItem && itemId === firstItem.id) return;
    commit({
      ...schedule,
      items: schedule.items.filter((item) => item.id !== itemId),
    });
  };

  const addItemsFromModal = (labels: string[]) => {
    const newItems = labels.map((label) =>
      createLivingExpenseItem({
        label,
        amountMan: 0,
        sameIncreaseRateAsFirst: true,
      }),
    );
    commit({
      ...schedule,
      items: [...schedule.items, ...newItems],
    });
  };

  const reorderItems = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const fromIndex = schedule.items.findIndex((i) => i.id === fromId);
    const toIndex = schedule.items.findIndex((i) => i.id === toId);
    // 先頭の生活費（合計行）は並べ替え対象外
    if (fromIndex <= 0 || toIndex <= 0) return;

    const items = [...schedule.items];
    const [moved] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, moved);
    commit({ ...schedule, items });
  };

  const existingLabels = schedule.items.map((item) => item.label);

  const schedulePeriodFields = (
    <div className="living-schedule-inputs">
      <div className="living-schedule-side">
        <div className="living-schedule-fields">
          <select
            className="select-input select-input--compact select-input--schedule"
            value={schedule.startAge}
            onChange={(e) =>
              commit({
                ...schedule,
                startAge: Number(e.target.value),
              })
            }
          >
            {ageOptions.map((age) => (
              <option key={age} value={age}>
                {age}才
              </option>
            ))}
          </select>
          <select
            className="select-input select-input--compact select-input--schedule"
            value={schedule.startMonth}
            onChange={(e) =>
              commit({
                ...schedule,
                startMonth: Number(e.target.value),
              })
            }
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                {m}月
              </option>
            ))}
          </select>
        </div>
        <p className="period-start-label">
          {formatYearAtAgeLabel(
            schedule.startAge,
            schedule.startMonth,
            birthYear,
            member.birthMonth,
          )}
        </p>
      </div>

      <span className="living-schedule-arrow" aria-hidden>
        →
      </span>

      <div className="living-schedule-side">
        <div className="living-schedule-fields">
          {schedule.endMode === 'lifetime' ? (
            <select
              className="select-input select-input--compact select-input--schedule"
              value="lifetime"
              onChange={(e) => {
                if (e.target.value !== 'lifetime') {
                  commit({
                    ...schedule,
                    endMode: 'until',
                    endAge: Math.max(
                      schedule.startAge + 1,
                      Number(e.target.value),
                    ),
                  });
                }
              }}
            >
              <option value="lifetime">生涯</option>
              {END_AGES.filter((age) => age > schedule.startAge).map((age) => (
                <option key={age} value={age}>
                  {age}才
                </option>
              ))}
            </select>
          ) : (
            <>
              <select
                className="select-input select-input--compact select-input--schedule"
                value={schedule.endAge}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'lifetime') {
                    commit({ ...schedule, endMode: 'lifetime' });
                  } else {
                    commit({
                      ...schedule,
                      endAge: Number(value),
                    });
                  }
                }}
              >
                <option value="lifetime">生涯</option>
                {END_AGES.filter((age) => age > schedule.startAge).map(
                  (age) => (
                    <option key={age} value={age}>
                      {age}才
                    </option>
                  ),
                )}
              </select>
              <select
                className="select-input select-input--compact select-input--schedule"
                value={schedule.endMonth}
                onChange={(e) =>
                  commit({
                    ...schedule,
                    endMonth: Number(e.target.value),
                  })
                }
              >
                {MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {m}月
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
        {schedule.endMode === 'until' && (
          <p className="period-end-label">
            {formatEndYearLabel(
              schedule.endAge,
              schedule.endMonth,
              birthYear,
              member.birthMonth,
            )}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="living-schedule-card">
      <div className="living-table">
        <div className="living-table-header">
          <div className="living-table-header-cell living-col-schedule">
            スケジュール
          </div>
          <div className="living-table-header-cell living-col-content">
            内容
          </div>
          <div className="living-table-header-cell living-col-cycle">周期</div>
          <div className="living-table-header-cell living-col-amount">
            金額（税込）
          </div>
          <div className="living-table-header-cell living-col-rate">上昇率</div>
          <div className="living-table-header-cell living-col-action" />
        </div>

        <div
          className="living-table-body"
          style={{ '--living-item-count': itemCount } as CSSProperties}
        >
          <div className="living-table-cell living-col-schedule living-schedule-cell">
            {schedulePeriodFields}
          </div>

          {schedule.items.map((item, index) => {
            const isSummaryRow = hasSummary && index === 0;
            return (
              <div
                key={item.id}
                className={`living-item-row${isSummaryRow ? ' living-item-row--summary' : ''}${dragItemId === item.id ? ' living-item-row--dragging' : ''}`}
                onDragOver={(e) => {
                  if (index === 0) return;
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromId = e.dataTransfer.getData('text/plain');
                  if (fromId) reorderItems(fromId, item.id);
                  setDragItemId(null);
                }}
              >
                <div className="living-table-cell living-col-content">
                  <div className="living-content-field">
                    {index > 0 && (
                      <button
                        type="button"
                        className="living-drag-handle"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', item.id);
                          setDragItemId(item.id);
                        }}
                        onDragEnd={() => setDragItemId(null)}
                        aria-label="並べ替え"
                      >
                        ⠿
                      </button>
                    )}
                    <DebouncedTextInput
                      className="living-content-input"
                      value={item.label}
                      placeholder={index > 0 ? '項目名' : undefined}
                      readOnly={isSummaryRow}
                      onChange={(label) =>
                        updateItem(
                          item.id,
                          { ...item, label },
                          { syncSummary: false },
                        )
                      }
                    />
                  </div>
                </div>

                <div className="living-table-cell living-col-cycle">
                  {isSummaryRow ? (
                    <span className="living-summary-auto">1ヶ月ごと</span>
                  ) : (
                    <div className="living-cycle-field">
                      <input
                        type="number"
                        className="living-cycle-input"
                        value={item.cycleInterval ?? 1}
                        min={1}
                        max={item.cycleUnit === 'year' ? 30 : 12}
                        onChange={(e) =>
                          updateItem(item.id, {
                            ...item,
                            cycleInterval: Math.max(
                              1,
                              Number(e.target.value) || 1,
                            ),
                          })
                        }
                      />
                      <select
                        className="select-input select-input--cycle"
                        value={item.cycleUnit ?? 'month'}
                        onChange={(e) => {
                          const cycleUnit = e.target.value as LivingCycleUnit;
                          updateItem(item.id, {
                            ...item,
                            cycleUnit,
                            cycleInterval: Math.min(
                              item.cycleInterval,
                              cycleUnit === 'year' ? 30 : 12,
                            ),
                          });
                        }}
                      >
                        <option value="month">ヶ月ごと</option>
                        <option value="year">年ごと</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="living-table-cell living-col-amount">
                  <div className="living-amount-field">
                    <input
                      type="number"
                      className="amount-input"
                      value={item.amountMan}
                      min={0}
                      step={0.1}
                      readOnly={isSummaryRow}
                      onChange={(e) =>
                        updateItem(item.id, {
                          ...item,
                          amountMan: Number(e.target.value) || 0,
                        })
                      }
                    />
                    <span className="amount-unit">万円</span>
                  </div>
                </div>

                <div className="living-table-cell living-col-rate">
                  {index === 0 ? (
                    <div className="living-rate-field">
                      <input
                        type="number"
                        className="rate-input"
                        value={item.increaseRate ?? ''}
                        min={0}
                        max={100}
                        step={0.1}
                        onChange={(e) =>
                          updateFirstItemRate(
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                      />
                      <span className="rate-unit">%/年</span>
                    </div>
                  ) : (
                    <span className="living-rate-same">同上</span>
                  )}
                </div>

                <div className="living-table-cell living-col-action">
                  {schedule.items.length > 1 ? (
                    isSummaryRow ? null : (
                      <button
                        type="button"
                        className="remove-member-btn"
                        onClick={() => removeItem(item.id)}
                        aria-label="項目を削除"
                      >
                        −
                      </button>
                    )
                  ) : (
                    canRemoveSchedule && (
                      <button
                        type="button"
                        className="remove-member-btn"
                        onClick={onRemoveSchedule}
                        aria-label="スケジュールを削除"
                      >
                        −
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}

          <div className="living-add-item-row">
            <button
              type="button"
              className="inline-add-btn"
              onClick={() => setModalOpen(true)}
            >
              ＋ 項目を追加
            </button>
          </div>

          <div className="living-summary-row">
            <div className="living-summary-label">
              毎月の固定費
              <span className="living-help-icon" title="月額換算の合計">
                ?
              </span>
            </div>
            <div className="living-summary-amount">
              {formatManAmount(monthlyTotal)}
            </div>
          </div>
        </div>
      </div>

      {canRemoveSchedule && schedule.items.length > 1 && (
        <div className="living-schedule-remove">
          <button
            type="button"
            className="living-schedule-remove-btn"
            onClick={onRemoveSchedule}
          >
            このスケジュールを削除
          </button>
        </div>
      )}

      <AddLivingItemModal
        open={modalOpen}
        existingLabels={existingLabels}
        onClose={() => setModalOpen(false)}
        onAdd={addItemsFromModal}
      />
    </div>
  );
}
