import { useEffect, useState } from 'react';
import {
  calcAcquisitionTaxMan,
  calcBuildingAcquisitionTaxMan,
  calcLandAcquisitionTaxMan,
  DEFAULT_USED_BUILDING_CONSTRUCTION_ERA,
  formatAcquisitionLandAreaDisplay,
  getUsedBuildingConstructionEraLabel,
  resolveAcquisitionAreas,
  resolveAcquisitionTarget,
  resolveDefaultAcquisitionAreas,
  USED_BUILDING_CONSTRUCTION_ERA_OPTIONS,
  type PropertyAcquisitionEntity,
} from '../../lib/housingAcquisitionFees';
import type { OwnedProperty, UsedBuildingConstructionEra } from '../../types/housing';
import { HousingRenewalDateFields } from './HousingRenewalDateFields';

interface AcquisitionTaxDetailModalProps {
  open: boolean;
  property: OwnedProperty;
  referenceYear: number;
  onClose: () => void;
  onConfirm: (patch: {
    isManualArea: true;
    landAreaSqm: number;
    buildingAreaSqm: number;
    usedBuildingConstructionEra: UsedBuildingConstructionEra;
    acquisitionTaxMan: number;
    acquisitionTaxYear: number;
    acquisitionTaxMonth: number;
  }) => void;
}

function fmtTax(man: number): string {
  return `${man.toLocaleString()}万円`;
}

function fmtTaxStep(man: number): string {
  if (Number.isInteger(man)) return `${man.toLocaleString()}万円`;
  return `${man.toLocaleString(undefined, { maximumFractionDigits: 2 })}万円`;
}

