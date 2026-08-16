import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { MetalFx } from "metal-fx";

import { sitePath } from "../sitePath";

const METAL_FX_CATEGORY_ID = "cat-routine";
const PLACEHOLDER_PHOTO = "item-placeholder.webp";
const SUMMER_IMAGES_ENABLED = false;
const SUMMER_PHOTO_PREFIXES = ["cl-", "fr-", "it-", "rf-"];

let sharedDescriptionObserver;
const descriptionMeasurements = new Map();

function observeDescription(element, measure) {
  if (!("ResizeObserver" in window)) return () => {};

  if (!sharedDescriptionObserver) {
    sharedDescriptionObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        descriptionMeasurements.get(entry.target)?.();
      }
    });
  }

  descriptionMeasurements.set(element, measure);
  sharedDescriptionObserver.observe(element);

  return () => {
    sharedDescriptionObserver?.unobserve(element);
    descriptionMeasurements.delete(element);
    if (descriptionMeasurements.size === 0) {
      sharedDescriptionObserver?.disconnect();
      sharedDescriptionObserver = undefined;
    }
  };
}

function publishedPhotoName(photo) {
  if (!photo) return PLACEHOLDER_PHOTO;
  if (
    !SUMMER_IMAGES_ENABLED &&
    SUMMER_PHOTO_PREFIXES.some((prefix) => photo.startsWith(prefix))
  ) {
    return PLACEHOLDER_PHOTO;
  }
  return photo;
}

function responsivePhoto(photo) {
  const name = publishedPhotoName(photo);
  const smaller = name.replace(/\.webp$/i, "-300.webp");
  return {
    src: sitePath(`assets/menu/opt/${name}`),
    srcSet: [
      `${sitePath(`assets/menu/opt/${smaller}`)} 300w`,
      `${sitePath(`assets/menu/opt/${name}`)} 600w`,
    ].join(", "),
  };
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return undefined;
    const update = () => setReduced(query.matches);
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  return reduced;
}

const MetalCategoryFrame = memo(function MetalCategoryFrame({ children }) {
  const reducedMotion = useReducedMotion();

  return (
    <div
      className="category-metal-frame"
      data-metal-fx-prototype="true"
      data-metal-fx-package="metal-fx"
    >
      <MetalFx
        variant="button"
        preset="chromatic"
        theme="light"
        strength={1}
        paused={reducedMotion}
        borderRadius={14}
        ringCssPx={3}
        shaderScale={1.45}
        normalizeHostStyles={false}
        style={{ display: "flex", width: "100%" }}
      >
        {children}
      </MetalFx>
    </div>
  );
});

const CategoryHeader = memo(function CategoryHeader({ category, prototype }) {
  const content = (
    <div className={`cat-head${prototype ? " cat-head--metal" : ""}`}>
      <h2 id={category.id} tabIndex="-1">
        {category.title}
      </h2>
      <p>{category.intro}</p>
    </div>
  );

  if (!prototype) return content;

  return <MetalCategoryFrame>{content}</MetalCategoryFrame>;
});

