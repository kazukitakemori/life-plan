import type { ReactNode } from 'react';

import type {
  BreakdownFormulaRow,
  CalculationBreakdownConfig,
} from '../../types/calculationBreakdown';
import type { TaxBreakdownReferenceDetail } from '../../types/taxBreakdownReference';
import { formatBreakdownRefLabel } from '../../lib/breakdownRefFormat';

interface CalculationBreakdownViewProps {
  config: CalculationBreakdownConfig;
  onOpenReference?: (detail: TaxBreakdownReferenceDetail) => void;
}

function formatYen(yen: number): string {
  return `${yen.toLocaleString('ja-JP')}円`;
}

function ProrationCallout({
  callout,
}: {
  callout: NonNullable<CalculationBreakdownConfig['prorationCallout']>;
}) {
  return (
    <div className="calc-breakdown-income-basis" role="note">
      <p className="calc-breakdown-income-basis-title">
        キャッシュフロー表への按分
      </p>
      <dl className="calc-breakdown-income-basis-grid">
        <div className="calc-breakdown-income-basis-row">
          <dt>{callout.annualAmountLabel}</dt>
          <dd>{formatYen(callout.annualAmountYen)}</dd>
        </div>
        <div className="calc-breakdown-income-basis-row calc-breakdown-income-basis-row--basis">
          <dt>
            {callout.proratedAmountLabel}（{callout.prorationLabel}）
          </dt>
          <dd>{formatYen(callout.proratedAmountYen)}</dd>
        </div>
      </dl>
      <p className="calc-breakdown-income-basis-explanation">
        {callout.explanation}
      </p>
    </div>
  );
}

function formatRef(id: number, refById: Map<number, string>): string {
  return formatBreakdownRefLabel(refById.get(id) ?? id);
}

