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
import './ui-text-integrity.css';
import './mobile.css';
import './mobileCompact.css';
import './mobileSteps.css';
import './mobileEducation.css';
import './mobileLifeEvent.css';
import './mobileLiving.css';
import './mobileHousing.css';
import './mobileVehicle.css';
import './mobilePension.css';
import './mobileLoan.css';
import './mobileInsurance.css';
import './mobileSavings.css';
import './mobileSecondLife.css';
import './ui-unification.css';
import './ui-unification-q1-q2.css';
import './ui-unification-q3-q4.css';
import './ui-unification-q5-q6.css';
import './ui-unification-q7-q8.css';

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
