import { useEffect, useState } from 'react';



import type { CashFlowTableData } from '../../types/cashFlow';

import type { FamilyMember } from '../../types/family';

import type { IncomeByMember, PriorYearIncomeByMember } from '../../types/income';

import type { PensionByMember } from '../../types/pension';

import type { TaxBreakdownReferenceDetail } from '../../types/taxBreakdownReference';

import { OtherTaxSocialBreakdown } from './OtherTaxSocialBreakdown';

import { TaxBreakdownReferenceView } from './TaxBreakdownReferenceView';



export interface TaxSocialBreakdownModalProps {

  open: boolean;

  calendarYear: number | null;

  initialMemberId?: string;

  onClose: () => void;

  members: FamilyMember[];

  incomeByMember: IncomeByMember;

  priorYearIncomeByMember: PriorYearIncomeByMember;

  pensionByMember: PensionByMember;

  referenceDate: Date;

  cashFlowData: CashFlowTableData;

}



/**

 * 税・社保の計算内訳モーダル。

 * 詳細ドリルダウン（給与所得控除の表参照など）は別モーダルを重ねず、

 * このモーダル内で画面を切り替える。

 */

export function TaxSocialBreakdownModal({

  open,

  calendarYear,

  initialMemberId,

  onClose,

  members,

  incomeByMember,

  priorYearIncomeByMember,

  pensionByMember,

  referenceDate,

  cashFlowData,

}: TaxSocialBreakdownModalProps) {

  const [referenceDetail, setReferenceDetail] =

    useState<TaxBreakdownReferenceDetail | null>(null);



  useEffect(() => {

    if (!open) {

      setReferenceDetail(null);

    }

  }, [open, calendarYear, initialMemberId]);



  useEffect(() => {

    if (!open) {

      return;

    }



    const handleKeyDown = (event: KeyboardEvent) => {

      if (event.key === 'Escape') {

        if (referenceDetail) {

          setReferenceDetail(null);

        } else {

          onClose();

        }

      }

    };



    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);

  }, [open, onClose, referenceDetail]);



  if (!open || calendarYear == null) {

    return null;

  }



  return (

    <div

      className="tax-social-breakdown-modal-overlay"

      onClick={onClose}

      role="presentation"

    >

      <div

        className="tax-social-breakdown-modal"

        onClick={(event) => event.stopPropagation()}

        role="dialog"

        aria-modal="true"

        aria-labelledby="tax-social-breakdown-modal-title"

      >

        <button

          type="button"

          className="tax-social-breakdown-modal-close"

          onClick={onClose}

          aria-label="閉じる"

        >

          ×

        </button>



        <h2

          id="tax-social-breakdown-modal-title"

          className="tax-social-breakdown-modal-title"

        >

          {referenceDetail ? referenceDetail.title : '税・社保の計算内訳'}

        </h2>



        <div className="tax-social-breakdown-modal-body">

          {referenceDetail ? (

            <TaxBreakdownReferenceView

              detail={referenceDetail}

              onBack={() => setReferenceDetail(null)}

            />

          ) : (

            <OtherTaxSocialBreakdown

              members={members}

              incomeByMember={incomeByMember}

              priorYearIncomeByMember={priorYearIncomeByMember}

              pensionByMember={pensionByMember}

              referenceDate={referenceDate}

              cashFlowData={cashFlowData}

              calendarYear={calendarYear}

              initialMemberId={initialMemberId}

              onOpenReference={setReferenceDetail}

            />

          )}

        </div>

      </div>

    </div>

  );

}

