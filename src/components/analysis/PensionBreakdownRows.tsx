import type { ReactNode } from 'react';

import type { CashFlowTableData } from '../../types/cashFlow';
import {
  DISABILITY_BASIC_DETAIL_ROWS,
  DISABILITY_EMPLOYEES_DETAIL_ROWS,
  DISABILITY_PENSION_CATEGORY_ROWS,
  GENERAL_EMPLOYEES_DETAIL_ROWS,
  OLD_AGE_BASIC_DETAIL_ROWS,
  OLD_AGE_PENSION_CATEGORY_ROWS,
  PUBLIC_SERVANT_DETAIL_ROWS,
  SURVIVOR_BASIC_DETAIL_ROWS,
  SURVIVOR_EMPLOYEES_DETAIL_ROWS,
  SURVIVOR_PENSION_CATEGORY_ROWS,
  sumDisabilityBasicDetail,
  sumDisabilityEmployeesDetail,
  sumDisabilityPension,
  sumGeneralEmployeesDetail,
  sumOldAgeBasicDetail,
  sumOldAgePension,
  sumPensionBreakdown,
  sumPublicServantDetail,
  sumSurvivorBasicDetail,
  sumSurvivorEmployeesDetail,
  sumSurvivorPension,
  type DisabilityPensionBreakdown,
  type OldAgePensionBreakdown,
  type PensionBreakdown,
  type SurvivorPensionBreakdown,
} from '../../types/cashFlow';

type YearRow = CashFlowTableData['years'][number];

interface PensionBreakdownRowsProps {
  visibleYears: YearRow[];
  expandedFolders: Set<string>;
  onToggleFolder: (key: string) => void;
  renderLabelCell: (
    label: string,
    indent: number,
    options?: {
      folder?: boolean;
      expanded?: boolean;
      onToggle?: () => void;
      icon?: 'folder' | 'leaf';
    },
  ) => ReactNode;
  renderValueCell: (
    value: number,
    year: number,
    options?: { emptyAsDash?: boolean },
  ) => ReactNode;
}

const OLD_AGE_CATEGORY_DETAIL_ROWS: Record<
  keyof OldAgePensionBreakdown,
  { key: string; label: string }[]
> = {
  basic: OLD_AGE_BASIC_DETAIL_ROWS,
  generalEmployees: GENERAL_EMPLOYEES_DETAIL_ROWS,
  publicServant: PUBLIC_SERVANT_DETAIL_ROWS,
};

const OLD_AGE_CATEGORY_SUMMERS: Record<
  keyof OldAgePensionBreakdown,
  (detail: OldAgePensionBreakdown) => number
> = {
  basic: (detail) => sumOldAgeBasicDetail(detail.basic),
  generalEmployees: (detail) => sumGeneralEmployeesDetail(detail.generalEmployees),
  publicServant: (detail) => sumPublicServantDetail(detail.publicServant),
};

const DISABILITY_CATEGORY_DETAIL_ROWS: Record<
  keyof DisabilityPensionBreakdown,
  { key: string; label: string }[]
> = {
  basic: DISABILITY_BASIC_DETAIL_ROWS,
  employees: DISABILITY_EMPLOYEES_DETAIL_ROWS,
};

const DISABILITY_CATEGORY_SUMMERS: Record<
  keyof DisabilityPensionBreakdown,
  (detail: DisabilityPensionBreakdown) => number
> = {
  basic: (detail) => sumDisabilityBasicDetail(detail.basic),
  employees: (detail) => sumDisabilityEmployeesDetail(detail.employees),
};

const SURVIVOR_CATEGORY_DETAIL_ROWS: Record<
  keyof SurvivorPensionBreakdown,
  { key: string; label: string }[]
> = {
  basic: SURVIVOR_BASIC_DETAIL_ROWS,
  employees: SURVIVOR_EMPLOYEES_DETAIL_ROWS,
};

const SURVIVOR_CATEGORY_SUMMERS: Record<
  keyof SurvivorPensionBreakdown,
  (detail: SurvivorPensionBreakdown) => number
> = {
  basic: (detail) => sumSurvivorBasicDetail(detail.basic),
  employees: (detail) => sumSurvivorEmployeesDetail(detail.employees),
};

function getOldAgeDetailValue(
  pension: PensionBreakdown,
  category: keyof OldAgePensionBreakdown,
  key: string,
): number {
  const detail = pension.oldAge[category] as unknown as Record<string, number>;
  return detail[key] ?? 0;
}

function getDisabilityDetailValue(
  pension: PensionBreakdown,
  category: keyof DisabilityPensionBreakdown,
  key: string,
): number {
  const detail = pension.disability[category] as unknown as Record<string, number>;
  return detail[key] ?? 0;
}

