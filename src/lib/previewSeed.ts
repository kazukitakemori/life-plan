import {
  getContentCapturePlanId,
  parseContentCaptureRequest,
} from './contentCaptureRuntime';
import { toContentModelPlanRecord, type ContentModelCase } from './contentModelCase';
import { setLastOpenedPlanId } from './lastOpenedPlan';
import { getLocalPlanRepository } from './localPlanRepository';
import { parsePlanBackupJson } from './planBackup';
import { isPreviewEnvironment } from './previewEnvironment';

const PREVIEW_SEED_URL = '/preview-data/TOP_base.json.gz';

type PreviewCaptureFixture = Omit<ContentModelCase, 'payload'>;

const PREVIEW_CAPTURE_FIXTURES: Record<string, PreviewCaptureFixture> = {
  'SIM-001-BASE': {
    version: 1,
    articleId: 'SIM-001',
    modelCaseId: 'SIM-001-BASE',
    title: '架空の検証モデル',
    editorialPurpose: '記事制作向けCapture Specの自動撮影検証',
    assumptions: [
      'Google Drive正本のTOP_baseと同じ架空検証データをPR Previewで撮影再現する',
    ],
    captureSpecs: [
      {
        id: 'SIM-001-CF',
        view: 'cash-flow-table',
        displayState: { startAge: 35, displayRange: '10' },
        captureRegion: 'cash-flow-table',
        viewport: { width: 1440, height: 1000 },
        operatorMode: { hidePersonalInfo: true },
        purpose: 'キャッシュフロー表の自動撮影E2E検証',
      },
    ],
  },
};

async function readGzipText(response: Response): Promise<string> {
  if (!response.body) {
    throw new Error('Preview seed response body is empty.');
  }

  const decompressed = response.body.pipeThrough(new DecompressionStream('gzip'));
  return new Response(decompressed).text();
}

/**
 * PR確認版専用の初期データ投入。
 * 通常のTOP_base seedは既存プランがある場合に上書きしない。
 * Capture Spec URLで起動した場合のみ、同じ架空データから撮影専用の
 * content-model fixtureを1件だけ追加する。既存fixtureは再保存しない。
 */
export async function seedPreviewDataIfNeeded(): Promise<void> {
  if (!isPreviewEnvironment()) return;

  try {
    const repository = getLocalPlanRepository();
    const existingPlans = await repository.listAll();
    const captureRequest =
      typeof window === 'undefined'
        ? null
        : parseContentCaptureRequest(window.location.search);
    const captureFixture = captureRequest
      ? PREVIEW_CAPTURE_FIXTURES[captureRequest.modelCaseId]
      : undefined;
    const capturePlanId = captureRequest
      ? getContentCapturePlanId(captureRequest)
      : null;
    const existingCapturePlan = capturePlanId
      ? await repository.get(capturePlanId)
      : null;
    const shouldSeedStandardPlans = existingPlans.length === 0;
    const shouldSeedCaptureFixture = Boolean(captureFixture && !existingCapturePlan);

    if (!shouldSeedStandardPlans && !shouldSeedCaptureFixture) return;

    const response = await fetch(PREVIEW_SEED_URL, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Preview seed fetch failed: ${response.status}`);
    }

    const backup = parsePlanBackupJson(await readGzipText(response));
    if (shouldSeedStandardPlans) {
      for (const plan of backup.plans) {
        await repository.save(plan);
      }
    }

    if (shouldSeedCaptureFixture && captureFixture) {
      const basePlan = backup.plans[0];
      if (!basePlan) {
        throw new Error('Preview capture fixture requires at least one TOP_base plan.');
      }
      const capturePlan = toContentModelPlanRecord({
        ...captureFixture,
        payload: structuredClone(basePlan.payload),
      });
      await repository.save(capturePlan);
      setLastOpenedPlanId(capturePlan.id);
      return;
    }

    if (shouldSeedStandardPlans && backup.plans[0]) {
      setLastOpenedPlanId(backup.plans[0].id);
    }
  } catch (error) {
    // Preview convenience must never prevent the app itself from starting.
    console.warn('Preview seed data could not be loaded.', error);
  }
}
