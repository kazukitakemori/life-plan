import { getMemberAgeMonth } from './birthDate';
import type { FamilyMember } from '../types/family';
import type { LifeEventState } from '../types/lifeEvent';

const MAN_TO_YEN = 10_000;

export interface LifeEventGiftTaxCollection {
  taxableByDonorYen: Record<string, number>;
  unconfirmedYen: number;
  nonTaxableYen: number;
}

export function createEmptyLifeEventGiftTaxCollection(): LifeEventGiftTaxCollection {
  return {
    taxableByDonorYen: {},
    unconfirmedYen: 0,
    nonTaxableYen: 0,
  };
}

/**
 * Q3「子・孫の祝い金」のうち、指定した受贈者・暦年に発生する金額を
 * 贈与税の確認状態ごとに集計する。
 *
 * unknown は税額へ推測反映せず、未確認額として返す。
 * taxable だけを暦年贈与へ合算する。
 * non_taxable はユーザーが非課税扱いを確認したものとして税額へ加えない。
 */
export function collectLifeEventGiftTaxForRecipient(input: {
  recipientId: string;
  familyMembers: FamilyMember[];
  lifeEventState: LifeEventState;
  referenceDate: Date;
  calendarYear: number;
  monthStart?: number;
  monthEnd?: number;
}): LifeEventGiftTaxCollection {
  const result = createEmptyLifeEventGiftTaxCollection();
  const recipient = input.familyMembers.find(
    (member) => member.id === input.recipientId,
  );
  if (!recipient || recipient.birthMonth == null) return result;

  const paymentMonth = recipient.birthMonth;
  const monthStart = input.monthStart ?? 1;
  const monthEnd = input.monthEnd ?? 12;
  if (paymentMonth < monthStart || paymentMonth > monthEnd) return result;

  const ageMonth = getMemberAgeMonth(
    recipient,
    input.referenceDate,
    input.calendarYear,
    paymentMonth,
  );
  if (!ageMonth) return result;

  for (const [donorId, entries] of Object.entries(input.lifeEventState.byMember)) {
    if (!input.familyMembers.some((member) => member.id === donorId)) continue;

    for (const entry of entries) {
      if (entry.type !== 'celebration_gift') continue;
      const beneficiary = entry.celebrationBeneficiaries?.find(
        (item) => item.memberId === recipient.id,
      );
      if (
        !beneficiary ||
        beneficiary.amountMan <= 0 ||
        beneficiary.targetAge !== ageMonth.age
      ) {
        continue;
      }

      const amountYen = Math.round(beneficiary.amountMan * MAN_TO_YEN);
      switch (beneficiary.giftTaxTreatment ?? 'unknown') {
        case 'taxable':
          result.taxableByDonorYen[donorId] =
            (result.taxableByDonorYen[donorId] ?? 0) + amountYen;
          break;
        case 'non_taxable':
          result.nonTaxableYen += amountYen;
          break;
        default:
          result.unconfirmedYen += amountYen;
          break;
      }
    }
  }

  return result;
}
