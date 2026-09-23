/**
 * 公的年金（老齢）の月次内訳計算。
 * v1 簡略化: 物価スライド・障害/寡婦年金の自動計算は未対応。
 */
import { resolveMemberBirthMonth } from './familyDefaults';
import {
  calcBirthYear,
  calendarYearFromAgeCalendarMonth,
} from './birthDate';
import {
  isEligiblePensionChildAdditionResidence,
  isEligibleSurvivorBasicChild,
  survivorBasicChildAddYenPerYear,
} from './survivorBasicPension';
import { calcTaxableOldAgePensionPaymentMan } from './pensionPaymentSchedule';
import {
  calcTransitionalAdditionYenPerYear,
  countQ7EmployeesMonthsAfterDate,
  estimateEmployeesMonthsForDependentQualification,
  estimateOldAgeAmountsFromIncome,
  estimateQ7FuturePensionAdditionsAfterDate,
  getActiveEmployeesTotalRemunerationMan,
  estimatePost65EmployeesPensionIncreaseMan,
  getEmployeesEnrollmentMonthCounts,
  getEstimatedOldAgeQualifyingMonthCount,
} from './pensionEnrollmentEstimate';
import {
  applyBasicDetailAdjustment,
  applyGeneralDetailAdjustment,
  applyPublicDetailAdjustment,
  buildBasicDetailFromYen,
  buildGeneralDetailFromYen,
  buildPublicServantDetailFromYen,
  getEarlyClaimReductionPerMonthByBirth,
  getMaxOldAgeDeferralAgeByBirth,
  isOnOrAfterBenefitStart,
  normalizeOldAgeBenefitStart,
  toMonthlyMan,
} from './pensionOldAge';
import {
  createDefaultBenefitSettings,
  createDefaultPensionMemberState,
  migrateTeikibinOver50Form,
  sumNullable,
} from './pensionDefaults';
import {
  addPensionBreakdown,
  createEmptyGeneralEmployeesDetail,
  createEmptyOldAgePensionBreakdown,
  createEmptyPensionBreakdown,
  createEmptyPublicServantDetail,
  sumOldAgePension,
  sumPensionBreakdown,
  type GeneralEmployeesDetail,
  type OldAgePensionBreakdown,
  type PensionBreakdown,
  type PublicServantDetail,
} from '../types/cashFlow';
import type { FamilyMember } from '../types/family';
import type { IncomeByMember, IncomeEntry } from '../types/income';
import type {
  BenefitSettings,
  DependentSpousePensionSettings,
  NenkinTeikibinOver50Form,
  NenkinTeikibinUnder50Form,
  OldAgeBenefitRowSettings,
  PensionByMember,
  PensionMemberState,
  TeikibinOver50AmountPair,
  TeikibinOver50AmountTriple,
  TeikibinOver50OldAgePair,
  TeikibinOver50OldAgeTriple,
} from '../types/pension';
import {
  ADDITIONAL_PENSION_UNIT_YEN_PER_MONTH,
  DEPENDENT_CHILD_REFORM_MIN_EMPLOYEES_MONTHS,
  DEPENDENT_PENSION_CUTOFF_AGE,
  DEPENDENT_PENSION_MIN_EMPLOYEES_MONTHS,
  DEPENDENT_SPOUSE_PENSION_BASE_YEN_PER_YEAR,
  DEPENDENT_SPOUSE_PENSION_REFORM_YEN_PER_YEAR,
  FULL_BASIC_PENSION_MONTHS,
  FULL_BASIC_PENSION_YEN_PER_YEAR,
  OLD_AGE_PENSION_MIN_QUALIFYING_MONTHS,
  PENSION_CHILD_ADD_REFORM_START_MONTH,
  PENSION_CHILD_ADD_REFORM_START_YEAR,
  STANDARD_OLD_AGE_START,
  ZAISHOKU_SUSPENSION_THRESHOLD_YEN_PER_MONTH,
} from './pensionConstants';

function getMemberAgeMonth(
  member: FamilyMember,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): { age: number; month: number } | null {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  let age = calendarYear - birthYear;
  if (calendarMonth < resolveMemberBirthMonth(member)) {
    age -= 1;
  }
  if (age < 0) {
    return null;
  }
  return { age, month: calendarMonth };
}

function normalizeOldAgeRowForMember(
  member: FamilyMember,
  row: OldAgeBenefitRowSettings,
  referenceDate: Date,
): OldAgeBenefitRowSettings {
  const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);
  const birthMonth = resolveMemberBirthMonth(member);
  const maxDeferralAge = getMaxOldAgeDeferralAgeByBirth(
    birthYear,
    birthMonth,
    member.birthDay,
  );
  return {
    ...row,
    ...normalizeOldAgeBenefitStart(
      row.startAge,
      row.startMonth ?? 0,
      maxDeferralAge,
    ),
  };
}

function pensionCalendarSerial(year: number, month: number): number {
  return year * 12 + (month - 1);
}

function pensionCalendarFromSerial(serial: number): {
  year: number;
  month: number;
} {
  return {
    year: Math.floor(serial / 12),
    month: (serial % 12) + 1,
  };
}

/**
 * 年齢到達月（年齢計算上は誕生日の前日）を連続月番号で返す。
 * 1日生まれは前月末に年齢到達するため1か月前、それ以外は誕生月。
 * birthDay未入力は2日以後と同じ月単位概算とする。
 */
function getAgeReachedSerial(
  member: FamilyMember,
  referenceDate: Date,
  targetAge: number,
): number {
  const birthYear = calcBirthYear(
    member.age,
    member.birthMonth,
    referenceDate,
  );
  const birthMonth = resolveMemberBirthMonth(member);
  const nominalBirthdayMonth = pensionCalendarSerial(
    birthYear + targetAge,
    birthMonth,
  );
  return member.birthDay === 1
    ? nominalBirthdayMonth - 1
    : nominalBirthdayMonth;
}

/**
 * Q8の受給設定は「その年齢・月数で請求する」時期として扱う。
 * 年金は請求月の翌月分から発生するため、月次CFの受給権開始も翌月とする。
 */
function isOldAgeRowPaymentActive(
  member: FamilyMember,
  row: OldAgeBenefitRowSettings,
  referenceDate: Date,
  ageMonth: { age: number; month: number },
): boolean {
  const normalized = normalizeOldAgeRowForMember(member, row, referenceDate);
  const birthYear = calcBirthYear(
    member.age,
    member.birthMonth,
    referenceDate,
  );
  const birthMonth = resolveMemberBirthMonth(member);
  const currentYear = calendarYearFromAgeCalendarMonth(
    birthYear,
    birthMonth,
    ageMonth.age,
    ageMonth.month,
  );
  const currentSerial = pensionCalendarSerial(currentYear, ageMonth.month);
  const claimSerial =
    getAgeReachedSerial(member, referenceDate, normalized.startAge) +
    (normalized.startMonth ?? 0);
  return currentSerial >= claimSerial + 1;
}

/**
 * 老齢厚生年金を繰下げる場合の「平均支給率」。
 *
 * 日本年金機構の式:
 * 平均支給率 = 月単位の支給率の合計 ÷ 繰下げ待機期間
 * 月単位の支給率 = 1 - 在職支給停止額 ÷ 65歳時点の老齢厚生年金額
 *
 * Q7の給与・賞与から各月の総報酬月額相当額を求め、
 * 2026年度基準額で在職支給停止額を推計する。
 */
function calcDeferralAveragePaymentRate(
  member: FamilyMember,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
  row: OldAgeBenefitRowSettings,
  age65EmployeesBasicMonthlyMan: number,
): number {
  if (age65EmployeesBasicMonthlyMan <= 0) return 1;

  const normalized = normalizeOldAgeRowForMember(member, row, referenceDate);
  const deferralMonths =
    normalized.startAge * 12 +
    (normalized.startMonth ?? 0) -
    STANDARD_OLD_AGE_START * 12;
  if (deferralMonths <= 0) return 1;

  const birthYear = calcBirthYear(
    member.age,
    member.birthMonth,
    referenceDate,
  );
  const birthMonth = resolveMemberBirthMonth(member);
  const age65ReachedSerial = getAgeReachedSerial(
    member,
    referenceDate,
    STANDARD_OLD_AGE_START,
  );
  const thresholdMan = ZAISHOKU_SUSPENSION_THRESHOLD_YEN_PER_MONTH / 10000;

  let paymentRateTotal = 0;
  for (let offset = 1; offset <= deferralMonths; offset++) {
    const serial = age65ReachedSerial + offset;
    const { year, month } = pensionCalendarFromSerial(serial);
    let age = year - birthYear;
    if (month < birthMonth) age -= 1;

    const remunerationMan = getActiveEmployeesTotalRemunerationMan(
      incomeEntries,
      age,
      month,
      birthYear,
      birthMonth,
    );
    const excess =
      age65EmployeesBasicMonthlyMan +
      remunerationMan -
      thresholdMan;
    const suspensionMan =
      remunerationMan > 0
        ? Math.min(
            Math.max(0, excess / 2),
            age65EmployeesBasicMonthlyMan,
          )
        : 0;
    paymentRateTotal +=
      1 - suspensionMan / age65EmployeesBasicMonthlyMan;
  }

  return paymentRateTotal / deferralMonths;
}

/**
 * 繰下げ加算額から、在職老齢年金で支給停止された報酬比例部分に対応する
 * 「増額対象外」の分だけを除く。
 * 経過的加算は平均支給率を掛けず、従来どおり全額を増額対象に残す。
 */
