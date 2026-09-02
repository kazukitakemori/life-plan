const LAST_OPENED_KEY = 'life-plan:lastOpenedPlanId';

export function getLastOpenedPlanId(): string | null {
  try {
    return localStorage.getItem(LAST_OPENED_KEY);
  } catch {
    return null;
  }
}

export function setLastOpenedPlanId(id: string | null): void {
  try {
    if (id == null) {
      localStorage.removeItem(LAST_OPENED_KEY);
    } else {
      localStorage.setItem(LAST_OPENED_KEY, id);
    }
  } catch {
    // ignore quota / private mode
  }
}
