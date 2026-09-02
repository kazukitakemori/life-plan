import type { SecondLifeTaxSummaryConfig } from '../../types/secondLifeTaxSummary';

interface SecondLifeTaxSummaryViewProps {
  config: SecondLifeTaxSummaryConfig;
}

export function SecondLifeTaxSummaryView({
  config,
}: SecondLifeTaxSummaryViewProps) {
  return (
    <div className="second-life-tax-summary">
      <div className="second-life-tax-summary-header">
        {config.fiscalYearLabel} 税金試算サマリー
        <span className="second-life-tax-summary-age">
          （{config.memberAge}歳時点）
        </span>
      </div>

      <div className="second-life-tax-summary-body">
        {config.sections.map((section) => (
          <section
            key={section.title}
            className="second-life-tax-summary-section"
            aria-label={section.title}
          >
            <h4 className="second-life-tax-summary-section-title">
              {section.title}
            </h4>
            <table className="second-life-tax-summary-table">
              <tbody>
                {section.rows.map((row) => (
                  <tr
                    key={`${section.title}-${row.label}`}
                    className={
                      row.variant
                        ? `second-life-tax-summary-row--${row.variant}`
                        : undefined
                    }
                  >
                    <th scope="row">{row.label}</th>
                    <td className="second-life-tax-summary-value">{row.value}</td>
                    <td className="second-life-tax-summary-note">
                      {row.note ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}

        {config.notes.length > 0 && (
          <ul className="second-life-tax-summary-notes">
            {config.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
