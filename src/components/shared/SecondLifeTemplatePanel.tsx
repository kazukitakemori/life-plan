interface SecondLifeTemplatePanelProps {
  startAge: number | null | undefined;
  title: string;
  description: string;
  buttonLabel: string;
  onAdd: () => void;
  disabled?: boolean;
}

export function SecondLifeTemplatePanel({
  startAge,
  title,
  description,
  buttonLabel,
  onAdd,
  disabled = false,
}: SecondLifeTemplatePanelProps) {
  if (startAge == null || startAge < 60) {
    return null;
  }

  return (
    <section className="second-life-template-panel" aria-labelledby="second-life-template-heading">
      <div className="second-life-template-panel-head">
        <h3 id="second-life-template-heading" className="second-life-template-panel-title">
          {title}
        </h3>
        <p className="second-life-template-panel-desc">{description}</p>
      </div>
      <button
        type="button"
        className="second-life-template-panel-btn"
        onClick={onAdd}
        disabled={disabled}
      >
        {buttonLabel}
      </button>
    </section>
  );
}
