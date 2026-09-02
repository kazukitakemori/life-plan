import {
  calcBirthYear,
  calcFutureYear,
  formatBirthLabel,
  getBirthDayOptions,
} from '../../lib/birthDate';
import {
  buildParentPensionGuideMessage,
  ELDERLY_DEPENDENT_MIN_AGE,
  getParentPensionGuideDeductionLabel,
  isElderlyParentOrGrandparent,
  isParentOrGrandparent,
  shouldShowParentPensionGuide,
} from '../../lib/dependentAlerts';
import { isMemberBirthComplete } from '../../lib/familyDefaults';
import { getMemberTabLabel } from '../../lib/memberDisplay';
import { validateMemberDependentDefaults } from '../../lib/dependentValidation';
import type {
  FamilyMember,
  HouseholdPeriodMode,
  OtherRelationship,
} from '../../types/family';
import { OTHER_RELATIONSHIP_LABELS, ROLE_LABELS } from '../../types/family';
import { MemberAvatar } from './MemberAvatar';

interface FamilyMemberRowProps {
  member: FamilyMember;
  referenceDate: Date;
  onChange: (member: FamilyMember) => void;
  onRemove: () => void;
  canRemove: boolean;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const AGES = Array.from({ length: 101 }, (_, i) => i);
const CHILD_AGES = Array.from({ length: 126 }, (_, i) => i - 25);
const LIFESPANS = Array.from({ length: 51 }, (_, i) => i + 50);

function getAgeOptions(role: FamilyMember['role']): number[] {
  return role === 'child' ? CHILD_AGES : AGES;
}

function SelectField({
  label,
  value,
  onChange,
  options,
  suffix,
  allowEmpty = false,
  emptyLabel = '選択',
}: {
  label: string;
  value: number | string | null;
  onChange: (value: number | null) => void;
  options: { value: number; label: string }[];
  suffix?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  return (
    <div className="inline-field">
      <span className="inline-field-label">{label}</span>
      <div className="inline-field-controls">
        <select
          className="select-input"
          value={value ?? ''}
          onChange={(e) => {
            const raw = e.target.value;
            onChange(raw === '' ? null : Number(raw));
          }}
        >
          {allowEmpty && (
            <option value="" disabled={value != null}>
              {emptyLabel}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {suffix && <span className="inline-field-suffix">{suffix}</span>}
      </div>
    </div>
  );
}

function HouseholdPeriodSection({
  member,
  referenceDate,
  onChange,
}: {
  member: FamilyMember;
  referenceDate: Date;
  onChange: (member: FamilyMember) => void;
}) {
  const { role, householdPeriod } = member;
  const birthComplete = isMemberBirthComplete(member);
  const birthYear = birthComplete
    ? calcBirthYear(member.age, member.birthMonth, referenceDate)
    : null;

  const setMode = (mode: HouseholdPeriodMode) => {
    onChange({
      ...member,
      householdPeriod: { ...householdPeriod, mode },
    });
  };

  const setEndAge = (endAge: number) => {
    onChange({
      ...member,
      householdPeriod: { ...householdPeriod, endAge },
    });
  };

  const setEndMonth = (endMonth: number) => {
    onChange({
      ...member,
      householdPeriod: { ...householdPeriod, endMonth },
    });
  };

  if (role === 'head') {
    return <div className="period-cell period-cell--empty">—</div>;
  }

  const showEducation = role === 'child';
  const endYear =
    householdPeriod.mode === 'custom' &&
    birthYear != null &&
    member.birthMonth != null
      ? calcFutureYear(
          birthYear,
          householdPeriod.endAge,
          householdPeriod.endMonth,
          member.birthMonth,
        )
      : null;

  return (
    <div className="period-cell">
      <fieldset className="period-options">
        <label className="radio-option">
          <input
            type="radio"
            name={`period-${member.id}`}
            checked={householdPeriod.mode === 'lifetime'}
            onChange={() => setMode('lifetime')}
          />
          <span>生涯</span>
        </label>

        {showEducation && (
          <label className="radio-option">
            <input
              type="radio"
              name={`period-${member.id}`}
              checked={householdPeriod.mode === 'by_education'}
              onChange={() => setMode('by_education')}
            />
            <span>最終学歴にあわせる</span>
          </label>
        )}

        <label className="radio-option">
          <input
            type="radio"
            name={`period-${member.id}`}
            checked={householdPeriod.mode === 'custom'}
            onChange={() => setMode('custom')}
          />
          <span>期間を指定する</span>
        </label>
      </fieldset>

      {householdPeriod.mode === 'custom' && (
        <div className="period-custom">
          <div className="period-range">
            <span className="period-range-label">生誕</span>
            <span className="period-range-arrow">〜</span>
            <select
              className="select-input select-input--compact"
              value={householdPeriod.endAge}
              onChange={(e) => setEndAge(Number(e.target.value))}
            >
              {AGES.map((age) => (
                <option key={age} value={age}>
                  {age}才
                </option>
              ))}
            </select>
            <select
              className="select-input select-input--compact"
              value={householdPeriod.endMonth}
              onChange={(e) => setEndMonth(Number(e.target.value))}
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m}月
                </option>
              ))}
            </select>
          </div>
          {endYear !== null && (
            <p className="period-end-year">{endYear}年</p>
          )}
        </div>
      )}
    </div>
  );
}