function applyDeferralAveragePaymentRate(
  detail: GeneralEmployeesDetail | PublicServantDetail,
  baseBasicMonthlyMan: number,
  row: OldAgeBenefitRowSettings,
  averagePaymentRate: number,
): void {
  const deferralMonths =
    row.startAge * 12 +
    (row.startMonth ?? 0) -
    STANDARD_OLD_AGE_START * 12;
  if (
    deferralMonths <= 0 ||
    detail.earlyPayment <= 0 ||
    baseBasicMonthlyMan <= 0 ||
    averagePaymentRate >= 1
  ) {
    return;
  }

  const increaseRate = deferralMonths * 0.007;
  const excludedIncrease =
    baseBasicMonthlyMan *
    increaseRate *
    (1 - Math.max(0, averagePaymentRate));
  detail.earlyPayment = Math.max(
    0,
    detail.earlyPayment - excludedIncrease,
  );
}


function isOnOrAfterMonth(
  calendarYear: number,
  calendarMonth: number,
  startYear: number,
  startMonth: number,
): boolean {
  if (calendarYear > startYear) return true;
  if (calendarYear < startYear) return false;
  return calendarMonth >= startMonth;
}

function pairToGeneralDetail(pair: TeikibinOver50AmountPair): GeneralEmployeesDetail {
  return {
    ...createEmptyGeneralEmployeesDetail(),
    basic: toMonthlyMan(pair.proportional),
    payment: toMonthlyMan(pair.fixed),
  };
}

function tripleToPublicDetail(
  triple: TeikibinOver50AmountTriple,
): PublicServantDetail {
  return {
    ...createEmptyPublicServantDetail(),
    basic: toMonthlyMan(triple.proportional),
    payment: toMonthlyMan(triple.fixed),
    occupational: toMonthlyMan(triple.transitionalOccupational),
  };
}

function oldAgePairToGeneralDetail(
  pair: TeikibinOver50OldAgePair,
): GeneralEmployeesDetail {
  return {
    ...createEmptyGeneralEmployeesDetail(),
    basic: toMonthlyMan(pair.proportional),
    transitional: toMonthlyMan(pair.transitionalAddition),
  };
}

function oldAgeTripleToPublicDetail(
  triple: TeikibinOver50OldAgeTriple,
): PublicServantDetail {
  return {
    ...createEmptyPublicServantDetail(),
    basic: toMonthlyMan(triple.proportional),
    transitional: toMonthlyMan(triple.transitionalAddition),
    occupational: toMonthlyMan(triple.transitionalOccupational),
  };
}

function addGeneralEmployeesDetail(
  target: GeneralEmployeesDetail,
  source: GeneralEmployeesDetail,
): void {
  target.basic += source.basic;
  target.transitional += source.transitional;
  target.dependent += source.dependent;
  target.payment += source.payment;
  target.earlyPayment += source.earlyPayment;
}

function addPublicServantDetail(
  target: PublicServantDetail,
  source: PublicServantDetail,
): void {
  target.basic += source.basic;
  target.transitional += source.transitional;
  target.dependent += source.dependent;
  target.occupational += source.occupational;
  target.payment += source.payment;
  target.earlyPayment += source.earlyPayment;
}


/** 付加保険料納付月数から付加年金の年額（円）を返す */
function calcAdditionalPensionYenPerYear(months: number | null | undefined): number {
  return ADDITIONAL_PENSION_UNIT_YEN_PER_MONTH * (months ?? 0);
}

// ─── 定期便なし（Q7 収入推計）──────────────────────────────────────────────────
/**
 * Q7 収入から老齢年金の 65 歳満額ベース内訳を推計する（1 回だけ呼び出す）。
 * - 老齢基礎: 加入月数比例（大学猶予 24 か月除外）
 * - 老齢厚生（一般/公務員）: 報酬比例部分 + 経過的加算
 * - 付加年金（additional）・特別支給（payment）・職域（occupational）: 0
 *   → 定期便入力があるときのみ反映される。
 */
function calcNoneOldAgeAmounts(
  member: FamilyMember,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
): OldAgePensionBreakdown {
  const est = estimateOldAgeAmountsFromIncome(member, incomeEntries, referenceDate);
  return {
    basic: buildBasicDetailFromYen(est.basicYenPerYear),
    generalEmployees: {
      ...buildGeneralDetailFromYen(est.generalEmployeesYenPerYear),
      transitional: toMonthlyMan(est.generalTransitionalYenPerYear),
    },
    publicServant: {
      ...buildPublicServantDetailFromYen(est.publicServantYenPerYear),
      transitional: toMonthlyMan(est.publicTransitionalYenPerYear),
    },
  };
}

// ─── 定期便（50 歳未満）─────────────────────────────────────────────────────────
/**
 * 50歳未満の定期便に記載された「これまでの加入実績に応じた年金額」を起点に、
 * 定期便最終記録月より後のQ7将来加入分を加えて65歳時点を概算する。
 * - 老齢基礎・一般厚生・公務員厚生: 定期便記載の実績額 + Q7将来加入分
 * - 付加年金（additional）: 定期便の付加保険料納付月数から算出
 * - 特別支給（payment）: 50 歳未満の定期便には記載なし → 0
 * - 経過的加算（transitional）: 定期便の加入月数と老齢基礎年金額から推計
 *   （定期便記載の老齢基礎年金額 → 逆算した算定基礎月数 vs 厚生年金加入月数の差）
 */
function calcUnder50OldAgeAmounts(
  member: FamilyMember,
  form: NenkinTeikibinUnder50Form,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
): OldAgePensionBreakdown {
  const basicYen = form.oldAgeBasicPensionYen ?? 0;
  const generalYen = form.oldAgeEmployeesGeneralYen ?? 0;
  const publicYen = sumNullable([
    form.oldAgeEmployeesPublicServantYen,
    form.oldAgeEmployeesPrivateSchoolYen,
  ]);
  const future = estimateQ7FuturePensionAdditionsAfterDate(
    member,
    incomeEntries,
    referenceDate,
    form.recentMonthlyYear,
    form.recentMonthlyMonth,
  );

  const recordedQualifyingMonths = sumNullable([
    form.nationalPensionType1Months,
    form.nationalPensionType3Months,
    form.seamenInsuranceMonths,
    form.employeesPensionGeneralMonths,
    form.employeesPensionPublicServantMonths,
    form.employeesPensionPrivateSchoolMonths,
    form.consolidationPeriodMonths,
  ]);
  if (
    recordedQualifyingMonths + future.qualifyingMonths <
    OLD_AGE_PENSION_MIN_QUALIFYING_MONTHS
  ) {
    return createEmptyOldAgePensionBreakdown();
  }

  const projectedBasicYen = Math.min(
    FULL_BASIC_PENSION_YEN_PER_YEAR,
    basicYen + future.basicYenPerYear,
  );

  // 定期便の厚生年金加入月数
  const generalMonths = form.employeesPensionGeneralMonths ?? 0;
  const publicMonths =
    (form.employeesPensionPublicServantMonths ?? 0) +
    (form.employeesPensionPrivateSchoolMonths ?? 0);
  const totalEmployeesMonths = generalMonths + publicMonths;

  // 老齢基礎年金額から算定基礎月数を逆算（入力がない場合は経過的加算を 0 とする）
  const basicCreditedMonths =
    basicYen > 0
      ? Math.round((basicYen / FULL_BASIC_PENSION_YEN_PER_YEAR) * FULL_BASIC_PENSION_MONTHS)
      : totalEmployeesMonths; // 入力なし → 差分なし

  const totalTransitional = calcTransitionalAdditionYenPerYear(
    totalEmployeesMonths,
    basicCreditedMonths,
  );

  // 経過的加算を加入月数の比率で一般・公務員に按分
  const generalTransitional =
    totalEmployeesMonths > 0
      ? totalTransitional * (generalMonths / totalEmployeesMonths)
      : 0;

  return {
    basic: {
      ...buildBasicDetailFromYen(projectedBasicYen),
      additional: toMonthlyMan(calcAdditionalPensionYenPerYear(form.additionalPremiumMonths)),
    },
    generalEmployees: {
      ...buildGeneralDetailFromYen(generalYen + future.generalEmployeesYenPerYear),
      transitional: toMonthlyMan(generalTransitional),
    },
    publicServant: {
      ...buildPublicServantDetailFromYen(publicYen + future.publicServantYenPerYear),
      transitional: toMonthlyMan(totalTransitional - generalTransitional),
    },
  };
}

// ─── 定期便（50 歳以上）─────────────────────────────────────────────────────────
/**
 * 50 歳以上の定期便から老齢年金内訳を取得する。
 *
 * 受給開始年齢（startAge）が 65 歳未満 → 特別支給の老齢厚生年金を使用。
 * 受給開始年齢（startAge）が 65 歳以上 → 老齢厚生年金（65 歳以降）を使用。
 *
 * 一般厚生と公務員厚生/私学共済はそれぞれ独立した startAge を持つ。
 *
 * - 特別支給（payment）: 65 歳前のみ（specialCol3/4 の fixed 欄）
 * - 経過的加算（transitional）: 65 歳以降のみ（oldAge65 の transitionalAddition 欄）
 * - 職域加算（occupational）: 公務員厚生・私学共済のみ（65 歳以降）
 */
function calcOver50OldAgeAmounts(
  form: NenkinTeikibinOver50Form,
  generalStartAge: number,
  publicPrivateStartAge: number,
): OldAgePensionBreakdown {
  const result = createEmptyOldAgePensionBreakdown();

  result.basic = {
    ...buildBasicDetailFromYen(form.basicPension65 ?? 0),
    additional: toMonthlyMan(calcAdditionalPensionYenPerYear(form.additionalPremiumMonths)),
  };

  // 一般厚生
  if (generalStartAge >= STANDARD_OLD_AGE_START) {
    result.generalEmployees = oldAgePairToGeneralDetail(form.general.oldAge65);
  } else {
    result.generalEmployees = pairToGeneralDetail(form.general.specialCol3);
    addGeneralEmployeesDetail(
      result.generalEmployees,
      pairToGeneralDetail(form.general.specialCol4),
    );
  }

  // 公務員厚生・私学共済
  if (publicPrivateStartAge >= STANDARD_OLD_AGE_START) {
    addPublicServantDetail(
      result.publicServant,
      oldAgeTripleToPublicDetail(form.publicServant.oldAge65),
    );
    addPublicServantDetail(
      result.publicServant,
      oldAgeTripleToPublicDetail(form.privateSchool.oldAge65),
    );
  } else {
    for (const triple of [
      form.publicServant.specialCol2,
      form.publicServant.specialCol3,
      form.publicServant.specialCol4,
      form.privateSchool.specialCol2,
      form.privateSchool.specialCol3,
      form.privateSchool.specialCol4,
    ]) {
      addPublicServantDetail(result.publicServant, tripleToPublicDetail(triple));
    }
  }

  return result;
}