export function AcquisitionTaxDetailModal({
  open,
  property,
  referenceYear,
  onClose,
  onConfirm,
}: AcquisitionTaxDetailModalProps) {
  const showBuilding = property.type !== 'land';
  const target = resolveAcquisitionTarget(property.loan);
  const showConstructionEra = showBuilding && !target.isNewConstruction;
  const [landAreaSqm, setLandAreaSqm] = useState(property.landAreaSqm || 130);
  const [buildingAreaSqm, setBuildingAreaSqm] = useState(
    property.buildingAreaSqm || 100,
  );
  const [constructionEra, setConstructionEra] = useState<UsedBuildingConstructionEra>(
    property.usedBuildingConstructionEra ?? DEFAULT_USED_BUILDING_CONSTRUCTION_ERA,
  );
  const [taxYear, setTaxYear] = useState(property.acquisitionTaxYear);
  const [taxMonth, setTaxMonth] = useState(property.acquisitionTaxMonth);

  useEffect(() => {
    if (!open) return;
    if (property.isManualArea) {
      setLandAreaSqm(property.landAreaSqm);
      setBuildingAreaSqm(property.buildingAreaSqm);
    } else {
      const defaults = resolveDefaultAcquisitionAreas(
        property.type,
        property.buildingMan,
        property.landMan,
      );
      setLandAreaSqm(defaults.landAreaSqm);
      setBuildingAreaSqm(defaults.buildingAreaSqm);
    }
    setConstructionEra(
      property.usedBuildingConstructionEra ?? DEFAULT_USED_BUILDING_CONSTRUCTION_ERA,
    );
    setTaxYear(property.acquisitionTaxYear);
    setTaxMonth(property.acquisitionTaxMonth);
  }, [open, property]);

  if (!open) return null;

  const entity: PropertyAcquisitionEntity = {
    propertyType: property.type,
    isNewConstruction: target.isNewConstruction,
    deductionCategory: target.deductionCategory,
    buildingMan: property.buildingMan,
    landMan: property.landMan,
    isManualArea: true,
    landAreaSqm,
    buildingAreaSqm: showBuilding ? buildingAreaSqm : 0,
    usedBuildingConstructionEra: constructionEra,
  };
  const areas = resolveAcquisitionAreas(entity);
  const previewTaxMan = calcAcquisitionTaxMan(
    property.buildingMan,
    property.landMan,
    property.type,
    target,
    areas,
    constructionEra,
  );
  const buildingTax = calcBuildingAcquisitionTaxMan(
    property.buildingMan,
    property.type,
    target,
    constructionEra,
  );
  const hasResidentialBuilding = showBuilding && property.buildingMan > 0;
  const landTax = calcLandAcquisitionTaxMan(
    property.landMan,
    areas.landAreaSqm,
    areas.buildingAreaSqm,
    property.type,
    hasResidentialBuilding,
  );
  const selectedEraOption = USED_BUILDING_CONSTRUCTION_ERA_OPTIONS.find(
    (option) => option.value === constructionEra,
  );
  const qualifyingAreaSqm = Math.min(
    landAreaSqm,
    showBuilding ? buildingAreaSqm * 2 : 0,
    200,
  );
  const showLandReliefBreakdown = property.landMan > 0 && hasResidentialBuilding;

  const handleConfirm = () => {
    onConfirm({
      isManualArea: true,
      landAreaSqm: Math.max(0, landAreaSqm),
      buildingAreaSqm: showBuilding ? Math.max(0, buildingAreaSqm) : 0,
      usedBuildingConstructionEra: constructionEra,
      acquisitionTaxMan: previewTaxMan,
      acquisitionTaxYear: taxYear,
      acquisitionTaxMonth: taxMonth,
    });
    onClose();
  };

  return (
    <div className="education-ref-modal-overlay" onClick={onClose}>
      <div
        className="education-ref-modal housing-acq-ref-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="housing-acq-detail-title"
      >
        <button
          type="button"
          className="education-ref-modal-close"
          onClick={onClose}
          aria-label="閉じる"
        >
          ×
        </button>

        <h3 id="housing-acq-detail-title" className="education-ref-modal-title">
          不動産取得税の詳細計算
        </h3>
        <p className="education-ref-modal-summary">
          土地面積・建物延床面積を入力すると、マイホーム特例（床面積連動減額・最大200㎡）を実数で判定します。
          {showConstructionEra &&
            ' 中古物件では建築時期に応じた建物控除額も反映されます。'}
          確定後はこの条件が試算に使用されます。
        </p>

        <div className="education-ref-modal-body">
          <section className="education-ref-section">
            <h4 className="education-ref-section-title">面積入力</h4>
            <div className="housing-acq-area-fields">
              <label className="housing-acq-area-field">
                <span className="housing-acq-area-label">土地面積（㎡）</span>
                <input
                  type="number"
                  className="text-input text-input--compact"
                  min={0}
                  step={0.01}
                  value={landAreaSqm}
                  onChange={(e) => setLandAreaSqm(Number(e.target.value))}
                />
              </label>
              {showBuilding && (
                <label className="housing-acq-area-field">
                  <span className="housing-acq-area-label">建物延床面積（㎡）</span>
                  <input
                    type="number"
                    className="text-input text-input--compact"
                    min={0}
                    step={0.01}
                    value={buildingAreaSqm}
                    onChange={(e) => setBuildingAreaSqm(Number(e.target.value))}
                  />
                </label>
              )}
            </div>
          </section>

          {showConstructionEra && (
            <section className="education-ref-section">
              <h4 className="education-ref-section-title">建築時期入力</h4>
              <div className="housing-acq-area-fields">
                <label className="housing-acq-area-field">
                  <select
                    className="select-input select-input--compact"
                    value={constructionEra}
                    onChange={(e) =>
                      setConstructionEra(e.target.value as UsedBuildingConstructionEra)
                    }
                    aria-label="建築時期（築年数）"
                  >
                    {USED_BUILDING_CONSTRUCTION_ERA_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}（控除{option.deductionMan.toLocaleString()}万円）
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>
          )}

          <section className="education-ref-section">
            <h4 className="education-ref-section-title">納付時期入力</h4>
            <div className="housing-acq-area-fields">
              <div className="housing-acq-area-field">
                <HousingRenewalDateFields
                  year={taxYear}
                  month={taxMonth}
                  referenceYear={referenceYear}
                  onChange={(acquisitionTaxYear, acquisitionTaxMonth) => {
                    setTaxYear(acquisitionTaxYear);
                    setTaxMonth(acquisitionTaxMonth);
                  }}
                />
              </div>
            </div>
          </section>

          <section className="education-ref-section">
            <h4 className="education-ref-section-title">不動産取得税（プレビュー）</h4>
            <p className="education-ref-section-desc">
              マイホーム特例の対象面積：
              {showBuilding
                ? ` min(土地${landAreaSqm}㎡, 建物${buildingAreaSqm}㎡×2, 200㎡) = ${qualifyingAreaSqm.toFixed(1)}㎡`
                : ' 住宅用建物なし'}
              {showConstructionEra && selectedEraOption && (
                <>
                  <br />
                  中古建物控除：{selectedEraOption.label}（
                  {selectedEraOption.deductionMan.toLocaleString()}万円）
                </>
              )}
            </p>
            <table className="education-ref-kv-table">
              <tbody>
                {property.landMan > 0 && (
                  <tr>
                    <th scope="row">
                      土地（{target.isNewConstruction ? '新築住宅用の特例減額' : '住宅用土地の特例減額'}）
                    </th>
                    <td>{landTax.formula}</td>
                  </tr>
                )}
                {showBuilding && property.buildingMan > 0 && (
                  <tr>
                    <th scope="row">建物（{target.isNewConstruction ? '新築' : '中古'}）</th>
                    <td>{buildingTax.formula}</td>
                  </tr>
                )}
                <tr className="education-ref-row--highlight">
                  <th scope="row">試算金額</th>
                  <td>{fmtTax(previewTaxMan)}</td>
                </tr>
              </tbody>
            </table>

            {showLandReliefBreakdown && (
              <>
                <h4 className="education-ref-section-title housing-acq-subsection-title">
                  土地のマイホーム特例（床面積連動減額）の計算
                </h4>
                <p className="education-ref-section-desc">
                  住宅用建物がある場合、土地の不動産取得税は
                  min(土地面積, 建物延床面積×2, 200㎡) に相当する面積分が減額されます。
                </p>
                <table className="education-ref-kv-table">
                  <tbody>
                    <tr>
                      <th scope="row">固定資産税評価額（目安）</th>
                      <td>
                        {property.landMan.toLocaleString()}万円 × 70% ={' '}
                        {landTax.assessedMan.toLocaleString()}万円
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">1/2特例適用後の課税標準</th>
                      <td>
                        {landTax.assessedMan.toLocaleString()}万円 × 1/2 ={' '}
                        {landTax.taxableAfterAMan.toLocaleString()}万円
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">特例適用前の税額（3%）</th>
                      <td>
                        {landTax.taxableAfterAMan.toLocaleString()}万円 × 3% ={' '}
                        {fmtTaxStep(landTax.taxBeforeReliefMan)}
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">マイホーム特例の対象面積</th>
                      <td>
                        min({landAreaSqm}㎡, {buildingAreaSqm}㎡×2, 200㎡) ={' '}
                        {formatAcquisitionLandAreaDisplay(landTax.qualifyingAreaSqm)}
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">減額率</th>
                      <td>
                        {formatAcquisitionLandAreaDisplay(landTax.qualifyingAreaSqm)} ÷{' '}
                        {formatAcquisitionLandAreaDisplay(landTax.landAreaSqm)} ={' '}
                        {Math.round(landTax.reliefRatio * 100)}%
                      </td>
                    </tr>
                    {landTax.nonQualifyingAreaSqm > 0 && (
                      <tr>
                        <th scope="row">特例の対象外面積</th>
                        <td>
                          {formatAcquisitionLandAreaDisplay(landTax.nonQualifyingAreaSqm)}
                          （この面積分のみ課税）
                        </td>
                      </tr>
                    )}
                    <tr className="education-ref-row--highlight">
                      <th scope="row">特例適用後の土地税</th>
                      <td>
                        {landTax.reliefRatio >= 1 ? (
                          <>
                            {fmtTaxStep(landTax.taxBeforeReliefMan)} × (1 − 100%) = 0万円
                            <br />
                            全土地面積が特例対象のため、土地の不動産取得税は0万円です。
                          </>
                        ) : landTax.reliefRatio <= 0 ? (
                          <>対象面積が0㎡のため減額なし → {fmtTax(landTax.taxMan)}</>
                        ) : (
                          <>
                            {fmtTaxStep(landTax.taxBeforeReliefMan)} × (1 −{' '}
                            {Math.round(landTax.reliefRatio * 100)}%) ={' '}
                            {fmtTaxStep(landTax.taxBeforeReliefMan * (1 - landTax.reliefRatio))}
                            （切り上げ） → {fmtTax(landTax.taxMan)}
                          </>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </>
            )}
          </section>

          <section className="education-ref-section education-ref-sources">
            <h4 className="education-ref-section-title">出典・前提</h4>
            <table className="education-ref-kv-table">
              <tbody>
                <tr>
                  <th scope="row">不動産取得税</th>
                  <td>地方税法 第73条の15 / 租税特別措置法 第73条</td>
                </tr>
                <tr>
                  <th scope="row">建物控除の前提</th>
                  <td>
                    {target.isNewConstruction
                      ? `新築・${buildingTax.deductionMan.toLocaleString()}万円控除（床面積50〜240㎡等の要件あり）`
                      : `中古・${getUsedBuildingConstructionEraLabel(constructionEra)}建築・${buildingTax.deductionMan.toLocaleString()}万円控除`}
                  </td>
                </tr>
                <tr>
                  <th scope="row">土地のマイホーム特例</th>
                  <td>
                    住宅床面積の2倍（最大200㎡）に相当する土地面積分を減額。
                    {landTax.qualifyingAreaSqm > 0 &&
                      ` 今回の対象面積: ${formatAcquisitionLandAreaDisplay(landTax.qualifyingAreaSqm)}`}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <div className="housing-acq-area-actions">
            <button
              type="button"
              className="education-fetch-btn"
              onClick={handleConfirm}
            >
              確定して反映
            </button>
            <button type="button" className="education-fetch-detail-link" onClick={onClose}>
              キャンセル
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
