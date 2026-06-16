import type { EducationReferenceDetail } from '../../types/education';

interface EducationReferenceDetailModalProps {
  open: boolean;
  detail: EducationReferenceDetail | null;
  onClose: () => void;
}

export function EducationReferenceDetailModal({
  open,
  detail,
  onClose,
}: EducationReferenceDetailModalProps) {
  if (!open || !detail) return null;

  return (
    <div className="education-ref-modal-overlay" onClick={onClose}>
      <div
        className="education-ref-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="education-ref-modal-title"
      >
        <button
          type="button"
          className="education-ref-modal-close"
          onClick={onClose}
          aria-label="閉じる"
        >
          ×
        </button>

        <h3 id="education-ref-modal-title" className="education-ref-modal-title">
          {detail.title}
        </h3>
        <p className="education-ref-modal-summary">{detail.summary}</p>

        <div className="education-ref-modal-body">
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
    </div>
  );
}