function calcPost65EmployeesPensionIncreaseMan(
  member: FamilyMember,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
  currentAge: number,
  currentMonth: number,
): { generalEmployees: number; publicServant: number } {
  const annual = estimatePost65EmployeesPensionIncreaseMan(
    member,
    incomeEntries,
    referenceDate,
    currentAge,
    currentMonth,
  );
  return {
    generalEmployees: toMonthlyMan(annual.generalEmployeesYenPerYear),
    publicServant: toMonthlyMan(annual.publicServantYenPerYear),
  };
}

/**
 * 暦月ごとの老齢年金内訳（月額・万円）を計算する。
 *
 * ┌──────────────────┬────────────────────────────────────────────────────────┐
 * │ pastEnrollment   │ 計算内容                                               │
 * ├──────────────────┼────────────────────────────────────────────────────────┤
 * │ none（定期便なし）│ Q7 推計: 老齢基礎(加入月数比例) + 老齢厚生(報酬比例のみ)│
 * │ under50（定期便） │ 定期便実績額 + 最終記録月後のQ7将来加入分             │
 * │ over50（定期便）  │ 定期便: 特支(65 歳前) or 老齢厚生65歳以降(経加・職域含)│
 * └──────────────────┴────────────────────────────────────────────────────────┘
 *
 * amountMode === 'manual' の行は上記を上書きして手入力値を使用。
 * 繰上・繰下（startAge ≠ 65）は auto 計算値にのみ反映
 * （over50 特別支給・manual 入力値には反映しない）。
 */
function calcOldAgeMonthlyManByRow(
  member: FamilyMember,
  memberState: PensionMemberState,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
  benefitSettings: BenefitSettings,
  ageMonth: { age: number; month: number },
): OldAgePensionBreakdown {
  const bSetting = normalizeOldAgeRowForMember(
    member,
    benefitSettings.oldAgeBasic,
    referenceDate,
  );
  const gSetting = normalizeOldAgeRowForMember(
    member,
    benefitSettings.oldAgeGeneralEmployees,
    referenceDate,
  );
  const pSetting = normalizeOldAgeRowForMember(
    member,
    benefitSettings.oldAgePublicPrivate,
    referenceDate,
  );

  const basicActive = isOldAgeRowPaymentActive(
    member,
    bSetting,
    referenceDate,
    ageMonth,
  );
  const generalActive = isOldAgeRowPaymentActive(
    member,
    gSetting,
    referenceDate,
    ageMonth,
  );
  const publicActive = isOldAgeRowPaymentActive(
    member,
    pSetting,
    referenceDate,
    ageMonth,
  );

  if (!basicActive && !generalActive && !publicActive) {
    return createEmptyOldAgePensionBreakdown();
  }

  // ─ auto 計算のベース内訳を pastEnrollment ごとに 1 回だけ算出 ─
  const needsAuto =
    bSetting.amountMode === 'auto' ||
    gSetting.amountMode === 'auto' ||
    pSetting.amountMode === 'auto';

  let autoBase = createEmptyOldAgePensionBreakdown();
  if (needsAuto) {
    switch (memberState.pastEnrollment) {
      case 'nenkin-teikibin-under50':
        autoBase = calcUnder50OldAgeAmounts(
          member,
          memberState.teikibinUnder50,
          incomeEntries,
          referenceDate,
        );
        break;
      case 'nenkin-teikibin-over50':
        autoBase = calcOver50OldAgeAmounts(
          migrateTeikibinOver50Form(memberState.teikibinOver50),
          gSetting.startAge,
          pSetting.startAge,
        );
        break;
      default: // none（定期便なし）
        autoBase = calcNoneOldAgeAmounts(member, incomeEntries, referenceDate);
    }

    // 定期便を選んだが金額未入力のときは Q7 収入から推計する
    if (
      memberState.pastEnrollment !== 'none' &&
      sumOldAgePension(autoBase) === 0
    ) {
      autoBase = calcNoneOldAgeAmounts(member, incomeEntries, referenceDate);
    }
  }

  // ─ 各行に manual/auto を適用し、繰上繰下調整 ─
  const result = createEmptyOldAgePensionBreakdown();
  const memberBirthYear = calcBirthYear(
    member.age,
    member.birthMonth,
    referenceDate,
  );
  const memberBirthMonth = resolveMemberBirthMonth(member);
  const maxDeferralAge = getMaxOldAgeDeferralAgeByBirth(
    memberBirthYear,
    memberBirthMonth,
    member.birthDay,
  );
  const earlyReductionPerMonth = getEarlyClaimReductionPerMonthByBirth(
    memberBirthYear,
    memberBirthMonth,
    member.birthDay,
  );

  const age65EmployeesBasicMonthlyMan =
    autoBase.generalEmployees.basic + autoBase.publicServant.basic;
  const generalAveragePaymentRate =
    gSetting.amountMode === 'auto'
      ? calcDeferralAveragePaymentRate(
          member,
          incomeEntries,
          referenceDate,
          gSetting,
          age65EmployeesBasicMonthlyMan,
        )
      : 1;
  const publicAveragePaymentRate =
    pSetting.amountMode === 'auto'
      ? calcDeferralAveragePaymentRate(
          member,
          incomeEntries,
          referenceDate,
          pSetting,
          age65EmployeesBasicMonthlyMan,
        )
      : 1;

  if (basicActive) {
    let basic =
      bSetting.amountMode === 'manual'
        ? buildBasicDetailFromYen(bSetting.manualAmountPerYear ?? 0)
        : autoBase.basic;
    // manual は手入力値そのままのため調整しない
    const bStartMonths = bSetting.startAge * 12 + (bSetting.startMonth ?? 0);
    if (bSetting.amountMode !== 'manual' && bStartMonths !== STANDARD_OLD_AGE_START * 12) {
      basic = applyBasicDetailAdjustment(
        basic,
        bSetting.startAge,
        bSetting.startMonth ?? 0,
        earlyReductionPerMonth,
        maxDeferralAge,
      );
    }
    result.basic = basic;
  }

  if (generalActive) {
    let general =
      gSetting.amountMode === 'manual'
        ? buildGeneralDetailFromYen(gSetting.manualAmountPerYear ?? 0)
        : autoBase.generalEmployees;
    // over50 特別支給（65 歳前）は定期便記載額そのまま → 繰上繰下調整なし
    const isOver50Special =
      memberState.pastEnrollment === 'nenkin-teikibin-over50' &&
      gSetting.amountMode !== 'manual' &&
      gSetting.startAge < STANDARD_OLD_AGE_START;
    const gStartMonths = gSetting.startAge * 12 + (gSetting.startMonth ?? 0);
    if (!isOver50Special && gSetting.amountMode !== 'manual' && gStartMonths !== STANDARD_OLD_AGE_START * 12) {
      general = applyGeneralDetailAdjustment(
        general,
        gSetting.startAge,
        gSetting.startMonth ?? 0,
        earlyReductionPerMonth,
        maxDeferralAge,
      );
      applyDeferralAveragePaymentRate(
        general,
        autoBase.generalEmployees.basic,
        gSetting,
        generalAveragePaymentRate,
      );
    }
    result.generalEmployees = general;
  }

  if (publicActive) {
    let pub =
      pSetting.amountMode === 'manual'
        ? buildPublicServantDetailFromYen(pSetting.manualAmountPerYear ?? 0)
        : autoBase.publicServant;
    const isOver50Special =
      memberState.pastEnrollment === 'nenkin-teikibin-over50' &&
      pSetting.amountMode !== 'manual' &&
      pSetting.startAge < STANDARD_OLD_AGE_START;
    const pStartMonths = pSetting.startAge * 12 + (pSetting.startMonth ?? 0);
    if (!isOver50Special && pSetting.amountMode !== 'manual' && pStartMonths !== STANDARD_OLD_AGE_START * 12) {
      pub = applyPublicDetailAdjustment(
        pub,
        pSetting.startAge,
        pSetting.startMonth ?? 0,
        earlyReductionPerMonth,
        maxDeferralAge,
      );
      applyDeferralAveragePaymentRate(
        pub,
        autoBase.publicServant.basic,
        pSetting,
        publicAveragePaymentRate,
      );
    }
    result.publicServant = pub;
  }

  // ─ 65歳以降の在職定時改定 ─
  // 65歳時点の年金額へ将来の65〜69歳加入分を先取りせず、
  // 毎年10月に前年9月〜当年8月の加入実績を追加する。
  // 70歳到達時は残る未反映期間を退職改定相当として反映する。
  if (
    ageMonth.age >= STANDARD_OLD_AGE_START &&
    (generalActive || publicActive) &&
    memberState.pastEnrollment !== 'nenkin-teikibin-over50'
  ) {
    const post65 = calcPost65EmployeesPensionIncreaseMan(
      member,
      incomeEntries,
      referenceDate,
      ageMonth.age,
      ageMonth.month,
    );
    result.generalEmployees.basic += post65.generalEmployees;
    result.publicServant.basic += post65.publicServant;
  }

  // ─ 在職老齢年金（60歳以上）: 就労収入があれば支給停止を適用 ─
  // 令和4年4月以降、60〜64歳も65歳以上と同じ基準で判定する。
  if (ageMonth.age >= 60 && (generalActive || publicActive)) {
    const remunerationMan = getActiveEmployeesTotalRemunerationMan(
      incomeEntries,
      ageMonth.age,
      ageMonth.month,
      calcBirthYear(member.age, member.birthMonth, referenceDate),
      resolveMemberBirthMonth(member),
    );
    if (remunerationMan > 0) {
      return applyZaishokuSuspension(
        result,
        remunerationMan,
        ageMonth.age,
      );
    }
  }

  return result;
}

