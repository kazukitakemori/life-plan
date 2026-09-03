import type { ClientInfo, SimulationInput } from '../types';

interface SimulationFormProps {
  clientInfo: ClientInfo;
  input: SimulationInput;
  onClientInfoChange: (info: ClientInfo) => void;
  onInputChange: (input: SimulationInput) => void;
}

function NumberField({
  label,
  value,
  onChange,
  unit,
  step = 10000,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit: string;
  step?: number;
  min?: number;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <div className="field-input-row">
        <input
          type="number"
          value={value}
          min={min}
          step={step}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
        />
        <span className="field-unit">{unit}</span>
      </div>
    </label>
  );
}

export function SimulationForm({
  clientInfo,
  input,
  onClientInfoChange,
  onInputChange,
}: SimulationFormProps) {
  return (
    <section className="panel form-panel">
      <h2>入力条件</h2>

      <div className="field-group">
        <h3>基本情報</h3>
        <label className="field">
          <span className="field-label">お名前</span>
          <input
            type="text"
            placeholder="例：山田 太郎"
            value={clientInfo.clientName}
            onChange={(e) =>
              onClientInfoChange({ ...clientInfo, clientName: e.target.value })
            }
          />
        </label>
        <label className="field">
          <span className="field-label">メモ</span>
          <input
            type="text"
            placeholder="前提条件など"
            value={clientInfo.memo}
            onChange={(e) =>
              onClientInfoChange({ ...clientInfo, memo: e.target.value })
            }
          />
        </label>
      </div>

      <div className="field-group">
        <h3>キャッシュフロー</h3>
        <NumberField
          label="現在の金融資産"
          value={input.initialBalance}
          onChange={(v) => onInputChange({ ...input, initialBalance: v })}
          unit="円"
          step={100000}
        />
        <NumberField
          label="月間収入（手取り）"
          value={input.monthlyIncome}
          onChange={(v) => onInputChange({ ...input, monthlyIncome: v })}
          unit="円"
        />
        <NumberField
          label="月間支出"
          value={input.monthlyExpense}
          onChange={(v) => onInputChange({ ...input, monthlyExpense: v })}
          unit="円"
        />
      </div>

      <div className="field-group">
        <h3>シミュレーション期間</h3>
        <label className="field">
          <span className="field-label">年数</span>
          <div className="field-input-row">
            <input
              type="number"
              value={input.years}
              min={1}
              max={50}
              step={1}
              onChange={(e) =>
                onInputChange({ ...input, years: Number(e.target.value) || 1 })
              }
            />
            <span className="field-unit">年</span>
          </div>
        </label>
        <p className="field-hint">
          現在 {input.years * 12} ヶ月分をシミュレーションします
        </p>
      </div>
    </section>
  );
}
