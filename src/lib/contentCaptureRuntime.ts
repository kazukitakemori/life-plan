import type { PlanRecord } from '../types/plan';
import {
  getContentModelPlanId,
  type ContentModelCaptureSpec,
} from './contentModelCase';

const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export interface ContentCaptureRequest {
  modelCaseId: string;
  captureSpecId: string;
}

export interface ContentCaptureRoute {
  headerTab: 'asset-building' | 'required-coverage';
  assetBuildingTab?: 'simulation' | 'savings-assets' | 'cashflow';
}

export interface ContentCaptureDisplayState {
  startAge?: number;
  displayRange?: 'all' | '10' | '20';
  riskKind?: 'death' | 'medical';
  pageView?: 'simple' | 'detail';
}

interface StoredContentModelDefinition {
  modelCaseId: string;
  captureSpecs: ContentModelCaptureSpec[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function cleanId(value: string | null): string | null {
  const cleaned = value?.trim() ?? '';
  return STABLE_ID.test(cleaned) ? cleaned : null;
}

export function parseContentCaptureRequest(search: string): ContentCaptureRequest | null {
  const params = new URLSearchParams(search);
  const modelCaseId = cleanId(params.get('modelCaseId'));
  const captureSpecId = cleanId(params.get('captureSpecId'));
  if (!modelCaseId || !captureSpecId) return null;
  return { modelCaseId, captureSpecId };
}

export function getContentCapturePlanId(request: ContentCaptureRequest): string {
  return getContentModelPlanId(request.modelCaseId);
}

export function readStoredContentModelDefinition(
  record: Pick<PlanRecord, 'id' | 'note'>,
): StoredContentModelDefinition | null {
  if (!record.id.startsWith('content-model:')) return null;
  const line = record.note.split('\n').find((value) => value.startsWith('definition='));
  if (!line) return null;
  try {
    const parsed = JSON.parse(line.slice('definition='.length)) as unknown;
    if (!isObject(parsed)) return null;
    if (!cleanId(typeof parsed.modelCaseId === 'string' ? parsed.modelCaseId : null)) return null;
    if (!Array.isArray(parsed.captureSpecs)) return null;
    return parsed as unknown as StoredContentModelDefinition;
  } catch {
    return null;
  }
}

export function getContentCaptureSpec(
  record: Pick<PlanRecord, 'id' | 'note'>,
  request: ContentCaptureRequest,
): ContentModelCaptureSpec | null {
  if (record.id !== getContentCapturePlanId(request)) return null;
  const definition = readStoredContentModelDefinition(record);
  if (!definition || definition.modelCaseId !== request.modelCaseId) return null;
  return definition.captureSpecs.find((spec) => spec?.id?.trim() === request.captureSpecId) ?? null;
}

export function resolveContentCaptureRoute(spec: ContentModelCaptureSpec): ContentCaptureRoute {
  switch (spec.view) {
    case 'cash-flow-table':
      return { headerTab: 'asset-building', assetBuildingTab: 'cashflow' };
    case 'asset-balance-chart':
      return { headerTab: 'asset-building', assetBuildingTab: 'savings-assets' };
    case 'lifetime-balance':
      return { headerTab: 'asset-building', assetBuildingTab: 'simulation' };
    case 'required-coverage':
      return { headerTab: 'required-coverage' };
  }
}

export function resolveContentCaptureDisplayState(
  spec: ContentModelCaptureSpec | null,
): ContentCaptureDisplayState {
  const state = spec?.displayState;
  if (!state) return {};
  const startAge =
    typeof state.startAge === 'number' && Number.isFinite(state.startAge) && state.startAge >= 0
      ? state.startAge
      : undefined;
  const displayRange =
    state.displayRange === 'all' || state.displayRange === '10' || state.displayRange === '20'
      ? state.displayRange
      : undefined;
  const riskKind =
    state.riskKind === 'death' || state.riskKind === 'medical' ? state.riskKind : undefined;
  const pageView =
    state.pageView === 'simple' || state.pageView === 'detail' ? state.pageView : undefined;
  return { startAge, displayRange, riskKind, pageView };
}

export function resolveContentCaptureRegion(spec: ContentModelCaptureSpec): string {
  return spec.captureRegion?.trim() || spec.view;
}

export function isContentCaptureViewportMatch(
  spec: ContentModelCaptureSpec,
  width: number,
  height: number,
): boolean {
  if (!spec.viewport) return true;
  return width === spec.viewport.width && height === spec.viewport.height;
}
