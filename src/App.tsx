import { useEffect, useMemo, useRef, useState } from 'react';

import { AssetBuildingView } from './components/assetBuilding/AssetBuildingView';
import { RequiredCoverageView } from './components/requiredCoverage/RequiredCoverageView';
import { EducationStep } from './components/education/EducationStep';
import { FamilyStep } from './components/family/FamilyStep';
import { IncomeStep } from './components/income/IncomeStep';
import { LifeEventStep } from './components/lifeEvent/LifeEventStep';
import { LivingStep } from './components/living/LivingStep';
import { HousingStep } from './components/housing/HousingStep';
import { LoanStep } from './components/loan/LoanStep';
import { AppShell } from './components/layout/AppShell';
import { HeaderTabPlaceholder } from './components/layout/HeaderTabPlaceholder';
import { PlaceholderStep } from './components/layout/PlaceholderStep';
import { SecondLifeGuideStep } from './components/secondLife/SecondLifeGuideStep';
import { PensionStep } from './components/pension/PensionStep';
import { VehicleStep } from './components/vehicle/VehicleStep';
import { InsuranceStep } from './components/insurance/InsuranceStep';
import { SavingsStep } from './components/savings/SavingsStep';
import { PlanAdminView } from './components/plan/PlanAdminView';
import { DeviceLimitModal } from './components/license/DeviceLimitModal';
import { LicenseKeyModal } from './components/license/LicenseKeyModal';
import { LicenseStatusPanel } from './components/license/LicenseStatusPanel';
import {
  buildCashFlowTable,
  type CashFlowInput,
} from './lib/cashFlow';
import type { AnalysisSnapshot } from './types/analysis';
import {
  syncEducationWithFamily,
} from './lib/educationDefaults';
import { migrateHousingState } from './lib/housingDefaults';
import {
  addAutoInsuranceForVehicle,
  addFireInsuranceForHousing,
  migrateInsuranceState,
  removeInsuranceEntry,
  syncInsurancesWithFamily,
  updateInsuranceEntry,
} from './lib/insuranceDefaults';
import {
  addOwnedPropertyHousingLoanWithStructure,
  addVehicleLoanForMember,
  removeLoanEntry,
  updateLoanEntry,
} from './lib/loanDefaults';
import {
  applyHousingAndLoanSync,
  removeHousingLoanEntry,
  syncPairLoanFeeInclusionInState,
  syncVehicleLoanAmountsFromPurchase,
  updateJointDebtDeductionShare,
  updatePairLoanShare,
} from './lib/loanResolution';
import {
  syncLifeEventsWithFamily,
} from './lib/lifeEventDefaults';
import { syncAllIncomeWithFamilyDefaults } from './lib/memberDependentDefaults';
import { syncPriorYearIncomeWithFamily } from './lib/priorYearIncomeDefaults';
import {
  syncSavingsWithFamily,
} from './lib/savingsDefaults';
import {
  syncVehiclesWithFamily,
} from './lib/vehicleDefaults';
import {
  createEmptyPlanAppState,
  createPlanRecord,
  fromPlanPayload,
  toPlanPayload,
} from './lib/planDocument';
import {
  buildPlanBackup,
  downloadTextFile,
  formatBackupFilename,
  formatImportResultMessage,
  mergePlanRecords,
  parsePlanBackupJson,
  serializePlanBackup,
} from './lib/planBackup';
import {
  canOpenRequiredCoverageWithoutAnalysis,
  getRequiredCoverageBlockedDescription,
} from './lib/planPurposeInput';
import { getLocalPlanRepository } from './lib/localPlanRepository';
import { getDefaultDeviceLabel } from './lib/license/storage';
import { useLicense } from './lib/license/useLicense';
import {
  getDefaultPlanPurposes,
  getInitialStepForPurposes,
  getInputStepsForPurposes,
  getPlanPurposesLabel,
  getRequiredStepsForPurposes,
  getRequiredCoverageRiskKindsForPurposes,
  hasPlanPurpose,
  isStepInputEnabled,
  limitsRequiredCoverageToSimpleDesign,
  normalizePlanPurposes,
  shouldShowAnalyzeButton,
  showsRequiredStepMarkers,
  tracksAnalysisStale,
  unlocksDeathCoverageWithoutAnalysis,
  unlocksMedicalCoverageWithoutAnalysis,
  unlocksRequiredCoverageWithoutAnalysis,
} from './lib/planPurpose';
import {
  getLastOpenedPlanId,
  setLastOpenedPlanId,
} from './lib/lastOpenedPlan';
import type { AdminTabId } from './types/adminTabs';
import type { AssetBuildingTabId } from './types/assetBuildingTabs';
import type { EducationByMember } from './types/education';
import type { FamilyMember } from './types/family';
import type { HeaderTabId } from './types/headerTabs';
import type { HousingState, OwnedProperty, RentalProperty } from './types/housing';
import type { InsuranceEntry, InsuranceState } from './types/insurance';
import type { LoanEntry, LoanState, LoanStructureType } from './types/loan';
import type { IncomeByMember, PriorYearIncomeByMember } from './types/income';
import type { LifeEventState } from './types/lifeEvent';
import type { LivingExpenseState } from './types/living';
import type { PensionByMember } from './types/pension';
import { migrateRequiredCoverageState } from './lib/requiredCoverage';
import type { RequiredCoveragePageView, RequiredCoverageState } from './types/requiredCoverage';
import { canCreatePlan } from './types/licenseEdition';
import type { PlanAppState, PlanCreateInput, PlanEditInput, PlanPurpose, PlanStatus, PlanSummary } from './types/plan';
import { getDefaultCreateStatus } from './types/plan';
import type { SavingsState } from './types/savings';
import type { StepId } from './types/steps';
import type { SecondLifeState } from './types/secondLife';
import {
  addSecondLifeLivingSchedule,
  addSecondLifeNursingTemplates,
  addSecondLifeRentalToHousing,
  estimateSecondLifeLivingTemplateMonthlyMan,
} from './lib/secondLifeTemplates';
import type { TaxSocialState } from './types/taxSocial';
import type { VehicleEntry, VehicleState } from './types/vehicle';

const planRepository = getLocalPlanRepository();
const INITIAL_PLAN = createEmptyPlanAppState();
const AUTOSAVE_DELAY_MS = 500;