function getSurvivorDetailValue(
  pension: PensionBreakdown,
  category: keyof SurvivorPensionBreakdown,
  key: string,
): number {
  const detail = pension.survivor[category] as unknown as Record<string, number>;
  return detail[key] ?? 0;
}

export function PensionBreakdownRows({
  visibleYears,
  expandedFolders,
  onToggleFolder,
  renderLabelCell,
  renderValueCell,
}: PensionBreakdownRowsProps) {
  const isExpanded = (key: string) => expandedFolders.has(key);

  return (
    <>
      <tr className="cf-row-income cf-row-income-subtotal">
        {renderLabelCell('年金', 2, {
          folder: true,
          expanded: isExpanded('pension'),
          onToggle: () => onToggleFolder('pension'),
          icon: 'folder',
        })}
        {visibleYears.map((y) =>
          renderValueCell(
            sumPensionBreakdown(y.incomeBreakdown.pension),
            y.calendarYear,
            { emptyAsDash: true },
          ),
        )}
      </tr>

      {isExpanded('pension') && (
        <>
          <tr className="cf-row-income-detail">
            {renderLabelCell('老齢年金', 3, {
              folder: true,
              expanded: isExpanded('oldAge'),
              onToggle: () => onToggleFolder('oldAge'),
              icon: 'folder',
            })}
            {visibleYears.map((y) =>
              renderValueCell(
                sumOldAgePension(y.incomeBreakdown.pension.oldAge),
                y.calendarYear,
                { emptyAsDash: true },
              ),
            )}
          </tr>

          {isExpanded('oldAge') &&
            OLD_AGE_PENSION_CATEGORY_ROWS.map((category) => {
              const folderKey = `oldAge.${category.key}`;
              return (
                <OldAgeCategoryRows
                  key={folderKey}
                  category={category}
                  folderKey={folderKey}
                  visibleYears={visibleYears}
                  expanded={isExpanded(folderKey)}
                  onToggleFolder={onToggleFolder}
                  renderLabelCell={renderLabelCell}
                  renderValueCell={renderValueCell}
                />
              );
            })}

          <tr className="cf-row-income-detail">
            {renderLabelCell('障害年金', 3, {
              folder: true,
              expanded: isExpanded('disability'),
              onToggle: () => onToggleFolder('disability'),
              icon: 'folder',
            })}
            {visibleYears.map((y) =>
              renderValueCell(
                sumDisabilityPension(y.incomeBreakdown.pension.disability),
                y.calendarYear,
                { emptyAsDash: true },
              ),
            )}
          </tr>

          {isExpanded('disability') &&
            DISABILITY_PENSION_CATEGORY_ROWS.map((category) => {
              const folderKey = `disability.${category.key}`;
              return (
                <DisabilityCategoryRows
                  key={folderKey}
                  category={category}
                  folderKey={folderKey}
                  visibleYears={visibleYears}
                  expanded={isExpanded(folderKey)}
                  onToggleFolder={onToggleFolder}
                  renderLabelCell={renderLabelCell}
                  renderValueCell={renderValueCell}
                />
              );
            })}

          <tr className="cf-row-income-detail">
            {renderLabelCell('遺族年金', 3, {
              folder: true,
              expanded: isExpanded('survivor'),
              onToggle: () => onToggleFolder('survivor'),
              icon: 'folder',
            })}
            {visibleYears.map((y) =>
              renderValueCell(
                sumSurvivorPension(y.incomeBreakdown.pension.survivor),
                y.calendarYear,
                { emptyAsDash: true },
              ),
            )}
          </tr>

          {isExpanded('survivor') &&
            SURVIVOR_PENSION_CATEGORY_ROWS.map((category) => {
              const folderKey = `survivor.${category.key}`;
              return (
                <SurvivorCategoryRows
                  key={folderKey}
                  category={category}
                  folderKey={folderKey}
                  visibleYears={visibleYears}
                  expanded={isExpanded(folderKey)}
                  onToggleFolder={onToggleFolder}
                  renderLabelCell={renderLabelCell}
                  renderValueCell={renderValueCell}
                />
              );
            })}

        </>
      )}
    </>
  );
}

