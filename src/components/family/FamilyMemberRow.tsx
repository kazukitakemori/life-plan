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
  DisabilityGrade,
  DisabilityPensionStatus,
  FamilyMember,
  PensionChildResidenceStatus,
  HouseholdPeriodMode,
  OtherRelationship,
} from '../../types/family';
import {
  DISABILITY_GRADE_LABELS,
  DISABILITY_PENSION_LABELS,
  OTHER_RELATIONSHIP_LABELS,
  PENSION_CHILD_RESIDENCE_LABELS,
  ROLE_LABELS,
} from '../../types/family';
import {
  DisclosureSection,
  FormChoice,
  FormField,
  FormSelect,
} from '../ui';
import { MemberAvatar } from './MemberAvatar';

interface FamilyMemberRowProps {
  member: FamilyMember;
  members: FamilyMember[];
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

function parseOptionalNumber(raw: string): number | null {
  return raw === '' ? null : Number(raw);
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

  if (role === 'head') {
    return (
      <p className="ui-note">世帯主のため設定不要です</p>
    );
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
    <div className="family-period">
      <fieldset className="family-period-options">
        <legend className="visually-hidden">生計を一にする期間</legend>
        <FormChoice
          type="radio"
          name={`period-${member.id}`}
          checked={householdPeriod.mode === 'lifetime'}
          onChange={() => setMode('lifetime')}
        >
          生涯
        </FormChoice>

        {showEducation && (
          <FormChoice
            type="radio"
            name={`period-${member.id}`}
            checked={householdPeriod.mode === 'by_education'}
            onChange={() => setMode('by_education')}
          >
            最終学歴にあわせる
          </FormChoice>
        )}

        <FormChoice
          type="radio"
          name={`period-${member.id}`}
          checked={householdPeriod.mode === 'custom'}
          onChange={() => setMode('custom')}
        >
          期間を指定する
        </FormChoice>
      </fieldset>

      {householdPeriod.mode === 'custom' && (
        <div className="family-period-custom">
          <div className="family-period-range">
            <span>生誕</span>
            <span aria-hidden>〜</span>
            <FormSelect
              compact
              value={householdPeriod.endAge}
              onValueChange={(raw) =>
                onChange({
                  ...member,
                  householdPeriod: {
                    ...householdPeriod,
                    endAge: Number(raw),
                  },
                })
              }
              options={AGES.map((age) => ({
                value: age,
                label: `${age}才`,
              }))}
            />
            <FormSelect
              compact
              value={householdPeriod.endMonth}
              onValueChange={(raw) =>
                onChange({
                  ...member,
                  householdPeriod: {
                    ...householdPeriod,
                    endMonth: Number(raw),
                  },
                })
              }
              options={MONTHS.map((m) => ({
                value: m,
                label: `${m}月`,
              }))}
            />
          </div>
          {endYear !== null && (
            <p className="ui-note">{endYear}年まで</p>
          )}
        </div>
      )}
    </div>
  );
}

export function FamilyMemberRow({
  member,
  members,
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

  const detailSummaryParts: string[] = [];
  const disabilityPensionStatus = member.disabilityPension ?? 'none';
  if (member.disability === 'has') {
    const grade = member.disabilityGrade ?? 'none';
    if (grade !== 'none') {
      detailSummaryParts.push(`障害${DISABILITY_GRADE_LABELS[grade]}`);
    } else {
      detailSummaryParts.push('障害あり');
    }
  }
  if (disabilityPensionStatus !== 'none') {
    detailSummaryParts.push(DISABILITY_PENSION_LABELS[disabilityPensionStatus]);
  }
  if (member.hobbies.length > 0) {
    detailSummaryParts.push(`趣味${member.hobbies.length}`);
  }
  if (member.role === 'child' || member.role === 'other') {
    detailSummaryParts.push('扶養設定');
  }

  return (
    <article className="family-member-card">
      <header className="family-member-card-head">
        <div className="family-member-identity">
          <MemberAvatar
            role={member.role}
            gender={member.gender}
            age={member.age}
          />
          <div className="family-member-identity-text">
            <input
              type="text"
              className="ui-input ui-input--title"
              placeholder="ニックネーム"
              value={member.nickname}
              onChange={(e) =>
                onChange({ ...member, nickname: e.target.value })
              }
              aria-label="ニックネーム"
            />
            <span className="family-role-badge">{ROLE_LABELS[member.role]}</span>
          </div>
        </div>

        {canRemove && (
          <button
            type="button"
            className="ui-btn ui-btn--danger"
            onClick={onRemove}
          >
            削除
          </button>
        )}
      </header>

      <div className="family-member-card-body">
        <section className="family-basics" aria-label="よく使う項目">
          <h3 className="family-section-label">基本情報</h3>
          <div className="family-basics-grid">
            <FormField label="生年月日" className="family-basics-birth">
              <div className="family-birth-controls">
                <FormSelect
                  allowEmpty
                  emptyLabel="才"
                  value={member.age ?? ''}
                  onValueChange={(raw) => {
                    const age = parseOptionalNumber(raw);
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
                <FormSelect
                  allowEmpty
                  emptyLabel="月"
                  value={member.birthMonth ?? ''}
                  onValueChange={(raw) => {
                    const birthMonth = parseOptionalNumber(raw);
                    const birthDay = clampBirthDay({
                      age: member.age,
                      birthMonth,
                      birthDay: member.birthDay,
                    });
                    onChange({ ...member, birthMonth, birthDay });
                  }}
                  options={MONTHS.map((m) => ({
                    value: m,
                    label: `${m}月`,
                  }))}
                />
                <FormSelect
                  allowEmpty
                  emptyLabel="日"
                  value={member.birthDay ?? ''}
                  onValueChange={(raw) =>
                    onChange({
                      ...member,
                      birthDay: parseOptionalNumber(raw),
                    })
                  }
                  options={dayOptions.map((d) => ({
                    value: d,
                    label: `${d}日`,
                  }))}
                />
              </div>
              {birthLabel ? <p className="ui-note">{birthLabel}</p> : null}
            </FormField>

            <FormField label="性別">
              <FormSelect
                value={member.gender === 'male' ? 0 : 1}
                onValueChange={(raw) =>
                  onChange({
                    ...member,
                    gender: Number(raw) === 0 ? 'male' : 'female',
                  })
                }
                options={[
                  { value: 0, label: '男' },
                  { value: 1, label: '女' },
                ]}
              />
            </FormField>

            <FormField label="想定寿命">
              <FormSelect
                value={member.expectedLifespan}
                onValueChange={(raw) =>
                  onChange({
                    ...member,
                    expectedLifespan: Number(raw),
                  })
                }
                options={LIFESPANS.map((a) => ({
                  value: a,
                  label: `${a}才`,
                }))}
              />
            </FormField>
          </div>

          {member.role !== 'head' && (
            <div className="family-period-block">
              <h3 className="family-section-label">
                世帯主と生計を一にする期間
              </h3>
              <HouseholdPeriodSection
                member={member}
                referenceDate={referenceDate}
                onChange={onChange}
              />
            </div>
          )}
        </section>

        <DisclosureSection
          className="family-details"
          title="詳細設定"
          summary={
            detailSummaryParts.length > 0
              ? detailSummaryParts.join(' · ')
              : '障害・趣味・扶養など'
          }
        >
          <div className="family-details-grid">
            <FormField label="障害">
              <FormSelect
                value={member.disability === 'none' ? 0 : 1}
                onValueChange={(raw) => {
                  const disability =
                    Number(raw) === 0 ? 'none' : 'has';
                  onChange({
                    ...member,
                    disability,
                    ...(disability === 'none'
                      ? { disabilityGrade: 'none' as const }
                      : {}),
                  });
                }}
                options={[
                  { value: 0, label: 'なし' },
                  { value: 1, label: 'あり' },
                ]}
              />
            </FormField>

            <div className="family-disability-pension-block">
              {member.disability === 'has' && (
                <>
                  <FormField label="障害等級・状態">
                    <FormSelect
                      wide
                      value={member.disabilityGrade ?? 'none'}
                      onValueChange={(raw) =>
                        onChange({
                          ...member,
                          disabilityGrade: raw as DisabilityGrade,
                        })
                      }
                      options={(
                        Object.entries(DISABILITY_GRADE_LABELS) as Array<
                          [DisabilityGrade, string]
                        >
                      ).map(([value, label]) => ({ value, label }))}
                    />
                  </FormField>
                  <p className="ui-note">
                    子の年金加算などでは、1級・2級の障害状態かどうかを使います。
                  </p>
                </>
              )}

              <FormField label="障害年金の受給権（現在）">
                <FormSelect
                  wide
                  value={member.disabilityPension ?? 'none'}
                  onValueChange={(raw) =>
                    onChange({
                      ...member,
                      disabilityPension: raw as DisabilityPensionStatus,
                    })
                  }
                  options={(
                    Object.entries(DISABILITY_PENSION_LABELS) as Array<
                      [DisabilityPensionStatus, string]
                    >
                  ).map(([value, label]) => ({ value, label }))}
                />
              </FormField>
              <p className="ui-note">
                現在の障害状態と障害年金の受給権は別々に保存します。障害の程度が軽くなって支給停止中でも受給権が残る場合があるため、「障害なし」にしても受給権は自動で消しません。障害年金の年額・初診日・障害認定日・受給開始／失権年月・全額支給停止の状況は未入力のため、障害年金額そのものはQ8・キャッシュフローへ自動反映しません。
              </p>
            </div>

            {(member.role === 'child' ||
              (member.role === 'other' &&
                member.otherRelationship === 'grandchild')) && (
              <div className="family-disability-pension-block">
                <FormField label="年金上の居住状況">
                  <FormSelect
                    wide
                    value={member.pensionChildResidence ?? 'unknown'}
                    onValueChange={(raw) =>
                      onChange({
                        ...member,
                        pensionChildResidence:
                          raw as PensionChildResidenceStatus,
                      })
                    }
                    options={(
                      Object.entries(PENSION_CHILD_RESIDENCE_LABELS) as Array<
                        [PensionChildResidenceStatus, string]
                      >
                    ).map(([value, label]) => ({ value, label }))}
                  />
                </FormField>
                <p className="ui-note">
                  2028年4月以降の年金の子の加算に使います。海外でも、
                  留学など日本国内に生活の基礎があると認められる場合は例外対象です。
                </p>
              </div>
            )}

                        <div className="family-hobbies-block">
              <div className="family-panel-title-row">
                <h4 className="family-section-label">趣味・関心</h4>
                <button
                  type="button"
                  className="ui-btn ui-btn--ghost"
                  onClick={addHobby}
                >
                  追加
                </button>
              </div>
              {member.hobbies.length === 0 ? (
                <p className="ui-note">まだ登録がありません</p>
              ) : (
                <ul className="family-hobbies-list">
                  {member.hobbies.map((hobby, i) => (
                    <li key={i}>
                      <span>{hobby}</span>
                      <button
                        type="button"
                        className="family-hobby-remove"
                        onClick={() => removeHobby(i)}
                        aria-label={`${hobby}を削除`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {(member.role === 'child' || member.role === 'other') && (
              <DependentSettingsSection member={member} onChange={onChange} />
            )}
          </div>
        </DisclosureSection>
      </div>
    </article>
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
    <div className="family-dependent">
      <h4 className="family-section-label">扶養・続柄</h4>

      {member.role === 'other' && (
        <FormField label="続柄">
          <FormSelect
            wide
            value={member.otherRelationship ?? 'parent'}
            onValueChange={(raw) =>
              onChange({
                ...member,
                otherRelationship: raw as OtherRelationship,
                isCohabiting:
                  raw === 'parent' || raw === 'grandparent'
                    ? (member.isCohabiting ?? false)
                    : undefined,
              })
            }
            options={(
              Object.entries(OTHER_RELATIONSHIP_LABELS) as [
                OtherRelationship,
                string,
              ][]
            ).map(([key, label]) => ({ value: key, label }))}
          />
        </FormField>
      )}

      {isElderlyParentOrGrandparent(member) && (
        <FormChoice
          checked={member.isCohabiting ?? false}
          onChange={(e) =>
            onChange({ ...member, isCohabiting: e.target.checked })
          }
        >
          同居（同居老親等控除）
        </FormChoice>
      )}

      {isParentOrGrandparent(member) &&
        (member.age ?? 0) < ELDERLY_DEPENDENT_MIN_AGE && (
          <p className="ui-note">
            70歳未満のため一般扶養控除の対象です。同居老親等控除・老人扶養控除は70歳以上から適用されます。
          </p>
        )}

      <FormChoice
        checked={taxDep}
        onChange={(e) =>
          onChange({ ...member, taxDependentDefault: e.target.checked })
        }
      >
        税法上の扶養に入れる
      </FormChoice>

      <FormChoice
        checked={siDep}
        onChange={(e) =>
          onChange({
            ...member,
            socialInsuranceDependentDefault: e.target.checked,
          })
        }
      >
        社会保険の扶養に入れる
      </FormChoice>

      {warnings.map((w) => (
        <p key={w.id} className="ui-callout ui-callout--danger">
          {w.message}
        </p>
      ))}

      {pensionGuideMessage && (
        <p className="ui-callout ui-callout--brand">{pensionGuideMessage}</p>
      )}

      <p className="ui-note">
        合計所得58万円超の年は税法上の扶養控除は外れます（令和7年分以降。給与のみの目安は年収約123万円）。
        {siDep && '収入130万円以上の年は社保の扶養から外れます。'}
      </p>
    </div>
  );
}
