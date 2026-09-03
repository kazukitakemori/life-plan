import {
  getLicenseEntitlements,
  isLicenseEdition,
  type LicenseEdition,
} from '../../types/licenseEdition';

export { getLicenseEntitlements, canCreatePlan } from '../../types/licenseEdition';
export type { LicenseEdition, LicenseEntitlements } from '../../types/licenseEdition';

export function parseLicenseEdition(value: unknown): LicenseEdition | null {
  return isLicenseEdition(value) ? value : null;
}

/** API 応答からエディションを解釈（欠落時は personal） */
export function resolveLicenseEdition(value: unknown): LicenseEdition {
  return parseLicenseEdition(value) ?? 'personal';
}

export function getEditionFromEntitlements(edition?: LicenseEdition | null) {
  return getLicenseEntitlements(edition);
}
