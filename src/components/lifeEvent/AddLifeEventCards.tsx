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

export function AddLifeEventCards({ activeMember, onAdd }: AddLifeEventCardsProps) {
  const presets = LIFE_EVENT_PRESETS.filter(
    (preset) =>
      preset.id !== 'celebration_gift' || canAddCelebrationGift(activeMember),
  );

  return (
    <section className="life-event-add-section" aria-label="ライフイベントを追加">
      <h3 className="life-event-add-title">ライフイベントを追加</h3>
      <div className="life-event-add-grid">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="life-event-add-card"
            onClick={() => onAdd(preset.id)}
          >
            <span className="life-event-add-icon" aria-hidden>
              {preset.icon}
            </span>
            <span className="life-event-add-card-title">{preset.title}</span>
            <span className="life-event-add-card-desc">{preset.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
