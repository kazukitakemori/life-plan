import type {
  NenkinTeikibinOver50Form,
  NenkinTeikibinParticipationFields,
  NenkinTeikibinUnder50Form,
} from '../../types/pension';
import { InfoDialog } from '../ui';
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
      <div className="teikibin-form-left">
        <ParticipationPeriodGrid form={form} onChange={updateParticipation} />
        <PensionAmountTable form={form} onChange={updateForm} />
      </div>
      <div className="teikibin-form-right">
        <details className="benefit-survivor-details">
          <summary>
            最近の月別状況 <span className="pension-choice-badge">任意・精度アップ</span>
          </summary>
          <div className="pension-context-info">
            <InfoDialog title="最近の月別状況" label="この入力について">
              <p>
                入力しなくても年金額は概算できます。ねんきん定期便の月別状況を確認したい場合だけ入力してください。
              </p>
            </InfoDialog>
          </div>
          <RecentMonthlyTable form={form} onChange={updateForm} />
        </details>
      </div>
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
      <div className="teikibin-form-left">
        <ParticipationPeriodGrid form={form} onChange={updateParticipation} />
        <PensionAmountTableOver50 form={form} onChange={updateForm} />
      </div>
      <div className="teikibin-form-right">
        <details className="benefit-survivor-details">
          <summary>
            最近の月別状況 <span className="pension-choice-badge">任意・精度アップ</span>
          </summary>
          <div className="pension-context-info">
            <InfoDialog title="最近の月別状況" label="この入力について">
              <p>
                入力しなくても年金額は概算できます。ねんきん定期便の月別状況を転記すると、一部の受給要件判定をより正確にできます。
              </p>
            </InfoDialog>
          </div>
          <RecentMonthlyTableOver50 form={form} onChange={updateForm} />
        </details>
      </div>
    </div>
  );
}
