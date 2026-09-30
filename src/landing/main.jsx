import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { OriginalLanding } from './OriginalLanding';
import { LandingModeSelector, activeLandingMode, landingUrl, landingPreview } from './LandingModeSelector';
import '../styles/landing-original.css';
if (landingPreview) import('./landing-selector.css');
if (landingPreview && activeLandingMode === 'redesign' && new URLSearchParams(window.location.search).get('landing') !== 'original') window.location.replace(landingUrl('redesign'));
createRoot(document.getElementById('landing-root')).render(<StrictMode>{landingPreview ? <LandingModeSelector mode="original" /> : null}<OriginalLanding /></StrictMode>);