export function FamilyMemberRow({
  member,
  referenceDate,
  onChange,
  onRemove,
  canRemove,
}: FamilyMemberRowProps) {
  const birthLabel = isMemberBirthComplete(member)
    ? formatBirthLabel(
        member.age,
        member.birthMonth,
        referenceDate,
        member.birthDay,
      )
    : '';

  const dayOptions = getBirthDayOptions(
    member.age,
    member.birthMonth,
    referenceDate,
  );

  const clampBirthDay = (
    next: Pick<FamilyMember, 'age' | 'birthMonth' | 'birthDay'>,
  ): number | null => {
    if (next.birthDay == null) return null;
    const maxDay = getBirthDayOptions(
      next.age,
      next.birthMonth,
      referenceDate,
    ).length;
    return Math.min(next.birthDay, maxDay);
  };

  const addHobby = () => {
    const hobby = window.prompt('趣味・関心を入力');
    if (hobby?.trim()) {
      onChange({ ...member, hobbies: [...member.hobbies, hobby.trim()] });
    }
  };

  const removeHobby = (index: number) => {
    onChange({
      ...member,
      hobbies: member.hobbies.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="family-row">
      <div className="family-row-cell member-cell">
        <input
          type="text"
          className="nickname-input"
          placeholder="ニックネーム"
          value={member.nickname}
          onChange={(e) => onChange({ ...member, nickname: e.target.value })}
        />
        <MemberAvatar role={member.role} />
        <span className="member-role">{ROLE_LABELS[member.role]}</span>
      </div>

      <div className="family-row-cell profile-cell">
        <div className="profile-grid">
          <div className="profile-birth">
            <SelectField
              label="生年月日"
              value={member.age}
              allowEmpty
              emptyLabel=""
              onChange={(age) => {
                const birthDay = clampBirthDay({
                  age,
                  birthMonth: member.birthMonth,
                  birthDay: member.birthDay,
                });
                onChange({
                  ...member,
                  age,
                  birthDay,
                  ...(member.role === 'other' &&
                  age != null &&
                  age < ELDERLY_DEPENDENT_MIN_AGE
                    ? { isCohabiting: undefined }
                    : {}),
                });
              }}
              options={getAgeOptions(member.role).map((a) => ({
                value: a,
                label: `${a}才`,
              }))}
            />
            <SelectField
              label=""
              value={member.birthMonth}
              allowEmpty
              emptyLabel=""
              onChange={(birthMonth) => {
                const birthDay = clampBirthDay({
                  age: member.age,
                  birthMonth,
                  birthDay: member.birthDay,
                });
                onChange({ ...member, birthMonth, birthDay });
              }}
              options={MONTHS.map((m) => ({ value: m, label: `${m}月` }))}
            />
            <SelectField
              label=""
              value={member.birthDay}
              allowEmpty
              emptyLabel=""
              onChange={(birthDay) => onChange({ ...member, birthDay })}
              options={dayOptions.map((d) => ({
                value: d,
                label: `${d}日`,
              }))}
            />
            {birthLabel ? <p className="birth-label">{birthLabel}</p> : null}
          </div>

          <SelectField
            label="性別"
            value={member.gender === 'male' ? 0 : 1}
            onChange={(v) => {
              if (v == null) return;
              onChange({ ...member, gender: v === 0 ? 'male' : 'female' });
            }}
            options={[
              { value: 0, label: '男' },
              { value: 1, label: '女' },
            ]}
          />

          <SelectField
            label="想定寿命"
            value={member.expectedLifespan}
            onChange={(expectedLifespan) => {
              if (expectedLifespan == null) return;
              onChange({ ...member, expectedLifespan });
            }}
            options={LIFESPANS.map((a) => ({ value: a, label: `${a}才` }))}
          />

          <SelectField
            label="障害"
            value={member.disability === 'none' ? 0 : 1}
            onChange={(v) => {
              if (v == null) return;
              onChange({
                ...member,
                disability: v === 0 ? 'none' : 'has',
              });
            }}
            options={[
              { value: 0, label: 'なし' },
              { value: 1, label: 'あり' },
            ]}
          />

          {(member.role === 'child' || member.role === 'other') && (
            <DependentSettingsSection member={member} onChange={onChange} />
          )}
        </div>
      </div>

      <div className="family-row-cell hobbies-cell">
        <div className="hobbies-box">
          {member.hobbies.length === 0 ? (
            <span className="hobbies-placeholder">趣味・関心</span>
          ) : (
            <ul className="hobbies-list">
              {member.hobbies.map((hobby, i) => (
                <li key={i}>
                  <span>{hobby}</span>
                  <button
                    type="button"
                    className="hobby-remove"
                    onClick={() => removeHobby(i)}
                    aria-label="削除"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="hobby-add-btn" onClick={addHobby}>
            追加
          </button>
        </div>
      </div>

      <div className="family-row-cell period-column">
        {member.role !== 'head' && (
          <p className="period-column-title">世帯主と生計を一にする期間</p>
        )}
        <HouseholdPeriodSection
          member={member}
          referenceDate={referenceDate}
          onChange={onChange}
        />
      </div>

      <div className="family-row-cell action-cell">
        {canRemove && (
          <button
            type="button"
            className="remove-member-btn"
            onClick={onRemove}
            aria-label="家族を削除"
          >
            −
          </button>
        )}
      </div>
    </div>
  );
}

function DependentSettingsSection({
  member,
  onChange,
}: {
  member: FamilyMember;
  onChange: (member: FamilyMember) => void;
}) {
  const taxDep = member.taxDependentDefault ?? true;
  const siDep = member.socialInsuranceDependentDefault ?? true;
  const warnings = validateMemberDependentDefaults(member);
  const showPensionGuide = shouldShowParentPensionGuide(member);
  const pensionGuideMessage = showPensionGuide
    ? buildParentPensionGuideMessage(
        getMemberTabLabel(member),
        getParentPensionGuideDeductionLabel(member),
      )
    : null;

  return (
    <div className="profile-dependent">
      {member.role === 'other' && (
        <div className="inline-field">
          <span className="inline-field-label">続柄</span>
          <div className="inline-field-controls">
            <select
              className="select-input select-input--wide"
              value={member.otherRelationship ?? 'parent'}
              onChange={(e) =>
                onChange({
                  ...member,
                  otherRelationship: e.target.value as OtherRelationship,
                  isCohabiting:
                    e.target.value === 'parent' || e.target.value === 'grandparent'
                      ? (member.isCohabiting ?? false)
                      : undefined,
                })
              }
            >
              {(
                Object.entries(OTHER_RELATIONSHIP_LABELS) as [
                  OtherRelationship,
                  string,
                ][]
              ).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {isElderlyParentOrGrandparent(member) && (
        <label className="profile-checkbox-option">
          <input
            type="checkbox"
            checked={member.isCohabiting ?? false}
            onChange={(e) =>
              onChange({ ...member, isCohabiting: e.target.checked })
            }
          />
          <span>同居（同居老親等控除）</span>
        </label>
      )}

      {isParentOrGrandparent(member) &&
        (member.age ?? 0) < ELDERLY_DEPENDENT_MIN_AGE && (
          <p className="profile-dependent-note">
            70歳未満のため一般扶養控除の対象です。同居老親等控除・老人扶養控除は70歳以上から適用されます。
          </p>
        )}

      <label className="profile-checkbox-option">
        <input
          type="checkbox"
          checked={taxDep}
          onChange={(e) =>
            onChange({ ...member, taxDependentDefault: e.target.checked })
          }
        />
        <span>税法上の扶養に入れる</span>
      </label>

      <label className="profile-checkbox-option">
        <input
          type="checkbox"
          checked={siDep}
          onChange={(e) =>
            onChange({
              ...member,
              socialInsuranceDependentDefault: e.target.checked,
            })
          }
        />
        <span>社会保険の扶養に入れる</span>
      </label>

      {warnings.map((w) => (
        <p key={w.id} className="profile-dependent-warning">
          {w.message}
        </p>
      ))}

      {pensionGuideMessage && (
        <p className="profile-dependent-guide">{pensionGuideMessage}</p>
      )}

      <p className="profile-dependent-note">
        合計所得58万円超の年は税法上の扶養控除は外れます（令和7年分以降。給与のみの目安は年収約123万円）。
        {siDep && '収入130万円以上の年は社保の扶養から外れます。'}
      </p>
    </div>
  );
}
