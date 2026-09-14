from pathlib import Path

path = Path('src/App.tsx')
text = path.read_text()


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected 1 match, found {count}')
    text = text.replace(old, new, 1)


replace_once(
    "const AUTOSAVE_DELAY_MS = 500;\n\nexport default function App() {",
    """const AUTOSAVE_DELAY_MS = 500;
const MAX_UNDO_HISTORY = 50;

interface PlanUndoSnapshot {
  planId: string;
  appState: PlanAppState;
  analysisStale: boolean;
}

export default function App() {""",
    'undo constants',
)

replace_once(
    """  const [autosaveStatus, setAutosaveStatus] = useState<
    'idle' | 'pending' | 'saving' | 'saved' | 'error'
  >('idle');

  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(""",
    """  const [autosaveStatus, setAutosaveStatus] = useState<
    'idle' | 'pending' | 'saving' | 'saved' | 'error'
  >('idle');
  const [undoAvailable, setUndoAvailable] = useState(false);
  const [undoBusy, setUndoBusy] = useState(false);

  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(""",
    'undo state',
)

replace_once(
    """  const analysisSnapshotRef = useRef<AnalysisSnapshot | null>(null);
  const cashFlowInputRef = useRef<CashFlowInput | null>(null);
  const snapshotRef = useRef({""",
    """  const analysisSnapshotRef = useRef<AnalysisSnapshot | null>(null);
  const cashFlowInputRef = useRef<CashFlowInput | null>(null);
  const undoHistoryRef = useRef<PlanUndoSnapshot[]>([]);
  const snapshotRef = useRef({""",
    'undo ref',
)

replace_once(
    """      referenceDate,
    },
  };

  const clearAutosaveTimer = () => {""",
    """      referenceDate,
    },
  };

  const clearUndoHistory = () => {
    undoHistoryRef.current = [];
    setUndoAvailable(false);
  };

  const pushUndoSnapshot = () => {
    const snap = snapshotRef.current;
    if (skipAutosaveRef.current || !snap.planId) return;
    undoHistoryRef.current.push({
      planId: snap.planId,
      appState: structuredClone(snap.appState) as PlanAppState,
      analysisStale,
    });
    if (undoHistoryRef.current.length > MAX_UNDO_HISTORY) {
      undoHistoryRef.current.shift();
    }
    setUndoAvailable(true);
  };

  const clearAutosaveTimer = () => {""",
    'undo helpers',
)

replace_once(
    """  const markPlanInputsChanged = () => {
    markDirty();
    markAnalysisInputsChanged();
  };

  const clearAnalysisSnapshot = () => {""",
    """  const markPlanInputsChanged = () => {
    pushUndoSnapshot();
    markDirty();
    markAnalysisInputsChanged();
  };

  const markPlanDataChanged = () => {
    pushUndoSnapshot();
    markDirty();
  };

  const clearAnalysisSnapshot = () => {""",
    'capture before input change',
)

replace_once(
    """  const applyPlanAppState = (
    state: PlanAppState,
    options?: { switchToInput?: boolean; initialStep?: StepId },
  ) => {
    skipAutosaveRef.current = true;""",
    """  const applyPlanAppState = (
    state: PlanAppState,
    options?: { switchToInput?: boolean; initialStep?: StepId },
  ) => {
    clearUndoHistory();
    skipAutosaveRef.current = true;""",
    'clear history on plan load',
)

replace_once(
    """  const refreshSummaries = async () => {
    const list = await planRepository.listSummaries();
    setPlanSummaries(list);
  };

  useEffect(() => {""",
    """  const refreshSummaries = async () => {
    const list = await planRepository.listSummaries();
    setPlanSummaries(list);
  };

  const handleUndo = async () => {
    if (undoBusy) return;
    const current = snapshotRef.current;
    if (!current.planId) {
      clearUndoHistory();
      return;
    }

    const entry = undoHistoryRef.current.at(-1);
    if (!entry || entry.planId !== current.planId) {
      clearUndoHistory();
      return;
    }

    setUndoBusy(true);
    clearAutosaveTimer();
    undoHistoryRef.current.pop();
    setUndoAvailable(undoHistoryRef.current.length > 0);

    const restored = structuredClone(entry.appState) as PlanAppState;
    try {
      setFamilyMembers(restored.familyMembers);
      setTaxSocialState(restored.taxSocialState);
      setIncomeByMember(restored.incomeByMember);
      setPriorYearIncomeByMember(restored.priorYearIncomeByMember);
      setEducationByMember(restored.educationByMember);
      setLifeEventState(restored.lifeEventState);
      setLivingState(restored.livingState);
      setHousingState(restored.housingState);
      setVehicleState(restored.vehicleState);
      setLoanState(restored.loanState);
      setInsuranceState(restored.insuranceState);
      setSavingsState(restored.savingsState);
      setPensionByMember(restored.pensionByMember);
      setRequiredCoverageState(restored.requiredCoverageState);
      setSecondLifeState(restored.secondLifeState);
      setMemberTabExtras(restored.memberTabExtras);
      setReferenceDate(restored.referenceDate);
      setAnalysisStale(entry.analysisStale);

      snapshotRef.current = {
        ...current,
        appState: restored,
      };
      revisionRef.current += 1;
      const revision = revisionRef.current;
      setAutosaveStatus('saving');

      await planRepository.save(
        createPlanRecord({
          id: current.planId,
          customerName: current.customerName,
          phone: current.planPhone,
          email: current.planEmail,
          note: current.planNote,
          status: current.planStatus,
          purposes: current.planPurposes,
          payload: toPlanPayload(restored),
          createdAt: current.planCreatedAt ?? undefined,
        }),
      );
      savedRevisionRef.current = revision;
      setLastOpenedPlanId(current.planId);

      if (revisionRef.current !== revision) {
        setAutosaveStatus('pending');
        scheduleAutosave();
      } else {
        setAutosaveStatus('saved');
      }
    } catch (err) {
      console.error(err);
      undoHistoryRef.current.push(entry);
      setUndoAvailable(true);
      setAutosaveStatus('error');
      window.alert('操作を元に戻した内容の保存に失敗しました。');
    } finally {
      setUndoBusy(false);
    }
  };

  useEffect(() => {""",
    'undo handler',
)

replace_once(
    """        onChange={(next) => {
          markDirty();""",
    """        onChange={(next) => {
          markPlanDataChanged();""",
    'required coverage undo capture',
)

replace_once(
    """      onRequiredCoverageRiskKindChange={(riskKind) => {
        markDirty();""",
    """      onRequiredCoverageRiskKindChange={(riskKind) => {
        markPlanDataChanged();""",
    'risk kind undo capture',
)

replace_once(
    """      autosaveStatus={autosaveStatus}
      showHonorific={license.entitlements.showHonorific}""",
    """      autosaveStatus={autosaveStatus}
      undoAvailable={undoAvailable}
      undoBusy={undoBusy}
      onUndo={handleUndo}
      showHonorific={license.entitlements.showHonorific}""",
    'AppShell undo props',
)

path.write_text(text)
