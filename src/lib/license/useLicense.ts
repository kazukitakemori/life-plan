import { useCallback, useEffect, useMemo, useState } from 'react';

import { activateLicense, deactivateLicense, fetchLicenseStatus } from './api';
import {
  clearStoredLicenseKey,
  getDefaultDeviceLabel,
  getOrCreateDeviceId,
  getStoredLicenseKey,
  setStoredLicenseKey,
} from './storage';
import type { LicenseDevice, LicenseState } from '../../types/license';

interface PendingAnalysis {
  resolve: (allowed: boolean) => void;
}

export function useLicense() {
  const deviceId = useMemo(() => getOrCreateDeviceId(), []);
  const [licenseState, setLicenseState] = useState<LicenseState>('checking');
  const [licenseKey, setLicenseKey] = useState<string | null>(() => getStoredLicenseKey());
  const [keyHint, setKeyHint] = useState<string | null>(null);
  const [devices, setDevices] = useState<LicenseDevice[]>([]);
  const [maxDevices, setMaxDevices] = useState(2);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [deviceLimitModalOpen, setDeviceLimitModalOpen] = useState(false);
  const [pendingKey, setPendingKey] = useState('');
  const [, setPendingAnalysis] = useState<PendingAnalysis | null>(null);
  const [busy, setBusy] = useState(false);

  const applyActive = useCallback(
    (hint: string | undefined, nextDevices: LicenseDevice[], nextMaxDevices: number) => {
      setLicenseState('active');
      setKeyHint(hint ?? null);
      setDevices(nextDevices);
      setMaxDevices(nextMaxDevices);
      setErrorMessage(null);
    },
    [],
  );

  const verifyStoredLicense = useCallback(async () => {
    const stored = getStoredLicenseKey();
    setLicenseKey(stored);
    if (!stored) {
      setLicenseState('inactive');
      setKeyHint(null);
      setDevices([]);
      return false;
    }

    setLicenseState('checking');
    try {
      const result = await fetchLicenseStatus(stored, deviceId);
      if (!result.valid) {
        if (result.error === 'NOT_ACTIVATED') {
          setLicenseState('inactive');
          setDevices(result.devices ?? []);
          setMaxDevices(result.maxDevices ?? 2);
          setErrorMessage(result.message ?? null);
          return false;
        }
        clearStoredLicenseKey();
        setLicenseKey(null);
        setLicenseState('inactive');
        setErrorMessage(result.message ?? 'ライセンスが無効です。');
        return false;
      }

      applyActive(result.keyHint, result.devices ?? [], result.maxDevices ?? 2);
      return true;
    } catch {
      setLicenseState('error');
      setErrorMessage(
        'ライセンスサーバーに接続できません。しばらくしてから再度お試しください。',
      );
      return false;
    }
  }, [applyActive, deviceId]);

  useEffect(() => {
    void verifyStoredLicense();
  }, [verifyStoredLicense]);

  const completePendingAnalysis = useCallback((allowed: boolean) => {
    setPendingAnalysis((pending) => {
      pending?.resolve(allowed);
      return null;
    });
  }, []);

  const activate = useCallback(
    async (rawKey: string, replaceDeviceId?: string) => {
      setBusy(true);
      setErrorMessage(null);
      try {
        const result = await activateLicense({
          key: rawKey,
          deviceId,
          deviceLabel: getDefaultDeviceLabel(),
          replaceDeviceId,
        });

        if (!result.ok) {
          if (result.error === 'DEVICE_LIMIT') {
            setPendingKey(rawKey);
            setDevices(result.devices ?? []);
            setMaxDevices(result.maxDevices ?? 2);
            setKeyModalOpen(false);
            setDeviceLimitModalOpen(true);
            return false;
          }
          setErrorMessage(result.message ?? 'ライセンスの登録に失敗しました。');
          return false;
        }

        setStoredLicenseKey(rawKey);
        setLicenseKey(rawKey);
        applyActive(result.keyHint, result.devices ?? [], result.maxDevices ?? 2);
        setKeyModalOpen(false);
        setDeviceLimitModalOpen(false);
        setPendingKey('');
        return true;
      } catch {
        setErrorMessage(
          'ライセンスサーバーに接続できません。しばらくしてから再度お試しください。',
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [applyActive, deviceId],
  );

  const replaceDeviceAndActivate = useCallback(
    async (targetDeviceId: string) => {
      const key = pendingKey || licenseKey;
      if (!key) return false;
      const ok = await activate(key, targetDeviceId);
      if (ok) {
        completePendingAnalysis(true);
      }
      return ok;
    },
    [activate, completePendingAnalysis, licenseKey, pendingKey],
  );

  const ensureLicensedForAnalysis = useCallback(async () => {
    if (licenseState === 'active') {
      const ok = await verifyStoredLicense();
      if (ok) return true;
    }

    if (licenseState === 'checking') {
      const ok = await verifyStoredLicense();
      if (ok) return true;
    }

    return await new Promise<boolean>((resolve) => {
      setPendingAnalysis({ resolve });
      setKeyModalOpen(true);
    });
  }, [licenseState, verifyStoredLicense]);

  const openLicenseModal = useCallback(() => {
    setErrorMessage(null);
    setKeyModalOpen(true);
  }, []);

  const closeLicenseModal = useCallback(() => {
    setKeyModalOpen(false);
    completePendingAnalysis(false);
  }, [completePendingAnalysis]);

  const closeDeviceLimitModal = useCallback(() => {
    setDeviceLimitModalOpen(false);
    completePendingAnalysis(false);
  }, [completePendingAnalysis]);

  const handleSubmitKey = useCallback(
    async (rawKey: string) => {
      const ok = await activate(rawKey);
      if (ok) {
        completePendingAnalysis(true);
      }
      return ok;
    },
    [activate, completePendingAnalysis],
  );

  const releaseCurrentDevice = useCallback(async () => {
    const stored = getStoredLicenseKey();
    if (!stored) return false;
    setBusy(true);
    try {
      const result = await deactivateLicense({
        key: stored,
        deviceId,
        targetDeviceId: deviceId,
      });
      if (!result.ok) {
        setErrorMessage(result.message ?? 'この端末の解除に失敗しました。');
        return false;
      }
      clearStoredLicenseKey();
      setLicenseKey(null);
      setLicenseState('inactive');
      setKeyHint(null);
      setDevices(result.devices ?? []);
      return true;
    } catch {
      setErrorMessage('ライセンスサーバーに接続できません。');
      return false;
    } finally {
      setBusy(false);
    }
  }, [deviceId]);

  const isAnalysisAllowed = licenseState === 'active';

  return {
    deviceId,
    licenseState,
    licenseKey,
    keyHint,
    devices,
    maxDevices,
    errorMessage,
    busy,
    isAnalysisAllowed,
    keyModalOpen,
    deviceLimitModalOpen,
    pendingKey,
    ensureLicensedForAnalysis,
    openLicenseModal,
    closeLicenseModal,
    closeDeviceLimitModal,
    handleSubmitKey,
    replaceDeviceAndActivate,
    releaseCurrentDevice,
    verifyStoredLicense,
  };
}
