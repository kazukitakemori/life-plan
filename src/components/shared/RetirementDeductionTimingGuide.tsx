import { useMemo, useState } from 'react';
import type { FamilyMember } from '../../types/family';
import type { IncomeEntry } from '../../types/income';
import type { SavingsEntry } from '../../types/savings';
import {
  buildLiveRetirementTimingScenario,
  type ReceiptCallout,
  type TimingScenario,
} from '../../lib/retirementTimingDiagram';

/** カード幅を軸幅の割合で見たときの衝突しきい値（近いと縦に段分け） */
const RECEIPT_COLLISION_PCT = 32;

function assignReceiptLanes(receipts: ReceiptCallout[]): number[] {
  const lanes: number[] = [];
  for (let i = 0; i < receipts.length; i += 1) {
    const used = new Set<number>();
    for (let j = 0; j < i; j += 1) {
      if (Math.abs(receipts[i].pct - receipts[j].pct) < RECEIPT_COLLISION_PCT) {
        used.add(lanes[j]);
      }
    }
    let lane = 0;
    while (used.has(lane)) lane += 1;
    lanes.push(lane);
  }
  return lanes;
}

function receiptHorizontalStyle(pct: number): {
  left: string;
  transform: string;
} {
  // 端でははみ出さないようアンカーを寄せる
  if (pct <= 18) {
    return { left: `${pct}%`, transform: 'translateX(0)' };
  }
  if (pct >= 82) {
    return { left: `${pct}%`, transform: 'translateX(-100%)' };
  }
  return { left: `${pct}%`, transform: 'translateX(-50%)' };
}

function TimingTimelineDiagram({ scenario }: { scenario: TimingScenario }) {
  const receiptLanes = useMemo(
    () => assignReceiptLanes(scenario.receipts),
    [scenario.receipts],
  );
  const laneCount = Math.max(1, ...receiptLanes.map((n) => n + 1), 1);

  return (
    <div
      className="retirement-timing-diagram"
      data-variant={scenario.id}
      data-live="true"
    >
      <div className="retirement-timing-diagram-head">
        <h4 className="retirement-timing-diagram-title">{scenario.title}</h4>
        {scenario.subtitle ? (
          <p className="retirement-timing-diagram-subtitle">{scenario.subtitle}</p>
        ) : null}
      </div>

      <div className="retirement-timing-diagram-canvas">
        <div
          className="retirement-timing-receipts"
          style={{
            // 1段あたり約56px＋余白。近い受取は段を分けて重ねない
            height: `${laneCount * 56 + 4}px`,
          }}
        >
          {scenario.receipts.map((receipt, index) => {
            const lane = receiptLanes[index] ?? 0;
            const horizontal = receiptHorizontalStyle(receipt.pct);
            return (
              <div
                key={`${receipt.title}-${index}`}
                className={`retirement-timing-receipt retirement-timing-receipt--${receipt.tone}`}
                style={{
                  ...horizontal,
                  bottom: `${lane * 56}px`,
                  zIndex: 2 + lane,
                }}
              >
                <strong>{receipt.title}</strong>
                <span>{receipt.detail}</span>
              </div>
            );
          })}
        </div>

        <div className="retirement-timing-axis">
          <div className="retirement-timing-axis-line" />
          {scenario.axisBreakPcts.map((pct) => (
            <div
              key={`break-${pct}`}
              className="retirement-timing-axis-break"
              style={{ left: `${pct}%` }}
              title="期間の途中を省略（等間隔表示）"
              aria-hidden
            >
              <span />
              <span />
            </div>
          ))}
          {scenario.milestones.map((m) => (
            <div
              key={`age-${m.age}`}
              className="retirement-timing-tick"
              style={{ left: `${m.pct}%` }}
            >
              <span className="retirement-timing-tick-mark" />
              <span className="retirement-timing-tick-date">{m.dateLabel}</span>
              <span className="retirement-timing-tick-age">{m.age}歳</span>
            </div>
          ))}
          {scenario.gaps.map((gap) => (
            <div
              key={`${gap.startPct}-${gap.endPct}-${gap.label}`}
              className="retirement-timing-gap"
              style={{
                left: `${gap.startPct}%`,
                width: `${Math.max(2, gap.endPct - gap.startPct)}%`,
              }}
            >
              <span className="retirement-timing-gap-label">{gap.label}</span>
            </div>
          ))}
        </div>

        <div className="retirement-timing-periods">
          {scenario.periods.map((period, index) => (
            <div
              key={`${period.label}-${index}`}
              className="retirement-timing-period-row"
            >
              <div
                className={`retirement-timing-period-bar retirement-timing-period-bar--${period.tone}`}
                style={{
                  left: `${period.startPct}%`,
                  width: `${Math.max(2, period.endPct - period.startPct)}%`,
                }}
              >
                <span>{period.label}</span>
              </div>
            </div>
          ))}
        </div>

        {scenario.footer ? (
          <p className="retirement-timing-footer">{scenario.footer}</p>
        ) : null}
      </div>
    </div>
  );
}

interface RetirementDeductionTimingGuideProps {
  className?: string;
  member?: FamilyMember;
  incomeEntries?: IncomeEntry[];
  memberEntries?: SavingsEntry[];
  referenceDate?: Date;
  /** 最初から開いた状態にする（貯蓄タブの統合図解向け） */
  defaultOpen?: boolean;
}

/**
 * 退職所得控除の10年／19年ルールを、メンバーの一時金入力を1本のタイムラインで示す。
 */
export function RetirementDeductionTimingGuide({
  className,
  member,
  incomeEntries,
  memberEntries,
  referenceDate,
  defaultOpen = false,
}: RetirementDeductionTimingGuideProps) {
  const [open, setOpen] = useState(defaultOpen);

  const liveScenario = useMemo(() => {
    if (!member || !incomeEntries || !memberEntries || !referenceDate) {
      return null;
    }
    return buildLiveRetirementTimingScenario({
      member,
      incomeEntries,
      memberEntries,
      referenceDate,
    });
  }, [member, incomeEntries, memberEntries, referenceDate]);

  return (
    <div className={`retirement-timing-guide ${className ?? ''}`.trim()}>
      <button
        type="button"
        className="retirement-timing-guide-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>退職一時金の受取タイミング</span>
        <span className="retirement-timing-guide-chevron" aria-hidden>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open ? (
        <div className="retirement-timing-guide-body">
          {liveScenario ? (
            <>
              <TimingTimelineDiagram scenario={liveScenario} />
              <ul className="retirement-timing-guide-tips">
                <li>同じ年にまとめて受け取る（期間の和集合＝最長＋非重複で1本化）</li>
                <li>
                  DC/iDeCo → DB・会社退職金 … 10年ルール（空き10年超でリセット）
                </li>
                <li>
                  DB・会社退職金 → DC/iDeCo … 19年ルール（空き約20年でリセット）
                </li>
                <li>
                  DC/iDeCo → DC/iDeCo … 19年ルール（後受けがDC一時金のため）
                </li>
                <li>どちらかを年金受取にすると、この重複調整の対象外</li>
              </ul>
            </>
          ) : (
            <p className="retirement-timing-guide-lead">
              iDeCo／企業型DC／DB
              の一括受取、または収入タブの退職金を入れると、このメンバーの予定でタイムラインを表示します。
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
