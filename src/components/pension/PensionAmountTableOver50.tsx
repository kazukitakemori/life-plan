import { sumNullable } from '../../lib/pensionDefaults';
import type {
  NenkinTeikibinOver50Form,
  TeikibinOver50AmountPair,
  TeikibinOver50AmountTriple,
  TeikibinOver50OldAgePair,
  TeikibinOver50OldAgeTriple,
} from '../../types/pension';
import { TeikibinYenInput } from './TeikibinYenInput';

interface PensionAmountTableOver50Props {
  form: NenkinTeikibinOver50Form;
  onChange: (patch: Partial<NenkinTeikibinOver50Form>) => void;
}

function sumPair(pair: TeikibinOver50AmountPair): number {
  return sumNullable([pair.proportional, pair.fixed]);
}

function sumTriple(triple: TeikibinOver50AmountTriple): number {
  return sumNullable([
    triple.proportional,
    triple.fixed,
    triple.transitionalOccupational,
  ]);
}

function sumOldAgePair(pair: TeikibinOver50OldAgePair): number {
  return sumNullable([pair.proportional, pair.transitionalAddition]);
}

function sumOldAgeTriple(triple: TeikibinOver50OldAgeTriple): number {
  return sumNullable([
    triple.proportional,
    triple.transitionalAddition,
    triple.transitionalOccupational,
  ]);
}

function PairFields({
  value,
  onChange,
}: {
  value: TeikibinOver50AmountPair;
  onChange: (value: TeikibinOver50AmountPair) => void;
}) {
  return (
    <div className="teikibin-amount-field-stack">
      <div className="teikibin-amount-field-item">
        <span className="teikibin-amount-field-label">（報酬比例部分）</span>
        <TeikibinYenInput
          compact
          value={value.proportional}
          onChange={(proportional) => onChange({ ...value, proportional })}
        />
      </div>
      <div className="teikibin-amount-field-item">
        <span className="teikibin-amount-field-label">（定額部分）</span>
        <TeikibinYenInput
          compact
          value={value.fixed}
          onChange={(fixed) => onChange({ ...value, fixed })}
        />
      </div>
    </div>
  );
}

function TripleFields({
  value,
  onChange,
}: {
  value: TeikibinOver50AmountTriple;
  onChange: (value: TeikibinOver50AmountTriple) => void;
}) {
  return (
    <div className="teikibin-amount-field-stack">
      <div className="teikibin-amount-field-item">
        <span className="teikibin-amount-field-label">（報酬比例部分）</span>
        <TeikibinYenInput
          compact
          value={value.proportional}
          onChange={(proportional) => onChange({ ...value, proportional })}
        />
      </div>
      <div className="teikibin-amount-field-item">
        <span className="teikibin-amount-field-label">（定額部分）</span>
        <TeikibinYenInput
          compact
          value={value.fixed}
          onChange={(fixed) => onChange({ ...value, fixed })}
        />
      </div>
      <div className="teikibin-amount-field-item">
        <span className="teikibin-amount-field-label">（経過的職域加算）</span>
        <TeikibinYenInput
          compact
          value={value.transitionalOccupational}
          onChange={(transitionalOccupational) =>
            onChange({ ...value, transitionalOccupational })
          }
        />
      </div>
    </div>
  );
}

function OldAgePairFields({
  value,
  onChange,
}: {
  value: TeikibinOver50OldAgePair;
  onChange: (value: TeikibinOver50OldAgePair) => void;
}) {
  return (
    <div className="teikibin-amount-field-stack">
      <div className="teikibin-amount-field-item">
        <span className="teikibin-amount-field-label">（報酬比例部分）</span>
        <TeikibinYenInput
          compact
          value={value.proportional}
          onChange={(proportional) => onChange({ ...value, proportional })}
        />
      </div>
      <div className="teikibin-amount-field-item">
        <span className="teikibin-amount-field-label">（経過的加算部分）</span>
        <TeikibinYenInput
          compact
          value={value.transitionalAddition}
          onChange={(transitionalAddition) =>
            onChange({ ...value, transitionalAddition })
          }
        />
      </div>
    </div>
  );
}

