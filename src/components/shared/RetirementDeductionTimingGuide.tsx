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
  /** 最初から開いた状態にする（収入タブの統合図解向け） */
  defaultOpen?: boolean;
}

const RETIREMENT_TIMING_HELP_SECTIONS: ReadonlyArray<{
  title: string;
  body: string;
}> = [
  {
    title: 'この図は何を見ているの？',
    body: '会社の退職金や、iDeCo・企業型DC・DBなどの「一時金（一括でもらうお金）」を、いつ受け取る予定かを並べたものです。受け取る年が近いと、税金の計算で「退職所得控除」がうまく使えないことがあるので、その目安を示しています。',
  },
  {
    title: '同じ年にまとめて受け取る場合',
    body: '同じ年に複数の一時金を受け取ると、税務上はまとめて1回の退職金として扱います。勤続（加入）していた期間も、できるだけ長く・重複しないように足し合わせて控除額を出します。タイミングを揃えたい人向けの考え方です。',
  },
  {
    title: '先に iDeCo／企業型DC、あとで会社退職金・DB（10年ルール）',
    body: '先に個人型・企業型の確定拠出年金（iDeCo／DC）を一時金でもらい、あとから会社の退職金やDB（確定給付）を受け取る場合は、だいたい10年より長く空けると、あとからの退職所得控除がリセットされやすくなります。空きが短いと、前の受取と控除がぶつかり、あとからの控除が減ることがあります。',
  },
  {
    title: '先に会社退職金・DB、あとで iDeCo／企業型DC（19年ルール）',
    body: '先に会社の退職金やDBを受け取り、あとから iDeCo／DC を一時金でもらう場合は、だいたい20年近く空ける必要があるルールです（いわゆる19年ルール）。空きが短いと、あとの一時金で使える控除が削られることがあります。',
  },
  {
    title: 'iDeCo／DC を続けて受け取る場合も19年ルール',
    body: 'あとに受け取るのが iDeCo や企業型DCの一時金のときは、前が同じDC系でも、会社退職金のあと同じく、長めの間隔（19年ルール）が必要になることがあります。',
  },
  {
    title: '年金でもらう場合は対象外',
    body: '一時金ではなく「年金形式」で分割して受け取る場合は、この「受け取りの間隔による控除の調整」の対象になりません。一括でもらうか、年金でもらうかで、税の扱いが変わる点だけ覚えておくと安心です。',
  },
];

function RetirementTimingHelpModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="education-ref-modal-overlay" onClick={onClose}>
      <div
        className="education-ref-modal retirement-timing-help-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-labelledby="retirement-timing-help-title"
      >
        <button
          type="button"
          className="education-ref-modal-close"
          onClick={onClose}
          aria-label="閉じる"
        >
          ×
        </button>
        <h3
          id="retirement-timing-help-title"
          className="education-ref-modal-title"
        >
          退職一時金の受け取り方と税金の目安
        </h3>
        <p className="education-ref-modal-summary">
          退職金や年金の一時金は、受け取る年をずらすと税金が変わることがあります。
        </p>
        <div className="education-ref-modal-body">
          <div className="retirement-timing-help-sections">
            {RETIREMENT_TIMING_HELP_SECTIONS.map((section) => (
              <section
                key={section.title}
                className="retirement-timing-help-section"
              >
                <h4 className="retirement-timing-help-section-title">
                  {section.title}
                </h4>
                <p className="retirement-timing-help-section-body">
                  {section.body}
                </p>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
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
  const [helpOpen, setHelpOpen] = useState(false);

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
              <div className="retirement-timing-guide-toolbar">
                <p className="retirement-timing-guide-lead retirement-timing-guide-lead--inline">
                  入力した退職金・一時金の受け取り予定を一覧にしています。
                </p>
                <button
                  type="button"
                  className="retirement-timing-help-btn"
                  aria-haspopup="dialog"
                  aria-expanded={helpOpen}
                  onClick={() => setHelpOpen(true)}
                >
                  受け取り方と税金の説明
                </button>
              </div>
              <TimingTimelineDiagram scenario={liveScenario} />
            </>
          ) : (
            <p className="retirement-timing-guide-lead">
              iDeCo／企業型DC／DB
              の一括受取、または収入の退職金を入れると、このメンバーの予定でタイムラインを表示します。
            </p>
          )}
        </div>
      ) : null}

      <RetirementTimingHelpModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
      />
    </div>
  );
}
