/**
 * Q10 保険 CF 振り分けの簡易検証
 * npx tsx scripts/verify-insurance-cf.mjs
 *
 * - 火災（所有）→ ownedInsurancePremium
 * - 火災（賃貸）→ rentalInsurancePremium
 * - 自動車 → vehicleInsurance
 * - 生保・その他 → insuranceOther
 */
import {
  calcHouseholdMonthlyInsuranceDetailMan,
  createEmptyInsuranceCashFlowDetail,
  addInsuranceCashFlowDetail,
} from '../src/lib/insuranceCashFlow.ts';
import { createInsuranceEntry } from '../src/lib/insuranceDefaults.ts';
import { createDefaultFamily } from '../src/lib/familyDefaults.ts';

const members = createDefaultFamily();
const head = members.find((m) => m.role === 'head');
if (!head) throw new Error('no head');

const referenceDate = new Date(2026, 5, 1);
const refMonth = 6;

const fireOwned = createInsuranceEntry('fire', head, referenceDate, {
  premiumMan: 1.2,
  premiumPaymentMode: 'annual',
  periodSource: 'manual',
  startMonth: refMonth,
  housingLink: {
    targetId: '__household__',
    propertyId: 'owned-1',
    propertyKind: 'owned',
  },
});
const fireRental = createInsuranceEntry('fire', head, referenceDate, {
  premiumMan: 0.8,
  premiumPaymentMode: 'annual',
  periodSource: 'manual',
  startMonth: refMonth,
  housingLink: {
    targetId: '__household__',
    propertyId: 'rental-1',
    propertyKind: 'rental',
  },
});
const auto = createInsuranceEntry('auto', head, referenceDate, {
  premiumMan: 5,
  premiumPaymentMode: 'annual',
  periodSource: 'manual',
  startMonth: refMonth,
  vehicleLink: { memberId: head.id, vehicleId: 'v1' },
});
const life = createInsuranceEntry('life', head, referenceDate, {
  premiumMan: 12,
  premiumPaymentMode: 'annual',
  startMonth: refMonth,
  lifeDeductionKind: 'general',
});

const state = {
  byMember: {
    [head.id]: [fireOwned, fireRental, auto, life],
  },
};

const emptyHousing = { byTarget: {} };
const emptyVehicle = { inflationRate: 0, byMember: {} };

const annual = createEmptyInsuranceCashFlowDetail();
for (let month = 1; month <= 12; month++) {
  addInsuranceCashFlowDetail(
    annual,
    calcHouseholdMonthlyInsuranceDetailMan(
      members,
      state,
      emptyHousing,
      emptyVehicle,
      referenceDate,
      2026,
      month,
    ),
  );
}

const expected = {
  ownedInsurancePremium: 1.2,
  rentalInsurancePremium: 0.8,
  vehicleInsurance: 5,
  insuranceOther: 12,
};

for (const [key, value] of Object.entries(expected)) {
  const actual = annual[key];
  if (Math.abs(actual - value) > 1e-9) {
    console.error(`FAIL ${key}: expected ${value}, got ${actual}`);
    process.exit(1);
  }
}

if (Math.abs(annual.insuranceOtherDetail.life - 12) > 1e-9) {
  console.error(
    `FAIL insuranceOtherDetail.life: expected 12, got ${annual.insuranceOtherDetail.life}`,
  );
  process.exit(1);
}

console.log('OK insurance CF allocation', annual);
