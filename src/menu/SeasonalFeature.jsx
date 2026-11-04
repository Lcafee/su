import { useLayoutEffect, useRef } from 'react';
import pumpkinLarge from '../../assets/menu/seasonal/pumpkin-700.webp';
import pumpkinSmall from '../../assets/menu/seasonal/pumpkin-350.webp';
import { seasonalFrame, seasonalDetailsOpacity } from './seasonalFeature.mjs';
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
    const root = rootRef.current;
    if (reducedMotion) return undefined;
    const flight = flightRef.current;
    const halo = sourceRef.current.querySelector('.seasonal-halo');
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
