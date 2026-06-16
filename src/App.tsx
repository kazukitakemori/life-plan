import { useMemo, useState } from 'react';

import { AssetBuildingView } from './components/assetBuilding/AssetBuildingView';
import { EducationStep } from './components/education/EducationStep';
import { FamilyStep } from './components/family/FamilyStep';
import { IncomeStep } from './components/income/IncomeStep';
import { LifeEventStep } from './components/lifeEvent/LifeEventStep';
import { LivingStep } from './components/living/LivingStep';
import { AppShell } from './components/layout/AppShell';
import { HeaderTabPlaceholder } from './components/layout/HeaderTabPlaceholder';
import { PlaceholderStep } from './components/layout/PlaceholderStep';
import { PensionStep } from './components/pension/PensionStep';
import { buildCashFlowTable } from './lib/cashFlow';
import {
  createDefaultEducationByMember,
  syncEducationWithFamily,
} from './lib/educationDefaults';
import { createDefaultFamily } from './lib/familyDefaults';
import { createDefaultHeadIncome } from './lib/incomeDefaults';
import {
  createDefaultLifeEventState,
  syncLifeEventsWithFamily,
} from './lib/lifeEventDefaults';
import {
  createDefaultLivingState,
  migrateLivingExpenseState,
} from './lib/livingDefaults';
import { syncAllIncomeWithFamilyDefaults } from './lib/memberDependentDefaults';
import { createDefaultPensionByMember } from './lib/pensionDefaults';
import { syncPriorYearIncomeWithFamily } from './lib/priorYearIncomeDefaults';
import { createDefaultTaxSocialState } from './lib/taxSocialDefaults';
import type { AssetBuildingTabId } from './types/assetBuildingTabs';
import type { EducationByMember } from './types/education';
import type { FamilyMember } from './types/family';
import type { HeaderTabId } from './types/headerTabs';
import type { IncomeByMember, PriorYearIncomeByMember } from './types/income';
import type { LifeEventState } from './types/lifeEvent';
import type { LivingExpenseState } from './types/living';
import type { PensionByMember } from './types/pension';
import type { StepId } from './types/steps';
import type { TaxSocialState } from './types/taxSocial';

const REFERENCE_DATE = new Date(2026, 5, 1);

function initializeIncome(members: FamilyMember[]): IncomeByMember {
  const head = members.find((m) => m.role === 'head');
  if (!head) return {};

  return {
    [head.id]: createDefaultHeadIncome(head, REFERENCE_DATE.getMonth() + 1),
  };
}

const DEFAULT_FAMILY = createDefaultFamily();

