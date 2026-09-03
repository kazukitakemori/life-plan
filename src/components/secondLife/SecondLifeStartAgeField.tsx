import { SECOND_LIFE_DEFAULT_START_AGE } from '../../lib/secondLifeDefaults';

interface SecondLifeStartAgeFieldProps {
  value: number;
  onChange: (startAge: number) => void;
  disabled?: boolean;
}

export function SecondLifeStartAgeField({
  value,
  onChange,
  disabled = false,
}: SecondLifeStartAgeFieldProps) {
  return (
    <label className="second-life-timing">
      <span>セカンドライフ開始年齢（世帯主）</span>
      <input
        type="number"
        className="second-life-age-input"
        min={60}
        max={100}
        value={value}
        disabled={disabled}
        onChange={(event) =>
          onChange(Number(event.target.value) || SECOND_LIFE_DEFAULT_START_AGE)
        }
      />
      <span>歳〜</span>
    </label>
  );
}
