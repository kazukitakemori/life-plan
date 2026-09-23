import type { FamilyMember } from '../../types/family';
import type {
  PastEnrollmentMode,
  PensionMemberState,
} from '../../types/pension';
import {
  resolveOver50AnySpecialStartAge,
  resolveOver50GeneralSpecialStartAge,
  resolveOver50PublicPrivateSpecialStartAge,
} from '../../lib/pensionIncome';
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
  referenceDate: Date;
  memberState: PensionMemberState;
  onChange: (state: PensionMemberState) => void;
}

const PENSION_SOURCE_OPTIONS: Array<{
  value: PastEnrollmentMode;
  title: string;
  description: string;
  badge?: string;
}> = [
  {
    value: 'none',
    title: '収入情報から概算',
    description: 'Q7「収入」の内容から加入状況を推定して試算します。',
    badge: 'かんたん',
  },
  {
    value: 'nenkin-teikibin-under50',
    title: 'ねんきん定期便から入力',
    description: '50歳未満の方向けの定期便をお持ちの場合。',
  },
  {
    value: 'nenkin-teikibin-over50',
    title: 'ねんきん定期便から入力',
    description: '50歳以上の方向けの定期便をお持ちの場合。',
  },
];

export function PublicPensionSection({
  member,
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
  const specialEmployeesStartAge =
    pastEnrollment === 'nenkin-teikibin-over50'
      ? resolveOver50AnySpecialStartAge(resolvedTeikibinOver50)
      : null;
  const generalSpecialStartAge =
    pastEnrollment === 'nenkin-teikibin-over50'
      ? resolveOver50GeneralSpecialStartAge(resolvedTeikibinOver50)
      : null;
  const publicSpecialStartAge =
    pastEnrollment === 'nenkin-teikibin-over50'
      ? resolveOver50PublicPrivateSpecialStartAge(resolvedTeikibinOver50)
      : null;

  const handlePastEnrollmentChange = (mode: PastEnrollmentMode) => {
    onChange({ ...memberState, pastEnrollment: mode });
  };

  return (
    <section className="pension-section">
      <h3 className="pension-section-title">公的年金</h3>

      <div className="pension-subsection">
        <h4 className="pension-subsection-title">加入実績</h4>

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
          <fieldset className="pension-source-choice">
            <legend className="pension-enrollment-label">
              試算に使う情報
            </legend>
            <div className="pension-source-options">
              {PENSION_SOURCE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="pension-source-option"
                >
                  <input
                    type="radio"
                    name={`past-enrollment-${member.id}`}
                    value={option.value}
                    checked={pastEnrollment === option.value}
                    onChange={() => handlePastEnrollmentChange(option.value)}
                  />
                  <span className="pension-source-option-copy">
                    <span className="pension-source-option-title-row">
                      <span className="pension-source-option-title">
                        {option.title}
                      </span>
                      {option.badge ? (
                        <span className="pension-source-option-badge">
                          {option.badge}
                        </span>
                      ) : null}
                    </span>
                    <span className="pension-source-option-description">
                      {option.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {pastEnrollment === 'none' && (
            <div className="pension-info-box pension-info-box--estimate">
              <p className="pension-info-emphasis">
                ねんきん定期便が手元になくても試算できます。
              </p>
              <p>
                Q7「収入」の内容をもとに、これまでと今後の加入状況を推定して老齢年金額を計算します。
              </p>
              <p>
                遺族年金の保険料納付要件は収入情報から推測しません。ねんきん定期便がない場合は、「受給設定」で確認結果を指定できます。
              </p>
              <details className="pension-assumption-details">
                <summary>概算の前提を見る</summary>
                <p>
                  現在の推定では、大卒22歳4月就職を想定し、20歳4月〜22歳3月の24か月は学生納付特例等を利用し、追納していない期間として老齢基礎年金額の算定から除外します。この期間は老齢年金の10年受給資格期間には含めます。
                </p>
              </details>
            </div>
          )}

          {pastEnrollment === 'nenkin-teikibin-under50' && (
            <>
              <p className="pension-source-helper">
                お手元のねんきん定期便を見ながら、同じ項目を入力してください。
              </p>
              <NenkinTeikibinUnder50FormPanel
                form={teikibinUnder50}
                onChange={(form) =>
                  onChange({ ...memberState, teikibinUnder50: form })
                }
              />
            </>
          )}

          {pastEnrollment === 'nenkin-teikibin-over50' && (
            <>
              <p className="pension-source-helper">
                お手元のねんきん定期便を見ながら、同じ項目を入力してください。
              </p>
              <NenkinTeikibinOver50FormPanel
                form={resolvedTeikibinOver50}
                onChange={(form) =>
                  onChange({ ...memberState, teikibinOver50: form })
                }
              />
            </>
          )}
        </div>
      </div>

      <BenefitSettingsSection
        member={member}
        referenceDate={referenceDate}
        settings={resolvedBenefitSettings}
        specialEmployeesStartAge={specialEmployeesStartAge}
        generalSpecialStartAge={generalSpecialStartAge}
        publicSpecialStartAge={publicSpecialStartAge}
        onChange={(settings) =>
          onChange({ ...memberState, benefitSettings: settings })
        }
      />
    </section>
  );
}
