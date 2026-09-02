import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import {
  isLicenseKeyAdminRoute,
  LicenseKeyAdminPage,
} from './components/license/LicenseKeyAdminPage';
import './index.css';

const root = createRoot(document.getElementById('root')!);

root.render(
  <StrictMode>
    <ErrorBoundary>
      {isLicenseKeyAdminRoute() ? <LicenseKeyAdminPage /> : <App />}
    </ErrorBoundary>
  </StrictMode>,
);
