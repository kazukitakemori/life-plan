import type { LifeEventPresetId } from '../../types/lifeEvent';
import {
  canAddCelebrationGift,
  LIFE_EVENT_PRESETS,
} from '../../lib/lifeEventDefaults';
import type { FamilyMember } from '../../types/family';

interface AddLifeEventCardsProps {
  activeMember: FamilyMember;
  onAdd: (presetId: LifeEventPresetId) => void;
}

const ADD_DESCRIPTIONS: Record<LifeEventPresetId, string> = {
  travel: '旅行・趣味',
  appliance: '買い替え・大型購入',
  medical: '通院・治療',
  nursing: '在宅・施設介護',
  hometown_tax: '寄付金控除',
  celebration_gift: '結婚・出産の援助',
  other: '自由入力',
};

export function AddLifeEventCards({ activeMember, onAdd }: AddLifeEventCardsProps) {
  const presets = LIFE_EVENT_PRESETS.filter(
    (preset) =>
      preset.id !== 'celebration_gift' || canAddCelebrationGift(activeMember),
  );

  return (
    <section className="life-event-add-section" aria-label="ライフイベントを追加">
      <h3 className="life-event-add-title">ライフイベントを追加</h3>
      <div className="life-event-add-grid ui-add-card-grid">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="life-event-add-card ui-add-card"
            onClick={() => onAdd(preset.id)}
          >
            <span className="life-event-add-card-title ui-add-card__title">
              {preset.title}
            </span>
            <span className="life-event-add-card-desc ui-add-card__description">
              {ADD_DESCRIPTIONS[preset.id]}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
