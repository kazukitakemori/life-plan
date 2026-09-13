import type {
  SecondLifeNursingDesign,
  SecondLifeNursingScenario,
} from '../types/secondLife';

export interface ThirdLifeCareScenarioInfo {
  id: SecondLifeNursingScenario;
  label: string;
  description: string;
  note?: string;
  referenceLabel: string;
  referenceUrl: string;
  /** Q4生活費・Q5住まいとは別に見込む開始時の参考追加費用（万円） */
  referenceInitialCostMan: number;
  /** Q4生活費・Q5住まいとは別に見込む月額の参考追加費用（万円） */
  referenceMonthlyCostMan: number;
  /** 自動入力する参考額の考え方 */
  referenceCostNote: string;
}

export const THIRD_LIFE_CARE_SCENARIOS: ThirdLifeCareScenarioInfo[] = [
  {
    id: 'home',
    label: '在宅介護',
    description:
      '自宅で暮らしながら、訪問介護・訪問看護など必要なサービスを組み合わせる想定です。利用するサービス量や自己負担割合で費用が変わります。',
    referenceLabel: '介護サービス情報公表システム',
    referenceUrl: 'https://www.kaigokensaku.mhlw.go.jp/',
    referenceInitialCostMan: 47.2,
    referenceMonthlyCostMan: 5.3,
    referenceCostNote:
      '2024年度の介護費用調査を基準に、在宅介護の月額平均と介護全体の一時費用平均を参考値として使います。住宅改修などをQ12住まい側で別計上している場合は重複分を調整してください。',
  },
  {
    id: 'day_service',
    label: '在宅＋デイサービス',
    description:
      '自宅での生活を続けながら、通所介護（デイサービス）などを利用する想定です。食事・入浴・機能訓練などを受けられ、家族の介護負担軽減にもつながります。',
    note: '利用できるサービスや自己負担は要介護度などで異なります。',
    referenceLabel: '厚生労働省：通所介護（デイサービス）',
    referenceUrl: 'https://www.kaigokensaku.mhlw.go.jp/publish/group7.html',
    referenceInitialCostMan: 47.2,
    referenceMonthlyCostMan: 6.5,
    referenceCostNote:
      '在宅介護の月額平均5.3万円を土台に、通所利用が増えるケースを少し厚めに見た試算値です。利用回数・食費・自己負担割合に応じて調整してください。',
  },
  {
    id: 'special_nursing_home',
    label: '特別養護老人ホーム（特養）',
    description:
      '常時介護が必要な人向けの介護保険施設です。新規入所は原則として要介護3以上で、介護度・居室タイプ・所得区分などにより自己負担が変わります。',
    note: '施設の家賃・食費まで追加するとQ4生活費・Q5住まいと二重計上しやすいため、自動入力では介護サービス自己負担と日常生活上の追加分を中心に見込みます。',
    referenceLabel: '厚生労働省：介護サービスの利用料',
    referenceUrl: 'https://www.kaigokensaku.mhlw.go.jp/commentary/fee.html',
    referenceInitialCostMan: 0,
    referenceMonthlyCostMan: 4,
    referenceCostNote:
      '厚生労働省の要介護5・1割負担の例では施設サービス費が月約2.6〜2.9万円です。ここでは日常生活上の追加分も少し見込み、住居費・食費を除く追加額として月4万円を置きます。',
  },
  {
    id: 'paid_care',
    label: '介護付き有料老人ホーム',
    description:
      '特定施設入居者生活介護の指定を受けた有料老人ホームで、ホームが介護保険サービスを包括的に提供するタイプです。',
    note: '入居一時金・家賃・食費は施設差が非常に大きいため、自動入力には含めません。実際の候補施設が決まったら見積に合わせて修正してください。',
    referenceLabel: '厚生労働省：高齢者向け住まいの違い',
    referenceUrl: 'https://www.mhlw.go.jp/content/12300000/001447747.pdf',
    referenceInitialCostMan: 0,
    referenceMonthlyCostMan: 5,
    referenceCostNote:
      '住居費・食費・入居一時金はQ4/Q5との重複を避けるため自動計上せず、介護保険自己負担や介護に伴う追加支出の参考枠として月5万円を置きます。',
  },
  {
    id: 'paid_residential',
    label: '住宅型有料老人ホーム',
    description:
      '生活支援付きの住まいで、介護保険サービスが必要な場合は外部の介護事業所と個別に契約して利用するタイプです。',
    note: '介護サービスの利用量によって追加費用が変わりやすい点に注意が必要です。家賃・食費などの住居関連費は自動入力に含めません。',
    referenceLabel: '厚生労働省：高齢者向け住まいの違い',
    referenceUrl: 'https://www.mhlw.go.jp/content/12300000/001447747.pdf',
    referenceInitialCostMan: 0,
    referenceMonthlyCostMan: 6,
    referenceCostNote:
      '外付けの訪問介護等を使う前提で、住居費・食費とは別の介護追加分を月6万円で仮置きします。利用量が多い場合は実際のケアプランに合わせて増額してください。',
  },
  {
    id: 'serviced_elderly',
    label: 'サービス付き高齢者向け住宅（サ高住）',
    description:
      'バリアフリーの高齢者向け住宅で、安否確認と生活相談が必須です。介護・食事・生活支援など、それ以外のサービス内容は住宅ごとに異なります。',
    note: '家賃・共益費・見守りサービス費などは住居費に近いため、自動入力する介護費には含めません。',
    referenceLabel: '国土交通省：サービス付き高齢者向け住宅',
    referenceUrl: 'https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk3_000005.html',
    referenceInitialCostMan: 0,
    referenceMonthlyCostMan: 6,
    referenceCostNote:
      'サ高住の住居関連費とは分けて、外部介護サービス等の追加分として月6万円を仮置きします。特定施設指定の有無や要介護度で大きく変わるため、候補住宅が決まれば修正してください。',
  },
  {
    id: 'group_home',
    label: '認知症グループホーム',
    description:
      '認知症の人が少人数で共同生活し、日常生活上の支援や機能訓練などを受ける地域密着型サービスです。',
    note: '要支援2または要介護1〜5など、利用条件があります。食費・居住費などは介護サービス費とは別にかかります。',
    referenceLabel: '厚生労働省：認知症グループホーム',
    referenceUrl: 'https://www.kaigokensaku.mhlw.go.jp/publish/group18.html',
    referenceInitialCostMan: 0,
    referenceMonthlyCostMan: 4,
    referenceCostNote:
      '厚生労働省の1割負担額は要介護度に応じて1日あたりおおむね700〜800円台です。住居費・食費を除き、日常生活上の追加分も含めた参考額として月4万円を置きます。',
  },
  {
    id: 'other',
    label: 'その他・まだ決めていない',
    description:
      '施設種別をまだ決めていない場合や、上記に当てはまらない介護の形を想定する場合に使います。費用は分かる範囲で入力してください。',
    referenceLabel: '介護サービス情報公表システム',
    referenceUrl: 'https://www.kaigokensaku.mhlw.go.jp/',
    referenceInitialCostMan: 47.2,
    referenceMonthlyCostMan: 9,
    referenceCostNote:
      '介護方法がまだ決まっていないため、2024年度の介護費用調査の全体平均（一時47.2万円・月9.0万円）を仮置きします。方針が決まったら該当する介護方法へ変更してください。',
  },
];

