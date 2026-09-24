import type {
  NenkinTeikibinOver50Form,
  NenkinTeikibinParticipationFields,
  NenkinTeikibinUnder50Form,
} from '../../types/pension';
import { ParticipationPeriodGrid } from './ParticipationPeriodGrid';
import { PensionAmountTable } from './PensionAmountTable';
import { PensionAmountTableOver50 } from './PensionAmountTableOver50';
import { RecentMonthlyTable } from './RecentMonthlyTable';
import { RecentMonthlyTableOver50 } from './RecentMonthlyTableOver50';

interface NenkinTeikibinUnder50FormPanelProps {
  form: NenkinTeikibinUnder50Form;
  onChange: (form: NenkinTeikibinUnder50Form) => void;
}

export function NenkinTeikibinUnder50FormPanel({
  form,
  onChange,
}: NenkinTeikibinUnder50FormPanelProps) {
  const updateParticipation = (patch: Partial<NenkinTeikibinParticipationFields>) => {
    onChange({ ...form, ...patch });
  };

  const updateForm = (patch: Partial<NenkinTeikibinUnder50Form>) => {
    onChange({ ...form, ...patch });
  };

  return (
    <div className="teikibin-form">
      <ParticipationPeriodGrid form={form} onChange={updateParticipation} />
      <PensionAmountTable form={form} onChange={updateForm} />
      <details className="teikibin-monthly-details">
        <summary className="teikibin-monthly-summary">
          <span>最近の月別状況</span>
          <span className="benefit-optional-badge">任意・精度アップ</span>
        </summary>
        <div className="teikibin-monthly-details-body">
          <RecentMonthlyTable form={form} onChange={updateForm} />
        </div>
      </details>
    </div>
  );
}

interface NenkinTeikibinOver50FormPanelProps {
  form: NenkinTeikibinOver50Form;
  onChange: (form: NenkinTeikibinOver50Form) => void;
}

export function NenkinTeikibinOver50FormPanel({
  form,
  onChange,
}: NenkinTeikibinOver50FormPanelProps) {
  const updateParticipation = (patch: Partial<NenkinTeikibinParticipationFields>) => {
    onChange({ ...form, ...patch });
  };

  const updateForm = (patch: Partial<NenkinTeikibinOver50Form>) => {
    onChange({ ...form, ...patch });
  };

  return (
    <div className="teikibin-form">
      <ParticipationPeriodGrid form={form} onChange={updateParticipation} />
      <PensionAmountTableOver50 form={form} onChange={updateForm} />
      <details className="teikibin-monthly-details">
        <summary className="teikibin-monthly-summary">
          <span>最近の月別状況</span>
          <span className="benefit-optional-badge">任意・精度アップ</span>
        </summary>
        <div className="teikibin-monthly-details-body">
          <RecentMonthlyTableOver50 form={form} onChange={updateForm} />
        </div>
      </details>
    </div>
  );
}
