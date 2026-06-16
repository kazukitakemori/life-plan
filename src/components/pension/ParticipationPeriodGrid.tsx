import { sumNullable } from '../../lib/pensionDefaults';
import type { NenkinTeikibinParticipationFields } from '../../types/pension';
import { MonthInputCell, CalcMonthCell } from './TeikibinFieldCells';

interface ParticipationPeriodGridProps {
  form: NenkinTeikibinParticipationFields;
  onChange: (patch: Partial<NenkinTeikibinParticipationFields>) => void;
}

export function ParticipationPeriodGrid({
  form,
  onChange,
}: ParticipationPeriodGridProps) {
  const nationalTotal = sumNullable([
    form.nationalPensionType1Months,
    form.nationalPensionType3Months,
  ]);
  const employeesTotal = sumNullable([
    form.employeesPensionGeneralMonths,
    form.employeesPensionPublicServantMonths,
    form.employeesPensionPrivateSchoolMonths,
  ]);
  const enrollmentTotal =
    nationalTotal + employeesTotal + (form.seamenInsuranceMonths ?? 0);
  const eligiblePeriod =
    enrollmentTotal + (form.consolidationPeriodMonths ?? 0);

  return (
    <div className="teikibin-block">
      <h5 className="teikibin-block-title">(1) これまでの年金加入期間</h5>

      <table className="teikibin-period-table">
        <tbody>
          <tr>
            <th colSpan={3} className="teikibin-period-table-section">
              国民年金 (a)
            </th>
            <th rowSpan={2} className="teikibin-period-table-side">
              付加保険料
              <br />
              納付済月数
            </th>
            <th rowSpan={2} className="teikibin-period-table-side">
              船員保険 (c)
            </th>
            <th rowSpan={3} className="teikibin-period-table-summary-head">
              年金加入期間 合計
              <br />
              <span className="teikibin-period-table-summary-sub">
                （未納月数を除く）(a + b + c)
              </span>
            </th>
            <th rowSpan={3} className="teikibin-period-table-summary-head">
              合算対象期間等 (d)
            </th>
            <th rowSpan={3} className="teikibin-period-table-summary-head">
              受給資格期間
              <br />
              <span className="teikibin-period-table-summary-sub">
                (a + b + c + d)
              </span>
            </th>
          </tr>

          <tr>
            <th className="teikibin-period-table-sub">
              第1号被保険者（未納月数を除く）
            </th>
            <th className="teikibin-period-table-sub">第3号被保険者</th>
            <th className="teikibin-period-table-sub">
              国民年金 計（未納月数を除く）
            </th>
          </tr>

          <tr>
            <td className="teikibin-period-table-data">
              <MonthInputCell
                value={form.nationalPensionType1Months}
                onChange={(value) =>
                  onChange({ nationalPensionType1Months: value })
                }
              />
            </td>
            <td className="teikibin-period-table-data">
              <MonthInputCell
                value={form.nationalPensionType3Months}
                onChange={(value) =>
                  onChange({ nationalPensionType3Months: value })
                }
              />
            </td>
            <td className="teikibin-period-table-data teikibin-period-table-data--calc">
              <CalcMonthCell value={nationalTotal} />
            </td>
            <td className="teikibin-period-table-data">
              <MonthInputCell
                value={form.additionalPremiumMonths}
                onChange={(value) =>
                  onChange({ additionalPremiumMonths: value })
                }
              />
            </td>
            <td className="teikibin-period-table-data">
              <MonthInputCell
                value={form.seamenInsuranceMonths}
                onChange={(value) =>
                  onChange({ seamenInsuranceMonths: value })
                }
              />
            </td>
          </tr>

          <tr>
            <th colSpan={5} className="teikibin-period-table-section">
              厚生年金保険 (b)
            </th>
            <td rowSpan={3} className="teikibin-period-table-summary-value">
              <CalcMonthCell value={enrollmentTotal} />
            </td>
            <td rowSpan={3} className="teikibin-period-table-summary-value">
              <MonthInputCell
                value={form.consolidationPeriodMonths}
                onChange={(value) =>
                  onChange({ consolidationPeriodMonths: value })
                }
              />
            </td>
            <td
              rowSpan={3}
              className="teikibin-period-table-summary-value teikibin-period-table-summary-value--eligible"
            >
              <CalcMonthCell value={eligiblePeriod} highlight />
            </td>
          </tr>

          <tr>
            <th className="teikibin-period-table-sub">一般厚生年金</th>
            <th className="teikibin-period-table-sub">公務員厚生年金</th>
            <th className="teikibin-period-table-sub">私学共済厚生年金</th>
            <th colSpan={2} className="teikibin-period-table-sub">
              厚生年金保険 計
            </th>
          </tr>

          <tr>
            <td className="teikibin-period-table-data">
              <MonthInputCell
                value={form.employeesPensionGeneralMonths}
                onChange={(value) =>
                  onChange({ employeesPensionGeneralMonths: value })
                }
              />
            </td>
            <td className="teikibin-period-table-data">
              <MonthInputCell
                value={form.employeesPensionPublicServantMonths}
                onChange={(value) =>
                  onChange({ employeesPensionPublicServantMonths: value })
                }
              />
            </td>
            <td className="teikibin-period-table-data">
              <MonthInputCell
                value={form.employeesPensionPrivateSchoolMonths}
                onChange={(value) =>
                  onChange({ employeesPensionPrivateSchoolMonths: value })
                }
              />
            </td>
            <td
              colSpan={2}
              className="teikibin-period-table-data teikibin-period-table-data--calc"
            >
              <CalcMonthCell value={employeesTotal} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