function OldAgeCategoryRows({
  category,
  folderKey,
  visibleYears,
  expanded,
  onToggleFolder,
  renderLabelCell,
  renderValueCell,
}: {
  category: (typeof OLD_AGE_PENSION_CATEGORY_ROWS)[number];
  folderKey: string;
  visibleYears: YearRow[];
  expanded: boolean;
  onToggleFolder: (key: string) => void;
  renderLabelCell: PensionBreakdownRowsProps['renderLabelCell'];
  renderValueCell: PensionBreakdownRowsProps['renderValueCell'];
}) {
  const detailRows = OLD_AGE_CATEGORY_DETAIL_ROWS[category.key];
  const sumCategory = OLD_AGE_CATEGORY_SUMMERS[category.key];

  return (
    <>
      <tr className="cf-row-income-detail">
        {renderLabelCell(category.label, 4, {
          folder: true,
          expanded,
          onToggle: () => onToggleFolder(folderKey),
          icon: 'folder',
        })}
        {visibleYears.map((y) =>
          renderValueCell(
            sumCategory(y.incomeBreakdown.pension.oldAge),
            y.calendarYear,
            { emptyAsDash: true },
          ),
        )}
      </tr>

      {expanded &&
        detailRows.map((row) => (
          <tr key={`${folderKey}.${row.key}`} className="cf-row-income-detail">
            {renderLabelCell(row.label, 5, { icon: 'leaf' })}
            {visibleYears.map((y) =>
              renderValueCell(
                getOldAgeDetailValue(
                  y.incomeBreakdown.pension,
                  category.key,
                  row.key,
                ),
                y.calendarYear,
                { emptyAsDash: true },
              ),
            )}
          </tr>
        ))}
    </>
  );
}

function SurvivorCategoryRows({
  category,
  folderKey,
  visibleYears,
  expanded,
  onToggleFolder,
  renderLabelCell,
  renderValueCell,
}: {
  category: (typeof SURVIVOR_PENSION_CATEGORY_ROWS)[number];
  folderKey: string;
  visibleYears: YearRow[];
  expanded: boolean;
  onToggleFolder: (key: string) => void;
  renderLabelCell: PensionBreakdownRowsProps['renderLabelCell'];
  renderValueCell: PensionBreakdownRowsProps['renderValueCell'];
}) {
  const detailRows = SURVIVOR_CATEGORY_DETAIL_ROWS[category.key];
  const sumCategory = SURVIVOR_CATEGORY_SUMMERS[category.key];

  return (
    <>
      <tr className="cf-row-income-detail">
        {renderLabelCell(category.label, 4, {
          folder: true,
          expanded,
          onToggle: () => onToggleFolder(folderKey),
          icon: 'folder',
        })}
        {visibleYears.map((y) =>
          renderValueCell(
            sumCategory(y.incomeBreakdown.pension.survivor),
            y.calendarYear,
            { emptyAsDash: true },
          ),
        )}
      </tr>

      {expanded &&
        detailRows.map((row) => (
          <tr key={`${folderKey}.${row.key}`} className="cf-row-income-detail">
            {renderLabelCell(row.label, 5, { icon: 'leaf' })}
            {visibleYears.map((y) =>
              renderValueCell(
                getSurvivorDetailValue(
                  y.incomeBreakdown.pension,
                  category.key,
                  row.key,
                ),
                y.calendarYear,
                { emptyAsDash: true },
              ),
            )}
          </tr>
        ))}
    </>
  );
}

function DisabilityCategoryRows({
  category,
  folderKey,
  visibleYears,
  expanded,
  onToggleFolder,
  renderLabelCell,
  renderValueCell,
}: {
  category: (typeof DISABILITY_PENSION_CATEGORY_ROWS)[number];
  folderKey: string;
  visibleYears: YearRow[];
  expanded: boolean;
  onToggleFolder: (key: string) => void;
  renderLabelCell: PensionBreakdownRowsProps['renderLabelCell'];
  renderValueCell: PensionBreakdownRowsProps['renderValueCell'];
}) {
  const detailRows = DISABILITY_CATEGORY_DETAIL_ROWS[category.key];
  const sumCategory = DISABILITY_CATEGORY_SUMMERS[category.key];

  return (
    <>
      <tr className="cf-row-income-detail">
        {renderLabelCell(category.label, 4, {
          folder: true,
          expanded,
          onToggle: () => onToggleFolder(folderKey),
          icon: 'folder',
        })}
        {visibleYears.map((y) =>
          renderValueCell(
            sumCategory(y.incomeBreakdown.pension.disability),
            y.calendarYear,
            { emptyAsDash: true },
          ),
        )}
      </tr>

      {expanded &&
        detailRows.map((row) => (
          <tr key={`${folderKey}.${row.key}`} className="cf-row-income-detail">
            {renderLabelCell(row.label, 5, { icon: 'leaf' })}
            {visibleYears.map((y) =>
              renderValueCell(
                getDisabilityDetailValue(
                  y.incomeBreakdown.pension,
                  category.key,
                  row.key,
                ),
                y.calendarYear,
                { emptyAsDash: true },
              ),
            )}
          </tr>
        ))}
    </>
  );
}
