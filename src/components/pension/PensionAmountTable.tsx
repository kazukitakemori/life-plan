import { sumNullable } from '../../lib/pensionDefaults';
import type { NenkinTeikibinUnder50Form } from '../../types/pension';
import { TeikibinYenInput } from './TeikibinYenInput';

interface PensionAmountTableProps {
  form: NenkinTeikibinUnder50Form;
  onChange: (patch: Partial<NenkinTeikibinUnder50Form>) => void;
}

export function PensionAmountTable({ form, onChange }: PensionAmountTableProps) {
  const total = sumNullable([
    form.oldAgeBasicPensionYen,
    form.oldAgeEmployeesGeneralYen,
    form.oldAgeEmployeesPublicServantYen,
    form.oldAgeEmployeesPrivateSchoolYen,
  ]);

  return (
    <div className="teikibin-block">
      <h5 className="teikibin-block-title">
        (2) これまでの加入実績に応じた年金額
        <span className="pension-help-icon" title="加入実績に応じた年金額について">
          ?
        </span>
      </h5>

      <table className="teikibin-amount-table">
        <tbody>
          <tr>
            <th className="teikibin-amount-corner" />
            <th className="teikibin-amount-col-header">
              加入実績に応じた年金額（年額）
            </th>
          </tr>

          <tr>
            <th className="teikibin-amount-row-label">(1) 国民年金</th>
            <td className="teikibin-amount-split">
              <div className="teikibin-amount-subheader">老齢基礎年金</div>
              <div className="teikibin-amount-input-area">
                <TeikibinYenInput
                  value={form.oldAgeBasicPensionYen}
                  onChange={(value) =>
                    onChange({ oldAgeBasicPensionYen: value })
                  }
                />
              </div>
            </td>
          </tr>

          <tr>
            <th className="teikibin-amount-row-label">(2) 厚生年金保険</th>
            <td className="teikibin-amount-subheader teikibin-amount-subheader--solo">
              老齢厚生年金
            </td>
          </tr>

          <tr>
            <th className="teikibin-amount-row-label">一般厚生年金被保険者期間</th>
            <td className="teikibin-amount-input-area">
              <TeikibinYenInput
                value={form.oldAgeEmployeesGeneralYen}
                onChange={(value) =>
                  onChange({ oldAgeEmployeesGeneralYen: value })
                }
              />
            </td>
          </tr>

          <tr>
            <th className="teikibin-amount-row-label">公務員厚生年金被保険者期間</th>
            <td className="teikibin-amount-input-area">
              <TeikibinYenInput
                value={form.oldAgeEmployeesPublicServantYen}
                onChange={(value) =>
                  onChange({ oldAgeEmployeesPublicServantYen: value })
                }
              />
            </td>
          </tr>

          <tr>
            <th className="teikibin-amount-row-label">私学共済厚生年金被保険者期間</th>
            <td className="teikibin-amount-input-area">
              <TeikibinYenInput
                value={form.oldAgeEmployeesPrivateSchoolYen}
                onChange={(value) =>
                  onChange({ oldAgeEmployeesPrivateSchoolYen: value })
                }
              />
            </td>
          </tr>

          <tr>
            <th className="teikibin-amount-row-label">(1) と (2) の合計</th>
            <td className="teikibin-amount-total">
              <span className="pension-field-calc">{total.toLocaleString()}</span>
              <span className="pension-field-unit">円</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