/**
 * 65歳満額ベースの老齢年金内訳（繰上げ・繰下げ・在職支給停止なし）。
 * 遺族厚生の報酬比例の母数に使う。
 */
export function calcMemberOldAge65BaseBreakdownMan(
  member: FamilyMember,
  memberState: PensionMemberState,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
): OldAgePensionBreakdown {
  const benefitSettings =
    memberState.benefitSettings ?? createDefaultBenefitSettings();
  const bSetting = benefitSettings.oldAgeBasic;
  const gSetting = benefitSettings.oldAgeGeneralEmployees;
  const pSetting = benefitSettings.oldAgePublicPrivate;
  const needsAuto =
    bSetting.amountMode === 'auto' ||
    gSetting.amountMode === 'auto' ||
    pSetting.amountMode === 'auto';

  let autoBase = createEmptyOldAgePensionBreakdown();
  if (needsAuto) {
    switch (memberState.pastEnrollment) {
      case 'nenkin-teikibin-under50':
        autoBase = calcUnder50OldAgeAmounts(
          member,
          memberState.teikibinUnder50,
          incomeEntries,
          referenceDate,
        );
        break;
      case 'nenkin-teikibin-over50':
        autoBase = calcOver50OldAgeAmounts(
          migrateTeikibinOver50Form(memberState.teikibinOver50),
          STANDARD_OLD_AGE_START,
          STANDARD_OLD_AGE_START,
        );
        break;
      default:
        autoBase = calcNoneOldAgeAmounts(member, incomeEntries, referenceDate);
    }
    if (
      memberState.pastEnrollment !== 'none' &&
      sumOldAgePension(autoBase) === 0
    ) {
      autoBase = calcNoneOldAgeAmounts(member, incomeEntries, referenceDate);
    }
  }

  const result = createEmptyOldAgePensionBreakdown();
  result.basic =
    bSetting.amountMode === 'manual'
      ? buildBasicDetailFromYen(bSetting.manualAmountPerYear ?? 0)
      : autoBase.basic;
  result.generalEmployees =
    gSetting.amountMode === 'manual'
      ? buildGeneralDetailFromYen(gSetting.manualAmountPerYear ?? 0)
      : autoBase.generalEmployees;
  result.publicServant =
    pSetting.amountMode === 'manual'
      ? buildPublicServantDetailFromYen(pSetting.manualAmountPerYear ?? 0)
      : autoBase.publicServant;
  return result;
}

/** 老齢厚生の報酬比例部分（年額・円）。経過的加算・加給は含めない。 */
export function calcMemberEmployeesProportionalYenPerYear(
  member: FamilyMember,
  memberState: PensionMemberState,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
): number {
  const base = calcMemberOldAge65BaseBreakdownMan(
    member,
    memberState,
    incomeEntries,
    referenceDate,
  );
  return Math.round(
    (base.generalEmployees.basic + base.publicServant.basic) * 12 * 10000,
  );
}

/**
 * 65歳以降の在職老齢年金で支給停止対象となる報酬比例部分を返す。
 *
 * 65歳以降は経過的加算・繰下げ加算は支給停止対象外。
 * 繰上げ減額（earlyPayment < 0）の場合は、減額分を元の内訳比率で
 * 報酬比例部分にも配分し、減額後の報酬比例部分を停止計算の母数とする。
 */
function calcPost65SuspendibleEmployeesMan(
  detail: GeneralEmployeesDetail | PublicServantDetail,
): number {
  const rawBasic = Math.max(0, detail.basic);
  const originalTotal = Object.entries(detail).reduce((sum, [key, value]) => {
    if (key === 'dependent' || key === 'earlyPayment') return sum;
    return sum + value;
  }, 0);

  if (detail.earlyPayment >= 0 || originalTotal <= 0) {
    return rawBasic;
  }

  const basicReduction =
    detail.earlyPayment * (rawBasic / originalTotal);
  return Math.max(0, rawBasic + basicReduction);
}

/**
 * 在職老齢年金（60歳以上）の支給停止を老齢厚生年金内訳に適用する。
 *
 * 支給停止ルール（令和8年度基準額 65万円/月）:
 *   超過額 = 基本月額 + 総報酬月額相当額 − 65万円
 *   支給停止額 = max(0, 超過額 / 2)
 *
 * 65歳以降の基本月額は報酬比例部分を母数とし、
 * 経過的加算・繰下げ加算は支給停止しない。
 * 60〜64歳は特別支給の内訳を含む従来計算を維持する。
 */
function applyZaishokuSuspension(
  breakdown: OldAgePensionBreakdown,
  totalRemunerationMan: number,
  age: number,
): OldAgePensionBreakdown {
  if (totalRemunerationMan <= 0) return breakdown;

  const thresholdMan = ZAISHOKU_SUSPENSION_THRESHOLD_YEN_PER_MONTH / 10000;

  if (age >= STANDARD_OLD_AGE_START) {
    const generalSuspendible =
      calcPost65SuspendibleEmployeesMan(breakdown.generalEmployees);
    const publicSuspendible =
      calcPost65SuspendibleEmployeesMan(breakdown.publicServant);
    const basicMonthlyMan = generalSuspendible + publicSuspendible;

    const excess = basicMonthlyMan + totalRemunerationMan - thresholdMan;
    if (excess <= 0 || basicMonthlyMan <= 0) return breakdown;

    const suspensionMan = Math.min(excess / 2, basicMonthlyMan);
    const generalRatio = generalSuspendible / basicMonthlyMan;
    const generalSuspension = suspensionMan * generalRatio;
    const publicSuspension = suspensionMan - generalSuspension;
    const fullySuspended = suspensionMan >= basicMonthlyMan;

    return {
      basic: breakdown.basic,
      generalEmployees: {
        ...breakdown.generalEmployees,
        basic: Math.max(
          0,
          breakdown.generalEmployees.basic - generalSuspension,
        ),
        // 加給年金は老齢厚生の報酬比例部分が全額停止のとき連動停止。
        dependent: fullySuspended
          ? 0
          : breakdown.generalEmployees.dependent,
      },
      publicServant: {
        ...breakdown.publicServant,
        basic: Math.max(
          0,
          breakdown.publicServant.basic - publicSuspension,
        ),
        dependent: fullySuspended
          ? 0
          : breakdown.publicServant.dependent,
      },
    };
  }

  // 60〜64歳: 特別支給の老齢厚生年金の内訳全体を従来どおり停止対象とする。
  const generalNonDep =
    breakdown.generalEmployees.basic +
    breakdown.generalEmployees.transitional +
    breakdown.generalEmployees.payment +
    breakdown.generalEmployees.earlyPayment;
  const publicNonDep =
    breakdown.publicServant.basic +
    breakdown.publicServant.transitional +
    breakdown.publicServant.occupational +
    breakdown.publicServant.payment +
    breakdown.publicServant.earlyPayment;
  const basicMonthlyMan = generalNonDep + publicNonDep;

  const excess = basicMonthlyMan + totalRemunerationMan - thresholdMan;
  if (excess <= 0) return breakdown;

  const suspensionMan = Math.min(excess / 2, basicMonthlyMan);
  const generalRatio = basicMonthlyMan > 0 ? generalNonDep / basicMonthlyMan : 0;
  const generalSuspension = suspensionMan * generalRatio;
  const publicSuspension = suspensionMan - generalSuspension;

  const scaleDown = (fields: number, suspension: number): number => {
    if (fields <= 0) return 1;
    return Math.max(0, (fields - suspension) / fields);
  };

  const gFactor = scaleDown(generalNonDep, generalSuspension);
  const pFactor = scaleDown(publicNonDep, publicSuspension);

  return {
    basic: breakdown.basic,
    generalEmployees: {
      basic: breakdown.generalEmployees.basic * gFactor,
      transitional: breakdown.generalEmployees.transitional * gFactor,
      payment: breakdown.generalEmployees.payment * gFactor,
      earlyPayment: breakdown.generalEmployees.earlyPayment * gFactor,
      dependent:
        suspensionMan >= basicMonthlyMan
          ? 0
          : breakdown.generalEmployees.dependent,
    },
    publicServant: {
      basic: breakdown.publicServant.basic * pFactor,
      transitional: breakdown.publicServant.transitional * pFactor,
      occupational: breakdown.publicServant.occupational * pFactor,
      payment: breakdown.publicServant.payment * pFactor,
      earlyPayment: breakdown.publicServant.earlyPayment * pFactor,
      dependent:
        suspensionMan >= basicMonthlyMan
          ? 0
          : breakdown.publicServant.dependent,
    },
  };
}

function calcSurvivorMonthlyManByRow(
  benefitSettings: BenefitSettings,
  calendarYear: number,
  calendarMonth: number,
): PensionBreakdown['survivor'] {
  const result = createEmptyPensionBreakdown().survivor;

  if (
    !isOnOrAfterMonth(
      calendarYear,
      calendarMonth,
      benefitSettings.survivorDeathYear,
      benefitSettings.survivorDeathMonth,
    )
  ) {
    return result;
  }

  result.basic.basic = toMonthlyMan(benefitSettings.survivorBasicPerYear);
  result.employees.basic = toMonthlyMan(
    benefitSettings.survivorEmployeesMutualPerYear,
  );

  return result;
}

