import type {
  SecondLifeQ3ApplySnapshot,
  SecondLifeState,
} from '../types/secondLife';

export type SecondLifeApplyStatus = 'never_applied' | 'dirty' | 'applied';

export function captureSecondLifeQ3ApplySnapshot(
  state: SecondLifeState,
): SecondLifeQ3ApplySnapshot {
  return {
    startAge: state.startAge,
    housingSkip: state.housingSkip,
    housingScenario: state.housingScenario,
    stayOption: state.stayOption,
    hometownOption: state.hometownOption,
    newAreaOption: state.newAreaOption,
    includeMovingCost: state.includeMovingCost,
    includePostPurchaseRenovation: state.includePostPurchaseRenovation,
    nursingByTarget: structuredClone(state.nursingByTarget),
  };
}

export function getSecondLifeApplyStatus(
  state: SecondLifeState,
): SecondLifeApplyStatus {
  if (!state.lastAppliedQ3Snapshot) {
    return 'never_applied';
  }

  const current = captureSecondLifeQ3ApplySnapshot(state);
  if (JSON.stringify(current) !== JSON.stringify(state.lastAppliedQ3Snapshot)) {
    return 'dirty';
  }

  return 'applied';
}

export function markSecondLifeQ3Applied(
  state: SecondLifeState,
): SecondLifeState {
  return {
    ...state,
    lastAppliedQ3Snapshot: captureSecondLifeQ3ApplySnapshot(state),
  };
}
