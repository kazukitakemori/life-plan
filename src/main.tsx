import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import {
  isLicenseKeyAdminRoute,
  LicenseKeyAdminPage,
} from './components/license/LicenseKeyAdminPage';
import { seedPreviewDataIfNeeded } from './lib/previewSeed';
import './index.css';
import './secondLifeConsistency.css';
import './ui-system.css';
import './ui-form-widths.css';
import './ui-text-integrity.css';
import './mobile.css';
import './mobileCompact.css';
import './mobileSteps.css';
import './mobileEducation.css';
import './mobileLifeEvent.css';
import './housing-ui.css';
import './mobileHousing.css';
import './mobileVehicle.css';
import './mobilePension.css';
import './mobileLoan.css';
import './mobileInsurance.css';
import './mobileSavings.css';
import './mobileSecondLife.css';
import './ui-unification.css';
import './ui-workspace-tabs.css';
import './ui-unification-screens.css';
import './ui-unification-shell-analysis.css';
import './ui-typography-unification.css';
import './ui-mobile-control-geometry.css';
import './ui-add-cards.css';
import './education-ui.css';
import './education-mobile-ui.css';
import './education-tuition-link.css';
import './step-guidance.css';
import './life-event-mobile-ui.css';
import './ui-mobile-accordion.css';
import './ui-accordion-card.css';
import './life-event-ui.css';
import './ui-form-units.css';
import './ui-action-integrity.css';
import './living-ui.css';
import './mobileLiving.css';
import './ui-fafafa-shell.css';

async function bootstrap(): Promise<void> {
  if (!isLicenseKeyAdminRoute()) {
    await seedPreviewDataIfNeeded();
  }

  const root = createRoot(document.getElementById('root')!);

  root.render(
    <StrictMode>
      <ErrorBoundary>
        {isLicenseKeyAdminRoute() ? <LicenseKeyAdminPage /> : <App />}
      </ErrorBoundary>
    </StrictMode>,
  );
}

void bootstrap();
