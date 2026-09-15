import type { LifeEventPresetId } from '../../types/lifeEvent';
import {
  canAddCelebrationGift,
  LIFE_EVENT_PRESETS,
} from '../../lib/lifeEventDefaults';
import type { FamilyMember } from '../../types/family';

interface AddLifeEventCardsProps {
  activeMember: FamilyMember;
  isOpen: boolean;
  onToggle: () => void;
  onAdd: (presetId: LifeEventPresetId) => void;
}

const ADD_DESCRIPTIONS: Partial<Record<LifeEventPresetId, string>> = {
  travel: '旅行・趣味',
  appliance: '買い替え・大型購入',
  celebration_gift: '結婚・出産の援助',
  other: '自由入力',
};

export function AddLifeEventCards({
  activeMember,
  isOpen,
  onToggle,
  onAdd,
}: AddLifeEventCardsProps) {
  const presets = LIFE_EVENT_PRESETS.filter(
    (preset) =>
      preset.id !== 'celebration_gift' || canAddCelebrationGift(activeMember),
  );

  return (
    <section
      className={`life-event-add-section${isOpen ? ' is-open' : ''}`}
      aria-label="ライフイベントを追加"
    >
      <h3 className="life-event-add-title">ライフイベントを追加</h3>

      <button
        type="button"
        className="ui-btn ui-btn--ghost life-event-add-toggle"
        aria-expanded={isOpen}
        aria-controls="life-event-add-panel"
        onClick={onToggle}
      >
        ＋ ライフイベントを追加
      </button>

      <div id="life-event-add-panel" className="life-event-add-grid ui-add-card-grid">
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
              {ADD_DESCRIPTIONS[preset.id] ?? preset.description}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
