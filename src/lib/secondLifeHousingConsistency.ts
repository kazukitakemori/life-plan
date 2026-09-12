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
  const end = item.endMode === 'lifetime' ? '一生涯' : `${item.endAge}歳${item.endMonth}月まで`;
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
      title: 'Q5の住まい入力をそのまま使用します',
      summary: 'Q12による住まいの上書きは無効です。Q5の入力内容は変更されません。',
      detailLines: [],
    };
  }

  const actionAge =
    secondLifeState.housingScenario === 'stay' && secondLifeState.stayOption === 'continue'
      ? secondLifeState.startAge
      : secondLifeState.housingActionAge;
  const activeHousing = collectHousingItems(housingState).filter((item) =>
    isActiveAtAge(item, actionAge),
  );

  if (secondLifeState.housingScenario === 'stay' && secondLifeState.stayOption === 'continue') {
    if (activeHousing.length === 0) {
      return {
        status: 'missing',
        title: `${secondLifeState.startAge}歳時点の住まいがQ5にありません`,
        summary: '今の住まいを継続する設計なので、Q5で現在の住まいを入力してください。',
        detailLines: [],
      };
    }
    return {
      status: 'aligned',
      title: 'Q5の現在の住まいをそのまま継続します',
      summary: 'セカンドライフ開始後もQ5の住まい入力をそのまま計算に使用します。',
      detailLines: activeHousing.map(formatHousingPeriod),
    };
  }

  if (secondLifeState.housingScenario === 'stay' && secondLifeState.stayOption === 'renovate') {
    const owned = activeHousing.filter((item) => item.kind === 'owned');
    if (owned.length === 0) {
      return {
        status: 'missing',
        title: `${actionAge}歳時点の持ち家がQ5にありません`,
        summary: '現在の住宅をリフォームする設計なので、Q5で対象となる持ち家を入力してください。',
        detailLines: activeHousing.map(formatHousingPeriod),
      };
    }
    return {
      status: 'aligned',
      title: `${actionAge}歳のリフォーム費を計算上追加します`,
      summary: 'Q5の持ち家データは変更せず、キャッシュフロー上の住まい支出としてQ12のリフォーム費を重ねます。',
      detailLines: owned.map(formatHousingPeriod),
    };
  }

  return {
    status: 'aligned',
    title: `${actionAge}歳からQ12の住まい設計を優先します`,
    summary:
      activeHousing.length > 0
        ? 'Q5の住まいがその後も続く入力でも、Q5自体は変更せず、計算上だけQ12の住まいへ切り替えます。'
        : 'Q5の入力自体は変更せず、計算上だけQ12の住まいを使用します。',
    detailLines: activeHousing.map(formatHousingPeriod),
  };
}

export function getSecondLifeHousingConsistencyStatusLabel(
  status: SecondLifeHousingConsistencyStatus,
): string {
  switch (status) {
    case 'aligned':
      return '計算OK';
    case 'attention':
      return '要確認';
    case 'missing':
      return '要入力';
    case 'skipped':
      return 'Q5を使用';
  }
}
