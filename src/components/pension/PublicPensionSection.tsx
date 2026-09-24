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
import { InfoDialog } from '../ui';
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

type PensionSourceChoice = 'input' | 'teikibin';

const PENSION_SOURCE_OPTIONS: Array<{
  value: PensionSourceChoice;
  title: string;
  description: string;
  badge?: string;
}> = [
  {
    value: 'input',
    title: '入力内容から試算',
    description: 'Q1・Q7などの入力内容から公的年金を試算します。',
    badge: 'かんたん',
  },
  {
    value: 'teikibin',
    title: 'ねんきん定期便から試算',
    description: 'ねんきん定期便の記載内容をもとに試算します。',
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

  const sourceChoice: PensionSourceChoice =
    pastEnrollment === 'none' ? 'input' : 'teikibin';

  const handleSourceChange = (choice: PensionSourceChoice) => {
    if (choice === 'input') {
      onChange({ ...memberState, pastEnrollment: 'none' });
      return;
    }
    const teikibinMode: PastEnrollmentMode =
      pastEnrollment === 'nenkin-teikibin-under50' ||
      pastEnrollment === 'nenkin-teikibin-over50'
        ? pastEnrollment
        : member.age < 50
          ? 'nenkin-teikibin-under50'
          : 'nenkin-teikibin-over50';
    onChange({ ...memberState, pastEnrollment: teikibinMode });
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
                    checked={sourceChoice === option.value}
                    onChange={() => handleSourceChange(option.value)}
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
            <div className="pension-context-info">
              <InfoDialog title="概算の前提" label="概算の前提">
                <p>
                  20歳〜22歳は学生納付特例等を利用し、追納していない期間として概算します。受給資格期間には含めます。
                </p>
              </InfoDialog>
            </div>
          )}

          {pastEnrollment === 'nenkin-teikibin-under50' && (
            <NenkinTeikibinUnder50FormPanel
              form={teikibinUnder50}
              onChange={(form) =>
                onChange({ ...memberState, teikibinUnder50: form })
              }
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
        member={member}
        referenceDate={referenceDate}
        settings={resolvedBenefitSettings}
        specialEmployeesStartAge={specialEmployeesStartAge}
        generalSpecialStartAge={generalSpecialStartAge}
        publicSpecialStartAge={publicSpecialStartAge}
        survivorEstimateSource={pastEnrollment === 'none' ? 'input' : 'teikibin'}
        onChange={(settings) =>
          onChange({ ...memberState, benefitSettings: settings })
        }
      />
    </section>
  );
}
