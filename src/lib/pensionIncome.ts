/**
 * 公的年金（老齢）の月次内訳計算。
 * v1 簡略化: 物価スライド・障害/寡婦年金の自動計算は未対応。
 */
import { resolveMemberBirthMonth } from './familyDefaults';
import { calcBirthYear } from './birthDate';
import {
  calcTransitionalAdditionYenPerYear,
  countQ7EmployeesMonthsAfterDate,
  estimateEmployeesMonthsForDependentQualification,
  estimateOldAgeAmountsFromIncome,
  getActiveEmployeesMonthlyRemunerationMan,
  getEmployeesEnrollmentMonthCounts,
} from './pensionEnrollmentEstimate';
import {
  applyBasicDetailAdjustment,
  applyGeneralDetailAdjustment,
  applyPublicDetailAdjustment,
  buildBasicDetailFromYen,
  buildGeneralDetailFromYen,
  buildPublicServantDetailFromYen,
  isOnOrAfterBenefitStart,
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
  PensionByMember,
  PensionMemberState,
  TeikibinOver50AmountPair,
  TeikibinOver50AmountTriple,
  TeikibinOver50OldAgePair,
  TeikibinOver50OldAgeTriple,
} from '../types/pension';
import {
  ADDITIONAL_PENSION_UNIT_YEN_PER_MONTH,
  DEPENDENT_PENSION_CUTOFF_AGE,
  DEPENDENT_PENSION_MIN_EMPLOYEES_MONTHS,
  DEPENDENT_SPOUSE_PENSION_YEN_PER_YEAR,
  FULL_BASIC_PENSION_MONTHS,
  FULL_BASIC_PENSION_YEN_PER_YEAR,
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
 * 50 歳未満の定期便から老齢年金の 65 歳時点見込み額を取得する。
 * - 老齢基礎・一般厚生・公務員厚生: 定期便記載の 65 歳見込み額
 * - 付加年金（additional）: 定期便の付加保険料納付月数から算出
 * - 特別支給（payment）: 50 歳未満の定期便には記載なし → 0
 * - 経過的加算（transitional）: 定期便の加入月数と老齢基礎年金額から推計
 *   （定期便記載の老齢基礎年金額 → 逆算した算定基礎月数 vs 厚生年金加入月数の差）
 */
function calcUnder50OldAgeAmounts(
  form: NenkinTeikibinUnder50Form,
): OldAgePensionBreakdown {
  const basicYen = form.oldAgeBasicPensionYen ?? 0;
  const generalYen = form.oldAgeEmployeesGeneralYen ?? 0;
  const publicYen = sumNullable([
    form.oldAgeEmployeesPublicServantYen,
    form.oldAgeEmployeesPrivateSchoolYen,
  ]);

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
      ...buildBasicDetailFromYen(basicYen),
      additional: toMonthlyMan(calcAdditionalPensionYenPerYear(form.additionalPremiumMonths)),
    },
    generalEmployees: {
      ...buildGeneralDetailFromYen(generalYen),
      transitional: toMonthlyMan(generalTransitional),
    },
    publicServant: {
      ...buildPublicServantDetailFromYen(publicYen),
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

/**
 * 暦月ごとの老齢年金内訳（月額・万円）を計算する。
 *
 * ┌──────────────────┬────────────────────────────────────────────────────────┐
 * │ pastEnrollment   │ 計算内容                                               │
 * ├──────────────────┼────────────────────────────────────────────────────────┤
 * │ none（定期便なし）│ Q7 推計: 老齢基礎(加入月数比例) + 老齢厚生(報酬比例のみ)│
 * │ under50（定期便） │ 定期便: 65 歳見込み額（特支・経加なし）                │
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
  const bSetting = benefitSettings.oldAgeBasic;
  const gSetting = benefitSettings.oldAgeGeneralEmployees;
  const pSetting = benefitSettings.oldAgePublicPrivate;

  const basicActive   = isOnOrAfterBenefitStart(ageMonth.age, ageMonth.month, bSetting.startAge, resolveMemberBirthMonth(member), bSetting.startMonth ?? 0);
  const generalActive = isOnOrAfterBenefitStart(ageMonth.age, ageMonth.month, gSetting.startAge, resolveMemberBirthMonth(member), gSetting.startMonth ?? 0);
  const publicActive  = isOnOrAfterBenefitStart(ageMonth.age, ageMonth.month, pSetting.startAge, resolveMemberBirthMonth(member), pSetting.startMonth ?? 0);

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
        autoBase = calcUnder50OldAgeAmounts(memberState.teikibinUnder50);
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

  if (basicActive) {
    let basic =
      bSetting.amountMode === 'manual'
        ? buildBasicDetailFromYen(bSetting.manualAmountPerYear ?? 0)
        : autoBase.basic;
    // manual は手入力値そのままのため調整しない
    const bStartMonths = bSetting.startAge * 12 + (bSetting.startMonth ?? 0);
    if (bSetting.amountMode !== 'manual' && bStartMonths !== STANDARD_OLD_AGE_START * 12) {
      basic = applyBasicDetailAdjustment(basic, bSetting.startAge, bSetting.startMonth ?? 0);
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
      general = applyGeneralDetailAdjustment(general, gSetting.startAge, gSetting.startMonth ?? 0);
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
      pub = applyPublicDetailAdjustment(pub, pSetting.startAge, pSetting.startMonth ?? 0);
    }
    result.publicServant = pub;
  }

  // ─ 在職老齢年金（65歳以上）: 就労収入があれば支給停止を適用 ─
  // 65歳未満は低在老が廃止済み（令和4年4月〜）のため対象外
  if (ageMonth.age >= STANDARD_OLD_AGE_START && (generalActive || publicActive)) {
    const remunerationMan = getActiveEmployeesMonthlyRemunerationMan(
      incomeEntries,
      ageMonth.age,
      ageMonth.month,
      calcBirthYear(member.age, member.birthMonth, referenceDate),
      resolveMemberBirthMonth(member),
    );
    if (remunerationMan > 0) {
      return applyZaishokuSuspension(result, remunerationMan);
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
        autoBase = calcUnder50OldAgeAmounts(memberState.teikibinUnder50);
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
 * 在職老齢年金（65歳以上）の支給停止を老齢厚生年金内訳に適用する。
 *
 * 支給停止ルール（令和8年度基準額 65万円/月）:
 *   超過額 = 基本月額 + 総報酬月額相当額 − 50万円
 *   支給停止額 = max(0, 超過額 / 2)
 *
 * 基本月額 = generalEmployees + publicServant の合計（dependent/加給年金を除く全フィールド）。
 * 支給停止額は一般厚生・公務員厚生に比率按分して各フィールドへ反映。
 * 加給年金（dependent）は老齢厚生が全額停止のときのみ連動停止。
 */
function applyZaishokuSuspension(
  breakdown: OldAgePensionBreakdown,
  totalRemunerationMan: number,
): OldAgePensionBreakdown {
  if (totalRemunerationMan <= 0) return breakdown;

  const thresholdMan = ZAISHOKU_SUSPENSION_THRESHOLD_YEN_PER_MONTH / 10000;

  // 加給年金を除いた老齢厚生合計（基本月額）
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
  if (excess <= 0) return breakdown; // 支給停止なし

  const suspensionMan = Math.min(excess / 2, basicMonthlyMan);

  // 一般・公務員に比率按分
  const generalRatio = basicMonthlyMan > 0 ? generalNonDep / basicMonthlyMan : 0;
  const generalSuspension = suspensionMan * generalRatio;
  const publicSuspension = suspensionMan - generalSuspension;

  // 各フィールドをスケールダウン（加給年金は除外）
  const scaleDown = (fields: number, suspension: number): number => {
    if (fields <= 0) return 1;
    return Math.max(0, (fields - suspension) / fields);
  };

  const gFactor = scaleDown(generalNonDep, generalSuspension);
  const pFactor = scaleDown(publicNonDep, publicSuspension);

  const result: OldAgePensionBreakdown = {
    basic: breakdown.basic,
    generalEmployees: {
      basic: breakdown.generalEmployees.basic * gFactor,
      transitional: breakdown.generalEmployees.transitional * gFactor,
      payment: breakdown.generalEmployees.payment * gFactor,
      earlyPayment: breakdown.generalEmployees.earlyPayment * gFactor,
      // 老齢厚生が全額停止の場合のみ加給年金も停止
      dependent: suspensionMan >= basicMonthlyMan ? 0 : breakdown.generalEmployees.dependent,
    },
    publicServant: {
      basic: breakdown.publicServant.basic * pFactor,
      transitional: breakdown.publicServant.transitional * pFactor,
      occupational: breakdown.publicServant.occupational * pFactor,
      payment: breakdown.publicServant.payment * pFactor,
      earlyPayment: breakdown.publicServant.earlyPayment * pFactor,
      dependent: suspensionMan >= basicMonthlyMan ? 0 : breakdown.publicServant.dependent,
    },
  };

  return result;
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
        calcMemberMonthlyPensionBreakdownMan(
          member,
          memberState,
          incomeEntries,
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
function calcDependentSpousePensionMonthlyMan(
  headMember: FamilyMember,
  headMemberState: PensionMemberState,
  headIncomeEntries: IncomeEntry[],
  spouseMember: FamilyMember,
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

  const gSet = benefitSettings.oldAgeGeneralEmployees;
  const pSet = benefitSettings.oldAgePublicPrivate;
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

  if (
    isOnOrAfterBenefitStart(
      spouseAge,
      calendarMonth,
      DEPENDENT_PENSION_CUTOFF_AGE,
      resolveMemberBirthMonth(spouseMember),
    )
  ) {
    return 0;
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

  return toMonthlyMan(DEPENDENT_SPOUSE_PENSION_YEN_PER_YEAR);
}

/**
 * 令和8年度(2026年度)の振替加算額を配偶者の生年月日から返す。
 * 日付不明のため、4月生まれは「4月2日以降」として扱い保守的に判定する。
 */
function getTransferAdditionYenPerYear(
  spouseBirthYear: number,
  spouseBirthMonth: number,
): number {
  // 生年がcutoffYear年4月2日以降かを判定（月のみで判断: 4月は4月2日以降扱い）
  const onOrAfterApril = (cutoffYear: number): boolean =>
    spouseBirthYear > cutoffYear ||
    (spouseBirthYear === cutoffYear && spouseBirthMonth >= 4);

  if (onOrAfterApril(1966)) return 0;         // 昭和41/4/2〜: 対象外
  if (onOrAfterApril(1961)) return 16_335;    // 昭和36〜41 (0.067)
  if (onOrAfterApril(1960)) return 22_673;    // 昭和35〜36 (0.093)
  if (onOrAfterApril(1959)) return 29_256;    // 昭和34〜35 (0.120)
  if (onOrAfterApril(1958)) return 35_839;    // 昭和33〜34 (0.147)
  if (onOrAfterApril(1957)) return 42_177;    // 昭和32〜33 (0.173)
  if (onOrAfterApril(1956)) return 48_760;    // 昭和31〜32 (0.200, base 243,800)
  if (onOrAfterApril(1955)) return 55_184;    // 昭和30〜31 (0.227, base 243,100)
  if (onOrAfterApril(1954)) return 61_504;    // 昭和29〜30 (0.253)
  if (onOrAfterApril(1953)) return 68_068;    // 昭和28〜29 (0.280)
  if (onOrAfterApril(1952)) return 74_632;    // 昭和27〜28 (0.307)
  if (onOrAfterApril(1951)) return 80_952;    // 昭和26〜27 (0.333)
  if (onOrAfterApril(1950)) return 87_516;    // 昭和25〜26 (0.360)
  if (onOrAfterApril(1949)) return 94_080;    // 昭和24〜25 (0.387)
  if (onOrAfterApril(1948)) return 100_400;   // 昭和23〜24 (0.413)
  if (onOrAfterApril(1947)) return 106_964;   // 昭和22〜23 (0.440)
  if (onOrAfterApril(1946)) return 113_528;   // 昭和21〜22 (0.467)
  if (onOrAfterApril(1945)) return 119_848;   // 昭和20〜21 (0.493)
  if (onOrAfterApril(1944)) return 126_412;   // 昭和19〜20 (0.520)
  if (onOrAfterApril(1943)) return 132_975;   // 昭和18〜19 (0.547)
  if (onOrAfterApril(1942)) return 139_296;   // 昭和17〜18 (0.573)
  if (onOrAfterApril(1941)) return 145_860;   // 昭和16〜17 (0.600)
  if (onOrAfterApril(1940)) return 152_424;   // 昭和15〜16 (0.627)
  if (onOrAfterApril(1939)) return 158_744;   // 昭和14〜15 (0.653)
  if (onOrAfterApril(1938)) return 165_308;   // 昭和13〜14 (0.680)
  if (onOrAfterApril(1937)) return 171_872;   // 昭和12〜13 (0.707)
  if (onOrAfterApril(1936)) return 178_192;   // 昭和11〜12 (0.733)
  if (onOrAfterApril(1935)) return 184_756;   // 昭和10〜11 (0.760)
  if (onOrAfterApril(1934)) return 191_320;   // 昭和 9〜10 (0.787)
  if (onOrAfterApril(1933)) return 197_640;   // 昭和 8〜 9 (0.813)
  if (onOrAfterApril(1932)) return 204_204;   // 昭和 7〜 8 (0.840)
  if (onOrAfterApril(1931)) return 210_768;   // 昭和 6〜 7 (0.867)
  if (onOrAfterApril(1930)) return 217_088;   // 昭和 5〜 6 (0.893)
  if (onOrAfterApril(1929)) return 223_652;   // 昭和 4〜 5 (0.920)
  if (onOrAfterApril(1928)) return 230_216;   // 昭和 3〜 4 (0.947)
  if (onOrAfterApril(1927)) return 236_536;   // 昭和 2〜 3 (0.973)
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
  const yenPerYear = getTransferAdditionYenPerYear(spouseBirthYear, resolveMemberBirthMonth(spouseMember));
  if (yenPerYear <= 0) return 0;

  // 配偶者が老齢基礎年金の受給開始年齢に達しているか確認
  const spouseSettings =
    spouseMemberState.benefitSettings ?? createDefaultBenefitSettings();
  let spouseAge = calendarYear - spouseBirthYear;
  if (calendarMonth < resolveMemberBirthMonth(spouseMember)) spouseAge--;

  if (
    !isOnOrAfterBenefitStart(
      spouseAge,
      calendarMonth,
      spouseSettings.oldAgeBasic.startAge,
      resolveMemberBirthMonth(spouseMember),
      spouseSettings.oldAgeBasic.startMonth ?? 0,
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

  // 加給年金（配偶者分）: 世帯主が老齢厚生受給中かつ配偶者が65歳未満の間に加算
  const headMember = familyMembers.find((m) => m.role === 'head');
  const spouseMember = familyMembers.find((m) => m.role === 'spouse');
  if (headMember && spouseMember) {
    const headState =
      pensionByMember[headMember.id] ?? createDefaultPensionMemberState();
    const headEntries = incomeByMember[headMember.id] ?? [];

    const dependentMonthlyMan = calcDependentSpousePensionMonthlyMan(
      headMember,
      headState,
      headEntries,
      spouseMember,
      referenceDate,
      calendarYear,
      calendarMonth,
    );

    if (dependentMonthlyMan > 0) {
      // 一般厚生・公務員厚のどちらに加入月が多いかで振り分ける（通常推計を使用）
      const { general, publicServant } = getTotalEmployeesMonths(
        headMember,
        headState,
        headEntries,
        referenceDate,
      );
      if (general >= publicServant) {
        total.oldAge.generalEmployees.dependent += dependentMonthlyMan;
      } else {
        total.oldAge.publicServant.dependent += dependentMonthlyMan;
      }
    }

    // 振替加算: 加給年金の支給要件を満たしていた世帯主の配偶者が65歳になった後、
    // 配偶者の老齢基礎年金に加算される（生年月日による段階的な金額）
    const spouseState =
      pensionByMember[spouseMember.id] ?? createDefaultPensionMemberState();
    const transferMonthlyMan = calcTransferAdditionMonthlyMan(
      headMember,
      headState,
      headEntries,
      spouseMember,
      spouseState,
      referenceDate,
      calendarYear,
      calendarMonth,
    );
    if (transferMonthlyMan > 0) {
      total.oldAge.basic.transfer += transferMonthlyMan;
    }
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
