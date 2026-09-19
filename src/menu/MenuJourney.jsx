import { useEffect, useRef } from "react";
import paintedFlow from "../../assets/menu-backgrounds/lcafe-painted-flow.webp";
import "../styles/menu-journey.css";

const clamp = (value) => Math.max(0, Math.min(1, value));
// One painting, one continuous camera movement. No scenes or category switches.
export function MenuJourney() {
  const artworkRef = useRef(null);
  const paintingRef = useRef(null);

  useEffect(() => {
    const artwork = artworkRef.current;
    const painting = paintingRef.current;
    const root = document.getElementById("menu-root");
    if (!artwork || !painting || !root) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let scrollDistance = 1;
    let paintingTravel = 0;
    let frame = 0;
    let needsMeasure = true;
    let disposed = false;

    const paint = () => {
      frame = 0;
      if (needsMeasure) {
        scrollDistance = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        paintingTravel = Math.max(0, painting.clientHeight - artwork.clientHeight);
        needsMeasure = false;
      }
      const progress = clamp(window.scrollY / scrollDistance);
      artwork.style.setProperty("--journey-offset", `${motion.matches ? 0 : -paintingTravel * progress}px`);
    };
    const schedule = () => { if (!disposed && !frame) frame = requestAnimationFrame(paint); };
    const measure = () => { needsMeasure = true; schedule(); };
    const resize = new ResizeObserver(measure);
    resize.observe(root);
    resize.observe(artwork);
    resize.observe(painting);
    const content = new MutationObserver(measure);
    content.observe(root, { childList: true, subtree: true });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure);
    painting.addEventListener("load", measure);
    motion.addEventListener("change", schedule);
    document.fonts?.ready.then(measure);
    paint();
    return () => {
      disposed = true;
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      painting.removeEventListener("load", measure);
      motion.removeEventListener("change", schedule);
      resize.disconnect();
      content.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="menu-journey" ref={artworkRef} aria-hidden="true">
      <img className="menu-journey-painting" ref={paintingRef} src={paintedFlow}
        alt="" width="724" height="2171" decoding="async" draggable="false" />
      <div className="menu-journey-reading-field" />
    </div>
  );
}
