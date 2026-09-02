/**

 * 企業型DC → iDeCo 残高移管（第一段）

 * npx tsx scripts/verify-dc-ideco-transfer.mjs

 */

import {

  applyDcBalanceTransferToIdeco,

  findIdecoTransferTarget,

  isDcIdecoTransferMonth,

  needsDcIdecoTransferOnEnd,

  resolveDcIdecoTransferAgeMonth,

} from '../src/lib/dcIdecoTransfer.ts';

import {

  calcSavingsWithdrawalManForMonth,

  estimateInvestBalanceManAt,

  projectSavingsForYear,

} from '../src/lib/savingsCashFlow.ts';

import { createSavingsEntry } from '../src/lib/savingsDefaults.ts';

import { createDefaultFamily } from '../src/lib/familyDefaults.ts';

import { calcBirthYear } from '../src/lib/birthDate.ts';



const referenceDate = new Date(2026, 5, 1);



function assert(cond, msg) {

  if (!cond) throw new Error(msg);

}

function assertEq(a, b, msg) {

  if (a !== b) throw new Error(`${msg}: got ${a}, want ${b}`);

}



const family = createDefaultFamily(referenceDate);

const member = { ...family[0], age: 40, birthMonth: 4 };



let dc = createSavingsEntry('dc', member, referenceDate, {

  employerContributionMode: 'monthly',

  employerContributionMan: 2,

  employeeContributionMode: 'none',

  employeeContributionMan: 0,

  expectedReturnRatePct: 0,

  startAge: 40,

  startMonth: 7,

  endAge: 50,

  endMonth: 3,

  transferBalanceToIdecoOnEnd: true,

  withdrawalMode: 'once',

  withdrawalMan: 999,

  withdrawalStartAge: 60,

  withdrawalStartMonth: 4,

});

const ideco = createSavingsEntry('ideco', member, referenceDate, {

  contributionMode: 'none',

  contributionMan: 0,

  expectedReturnRatePct: 0,

  withdrawalMode: 'none',

});



assert(needsDcIdecoTransferOnEnd(dc), 'needs transfer when end < 60');

assert(

  !needsDcIdecoTransferOnEnd({ ...dc, endAge: 60 }),

  'no transfer need when end >= 60',

);

assertEq(

  resolveDcIdecoTransferAgeMonth({ ...dc, endAge: 65 }),

  null,

  'resolve null when end >= 60 even if flag on',

);



assertEq(

  resolveDcIdecoTransferAgeMonth(dc)?.age,

  50,

  'transfer age',

);

assert(

  findIdecoTransferTarget([dc, ideco], dc.id)?.id === ideco.id,

  'find target',

);



const applied = applyDcBalanceTransferToIdeco({

  dcEntry: dc,

  idecoEntry: ideco,

  balances: { [dc.id]: 100, [ideco.id]: 10 },

  principals: { [dc.id]: 80, [ideco.id]: 10 },

});

assertEq(applied.transferredMan, 100, 'amount');

assertEq(applied.balances[dc.id], 0, 'dc zero');

assertEq(applied.balances[ideco.id], 110, 'ideco receives');

console.log('OK apply transfer helper');



assertEq(

  calcSavingsWithdrawalManForMonth(

    dc,

    member,

    referenceDate,

    2046,

    4,

    [dc, ideco],

  ),

  0,

  'DC payout skipped when transfer on',

);

const dcUntil65 = {
  ...dc,
  endAge: 65,
  endMonth: 3,
  transferBalanceToIdecoOnEnd: true,
};
const payoutWithFlag = calcSavingsWithdrawalManForMonth(
  dcUntil65,
  member,
  referenceDate,
  2046,
  4,
  [dcUntil65, ideco],
);
const payoutWithoutFlag = calcSavingsWithdrawalManForMonth(
  { ...dcUntil65, transferBalanceToIdecoOnEnd: false },
  member,
  referenceDate,
  2046,
  4,
  [dcUntil65, ideco],
);
assertEq(
  payoutWithFlag,
  payoutWithoutFlag,
  'transfer flag ignored for payout when end >= 60',
);
assert(
  !needsDcIdecoTransferOnEnd(dcUntil65),
  'no transfer need when end >= 60 (65)',
);
console.log('OK withdrawal skipped / allowed');



const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);

// age 50 month 3: calendarMonth 3 < birthMonth 4 → year = birthYear + 51

const calYear = birthYear + 51;

assert(

  isDcIdecoTransferMonth(dc, member, referenceDate, calYear, 3),

  `transfer month detect ${calYear}/3`,

);

assert(

  !isDcIdecoTransferMonth(

    { ...dc, endAge: 65 },

    member,

    referenceDate,

    birthYear + 65,

    3,

  ),

  'no transfer month when end >= 60',

);



const state = { byMember: { [member.id]: [dc, ideco] } };

const proj = projectSavingsForYear({

  savingsState: state,

  familyMembers: [member],

  referenceDate,

  calendarYear: calYear,

  monthStart: 1,

  monthEnd: 12,

  accountBalances: { [dc.id]: 200, [ideco.id]: 0 },

  investPrincipalByEntry: { [dc.id]: 200, [ideco.id]: 0 },

  residualCash: 0,

  annualBalance: 0,

  initialize: false,

});

assertEq(proj.accountBalances[dc.id], 0, 'proj dc after transfer');

assert(

  proj.accountBalances[ideco.id] >= 200,

  `proj ideco after transfer got ${proj.accountBalances[ideco.id]}`,

);

console.log('OK CF year projection transfer');

const estimated = estimateInvestBalanceManAt({
  entry: ideco,
  member,
  memberEntries: [dc, ideco],
  referenceDate,
  targetAge: 60,
  targetMonth: 4,
});
assert(
  estimated >= 200,
  `estimate ideco includes DC transfer got ${estimated}`,
);
console.log('OK estimate includes transfer');

console.log('All DC→iDeCo transfer checks passed');