export default function App() {
  const license = useLicense();
  const [headerTab, setHeaderTab] = useState<HeaderTabId>('admin');
  const [adminTab, setAdminTab] = useState<AdminTabId>('plans');
  const [assetBuildingTab, setAssetBuildingTab] =
    useState<AssetBuildingTabId>('simulation');
  const [requiredCoveragePageView, setRequiredCoveragePageView] =
    useState<RequiredCoveragePageView>('simple');
  const [analysisSession, setAnalysisSession] = useState(0);
  const [analysisSnapshot, setAnalysisSnapshot] =
    useState<AnalysisSnapshot | null>(null);
  const [analysisStale, setAnalysisStale] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeStep, setActiveStep] = useState<StepId>('family');

  const [planId, setPlanId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [planPhone, setPlanPhone] = useState('');
  const [planEmail, setPlanEmail] = useState('');
  const [planNote, setPlanNote] = useState('');
  const [planStatus, setPlanStatus] = useState<PlanStatus>(
    getDefaultCreateStatus(),
  );
  const [planPurposes, setPlanPurposes] = useState<PlanPurpose[]>(
    getDefaultPlanPurposes(),
  );
  const [planCreatedAt, setPlanCreatedAt] = useState<string | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [planSummaries, setPlanSummaries] = useState<PlanSummary[]>([]);
  const [planTransferBusy, setPlanTransferBusy] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<
    'idle' | 'pending' | 'saving' | 'saved' | 'error'
  >('idle');

  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(
    () => INITIAL_PLAN.familyMembers,
  );
  const [taxSocialState, setTaxSocialState] = useState<TaxSocialState>(
    () => INITIAL_PLAN.taxSocialState,
  );
  const [incomeByMember, setIncomeByMember] = useState<IncomeByMember>(
    () => INITIAL_PLAN.incomeByMember,
  );
  const [priorYearIncomeByMember, setPriorYearIncomeByMember] =
    useState<PriorYearIncomeByMember>(
      () => INITIAL_PLAN.priorYearIncomeByMember,
    );
  const [educationByMember, setEducationByMember] = useState<EducationByMember>(
    () => INITIAL_PLAN.educationByMember,
  );
  const [lifeEventState, setLifeEventState] = useState<LifeEventState>(
    () => INITIAL_PLAN.lifeEventState,
  );
  const [livingState, setLivingState] = useState<LivingExpenseState>(
    () => INITIAL_PLAN.livingState,
  );
  const [housingState, setHousingState] = useState<HousingState>(
    () => INITIAL_PLAN.housingState,
  );
  const [vehicleState, setVehicleState] = useState<VehicleState>(
    () => INITIAL_PLAN.vehicleState,
  );
  const [loanState, setLoanState] = useState<LoanState>(
    () => INITIAL_PLAN.loanState,
  );
  const [insuranceState, setInsuranceState] = useState<InsuranceState>(() =>
    migrateInsuranceState(INITIAL_PLAN.insuranceState),
  );
  const [savingsState, setSavingsState] = useState<SavingsState>(
    () => INITIAL_PLAN.savingsState,
  );
  const [pensionByMember, setPensionByMember] = useState<PensionByMember>(
    () => INITIAL_PLAN.pensionByMember,
  );
  const [requiredCoverageState, setRequiredCoverageState] =
    useState<RequiredCoverageState>(
      () => INITIAL_PLAN.requiredCoverageState,
    );
  const [secondLifeState, setSecondLifeState] = useState<SecondLifeState>(
    () => INITIAL_PLAN.secondLifeState,
  );
  const [referenceDate, setReferenceDate] = useState<Date>(
    () => INITIAL_PLAN.referenceDate,
  );

  const skipAutosaveRef = useRef(true);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revisionRef = useRef(0);
  const savedRevisionRef = useRef(0);
  const analysisSnapshotRef = useRef<AnalysisSnapshot | null>(null);
  const cashFlowInputRef = useRef<CashFlowInput | null>(null);
  const snapshotRef = useRef({
    planId: null as string | null,
    customerName: '',
    planPhone: '',
    planEmail: '',
    planNote: '',
    planStatus: getDefaultCreateStatus() as PlanStatus,
    planPurposes: getDefaultPlanPurposes() as PlanPurpose[],
    planCreatedAt: null as string | null,
    appState: INITIAL_PLAN as PlanAppState,
  });

  snapshotRef.current = {
    planId,
    customerName,
    planPhone,
    planEmail,
    planNote,
    planStatus,
    planPurposes,
    planCreatedAt,
    appState: {
      familyMembers,
      incomeByMember,
      priorYearIncomeByMember,
      livingState,
      housingState,
      vehicleState,
      loanState,
      insuranceState,
      savingsState,
      educationByMember,
      lifeEventState,
      pensionByMember,
      taxSocialState,
      requiredCoverageState,
      secondLifeState,
      referenceDate,
    },
  };

  const clearAutosaveTimer = () => {
    if (autosaveTimerRef.current != null) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  };

  const flushAutosave = async (options?: { refreshList?: boolean }) => {
    clearAutosaveTimer();
    const snap = snapshotRef.current;
    if (!snap.planId) return;
    const revision = revisionRef.current;
    if (revision === savedRevisionRef.current) {
      setAutosaveStatus((prev) => (prev === 'pending' ? 'saved' : prev));
      return;
    }

    setAutosaveStatus('saving');
    try {
      await planRepository.save(
        createPlanRecord({
          id: snap.planId,
          customerName: snap.customerName,
          phone: snap.planPhone,
          email: snap.planEmail,
          note: snap.planNote,
          status: snap.planStatus,
          purposes: snap.planPurposes,
          payload: toPlanPayload(snap.appState),
          createdAt: snap.planCreatedAt ?? undefined,
        }),
      );
      savedRevisionRef.current = revision;
      setLastOpenedPlanId(snap.planId);
      if (options?.refreshList) {
        await refreshSummaries();
      }
      if (revisionRef.current !== revision) {
        setAutosaveStatus('pending');
        scheduleAutosave();
      } else {
        setAutosaveStatus('saved');
      }
    } catch (err) {
      console.error(err);
      setAutosaveStatus('error');
      window.alert('自動保存に失敗しました。');
    }
  };

  const scheduleAutosave = () => {
    clearAutosaveTimer();
    setAutosaveStatus('pending');
    autosaveTimerRef.current = setTimeout(() => {
      void flushAutosave();
    }, AUTOSAVE_DELAY_MS);
  };

  const markDirty = () => {
    if (skipAutosaveRef.current) return;
    if (!snapshotRef.current.planId) return;
    revisionRef.current += 1;
    scheduleAutosave();
  };

  /** 試算に影響する入力変更。既存の分析結果を「要再分析」にする */
  const markAnalysisInputsChanged = () => {
    if (
      tracksAnalysisStale(snapshotRef.current.planPurposes) &&
      analysisSnapshotRef.current != null
    ) {
      setAnalysisStale(true);
    }
  };

  const markPlanInputsChanged = () => {
    markDirty();
    markAnalysisInputsChanged();
  };

  const clearAnalysisSnapshot = () => {
    analysisSnapshotRef.current = null;
    setAnalysisSnapshot(null);
    setAnalysisStale(false);
    setIsAnalyzing(false);
    setAnalysisSession(0);
  };

  const applyPlanAppState = (
    state: PlanAppState,
    options?: { switchToInput?: boolean; initialStep?: StepId },
  ) => {
    skipAutosaveRef.current = true;
    clearAutosaveTimer();
    setFamilyMembers(state.familyMembers);
    setTaxSocialState(state.taxSocialState);
    setIncomeByMember(state.incomeByMember);
    setPriorYearIncomeByMember(state.priorYearIncomeByMember);
    setEducationByMember(state.educationByMember);
    setLifeEventState(state.lifeEventState);
    setLivingState(state.livingState);
    setHousingState(state.housingState);
    setVehicleState(state.vehicleState);
    setLoanState(state.loanState);
    setInsuranceState(state.insuranceState);
    setSavingsState(state.savingsState);
    setPensionByMember(state.pensionByMember);
    setRequiredCoverageState(state.requiredCoverageState);
    setSecondLifeState(state.secondLifeState);
    setReferenceDate(state.referenceDate);
    if (options?.switchToInput !== false) {
      setHeaderTab('input');
    }
    setActiveStep(options?.initialStep ?? 'family');
    clearAnalysisSnapshot();
    setAssetBuildingTab('simulation');
    revisionRef.current = 0;
    savedRevisionRef.current = 0;
    setAutosaveStatus('saved');
    queueMicrotask(() => {
      skipAutosaveRef.current = false;
    });
  };

  const applyPlanMeta = (meta: {
    id: string;
    customerName: string;
    phone: string;
    email: string;
    note: string;
    purposes: PlanPurpose[];
    status: PlanStatus;
    createdAt: string;
  }) => {
    setPlanId(meta.id);
    setCustomerName(meta.customerName);
    setPlanPhone(meta.phone);
    setPlanEmail(meta.email);
    setPlanNote(meta.note);
    setPlanPurposes(normalizePlanPurposes(meta.purposes));
    setPlanStatus(meta.status);
    setPlanCreatedAt(meta.createdAt);
  };

  const clearPlanSelection = () => {
    clearAutosaveTimer();
    revisionRef.current = 0;
    savedRevisionRef.current = 0;
    setAutosaveStatus('idle');
    setPlanId(null);
    setCustomerName('');
    setPlanPhone('');
    setPlanEmail('');
    setPlanNote('');
    setPlanStatus(getDefaultCreateStatus());
    setPlanPurposes(getDefaultPlanPurposes());
    setPlanCreatedAt(null);
    setLastOpenedPlanId(null);
  };

  const refreshSummaries = async () => {
    const list = await planRepository.listSummaries();
    setPlanSummaries(list);
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await refreshSummaries();
        const lastId = getLastOpenedPlanId();
        if (lastId) {
          const record = await planRepository.get(lastId);
          if (!cancelled && record) {
            applyPlanAppState(fromPlanPayload(record.payload), {
              switchToInput: false,
            });
            applyPlanMeta({
              id: record.id,
              customerName: record.customerName,
              phone: record.phone,
              email: record.email,
              note: record.note,
              purposes: normalizePlanPurposes(record.purposes, record.purpose),
              status: record.status,
              createdAt: record.createdAt,
            });
            setLastOpenedPlanId(record.id);
            setHeaderTab('admin');
            setBootstrapped(true);
            return;
          }
        }
      } catch {
        // fall through to admin
      }
      if (!cancelled) {
        skipAutosaveRef.current = false;
        setHeaderTab('admin');
        setBootstrapped(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // bootstrap once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!bootstrapped || headerTab !== 'admin') return;
    void refreshSummaries().catch((err) => {
      console.error(err);
    });
  }, [bootstrapped, headerTab]);

  useEffect(() => {
    return () => {
      clearAutosaveTimer();
    };
  }, []);

  const cashFlowInput = useMemo<CashFlowInput>(
    () => ({
      familyMembers,
      incomeByMember,
      priorYearIncomeByMember,
      livingState,
      housingState,
      vehicleState,
      loanState,
      insuranceState,
      savingsState,
      educationByMember,
      lifeEventState,
      pensionByMember,
      taxSocialState,
      referenceDate,
    }),
    [
      familyMembers,
      incomeByMember,
      priorYearIncomeByMember,
      livingState,
      housingState,
      vehicleState,
      loanState,
      insuranceState,
      savingsState,
      educationByMember,
      lifeEventState,
      pensionByMember,
      taxSocialState,
      referenceDate,
    ],
  );
  cashFlowInputRef.current = cashFlowInput;
  analysisSnapshotRef.current = analysisSnapshot;

  const inputSteps = useMemo(
    () => getInputStepsForPurposes(planPurposes),
    [planPurposes],
  );
  const requiredInputSteps = useMemo(
    () => getRequiredStepsForPurposes(planPurposes),
    [planPurposes],
  );
  const showRequiredStepMarkers = showsRequiredStepMarkers(planPurposes);
  const purposeInputSnapshot = useMemo(
    () => ({
      familyMembers,
      incomeByMember,
      livingState,
      educationByMember,
    }),
    [familyMembers, incomeByMember, livingState, educationByMember],
  );
  const showAnalyzeButton = shouldShowAnalyzeButton(planPurposes);
  const coverageUnlockedWithoutAnalysis = canOpenRequiredCoverageWithoutAnalysis(
    planPurposes,
    purposeInputSnapshot,
  );
  const requiredCoverageUnlocked =
    analysisSnapshot != null || coverageUnlockedWithoutAnalysis;
  const requiredCoverageBlockedDescription = getRequiredCoverageBlockedDescription(
    planPurposes,
    purposeInputSnapshot,
  );
  const withoutLifePlan =
    !hasPlanPurpose(planPurposes, 'life_plan') &&
    unlocksRequiredCoverageWithoutAnalysis(planPurposes);
  const medicalOnlyCoverage =
    withoutLifePlan &&
    unlocksMedicalCoverageWithoutAnalysis(planPurposes) &&
    !unlocksDeathCoverageWithoutAnalysis(planPurposes);
  const deathOnlyCoverage =
    withoutLifePlan &&
    unlocksDeathCoverageWithoutAnalysis(planPurposes) &&
    !unlocksMedicalCoverageWithoutAnalysis(planPurposes);
  const requiredCoverageRiskKinds = withoutLifePlan
    ? getRequiredCoverageRiskKindsForPurposes(planPurposes)
    : (['death', 'medical'] as const);
  const simpleCoverageDesignOnly =
    limitsRequiredCoverageToSimpleDesign(planPurposes);

  useEffect(() => {
    if (!inputSteps.includes(activeStep)) {
      setActiveStep(getInitialStepForPurposes(planPurposes));
    }
  }, [planPurposes, inputSteps, activeStep]);

  useEffect(() => {
    if (!medicalOnlyCoverage && !deathOnlyCoverage) return;
    setRequiredCoverageState((prev) => {
      const migrated = migrateRequiredCoverageState(prev);
      const nextRisk = medicalOnlyCoverage ? 'medical' : 'death';
      if (migrated.riskKind === nextRisk) return migrated;
      return migrateRequiredCoverageState({ ...migrated, riskKind: nextRisk });
    });
  }, [medicalOnlyCoverage, deathOnlyCoverage]);

  useEffect(() => {
    if (headerTab === 'required-coverage' && !requiredCoverageUnlocked) {
      setHeaderTab('input');
    }
  }, [headerTab, requiredCoverageUnlocked]);

  useEffect(() => {
    if (!simpleCoverageDesignOnly) return;
    setRequiredCoveragePageView((prev) => (prev === 'simple' ? prev : 'simple'));
  }, [simpleCoverageDesignOnly]);

  const handleCreatePlan = async (meta: PlanCreateInput) => {
    if (!canCreatePlan(license.entitlements, planSummaries.length)) {
      window.alert('一般向けライセンスではプランは1件までです。');
      return;
    }
    try {
      await flushAutosave({ refreshList: true });
      const empty = createEmptyPlanAppState();
      const saved = await planRepository.save(
        createPlanRecord({
          customerName: meta.customerName,
          phone: meta.phone,
          email: meta.email,
          note: meta.note,
          purposes: meta.purposes,
          status: getDefaultCreateStatus(),
          payload: toPlanPayload(empty),
        }),
      );
      applyPlanAppState(empty, {
        initialStep: getInitialStepForPurposes(meta.purposes),
      });
      applyPlanMeta({
        id: saved.id,
        customerName: saved.customerName,
        phone: saved.phone,
        email: saved.email,
        note: saved.note,
        purposes: saved.purposes ?? meta.purposes,
        status: saved.status,
        createdAt: saved.createdAt,
      });
      setLastOpenedPlanId(saved.id);
      await refreshSummaries();
      setHeaderTab('input');
    } catch (err) {
      console.error(err);
      window.alert('作成に失敗しました。');
    }
  };

  const handleUpdateMeta = async (id: string, meta: PlanEditInput) => {
    try {
      const existing = await planRepository.get(id);
      if (!existing) {
        window.alert('プランが見つかりません。');
        await refreshSummaries();
        return;
      }
      const saved = await planRepository.save(
        createPlanRecord({
          id: existing.id,
          customerName: meta.customerName,
          phone: meta.phone,
          email: meta.email,
          note: meta.note,
          purposes: meta.purposes,
          status: meta.status,
          payload:
            id === planId
              ? toPlanPayload(snapshotRef.current.appState)
              : existing.payload,
          createdAt: existing.createdAt,
        }),
      );
      if (planId === id) {
        applyPlanMeta({
          id: saved.id,
          customerName: saved.customerName,
          phone: saved.phone,
          email: saved.email,
          note: saved.note,
          purposes: saved.purposes ?? meta.purposes,
          status: saved.status,
          createdAt: saved.createdAt,
        });
        const nextInputSteps = getInputStepsForPurposes(meta.purposes);
        setActiveStep((current) =>
          nextInputSteps.includes(current)
            ? current
            : getInitialStepForPurposes(meta.purposes),
        );
        snapshotRef.current = {
          ...snapshotRef.current,
          customerName: saved.customerName,
          planPhone: saved.phone,
          planEmail: saved.email,
          planNote: saved.note,
          planPurposes: saved.purposes ?? meta.purposes,
          planStatus: saved.status,
        };
        savedRevisionRef.current = revisionRef.current;
      }
      await refreshSummaries();
    } catch (err) {
      console.error(err);
      window.alert('更新に失敗しました。');
    }
  };

  const handleOpenPlan = async (id: string) => {
    if (id === planId) {
      setHeaderTab('input');
      return;
    }
    try {
      await flushAutosave({ refreshList: true });
      const record = await planRepository.get(id);
      if (!record) {
        window.alert('プランが見つかりません。');
        await refreshSummaries();
        return;
      }
      applyPlanAppState(fromPlanPayload(record.payload), {
        initialStep: getInitialStepForPurposes(
          normalizePlanPurposes(record.purposes, record.purpose),
        ),
      });
      applyPlanMeta({
        id: record.id,
        customerName: record.customerName,
        phone: record.phone,
        email: record.email,
        note: record.note,
        purposes: normalizePlanPurposes(record.purposes, record.purpose),
        status: record.status,
        createdAt: record.createdAt,
      });
      setLastOpenedPlanId(record.id);
    } catch (err) {
      console.error(err);
      window.alert('プランの読み込みに失敗しました。');
    }
  };

  const handleDeletePlan = async (id: string) => {
    try {
      if (id === planId) {
        clearAutosaveTimer();
        revisionRef.current = 0;
        savedRevisionRef.current = 0;
      } else {
        await flushAutosave();
      }
      await planRepository.delete(id);
      if (planId === id) {
        applyPlanAppState(createEmptyPlanAppState(), { switchToInput: false });
        clearPlanSelection();
        setHeaderTab('admin');
      }
      await refreshSummaries();
    } catch (err) {
      console.error(err);
      window.alert('削除に失敗しました。');
    }
  };

  const handleExportAllPlans = async () => {
    if (planTransferBusy) return;
    setPlanTransferBusy(true);
    try {
      await flushAutosave({ refreshList: true });
      const plans = await planRepository.listAll();
      if (plans.length === 0) {
        window.alert('書き出すプランがありません。');
        return;
      }
      const backup = buildPlanBackup(plans);
      downloadTextFile(
        formatBackupFilename(),
        serializePlanBackup(backup),
      );
    } catch (err) {
      console.error(err);
      window.alert('書き出しに失敗しました。');
    } finally {
      setPlanTransferBusy(false);
    }
  };

  const handleImportPlansFile = async (file: File) => {
    if (planTransferBusy) return;
    const confirmed = window.confirm(
      [
        `「${file.name}」を読み込みます。`,
        '同じ ID のプランは、更新日時が新しい方を残します。',
        '新しい ID のプランは追加されます。',
        '',
        'よろしいですか？',
      ].join('\n'),
    );
    if (!confirmed) return;

    setPlanTransferBusy(true);
    try {
      await flushAutosave({ refreshList: true });
      const text = await file.text();
      const backup = parsePlanBackupJson(text);
      if (backup.plans.length === 0) {
        window.alert('ファイルにプランが含まれていません。');
        return;
      }
      const existing = await planRepository.listAll();
      if (!license.entitlements.allowMultiPlanAdmin) {
        const incomingNewCount = backup.plans.filter(
          (plan) => !existing.some((item) => item.id === plan.id),
        ).length;
        if (existing.length >= 1 && incomingNewCount > 0) {
          window.alert(
            '一般向けライセンスではプランは1件までです。別プランの追加読み込みはできません。',
          );
          return;
        }
        if (existing.length === 0 && backup.plans.length > 1) {
          window.alert(
            '一般向けライセンスではプランは1件までです。ファイルに複数プランが含まれているため読み込めません。',
          );
          return;
        }
      }
      const { toSave, result } = mergePlanRecords(existing, backup.plans);
      for (const plan of toSave) {
        await planRepository.save(plan);
      }
      await refreshSummaries();
      if (planId) {
        const refreshed = await planRepository.get(planId);
        if (refreshed) {
          applyPlanAppState(fromPlanPayload(refreshed.payload), {
            switchToInput: false,
          });
          applyPlanMeta({
            id: refreshed.id,
            customerName: refreshed.customerName,
            phone: refreshed.phone,
            email: refreshed.email,
            note: refreshed.note,
            purposes: normalizePlanPurposes(
              refreshed.purposes,
              refreshed.purpose,
            ),
            status: refreshed.status,
            createdAt: refreshed.createdAt,
          });
          savedRevisionRef.current = revisionRef.current;
        }
      }
      window.alert(formatImportResultMessage(result));
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : '読み込みに失敗しました。';
      window.alert(message);
    } finally {
      setPlanTransferBusy(false);
    }
  };

  const handleLivingChange = (state: LivingExpenseState) => {
    markPlanInputsChanged();
    setLivingState(state);
  };

  const handleLoanChange = (state: LoanState) => {
    markPlanInputsChanged();
    const { housingState: syncedHousing, loanState: syncedLoans } =
      applyHousingAndLoanSync(housingState, state, vehicleState);
    setLoanState(syncedLoans);
    setHousingState(migrateHousingState(syncedHousing));
  };

  const handleHousingChange = (state: HousingState) => {
    markPlanInputsChanged();
    const migrated = migrateHousingState(state);
    const { housingState: syncedHousing, loanState: syncedLoans } =
      applyHousingAndLoanSync(migrated, loanState, vehicleState);
    setHousingState(syncedHousing);
    setLoanState(syncedLoans);
  };

  const handleVehicleChange = (state: VehicleState) => {
    markPlanInputsChanged();
    setVehicleState(state);
    setLoanState(syncVehicleLoanAmountsFromPurchase(state, loanState));
  };

  const handleAddHousingLoan = (
    targetId: string,
    property: OwnedProperty,
    structureType: LoanStructureType,
    contractorMemberIds: [string] | [string, string],
  ) => {
    handleLoanChange(
      addOwnedPropertyHousingLoanWithStructure(
        loanState,
        structureType,
        contractorMemberIds,
        { targetId, propertyId: property.id },
        property.name,
      ),
    );
  };

  const handleRemoveHousingLoan = (entryId: string) => {
    handleLoanChange(removeHousingLoanEntry(loanState, entryId));
  };

  const handleAddVehicleLoan = (memberId: string, vehicle: VehicleEntry) => {
    handleLoanChange(
      addVehicleLoanForMember(
        loanState,
        memberId,
        vehicle.id,
        vehicle.label,
        vehicle.purchaseAmountMan,
      ),
    );
  };

  const handleRemoveVehicleLoan = (entryId: string) => {
    handleLoanChange(removeLoanEntry(loanState, entryId));
  };

  const handleUpdateLoan = (entry: LoanEntry) => {
    let next = updateLoanEntry(loanState, entry);
    next = syncPairLoanFeeInclusionInState(next, entry);
    handleLoanChange(next);
  };

  const handlePairShareChange = (entry: LoanEntry, sharePct: number) => {
    handleLoanChange(updatePairLoanShare(loanState, entry, sharePct));
  };

  const handleJointDebtShareChange = (entry: LoanEntry, sharePct: number) => {
    handleLoanChange(updateJointDebtDeductionShare(loanState, entry, sharePct));
  };

  const handleLoanPropertyFeeChange = (
    entry: LoanEntry,
    patch: Partial<Pick<OwnedProperty, 'brokerageFeeMan' | 'registrationFeeMan'>>,
  ) => {
    if (!entry.housingLink) return;
    const { targetId, propertyId } = entry.housingLink;
    const data = housingState.byTarget[targetId];
    if (!data) return;
    handleHousingChange({
      ...housingState,
      byTarget: {
        ...housingState.byTarget,
        [targetId]: {
          ...data,
          owned: data.owned.map((property) =>
            property.id === propertyId ? { ...property, ...patch } : property,
          ),
        },
      },
    });
  };

  const handleAddFireInsurance = (
    targetId: string,
    property: OwnedProperty | RentalProperty,
    propertyKind: 'owned' | 'rental',
    contractorMemberId: string,
  ) => {
    const contractor = familyMembers.find((m) => m.id === contractorMemberId);
    if (!contractor) return;
    markPlanInputsChanged();
    setInsuranceState((prev) =>
      addFireInsuranceForHousing(
        prev,
        contractorMemberId,
        contractor,
        referenceDate,
        { targetId, propertyId: property.id, propertyKind },
        property,
      ),
    );
  };

  const handleAddAutoInsurance = (memberId: string, vehicle: VehicleEntry) => {
    const member = familyMembers.find((m) => m.id === memberId);
    if (!member) return;
    markPlanInputsChanged();
    setInsuranceState((prev) =>
      addAutoInsuranceForVehicle(
        prev,
        memberId,
        member,
        referenceDate,
        { memberId, vehicleId: vehicle.id },
        vehicle,
      ),
    );
  };

  const handleRemoveInsurance = (entryId: string) => {
    markPlanInputsChanged();
    setInsuranceState((prev) => removeInsuranceEntry(prev, entryId));
  };

  const handleUpdateInsurance = (entry: InsuranceEntry) => {
    markPlanInputsChanged();
    setInsuranceState((prev) => updateInsuranceEntry(prev, entry));
  };

  const handleAnalyze = () => {
    if (isAnalyzing) return;
    void (async () => {
      const allowed = await license.ensureLicensedForAnalysis();
      if (!allowed) return;

      setIsAnalyzing(true);
      setAssetBuildingTab('simulation');
      setHeaderTab('asset-building');

      window.setTimeout(() => {
        try {
          const currentInput = cashFlowInputRef.current;
          if (!currentInput) {
            throw new Error('cashFlowInput is not ready');
          }
          const frozenInput = structuredClone(currentInput) as CashFlowInput;
          const cashFlowData = buildCashFlowTable(frozenInput);
          const nextSnapshot: AnalysisSnapshot = {
            cashFlowInput: frozenInput,
            cashFlowData,
          };
          analysisSnapshotRef.current = nextSnapshot;
          setAnalysisSnapshot(nextSnapshot);
          setAnalysisStale(false);
          setAnalysisSession((session) => session + 1);

          if (planId && planStatus !== 'simulated') {
            setPlanStatus('simulated');
            snapshotRef.current = {
              ...snapshotRef.current,
              planStatus: 'simulated',
            };
            revisionRef.current += 1;
            void flushAutosave({ refreshList: true });
          }
        } catch (err) {
          console.error(err);
          window.alert('ライフプラン分析に失敗しました。');
          setHeaderTab('input');
        } finally {
          setIsAnalyzing(false);
        }
      }, 50);
    })();
  };

  const handleStepChange = (step: StepId) => {
    if (!isStepInputEnabled(step, planPurposes)) return;
    setActiveStep(step);
  };

  const handleHeaderTabChange = (tab: HeaderTabId) => {
    if (tab === 'admin') {
      void (async () => {
        await flushAutosave({ refreshList: true });
        setHeaderTab('admin');
      })();
      return;
    }
    if (tab === 'input') {
      if (planId == null) {
        setHeaderTab('admin');
        return;
      }
      setHeaderTab('input');
      return;
    }

    const needsLicense =
      tab === 'asset-building' ||
      tab === 'summary' ||
      tab === 'life-plan' ||
      (tab === 'required-coverage' && !coverageUnlockedWithoutAnalysis);

    if (needsLicense) {
      void (async () => {
        const allowed = await license.ensureLicensedForAnalysis();
        if (!allowed) return;
        if (tab === 'required-coverage') {
          if (analysisSnapshot == null && !coverageUnlockedWithoutAnalysis) return;
          if (medicalOnlyCoverage) {
            setRequiredCoverageState((prev) =>
              migrateRequiredCoverageState({ ...prev, riskKind: 'medical' }),
            );
          } else if (deathOnlyCoverage) {
            setRequiredCoverageState((prev) =>
              migrateRequiredCoverageState({ ...prev, riskKind: 'death' }),
            );
          }
          setHeaderTab(tab);
          return;
        }
        if (analysisSnapshot == null && tab !== 'asset-building') return;
        setHeaderTab(tab);
      })();
      return;
    }

    if (tab === 'required-coverage') {
      if (analysisSnapshot == null && !coverageUnlockedWithoutAnalysis) return;
      if (medicalOnlyCoverage) {
        setRequiredCoverageState((prev) =>
          migrateRequiredCoverageState({ ...prev, riskKind: 'medical' }),
        );
      } else if (deathOnlyCoverage) {
        setRequiredCoverageState((prev) =>
          migrateRequiredCoverageState({ ...prev, riskKind: 'death' }),
        );
      }
      setHeaderTab(tab);
      return;
    }
    if (analysisSnapshot == null) return;
    setHeaderTab(tab);
  };

  const analysisBlockedByLicense = !license.isAnalysisAllowed;

  const renderMainContent = () => {
    if (headerTab === 'admin') {
      if (adminTab === 'license') {
        return (
          <LicenseStatusPanel
            licenseState={license.licenseState}
            entitlements={license.entitlements}
            deviceLabel={getDefaultDeviceLabel()}
            errorMessage={license.errorMessage}
            busy={license.busy}
            onManageLicense={license.openLicenseModal}
            onReleaseDevice={() => {
              void license.releaseCurrentDevice();
            }}
          />
        );
      }

      return (
        <PlanAdminView
          summaries={planSummaries}
          currentPlanId={planId}
          transferBusy={planTransferBusy}
          entitlements={license.entitlements}
          onOpen={(id) => {
            void handleOpenPlan(id);
          }}
          onDelete={(id) => {
            void handleDeletePlan(id);
          }}
          onCreate={(meta) => {
            void handleCreatePlan(meta);
          }}
          onUpdateMeta={(id, meta) => {
            void handleUpdateMeta(id, meta);
          }}
          onExportAll={() => {
            void handleExportAllPlans();
          }}
          onImportFile={(file) => {
            void handleImportPlansFile(file);
          }}
        />
      );
    }

    if (headerTab === 'input') {
      if (!isStepInputEnabled(activeStep, planPurposes)) {
        return (
          <HeaderTabPlaceholder
            title="入力対象外の項目"
            description={`現在の試算目的（${getPlanPurposesLabel(planPurposes)}）では、この項目の入力は不要です。サイドバーから入力可能な項目を選んでください。`}
          />
        );
      }

      if (activeStep === 'family') {
        return (
          <FamilyStep
            members={familyMembers}
            referenceDate={referenceDate}
            taxSocialState={taxSocialState}
            onChange={(members) => {
              markPlanInputsChanged();
              setFamilyMembers(members);
              setIncomeByMember((prev) =>
                syncAllIncomeWithFamilyDefaults(members, prev),
              );
              setEducationByMember((prev) =>
                syncEducationWithFamily(members, prev),
              );
              setLifeEventState((prev) =>
                syncLifeEventsWithFamily(members, prev),
              );
              setVehicleState((prev) =>
                syncVehiclesWithFamily(members, prev, referenceDate),
              );
              setInsuranceState((prev) =>
                syncInsurancesWithFamily(members, prev),
              );
              setSavingsState((prev) => syncSavingsWithFamily(members, prev));
              setPriorYearIncomeByMember((prev) =>
                syncPriorYearIncomeWithFamily(members, prev),
              );
            }}
            onTaxSocialChange={(state) => {
              markPlanInputsChanged();
              setTaxSocialState(state);
            }}
          />
        );
      }

      if (activeStep === 'education') {
        return (
          <EducationStep
            members={familyMembers}
            educationByMember={educationByMember}
            incomeByMember={incomeByMember}
            priorYearIncomeByMember={priorYearIncomeByMember}
            taxSocialState={taxSocialState}
            referenceDate={referenceDate}
            purposeNote={
              hasPlanPurpose(planPurposes, 'education') &&
              !hasPlanPurpose(planPurposes, 'life_plan')
                ? '認可保育料は世帯所得の階層で変わります。保育料を実態に近づけたい場合は Q7（収入）も入力してください（任意）。'
                : undefined
            }
            onChange={(state) => {
              markPlanInputsChanged();
              setEducationByMember(state);
            }}
          />
        );
      }

      if (activeStep === 'life-event') {
        return (
          <LifeEventStep
            members={familyMembers}
            lifeEventState={lifeEventState}
            referenceDate={referenceDate}
            secondLifeStartAge={secondLifeState.startAge}
            purposeNote={
              hasPlanPurpose(planPurposes, 'death_coverage') &&
              !hasPlanPurpose(planPurposes, 'life_plan')
                ? '万が一時の必要保障額試算では任意入力です。大きな支出がある場合のみ入力してください。'
                : undefined
            }
            onChange={(state) => {
              markPlanInputsChanged();
              setLifeEventState(state);
            }}
            onAddSecondLifeNursing={() => {
              markPlanInputsChanged();
              setLifeEventState(
                addSecondLifeNursingTemplates({
                  lifeEventState,
                  familyMembers,
                  referenceDate,
                }),
              );
            }}
          />
        );
      }

      if (activeStep === 'living') {
        return (
          <LivingStep
            members={familyMembers}
            livingState={livingState}
            referenceDate={referenceDate}
            secondLifeStartAge={secondLifeState.startAge}
            incomeByMember={incomeByMember}
            pensionByMember={pensionByMember}
            purposeNote={
              hasPlanPurpose(planPurposes, 'death_coverage') &&
              !hasPlanPurpose(planPurposes, 'life_plan')
                ? '万が一時の必要保障額試算では必須入力です。万が一後に残す生活費のベースになります。'
                : undefined
            }
            onChange={handleLivingChange}
            onAddSecondLifeLiving={() => {
              const head = familyMembers.find((member) => member.role === 'head');
              if (!head) return;
              markPlanInputsChanged();
              setLivingState(
                addSecondLifeLivingSchedule({
                  livingState,
                  member: head,
                  referenceDate,
                  startAge: secondLifeState.startAge,
                  monthlyMan: estimateSecondLifeLivingTemplateMonthlyMan({
                    livingState,
                    familyMembers,
                    incomeByMember,
                    pensionByMember,
                    referenceDate,
                    startAge: secondLifeState.startAge,
                  }),
                }),
              );
            }}
          />
        );
      }

      if (activeStep === 'housing') {
        return (
          <HousingStep
            members={familyMembers}
            housingState={housingState}
            loanState={loanState}
            vehicleState={vehicleState}
            insuranceState={insuranceState}
            referenceDate={referenceDate}
            secondLifeStartAge={secondLifeState.startAge}
            purposeNote={
              hasPlanPurpose(planPurposes, 'death_coverage') &&
              !hasPlanPurpose(planPurposes, 'life_plan')
                ? '万が一時の必要保障額試算では任意入力です。住宅ローンや家賃などがある場合に入力すると、保障額に反映されます。'
                : undefined
            }
            onChange={handleHousingChange}
            onAddHousingLoan={handleAddHousingLoan}
            onRemoveHousingLoan={handleRemoveHousingLoan}
            onUpdateLoan={handleUpdateLoan}
            onUpdatePairPartnerLoan={handleUpdateLoan}
            onPairShareChange={handlePairShareChange}
            onJointDebtShareChange={handleJointDebtShareChange}
            onLoanPropertyFeeChange={handleLoanPropertyFeeChange}
            onAddFireInsurance={handleAddFireInsurance}
            onUpdateInsurance={handleUpdateInsurance}
            onRemoveInsurance={handleRemoveInsurance}
            onAddSecondLifeRental={() => {
              const head = familyMembers.find((member) => member.role === 'head');
              if (!head) return;
              markPlanInputsChanged();
              setHousingState(
                addSecondLifeRentalToHousing({
                  housingState,
                  member: head,
                  referenceDate,
                  startAge: secondLifeState.startAge,
                }),
              );
            }}
          />
        );
      }

      if (activeStep === 'vehicle') {
        return (
          <VehicleStep
            members={familyMembers}
            vehicleState={vehicleState}
            loanState={loanState}
            housingState={housingState}
            insuranceState={insuranceState}
            referenceDate={referenceDate}
            purposeNote={
              hasPlanPurpose(planPurposes, 'death_coverage') &&
              !hasPlanPurpose(planPurposes, 'life_plan')
                ? '万が一時の必要保障額試算では任意入力です。ローンや維持費がある場合に入力すると、保障額に反映されます。'
                : undefined
            }
            onChange={handleVehicleChange}
            onAddVehicleLoan={handleAddVehicleLoan}
            onRemoveVehicleLoan={handleRemoveVehicleLoan}
            onUpdateLoan={handleUpdateLoan}
            onAddAutoInsurance={handleAddAutoInsurance}
            onUpdateInsurance={handleUpdateInsurance}
            onRemoveInsurance={handleRemoveInsurance}
          />
        );
      }

      if (activeStep === 'loan') {
        return (
          <LoanStep
            members={familyMembers}
            housingState={housingState}
            vehicleState={vehicleState}
            loanState={loanState}
            referenceDate={referenceDate}
            onChange={handleLoanChange}
            onHousingChange={handleHousingChange}
          />
        );
      }

      if (activeStep === 'insurance') {
        return (
          <InsuranceStep
            members={familyMembers}
            housingState={housingState}
            vehicleState={vehicleState}
            insuranceState={insuranceState}
            referenceDate={referenceDate}
            onChange={(state) => {
              markPlanInputsChanged();
              setInsuranceState(state);
            }}
          />
        );
      }

      if (activeStep === 'savings') {
        return (
          <SavingsStep
            members={familyMembers}
            savingsState={savingsState}
            incomeByMember={incomeByMember}
            referenceDate={referenceDate}
            onChange={(state) => {
              markPlanInputsChanged();
              setSavingsState(state);
            }}
          />
        );
      }

      if (activeStep === 'income') {
        return (
          <IncomeStep
            members={familyMembers}
            incomeByMember={incomeByMember}
            priorYearIncomeByMember={priorYearIncomeByMember}
            referenceDate={referenceDate}
            purposeNote={(() => {
              if (hasPlanPurpose(planPurposes, 'life_plan')) return undefined;
              const notes: string[] = [];
              if (hasPlanPurpose(planPurposes, 'education')) {
                notes.push(
                  '教育費試算では、認可保育園の保育料（所得階層）の推計に使います。',
                );
              }
              if (hasPlanPurpose(planPurposes, 'pension')) {
                notes.push(
                  '年金試算では、ねんきん定期便を使わない場合の加入実績・年金額の推計に使います。',
                );
              }
              if (hasPlanPurpose(planPurposes, 'death_coverage')) {
                notes.push(
                  '万が一時の必要保障額試算では必須入力です。万が一後の就労収入・遺族年金の推計に使います。',
                );
              }
              return notes.length > 0 ? notes.join(' ') : undefined;
            })()}
            onChange={(state) => {
              markPlanInputsChanged();
              setIncomeByMember(state);
            }}
            onPriorYearIncomeChange={(state) => {
              markPlanInputsChanged();
              setPriorYearIncomeByMember(state);
            }}
          />
        );
      }

      if (activeStep === 'pension') {
        return (
          <PensionStep
            members={familyMembers}
            pensionByMember={pensionByMember}
            incomeByMember={incomeByMember}
            referenceDate={referenceDate}
            purposeNote={
              hasPlanPurpose(planPurposes, 'pension') &&
              !hasPlanPurpose(planPurposes, 'life_plan')
                ? 'この画面下部の「試算結果」に、入力内容に基づく老齢年金の見込みを表示します。定期便を使わない場合は Q7（収入）の入力が推計の前提になります。'
                : undefined
            }
            onChange={(state) => {
              markPlanInputsChanged();
              setPensionByMember(state);
            }}
          />
        );
      }

      if (activeStep === 'other') {
        return (
          <SecondLifeGuideStep
            members={familyMembers}
            housingState={housingState}
            livingState={livingState}
            lifeEventState={lifeEventState}
            referenceDate={referenceDate}
            secondLifeState={secondLifeState}
            onSecondLifeChange={(state) => {
              markPlanInputsChanged();
              setSecondLifeState(state);
            }}
            onNavigateToStep={setActiveStep}
          />
        );
      }

      return <PlaceholderStep stepId={activeStep} />;
    }

    if (headerTab === 'asset-building') {
      if (analysisBlockedByLicense) {
        return (
          <HeaderTabPlaceholder
            title="資産形成"
            description="ライフプラン分析を行うには、管理タブのライセンスからキーを登録してください。"
          />
        );
      }

      if (isAnalyzing) {
        return (
          <div className="analysis-loading-panel" role="status" aria-live="polite">
            <p className="analysis-loading-panel-title">ライフプラン分析中</p>
            <p className="analysis-loading-panel-desc">
              キャッシュフローを計算しています。完了まで少々お待ちください。
            </p>
          </div>
        );
      }

      if (analysisSnapshot == null) {
        return (
          <HeaderTabPlaceholder
            title="資産形成"
            description="入力タブで内容を入力し、サイドバーの「ライフプラン分析」を実行すると、キャッシュフロー表が表示されます。"
          />
        );
      }

      return (
        <AssetBuildingView
          key={analysisSession}
          analysisSession={analysisSession}
          activeTab={assetBuildingTab}
          data={analysisSnapshot.cashFlowData}
          familyMembers={analysisSnapshot.cashFlowInput.familyMembers}
          incomeByMember={analysisSnapshot.cashFlowInput.incomeByMember}
          priorYearIncomeByMember={
            analysisSnapshot.cashFlowInput.priorYearIncomeByMember ?? {}
          }
          livingState={analysisSnapshot.cashFlowInput.livingState}
          educationByMember={analysisSnapshot.cashFlowInput.educationByMember}
          lifeEventState={analysisSnapshot.cashFlowInput.lifeEventState}
          pensionByMember={analysisSnapshot.cashFlowInput.pensionByMember}
          referenceDate={analysisSnapshot.cashFlowInput.referenceDate}
        />
      );
    }

    if (headerTab === 'summary') {
      return <HeaderTabPlaceholder title="サマリー" />;
    }

    if (headerTab === 'life-plan') {
      return <HeaderTabPlaceholder title="ライフプラン" />;
    }

    if (isAnalyzing) {
      return (
        <div className="analysis-loading-panel" role="status" aria-live="polite">
          <p className="analysis-loading-panel-title">ライフプラン分析中</p>
          <p className="analysis-loading-panel-desc">
            キャッシュフローを計算しています。完了まで少々お待ちください。
          </p>
        </div>
      );
    }

    if (analysisSnapshot == null && !coverageUnlockedWithoutAnalysis) {
      return (
        <HeaderTabPlaceholder
          title="必要保障額"
          description={requiredCoverageBlockedDescription}
        />
      );
    }

    if (analysisBlockedByLicense && analysisSnapshot != null) {
      return (
        <HeaderTabPlaceholder
          title="必要保障額"
          description="ライフプラン分析結果の表示には、有効なライセンスキーが必要です。"
        />
      );
    }

    const coverageInput = analysisSnapshot?.cashFlowInput ?? cashFlowInput;
    const coverageData = analysisSnapshot?.cashFlowData;

    return (
      <RequiredCoverageView
        cashFlowInput={coverageInput}
        cashFlowData={coverageData}
        state={migrateRequiredCoverageState(requiredCoverageState)}
        pageView={
          simpleCoverageDesignOnly
            ? 'simple'
            : requiredCoveragePageView
        }
        simpleDesignOnly={simpleCoverageDesignOnly}
        onChange={(next) => {
          markDirty();
          const migrated = migrateRequiredCoverageState(next);
          if (medicalOnlyCoverage) {
            setRequiredCoverageState(
              migrateRequiredCoverageState({
                ...migrated,
                riskKind: 'medical',
              }),
            );
            return;
          }
          if (deathOnlyCoverage) {
            setRequiredCoverageState(
              migrateRequiredCoverageState({
                ...migrated,
                riskKind: 'death',
              }),
            );
            return;
          }
          setRequiredCoverageState(migrated);
        }}
        onPageViewChange={(view) => {
          if (simpleCoverageDesignOnly) {
            setRequiredCoveragePageView('simple');
            return;
          }
          setRequiredCoveragePageView(view);
        }}
      />
    );
  };

  if (!bootstrapped) {
    return (
      <div className="shell">
        <div className="shell-main" style={{ padding: 24 }}>
          読み込み中…
        </div>
      </div>
    );
  }

  return (
    <>
      <AppShell
      activeStep={activeStep}
      enabledSteps={inputSteps}
      requiredSteps={requiredInputSteps}
      showRequiredStepMarkers={showRequiredStepMarkers}
      onStepChange={handleStepChange}
      onAnalyze={handleAnalyze}
      analyzeDisabled={isAnalyzing}
      showAnalyze={showAnalyzeButton}
      showAnalysisStaleBanner={tracksAnalysisStale(planPurposes)}
      activeHeaderTab={headerTab}
      onHeaderTabChange={handleHeaderTabChange}
      analysisUnlocked={analysisSnapshot != null}
      requiredCoverageUnlocked={requiredCoverageUnlocked}
      showRequiredCoverageReadyBanner={
        headerTab === 'input' && coverageUnlockedWithoutAnalysis
      }
      requiredCoverageRiskKinds={[...requiredCoverageRiskKinds]}
      analysisStale={analysisStale}
      isAnalyzing={isAnalyzing}
      hasOpenPlan={planId != null}
      customerName={customerName}
      planStatus={planStatus}
      autosaveStatus={autosaveStatus}
      showHonorific={license.entitlements.showHonorific}
      adminTab={adminTab}
      onAdminTabChange={setAdminTab}
      assetBuildingTab={assetBuildingTab}
      onAssetBuildingTabChange={setAssetBuildingTab}
      requiredCoverageRiskKind={
        migrateRequiredCoverageState(requiredCoverageState).riskKind ===
        'medical'
          ? 'medical'
          : 'death'
      }
      onRequiredCoverageRiskKindChange={(riskKind) => {
        markDirty();
        setRequiredCoverageState((prev) =>
          migrateRequiredCoverageState({ ...prev, riskKind }),
        );
      }}
    >
      {renderMainContent()}
    </AppShell>
      <LicenseKeyModal
        open={license.keyModalOpen}
        busy={license.busy}
        errorMessage={license.errorMessage}
        onClose={license.closeLicenseModal}
        onSubmit={license.handleSubmitKey}
      />
      <DeviceLimitModal
        open={license.deviceLimitModalOpen}
        busy={license.busy}
        devices={license.devices}
        currentDeviceId={license.deviceId}
        maxDevices={license.maxDevices}
        errorMessage={license.errorMessage}
        onClose={license.closeDeviceLimitModal}
        onReplace={license.replaceDeviceAndActivate}
      />
    </>
  );
}
