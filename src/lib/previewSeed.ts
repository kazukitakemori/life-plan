import { setLastOpenedPlanId } from './lastOpenedPlan';
import { getLocalPlanRepository } from './localPlanRepository';
import { parsePlanBackupJson } from './planBackup';
import { isPreviewEnvironment } from './previewEnvironment';

const PREVIEW_SEED_URL = '/preview-data/TOP_base.json.gz';

async function readGzipText(response: Response): Promise<string> {
  if (!response.body) {
    throw new Error('Preview seed response body is empty.');
  }

  const decompressed = response.body.pipeThrough(new DecompressionStream('gzip'));
  return new Response(decompressed).text();
}

/**
 * PR確認版専用の初期データ投入。
 * 既に1件でもプランがある場合は何もせず、ユーザーの編集内容を保持する。
 */
export async function seedPreviewDataIfNeeded(): Promise<void> {
  if (!isPreviewEnvironment()) return;

  try {
    const repository = getLocalPlanRepository();
    const existingPlans = await repository.listAll();
    if (existingPlans.length > 0) return;

    const response = await fetch(PREVIEW_SEED_URL, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Preview seed fetch failed: ${response.status}`);
    }

    const backup = parsePlanBackupJson(await readGzipText(response));
    for (const plan of backup.plans) {
      await repository.save(plan);
    }

    if (backup.plans[0]) {
      setLastOpenedPlanId(backup.plans[0].id);
    }
  } catch (error) {
    // Preview convenience must never prevent the app itself from starting.
    console.warn('Preview seed data could not be loaded.', error);
  }
}
