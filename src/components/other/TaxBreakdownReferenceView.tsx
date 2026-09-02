import type { TaxBreakdownReferenceDetail } from '../../types/taxBreakdownReference';

interface TaxBreakdownReferenceViewProps {
  detail: TaxBreakdownReferenceDetail;
  onBack: () => void;
}

export function TaxBreakdownReferenceView({
  detail,
  onBack,
}: TaxBreakdownReferenceViewProps) {
  return (
    <div className="tax-breakdown-reference">
      <div className="tax-breakdown-reference-toolbar">
        <button
          type="button"
          className="tax-breakdown-reference-back"
          onClick={onBack}
        >
          ← 計算内訳に戻る
        </button>
      </div>

      <p className="tax-breakdown-reference-summary">{detail.summary}</p>

      <div className="tax-breakdown-reference-body">
        {detail.sections.map((section) => (
          <section key={section.title} className="education-ref-section">
            <h4 className="education-ref-section-title">{section.title}</h4>
            {section.description && (
              <p className="education-ref-section-desc">{section.description}</p>
            )}

            {section.keyValues && section.keyValues.length > 0 && (
              <table className="education-ref-kv-table">
                <tbody>
                  {section.keyValues.map((row) => (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      <td>{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {section.table && (
              <div className="education-ref-table-wrap">
                {section.table.caption && (
                  <p className="education-ref-table-caption">
                    {section.table.caption}
                  </p>
                )}
                <table className="education-ref-data-table">
                  <thead>
                    <tr>
                      {section.table.columns.map((col) => (
                        <th key={col} scope="col">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.table.rows.map((row, index) => (
                      <tr
                        key={`${row.cells.join('-')}-${index}`}
                        className={
                          row.highlight ? 'education-ref-row--highlight' : undefined
                        }
                      >
                        {row.cells.map((cell, cellIndex) => (
                          <td key={cellIndex}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}

        {detail.sources.length > 0 && (
          <section className="education-ref-section education-ref-sources">
            <h4 className="education-ref-section-title">出典・根拠</h4>
            <table className="education-ref-kv-table">
              <tbody>
                {detail.sources.map((source) => (
                  <tr key={source.label}>
                    <th scope="row">{source.label}</th>
                    <td>{source.detail ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </div>
  );
}
