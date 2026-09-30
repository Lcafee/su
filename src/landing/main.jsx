import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { OriginalLanding } from './OriginalLanding';
import { LandingModeSelector, activeLandingMode, landingUrl } from './LandingModeSelector';
import '../styles/landing-original.css';
import './landing-selector.css';
if (activeLandingMode === 'redesign' && new URLSearchParams(window.location.search).get('landing') !== 'original') window.location.replace(landingUrl('redesign'));
createRoot(document.getElementById('landing-root')).render(<StrictMode><LandingModeSelector mode="original" /><OriginalLanding /></StrictMode>);
