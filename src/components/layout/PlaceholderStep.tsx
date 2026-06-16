import { STEPS, type StepId } from '../../types/steps';

interface PlaceholderStepProps {
  stepId: StepId;
}

export function PlaceholderStep({ stepId }: PlaceholderStepProps) {
  const step = STEPS.find((s) => s.id === stepId);

  return (
    <div className="step-page placeholder-step">
      <h2 className="step-title">
        {step?.number !== null && step?.number !== undefined
          ? `Q${step.number}. `
          : ''}
        {step?.label}
      </h2>
      <p className="placeholder-message">この項目は準備中です。</p>
    </div>
  );
}
