import type { FamilyMemberRole } from '../../types/family';

interface AddOption {
  role: FamilyMemberRole;
  icon: string;
  label: string;
  description: string;
}

const ADD_OPTIONS: AddOption[] = [
  {
    role: 'spouse',
    icon: '💚',
    label: '配偶者',
    description: '夫・妻を追加',
  },
  {
    role: 'child',
    icon: '👶',
    label: '子供',
    description: '将来のお子さんもOK',
  },
  {
    role: 'other',
    icon: '👥',
    label: 'その他',
    description: 'パートナー・同居の親族など',
  },
  {
    role: 'pet',
    icon: '🐾',
    label: 'ペット',
    description: '犬や猫などの家族',
  },
];

interface AddFamilyBarProps {
  onAdd: (role: FamilyMemberRole) => void;
  canAddSpouse: boolean;
}

export function AddFamilyBar({ onAdd, canAddSpouse }: AddFamilyBarProps) {
  return (
    <section className="add-family-bar">
      <h3 className="add-family-title">家族を追加</h3>
      <div className="add-family-grid">
        {ADD_OPTIONS.map((option) => {
          const disabled = option.role === 'spouse' && !canAddSpouse;

          return (
            <button
              key={option.role}
              type="button"
              className="add-family-card"
              onClick={() => onAdd(option.role)}
              disabled={disabled}
            >
              <span className="add-family-icon">{option.icon}</span>
              <span className="add-family-label">{option.label}</span>
              <span className="add-family-desc">{option.description}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