export const THIRD_LIFE_CARE_SCENARIO_LABELS = Object.fromEntries(
  THIRD_LIFE_CARE_SCENARIOS.map((scenario) => [scenario.id, scenario.label]),
) as Record<SecondLifeNursingScenario, string>;

export function getThirdLifeCareScenarioInfo(
  scenario: SecondLifeNursingScenario,
): ThirdLifeCareScenarioInfo {
  return (
    THIRD_LIFE_CARE_SCENARIOS.find((item) => item.id === scenario) ??
    THIRD_LIFE_CARE_SCENARIOS[THIRD_LIFE_CARE_SCENARIOS.length - 1]
  );
}

export function getThirdLifeCareReferenceCost(
  scenario: SecondLifeNursingScenario,
): Pick<SecondLifeNursingDesign, 'initialCostMan' | 'monthlyCostMan'> {
  const info = getThirdLifeCareScenarioInfo(scenario);
  return {
    initialCostMan: info.referenceInitialCostMan,
    monthlyCostMan: info.referenceMonthlyCostMan,
  };
}

export function getThirdLifeAnnualAdditionalCostMan(
  design: Pick<SecondLifeNursingDesign, 'monthlyCostMan'>,
): number {
  return Math.round(Math.max(0, design.monthlyCostMan) * 12 * 100) / 100;
}

export function getThirdLifeCareStartAge(
  design: Pick<SecondLifeNursingDesign, 'startAge'>,
  expectedLifespan: number,
): number {
  return Math.min(
    Math.max(60, expectedLifespan),
    Math.max(60, Math.round(design.startAge || 60)),
  );
}

export function getThirdLifeCareEndAge(
  design: Pick<
    SecondLifeNursingDesign,
    'startAge' | 'durationMode' | 'durationYears'
  >,
  expectedLifespan: number,
): number {
  const startAge = getThirdLifeCareStartAge(design, expectedLifespan);
  if (design.durationMode === 'lifetime') return Math.max(startAge, expectedLifespan);
  const years = Math.max(1, Math.round(design.durationYears ?? 1));
  return Math.min(Math.max(startAge, expectedLifespan), startAge + years - 1);
}

export function formatThirdLifeCareDuration(
  design: Pick<SecondLifeNursingDesign, 'durationMode' | 'durationYears'>,
): string {
  return design.durationMode === 'lifetime'
    ? '一生涯'
    : `${Math.max(1, Math.round(design.durationYears ?? 1))}年間`;
}
