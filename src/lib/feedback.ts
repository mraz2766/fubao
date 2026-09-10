// Small, tab-scoped presentation state. Never stores record contents or auth data.
const receiptKey = 'fubao.save-feedback';
export type SaveKind = 'workout' | 'travel';

export function queueSaveFeedback(kind: SaveKind, id: string) {
  try {
    sessionStorage.setItem(
      receiptKey,
      JSON.stringify({
        kind,
        path: `/${kind === 'workout' ? 'fitness' : 'travel'}/${id}`,
        at: Date.now(),
      }),
    );
  } catch {
    /* Saving a record must not depend on browser storage. */
  }
}

export function consumeSaveFeedback(path: string): SaveKind | null {
  try {
    const raw = sessionStorage.getItem(receiptKey);
    sessionStorage.removeItem(receiptKey);
    if (!raw) return null;
    const receipt = JSON.parse(raw);
    if (receipt.path !== path || Date.now() - receipt.at > 15000 || Date.now() < receipt.at)
      return null;
    return receipt.kind === 'workout' || receipt.kind === 'travel' ? receipt.kind : null;
  } catch {
    return null;
  }
}

export function claimGoalFeedback(scope: string, week: string): boolean {
  try {
    const key = `fubao.goal-feedback:${scope}`;
    if (sessionStorage.getItem(key) === week) return false;
    sessionStorage.setItem(key, week);
    return true;
  } catch {
    return false;
  }
}
