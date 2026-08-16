import { useEffect, useRef, useState } from "react";

import { sitePath } from "../sitePath";

const REVEAL_TIMEOUT_MS = 6000;
const FEATURE_PHOTO_SRC_SET = [
  [480, "assets/l-cafe-sculptural-light-480.webp"],
  [760, "assets/l-cafe-sculptural-light-760.webp"],
  [1280, "assets/l-cafe-sculptural-light-1280.webp"],
  [1586, "assets/l-cafe-sculptural-light.webp"],
]
  .map(([width, path]) => `${sitePath(path)} ${width}w`)
  .join(", ");
const FEATURE_PHOTO_FALLBACK = sitePath(
  "assets/l-cafe-sculptural-light-1280.webp",
);
const MENU_HREF = sitePath("menu.html");

function RevealBlock({ children, className }) {
  const blockRef = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const block = blockRef.current;
    if (!block) return undefined;

    if (!("IntersectionObserver" in window)) {
      setShown(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setShown(true);
        observer.disconnect();
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    observer.observe(block);

    const fallback = window.setTimeout(() => setShown(true), REVEAL_TIMEOUT_MS);
    return () => {
      window.clearTimeout(fallback);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={blockRef}
      className={className}
      data-armed=""
      data-shown={shown ? "" : undefined}
    >
      {children}
    </div>
  );
}

function useHeroMotion({
  aboutRef,
  contactRef,
  cueRef,
  fieldRef,
  heroRef,
  menuRef,
  photoRef,
  phraseRef,
}) {
  useEffect(() => {
    const field = fieldRef.current;
    const hero = heroRef.current;
    const phrase = phraseRef.current;
    if (!field || !hero || !phrase) return undefined;

    let animationFrame = 0;
    let fadeEnd = 1;
    let zones = [];
    let lastPhraseOpacity = -1;
    let lastFieldOpacity = -1;

    const fieldStrength = (pageY) => {
      if (!zones.length || pageY <= zones[0].y) return zones[0]?.value ?? 1;

      for (let index = 1; index < zones.length; index += 1) {
        if (pageY > zones[index].y) continue;
        const previous = zones[index - 1];
        const current = zones[index];
        const progress = Math.min(
          1,
          Math.max(0, (pageY - previous.y) / Math.max(1, current.y - previous.y)),
        );
        const eased = progress * progress * (3 - 2 * progress);
        return previous.value + (current.value - previous.value) * eased;
      }

      return zones.at(-1)?.value ?? 1;
    };

    const paint = () => {
      animationFrame = 0;
      const progress = Math.min(1, Math.max(0, window.scrollY / fadeEnd));
      const eased = progress * progress * (3 - 2 * progress);
      const phraseOpacity = 1 - eased;
      const fieldOpacity = fieldStrength(
        window.scrollY + (window.innerHeight || 800) * 0.5,
      );

      if (phraseOpacity !== lastPhraseOpacity) {
        lastPhraseOpacity = phraseOpacity;
        phrase.style.opacity = String(phraseOpacity);
        if (cueRef.current) {
          cueRef.current.style.opacity = String(phraseOpacity * 0.82);
        }
      }

      if (fieldOpacity !== lastFieldOpacity) {
        lastFieldOpacity = fieldOpacity;
        field.style.opacity = fieldOpacity.toFixed(4);
      }
    };

    const schedulePaint = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(paint);
    };

    const midpoint = (element, fallback) => {
      if (!element) return fallback;
      const box = element.getBoundingClientRect();
      return box.top + window.scrollY + box.height * 0.5;
    };

    const measure = () => {
      const viewportHeight = window.innerHeight || 800;
      const aboutTop = aboutRef.current
        ? aboutRef.current.getBoundingClientRect().top + window.scrollY
        : viewportHeight;

      zones = [
        { y: midpoint(heroRef.current, viewportHeight * 0.5), value: 1 },
        { y: midpoint(aboutRef.current, viewportHeight * 1.3), value: 0.34 },
        { y: midpoint(photoRef.current, viewportHeight * 2.2), value: 0.06 },
        { y: midpoint(menuRef.current, viewportHeight * 2.9), value: 0.3 },
        { y: midpoint(contactRef.current, viewportHeight * 3.3), value: 0.18 },
      ];
      fadeEnd = Math.max(1, aboutTop - viewportHeight * 0.5);
      lastPhraseOpacity = -1;
      lastFieldOpacity = -1;
      schedulePaint();
    };

    const resizeObserver =
      "ResizeObserver" in window ? new ResizeObserver(measure) : null;
    resizeObserver?.observe(hero);

    window.addEventListener("scroll", schedulePaint, { passive: true });
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure).catch(() => {});
    measure();

    return () => {
      window.removeEventListener("scroll", schedulePaint);
      window.removeEventListener("resize", measure);
      resizeObserver?.disconnect();
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [
    aboutRef,
    contactRef,
    cueRef,
    fieldRef,
    heroRef,
    menuRef,
    photoRef,
    phraseRef,
  ]);
}

function Hero({ cueRef, heroRef, phraseRef }) {
  return (
    <h1 ref={heroRef} className="hero">
      <span ref={phraseRef} className="hero-phrase" lang="en" dir="ltr">
        YOUR DAILY PAUSE
      </span>
      <span ref={cueRef} className="scroll-cue" aria-hidden="true">
        <span className="scroll-cue-line" />
      </span>
    </h1>
  );
}

function EditorialSection({ sectionRef }) {
  return (
    <section ref={sectionRef} className="about" aria-label="درباره ما">
      <RevealBlock className="inner t-stagger">
        <h2 className="about-headline t-stagger-line t-stagger-line--1">
          احترام، سلامت و کیفیت اساس هر تجربه در ال کافه است.
        </h2>
        <p className="about-body t-stagger-line t-stagger-line--2">
          از انتخاب مواد اولیه تا شیوه میزبانی، همه‌چیز با دقت انجام می‌شود تا
          فضایی امن، گرم و آرام در میان روزهای پرمشغله شما بسازیم.
        </p>
      </RevealBlock>
    </section>
  );
}

function FeaturePhoto({ photoRef }) {
  const imageRef = useRef(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (imageRef.current?.complete) setLoaded(true);
  }, []);

  return (
    <div
      ref={photoRef}
      className="photo t-skel"
      data-armed=""
      data-revealed={loaded ? "" : undefined}
      data-state={loaded ? "loaded" : "loading"}
    >
      <div className="t-skel-skeleton is-pulsing" aria-hidden="true">
        <span />
      </div>
      <div className="t-skel-content">
        <picture>
          <source
            srcSet={FEATURE_PHOTO_SRC_SET}
            sizes="(max-width: 640px) 100vw, (min-width: 1750px) calc(100vw - 140px), 92vw"
            type="image/webp"
          />
          <img
            ref={imageRef}
            src={FEATURE_PHOTO_FALLBACK}
            width="1586"
            height="992"
            alt="چراغ آویز دست‌ساز ال کافه با پیکره‌های پرنده، مقابل دیوارنگاره و گیاهان سالن"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
          />
        </picture>
      </div>
    </div>
  );
}

function MenuEntry({ sectionRef }) {
  return (
    <section ref={sectionRef} className="menu" aria-label="منو">
      <RevealBlock className="inner t-stagger">
        <div className="menu-support">
          <p className="body t-stagger-line t-stagger-line--1">
            انتخاب‌هایی سالم و باکیفیت، با دقت آماده شده‌اند تا برای هر لحظه از
            روز، طعمی شایسته شما بسازند.
          </p>
          <a className="cta" href={MENU_HREF}>
            مشاهده منو
          </a>
        </div>
      </RevealBlock>
    </section>
  );
}

function ClosingSection({ footerRef }) {
  return (
    <footer ref={footerRef} className="contact" aria-label="اطلاعات تماس">
      <RevealBlock className="inner t-stagger">
        <h2 className="contact-title t-stagger-line t-stagger-line--1">
          منتظرتونیم
        </h2>
        <div className="contact-body t-stagger-line t-stagger-line--2">
          <div className="contact-location">
            <p className="contact-address">
              خیابان چهارباغ بالا، نبش کوچه یحیی خان، مجتمع متروپل
            </p>
            <p className="contact-hours">ساعت ۷ تا ۲۳</p>
          </div>
          <div className="contact-links">
            <a href="tel:+989130005768">
              <bdi>۰۹۱۳ ۰۰۰ ۵۷۶۸</bdi>
            </a>
            <a
              href="https://maps.app.goo.gl/UcyaTAH42vChA7RA9"
              target="_blank"
              rel="noopener noreferrer"
            >
              مسیر روی نقشه
            </a>
            <a
              href="https://www.instagram.com/lcafe.esf/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="اینستاگرام ال کافه"
            >
              <bdi>@lcafe.esf</bdi>
            </a>
          </div>
        </div>
      </RevealBlock>
    </footer>
  );
}

export function LandingApp() {
  const fieldRef = useRef(null);
  const heroRef = useRef(null);
  const phraseRef = useRef(null);
  const cueRef = useRef(null);
  const aboutRef = useRef(null);
  const photoRef = useRef(null);
  const menuRef = useRef(null);
  const contactRef = useRef(null);

  useHeroMotion({
    aboutRef,
    contactRef,
    cueRef,
    fieldRef,
    heroRef,
    menuRef,
    photoRef,
    phraseRef,
  });

  return (
    <>
      <div ref={fieldRef} className="field" aria-hidden="true" />
      <div className="page">
        <a className="skip" href="#about">
          رفتن به محتوای اصلی
        </a>
        <Hero cueRef={cueRef} heroRef={heroRef} phraseRef={phraseRef} />
        <main id="about">
          <EditorialSection sectionRef={aboutRef} />
          <FeaturePhoto photoRef={photoRef} />
          <MenuEntry sectionRef={menuRef} />
        </main>
        <ClosingSection footerRef={contactRef} />
      </div>
    </>
  );
}
