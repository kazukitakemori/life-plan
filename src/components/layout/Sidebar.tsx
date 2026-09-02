import { STEPS, type StepId } from '../../types/steps';

interface SidebarProps {
  activeStep: StepId;
  enabledSteps: StepId[];
  requiredSteps?: StepId[];
  showRequiredMarkers?: boolean;
  onStepChange: (step: StepId) => void;
  onAnalyze?: () => void;
  analyzeDisabled?: boolean;
  showAnalyze?: boolean;
}

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
  enabledSteps,
  requiredSteps = [],
  showRequiredMarkers = false,
  onStepChange,
  onAnalyze,
  analyzeDisabled,
  showAnalyze = true,
}: SidebarProps) {
  const enabledSet = new Set(enabledSteps);
  const requiredSet = new Set(requiredSteps);
  const showLegend =
    showRequiredMarkers &&
    STEPS.some((step) => enabledSet.has(step.id) && requiredSet.has(step.id));

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {STEPS.map((step) => {
          const enabled = enabledSet.has(step.id);
          const active = activeStep === step.id;
          const required =
            showRequiredMarkers && enabled && requiredSet.has(step.id);
          const stepTitle = !enabled
            ? '現在の試算目的では入力不要な項目です'
            : required
              ? `${step.label}（必須入力）`
              : undefined;

          return (
            <button
              key={step.id}
              type="button"
              className={`sidebar-item ${active ? 'active' : ''} ${!enabled ? 'disabled' : ''}`}
              onClick={() => enabled && onStepChange(step.id)}
              disabled={!enabled}
              title={stepTitle}
              aria-disabled={!enabled}
            >
              {step.number !== null && (
                <span className="sidebar-q">Q{step.number}</span>
              )}
              <span className="sidebar-label">{step.label}</span>
              {required ? (
                <span
                  className="sidebar-required-mark"
                  aria-hidden="true"
                  title="必須入力"
                >
                  *
                </span>
              ) : null}
            </button>
          );
        })}
        {showLegend ? (
          <p className="sidebar-required-legend">
            <span className="sidebar-required-mark" aria-hidden="true">
              *
            </span>
            <span>必須入力</span>
          </p>
        ) : null}
      </nav>

      {showAnalyze ? (
        <div className="sidebar-actions">
          <SidebarActionButton
            icon="▶"
            label="ライフプラン分析"
            onClick={onAnalyze}
            disabled={analyzeDisabled}
          />
        </div>
      ) : null}
    </aside>
  );
}
