import type { FamilyMember } from '../../types/family';
import type { PensionMemberState } from '../../types/pension';
import { PAST_ENROLLMENT_OPTIONS, type PastEnrollmentMode } from '../../types/pension';
import {
  createDefaultBenefitSettings,
  createDefaultTeikibinOver50Form,
  migrateTeikibinOver50Form,
} from '../../lib/pensionDefaults';
import { BenefitSettingsSection } from './BenefitSettingsSection';
import { EnrollmentTimeline } from './EnrollmentTimeline';
import {
  NenkinTeikibinOver50FormPanel,
  NenkinTeikibinUnder50FormPanel,
} from './NenkinTeikibinFormPanel';

interface PublicPensionSectionProps {
  member: FamilyMember;
  headOfHouseholdLabel: string;
  referenceDate: Date;
  memberState: PensionMemberState;
  onChange: (state: PensionMemberState) => void;
}

export function PublicPensionSection({
  member,
  headOfHouseholdLabel,
  referenceDate,
  memberState,
  onChange,
}: PublicPensionSectionProps) {
  const { pastEnrollment, teikibinUnder50, teikibinOver50, benefitSettings } =
    memberState;
  const resolvedBenefitSettings =
    benefitSettings ?? createDefaultBenefitSettings();
  const resolvedTeikibinOver50 = migrateTeikibinOver50Form(
    teikibinOver50 ?? createDefaultTeikibinOver50Form(),
  );

  const handlePastEnrollmentChange = (mode: PastEnrollmentMode) => {
    onChange({ ...memberState, pastEnrollment: mode });
  };

  return (
    <section className="pension-section">
      <h3 className="pension-section-title">1. 公的年金</h3>

      <div className="pension-subsection">
        <h4 className="pension-subsection-title">(1) 年金加入実績</h4>

        <EnrollmentTimeline
          member={member}
          referenceDate={referenceDate}
          pastEnrollment={pastEnrollment}
          recentMonthlyYear={
            pastEnrollment === 'nenkin-teikibin-under50'
              ? teikibinUnder50.recentMonthlyYear
              : pastEnrollment === 'nenkin-teikibin-over50'
                ? resolvedTeikibinOver50.recentMonthlyYear
                : undefined
          }
          recentMonthlyMonth={
            pastEnrollment === 'nenkin-teikibin-under50'
              ? teikibinUnder50.recentMonthlyMonth
              : pastEnrollment === 'nenkin-teikibin-over50'
                ? resolvedTeikibinOver50.recentMonthlyMonth
                : undefined
          }
        />

        <div className="pension-enrollment-panel">
          <div className="pension-enrollment-field">
            <label
              className="pension-enrollment-label"
              htmlFor={`past-enrollment-${member.id}`}
            >
              過去の加入実績：
            </label>
            <select
              id={`past-enrollment-${member.id}`}
              className="select-input pension-enrollment-select"
              value={pastEnrollment}
              onChange={(e) =>
                handlePastEnrollmentChange(e.target.value as PastEnrollmentMode)
              }
            >
              {PAST_ENROLLMENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span
              className="pension-help-icon"
              title="過去の年金加入実績について"
            >
              ?
            </span>
          </div>

          {pastEnrollment === 'none' && (
            <div className="pension-info-box">
              <p className="pension-info-emphasis">
                ※ 正確な年金額を算出するには、可能な限り入力してください。
              </p>
              <p>
                プルダウンから「ねんきん定期便（50歳未満の方タイプ）」または「ねんきん定期便（50歳以上の方タイプ）」を選択すると、ねんきん定期便の内容をそのまま入力できます。
                入力しない場合は、Q7.収入設定の内容をもとに加入実績を推定します。大卒22歳4月就職を想定し、20歳4月〜22歳3月の24か月は大学在学中の国民年金猶予（保険料未納）として老齢基礎年金の算定から除外します。
              </p>
            </div>
          )}

          {pastEnrollment === 'nenkin-teikibin-under50' && (
            <NenkinTeikibinUnder50FormPanel
              form={teikibinUnder50}
              onChange={(form) => onChange({ ...memberState, teikibinUnder50: form })}
            />
          )}

          {pastEnrollment === 'nenkin-teikibin-over50' && (
            <NenkinTeikibinOver50FormPanel
              form={resolvedTeikibinOver50}
              onChange={(form) =>
                onChange({ ...memberState, teikibinOver50: form })
              }
            />
          )}
        </div>
      </div>

      <BenefitSettingsSection
        settings={resolvedBenefitSettings}
        headOfHouseholdLabel={headOfHouseholdLabel}
        onChange={(settings) =>
          onChange({ ...memberState, benefitSettings: settings })
        }
      />
    </section>
  );
}
