import { useEffect, useMemo, useState } from 'react';
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
import {
  clampFutureStartFields,
  filterAgesAtOrAfter,
  filterMonthsAtOrAfter,
  resolveSimulationStartAgeMonth,
} from '../../lib/periodTimingBounds';
import type { FamilyMember } from '../../types/family';
import type {
  LivingCycleUnit,
  LivingExpenseInputMode,
  LivingExpenseItem,
  LivingExpenseSchedule,
} from '../../types/living';
import { DebouncedTextInput } from '../shared/DebouncedTextInput';
import { DisclosureSection, SegmentedControl } from '../ui';
import { AddLivingItemModal } from './AddLivingItemModal';

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
const INPUT_MODE_OPTIONS = [
  { value: 'simple', label: 'まとめて入力' },
  { value: 'detail', label: '内訳から入力' },
] as const;

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
  const simStart = useMemo(
    () => resolveSimulationStartAgeMonth(member, referenceDate),
    [member, referenceDate],
  );
  const startAgeOptions = filterAgesAtOrAfter(ageOptions, simStart);
  const startMonthOptions = filterMonthsAtOrAfter(
    schedule.startAge,
    simStart,
    MONTHS,
  );
  const hasSummary = hasLivingDetailSummary(schedule);
  const detailItems = getLivingScheduleBillableItems(schedule);
  const detailMonthlyTotal = calcMonthlyEquivalentMan(detailItems);
  const monthlyTotal =
    schedule.inputMode === 'simple'
      ? schedule.simpleMonthlyExpenseMan
      : detailMonthlyTotal;
  const detailRateItem = hasSummary ? schedule.items[0] : detailItems[0];

  const commit = (
    next: LivingExpenseSchedule,
    syncSummary = true,
  ) => {
    const clamped = clampFutureStartFields(next, simStart);
    onChange(syncSummary ? syncLivingDetailSummary(clamped) : clamped);
  };

  useEffect(() => {
    const clamped = clampFutureStartFields(schedule, simStart);
    if (
      clamped.startAge !== schedule.startAge ||
      clamped.startMonth !== schedule.startMonth ||
      clamped.endAge !== schedule.endAge ||
      clamped.endMonth !== schedule.endMonth
    ) {
      onChange(syncLivingDetailSummary(clamped));
    }
    // 初回・基準月更新時のみ押し上げ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simStart.age, simStart.month]);

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

  const updateDetailRate = (increaseRate: number | null) => {
    if (!detailRateItem) return;
    updateItem(detailRateItem.id, { ...detailRateItem, increaseRate });
  };

  const removeItem = (itemId: string) => {
    if (detailItems.length <= 1) return;
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
      inputMode: 'detail',
      items: [...schedule.items, ...newItems],
    });
  };

  const reorderItems = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const fromIndex = schedule.items.findIndex((i) => i.id === fromId);
    const toIndex = schedule.items.findIndex((i) => i.id === toId);
    const firstMovableIndex = hasSummary ? 1 : 0;
    if (fromIndex < firstMovableIndex || toIndex < firstMovableIndex) return;

    const items = [...schedule.items];
    const [moved] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, moved);
    commit({ ...schedule, items });
  };

  const changeInputMode = (value: string) => {
    const inputMode = value as LivingExpenseInputMode;
    if (inputMode === schedule.inputMode) return;

    if (inputMode === 'simple') {
      commit(
        {
          ...schedule,
          inputMode: 'simple',
          simpleMonthlyExpenseMan: detailMonthlyTotal,
          simpleIncreaseRate: detailRateItem?.increaseRate ?? null,
        },
        false,
      );
      return;
    }

    let items = schedule.items;
    if (items.length === 0) {
      items = [
        createLivingExpenseItem({
          amountMan: schedule.simpleMonthlyExpenseMan,
          increaseRate: schedule.simpleIncreaseRate,
        }),
      ];
    } else if (items.length === 1 && items[0].label.trim() === '生活費') {
      items = [
        {
          ...items[0],
          amountMan: schedule.simpleMonthlyExpenseMan,
          increaseRate: schedule.simpleIncreaseRate,
        },
      ];
    }

    commit({ ...schedule, inputMode: 'detail', items });
  };

  const existingLabels = detailItems.map((item) => item.label);
  const periodLabel = `${schedule.startAge}才${schedule.startMonth}月 〜 ${
    schedule.endMode === 'lifetime'
      ? '生涯'
      : `${schedule.endAge}才${schedule.endMonth}月`
  }`;
  const cardSummary =
    schedule.inputMode === 'simple'
      ? `月額換算 ${formatManAmount(monthlyTotal)} ・ まとめて入力`
      : `月額換算 ${formatManAmount(monthlyTotal)} ・ 内訳${detailItems.length}項目`;

  const schedulePeriodFields = (
    <div className="living-schedule-inputs">
      <div className="living-schedule-side">
        <span className="living-field-label">開始</span>
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
            {startAgeOptions.map((age) => (
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
            {startMonthOptions.map((m) => (
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
        <span className="living-field-label">終了</span>
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
    <DisclosureSection
      title={periodLabel}
      summary={cardSummary}
      className="living-schedule-card"
    >
      <div className="living-schedule-content">
        <section className="living-card-section">
          <h3 className="living-card-section-title">生活費の期間</h3>
          {schedulePeriodFields}
        </section>

        <section className="living-card-section living-input-mode-section">
          <h3 className="living-card-section-title">入力方法</h3>
          <SegmentedControl
            value={schedule.inputMode}
            options={INPUT_MODE_OPTIONS}
            onChange={changeInputMode}
            ariaLabel="生活費の入力方法"
            className="living-input-mode-control"
          />
        </section>

        {schedule.inputMode === 'simple' ? (
          <section className="living-card-section">
            <h3 className="living-card-section-title">毎月の生活費</h3>
            <div className="living-simple-fields">
              <label className="living-simple-field">
                <span className="living-field-label">月額</span>
                <span className="living-amount-field">
                  <input
                    type="number"
                    className="amount-input"
                    value={schedule.simpleMonthlyExpenseMan}
                    min={0}
                    step={0.1}
                    onChange={(e) =>
                      commit(
                        {
                          ...schedule,
                          simpleMonthlyExpenseMan: Math.max(
                            0,
                            Number(e.target.value) || 0,
                          ),
                        },
                        false,
                      )
                    }
                  />
                  <span className="amount-unit">万円</span>
                </span>
              </label>

              <label className="living-simple-field">
                <span className="living-field-label">上昇率</span>
                <span className="living-rate-field">
                  <input
                    type="number"
                    className="rate-input"
                    value={schedule.simpleIncreaseRate ?? ''}
                    min={0}
                    max={100}
                    step={0.1}
                    onChange={(e) =>
                      commit(
                        {
                          ...schedule,
                          simpleIncreaseRate: e.target.value
                            ? Number(e.target.value)
                            : null,
                        },
                        false,
                      )
                    }
                  />
                  <span className="rate-unit">%/年</span>
                </span>
              </label>
            </div>
          </section>
        ) : (
          <section className="living-card-section living-detail-section">
            <div className="living-detail-heading-row">
              <h3 className="living-card-section-title">生活費の内訳</h3>
              <span className="living-detail-heading-total">
                月額換算 {formatManAmount(detailMonthlyTotal)}
              </span>
            </div>

            <div className="living-detail-table">
              <div className="living-detail-header" aria-hidden="true">
                <span>内容</span>
                <span>周期</span>
                <span>金額（税込）</span>
                <span>上昇率</span>
                <span>操作</span>
              </div>

              {detailItems.map((item, index) => (
                <div
                  key={item.id}
                  className={`living-detail-row${
                    dragItemId === item.id ? ' living-detail-row--dragging' : ''
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const fromId = e.dataTransfer.getData('text/plain');
                    if (fromId) reorderItems(fromId, item.id);
                    setDragItemId(null);
                  }}
                >
                  <div className="living-detail-cell living-detail-content">
                    <span className="living-mobile-label">内容</span>
                    <div className="living-content-field">
                      {detailItems.length > 1 ? (
                        <button
                          type="button"
                          className="living-drag-handle"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', item.id);
                            setDragItemId(item.id);
                          }}
                          onDragEnd={() => setDragItemId(null)}
                          aria-label={`${item.label || '項目'}を並べ替え`}
                        >
                          ⠿
                        </button>
                      ) : null}
                      <DebouncedTextInput
                        className="living-content-input"
                        value={item.label}
                        placeholder="項目名"
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

                  <div className="living-detail-cell">
                    <span className="living-mobile-label">周期</span>
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
                  </div>

                  <div className="living-detail-cell">
                    <span className="living-mobile-label">金額（税込）</span>
                    <div className="living-amount-field">
                      <input
                        type="number"
                        className="amount-input"
                        value={item.amountMan}
                        min={0}
                        step={0.1}
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

                  <div className="living-detail-cell">
                    <span className="living-mobile-label">上昇率</span>
                    {index === 0 ? (
                      <div className="living-rate-field">
                        <input
                          type="number"
                          className="rate-input"
                          value={detailRateItem?.increaseRate ?? ''}
                          min={0}
                          max={100}
                          step={0.1}
                          onChange={(e) =>
                            updateDetailRate(
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

                  <div className="living-detail-cell living-detail-action">
                    <span className="living-mobile-label">操作</span>
                    {detailItems.length > 1 ? (
                      <button
                        type="button"
                        className="living-item-remove-btn"
                        onClick={() => removeItem(item.id)}
                        aria-label={`${item.label || '項目'}を削除`}
                      >
                        削除
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <div className="living-add-item-row">
              <button
                type="button"
                className="ui-btn ui-btn--ghost inline-add-btn"
                onClick={() => setModalOpen(true)}
              >
                ＋ 項目を追加
              </button>
            </div>
          </section>
        )}

        <div className="living-summary-row">
          <span className="living-summary-label">生活費合計（月額換算）</span>
          <span className="living-summary-amount">
            {formatManAmount(monthlyTotal)}
          </span>
        </div>

        {canRemoveSchedule ? (
          <div className="living-schedule-remove">
            <button
              type="button"
              className="living-schedule-remove-btn"
              onClick={onRemoveSchedule}
            >
              この生活費スケジュールを削除
            </button>
          </div>
        ) : null}
      </div>

      <AddLivingItemModal
        open={modalOpen}
        existingLabels={existingLabels}
        onClose={() => setModalOpen(false)}
        onAdd={addItemsFromModal}
      />
    </DisclosureSection>
  );
}
