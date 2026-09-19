import { useEffect, useRef } from "react";
import lightArtwork from "../../assets/menu-backgrounds/lcafe-journey-light.webp";
import glassArtwork from "../../assets/menu-backgrounds/lcafe-journey-glass.webp";
import perchArtwork from "../../assets/menu-backgrounds/lcafe-journey-perch.webp";

const clamp = (value) => Math.max(0, Math.min(1, value));
const dissolve = (start, end, value) => {
  const t = clamp((value - start) / (end - start));
  return t * t * (3 - 2 * t);
};

// Decorative only: read the existing category geometry without changing menu flow.
export function MenuJourney() {
  const artworkRef = useRef(null);

  useEffect(() => {
    const artwork = artworkRef.current;
    const root = document.getElementById("menu-root");
    if (!artwork || !root) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let anchors = [];
    let frame = 0;
    let needsMeasure = true;
    let disposed = false;

    const paint = () => {
      frame = 0;
      if (needsMeasure) {
        const sections = [...root.querySelectorAll("#menu > .cat")];
        anchors = sections.map((section) => window.scrollY + section.getBoundingClientRect().top);
        const last = sections.at(-1);
        if (last) anchors.push(window.scrollY + last.getBoundingClientRect().bottom);
        needsMeasure = false;
      }
      const cursor = window.scrollY + window.innerHeight * .22;
      let progress = 0;
      if (anchors.length > 1) {
        let index = 0;
        while (index < anchors.length - 2 && cursor >= anchors[index + 1]) index++;
        const local = clamp((cursor - anchors[index]) / Math.max(1, anchors[index + 1] - anchors[index]));
        progress = (index + local) / (anchors.length - 1);
      }
      artwork.style.setProperty("--journey-glass", dissolve(.16, .52, progress).toFixed(4));
      artwork.style.setProperty("--journey-perch", dissolve(.55, .92, progress).toFixed(4));
      artwork.style.setProperty("--journey-drift", `${motion.matches ? 0 : -32 * progress}px`);
    };
    const schedule = () => { if (!disposed && !frame) frame = requestAnimationFrame(paint); };
    const measure = () => { needsMeasure = true; schedule(); };
    const resize = new ResizeObserver(measure);
    resize.observe(root);
    const content = new MutationObserver(measure);
    content.observe(root, { childList: true, subtree: true });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure);
    motion.addEventListener("change", schedule);
    document.fonts?.ready.then(measure);
    paint();
    return () => {
      disposed = true;
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      motion.removeEventListener("change", schedule);
      resize.disconnect();
      content.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="menu-journey" ref={artworkRef} aria-hidden="true">
      <div className="menu-journey-scene menu-journey-light">
        <img src={lightArtwork} alt="" decoding="async" draggable="false" />
      </div>
      <div className="menu-journey-scene menu-journey-glass">
        <img src={glassArtwork} alt="" decoding="async" draggable="false" />
      </div>
      <div className="menu-journey-scene menu-journey-perch">
        <img src={perchArtwork} alt="" decoding="async" draggable="false" />
      </div>
      <div className="menu-journey-reading-field" />
    </div>
  );
}
