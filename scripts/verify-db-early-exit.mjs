/**
 * DB 60歳前退職時の扱い（据置・脱退一時金・iDeCo移換）
 * npx tsx scripts/verify-db-early-exit.mjs
 */
import {
  applyDbAmountTransferToIdeco,
  isDbIdecoTransferMonth,
  isDbLumpAtExit,
  isDbTransferToIdeco,
  needsDbEarlyExitChoice,
  resolveDbEarlyExitMode,
  resolveDbQualificationEnd,
} from '../src/lib/dbEarlyExit.ts';
import {
  calcSavingsWithdrawalManForMonth,
  estimateInvestBalanceManAt,
  projectSavingsForYear,
} from '../src/lib/savingsCashFlow.ts';
import { createSavingsEntry } from '../src/lib/savingsDefaults.ts';
import { createDefaultFamily } from '../src/lib/familyDefaults.ts';
import { calcBirthYear } from '../src/lib/birthDate.ts';
import { findIdecoTransferTarget } from '../src/lib/dcIdecoTransfer.ts';

const referenceDate = new Date(2026, 5, 1);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`${msg}: got ${a}, want ${b}`);
}

const family = createDefaultFamily(referenceDate);
const member = { ...family[0], age: 40, birthMonth: 4 };
const birthYear = calcBirthYear(member.age, member.birthMonth, referenceDate);

const db = createSavingsEntry('db', member, referenceDate, {
  dbEnrollmentMode: 'period',
  dbEnrollmentStartAge: 25,
  dbEnrollmentStartMonth: 4,
  dbEnrollmentEndAge: 50,
  dbEnrollmentEndMonth: 3,
  dbEnrollmentYears: 25,
  dbEarlyExitMode: 'transfer_ideco',
  withdrawalMode: 'none',
  withdrawalMan: 800,
  withdrawalStartAge: 60,
  withdrawalStartMonth: 4,
});

assert(needsDbEarlyExitChoice(db, member), 'needs early exit');
assertEq(resolveDbEarlyExitMode(db.dbEarlyExitMode), 'transfer_ideco', 'mode');
assert(isDbTransferToIdeco(db, member), 'transfer ideco');
assertEq(resolveDbQualificationEnd(db, member)?.age, 50, 'exit age');

const ideco = createSavingsEntry('ideco', member, referenceDate, {
  contributionMode: 'none',
  contributionMan: 0,
  expectedReturnRatePct: 0,
  withdrawalMode: 'once',
  withdrawalStartAge: 60,
  withdrawalStartMonth: 4,
  balanceMan: 0,
});

assert(
  findIdecoTransferTarget([db, ideco], db.id)?.id === ideco.id,
  'find ideco',
);

const applied = applyDbAmountTransferToIdeco({
  dbEntry: db,
  idecoEntry: ideco,
  balances: { [ideco.id]: 10 },
  principals: { [ideco.id]: 10 },
});
assertEq(applied.transferredMan, 800, 'transfer amount');
assertEq(applied.balances[ideco.id], 810, 'ideco receives');

const exitYear = birthYear + 51; // age 50 month 3
assert(
  isDbIdecoTransferMonth(db, member, referenceDate, exitYear, 3),
  'transfer month',
);

assertEq(
  calcSavingsWithdrawalManForMonth(
    db,
    member,
    referenceDate,
    exitYear,
    3,
    [db, ideco],
  ),
  0,
  'no DB cash payout when transfer',
);

const lumpDb = {
  ...db,
  dbEarlyExitMode: 'lump_at_exit',
  withdrawalMode: 'once',
  withdrawalStartAge: 50,
  withdrawalStartMonth: 3,
};
assert(isDbLumpAtExit(lumpDb, member), 'lump');
assertEq(
  calcSavingsWithdrawalManForMonth(
    lumpDb,
    member,
    referenceDate,
    exitYear,
    3,
    [lumpDb],
  ),
  800,
  'lump at exit',
);

const state = { byMember: { [member.id]: [db, ideco] } };
const proj = projectSavingsForYear({
  savingsState: state,
  familyMembers: [member],
  referenceDate,
  calendarYear: exitYear,
  monthStart: 1,
  monthEnd: 12,
  accountBalances: { [ideco.id]: 0 },
  investPrincipalByEntry: { [ideco.id]: 0 },
  residualCash: 0,
  annualBalance: 0,
  initialize: false,
});
assertEq(proj.accountBalances[ideco.id], 800, 'proj ideco after DB transfer');

const estimated = estimateInvestBalanceManAt({
  entry: ideco,
  member,
  memberEntries: [db, ideco],
  referenceDate,
  targetAge: 60,
  targetMonth: 4,
});
assert(estimated >= 800, `estimate includes DB transfer got ${estimated}`);

const yearsOnly = createSavingsEntry('db', member, referenceDate, {
  dbEnrollmentMode: 'years',
  dbEnrollmentYears: 20,
  dbEnrollmentEndAge: 50,
});
assert(
  !needsDbEarlyExitChoice(yearsOnly, member),
  'years mode does not force early-exit UI',
);

console.log('All DB early-exit checks passed');
