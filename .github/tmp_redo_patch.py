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
    """  const [undoAvailable, setUndoAvailable] = useState(false);
  const [undoBusy, setUndoBusy] = useState(false);""",
    """  const [undoAvailable, setUndoAvailable] = useState(false);
  const [redoAvailable, setRedoAvailable] = useState(false);
  const [undoBusy, setUndoBusy] = useState(false);""",
    'redo state',
)

replace_once(
    """  const undoHistoryRef = useRef<PlanUndoSnapshot[]>([]);
  const snapshotRef = useRef({""",
    """  const undoHistoryRef = useRef<PlanUndoSnapshot[]>([]);
  const redoHistoryRef = useRef<PlanUndoSnapshot[]>([]);
  const snapshotRef = useRef({""",
    'redo history ref',
)

replace_once(
    """  const clearUndoHistory = () => {
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
  };""",
    """  const clearUndoHistory = () => {
    undoHistoryRef.current = [];
    redoHistoryRef.current = [];
    setUndoAvailable(false);
    setRedoAvailable(false);
  };

  const getCurrentHistorySnapshot = (): PlanUndoSnapshot | null => {
    const snap = snapshotRef.current;
    if (!snap.planId) return null;
    return {
      planId: snap.planId,
      appState: structuredClone(snap.appState) as PlanAppState,
      analysisStale,
    };
  };

  const pushUndoSnapshot = () => {
    if (skipAutosaveRef.current) return;
    const entry = getCurrentHistorySnapshot();
    if (!entry) return;
    undoHistoryRef.current.push(entry);
    if (undoHistoryRef.current.length > MAX_UNDO_HISTORY) {
      undoHistoryRef.current.shift();
    }
    redoHistoryRef.current = [];
    setUndoAvailable(true);
    setRedoAvailable(false);
  };""",
    'history helpers',
)

old_handler = """  const handleUndo = async () => {
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
  };"""

new_handler = """  const restoreHistorySnapshot = async (entry: PlanUndoSnapshot) => {
    const current = snapshotRef.current;
    if (!current.planId || current.planId !== entry.planId) {
      throw new Error('History snapshot does not match the current plan.');
    }

    const restored = structuredClone(entry.appState) as PlanAppState;
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
  };

  const handleUndo = async () => {
    if (undoBusy) return;
    const currentEntry = getCurrentHistorySnapshot();
    const entry = undoHistoryRef.current.at(-1);
    if (!currentEntry || !entry || entry.planId !== currentEntry.planId) {
      clearUndoHistory();
      return;
    }

    setUndoBusy(true);
    clearAutosaveTimer();
    undoHistoryRef.current.pop();
    redoHistoryRef.current.push(currentEntry);
    if (redoHistoryRef.current.length > MAX_UNDO_HISTORY) {
      redoHistoryRef.current.shift();
    }
    setUndoAvailable(undoHistoryRef.current.length > 0);
    setRedoAvailable(true);

    try {
      await restoreHistorySnapshot(entry);
    } catch (err) {
      console.error(err);
      redoHistoryRef.current.pop();
      undoHistoryRef.current.push(entry);
      setUndoAvailable(true);
      setRedoAvailable(redoHistoryRef.current.length > 0);
      setAutosaveStatus('error');
      window.alert('操作を元に戻した内容の保存に失敗しました。');
    } finally {
      setUndoBusy(false);
    }
  };

  const handleRedo = async () => {
    if (undoBusy) return;
    const currentEntry = getCurrentHistorySnapshot();
    const entry = redoHistoryRef.current.at(-1);
    if (!currentEntry || !entry || entry.planId !== currentEntry.planId) {
      redoHistoryRef.current = [];
      setRedoAvailable(false);
      return;
    }

    setUndoBusy(true);
    clearAutosaveTimer();
    redoHistoryRef.current.pop();
    undoHistoryRef.current.push(currentEntry);
    if (undoHistoryRef.current.length > MAX_UNDO_HISTORY) {
      undoHistoryRef.current.shift();
    }
    setUndoAvailable(true);
    setRedoAvailable(redoHistoryRef.current.length > 0);

    try {
      await restoreHistorySnapshot(entry);
    } catch (err) {
      console.error(err);
      undoHistoryRef.current.pop();
      redoHistoryRef.current.push(entry);
      setUndoAvailable(undoHistoryRef.current.length > 0);
      setRedoAvailable(true);
      setAutosaveStatus('error');
      window.alert('操作をやり直した内容の保存に失敗しました。');
    } finally {
      setUndoBusy(false);
    }
  };"""

replace_once(old_handler, new_handler, 'undo/redo handlers')

replace_once(
    """      undoAvailable={undoAvailable}
      undoBusy={undoBusy}
      onUndo={handleUndo}""",
    """      undoAvailable={undoAvailable}
      redoAvailable={redoAvailable}
      undoBusy={undoBusy}
      onUndo={handleUndo}
      onRedo={handleRedo}""",
    'AppShell redo props',
)

path.write_text(text)
