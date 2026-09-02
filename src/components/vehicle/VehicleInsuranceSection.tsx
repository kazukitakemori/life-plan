import type { VehicleInsurance } from '../../types/vehicle';

interface VehicleInsuranceSectionProps {
  insurances: VehicleInsurance[];
  onChange: (insurances: VehicleInsurance[]) => void;
}

export function VehicleInsuranceSection({
  insurances,
  onChange,
}: VehicleInsuranceSectionProps) {
  if (insurances.length === 0) return null;

  const updateInsurance = (
    id: string,
    patch: Partial<VehicleInsurance>,
  ) => {
    onChange(
      insurances.map((insurance) =>
        insurance.id === id ? { ...insurance, ...patch } : insurance,
      ),
    );
  };

  const removeInsurance = (id: string) => {
    onChange(insurances.filter((insurance) => insurance.id !== id));
  };

  return (
    <div className="vehicle-insurance-section">
      <span className="vehicle-insurance-label">保険</span>
      <div className="vehicle-insurance-body">
        <div className="vehicle-insurance-list">
          {insurances.map((insurance) => (
            <div key={insurance.id} className="vehicle-insurance-item">
              <input
                type="text"
                className="life-event-text-input vehicle-insurance-name"
                value={insurance.label}
                placeholder="保険名"
                onChange={(e) =>
                  updateInsurance(insurance.id, { label: e.target.value })
                }
              />
              <div className="life-event-amount-field">
                <input
                  type="number"
                  className="amount-input"
                  value={insurance.premiumMan}
                  min={0}
                  step={0.1}
                  onChange={(e) =>
                    updateInsurance(insurance.id, {
                      premiumMan: Number(e.target.value) || 0,
                    })
                  }
                />
                <span className="amount-unit">万円/年</span>
              </div>
              <button
                type="button"
                className="vehicle-insurance-remove"
                onClick={() => removeInsurance(insurance.id)}
                aria-label="保険を削除"
              >
                −
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