export function calcMemberMonthlyPensionBreakdownMan(
  member: FamilyMember,
  memberState: PensionMemberState,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): PensionBreakdown {
  const result = createEmptyPensionBreakdown();
  const ageMonth = getMemberAgeMonth(
    member,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (!ageMonth) return result;

  const benefitSettings =
    memberState.benefitSettings ?? createDefaultBenefitSettings();

  result.oldAge = calcOldAgeMonthlyManByRow(
    member,
    memberState,
    incomeEntries,
    referenceDate,
    benefitSettings,
    ageMonth,
  );
  result.survivor = calcSurvivorMonthlyManByRow(
    benefitSettings,
    calendarYear,
    calendarMonth,
  );

  return result;
}

/**
 * 税計算用の年間老齢年金実支払額（万円）をメンバー別に返す。
 *
 * - 偶数月に前2か月分を受け取る実支払ベース
 * - 非課税の遺族年金・障害年金は含めない
 * - 加給年金・子の加算・振替加算は、実際の年金受給者へ帰属
 */
export function calcMemberAnnualTaxableOldAgePensionPaymentManByMember(input: {
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  pensionByMember: PensionByMember;
  referenceDate: Date;
  calendarYear: number;
  monthStart?: number;
  monthEnd?: number;
}): Record<string, number> {
  const monthStart = input.monthStart ?? 1;
  const monthEnd = input.monthEnd ?? 12;
  const result: Record<string, number> = {};

  for (const member of input.familyMembers) {
    if (member.role === 'pet') continue;
    const memberState =
      input.pensionByMember[member.id] ?? createDefaultPensionMemberState();
    const incomeEntries = input.incomeByMember[member.id] ?? [];
    const entitlements: PensionBreakdown[] = [];
    entitlements[0] = calcMemberMonthlyPensionBreakdownWithHouseholdAdditionsMan(
      member,
      memberState,
      incomeEntries,
      input.familyMembers,
      input.pensionByMember,
      input.incomeByMember,
      input.referenceDate,
      input.calendarYear - 1,
      12,
    );
    for (let month = 1; month <= 12; month++) {
      entitlements[month] = calcMemberMonthlyPensionBreakdownWithHouseholdAdditionsMan(
        member,
        memberState,
        incomeEntries,
        input.familyMembers,
        input.pensionByMember,
        input.incomeByMember,
        input.referenceDate,
        input.calendarYear,
        month,
      );
    }

    let annual = 0;
    for (let month = monthStart; month <= monthEnd; month++) {
      annual += calcTaxableOldAgePensionPaymentMan(
        month,
        entitlements[month - 1] ?? createEmptyPensionBreakdown(),
        entitlements[month - 2] ?? createEmptyPensionBreakdown(),
      );
    }
    result[member.id] = annual;
  }

  return result;
}

/** 暦年の年間公的年金受給額（万円）をメンバー別に返す */
export function calcMemberAnnualPensionManByMember(input: {
  familyMembers: FamilyMember[];
  incomeByMember: IncomeByMember;
  pensionByMember: PensionByMember;
  referenceDate: Date;
  calendarYear: number;
  monthStart?: number;
  monthEnd?: number;
}): Record<string, number> {
  const monthStart = input.monthStart ?? 1;
  const monthEnd = input.monthEnd ?? 12;
  const result: Record<string, number> = {};

  for (const member of input.familyMembers) {
    if (member.role === 'pet') continue;
    const memberState =
      input.pensionByMember[member.id] ?? createDefaultPensionMemberState();
    const incomeEntries = input.incomeByMember[member.id] ?? [];
    let memberPension = 0;
    for (let month = monthStart; month <= monthEnd; month++) {
      memberPension += sumPensionBreakdown(
        calcMemberMonthlyPensionBreakdownWithHouseholdAdditionsMan(
          member,
          memberState,
          incomeEntries,
          input.familyMembers,
          input.pensionByMember,
          input.incomeByMember,
          input.referenceDate,
          input.calendarYear,
          month,
        ),
      );
    }
    result[member.id] = memberPension;
  }

  return result;
}

/**
 * ねんきん定期便あり/なし共通で厚生年金加入月数の合計を返す。
 * - none（定期便なし）: Q7 収入から通常推計（年金額計算用）
 * - teikibin-under50/over50: 定期便の加入月数フィールドを使用
 */
export function getTotalEmployeesMonths(
  member: FamilyMember,
  memberState: PensionMemberState,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
): { general: number; publicServant: number } {
  if (memberState.pastEnrollment === 'none') {
    const counts = getEmployeesEnrollmentMonthCounts(
      member,
      incomeEntries,
      referenceDate,
    );
    return {
      general: counts.generalMonths,
      publicServant: counts.publicServantMonths,
    };
  }

  const form =
    memberState.pastEnrollment === 'nenkin-teikibin-under50'
      ? memberState.teikibinUnder50
      : migrateTeikibinOver50Form(memberState.teikibinOver50);

  return {
    general: form.employeesPensionGeneralMonths ?? 0,
    publicServant:
      (form.employeesPensionPublicServantMonths ?? 0) +
      (form.employeesPensionPrivateSchoolMonths ?? 0),
  };
}

/**
 * 加給年金の 20 年要件判定専用の加入月数推計。
 *
 * ─ 定期便なし ─
 *   Q7 に厚生年金期間があれば 22 歳から就労終了まで全期間加入とみなす
 *   寛大推計（現在非就労でも過去の就労歴を正しく反映できるよう）。
 *
 * ─ 定期便あり ─
 *   定期便の実績月数（過去・正確）＋定期便最終月以降の Q7 厚生年金月数（将来）
 *   を合算し、二重計上なしで精度の高い判定を行う。
 */
function getTotalEmployeesMonthsForDependentQualification(
  member: FamilyMember,
  memberState: PensionMemberState,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
): { general: number; publicServant: number } {
  if (memberState.pastEnrollment === 'none') {
    return estimateEmployeesMonthsForDependentQualification(
      member,
      incomeEntries,
      referenceDate,
    );
  }

  // 定期便あり: 実績月数（過去）+ 定期便以降の Q7 厚生年金月数（将来）
  const base = getTotalEmployeesMonths(
    member,
    memberState,
    incomeEntries,
    referenceDate,
  );

  const form =
    memberState.pastEnrollment === 'nenkin-teikibin-under50'
      ? memberState.teikibinUnder50
      : migrateTeikibinOver50Form(memberState.teikibinOver50);

  const future = countQ7EmployeesMonthsAfterDate(
    incomeEntries,
    member,
    referenceDate,
    form.recentMonthlyYear,
    form.recentMonthlyMonth,
  );

  return {
    general: base.general + future.general,
    publicServant: base.publicServant + future.publicServant,
  };
}

function dependentReformStartSerial(): number {
  return pensionCalendarSerial(
    PENSION_CHILD_ADD_REFORM_START_YEAR,
    PENSION_CHILD_ADD_REFORM_START_MONTH,
  );
}

/**
 * 老齢厚生年金の「受給権取得時点」を月単位で概算する。
 * 通常は65歳。50歳以上の定期便で65歳前の特別支給開始が明示されている場合は
 * その早い方を使う。繰下げ設定で65歳超にしていても受給権自体は65歳で発生する。
 */
function resolveOldAgeEmployeesRightStartSerial(
  member: FamilyMember,
  memberState: PensionMemberState,
  referenceDate: Date,
): number {
  let start = getAgeReachedSerial(member, referenceDate, STANDARD_OLD_AGE_START);
  if (memberState.pastEnrollment !== 'nenkin-teikibin-over50') return start;

  const settings =
    memberState.benefitSettings ?? createDefaultBenefitSettings();
  for (const row of [
    settings.oldAgeGeneralEmployees,
    settings.oldAgePublicPrivate,
  ]) {
    const normalized = normalizeOldAgeRowForMember(
      member,
      row,
      referenceDate,
    );
    if (normalized.startAge < STANDARD_OLD_AGE_START) {
      start = Math.min(
        start,
        getAgeReachedSerial(member, referenceDate, normalized.startAge) +
          (normalized.startMonth ?? 0),
      );
    }
  }
  return start;
}

function usesReformedDependentChildQualification(
  member: FamilyMember,
  memberState: PensionMemberState,
  referenceDate: Date,
): boolean {
  return (
    resolveOldAgeEmployeesRightStartSerial(
      member,
      memberState,
      referenceDate,
    ) >= dependentReformStartSerial()
  );
}

/**
 * 2028年3月までに配偶者加給が実際に加算される状態だったかを確認する。
 * 該当する場合、2028年4月以降も経過措置で旧額を維持する。
 */
function hadSpouseDependentAdditionBeforeReform(
  pensioner: FamilyMember,
  pensionerState: PensionMemberState,
  pensionerIncomeEntries: IncomeEntry[],
  spouse: FamilyMember,
  spouseState: PensionMemberState,
  spouseIncomeEntries: IncomeEntry[],
  referenceDate: Date,
): boolean {
  const checkYear = PENSION_CHILD_ADD_REFORM_START_YEAR;
  const checkMonth = PENSION_CHILD_ADD_REFORM_START_MONTH - 1;
  const pensionerAgeMonth = getMemberAgeMonth(
    pensioner,
    referenceDate,
    checkYear,
    checkMonth,
  );
  const spouseAgeMonth = getMemberAgeMonth(
    spouse,
    referenceDate,
    checkYear,
    checkMonth,
  );
  if (!pensionerAgeMonth || !spouseAgeMonth) return false;
  if (spouseAgeMonth.age >= DEPENDENT_PENSION_CUTOFF_AGE) return false;

  const settings =
    pensionerState.benefitSettings ?? createDefaultBenefitSettings();
  const gSet = normalizeOldAgeRowForMember(
    pensioner,
    settings.oldAgeGeneralEmployees,
    referenceDate,
  );
  const pSet = normalizeOldAgeRowForMember(
    pensioner,
    settings.oldAgePublicPrivate,
    referenceDate,
  );
  const start = Math.min(
    gSet.startAge * 12 + (gSet.startMonth ?? 0),
    pSet.startAge * 12 + (pSet.startMonth ?? 0),
  );
  if (
    !isOnOrAfterBenefitStart(
      pensionerAgeMonth.age,
      checkMonth,
      Math.floor(start / 12),
      resolveMemberBirthMonth(pensioner),
      start % 12,
    )
  ) {
    return false;
  }

  const ownMonths = getTotalEmployeesMonthsForDependentQualification(
    pensioner,
    pensionerState,
    pensionerIncomeEntries,
    referenceDate,
  );
  if (
    ownMonths.general + ownMonths.publicServant <
    DEPENDENT_PENSION_MIN_EMPLOYEES_MONTHS
  ) {
    return false;
  }

  const spouseMonths = getTotalEmployeesMonthsForDependentQualification(
    spouse,
    spouseState,
    spouseIncomeEntries,
    referenceDate,
  );
  if (
    spouseMonths.general + spouseMonths.publicServant >=
    DEPENDENT_PENSION_MIN_EMPLOYEES_MONTHS
  ) {
    const spouseSettings =
      spouseState.benefitSettings ?? createDefaultBenefitSettings();
    const sg = normalizeOldAgeRowForMember(
      spouse,
      spouseSettings.oldAgeGeneralEmployees,
      referenceDate,
    );
    const sp = normalizeOldAgeRowForMember(
      spouse,
      spouseSettings.oldAgePublicPrivate,
      referenceDate,
    );
    const spouseStart = Math.min(
      sg.startAge * 12 + (sg.startMonth ?? 0),
      sp.startAge * 12 + (sp.startMonth ?? 0),
    );
    if (
      isOnOrAfterBenefitStart(
        spouseAgeMonth.age,
        checkMonth,
        Math.floor(spouseStart / 12),
        resolveMemberBirthMonth(spouse),
        spouseStart % 12,
      )
    ) {
      return false;
    }
  }

  return true;
}

/**
 * 加給年金（配偶者分）の月額（万円）を計算する。
 *
 * 支給要件（auto モード）:
 * - 受給者（世帯主）の厚生年金加入月数が 240 か月（20年）以上
 * - 受給者が老齢厚生年金受給中
 * - 配偶者が存在し、かつ配偶者が 65 歳未満
 *
 * manual モード: ユーザー入力額を使用。
 */
export function getDependentSpousePensionYenPerYear(
  pensioner: FamilyMember,
  referenceDate: Date,
  useReformedAmount = false,
): number {
  if (useReformedAmount) {
    return DEPENDENT_SPOUSE_PENSION_REFORM_YEN_PER_YEAR;
  }
  const birthYear = calcBirthYear(
    pensioner.age,
    pensioner.birthMonth,
    referenceDate,
  );
  const birthMonth = resolveMemberBirthMonth(pensioner);
  const birthDay = pensioner.birthDay ?? 1;
  const onOrAfter = (year: number, month: number, day: number): boolean =>
    birthYear > year ||
    (birthYear === year &&
      (birthMonth > month ||
        (birthMonth === month && birthDay >= day)));

  let special = 0;
  if (onOrAfter(1943, 4, 2)) special = 179_900;
  else if (onOrAfter(1942, 4, 2)) special = 143_900;
  else if (onOrAfter(1941, 4, 2)) special = 108_000;
  else if (onOrAfter(1940, 4, 2)) special = 71_900;
  else if (onOrAfter(1934, 4, 2)) special = 36_000;

  return DEPENDENT_SPOUSE_PENSION_BASE_YEN_PER_YEAR + special;
}

function getOldAgeBasicChildAdditionQualifyingMonths(
  member: FamilyMember,
  memberState: PensionMemberState,
  incomeEntries: IncomeEntry[],
  referenceDate: Date,
): number {
  if (memberState.pastEnrollment === 'none') {
    return getEstimatedOldAgeQualifyingMonthCount(
      member,
      incomeEntries,
      referenceDate,
    );
  }

  const form =
    memberState.pastEnrollment === 'nenkin-teikibin-under50'
      ? memberState.teikibinUnder50
      : migrateTeikibinOver50Form(memberState.teikibinOver50);
  const recorded = sumNullable([
    form.nationalPensionType1Months,
    form.nationalPensionType3Months,
    form.seamenInsuranceMonths,
    form.employeesPensionGeneralMonths,
    form.employeesPensionPublicServantMonths,
    form.employeesPensionPrivateSchoolMonths,
  ]);
  const future = estimateQ7FuturePensionAdditionsAfterDate(
    member,
    incomeEntries,
    referenceDate,
    form.recentMonthlyYear,
    form.recentMonthlyMonth,
  );
  return Math.max(0, recorded + future.qualifyingMonths);
}

function calcOldAgeBasicChildrenPensionMonthlyMan(
  pensioner: FamilyMember,
  pensionerState: PensionMemberState,
  pensionerIncomeEntries: IncomeEntry[],
  familyMembers: FamilyMember[],
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number {
  if (
    pensionCalendarSerial(calendarYear, calendarMonth) <
    dependentReformStartSerial()
  ) {
    return 0;
  }

  const ageMonth = getMemberAgeMonth(
    pensioner,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  if (!ageMonth) return 0;

  const settings =
    pensionerState.benefitSettings ?? createDefaultBenefitSettings();
  if (
    !isOldAgeRowPaymentActive(
      pensioner,
      settings.oldAgeBasic,
      referenceDate,
      ageMonth,
    )
  ) {
    return 0;
  }

  const count = familyMembers.filter(
    (member) =>
      isEligibleSurvivorBasicChild(
        member,
        referenceDate,
        calendarYear,
        calendarMonth,
      ) &&
      isEligiblePensionChildAdditionResidence(
        member,
        calendarYear,
        calendarMonth,
      ),
  ).length;
  if (count <= 0) return 0;

  // 令和7年改正後の老齢基礎年金の子加算は、納付済＋免除期間が
  // 300月未満なら「月数 / 300」で按分する。
  const qualifyingMonths = Math.min(
    300,
    getOldAgeBasicChildAdditionQualifyingMonths(
      pensioner,
      pensionerState,
      pensionerIncomeEntries,
      referenceDate,
    ),
  );
  if (qualifyingMonths <= 0) return 0;

  return toMonthlyMan(
    survivorBasicChildAddYenPerYear(
      count,
      calendarYear,
      calendarMonth,
    ) *
      (qualifyingMonths / 300),
  );
}

function calcDependentChildrenPensionMonthlyMan(
  pensioner: FamilyMember,
  pensionerState: PensionMemberState,
  pensionerIncomeEntries: IncomeEntry[],
  familyMembers: FamilyMember[],
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number {
  const benefitSettings =
    pensionerState.benefitSettings ?? createDefaultBenefitSettings();
  const birthYear = calcBirthYear(
    pensioner.age,
    pensioner.birthMonth,
    referenceDate,
  );
  let age = calendarYear - birthYear;
  if (calendarMonth < resolveMemberBirthMonth(pensioner)) age--;

  const gSet = normalizeOldAgeRowForMember(
    pensioner,
    benefitSettings.oldAgeGeneralEmployees,
    referenceDate,
  );
  const pSet = normalizeOldAgeRowForMember(
    pensioner,
    benefitSettings.oldAgePublicPrivate,
    referenceDate,
  );
  const start = Math.min(
    gSet.startAge * 12 + (gSet.startMonth ?? 0),
    pSet.startAge * 12 + (pSet.startMonth ?? 0),
  );
  if (
    !isOnOrAfterBenefitStart(
      age,
      calendarMonth,
      Math.floor(start / 12),
      resolveMemberBirthMonth(pensioner),
      start % 12,
    )
  ) {
    return 0;
  }

  const { general, publicServant } =
    getTotalEmployeesMonthsForDependentQualification(
      pensioner,
      pensionerState,
      pensionerIncomeEntries,
      referenceDate,
    );
  const childMinimumMonths = usesReformedDependentChildQualification(
    pensioner,
    pensionerState,
    referenceDate,
  )
    ? DEPENDENT_CHILD_REFORM_MIN_EMPLOYEES_MONTHS
    : DEPENDENT_PENSION_MIN_EMPLOYEES_MONTHS;
  if (general + publicServant < childMinimumMonths) {
    return 0;
  }

  const count = familyMembers.filter(
    (member) =>
      isEligibleSurvivorBasicChild(
        member,
        referenceDate,
        calendarYear,
        calendarMonth,
      ) &&
      isEligiblePensionChildAdditionResidence(
        member,
        calendarYear,
        calendarMonth,
      ),
  ).length;
  if (count <= 0) return 0;
  // 2028年4月以降は令和7年改正により、子の加算は第何子かに
  // かかわらず同額へ引き上げる。2026年度の実質水準で統一して試算する。
  return toMonthlyMan(
    survivorBasicChildAddYenPerYear(count, calendarYear, calendarMonth),
  );
}

function calcDependentSpousePensionMonthlyMan(
  headMember: FamilyMember,
  headMemberState: PensionMemberState,
  headIncomeEntries: IncomeEntry[],
  spouseMember: FamilyMember,
  spouseMemberState: PensionMemberState,
  spouseIncomeEntries: IncomeEntry[],
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number {
  const benefitSettings =
    headMemberState.benefitSettings ?? createDefaultBenefitSettings();

  // 受給者が老齢厚生年金受給中か（一般厚生・公務員厚のいずれか開始年齢に達しているか）
  const headBirthYear = calcBirthYear(
    headMember.age,
    headMember.birthMonth,
    referenceDate,
  );
  let headAge = calendarYear - headBirthYear;
  if (calendarMonth < resolveMemberBirthMonth(headMember)) headAge--;

  const gSet = normalizeOldAgeRowForMember(
    headMember,
    benefitSettings.oldAgeGeneralEmployees,
    referenceDate,
  );
  const pSet = normalizeOldAgeRowForMember(
    headMember,
    benefitSettings.oldAgePublicPrivate,
    referenceDate,
  );
  const empStartMonths = Math.min(
    gSet.startAge * 12 + (gSet.startMonth ?? 0),
    pSet.startAge * 12 + (pSet.startMonth ?? 0),
  );
  const empStartAge = Math.floor(empStartMonths / 12);
  const empStartMonth = empStartMonths % 12;
  if (
    !isOnOrAfterBenefitStart(
      headAge,
      calendarMonth,
      empStartAge,
      resolveMemberBirthMonth(headMember),
      empStartMonth,
    )
  ) {
    return 0;
  }

  // 配偶者が 65 歳に達していれば打ち切り
  const spouseBirthYear = calcBirthYear(
    spouseMember.age,
    spouseMember.birthMonth,
    referenceDate,
  );
  let spouseAge = calendarYear - spouseBirthYear;
  if (calendarMonth < resolveMemberBirthMonth(spouseMember)) spouseAge--;

  const spouseAtKakyuCutoff = isOldAgeRowPaymentActive(
    spouseMember,
    {
      startAge: DEPENDENT_PENSION_CUTOFF_AGE,
      startMonth: 0,
      amountMode: 'auto',
      manualAmountPerYear: null,
    },
    referenceDate,
    { age: spouseAge, month: calendarMonth },
  );
  if (spouseAtKakyuCutoff) {
    return 0;
  }

  // 配偶者が障害基礎年金・障害厚生年金を受給している間も、
  // 配偶者加給年金は支給停止となる。
  if (
    spouseMember.disability === 'has' &&
    (spouseMember.disabilityPension ?? 'none') !== 'none'
  ) {
    return 0;
  }

  // 2022年4月以降、配偶者が20年以上の老齢厚生年金等の受給権を
  // 有する場合は、実際の支給・停止状況にかかわらず配偶者加給を停止する。
  const spouseEmployees = getTotalEmployeesMonthsForDependentQualification(
    spouseMember,
    spouseMemberState,
    spouseIncomeEntries,
    referenceDate,
  );
  if (
    spouseEmployees.general + spouseEmployees.publicServant >=
    DEPENDENT_PENSION_MIN_EMPLOYEES_MONTHS
  ) {
    const spouseBenefitSettings =
      spouseMemberState.benefitSettings ?? createDefaultBenefitSettings();
    const spouseGeneralStart = normalizeOldAgeRowForMember(
      spouseMember,
      spouseBenefitSettings.oldAgeGeneralEmployees,
      referenceDate,
    );
    const spousePublicStart = normalizeOldAgeRowForMember(
      spouseMember,
      spouseBenefitSettings.oldAgePublicPrivate,
      referenceDate,
    );
    const spouseEmployeesStart = Math.min(
      spouseGeneralStart.startAge * 12 + (spouseGeneralStart.startMonth ?? 0),
      spousePublicStart.startAge * 12 + (spousePublicStart.startMonth ?? 0),
    );
    if (
      isOnOrAfterBenefitStart(
        spouseAge,
        calendarMonth,
        Math.floor(spouseEmployeesStart / 12),
        resolveMemberBirthMonth(spouseMember),
        spouseEmployeesStart % 12,
      )
    ) {
      return 0;
    }
  }

  const settings: DependentSpousePensionSettings =
    benefitSettings.dependentSpousePension ?? {
      amountMode: 'auto',
      manualAmountPerYear: null,
    };

  if (settings.amountMode === 'manual') {
    return toMonthlyMan(settings.manualAmountPerYear ?? 0);
  }

  // auto: 厚生年金加入月数判定（過去の就労歴も考慮した寛大推計を使用）
  const { general, publicServant } =
    getTotalEmployeesMonthsForDependentQualification(
      headMember,
      headMemberState,
      headIncomeEntries,
      referenceDate,
    );
  if (general + publicServant < DEPENDENT_PENSION_MIN_EMPLOYEES_MONTHS) {
    return 0;
  }

  const reformActive =
    pensionCalendarSerial(calendarYear, calendarMonth) >=
    dependentReformStartSerial();
  const keepLegacyAmount =
    reformActive &&
    hadSpouseDependentAdditionBeforeReform(
      headMember,
      headMemberState,
      headIncomeEntries,
      spouseMember,
      spouseMemberState,
      spouseIncomeEntries,
      referenceDate,
    );

  return toMonthlyMan(
    getDependentSpousePensionYenPerYear(
      headMember,
      referenceDate,
      reformActive && !keepLegacyAmount,
    ),
  );
}

/**
 * 令和8年度(2026年度)の振替加算額を配偶者の生年月日から返す。
 * 日付不明のため、4月生まれは「4月2日以降」として扱い保守的に判定する。
 */
export function getTransferAdditionYenPerYear(
  spouseBirthYear: number,
  spouseBirthMonth: number,
  spouseBirthDay?: number | null,
): number {
  // 各区分は「前年4月2日〜当年4月1日」。4月1日／2日の境界まで判定する。
  // 日が未入力の古いデータは、4月生まれのみ若い側（低い加算額）として保守的に扱う。
  const resolvedDay =
    spouseBirthDay == null && spouseBirthMonth === 4
      ? 2
      : (spouseBirthDay ?? 1);
  const onOrAfterApril2 = (cutoffYear: number): boolean =>
    spouseBirthYear > cutoffYear ||
    (spouseBirthYear === cutoffYear &&
      (spouseBirthMonth > 4 ||
        (spouseBirthMonth === 4 && resolvedDay >= 2)));

  if (onOrAfterApril2(1966)) return 0;         // 昭和41/4/2〜: 対象外
  if (onOrAfterApril2(1961)) return 16_335;    // 昭和36〜41 (0.067)
  if (onOrAfterApril2(1960)) return 22_673;    // 昭和35〜36 (0.093)
  if (onOrAfterApril2(1959)) return 29_256;    // 昭和34〜35 (0.120)
  if (onOrAfterApril2(1958)) return 35_839;    // 昭和33〜34 (0.147)
  if (onOrAfterApril2(1957)) return 42_177;    // 昭和32〜33 (0.173)
  if (onOrAfterApril2(1956)) return 48_760;    // 昭和31〜32 (0.200, base 243,800)
  if (onOrAfterApril2(1955)) return 55_184;    // 昭和30〜31 (0.227, base 243,100)
  if (onOrAfterApril2(1954)) return 61_504;    // 昭和29〜30 (0.253)
  if (onOrAfterApril2(1953)) return 68_068;    // 昭和28〜29 (0.280)
  if (onOrAfterApril2(1952)) return 74_632;    // 昭和27〜28 (0.307)
  if (onOrAfterApril2(1951)) return 80_952;    // 昭和26〜27 (0.333)
  if (onOrAfterApril2(1950)) return 87_516;    // 昭和25〜26 (0.360)
  if (onOrAfterApril2(1949)) return 94_080;    // 昭和24〜25 (0.387)
  if (onOrAfterApril2(1948)) return 100_400;   // 昭和23〜24 (0.413)
  if (onOrAfterApril2(1947)) return 106_964;   // 昭和22〜23 (0.440)
  if (onOrAfterApril2(1946)) return 113_528;   // 昭和21〜22 (0.467)
  if (onOrAfterApril2(1945)) return 119_848;   // 昭和20〜21 (0.493)
  if (onOrAfterApril2(1944)) return 126_412;   // 昭和19〜20 (0.520)
  if (onOrAfterApril2(1943)) return 132_976;   // 昭和18〜19 (0.547)
  if (onOrAfterApril2(1942)) return 139_296;   // 昭和17〜18 (0.573)
  if (onOrAfterApril2(1941)) return 145_860;   // 昭和16〜17 (0.600)
  if (onOrAfterApril2(1940)) return 152_424;   // 昭和15〜16 (0.627)
  if (onOrAfterApril2(1939)) return 158_744;   // 昭和14〜15 (0.653)
  if (onOrAfterApril2(1938)) return 165_308;   // 昭和13〜14 (0.680)
  if (onOrAfterApril2(1937)) return 171_872;   // 昭和12〜13 (0.707)
  if (onOrAfterApril2(1936)) return 178_192;   // 昭和11〜12 (0.733)
  if (onOrAfterApril2(1935)) return 184_756;   // 昭和10〜11 (0.760)
  if (onOrAfterApril2(1934)) return 191_320;   // 昭和 9〜10 (0.787)
  if (onOrAfterApril2(1933)) return 197_640;   // 昭和 8〜 9 (0.813)
  if (onOrAfterApril2(1932)) return 204_204;   // 昭和 7〜 8 (0.840)
  if (onOrAfterApril2(1931)) return 210_768;   // 昭和 6〜 7 (0.867)
  if (onOrAfterApril2(1930)) return 217_088;   // 昭和 5〜 6 (0.893)
  if (onOrAfterApril2(1929)) return 223_652;   // 昭和 4〜 5 (0.920)
  if (onOrAfterApril2(1928)) return 230_216;   // 昭和 3〜 4 (0.947)
  if (onOrAfterApril2(1927)) return 236_536;   // 昭和 2〜 3 (0.973)
  return 243_100;                              // 〜昭和 2/4/1 (1.000)
}

/**
 * 振替加算の月額（万円単位）を計算する。
 *
 * 支給条件:
 *   1. 配偶者の生年月日が昭和41年4月1日以前（1966/4/1以前）
 *   2. 世帯主が加給年金の受給要件（厚生年金20年以上）を満たしている
 *   3. 配偶者が老齢基礎年金の受給開始年齢（通常65歳）に達している
 */
function calcTransferAdditionMonthlyMan(
  headMember: FamilyMember,
  headMemberState: PensionMemberState,
  headIncomeEntries: IncomeEntry[],
  spouseMember: FamilyMember,
  spouseMemberState: PensionMemberState,
  spouseIncomeEntries: IncomeEntry[],
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number {
  const spouseBirthYear = calcBirthYear(
    spouseMember.age,
    spouseMember.birthMonth,
    referenceDate,
  );

  // 配偶者の生年月日から振替加算額を取得（対象外なら0）
  const yenPerYear = getTransferAdditionYenPerYear(
    spouseBirthYear,
    resolveMemberBirthMonth(spouseMember),
    spouseMember.birthDay,
  );
  if (yenPerYear <= 0) return 0;

  // 振替加算を受ける本人の厚生年金・共済加入が240月以上なら対象外。
  const spouseEmployeesMonths = getTotalEmployeesMonthsForDependentQualification(
    spouseMember,
    spouseMemberState,
    spouseIncomeEntries,
    referenceDate,
  );
  if (
    spouseEmployeesMonths.general + spouseEmployeesMonths.publicServant >=
    DEPENDENT_PENSION_MIN_EMPLOYEES_MONTHS
  ) {
    return 0;
  }

  // 配偶者が老齢基礎年金の受給開始年齢に達しているか確認
  const spouseSettings =
    spouseMemberState.benefitSettings ?? createDefaultBenefitSettings();
  const spouseBasicStart = normalizeOldAgeRowForMember(
    spouseMember,
    spouseSettings.oldAgeBasic,
    referenceDate,
  );
  let spouseAge = calendarYear - spouseBirthYear;
  if (calendarMonth < resolveMemberBirthMonth(spouseMember)) spouseAge--;

  if (
    !isOldAgeRowPaymentActive(
      spouseMember,
      spouseBasicStart,
      referenceDate,
      { age: spouseAge, month: calendarMonth },
    )
  ) {
    return 0;
  }

  // 世帯主が加給年金の受給要件（厚生年金20年以上）を満たしているか確認
  const { general, publicServant } = getTotalEmployeesMonthsForDependentQualification(
    headMember,
    headMemberState,
    headIncomeEntries,
    referenceDate,
  );
  if (general + publicServant < DEPENDENT_PENSION_MIN_EMPLOYEES_MONTHS) {
    return 0;
  }

  return toMonthlyMan(yenPerYear);
}

function calcOldAgeHouseholdAdditionsByMemberMan(
  familyMembers: FamilyMember[],
  pensionByMember: Record<string, PensionMemberState>,
  incomeByMember: Record<string, IncomeEntry[]>,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): Record<string, PensionBreakdown> {
  const result: Record<string, PensionBreakdown> = {};
  const ensure = (memberId: string): PensionBreakdown => {
    result[memberId] ??= createEmptyPensionBreakdown();
    return result[memberId];
  };

  const headMember = familyMembers.find((member) => member.role === 'head');
  const formalSpouse = familyMembers.find((member) => member.role === 'spouse');
  const commonLawPartner = familyMembers.find(
    (member) =>
      member.role === 'other' &&
      member.otherRelationship === 'common_law_partner',
  );
  const partner = formalSpouse ?? commonLawPartner;
  const adults = [headMember, partner].filter(
    (member): member is FamilyMember => Boolean(member),
  );

  const addEmployeesDependent = (
    pensioner: FamilyMember,
    amountMan: number,
  ): void => {
    if (amountMan <= 0) return;
    const state =
      pensionByMember[pensioner.id] ?? createDefaultPensionMemberState();
    const entries = incomeByMember[pensioner.id] ?? [];
    const { general, publicServant } = getTotalEmployeesMonths(
      pensioner,
      state,
      entries,
      referenceDate,
    );
    const detail = ensure(pensioner.id);
    if (general >= publicServant) {
      detail.oldAge.generalEmployees.dependent += amountMan;
    } else {
      detail.oldAge.publicServant.dependent += amountMan;
    }
  };

  const employeeChildCandidates: Array<{
    pensioner: FamilyMember;
    amountMan: number;
  }> = [];

  for (const pensioner of adults) {
    const state =
      pensionByMember[pensioner.id] ?? createDefaultPensionMemberState();
    const entries = incomeByMember[pensioner.id] ?? [];
    const otherAdult = adults.find((member) => member.id !== pensioner.id);

    if (otherAdult) {
      const otherState =
        pensionByMember[otherAdult.id] ?? createDefaultPensionMemberState();
      const otherEntries = incomeByMember[otherAdult.id] ?? [];

      addEmployeesDependent(
        pensioner,
        calcDependentSpousePensionMonthlyMan(
          pensioner,
          state,
          entries,
          otherAdult,
          otherState,
          otherEntries,
          referenceDate,
          calendarYear,
          calendarMonth,
        ),
      );

      const transfer = calcTransferAdditionMonthlyMan(
        pensioner,
        state,
        entries,
        otherAdult,
        otherState,
        otherEntries,
        referenceDate,
        calendarYear,
        calendarMonth,
      );
      if (transfer > 0) {
        ensure(otherAdult.id).oldAge.basic.transfer += transfer;
      }
    }

    const employeeChildAddition =
      calcDependentChildrenPensionMonthlyMan(
        pensioner,
        state,
        entries,
        familyMembers,
        referenceDate,
        calendarYear,
        calendarMonth,
      );
    if (employeeChildAddition > 0) {
      employeeChildCandidates.push({
        pensioner,
        amountMan: employeeChildAddition,
      });
    }
  }

  const selectedEmployeesChild =
    employeeChildCandidates.find(
      ({ pensioner }) => pensioner.role === 'head',
    ) ?? employeeChildCandidates[0];

  if (selectedEmployeesChild) {
    addEmployeesDependent(
      selectedEmployeesChild.pensioner,
      selectedEmployeesChild.amountMan,
    );
  } else {
    const basicChildCandidates = adults
      .map((pensioner) => {
        const state =
          pensionByMember[pensioner.id] ?? createDefaultPensionMemberState();
        const entries = incomeByMember[pensioner.id] ?? [];
        return {
          pensioner,
          amountMan: calcOldAgeBasicChildrenPensionMonthlyMan(
            pensioner,
            state,
            entries,
            familyMembers,
            referenceDate,
            calendarYear,
            calendarMonth,
          ),
        };
      })
      .filter(({ amountMan }) => amountMan > 0);

    const selectedBasicChild =
      basicChildCandidates.find(
        ({ pensioner }) => pensioner.role === 'head',
      ) ?? basicChildCandidates[0];
    if (selectedBasicChild) {
      ensure(selectedBasicChild.pensioner.id).oldAge.basic.children +=
        selectedBasicChild.amountMan;
    }
  }

  return result;
}

function calcMemberMonthlyPensionBreakdownWithHouseholdAdditionsMan(
  member: FamilyMember,
  memberState: PensionMemberState,
  incomeEntries: IncomeEntry[],
  familyMembers: FamilyMember[],
  pensionByMember: Record<string, PensionMemberState>,
  incomeByMember: Record<string, IncomeEntry[]>,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): PensionBreakdown {
  const result = calcMemberMonthlyPensionBreakdownMan(
    member,
    memberState,
    incomeEntries,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  const addition =
    calcOldAgeHouseholdAdditionsByMemberMan(
      familyMembers,
      pensionByMember,
      incomeByMember,
      referenceDate,
      calendarYear,
      calendarMonth,
    )[member.id];
  if (addition) addPensionBreakdown(result, addition);
  return result;
}

/** 暦月ごとの受給資格に基づく1か月分の年金内訳（支給タイミングは別途調整） */
export function calcMonthlyPensionEntitlementBreakdownMan(
  familyMembers: FamilyMember[],
  pensionByMember: Record<string, PensionMemberState>,
  incomeByMember: Record<string, IncomeEntry[]>,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): PensionBreakdown {
  const total = createEmptyPensionBreakdown();

  for (const member of familyMembers) {
    if (member.role === 'pet') continue;

    const memberState =
      pensionByMember[member.id] ?? createDefaultPensionMemberState();
    const incomeEntries = incomeByMember[member.id] ?? [];

    addPensionBreakdown(
      total,
      calcMemberMonthlyPensionBreakdownMan(
        member,
        memberState,
        incomeEntries,
        referenceDate,
        calendarYear,
        calendarMonth,
      ),
    );
  }

  const additionsByMember = calcOldAgeHouseholdAdditionsByMemberMan(
    familyMembers,
    pensionByMember,
    incomeByMember,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
  for (const addition of Object.values(additionsByMember)) {
    addPensionBreakdown(total, addition);
  }

  return total;
}

/** @deprecated 支給スケジュール反映後の入金額は cashFlow 側で集計 */
export function calcMonthlyPensionBreakdownMan(
  familyMembers: FamilyMember[],
  pensionByMember: Record<string, PensionMemberState>,
  incomeByMember: Record<string, IncomeEntry[]>,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): PensionBreakdown {
  return calcMonthlyPensionEntitlementBreakdownMan(
    familyMembers,
    pensionByMember,
    incomeByMember,
    referenceDate,
    calendarYear,
    calendarMonth,
  );
}

export function calcMonthlyPensionMan(
  familyMembers: FamilyMember[],
  pensionByMember: Record<string, PensionMemberState>,
  incomeByMember: Record<string, IncomeEntry[]>,
  referenceDate: Date,
  calendarYear: number,
  calendarMonth: number,
): number {
  return sumPensionBreakdown(
    calcMonthlyPensionEntitlementBreakdownMan(
      familyMembers,
      pensionByMember,
      incomeByMember,
      referenceDate,
      calendarYear,
      calendarMonth,
    ),
  );
}
