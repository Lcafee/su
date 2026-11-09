import { useEffect, useLayoutEffect, useRef } from 'react';
import marbleCutout from '../../assets/menu/seasonal/marble-cutout.png';
import { FloatingMarbleStock } from './MarbleStock';

import { seasonalFrame, seasonalDetailsOpacity } from './seasonalFeature.mjs';
import '../styles/seasonal-feature.css';

export const marbleImage = {
  src: marbleCutout,

  width: 850,
  height: 774,
};

export function SeasonalFeature({ item, reducedMotion }) {
  const rootRef = useRef(null);
  const sourceRef = useRef(null);
  const dockRef = useRef(null);
  const flightRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    const source = sourceRef.current;
    if (reducedMotion) return undefined;
    const bounds = source.getBoundingClientRect();
    let inView = bounds.bottom > 0 && bounds.top < window.innerHeight;
    const update = () => { root.dataset.labelsActive = String(inView && !document.hidden); };
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      update();
    });
    observer?.observe(source);
    document.addEventListener('visibilitychange', update);
    update();
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', update);
      delete root.dataset.labelsActive;
    };
  }, [reducedMotion]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (reducedMotion) return undefined;
    const flight = flightRef.current;
    const halo = sourceRef.current.querySelector('.seasonal-halo');
    const labels = sourceRef.current.querySelector('.seasonal-labels');
    const details = dockRef.current.nextElementSibling;
    const travel = 360;
    let frame = 0;
    let disposed = false;
    let animations = [];
    let source;
    let target;
    let start = 0;
    let lastProgress = -1;
    let native = false;
    const transform = (next) => `translate3d(${next.x}px,${next.y}px,0) scale(${next.width / source.width})`;
    const paint = () => {
      frame = 0;
      if (native || disposed) return;
      const progress = Math.max(0, Math.min(1, (window.scrollY - start) / travel));
      if (progress === lastProgress) return;
      flight.style.transform = transform(seasonalFrame(source, target, progress, travel));
      halo.style.opacity = 1 - Math.min(1, progress / .8);
      labels.style.opacity = 1 - Math.min(1, progress / .8);
      details.style.opacity = seasonalDetailsOpacity(progress);
      lastProgress = progress;
    };
    const measure = () => {
      if (disposed) return;
      const rootBounds = root.getBoundingClientRect();
      const origin = sourceRef.current.getBoundingClientRect();
      const dock = dockRef.current.getBoundingClientRect();
      source = { x: origin.left - rootBounds.left, y: origin.top - rootBounds.top,
        width: origin.width, height: origin.height };
      const height = source.height * dock.width / source.width;
      target = { x: dock.left - rootBounds.left,
        y: dock.top - rootBounds.top + (dock.height - height) / 2,
        width: dock.width, height };
      start = Math.max(0, rootBounds.top + window.scrollY - 80);
      root.dataset.motionEnd = String(start + travel);
      flight.style.left = '0px';
      flight.style.top = '0px';
      flight.style.width = `${source.width}px`;
      flight.style.height = `${source.height}px`;
      flight.style.transform = transform(source);
      animations.forEach(animation => animation.cancel());
      animations = [];
      native = false;
      if (typeof ScrollTimeline !== 'undefined' && 'rangeStart' in Animation.prototype) {
        try {
          const timeline = new ScrollTimeline({ source: document.scrollingElement, axis: 'block' });
          const options = { timeline, rangeStart: `${start}px`, rangeEnd: `${start + travel}px`,
            duration: 1, fill: 'both', easing: 'linear' };
          const frames = Array.from({ length: 73 }, (_, index) => {
            const progress = index / 72;
            return { offset: progress, transform: transform(seasonalFrame(source, target, progress, travel)) };
          });
          animations.push(flight.animate(frames, options));
          animations.push(halo.animate([{ opacity: 1 }, { offset: .8, opacity: 0 }, { opacity: 0 }], options));
          animations.push(labels.animate([{ opacity: 1 }, { offset: .8, opacity: 0 }, { opacity: 0 }], options));
          animations.push(details.animate(Array.from({ length: 73 }, (_, index) => ({
            offset: index / 72, opacity: seasonalDetailsOpacity(index / 72),
          })), options));
          native = true;
        } catch {
          animations.forEach(animation => animation.cancel());
          animations = [];
        }
      }
      root.dataset.motionEngine = native ? 'native' : 'fallback';
      lastProgress = -1;
      paint();
    };
    const schedule = () => {
      if (!native && !disposed && !frame) frame = requestAnimationFrame(paint);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', measure);
    measure();
    document.fonts?.ready.then(() => { if (!disposed) measure(); });
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      animations.forEach(animation => animation.cancel());
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', measure);
      halo.style.removeProperty('opacity');
      labels.style.removeProperty('opacity');
      details.style.removeProperty('opacity');
      delete root.dataset.motionEngine;
      delete root.dataset.motionEnd;
    };
  }, [reducedMotion, item.id]);

  return (
    <section ref={rootRef} className="seasonal-feature" data-motion={reducedMotion ? 'reduced' : 'full'} aria-labelledby="seasonal-title">
      <div className="seasonal-intro">
        <div className="seasonal-art" ref={sourceRef}>
          <span className="seasonal-halo" aria-hidden="true" />
          <span className="seasonal-labels">
            <span className="seasonal-floating-note seasonal-floating-limited" aria-hidden="true"><span>عرضه</span><strong>محدود!</strong></span>
            <FloatingMarbleStock />
          </span>
          {reducedMotion ? <img className="seasonal-static" src={marbleCutout} srcSet={marbleImage.srcSet} sizes="(max-width: 759px) 78vw, 350px" alt={item.name} width="850" height="774" fetchPriority="high" /> : null}
        </div>
      </div>
      {!reducedMotion ? (
        <div className="seasonal-flight" ref={flightRef} aria-hidden="true">
          <img src={marbleCutout} srcSet={marbleImage.srcSet} sizes="(max-width: 759px) 78vw, 350px" width="850" height="774" alt="" fetchPriority="high" decoding="async" />
        </div>
      ) : null}
      <article className="seasonal-landing" aria-label={`انتخاب فصل: ${item.name}`}>
        <div className="seasonal-dock" ref={dockRef}>
          {reducedMotion ? <img src={marbleCutout} width="850" height="774" alt="" /> : null}
          <div className="seasonal-desktop-stock"><FloatingMarbleStock /></div>
        </div>
        <div className="seasonal-details">
          <span className="seasonal-badge">عرضه محدود!</span>
          <h2 id="seasonal-title">{item.name}</h2>
          {item.description ? <p>{item.description}</p> : null}
          {item.price ? <strong className="seasonal-price">{item.price}</strong> : null}
          {item.options?.length ? <dl className="seasonal-options" aria-label="قیمت‌های ماربل براونی">
            {item.options.map(option => <div key={`${option.label}-${option.code || ''}`}>
              <dt>{option.label}</dt><dd>{option.price}</dd>
            </div>)}
          </dl> : null}
        </div>
      </article>
    </section>
  );
}
