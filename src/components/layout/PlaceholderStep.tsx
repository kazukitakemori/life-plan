import { STEPS, type StepId } from '../../types/steps';
import { StepHeading } from '../ui';

interface PlaceholderStepProps {
  stepId: StepId;
}

export function PlaceholderStep({ stepId }: PlaceholderStepProps) {
  const step = STEPS.find((s) => s.id === stepId);

  return (
    <div className="step-page placeholder-step">
      <StepHeading number={step?.number} title={step?.label ?? ''} />
      <p className="placeholder-message">この項目は準備中です。</p>
    </div>
  );
}
