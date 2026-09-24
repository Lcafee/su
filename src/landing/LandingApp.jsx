import { useEffect, useState } from "react";
import { sitePath } from "../sitePath";
import logoWhite from "../../assets/brand/l-cafe-full-white.svg";
import logoScarlet from "../../assets/brand/l-cafe-full-scarlet.svg";
import heroMobile from "../../assets/home/hero-mobile.webp";
import heroDesktop from "../../assets/home/hero-desktop.webp";
import storyCoffee from "../../assets/home/story-coffee.webp";
import menuEspresso from "../../assets/home/menu-espresso.webp";
import menuPastry from "../../assets/home/menu-pastry.webp";
import sculpturalLight from "../../assets/l-cafe-sculptural-light.webp";

const MENU_HREF = sitePath(import.meta.env.BASE_URL === "/" ? "menu" : "menu/");
const MAP_HREF = "https://www.google.com/maps/dir/?api=1&destination=L%20Cafe&destination_place_id=ChIJHwiIQwA3vD8RouGWwXbq5GI";

function TextLink({ children, href, className = "", external = false }) {
  return (
    <a className={`home-text-link ${className}`.trim()} href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      <span>{children}</span><span aria-hidden="true" className="home-text-link-arrow">←</span>
    </a>
  );
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => { if (event.key === "Escape") setMenuOpen(false); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);
  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <header className="home-header">
        <a className="home-header-brand" href="#top" aria-label="ال کافه، بازگشت به آغاز">
          <img src={logoWhite} width="132" height="70" alt="L Cafe" />
        </a>
        <nav className="home-desktop-nav" aria-label="پیمایش اصلی">
          <a href="#story">داستان ما</a><a href="#visit">دیدار با ما</a>
          <a className="home-desktop-menu" href={MENU_HREF}>منو <span aria-hidden="true">↗</span></a>
        </nav>
        <button className="home-menu-toggle" type="button" aria-controls="home-mobile-nav"
          aria-expanded={menuOpen} aria-label="باز کردن فهرست" onClick={() => setMenuOpen(true)}>
          <span className="home-menu-toggle-lines" aria-hidden="true"><i /><i /></span><span>فهرست</span>
        </button>
      </header>
      <nav className="home-mobile-nav" id="home-mobile-nav" aria-label="فهرست پیمایش"
        aria-hidden={!menuOpen} data-open={menuOpen}>
        <div className="home-mobile-nav-top">
          <img src={logoWhite} width="126" height="66" alt="L Cafe" />
          <button type="button" className="home-close" onClick={closeMenu} aria-label="بستن فهرست">×</button>
        </div>
        <div className="home-mobile-nav-links">
          <a href="#story" onClick={closeMenu}>داستان ما</a>
          <a href={MENU_HREF} onClick={closeMenu}>منو</a>
          <a href="#visit" onClick={closeMenu}>دیدار با ما</a>
        </div>
        <p className="home-mobile-nav-foot">ال کافه · چهارباغ بالا، اصفهان</p>
      </nav>
    </>
  );
}

function Hero() {
  return (
    <section className="home-hero" id="top" aria-labelledby="home-hero-title">
      <picture className="home-hero-picture">
        <source media="(min-width: 768px)" srcSet={heroDesktop} />
        <img src={heroMobile} width="900" height="1599"
          alt="تصویر مفهومی از فضایی گرم و صمیمی در کافه" fetchPriority="high" decoding="async" />
      </picture>
      <Header />
      <div className="home-hero-content">
        <h1 id="home-hero-title">جایی برای ماندن<br />در لحظه</h1>
        <p>میان عطر قهوه و آرامش چهارباغ</p>
        <TextLink href="#story" className="home-hero-link">کشف ال کافه</TextLink>
      </div>
      <span className="home-hero-index" aria-hidden="true">L CAFE&nbsp; / &nbsp;ISFAHAN</span>
    </section>
  );
}