const ProductPhoto = memo(function ProductPhoto({ eager, item, priority }) {
  const imageRef = useRef(null);
  const [ready, setReady] = useState(false);
  const photo = responsivePhoto(item.photo);

  useEffect(() => {
    if (imageRef.current?.complete) setReady(true);
  }, []);

  return (
    <div className="item-photo t-avatar" data-ready={ready ? "" : undefined}>
      <img
        ref={imageRef}
        src={photo.src}
        srcSet={photo.srcSet}
        sizes="(min-width: 880px) 285px, 38vw"
        width="600"
        height="600"
        alt=""
        decoding="async"
        loading={eager ? undefined : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        onLoad={() => setReady(true)}
        onError={() => setReady(true)}
      />
    </div>
  );
});

function ProductDescription({ description, itemName, slotId }) {
  const paragraphRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const descriptionId = `description-${slotId}`;

  const measure = useCallback(() => {
    const paragraph = paragraphRef.current;
    if (!paragraph || expanded) return;
    const overflow = paragraph.scrollHeight > paragraph.clientHeight + 1;
    setHasOverflow((current) => (current === overflow ? current : overflow));
  }, [expanded]);

  useLayoutEffect(() => {
    const paragraph = paragraphRef.current;
    if (!paragraph || expanded) return undefined;
    measure();
    return observeDescription(paragraph, measure);
  }, [description, expanded, measure]);

  useEffect(() => {
    document.fonts?.ready.then(measure).catch(() => {});
  }, [measure]);

  return (
    <>
      <p ref={paragraphRef} id={descriptionId} data-open={expanded ? "" : undefined}>
        {description}
      </p>
      <button
        className="more"
        type="button"
        aria-expanded={expanded}
        aria-controls={descriptionId}
        aria-label={`${expanded ? "بستن توضیح" : "توضیح کامل"} ${itemName}`}
        hidden={!expanded && !hasOverflow}
        onClick={() => setExpanded((current) => !current)}
      >
        {expanded ? "کمتر" : "بیشتر"}
      </button>
    </>
  );
}

function VariantSelector({ item }) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  return (
    <div className="opts" role="radiogroup" aria-label={`انتخاب ${item.name}`}>
      {item.options.map((option, index) => (
        <label
          key={`${option.label}-${option.code}`}
          className="opts-option"
          data-selected={selectedIndex === index}
        >
          <input
            className="sr-only"
            type="radio"
            name={`variant-${item.slotId}`}
            value={option.code}
            checked={selectedIndex === index}
            onChange={() => setSelectedIndex(index)}
          />
          <span className="opts-option-label">{option.label}</span>
          <span className="opts-option-price">{option.price}</span>
        </label>
      ))}
    </div>
  );
}

const ProductCard = memo(function ProductCard({ eager, item, priority }) {
  return (
    <article className="item">
      <ProductPhoto eager={eager} item={item} priority={priority} />
      <h3>{item.name}</h3>
      <ProductDescription
        description={item.desc}
        itemName={item.name}
        slotId={item.slotId}
      />
      {item.options ? <VariantSelector item={item} /> : <strong>{item.price}</strong>}
    </article>
  );
});

const ProductGrid = memo(function ProductGrid({ category, firstCategory }) {
  return (
    <div className="grid">
      {category.items.map((item, index) => (
        <ProductCard
          key={item.slotId}
          item={item}
          eager={firstCategory && index < 4}
          priority={firstCategory && index < 2}
        />
      ))}
    </div>
  );
});

const AddOnList = memo(function AddOnList({ items }) {
  return (
    <dl className="addons">
      {items.map((item) => (
        <div key={item.name}>
          <dt>{item.name}</dt>
          <dd>{item.price}</dd>
        </div>
      ))}
    </dl>
  );
});

const CategorySection = memo(function CategorySection({
  category,
  firstCategory,
  registerSection,
}) {
  return (
    <section
      ref={(node) => registerSection(category.id, node)}
      className="cat"
      aria-labelledby={category.id}
    >
      <CategoryHeader
        category={category}
        prototype={category.id === METAL_FX_CATEGORY_ID}
      />
      {category.layout === "addons" ? (
        <AddOnList items={category.items} />
      ) : (
        <ProductGrid category={category} firstCategory={firstCategory} />
      )}
    </section>
  );
});

