import {
  applyFetchedEducationCosts,
  fetchNurseryEducationCosts,
  type NurseryCostFetchInput,
} from './fetchNurseryEducationCosts';
import { fetchElementaryEducationCosts } from './fetchElementaryEducationCosts';
import { fetchJuniorHighEducationCosts } from './fetchJuniorHighEducationCosts';
import { fetchHighSchoolEducationCosts } from './fetchHighSchoolEducationCosts';
import { fetchUniversityEducationCosts } from './fetchUniversityEducationCosts';
import { fetchGraduateEducationCosts } from './fetchGraduateEducationCosts';
import {
  fetchKindergartenEducationCosts,
} from './fetchKindergartenEducationCosts';
import type {
  EducationExpenseEntry,
  FetchedEducationCosts,
} from '../types/education';

export type EducationCostFetchInput = NurseryCostFetchInput;

export function isEducationCostFetchAvailable(
  entry: Pick<EducationExpenseEntry, 'schoolCategory' | 'schoolType'>,
): boolean {
  if (entry.schoolCategory === 'high_school') {
    return true;
  }

  if (entry.schoolCategory === 'university') {
    return true;
  }

  if (entry.schoolCategory === 'graduate') {
    return true;
  }

  return (
    entry.schoolCategory === 'nursery' ||
    entry.schoolCategory === 'kindergarten' ||
    entry.schoolCategory === 'elementary' ||
    entry.schoolCategory === 'junior_high'
  );
}

export function fetchEducationCosts(
  input: EducationCostFetchInput,
): FetchedEducationCosts {
  if (input.entry.schoolCategory === 'nursery') {
    return fetchNurseryEducationCosts(input);
  }

  if (input.entry.schoolCategory === 'kindergarten') {
    return fetchKindergartenEducationCosts({
      entry: input.entry,
      member: input.member,
      headMember: input.headMember,
      taxSocialState: input.taxSocialState,
      referenceDate: input.referenceDate,
    });
  }

  if (input.entry.schoolCategory === 'elementary') {
    return fetchElementaryEducationCosts({
      entry: input.entry,
      member: input.member,
      headMember: input.headMember,
      taxSocialState: input.taxSocialState,
      referenceDate: input.referenceDate,
    });
  }

  if (input.entry.schoolCategory === 'junior_high') {
    return fetchJuniorHighEducationCosts({
      entry: input.entry,
      member: input.member,
      headMember: input.headMember,
      taxSocialState: input.taxSocialState,
      referenceDate: input.referenceDate,
    });
  }

  if (input.entry.schoolCategory === 'high_school') {
    return fetchHighSchoolEducationCosts({
      entry: input.entry,
      member: input.member,
      headMember: input.headMember,
      taxSocialState: input.taxSocialState,
      referenceDate: input.referenceDate,
    });
  }

  if (input.entry.schoolCategory === 'university') {
    return fetchUniversityEducationCosts({
      entry: input.entry,
      member: input.member,
      headMember: input.headMember,
      taxSocialState: input.taxSocialState,
      referenceDate: input.referenceDate,
    });
  }

  if (input.entry.schoolCategory === 'graduate') {
    return fetchGraduateEducationCosts({
      entry: input.entry,
      member: input.member,
      headMember: input.headMember,
      taxSocialState: input.taxSocialState,
      referenceDate: input.referenceDate,
    });
  }

  throw new Error(
    '費用取得は保育園・幼稚園・小学校・中学校・高校・大学・大学院のみ対応しています。',
  );
}

export function fetchAndApplyEducationCosts(
  input: EducationCostFetchInput,
): EducationExpenseEntry {
  const costs = fetchEducationCosts(input);
  return applyFetchedEducationCosts(input.entry, costs);
}

export { applyFetchedEducationCosts };