function FormulaGroupBox({
  title,
  itemIds,
  itemsById,
  valuesById,
  refById,
}: {
  title: string;
  itemIds: number[];
  itemsById: Map<number, string>;
  valuesById: Map<number, string>;
  refById: Map<number, string>;
}) {
  return (
    <div className="calc-breakdown-group">
      <div className="calc-breakdown-group-header">{title}</div>
      <ul className="calc-breakdown-group-list">
        {itemIds.map((id) => (
          <li key={id} className="calc-breakdown-group-item">
            <span className="calc-breakdown-ref">{formatRef(id, refById)}</span>
            <span className="calc-breakdown-group-item-label">
              {itemsById.get(id) ?? ''}
            </span>
            <span className="calc-breakdown-group-item-value">
              {valuesById.get(id) ?? ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FormulaSegment({
  segment,
  itemsById,
  valuesById,
  refById,
}: {
  segment: BreakdownFormulaRow['segments'][number];
  itemsById: Map<number, string>;
  valuesById: Map<number, string>;
  refById: Map<number, string>;
}) {
  if (segment.type === 'group') {
    return (
      <FormulaGroupBox
        title={segment.groupTitle ?? ''}
        itemIds={segment.groupItemIds ?? []}
        itemsById={itemsById}
        valuesById={valuesById}
        refById={refById}
      />
    );
  }

  return (
    <div className="calc-breakdown-box calc-breakdown-box--formula">
      {segment.text}
    </div>
  );
}

function CompoundSumRow({
  row,
}: {
  row: BreakdownFormulaRow;
}) {
  const parts = row.compoundParts ?? [];

  return (
    <div className="calc-breakdown-row calc-breakdown-row--compound">
      {row.rowTitle && (
        <p className="calc-breakdown-row-title">{row.rowTitle}</p>
      )}
      <div className="calc-breakdown-compound">
        {parts.map((part, index) => (
          <div key={index} className="calc-breakdown-compound-part">
            {index > 0 && (
              <span className="calc-breakdown-operator" aria-hidden>
                +
              </span>
            )}
            <div className="calc-breakdown-box calc-breakdown-box--formula">
              {part.text}
              {part.note && (
                <p className="calc-breakdown-compound-note">{part.note}</p>
              )}
            </div>
          </div>
        ))}
        {row.compoundNote && (
          <p className="calc-breakdown-compound-hint">{row.compoundNote}</p>
        )}
      </div>
      <span className="calc-breakdown-operator" aria-hidden>
        =
      </span>
      <div
        className={`calc-breakdown-box calc-breakdown-box--result${
          row.highlight ? ' calc-breakdown-box--highlight' : ''
        }`}
      >
        {row.resultLabel}
      </div>
    </div>
  );
}

function SupplementalRow({
  row,
}: {
  row: BreakdownFormulaRow;
}) {
  return (
    <div className="calc-breakdown-row calc-breakdown-row--supplemental">
      <div className="calc-breakdown-box calc-breakdown-box--result">
        {row.resultLabel}
      </div>
      {row.compoundNote && (
        <p className="calc-breakdown-compound-hint">{row.compoundNote}</p>
      )}
    </div>
  );
}

function FormulaRow({
  row,
  itemsById,
  valuesById,
  refById,
}: {
  row: BreakdownFormulaRow;
  itemsById: Map<number, string>;
  valuesById: Map<number, string>;
  refById: Map<number, string>;
}) {
  if (row.layout === 'supplemental') {
    return <SupplementalRow row={row} />;
  }

  if (row.layout === 'compound-sum') {
    return <CompoundSumRow row={row} />;
  }

  const elements: ReactNode[] = [];

  row.segments.forEach((segment, index) => {
    if (index > 0 && row.operators[index - 1]) {
      elements.push(
        <span
          key={`op-${index}`}
          className="calc-breakdown-operator"
          aria-hidden
        >
          {row.operators[index - 1]}
        </span>,
      );
    }
    elements.push(
      <FormulaSegment
        key={`seg-${index}`}
        segment={segment}
        itemsById={itemsById}
        valuesById={valuesById}
        refById={refById}
      />,
    );
  });

  const resultOperator = row.operators[row.segments.length - 1];
  if (resultOperator) {
    elements.push(
      <span key="result-op" className="calc-breakdown-operator" aria-hidden>
        {resultOperator}
      </span>,
    );
  }

  elements.push(
    <div
      key="result"
      className={`calc-breakdown-box calc-breakdown-box--result${
        row.highlight ? ' calc-breakdown-box--highlight' : ''
      }`}
    >
      {row.resultLabel}
    </div>,
  );

  return <div className="calc-breakdown-row">{elements}</div>;
}

function formatItemRef(item: CalculationBreakdownConfig['items'][number]): string {
  return formatBreakdownRefLabel(item.refId ?? item.id);
}

export function CalculationBreakdownView({
  config,
  onOpenReference,
}: CalculationBreakdownViewProps) {
  const itemsById = new Map(
    config.items.map((item) => [item.id, item.label]),
  );
  const valuesById = new Map(
    config.items.map((item) => [item.id, item.value]),
  );
  const refById = new Map(
    config.items.map((item) => [item.id, item.refId ?? String(item.id)]),
  );

  const variantClass =
    config.headerVariant === 'pension' || config.headerVariant === 'health'
      ? ' calc-breakdown--pension'
      : config.headerVariant === 'resident'
        ? ' calc-breakdown--resident'
        : '';

  return (
    <div className={`calc-breakdown${variantClass}`}>
      <div className="calc-breakdown-header">
        {config.fiscalYearLabel
          ? `${config.fiscalYearLabel} ${config.title}`
          : `計算内訳・${config.title}`}
      </div>

      <div className="calc-breakdown-body">
        {config.prorationCallout && (
          <ProrationCallout callout={config.prorationCallout} />
        )}
        <div className="calc-breakdown-formula">
          {config.rows.map((row, index) => (
            <FormulaRow
              key={index}
              row={row}
              itemsById={itemsById}
              valuesById={valuesById}
              refById={refById}
            />
          ))}
        </div>

        <aside className="calc-breakdown-data" aria-label="計算項目一覧">
          <ol className="calc-breakdown-data-list">
            {config.items.map((item, index) => {
              const prevSection = config.items[index - 1]?.section;
              const showSectionHeader =
                item.section != null && item.section !== prevSection;

              return (
                <li key={item.id} className="calc-breakdown-data-item">
                  {showSectionHeader && (
                    <div className="calc-breakdown-data-section">
                      {item.section}
                    </div>
                  )}
                  <span className="calc-breakdown-data-label">
                    <span className="calc-breakdown-ref">
                      {formatItemRef(item)}
                    </span>
                    {item.label}
                    {item.referenceDetail && onOpenReference && (
                      <button
                        type="button"
                        className="calc-breakdown-data-detail-link"
                        onClick={() => onOpenReference(item.referenceDetail!)}
                      >
                        詳細 ›
                      </button>
                    )}
                  </span>
                  <span className="calc-breakdown-data-value">{item.value}</span>
                </li>
              );
            })}
          </ol>
        </aside>
      </div>

      <div className="calc-breakdown-notes">
        <p className="calc-breakdown-notes-title">注意</p>
        <ul className="calc-breakdown-notes-list">
          {config.notes.map((note, index) => (
            <li key={index}>{note}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