function CategoryNavigation({
  activeId,
  categories,
  linkRefs,
  navRef,
  onClose,
  onSelect,
  open,
}) {
  return (
    <nav
      ref={navRef}
      className="category-nav"
      id="category-nav"
      aria-labelledby="category-nav-title"
      hidden={!open}
    >
      <div className="category-nav-head">
        <h2 id="category-nav-title">دسته‌های منو</h2>
        <button className="nav-close" type="button" onClick={() => onClose(true)}>
          بستن
        </button>
      </div>
      <div className="category-links">
        {categories.map((category) => {
          const active = category.id === activeId;
          return (
            <a
              key={category.id}
              ref={(node) => {
                if (node) linkRefs.current.set(category.id, node);
                else linkRefs.current.delete(category.id);
              }}
              className={active ? "on" : undefined}
              href={`#${category.id}`}
              aria-current={active ? "location" : undefined}
              onClick={(event) => onSelect(event, category.id)}
            >
              <i aria-hidden="true" />
              <span>{category.title}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}

const MenuFooter = memo(function MenuFooter() {
  return (
    <footer className="foot">
      <img
        src={sitePath("uploads/L_Cafe_Full_NoTagline_White.svg")}
        alt="ال کافه"
      />
      <a href="tel:+989130005768">
        <bdi>۰۹۱۳ ۰۰۰ ۵۷۶۸</bdi>
      </a>
      <a
        href="https://www.instagram.com/lcafe.esf/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="اینستاگرام ال کافه"
      >
        <bdi>@lcafe.esf</bdi>
      </a>
      <a className="foot-back" href={sitePath("index.html")}>
        بازگشت به صفحه اصلی
      </a>
    </footer>
  );
});

export function MenuApp({ categories }) {
  const [activeId, setActiveId] = useState(() => {
    const hashId = decodeURIComponent(window.location.hash.slice(1));
    return categories.some((category) => category.id === hashId)
      ? hashId
      : (categories[0]?.id ?? "");
  });
  const [navOpen, setNavOpen] = useState(false);
  const sectionRefs = useRef(new Map());
  const linkRefs = useRef(new Map());
  const navRef = useRef(null);
  const triggerRef = useRef(null);

  const registerSection = useCallback((id, node) => {
    if (node) sectionRefs.current.set(id, node);
    else sectionRefs.current.delete(id);
  }, []);

  const closeNavigation = useCallback((returnFocus = false) => {
    setNavOpen(false);
    if (returnFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = entry.target.getAttribute("aria-labelledby");
          setActiveId((current) => (current === id ? current : id));
        }
      },
      { rootMargin: "-18% 0px -72% 0px" },
    );

    for (const section of sectionRefs.current.values()) observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!navOpen) return undefined;

    const activeLink = linkRefs.current.get(activeId) ?? linkRefs.current.values().next().value;
    const focusFrame = window.requestAnimationFrame(() => activeLink?.focus());
    const onPointerDown = (event) => {
      if (
        navRef.current?.contains(event.target) ||
        triggerRef.current?.contains(event.target)
      ) {
        return;
      }
      closeNavigation(true);
    };
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeNavigation(true);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [activeId, closeNavigation, navOpen]);

  const selectCategory = useCallback(
    (event, id) => {
      event.preventDefault();
      const section = sectionRefs.current.get(id);
      if (!section) return;
      setActiveId(id);
      closeNavigation(false);
      window.history.pushState(null, "", `#${id}`);
      section.querySelector("h2")?.focus({ preventScroll: true });
      section.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    },
    [closeNavigation],
  );

  const activeTitle =
    categories.find((category) => category.id === activeId)?.title ?? "";

  return (
    <>
      <a className="skip" href="#menu">
        رفتن به منو
      </a>
      <button
        ref={triggerRef}
        className="category-trigger"
        type="button"
        aria-expanded={navOpen}
        aria-controls="category-nav"
        onClick={() => setNavOpen((current) => !current)}
      >
        <span className="category-trigger-label">دسته‌ها</span>
        <span className="category-trigger-current" aria-hidden="true">
          {activeTitle}
        </span>
      </button>
      <main id="menu">
        <h1 className="sr-only">منوی ال کافه</h1>
        {categories.map((category, index) => (
          <CategorySection
            key={category.id}
            category={category}
            firstCategory={index === 0}
            registerSection={registerSection}
          />
        ))}
      </main>
      <CategoryNavigation
        activeId={activeId}
        categories={categories}
        linkRefs={linkRefs}
        navRef={navRef}
        onClose={closeNavigation}
        onSelect={selectCategory}
        open={navOpen}
      />
      <MenuFooter />
    </>
  );
}
