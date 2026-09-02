export type StepId =
  | 'family'
  | 'income'
  | 'pension'
  | 'living'
  | 'education'
  | 'housing'
  | 'vehicle'
  | 'life-event'
  | 'loan'
  | 'insurance'
  | 'savings'
  | 'other';

export interface StepDefinition {
  id: StepId;
  number: number | null;
  label: string;
}

export const STEPS: StepDefinition[] = [
  { id: 'family', number: 1, label: 'ご家族' },
  { id: 'education', number: 2, label: '教育費' },
  { id: 'life-event', number: 3, label: 'ライフイベント' },
  { id: 'living', number: 4, label: '生活費' },
  { id: 'housing', number: 5, label: '住まい' },
  { id: 'vehicle', number: 6, label: '乗り物' },
  { id: 'income', number: 7, label: '収入' },
  { id: 'pension', number: 8, label: '年金' },
  { id: 'loan', number: 9, label: 'ローン' },
  { id: 'insurance', number: 10, label: '保険' },
  { id: 'savings', number: 11, label: '貯蓄・運用' },
  { id: 'other', number: 12, label: 'セカンドライフ' },
];