function OldAgeTripleFields({
  value,
  onChange,
}: {
  value: TeikibinOver50OldAgeTriple;
  onChange: (value: TeikibinOver50OldAgeTriple) => void;
}) {
  return (
    <div className="teikibin-amount-field-stack">
      <div className="teikibin-amount-field-item">
        <span className="teikibin-amount-field-label">（報酬比例部分）</span>
        <TeikibinYenInput
          compact
          value={value.proportional}
          onChange={(proportional) => onChange({ ...value, proportional })}
        />
      </div>
      <div className="teikibin-amount-field-item">
        <span className="teikibin-amount-field-label">（経過的加算部分）</span>
        <TeikibinYenInput
          compact
          value={value.transitionalAddition}
          onChange={(transitionalAddition) =>
            onChange({ ...value, transitionalAddition })
          }
        />
      </div>
      <div className="teikibin-amount-field-item">
        <span className="teikibin-amount-field-label">（経過的職域加算）</span>
        <TeikibinYenInput
          compact
          value={value.transitionalOccupational}
          onChange={(transitionalOccupational) =>
            onChange({ ...value, transitionalOccupational })
          }
        />
      </div>
    </div>
  );
}

function TotalCell({
  value,
  primary = false,
}: {
  value: number;
  primary?: boolean;
}) {
  return (
    <td
      className={`teikibin-amount-total-cell${primary ? ' teikibin-amount-total-cell--primary' : ''}`}
    >
      <span className="pension-field-calc">{value.toLocaleString()}</span>
      <span className="pension-field-unit">円</span>
    </td>
  );
}

