import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RedesignLanding } from './RedesignLanding';
import { LandingModeSelector } from './LandingModeSelector';
import '../styles/landing-redesign.css';
import './landing-selector.css';
createRoot(document.getElementById('landing-root')).render(<StrictMode><LandingModeSelector mode="redesign" /><RedesignLanding /></StrictMode>);
