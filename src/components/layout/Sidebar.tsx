import { STEPS, type StepId } from '../../types/steps';

interface SidebarProps {
  activeStep: StepId;
  onStepChange: (step: StepId) => void;
  onAnalyze?: () => void;
}

const ENABLED_STEPS: StepId[] = [
  'family',
  'education',
  'life-event',
  'living',
  'income',
  'pension',
];

function SidebarActionButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: string;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="sidebar-action-btn"
      onClick={onClick}
      disabled={disabled || !onClick}
    >
      <span className="sidebar-action-icon" aria-hidden>
        {icon}
      </span>
      <span className="sidebar-action-label">{label}</span>
    </button>
  );
}

export function Sidebar({
  activeStep,
  onStepChange,
  onAnalyze,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {STEPS.map((step) => {
          const enabled = ENABLED_STEPS.includes(step.id);
          const active = activeStep === step.id;

          return (
            <button
              key={step.id}
              type="button"
              className={`sidebar-item ${active ? 'active' : ''} ${!enabled ? 'disabled' : ''}`}
              onClick={() => enabled && onStepChange(step.id)}
              disabled={!enabled}
            >
              {step.number !== null && (
                <span className="sidebar-q">Q{step.number}</span>
              )}
              <span className="sidebar-label">{step.label}</span>
            </button>
          );
        })}

        <div className="sidebar-actions">
          <SidebarActionButton
            icon="▶"
            label="ライフプラン分析"
            onClick={onAnalyze}
          />
        </div>
      </nav>
    </aside>
  );
}