export function PensionAmountTableOver50({
  form,
  onChange,
}: PensionAmountTableOver50Props) {
  const totalCol2 =
    sumTriple(form.publicServant.specialCol2) +
    sumTriple(form.privateSchool.specialCol2);
  const totalCol3 =
    sumPair(form.general.specialCol3) +
    sumTriple(form.publicServant.specialCol3) +
    sumTriple(form.privateSchool.specialCol3);
  const totalCol4 =
    sumPair(form.general.specialCol4) +
    sumTriple(form.publicServant.specialCol4) +
    sumTriple(form.privateSchool.specialCol4);
  const totalCol5 =
    (form.basicPension65 ?? 0) +
    sumOldAgePair(form.general.oldAge65) +
    sumOldAgeTriple(form.publicServant.oldAge65) +
    sumOldAgeTriple(form.privateSchool.oldAge65);

  const updateGeneral = (
    patch: Partial<NenkinTeikibinOver50Form['general']>,
  ) => {
    onChange({ general: { ...form.general, ...patch } });
  };

  const updatePublicServant = (
    patch: Partial<NenkinTeikibinOver50Form['publicServant']>,
  ) => {
    onChange({ publicServant: { ...form.publicServant, ...patch } });
  };

  const updatePrivateSchool = (
    patch: Partial<NenkinTeikibinOver50Form['privateSchool']>,
  ) => {
    onChange({ privateSchool: { ...form.privateSchool, ...patch } });
  };

  return (
    <div className="teikibin-block">
      <h5 className="teikibin-block-title">
        (2) 老齢年金の種類と見込額（年額）
        <span className="pension-help-icon" title="老齢年金の種類と見込額について">
          ?
        </span>
      </h5>

      <table className="teikibin-amount-table teikibin-amount-table--over50">
        <tbody>
          <tr>
            <th className="teikibin-amount-row-label">受給開始年齢</th>
            <th className="teikibin-amount-empty" />
            <th className="teikibin-amount-empty" />
            <th className="teikibin-amount-empty" />
            <th className="teikibin-amount-col-header">65歳～</th>
          </tr>

          <tr>
            <th className="teikibin-amount-row-label">(1) 基礎年金</th>
            <td className="teikibin-amount-empty" />
            <td className="teikibin-amount-empty" />
            <td className="teikibin-amount-empty" />
            <td className="teikibin-amount-split">
              <div className="teikibin-amount-subheader">老齢基礎年金</div>
              <div className="teikibin-amount-input-area">
                <TeikibinYenInput
                  compact
                  value={form.basicPension65}
                  onChange={(basicPension65) => onChange({ basicPension65 })}
                />
              </div>
            </td>
          </tr>

          <tr>
            <th className="teikibin-amount-row-label">(2) 厚生年金</th>
            <th className="teikibin-amount-col-header" colSpan={3}>
              特別支給の老齢厚生年金
            </th>
            <th className="teikibin-amount-col-header">老齢厚生年金</th>
          </tr>

          <tr>
            <th className="teikibin-amount-row-label">一般厚生年金期間</th>
            <td className="teikibin-amount-empty" />
            <td className="teikibin-amount-input-area">
              <PairFields
                value={form.general.specialCol3}
                onChange={(specialCol3) => updateGeneral({ specialCol3 })}
              />
            </td>
            <td className="teikibin-amount-input-area">
              <PairFields
                value={form.general.specialCol4}
                onChange={(specialCol4) => updateGeneral({ specialCol4 })}
              />
            </td>
            <td className="teikibin-amount-input-area">
              <OldAgePairFields
                value={form.general.oldAge65}
                onChange={(oldAge65) => updateGeneral({ oldAge65 })}
              />
            </td>
          </tr>

          <tr>
            <th className="teikibin-amount-row-label">公務員厚生年金期間</th>
            <td className="teikibin-amount-input-area">
              <TripleFields
                value={form.publicServant.specialCol2}
                onChange={(specialCol2) => updatePublicServant({ specialCol2 })}
              />
            </td>
            <td className="teikibin-amount-input-area">
              <TripleFields
                value={form.publicServant.specialCol3}
                onChange={(specialCol3) => updatePublicServant({ specialCol3 })}
              />
            </td>
            <td className="teikibin-amount-input-area">
              <TripleFields
                value={form.publicServant.specialCol4}
                onChange={(specialCol4) => updatePublicServant({ specialCol4 })}
              />
            </td>
            <td className="teikibin-amount-input-area">
              <OldAgeTripleFields
                value={form.publicServant.oldAge65}
                onChange={(oldAge65) => updatePublicServant({ oldAge65 })}
              />
            </td>
          </tr>

          <tr>
            <th className="teikibin-amount-row-label">私学共済厚生年金期間</th>
            <td className="teikibin-amount-input-area">
              <TripleFields
                value={form.privateSchool.specialCol2}
                onChange={(specialCol2) => updatePrivateSchool({ specialCol2 })}
              />
            </td>
            <td className="teikibin-amount-input-area">
              <TripleFields
                value={form.privateSchool.specialCol3}
                onChange={(specialCol3) => updatePrivateSchool({ specialCol3 })}
              />
            </td>
            <td className="teikibin-amount-input-area">
              <TripleFields
                value={form.privateSchool.specialCol4}
                onChange={(specialCol4) => updatePrivateSchool({ specialCol4 })}
              />
            </td>
            <td className="teikibin-amount-input-area">
              <OldAgeTripleFields
                value={form.privateSchool.oldAge65}
                onChange={(oldAge65) => updatePrivateSchool({ oldAge65 })}
              />
            </td>
          </tr>

          <tr>
            <th className="teikibin-amount-row-label">(1) と (2) の合計</th>
            <TotalCell value={totalCol2} />
            <TotalCell value={totalCol3} />
            <TotalCell value={totalCol4} />
            <TotalCell value={totalCol5} primary />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
