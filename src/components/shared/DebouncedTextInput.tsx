import { useEffect, useRef, useState } from 'react';

interface DebouncedTextInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'value' | 'onChange' | 'defaultValue'
  > {
  value: string;
  onChange: (value: string) => void;
  delayMs?: number;
}

export function DebouncedTextInput({
  value,
  onChange,
  delayMs = 300,
  onBlur,
  ...props
}: DebouncedTextInputProps) {
  const [draft, setDraft] = useState(value);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (draft === value) return;
    const timer = window.setTimeout(() => {
      onChangeRef.current(draft);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [draft, value, delayMs]);

  return (
    <input
      {...props}
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        if (draft !== value) {
          onChangeRef.current(draft);
        }
        onBlur?.(e);
      }}
    />
  );
}
