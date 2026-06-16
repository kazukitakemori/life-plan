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
  isDragging: boolean;
  onChange: (entry: LifeEventEntry) => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropOn: (fromId: string) => void;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const END_AGES = Array.from({ length: 101 }, (_, i) => i);

export function LifeEventRow({
  entry,
  member,
  referenceDate,
  canRemove,
  isDragging,
  onChange,
  onRemove,
  onDragStart,
  onDragEnd,
  onDropOn,
}: LifeEventRowProps) {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const ageOptions = getLifeEventAgeOptions(member);

  return (
    <div
      className={`life-event-table-row ${isDragging ? 'life-event-table-row--dragging' : ''}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const fromId = e.dataTransfer.getData('text/plain');
        if (fromId) onDropOn(fromId);
      }}
    >
      <div className="life-event-table-cell life-event-col-drag">
        <button
          type="button"
          className="life-event-drag-handle"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', entry.id);
            onDragStart();
          }}
          onDragEnd={onDragEnd}
          aria-label="並べ替え"
        >
          ⠿
        </button>
      </div>

      <div className="life-event-table-cell life-event-col-summary">
        <input
          type="text"
          className="life-event-text-input"
          value={entry.label}
          placeholder="摘要"
          onChange={(e) => onChange({ ...entry, label: e.target.value })}
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
                onChange={(e) =>
                  onChange({ ...entry, startAge: Number(e.target.value) })
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
                value={entry.startMonth}
                onChange={(e) =>
                  onChange({ ...entry, startMonth: Number(e.target.value) })
                }
              >
                {MONTHS.map((month) => (
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
              {entry.endMode === 'lifetime' ? (
                <select
                  className="select-input select-input--compact select-input--schedule"
                  value="lifetime"
                  onChange={(e) => {
                    if (e.target.value !== 'lifetime') {
                      onChange({
                        ...entry,
                        endMode: 'until',
                        endAge: Math.max(
                          entry.startAge + 1,
                          Number(e.target.value),
                        ),
                      });
                    }
                  }}
                >
                  <option value="lifetime">生涯</option>
                  {END_AGES.filter((age) => age >= entry.startAge).map((age) => (
                    <option key={age} value={age}>
                      {age}才まで
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <select
                    className="select-input select-input--compact select-input--schedule"
                    value={entry.endAge}
                    onChange={(e) =>
                      onChange({
                        ...entry,
                        endAge: Number(e.target.value),
                      })
                    }
                  >
                    {END_AGES.filter((age) => age >= entry.startAge).map((age) => (
                      <option key={age} value={age}>
                        {age}才
                      </option>
                    ))}
                  </select>
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
                  <select
                    className="select-input select-input--compact select-input--schedule"
                    value="until"
                    onChange={(e) => {
                      if (e.target.value === 'lifetime') {
                        onChange({ ...entry, endMode: 'lifetime' });
                      }
                    }}
                  >
                    <option value="until">まで</option>
                    <option value="lifetime">生涯</option>
                  </select>
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

      <div className="life-event-table-cell life-event-col-emergency">
        <div className="life-event-amount-field">
          <input
            type="number"
            className="amount-input"
            value={entry.emergencyAmountMan}
            min={0}
            step={0.1}
            onChange={(e) =>
              onChange({
                ...entry,
                emergencyAmountMan: Number(e.target.value) || 0,
              })
            }
          />
          <span className="amount-unit">万円</span>
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
