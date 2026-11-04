import { useLayoutEffect, useRef } from 'react';
import pumpkinLarge from '../../assets/menu/seasonal/pumpkin-700.webp';
import pumpkinSmall from '../../assets/menu/seasonal/pumpkin-350.webp';
import { seasonalFrame } from './seasonalFeature.mjs';
import '../styles/seasonal-feature.css';

export const pumpkinImage = {
  src: pumpkinLarge,
  srcSet: `${pumpkinSmall} 350w, ${pumpkinLarge} 700w`,
  width: 700,
  height: 766,
};

export function SeasonalFeature({ item, reducedMotion }) {
  const rootRef = useRef(null);
  const sourceRef = useRef(null);
  const dockRef = useRef(null);
  const flightRef = useRef(null);

  useLayoutEffect(() => {
    if (reducedMotion) return undefined;
    const root = rootRef.current;
    const flight = flightRef.current;
    const halo = sourceRef.current.querySelector('.seasonal-halo');
    const details = dockRef.current.nextElementSibling;
    let frame = 0;
    let disposed = false;
    let source = null;
    let travel = 1;
    let detailsOffset = 0;
    let destination = null;
    let visible = false;
    let lastProgress = -1;
    const measure = () => {
      const bounds = sourceRef.current.getBoundingClientRect();
      const rootBounds = root.getBoundingClientRect();
      const target = dockRef.current.getBoundingClientRect();
      source = { x: bounds.left, y: bounds.top + window.scrollY, width: bounds.width, height: bounds.height };
      travel = Math.max(1, sourceRef.current.parentElement.offsetHeight * .72);
      const gap = parseFloat(getComputedStyle(dockRef.current.parentElement).columnGap) || 0;
      detailsOffset = (target.width + gap) / 2;
      const height = bounds.height * target.width / bounds.width;
      destination = { x: target.left, y: target.top - rootBounds.top + (target.height - height) / 2, width: target.width, height };
      flight.style.width = `${source.width}px`;
      flight.style.height = `${source.height}px`;
      lastProgress = -1;
    };
    const paint = () => {
      frame = 0;
      const bounds = root.getBoundingClientRect();
      const inView = bounds.bottom > 0 && bounds.top < window.innerHeight;
      if (visible !== inView) {
        flight.style.visibility = inView ? 'visible' : 'hidden';
        visible = inView;
      }
      if (!inView) return;
      const progress = Math.max(0, Math.min(1, -bounds.top / travel));
      const origin = { ...source, y: source.y - window.scrollY * .28 };
      const next = seasonalFrame(origin, {
        ...destination,
        y: bounds.top + destination.y,
      }, progress);
      flight.style.transform = `translate3d(${next.x}px,${next.y}px,0) scale(${next.width / source.width},${next.height / source.height})`;
      if (progress !== lastProgress) {
        const docked = progress >= .98 ? 'true' : 'false';
        if (root.dataset.docked !== docked) root.dataset.docked = docked;
        halo.style.opacity = 1 - Math.min(1, progress * 1.8);
        const approach = source.width === destination.width ? 1 : (source.width - next.width) / (source.width - destination.width);
        details.style.transform = `translateX(${detailsOffset * (1 - approach)}px)`;
        lastProgress = progress;
      }
    };
    const schedule = () => { if (!disposed && !frame) frame = requestAnimationFrame(paint); };
    const resize = () => { measure(); schedule(); };
    const observer = new ResizeObserver(resize);
    observer.observe(root);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', resize);
    measure();
    paint();
    document.fonts?.ready.then(() => { if (!disposed) resize(); });
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', resize);
      halo.style.removeProperty('opacity');
      details.style.removeProperty('transform');
      delete root.dataset.docked;
    };
  }, [reducedMotion, item.id]);

  return (
    <section ref={rootRef} className="seasonal-feature" data-motion={reducedMotion ? 'reduced' : 'full'} aria-labelledby="seasonal-title">
      <div className="seasonal-intro">
        <div className="seasonal-art" ref={sourceRef}>
          <span className="seasonal-halo" aria-hidden="true" />
          {reducedMotion ? <img className="seasonal-static" src={pumpkinLarge} srcSet={pumpkinImage.srcSet} sizes="(max-width: 759px) 78vw, 350px" alt={item.name} width="700" height="766" fetchPriority="high" /> : null}
        </div>
      </div>
      {!reducedMotion ? (
        <div className="seasonal-flight" ref={flightRef} aria-hidden="true">
          <img src={pumpkinLarge} srcSet={pumpkinImage.srcSet} sizes="(max-width: 759px) 78vw, 350px" width="700" height="766" alt="" fetchPriority="high" decoding="async" />
        </div>
      ) : null}
      <article className="seasonal-landing" aria-label={`انتخاب فصل: ${item.name}`}>
        <div className="seasonal-dock" ref={dockRef}>
          {reducedMotion ? <img src={pumpkinSmall} width="350" height="383" alt="" /> : null}
        </div>
        <div className="seasonal-details">
          <span className="seasonal-badge">فصلی</span>
          <h2 id="seasonal-title">{item.name}</h2>
          <p>{item.description || 'یک مکث شیرین، با طعم پاییز'}</p>
          {item.price ? <strong className="seasonal-price">{item.price}</strong> : null}
        </div>
      </article>
    </section>
  );
}