function Story() {
  return (
    <section className="home-story" id="story" aria-labelledby="home-story-title">
      <div className="home-story-copy">
        <h2 id="home-story-title">برای لحظه‌هایی<br />که عجله ندارند</h2>
        <p>در ال کافه، فنجان‌ها و گفت‌وگوها فرصت پیدا می‌کنند آرام‌تر پیش بروند. اینجا جایی برای مکث، دیدار و لذت بردن از کنار هم بودن است.</p>
        <div className="home-section-rule" aria-hidden="true"><span>۰۱</span></div>
      </div>
      <figure className="home-story-figure">
        <img src={storyCoffee} width="900" height="1125" loading="lazy" decoding="async"
          alt="تصویر مفهومی از فنجان قهوه بر میز چوبی در نور عصر" />
        <figcaption>گاهی یک مکث، تمام چیزی‌ست که نیاز داریم.</figcaption>
      </figure>
    </section>
  );
}

function Signature() {
  return (
    <section className="home-signature" aria-labelledby="home-signature-title">
      <div className="home-signature-image">
        <img src={sculpturalLight} width="1586" height="992" loading="lazy" decoding="async"
          alt="چراغ آویز دست‌ساز ال کافه با پیکره‌های پرنده در فضای کافه" />
      </div>
      <div className="home-signature-copy">
        <span className="home-section-number">۰۲ / ال کافه</span>
        <h2 id="home-signature-title">هر گوشه،<br />نشانی از ما</h2>
        <p>از نور و رنگ تا جزئیاتی که می‌بینید، فضا برای ساختن یک حس ماندگار شکل گرفته است.</p>
      </div>
    </section>
  );
}

function MenuInvitation() {
  return (
    <section className="home-menu" id="menu" aria-labelledby="home-menu-title">
      <div className="home-menu-copy">
        <h2 id="home-menu-title">طعم هر لحظه</h2>
        <p>از قهوه‌ی اول روز تا شیرینیِ یک قرار طولانی، انتخابی برای حال‌وهوای شما هست.</p>
        <TextLink href={MENU_HREF} className="home-menu-link">دیدن منو</TextLink>
      </div>
      <div className="home-menu-gallery" aria-label="تصاویر مفهومی از نوشیدنی و شیرینی">
        <figure className="home-menu-gallery-item home-menu-gallery-item--coffee">
          <img src={menuEspresso} width="850" height="1062" loading="lazy" decoding="async"
            alt="تصویر مفهومی از آماده شدن قهوه اسپرسو" />
          <figcaption>فنجانی برای آغاز</figcaption>
        </figure>
        <figure className="home-menu-gallery-item home-menu-gallery-item--pastry">
          <img src={menuPastry} width="850" height="1062" loading="lazy" decoding="async"
            alt="تصویر مفهومی از شیرینی پسته‌ای در فضای کافه" />
          <figcaption>لحظه‌ای برای لذت</figcaption>
        </figure>
      </div>
    </section>
  );
}

function Visit() {
  return (
    <section className="home-visit" id="visit" aria-labelledby="home-visit-title">
      <div className="home-visit-main">
        <h2 id="home-visit-title">اینجا،<br />وقت شماست.</h2>
        <p>در قلب چهارباغ، برای فنجان بعدی و گفت‌وگوی بعدی منتظرتان هستیم.</p>
        <TextLink href={MAP_HREF} external className="home-visit-link">مسیر رسیدن</TextLink>
      </div>
      <div className="home-visit-details">
        <div><span className="home-detail-label">نشانی</span>
          <p>اصفهان، خیابان چهارباغ بالا، نبش کوچه یحیی خان، مجتمع متروپل</p></div>
        <div><span className="home-detail-label">ساعت دیدار</span><p>هر روز، از ۷ تا ۲۳</p></div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="home-footer">
      <a href="#top" className="home-footer-logo" aria-label="ال کافه، بازگشت به آغاز">
        <img src={logoScarlet} width="154" height="81" alt="L Cafe" />
      </a>
      <div className="home-footer-links">
        <a href="tel:+989130005767"><bdi dir="ltr">09130005767</bdi></a>
        <a href="https://www.instagram.com/lcafe.esf/" target="_blank" rel="noopener noreferrer"><bdi dir="ltr">@lcafe.esf</bdi></a>
      </div>
      <p>ال کافه · چهارباغ بالا، اصفهان</p>
    </footer>
  );
}

export function LandingApp() {
  return (
    <div className="home-page">
      <a className="home-skip" href="#story">رفتن به محتوای اصلی</a>
      <Hero />
      <main><Story /><Signature /><MenuInvitation /><Visit /></main>
      <Footer />
    </div>
  );
}