export default function App() {
  const [headerTab, setHeaderTab] = useState<HeaderTabId>('input');
  const [assetBuildingTab, setAssetBuildingTab] =
    useState<AssetBuildingTabId>('simulation');
  const [analysisSession, setAnalysisSession] = useState(0);
  const [activeStep, setActiveStep] = useState<StepId>('family');
  const [familyMembers, setFamilyMembers] =
    useState<FamilyMember[]>(DEFAULT_FAMILY);
  const [taxSocialState, setTaxSocialState] = useState<TaxSocialState>(() => {
    const head = DEFAULT_FAMILY.find((m) => m.role === 'head');
    return createDefaultTaxSocialState(
      head?.age ?? 40,
      REFERENCE_DATE.getMonth() + 1,
    );
  });
  const [incomeByMember, setIncomeByMember] = useState<IncomeByMember>(() =>
    initializeIncome(DEFAULT_FAMILY),
  );
  const [priorYearIncomeByMember, setPriorYearIncomeByMember] =
    useState<PriorYearIncomeByMember>({});
  const [educationByMember, setEducationByMember] = useState<EducationByMember>(
    () => createDefaultEducationByMember(DEFAULT_FAMILY),
  );
  const [lifeEventState, setLifeEventState] = useState<LifeEventState>(() =>
    createDefaultLifeEventState(),
  );
  const [livingState, setLivingState] = useState<LivingExpenseState>(() =>
    migrateLivingExpenseState(
      createDefaultLivingState(
        DEFAULT_FAMILY.find((m) => m.role === 'head'),
        REFERENCE_DATE.getMonth() + 1,
      ),
    ),
  );
  const [pensionByMember, setPensionByMember] = useState<PensionByMember>(() =>
    createDefaultPensionByMember(DEFAULT_FAMILY),
  );

  const cashFlowData = useMemo(
    () =>
      buildCashFlowTable({
        familyMembers,
        incomeByMember,
        livingState,
        educationByMember,
        lifeEventState,
        pensionByMember,
        taxSocialState,
        referenceDate: REFERENCE_DATE,
      }),
    [
      familyMembers,
      incomeByMember,
      livingState,
      educationByMember,
      lifeEventState,
      pensionByMember,
      taxSocialState,
    ],
  );

  const handleLivingChange = (state: LivingExpenseState) => {
    setLivingState(migrateLivingExpenseState(state));
  };

  const handleAnalyze = () => {
    setAnalysisSession((session) => session + 1);
    setAssetBuildingTab('simulation');
    setHeaderTab('asset-building');
  };

  const handleStepChange = (step: StepId) => {
    setActiveStep(step);
  };

  const handleHeaderTabChange = (tab: HeaderTabId) => {
    if (analysisSession === 0 && tab !== 'input') return;
    setHeaderTab(tab);
  };

  const renderMainContent = () => {
    if (headerTab === 'input') {
      if (activeStep === 'family') {
        return (
          <FamilyStep
            members={familyMembers}
            referenceDate={REFERENCE_DATE}
            taxSocialState={taxSocialState}
            onChange={(members) => {
              setFamilyMembers(members);
              setIncomeByMember((prev) =>
                syncAllIncomeWithFamilyDefaults(members, prev),
              );
              setEducationByMember((prev) =>
                syncEducationWithFamily(members, prev),
              );
              setLifeEventState((prev) =>
                syncLifeEventsWithFamily(members, prev),
              );
              setPriorYearIncomeByMember((prev) =>
                syncPriorYearIncomeWithFamily(members, prev),
              );
            }}
            onTaxSocialChange={setTaxSocialState}
          />
        );
      }

      if (activeStep === 'education') {
        return (
          <EducationStep
            members={familyMembers}
            educationByMember={educationByMember}
            incomeByMember={incomeByMember}
            priorYearIncomeByMember={priorYearIncomeByMember}
            taxSocialState={taxSocialState}
            referenceDate={REFERENCE_DATE}
            onChange={setEducationByMember}
          />
        );
      }

      if (activeStep === 'life-event') {
        return (
          <LifeEventStep
            members={familyMembers}
            lifeEventState={lifeEventState}
            referenceDate={REFERENCE_DATE}
            onChange={setLifeEventState}
          />
        );
      }

      if (activeStep === 'living') {
        return (
          <LivingStep
            members={familyMembers}
            livingState={livingState}
            referenceDate={REFERENCE_DATE}
            onChange={handleLivingChange}
          />
        );
      }

      if (activeStep === 'income') {
        return (
          <IncomeStep
            members={familyMembers}
            incomeByMember={incomeByMember}
            priorYearIncomeByMember={priorYearIncomeByMember}
            referenceDate={REFERENCE_DATE}
            onChange={setIncomeByMember}
            onPriorYearIncomeChange={setPriorYearIncomeByMember}
          />
        );
      }

      if (activeStep === 'pension') {
        return (
          <PensionStep
            members={familyMembers}
            pensionByMember={pensionByMember}
            referenceDate={REFERENCE_DATE}
            onChange={setPensionByMember}
          />
        );
      }

      return <PlaceholderStep stepId={activeStep} />;
    }

    if (headerTab === 'asset-building') {
      if (analysisSession === 0) {
        return (
          <HeaderTabPlaceholder
            title="資産形成"
            description="入力タブで内容を入力し、サイドバーの「ライフプラン分析」を実行すると、キャッシュフロー表が表示されます。"
          />
        );
      }

      return (
        <AssetBuildingView
          key={analysisSession}
          analysisSession={analysisSession}
          activeTab={assetBuildingTab}
          data={cashFlowData}
          familyMembers={familyMembers}
          incomeByMember={incomeByMember}
          livingState={livingState}
          educationByMember={educationByMember}
          lifeEventState={lifeEventState}
          pensionByMember={pensionByMember}
          referenceDate={REFERENCE_DATE}
          onBack={() => setHeaderTab('input')}
        />
      );
    }

    if (headerTab === 'summary') {
      return <HeaderTabPlaceholder title="サマリー" />;
    }

    if (headerTab === 'life-plan') {
      return <HeaderTabPlaceholder title="ライフプラン" />;
    }

    return <HeaderTabPlaceholder title="必要保障額" />;
  };

  return (
    <AppShell
      activeStep={activeStep}
      onStepChange={handleStepChange}
      onAnalyze={handleAnalyze}
      activeHeaderTab={headerTab}
      onHeaderTabChange={handleHeaderTabChange}
      analysisUnlocked={analysisSession > 0}
      assetBuildingTab={assetBuildingTab}
      onAssetBuildingTabChange={setAssetBuildingTab}
      showAssetBuildingSubTabs={analysisSession > 0}
    >
      {renderMainContent()}
    </AppShell>
  );
}
