import type { VehiclePresetId } from '../../types/vehicle';
import { VEHICLE_PRESETS } from '../../lib/vehicleDefaults';

interface AddVehicleCardsProps {
  onAdd: (presetId: VehiclePresetId) => void;
}

export function AddVehicleCards({ onAdd }: AddVehicleCardsProps) {
  return (
    <section className="vehicle-add-section" aria-label="乗り物を追加">
      <div className="vehicle-add-header">
        <h3 className="vehicle-add-title">乗り物を追加</h3>
        <p className="vehicle-add-lead">
          購入費用・維持費・買い替えをまとめて登録できます
        </p>
      </div>
      <div className="vehicle-add-grid">
        {VEHICLE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="vehicle-add-card"
            onClick={() => onAdd(preset.id)}
          >
            <span className="vehicle-add-icon" aria-hidden>
              {preset.icon}
            </span>
            <span className="vehicle-add-card-title">{preset.title}</span>
            <span className="vehicle-add-card-desc">{preset.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
