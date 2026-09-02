import {
  calcBirthYear,
  calcPensionTimelinePivotRatio,
  calcYearAtAge,
} from '../../lib/birthDate';
import { resolveMemberBirthMonth } from '../../lib/familyDefaults';
import type { FamilyMember } from '../../types/family';
import type { PastEnrollmentMode } from '../../types/pension';

const TIMELINE_START_AGE = 20;
const TIMELINE_END_AGE = 65;
const TIMELINE_STEP = 5;

interface EnrollmentTimelineProps {
  member: FamilyMember;
  referenceDate: Date;
  pastEnrollment: PastEnrollmentMode;
  recentMonthlyYear?: number;
  recentMonthlyMonth?: number;
}

function buildTimelineTicks(
  member: FamilyMember,
  referenceDate: Date,
): { age: number; year: number }[] {
  const birthYear = calcBirthYear(
    member.age,
    member.birthMonth,
    referenceDate,
  );
  const ticks: { age: number; year: number }[] = [];

  for (
    let age = TIMELINE_START_AGE;
    age <= TIMELINE_END_AGE;
    age += TIMELINE_STEP
  ) {
    ticks.push({
      age,
      year: calcYearAtAge(
        birthYear,
        resolveMemberBirthMonth(member),
        age,
        resolveMemberBirthMonth(member),
      ),
    });
  }

  return ticks;
}

function isTeikibinMode(mode: PastEnrollmentMode): boolean {
  return (
    mode === 'nenkin-teikibin-under50' || mode === 'nenkin-teikibin-over50'
  );
}

export function EnrollmentTimeline({
  member,
  referenceDate,
  pastEnrollment,
  recentMonthlyYear,
  recentMonthlyMonth,
}: EnrollmentTimelineProps) {
  const ticks = buildTimelineTicks(member, referenceDate);
  const showTeikibinSplit =
    isTeikibinMode(pastEnrollment) &&
    recentMonthlyYear != null &&
    recentMonthlyMonth != null;

  let pivotRatio = 0;
  let pivotLabel = '';

  if (showTeikibinSplit) {
    const birthYear = calcBirthYear(
      member.age,
      member.birthMonth,
      referenceDate,
    );
    pivotRatio = calcPensionTimelinePivotRatio(
      birthYear,
      resolveMemberBirthMonth(member),
      recentMonthlyYear,
      recentMonthlyMonth,
      TIMELINE_START_AGE,
      TIMELINE_END_AGE,
    );
    pivotLabel = `${recentMonthlyYear}年${recentMonthlyMonth}月時点`;
  }

  const pivotPercent = pivotRatio * 100;

  return (
    <div className="pension-timeline">
      <div className="pension-timeline-axis">
        {ticks.map((tick) => (
          <div key={tick.age} className="pension-timeline-tick">
            <span className="pension-timeline-age">{tick.age}才</span>
            <span className="pension-timeline-year">({tick.year})</span>
          </div>
        ))}
      </div>

      {showTeikibinSplit ? (
        <div className="pension-timeline-bars">
          <div
            className="pension-timeline-bar pension-timeline-bar--teikibin"
            style={{ width: `${pivotPercent}%` }}
          >
            ねんきん定期便
          </div>
          <div
            className="pension-timeline-bar pension-timeline-bar--income"
            style={{ width: `${100 - pivotPercent}%` }}
          >
            Q7.収入設定から自動判別
          </div>
          <div
            className="pension-timeline-pivot"
            style={{ left: `${pivotPercent}%` }}
          >
            <div className="pension-timeline-pivot-bubble">
              <span className="pension-timeline-pivot-date">{pivotLabel}</span>
              <span className="pension-timeline-pivot-months">0ヶ月</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="pension-timeline-bar pension-timeline-bar--income pension-timeline-bar--full">
          Q7.収入設定から自動判別
        </div>
      )}
    </div>
  );
}
