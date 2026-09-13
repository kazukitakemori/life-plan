/**
 * セカンドライフ住まい反映の説明文言。
 *
 * - 具体的な副作用は apply 結果の `changes` から生成する
 * - シナリオ概要は設計画面の事前説明・確認ダイアログ用
 *
 * `getSecondLifeApplyStatus` / `.second-life-apply-status*` は
 * 「設計が反映済みか／汚れているか」用で、本モジュールの変更差分とは別軸。
 */
import type { SecondLifeState } from '../types/secondLife';
import type {
  SecondLifeHousingApplyChange,
  SecondLifeHousingPropertyKind,
} from '../types/secondLifeHousingApply';
import {
  getSecondLifeHousingTemplateKind,
  type SecondLifeHousingTemplateKind,
} from './secondLifeLabels';

function formatAgeMonth(age: number, month: number): string {
  return `${age}歳${month}月`;
}

function propertyKindLabel(propertyKind: SecondLifeHousingPropertyKind): string {
  return propertyKind === 'rental' ? '賃貸' : '所有物件';
}

/** 反映結果の変更一覧を、画面表示向けの日本語行に変換する */
export function formatSecondLifeHousingApplyChangeLines(
  changes: SecondLifeHousingApplyChange[],
): string[] {
  return formatApplyChangeLines(changes, 'past');
}

/** 反映前プレビュー用（「〜します」） */
export function formatSecondLifeHousingApplyPreviewLines(
  changes: SecondLifeHousingApplyChange[],
): string[] {
  return formatApplyChangeLines(changes, 'future');
}

function formatApplyChangeLines(
  changes: SecondLifeHousingApplyChange[],
  tense: 'past' | 'future',
): string[] {
  const done = tense === 'past' ? 'しました' : 'します';
  if (changes.length === 0) {
    return ['住まい入力への変更はありません'];
  }

  return changes.map((change) => {
    switch (change.type) {
      case 'cleared':
        return `前回の「${change.name}」（${propertyKindLabel(change.propertyKind)}）を削除${done}`;
      case 'ended':
        return `「${change.name}」（${propertyKindLabel(change.propertyKind)}）を${formatAgeMonth(change.endAge, change.endMonth)}で終了${done}`;
      case 'added':
        if (change.propertyKind === 'rental') {
          const rent =
            change.monthlyRentMan != null
              ? `（家賃${change.monthlyRentMan}万円）`
              : '';
          return `「${change.name}」を追加${done}${rent}`;
        }
        {
          const amounts =
            change.buildingMan != null || change.landMan != null
              ? `（建物${change.buildingMan ?? 0}万・土地${change.landMan ?? 0}万）`
              : '';
          return `「${change.name}」を追加${done}${amounts}`;
        }
      case 'improvement':
        return `「${change.propertyName}」の住まい一時費用${change.amountMan}万円を${change.year}年${change.month}月に追加${done}`;
      case 'life_event':
        return `ライフイベント「${change.label}」に${change.amountMan}万円を反映${done}（${change.startAge}歳）`;
      default: {
        const _exhaustive: never = change;
        return _exhaustive;
      }
    }
  });
}

function isRelocatingHousing(
  state: Pick<SecondLifeState, 'housingSkip' | 'housingScenario'>,
): boolean {
  return (
    !state.housingSkip &&
    (state.housingScenario === 'hometown' ||
      state.housingScenario === 'new_area')
  );
}

/**
 * 具体物件を見ないシナリオ単位の予定説明。
 */
export function getSecondLifeHousingApplyPlanLines(
  state: Pick<
    SecondLifeState,
    | 'housingSkip'
    | 'housingScenario'
    | 'stayOption'
    | 'hometownOption'
    | 'newAreaOption'
  >,
): string[] {
  const kind: SecondLifeHousingTemplateKind =
    getSecondLifeHousingTemplateKind(state);
  const lines: string[] = [];

  if (isRelocatingHousing(state)) {
    lines.push('転居のため、既存の住まいを住まい変更年齢の直前で終了します');
  }

  switch (kind) {
    case 'skip':
      lines.push(
        '住まいの変更はせず、前回追加したセカンドライフ物件があれば削除します',
      );
      break;
    case 'stay':
      lines.push('現在の住まいをそのまま継続します');
      break;
    case 'rent':
      lines.push('セカンドライフ賃貸を住まい入力に追加します');
      break;
    case 'purchase':
      lines.push('セカンドライフ購入住宅を住まい入力に追加します');
      if (state.housingScenario === 'stay') {
        lines.push(
          '今の場所に住み続ける購入・建て替えでは、既存住まいは自動終了しません',
        );
      }
      break;
    case 'renovate':
      lines.push(
        state.housingScenario === 'hometown'
          ? 'セカンドライフ実家を住まいに追加し、リフォーム等の一時費用を物件へ反映します'
          : '現在の持ち家にリフォーム等の一時費用を反映します',
      );
      break;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }

  return lines;
}

/**
 * 反映前に注意喚起する警告行。
 * 「セカンドライフ開始 = 転居」ではないため、実際に終了する既存住まいがある時だけ
 * 時系列の切替を明示する。
 */
export function getSecondLifeHousingApplyWarnings(input: {
  secondLifeState: Pick<
    SecondLifeState,
    | 'housingSkip'
    | 'housingScenario'
    | 'stayOption'
    | 'hometownOption'
    | 'newAreaOption'
    | 'startAge'
    | 'housingActionAge'
  >;
  existingHousingCount: number;
  changes?: SecondLifeHousingApplyChange[];
}): string[] {
  const kind = getSecondLifeHousingTemplateKind(input.secondLifeState);
  const warnings: string[] = [];

  const ended = (input.changes ?? []).filter(
    (change): change is Extract<SecondLifeHousingApplyChange, { type: 'ended' }> =>
      change.type === 'ended',
  );

  if (isRelocatingHousing(input.secondLifeState) && ended.length > 0) {
    const names = ended.map((change) => `「${change.name}」`).join('・');
    const end = ended[0];
    warnings.push(
      `${names}は住まい変更年齢以降も続く設定です。今回の転居計画を優先すると、${formatAgeMonth(end.endAge, end.endMonth)}で終了します。`,
    );
  }

  if (
    kind === 'purchase' &&
    input.secondLifeState.housingScenario === 'stay' &&
    input.existingHousingCount > 0
  ) {
    warnings.push(
      '今の場所での購入・建て替えでは、既存の住まいは自動終了しません。期間が重なる場合は、既存物件の終了時期を確認してください。',
    );
  }

  const improvementApplied = (input.changes ?? []).some(
    (change) => change.type === 'improvement',
  );
  if (
    kind === 'renovate' &&
    input.secondLifeState.housingScenario === 'stay' &&
    !improvementApplied
  ) {
    warnings.push(
      'リフォーム費を反映できる持ち家が見つかりません。Q5「住まい」で現在の持ち家を登録・確認してから、もう一度反映してください。リフォーム費はライフイベントには自動登録しません。',
    );
  }

  return warnings;
}
