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
    for (const rental of data.rentals) byId.set(rental.id, toRentalItem(rental));
    for (const property of data.owned) {
      if (property.type !== 'land') byId.set(property.id, toOwnedItem(property));
    }
  }
  return [...byId.values()];
}

function isActiveAtAge(item: HousingItem, age: number): boolean {
  if (item.startAge > age) return false;
  if (item.startAge === age && item.startMonth > 1) return false;
  if (item.endMode === 'lifetime') return true;
  if (item.endAge > age) return true;
  if (item.endAge < age) return false;
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

export function buildSecondLifeHousingConsistency(input: {
  housingState: HousingState;
  secondLifeState: SecondLifeState;
}): SecondLifeHousingConsistency {
  const { housingState, secondLifeState } = input;

  if (secondLifeState.housingSkip) {
    return {
      status: 'skipped',
      title: '今の住まい計画で計算します',
      summary:
        '「住まい」で入力した内容をそのまま使います。元の入力は変更しません。',
      detailLines: [],
    };
  }

  const actionAge =
    secondLifeState.housingScenario === 'stay' &&
    secondLifeState.stayOption === 'continue'
      ? secondLifeState.startAge
      : secondLifeState.housingActionAge;
  const activeHousing = collectHousingItems(housingState).filter((item) =>
    isActiveAtAge(item, actionAge),
  );

  // 旧データ互換。現行UIでは「そのまま使う」は housingSkip で表現する。
  if (
    secondLifeState.housingScenario === 'stay' &&
    secondLifeState.stayOption === 'continue'
  ) {
    if (activeHousing.length === 0) {
      return {
        status: 'missing',
        title: `${secondLifeState.startAge}歳時点の住まいが入力されていません`,
        summary:
          '今の住まい計画を使うため、先に「住まい」で現在の住まいを入力してください。',
        detailLines: [],
      };
    }
    return {
      status: 'aligned',
      title: '今の住まいをそのまま継続して計算します',
      summary:
        '現在入力している住まいの期間・費用をそのまま使います。',
      detailLines: activeHousing.map(formatHousingPeriod),
    };
  }

  if (
    secondLifeState.housingScenario === 'stay' &&
    secondLifeState.stayOption === 'renovate'
  ) {
    const owned = activeHousing.filter((item) => item.kind === 'owned');
    if (owned.length === 0) {
      return {
        status: 'missing',
        title: `${actionAge}歳時点の持ち家が入力されていません`,
        summary:
          '現在の住宅をリフォームするため、先に「住まい」で対象となる持ち家を入力してください。',
        detailLines: activeHousing.map(formatHousingPeriod),
      };
    }
    return {
      status: 'aligned',
      title: `${actionAge}歳にリフォーム費を追加して計算します`,
      summary:
        '元の持ち家設定は残したまま、この年齢にリフォーム費を追加して試算します。',
      detailLines: owned.map(formatHousingPeriod),
    };
  }

  return {
    status: 'aligned',
    title: `${actionAge}歳から、選んだ住まい方に切り替えて計算します`,
    summary:
      activeHousing.length > 0
        ? '元の住まい設定は残したまま、この年齢から上で選んだ住まい方へ切り替えて試算します。'
        : '元の入力は変更せず、この年齢から上で選んだ住まい方で試算します。',
    detailLines: activeHousing.map(formatHousingPeriod),
  };
}

export function getSecondLifeHousingConsistencyStatusLabel(
  status: SecondLifeHousingConsistencyStatus,
): string {
  switch (status) {
    case 'aligned':
      return '設定済み';
    case 'attention':
      return '要確認';
    case 'missing':
      return '要入力';
    case 'skipped':
      return '変更なし';
  }
}
