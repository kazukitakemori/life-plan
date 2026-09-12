import type {
  HousingState,
  OwnedProperty,
  RentalProperty,
} from '../types/housing';
import type { SecondLifeState } from '../types/secondLife';

export type SecondLifeHousingConsistencyStatus =
  | 'aligned'
  | 'attention'
  | 'missing'
  | 'skipped';

type HousingItem = {
  id: string;
  name: string;
  kind: 'rental' | 'owned';
  startAge: number;
  startMonth: number;
  endMode: 'lifetime' | 'until';
  endAge: number;
  endMonth: number;
};

export interface SecondLifeHousingConsistency {
  status: SecondLifeHousingConsistencyStatus;
  title: string;
  summary: string;
  detailLines: string[];
}

function toRentalItem(item: RentalProperty): HousingItem {
  return {
    id: item.id,
    name: item.name || '賃貸住宅',
    kind: 'rental',
    startAge: item.startAge,
    startMonth: item.startMonth,
    endMode: item.endMode,
    endAge: item.endAge,
    endMonth: item.endMonth,
  };
}

function toOwnedItem(item: OwnedProperty): HousingItem {
  return {
    id: item.id,
    name: item.name || '所有住宅',
    kind: 'owned',
    startAge: item.startAge,
    startMonth: item.startMonth,
    endMode: item.endMode,
    endAge: item.endAge,
    endMonth: item.endMonth,
  };
}

function collectHousingItems(housingState: HousingState): HousingItem[] {
  const byId = new Map<string, HousingItem>();

  for (const data of Object.values(housingState.byTarget)) {
    for (const rental of data.rentals) {
      byId.set(rental.id, toRentalItem(rental));
    }
    for (const property of data.owned) {
      // 土地だけの登録は「住んでいる住まい」として扱わない。
      if (property.type === 'land') continue;
      byId.set(property.id, toOwnedItem(property));
    }
  }

  return [...byId.values()];
}

function isActiveAtSecondLifeStart(item: HousingItem, startAge: number): boolean {
  if (item.startAge > startAge) return false;
  if (item.startAge === startAge && item.startMonth > 1) return false;

  if (item.endMode === 'lifetime') return true;
  if (item.endAge > startAge) return true;
  if (item.endAge < startAge) return false;
  return item.endMonth >= 1;
}

function formatHousingPeriod(item: HousingItem): string {
  const kind = item.kind === 'rental' ? '賃貸' : '所有';
  const end =
    item.endMode === 'lifetime'
      ? '一生涯'
      : `${item.endAge}歳${item.endMonth}月まで`;
  return `${item.name}（${kind}・${end}）`;
}

function joinHousingNames(items: HousingItem[]): string {
  return items.map((item) => `「${item.name}」`).join('・');
}

function previousMonthLabel(startAge: number): string {
  return `${Math.max(0, startAge - 1)}歳12月`;
}

/**
 * セカンドライフの「暮らし方」と、Q5 住まいに登録済みの時系列が矛盾しないかを判定する。
 *
 * セカンドライフ開始 = 転居ではない。
 * - stay + renovate: 既存住宅が開始年齢まで続いていれば整合
 * - hometown / new_area: 開始年齢以降も続く既存住宅があれば、反映時に終了させるため要確認
 * - stay + purchase_rebuild: 既存住宅を自動終了しない現仕様なので、重複する場合は要確認
 */
export function buildSecondLifeHousingConsistency(input: {
  housingState: HousingState;
  secondLifeState: SecondLifeState;
}): SecondLifeHousingConsistency {
  const { housingState, secondLifeState } = input;
  const startAge =
    secondLifeState.housingScenario === 'stay' &&
    secondLifeState.stayOption === 'continue'
      ? secondLifeState.startAge
      : secondLifeState.housingActionAge;

  if (secondLifeState.housingSkip) {
    return {
      status: 'skipped',
      title: '住まいはまだ具体化しません',
      summary: '現在の住まい入力をそのまま使います。',
      detailLines: [],
    };
  }

  const activeHousing = collectHousingItems(housingState).filter((item) =>
    isActiveAtSecondLifeStart(item, startAge),
  );

  if (secondLifeState.housingScenario === 'stay') {
    if (secondLifeState.stayOption === 'continue') {
      if (activeHousing.length === 0) {
        return {
          status: 'missing',
          title: `${secondLifeState.startAge}歳時点の住まいが未設定です`,
          summary: '今の住まいをそのまま継続する計画ですが、セカンドライフ開始時点の住まいが見つかりません。',
          detailLines: [],
        };
      }
      return {
        status: 'aligned',
        title: '現在の住まいをそのまま継続できます',
        summary: `${secondLifeState.startAge}歳からセカンドライフを始めても、住まいの変更は発生しません。`,
        detailLines: activeHousing.map(formatHousingPeriod),
      };
    }

    if (secondLifeState.stayOption === 'purchase_rebuild') {
      if (activeHousing.length === 0) {
        return {
          status: 'aligned',
          title: `${startAge}歳から新しい住宅を計画できます`,
          summary: '開始年齢時点で重なる既存住宅はありません。',
          detailLines: [],
        };
      }

      return {
        status: 'attention',
        title: '現在の住まいと新しい住宅が重なる可能性があります',
        summary: `${joinHousingNames(activeHousing)}が${startAge}歳以降も続く設定です。購入・建て替えとの切替時期を確認してください。`,
        detailLines: activeHousing.map(formatHousingPeriod),
      };
    }

    if (activeHousing.length === 0) {
      return {
        status: 'missing',
        title: `${startAge}歳時点の住まいが未設定です`,
        summary: '「今の場所に住み続ける」計画ですが、開始年齢まで続く住まいが見つかりません。',
        detailLines: [],
      };
    }

    return {
      status: 'aligned',
      title: '現在の住まいにリフォーム費を反映できます',
      summary: `${startAge}歳に現在の持ち家をリフォームする計画です。住み替えは発生しません。`,
      detailLines: activeHousing.map(formatHousingPeriod),
    };
  }

  if (activeHousing.length === 0) {
    return {
      status: 'aligned',
      title: `${startAge}歳から新しい住まいへ切り替える計画です`,
      summary: '開始年齢時点で終了処理が必要な既存住宅はありません。',
      detailLines: [],
    };
  }

  const destination =
    secondLifeState.housingScenario === 'hometown'
      ? '地元の住まい'
      : '新しい土地の住まい';

  return {
    status: 'attention',
    title: '現在の住まいから切り替える必要があります',
    summary: `${joinHousingNames(activeHousing)}が${startAge}歳以降も続く設定です。住まい計画を優先すると、現在の住まいを${previousMonthLabel(startAge)}で終了し、${destination}へ切り替えます。`,
    detailLines: activeHousing.map(formatHousingPeriod),
  };
}

export function getSecondLifeHousingConsistencyStatusLabel(
  status: SecondLifeHousingConsistencyStatus,
): string {
  switch (status) {
    case 'aligned':
      return '整合';
    case 'attention':
      return '要確認';
    case 'missing':
      return '未設定';
    case 'skipped':
      return '未具体化';
  }
}
