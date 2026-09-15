import { useEffect, useMemo } from 'react';
import {
  calcBirthYear,
  formatEndYearLabel,
  formatYearAtAgeLabel,
} from '../../lib/birthDate';
import { getLifeEventAgeOptions } from '../../lib/lifeEventDefaults';
import {
  LIFE_EVENT_CYCLE_UNIT_LABELS,
  LIFE_EVENT_TYPE_LABELS,
  LIFE_EVENT_TYPE_OPTIONS,
} from '../../lib/lifeEventLabels';
import {
  clampFutureStartFields,
  filterAgesAtOrAfter,
  filterMonthsAtOrAfter,
  resolveSimulationStartAgeMonth,
} from '../../lib/periodTimingBounds';
import { DebouncedTextInput } from '../shared/DebouncedTextInput';
import type { FamilyMember } from '../../types/family';
import type {
  LifeEventCycleUnit,
  LifeEventEntry,
} from '../../types/lifeEvent';

interface LifeEventRowProps {
  entry: LifeEventEntry;
  member: FamilyMember;
  referenceDate: Date;
  canRemove: boolean;
  onChange: (entry: LifeEventEntry) => void;
  onRemove: () => void;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const END_AGES = Array.from({ length: 101 }, (_, i) => i);

export function LifeEventRow({
  entry,
  member,
  referenceDate,
  canRemove,
  onChange,
  onRemove,
}: LifeEventRowProps) {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const ageOptions = getLifeEventAgeOptions(member);
  const simStart = useMemo(
    () => resolveSimulationStartAgeMonth(member, referenceDate),
    [member, referenceDate],
  );
  const startAgeOptions = filterAgesAtOrAfter(ageOptions, simStart);
  const startMonthOptions = filterMonthsAtOrAfter(
    entry.startAge,
    simStart,
    MONTHS,
  );

  const commit = (next: LifeEventEntry) => {
    onChange(clampFutureStartFields(next, simStart));
  };

  useEffect(() => {
    const clamped = clampFutureStartFields(entry, simStart);
    if (
      clamped.startAge !== entry.startAge ||
      clamped.startMonth !== entry.startMonth ||
      clamped.endAge !== entry.endAge ||
      clamped.endMonth !== entry.endMonth
    ) {
      onChange(clamped);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simStart.age, simStart.month]);

  return (
    <div className="life-event-table-row">
      <div className="life-event-table-cell life-event-col-drag" aria-hidden />

      <div className="life-event-table-cell life-event-col-summary">
        <DebouncedTextInput
          className="life-event-text-input"
          value={entry.label}
          placeholder="摘要"
          onChange={(label) => onChange({ ...entry, label })}
        />
      </div>

      <div className="life-event-table-cell life-event-col-type">
        <select
          className="select-input life-event-select"
          value={entry.type}
          onChange={(e) =>
            onChange({
              ...entry,
              type: e.target.value as LifeEventEntry['type'],
            })
          }
        >
          {LIFE_EVENT_TYPE_OPTIONS.map((type) => (
            <option key={type} value={type}>
              {LIFE_EVENT_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      <div className="life-event-table-cell life-event-col-period">
        <div className="life-event-period-block">
          <div className="life-event-period-side">
            <div className="life-event-period-fields">
              <select
                className="select-input select-input--compact select-input--schedule"
                value={entry.startAge}
                onChange={(e) => {
                  const startAge = Number(e.target.value);
                  commit({
                    ...entry,
                    startAge,
                    ...(entry.endMode === 'once' ? { endAge: startAge } : {}),
                  });
                }}
              >
                {startAgeOptions.map((age) => (
                  <option key={age} value={age}>
                    {age}才
                  </option>
                ))}
              </select>
              <select
                className="select-input select-input--compact select-input--schedule"
                value={entry.startMonth}
                onChange={(e) => {
                  const startMonth = Number(e.target.value);
                  commit({
                    ...entry,
                    startMonth,
                    ...(entry.endMode === 'once' ? { endMonth: startMonth } : {}),
                  });
                }}
              >
                {startMonthOptions.map((month) => (
                  <option key={month} value={month}>
                    {month}月
                  </option>
                ))}
              </select>
            </div>
            <p className="period-start-label">
              {formatYearAtAgeLabel(
                entry.startAge,
                entry.startMonth,
                birthYear,
                member.birthMonth,
              )}
            </p>
          </div>

          <span className="life-event-period-arrow" aria-hidden>
            →
          </span>

          <div className="life-event-period-side">
            <div className="life-event-period-fields">
              <select
                className="select-input select-input--compact select-input--schedule"
                value={
                  entry.endMode === 'lifetime'
                    ? 'lifetime'
                    : entry.endMode === 'once'
                      ? 'once'
                      : String(entry.endAge)
                }
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'lifetime') {
                    onChange({ ...entry, endMode: 'lifetime' });
                    return;
                  }
                  if (value === 'once') {
                    onChange({
                      ...entry,
                      endMode: 'once',
                      endAge: entry.startAge,
                      endMonth: entry.startMonth,
                    });
                    return;
                  }

                  const selectedEndAge = Number(value);
                  const resolvedEndAge =
                    entry.endMode === 'lifetime' || entry.endMode === 'once'
                      ? Math.max(entry.startAge + 1, selectedEndAge)
                      : selectedEndAge;
                  onChange({
                    ...entry,
                    endMode: 'until',
                    endAge: resolvedEndAge,
                  });
                }}
              >
                <option value="lifetime">生涯</option>
                <option value="once">1回限り</option>
                {END_AGES.filter((age) => age >= entry.startAge).map((age) => (
                  <option key={age} value={age}>
                    {age}才
                  </option>
                ))}
              </select>

              {entry.endMode === 'until' && (
                <>
                  <select
                    className="select-input select-input--compact select-input--schedule"
                    value={entry.endMonth}
                    onChange={(e) =>
                      onChange({
                        ...entry,
                        endMonth: Number(e.target.value),
                      })
                    }
                  >
                    {MONTHS.map((month) => (
                      <option key={month} value={month}>
                        {month}月
                      </option>
                    ))}
                  </select>
                  <span className="period-until-suffix">まで</span>
                </>
              )}
            </div>
            {entry.endMode === 'until' && (
              <p className="period-end-label">
                {formatEndYearLabel(
                  entry.endAge,
                  entry.endMonth,
                  birthYear,
                  member.birthMonth,
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="life-event-table-cell life-event-col-cycle">
        {entry.endMode !== 'once' && (
          <div className="life-event-cycle-field">
            <input
              type="number"
              className="life-event-cycle-input"
              value={entry.cycleInterval}
              min={1}
              max={entry.cycleUnit === 'year' ? 30 : 12}
              onChange={(e) =>
                onChange({
                  ...entry,
                  cycleInterval: Math.max(1, Number(e.target.value) || 1),
                })
              }
            />
            <select
              className="select-input select-input--cycle"
              value={entry.cycleUnit}
              onChange={(e) => {
                const cycleUnit = e.target.value as LifeEventCycleUnit;
                onChange({
                  ...entry,
                  cycleUnit,
                  cycleInterval: Math.min(
                    entry.cycleInterval,
                    cycleUnit === 'year' ? 30 : 12,
                  ),
                });
              }}
            >
              {(Object.keys(LIFE_EVENT_CYCLE_UNIT_LABELS) as LifeEventCycleUnit[]).map(
                (unit) => (
                  <option key={unit} value={unit}>
                    {LIFE_EVENT_CYCLE_UNIT_LABELS[unit]}
                  </option>
                ),
              )}
            </select>
          </div>
        )}
      </div>

      <div className="life-event-table-cell life-event-col-amount">
        <div className="life-event-amount-field">
          <input
            type="number"
            className="amount-input"
            value={entry.amountMan}
            min={0}
            step={0.1}
            onChange={(e) =>
              onChange({
                ...entry,
                amountMan: Number(e.target.value) || 0,
              })
            }
          />
          <span className="amount-unit">万円</span>
        </div>
      </div>

      <div className="life-event-table-cell life-event-col-rate">
        <div className="life-event-rate-field">
          <input
            type="number"
            className="rate-input"
            value={entry.increaseRate ?? ''}
            min={0}
            max={100}
            step={0.1}
            onChange={(e) =>
              onChange({
                ...entry,
                increaseRate: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
          <span className="rate-unit">%/年</span>
        </div>
      </div>

      <div className="life-event-table-cell life-event-col-action">
        <button
          type="button"
          className="life-event-row-remove"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label="削除"
        >
          −
        </button>
      </div>
    </div>
  );
}
