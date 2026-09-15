import type { VehiclePresetId } from '../../types/vehicle';
import { VEHICLE_PRESETS } from '../../lib/vehicleDefaults';
import { AddDisclosure } from '../ui';

interface AddVehicleCardsProps {
  onAdd: (presetId: VehiclePresetId) => void;
}

const ADD_DESCRIPTIONS: Record<VehiclePresetId, string> = {
  car: '所有・購入',
  motorcycle: '所有・購入',
  bicycle: '所有・購入',
  other: '自由入力',
};

export function AddVehicleCards({ onAdd }: AddVehicleCardsProps) {
  return (
    <AddDisclosure label="乗り物を追加" className="vehicle-add-section">
      {(close) => (
        <>
          <p className="vehicle-add-lead">購入・維持・買い替えをまとめて登録</p>
          <div className="vehicle-add-grid ui-add-card-grid">
            {VEHICLE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="vehicle-add-card ui-add-card"
                onClick={() => {
                  onAdd(preset.id);
                  close();
                }}
              >
                <span className="vehicle-add-card-title ui-add-card__title">
                  {preset.title}
                </span>
                <span className="vehicle-add-card-desc ui-add-card__description">
                  {ADD_DESCRIPTIONS[preset.id]}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </AddDisclosure>
  );
}
