import { useEffect, useState } from 'react';

import {
  getDefaultPlanPurposes,
  PLAN_PURPOSE_DEFINITIONS,
  togglePlanPurpose,
  type PlanPurposeDefinition,
} from '../../lib/planPurpose';
import {
  getDefaultCreateStatus,
  PLAN_STATUS_OPTIONS,
  type PlanCreateInput,
  type PlanEditInput,
  type PlanMetaInput,
  type PlanPurpose,
  type PlanStatus,
} from '../../types/plan';

interface PlanMetaModalProps {
  open: boolean;
  title: string;
  confirmLabel?: string;
  initial: PlanEditInput;
  showCrmFields?: boolean;
  onClose: () => void;
  onConfirm: (meta: PlanEditInput) => void;
}

interface PlanCreateModalProps {
  open: boolean;
  title: string;
  confirmLabel?: string;
  initial: PlanMetaInput;
  showCrmFields?: boolean;
  onClose: () => void;
  onConfirm: (meta: PlanCreateInput) => void;
}

function PlanPurposeOptions({
  purposes,
  onChange,
}: {
  purposes: PlanPurpose[];
  onChange: (purposes: PlanPurpose[]) => void;
}) {
  return (
    <fieldset className="plan-purpose-fieldset">
      <legend className="plan-meta-label">目的（複数選択可）</legend>
      <p className="plan-purpose-hint">
        教育費・年金などを組み合わせられます。ライフプランを選ぶと他の目的は外れます。
      </p>
      <div
        className="plan-purpose-options"
        role="group"
        aria-label="プランの目的"
      >
        {PLAN_PURPOSE_DEFINITIONS.map((option: PlanPurposeDefinition) => {
          const checked = purposes.includes(option.id);
          return (
            <label
              key={option.id}
              className={`plan-purpose-option${checked ? ' is-selected' : ''}`}
            >
              <input
                type="checkbox"
                className="plan-purpose-checkbox"
                value={option.id}
                checked={checked}
                onChange={() => onChange(togglePlanPurpose(purposes, option.id))}
              />
              <span className="plan-purpose-option-body">
                <span className="plan-purpose-option-label">{option.label}</span>
                <span className="plan-purpose-option-desc">
                  {option.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function PlanMetaFields({
  customerName,
  phone,
  email,
  note,
  status,
  showCrmFields,
  showStatusField,
  onCustomerNameChange,
  onPhoneChange,
  onEmailChange,
  onNoteChange,
  onStatusChange,
  nameInputId,
  autoFocus,
}: {
  customerName: string;
  phone: string;
  email: string;
  note: string;
  status: PlanStatus;
  showCrmFields: boolean;
  showStatusField: boolean;
  onCustomerNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onStatusChange: (value: PlanStatus) => void;
  nameInputId: string;
  autoFocus?: boolean;
}) {
  return (
    <>
      <label className="plan-meta-label" htmlFor={nameInputId}>
        お名前
      </label>
      <input
        id={nameInputId}
        type="text"
        className="plan-meta-input"
        value={customerName}
        onChange={(e) => onCustomerNameChange(e.target.value)}
        placeholder="山田 太郎"
        autoFocus={autoFocus}
      />

      {showCrmFields ? (
        <>
          <label className="plan-meta-label" htmlFor={`${nameInputId}-phone`}>
            電話番号
          </label>
          <input
            id={`${nameInputId}-phone`}
            type="tel"
            className="plan-meta-input"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder="090-1234-5678"
          />

          <label className="plan-meta-label" htmlFor={`${nameInputId}-email`}>
            メールアドレス
          </label>
          <input
            id={`${nameInputId}-email`}
            type="email"
            className="plan-meta-input"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="example@example.com"
          />
        </>
      ) : null}

      {showStatusField ? (
        <>
          <label className="plan-meta-label" htmlFor={`${nameInputId}-status`}>
            ステータス
          </label>
          <select
            id={`${nameInputId}-status`}
            className="plan-meta-input"
            value={status}
            onChange={(e) => onStatusChange(e.target.value as PlanStatus)}
          >
            {PLAN_STATUS_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </>
      ) : null}

      <label className="plan-meta-label" htmlFor={`${nameInputId}-note`}>
        メモ
      </label>
      <textarea
        id={`${nameInputId}-note`}
        className="plan-meta-textarea"
        rows={3}
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder={showCrmFields ? '面談メモなど' : '自由記入'}
      />
    </>
  );
}

export function PlanCreateModal({
  open,
  title,
  confirmLabel = '作成して開く',
  initial,
  showCrmFields = false,
  onClose,
  onConfirm,
}: PlanCreateModalProps) {
  const [customerName, setCustomerName] = useState(initial.customerName);
  const [phone, setPhone] = useState(initial.phone);
  const [email, setEmail] = useState(initial.email);
  const [note, setNote] = useState(initial.note);
  const [purposes, setPurposes] = useState<PlanPurpose[]>(
    getDefaultPlanPurposes(),
  );

  useEffect(() => {
    if (!open) return;
    setCustomerName(initial.customerName);
    setPhone(initial.phone);
    setEmail(initial.email);
    setNote(initial.note);
    setPurposes(getDefaultPlanPurposes());
  }, [
    open,
    initial.customerName,
    initial.phone,
    initial.email,
    initial.note,
  ]);

  if (!open) return null;

  const trimmed = customerName.trim();
  const canSubmit = Boolean(trimmed) && purposes.length > 0;

  return (
    <div className="education-ref-modal-overlay" onClick={onClose}>
      <div
        className="education-ref-modal plan-meta-modal plan-meta-modal--create"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-meta-modal-title"
      >
        <button
          type="button"
          className="education-ref-modal-close"
          onClick={onClose}
          aria-label="閉じる"
        >
          ×
        </button>
        <h3 id="plan-meta-modal-title" className="education-ref-modal-title">
          {title}
        </h3>
        <p className="education-ref-modal-summary">
          目的とお名前を入力します。ステータスは「入力中」で作成されます。
        </p>
        <div className="education-ref-modal-body">
          <PlanPurposeOptions purposes={purposes} onChange={setPurposes} />

          <PlanMetaFields
            customerName={customerName}
            phone={phone}
            email={email}
            note={note}
            status={getDefaultCreateStatus()}
            showCrmFields={showCrmFields}
            showStatusField={false}
            onCustomerNameChange={setCustomerName}
            onPhoneChange={setPhone}
            onEmailChange={setEmail}
            onNoteChange={setNote}
            onStatusChange={() => undefined}
            nameInputId="plan-meta-name"
            autoFocus
          />

          <div className="plan-save-as-actions">
            <button type="button" className="plan-bar-btn" onClick={onClose}>
              キャンセル
            </button>
            <button
              type="button"
              className="plan-bar-btn plan-bar-btn--primary"
              disabled={!canSubmit}
              onClick={() =>
                onConfirm({
                  customerName: trimmed,
                  phone: showCrmFields ? phone.trim() : '',
                  email: showCrmFields ? email.trim() : '',
                  note: note.trim(),
                  status: getDefaultCreateStatus(),
                  purposes,
                })
              }
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlanMetaModal({
  open,
  title,
  confirmLabel = '保存',
  initial,
  showCrmFields = false,
  onClose,
  onConfirm,
}: PlanMetaModalProps) {
  const [customerName, setCustomerName] = useState(initial.customerName);
  const [phone, setPhone] = useState(initial.phone);
  const [email, setEmail] = useState(initial.email);
  const [note, setNote] = useState(initial.note);
  const [status, setStatus] = useState<PlanStatus>(initial.status);
  const [purposes, setPurposes] = useState<PlanPurpose[]>(initial.purposes);

  useEffect(() => {
    if (!open) return;
    setCustomerName(initial.customerName);
    setPhone(initial.phone);
    setEmail(initial.email);
    setNote(initial.note);
    setStatus(initial.status);
    setPurposes(initial.purposes);
  }, [
    open,
    initial.customerName,
    initial.phone,
    initial.email,
    initial.note,
    initial.status,
    initial.purposes,
  ]);

  if (!open) return null;

  const trimmed = customerName.trim();
  const canSubmit = Boolean(trimmed) && purposes.length > 0;
  const summaryText = showCrmFields
    ? '目的・お名前・連絡先・ステータス・メモを編集します。目的を変更すると入力可能な項目が変わります。'
    : '目的・お名前・メモを編集します。目的を変更すると入力可能な項目が変わります。';

  return (
    <div className="education-ref-modal-overlay" onClick={onClose}>
      <div
        className="education-ref-modal plan-meta-modal plan-meta-modal--create"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-meta-modal-title"
      >
        <button
          type="button"
          className="education-ref-modal-close"
          onClick={onClose}
          aria-label="閉じる"
        >
          ×
        </button>
        <h3 id="plan-meta-modal-title" className="education-ref-modal-title">
          {title}
        </h3>
        <p className="education-ref-modal-summary">{summaryText}</p>
        <div className="education-ref-modal-body">
          <PlanPurposeOptions purposes={purposes} onChange={setPurposes} />

          <PlanMetaFields
            customerName={customerName}
            phone={phone}
            email={email}
            note={note}
            status={status}
            showCrmFields={showCrmFields}
            showStatusField={showCrmFields}
            onCustomerNameChange={setCustomerName}
            onPhoneChange={setPhone}
            onEmailChange={setEmail}
            onNoteChange={setNote}
            onStatusChange={setStatus}
            nameInputId="plan-meta-edit"
            autoFocus
          />

          <div className="plan-save-as-actions">
            <button type="button" className="plan-bar-btn" onClick={onClose}>
              キャンセル
            </button>
            <button
              type="button"
              className="plan-bar-btn plan-bar-btn--primary"
              disabled={!canSubmit}
              onClick={() =>
                onConfirm({
                  customerName: trimmed,
                  phone: showCrmFields ? phone.trim() : initial.phone,
                  email: showCrmFields ? email.trim() : initial.email,
                  note: note.trim(),
                  status,
                  purposes,
                })
              }
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
