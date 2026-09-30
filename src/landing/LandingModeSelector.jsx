import { sitePath } from '../sitePath';
export const activeLandingMode = import.meta.env.VITE_LANDING_MODE === 'redesign' ? 'redesign' : 'original';
export const landingPreview = import.meta.env.VITE_LANDING_PREVIEW === 'true';
export function landingUrl(mode) { return sitePath(mode === 'redesign' ? 'redesign.html' : 'index.html?landing=original'); }
export function LandingModeSelector({ mode }) {
  return <label className="landing-mode-selector"><span>نسخه صفحه</span><select value={mode} onChange={(event) => window.location.assign(landingUrl(event.target.value))} aria-label="نسخه صفحه اصلی"><option value="original">Original</option><option value="redesign">Redesign</option></select></label>;
}
