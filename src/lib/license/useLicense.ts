import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  fetchAccountMe,
  logoutAccount,
  markAccountTrialAnalysisUsed,
  redeemAccountLicense,
} from '../account/api';
import { isLicenseDevUnlock } from './devUnlock';
import { getLicenseEntitlements, resolveLicenseEdition } from './edition';
import type { LicenseDevice, LicenseState } from '../../types/license';
import type { LicenseEdition, LicenseEntitlements } from '../../types/licenseEdition';

interface PendingAccess {
  resolve: (allowed: boolean) => void;
}

const DEV_UNLOCK = isLicenseDevUnlock();

export function useLicense() {
  const [licenseState, setLicenseState] = useState<LicenseState>(
    DEV_UNLOCK ? 'active' : 'checking',
  );
  const [edition, setEdition] = useState<LicenseEdition>(
    DEV_UNLOCK ? 'advisor' : 'personal',
  );
  const [keyHint, setKeyHint] = useState<string | null>(
    DEV_UNLOCK ? '確認版' : null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(
    DEV_UNLOCK
      ? '確認版ではログインを要求せず、開発確認用として全機能を使えます。'
      : null,
  );
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [, setPendingAccess] = useState<PendingAccess | null>(null);
  const [busy, setBusy] = useState(false);
  const [trialAnalysisUsed, setTrialAnalysisUsed] = useState(false);

  const entitlements = useMemo<LicenseEntitlements>(
    () => getLicenseEntitlements(edition),
    [edition],
  );

  const applyAccount = useCallback(
    (account: Awaited<ReturnType<typeof fetchAccountMe>>) => {
      if (!account.authenticated) {
        setLicenseState('inactive');
        setEdition('personal');
        setKeyHint(null);
        setTrialAnalysisUsed(false);
        setErrorMessage(null);
        return false;
      }

      const nextEdition = resolveLicenseEdition(account.entitlement?.edition);
      const status = account.entitlement?.status ?? 'trial';
      setEdition(nextEdition);
      setTrialAnalysisUsed(Boolean(account.entitlement?.trialAnalysisUsed));
      setKeyHint(account.user?.email ?? null);

      if (status === 'active') {
        setLicenseState('active');
        setErrorMessage(null);
        return true;
      }
      if (status === 'trial') {
        setLicenseState('trial');
        setErrorMessage(null);
        return false;
      }

      setLicenseState('error');
      setErrorMessage('このアカウントの利用権は現在無効です。');
      return false;
    },
    [],
  );

  const verifyStoredLicense = useCallback(async () => {
    if (DEV_UNLOCK) return true;
    setLicenseState('checking');
    try {
      const account = await fetchAccountMe();
      return applyAccount(account);
    } catch (error) {
      console.error(error);
      setLicenseState('error');
      setErrorMessage(
        'アカウント情報を確認できませんでした。通信状態を確認して再度お試しください。',
      );
      return false;
    }
  }, [applyAccount]);

  useEffect(() => {
    if (DEV_UNLOCK) return;
    void verifyStoredLicense();
  }, [verifyStoredLicense]);

  const completePendingAccess = useCallback((allowed: boolean) => {
    setPendingAccess((pending) => {
      pending?.resolve(allowed);
      return null;
    });
  }, []);

  const showLoginRequiredMessage = useCallback(() => {
    setErrorMessage(
      'Googleまたはメールアドレスでログインしてから続けてください。',
    );
  }, []);

  const openLicenseModal = useCallback(() => {
    setErrorMessage(null);
    if (DEV_UNLOCK) return;
    if (licenseState === 'inactive' || licenseState === 'error') {
      showLoginRequiredMessage();
      return;
    }
    if (licenseState === 'checking') return;
    setKeyModalOpen(true);
  }, [licenseState, showLoginRequiredMessage]);

  const ensureLicensed = useCallback(async () => {
    if (DEV_UNLOCK) return true;
    if (licenseState === 'active') return true;

    if (licenseState === 'checking') {
      const active = await verifyStoredLicense();
      if (active) return true;
    }

    if (licenseState === 'inactive' || licenseState === 'error') {
      showLoginRequiredMessage();
      return false;
    }

    return await new Promise<boolean>((resolve) => {
      setPendingAccess({ resolve });
      setKeyModalOpen(true);
    });
  }, [licenseState, showLoginRequiredMessage, verifyStoredLicense]);

  const ensureCanRunAnalysis = useCallback(async () => {
    if (DEV_UNLOCK) return true;
    if (licenseState === 'active') return true;
    if (licenseState === 'trial' && !trialAnalysisUsed) return true;

    if (licenseState === 'checking') {
      await verifyStoredLicense();
      return false;
    }

    if (licenseState === 'inactive' || licenseState === 'error') {
      showLoginRequiredMessage();
      return false;
    }

    return ensureLicensed();
  }, [
    ensureLicensed,
    licenseState,
    showLoginRequiredMessage,
    trialAnalysisUsed,
    verifyStoredLicense,
  ]);

  const markTrialAnalysisUsed = useCallback(() => {
    if (DEV_UNLOCK || licenseState !== 'trial') return;
    setTrialAnalysisUsed(true);
    void markAccountTrialAnalysisUsed().catch((error) => {
      console.error(error);
      setErrorMessage(
        '体験利用の状態をクラウドへ保存できませんでした。再読み込み後に状態を確認してください。',
      );
    });
  }, [licenseState]);

  const closeLicenseModal = useCallback(() => {
    setKeyModalOpen(false);
    completePendingAccess(false);
  }, [completePendingAccess]);

  const handleSubmitKey = useCallback(
    async (rawKey: string) => {
      if (DEV_UNLOCK) return true;
      setBusy(true);
      setErrorMessage(null);
      try {
        const result = await redeemAccountLicense(rawKey);
        if (!result.ok) {
          setErrorMessage(result.message ?? '利用コードの登録に失敗しました。');
          return false;
        }
        setEdition(resolveLicenseEdition(result.edition));
        setLicenseState('active');
        setKeyHint('アカウント登録済み');
        setKeyModalOpen(false);
        completePendingAccess(true);
        return true;
      } catch (error) {
        console.error(error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : '利用コードの登録に失敗しました。',
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [completePendingAccess],
  );

  const releaseCurrentDevice = useCallback(async () => {
    if (DEV_UNLOCK) return false;
    setBusy(true);
    try {
      await logoutAccount();
      setLicenseState('inactive');
      setEdition('personal');
      setKeyHint(null);
      setTrialAnalysisUsed(false);
      window.location.reload();
      return true;
    } catch (error) {
      console.error(error);
      setErrorMessage('ログアウトに失敗しました。');
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const replaceDeviceAndActivate = useCallback(async () => false, []);
  const closeDeviceLimitModal = useCallback(() => {
    completePendingAccess(false);
  }, [completePendingAccess]);

  const isLicensed = licenseState === 'active';
  const canRunAnalysis =
    DEV_UNLOCK || isLicensed || (licenseState === 'trial' && !trialAnalysisUsed);
  const devices = useMemo<LicenseDevice[]>(() => [], []);

  return {
    deviceId: 'account',
    licenseState,
    licenseKey: null,
    edition,
    entitlements,
    keyHint,
    devices,
    maxDevices: 0,
    errorMessage,
    busy,
    isLicensed,
    isAnalysisAllowed: isLicensed,
    canRunAnalysis,
    trialAnalysisUsed,
    isDevUnlock: DEV_UNLOCK,
    keyModalOpen,
    deviceLimitModalOpen: false,
    pendingKey: '',
    ensureLicensed,
    ensureCanRunAnalysis,
    ensureLicensedForAnalysis: ensureCanRunAnalysis,
    markTrialAnalysisUsed,
    openLicenseModal,
    closeLicenseModal,
    closeDeviceLimitModal,
    handleSubmitKey,
    replaceDeviceAndActivate,
    releaseCurrentDevice,
    verifyStoredLicense,
  };
}
