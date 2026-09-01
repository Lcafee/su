import {
  Component,
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { sitePath } from "../sitePath";

const LazyMetalFx = lazy(() =>
  import("metal-fx").then(({ MetalFx }) => ({ default: MetalFx })),
);

const PLACEHOLDER_IMAGE = {
  src: sitePath("assets/menu/opt/item-placeholder.webp"),
  srcSet: [
    `${sitePath("assets/menu/opt/item-placeholder-300.webp")} 300w`,
    `${sitePath("assets/menu/opt/item-placeholder.webp")} 600w`,
  ].join(", "),
  width: 600,
  height: 600,
};
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const MOBILE_MENU_QUERY = "(max-width: 759px)";
const METAL_RULE_STYLE = {
  display: "flex",
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  pointerEvents: "none",
};
const METAL_TRIGGER_STYLE = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  pointerEvents: "none",
};

let metalFxCapability;

function supportsMetalFx() {
  if (metalFxCapability !== undefined) return metalFxCapability;

  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true }) ||
      canvas.getContext("experimental-webgl", {
        failIfMajorPerformanceCaveat: true,
      });

    metalFxCapability = Boolean(gl);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    metalFxCapability = false;
  }

  return metalFxCapability;
}

class MetalFxBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    metalFxCapability = false;
    if (import.meta.env.DEV) {
      console.warn("Metal-FX disabled after initialization failure.", error);
    }
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function SafeMetalFx(props) {
  if (!supportsMetalFx()) return null;

  return (
    <MetalFxBoundary>
      <Suspense fallback={null}>
        <LazyMetalFx {...props} />
      </Suspense>
    </MetalFxBoundary>
  );
}

function useDeferredEnhancement(enabled) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setReady(false);
      return undefined;
    }

    const reveal = () => setReady(true);
    if ("requestIdleCallback" in window) {
      const idleCallback = window.requestIdleCallback(reveal, { timeout: 1400 });
      return () => window.cancelIdleCallback(idleCallback);
    }

    const fallback = window.setTimeout(reveal, 700);
    return () => window.clearTimeout(fallback);
  }, [enabled]);

  return ready;
}

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

function safeHashId() {
  const rawHash = window.location.hash.slice(1);
  if (!rawHash) return "";

  try {
    return decodeURIComponent(rawHash);
  } catch {
    return "";
  }
}

function categoryHash(id) {
  return `#${encodeURIComponent(id)}`;
}

function hasDisplayText(value) {
  return value !== null
    && value !== undefined
    && String(value).trim().length > 0;
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u200c\u200d]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("fa");
}

function filterMenuCategories(categories, query) {
  if (!query) return categories;

  return categories.flatMap((category) => {
    const categoryText = normalizeSearchText(
      [category.title, category.intro].filter(Boolean).join(" "),
    );
    const categoryMatches = categoryText.includes(query);
    const items = categoryMatches
      ? category.items
      : category.items.filter((item) => {
          const optionLabels = item.options
            ?.map((option) => option.label)
            .filter(Boolean)
            .join(" ");
          const itemText = normalizeSearchText(
            [item.name, item.description, optionLabels].filter(Boolean).join(" "),
          );
          return itemText.includes(query);
        });

    return items.length > 0 ? [{ ...category, items }] : [];
  });
}

function useMediaQuery(queryText) {
  const [matches, setMatches] = useState(
    () => window.matchMedia?.(queryText).matches ?? false,
  );

  useEffect(() => {
    const query = window.matchMedia?.(queryText);
    if (!query) return undefined;
    const update = () => setMatches(query.matches);
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, [queryText]);

  return matches;
}

const CategoryMetalRule = memo(function CategoryMetalRule({
  enhancedMetalFx,
  metalFxReady,
  reducedMotion,
}) {
  return (
    <div
      className="category-rule"
      data-metal-fx-package="metal-fx"
      aria-hidden="true"
    >
      <span className="category-rule-base" />
      {metalFxReady ? (
        <SafeMetalFx
          variant="button"
          preset="silver"
          theme="light"
          strength={enhancedMetalFx ? 0.96 : 0.58}
          paused={reducedMotion}
          borderRadius={999}
          ringCssPx={enhancedMetalFx ? 1.2 : 0.75}
          shaderScale={enhancedMetalFx ? 1.2 : 2.4}
          disableGlow={!enhancedMetalFx}
          normalizeHostStyles={false}
          className="category-rule-fx"
          style={METAL_RULE_STYLE}
        >
          <span className="category-rule-metal-host" />
        </SafeMetalFx>
      ) : null}
    </div>
  );
});

const CategoryHeader = memo(function CategoryHeader({
  category,
  enhancedMetalFx,
  metalFxReady,
  reducedMotion,
}) {
  return (
    <div className="cat-head">
      <CategoryMetalRule
        enhancedMetalFx={enhancedMetalFx}
        metalFxReady={metalFxReady}
        reducedMotion={reducedMotion}
      />
      <h2 id={category.id} tabIndex="-1">
        {category.title}
      </h2>
      <p>{category.intro}</p>
    </div>
  );
});

const ProductPhoto = memo(function ProductPhoto({ eager, item, priority }) {
  const imageRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [terminalFallback, setTerminalFallback] = useState(false);
  const photo = fallback || !item.image ? PLACEHOLDER_IMAGE : item.image;
  const usingPlaceholder = fallback || !item.image;

  useEffect(() => {
    setFallback(false);
    setReady(false);
    setTerminalFallback(false);
  }, [item.image?.src]);

  useEffect(() => {
    if (imageRef.current?.complete && imageRef.current.naturalWidth > 0) {
      setReady(true);
    }
  }, [photo.src]);

  return (
    <div className="item-photo t-avatar" data-ready={ready ? "" : undefined}>
      {terminalFallback ? (
        <span className="item-photo-empty" aria-hidden="true" />
      ) : (
        <img
          ref={imageRef}
          src={photo.src}
          srcSet={photo.srcSet || undefined}
          sizes="(max-width: 420px) calc(50vw - 15px), (max-width: 759px) calc(46vw - 5px), (max-width: 899px) calc(46vw - 9px), (max-width: 1199px) calc(441px - 4vw), 393px"
          width={photo.width || 600}
          height={photo.height || 600}
          alt=""
          decoding="async"
          loading={eager ? undefined : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          onLoad={() => setReady(true)}
          onError={() => {
            if (!usingPlaceholder) {
              setReady(false);
              setFallback(true);
              return;
            }
            setReady(true);
            setTerminalFallback(true);
          }}
        />
      )}
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

  useEffect(() => {
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

function VariantList({ item }) {
  return (
    <dl className="opts" aria-label={`گزینه‌های ${item.name}`}>
      {item.options.map((option) => (
        <div
          key={`${option.label}-${option.code}`}
          className="opts-option"
        >
          <dt className="opts-option-label">{option.label}</dt>
          <dd className="opts-option-price">{option.price}</dd>
        </div>
      ))}
    </dl>
  );
}

const ProductCard = memo(function ProductCard({ eager, item, priority }) {
  const hasOptions = item.options.length > 0;
  const hasPrice = hasDisplayText(item.price);

  return (
    <article className="item">
      <ProductPhoto eager={eager} item={item} priority={priority} />
      <div className="item-body">
        <div className="item-heading">
          <h3>{item.name}</h3>
          {!hasOptions && hasPrice ? <strong>{item.price}</strong> : null}
        </div>
        <ProductDescription
          description={item.description}
          itemName={item.name}
          slotId={item.id}
        />
        {hasOptions ? <VariantList item={item} /> : null}
      </div>
    </article>
  );
});

const ProductGrid = memo(function ProductGrid({ category, firstCategory }) {
  return (
    <div className="grid">
      {category.items.map((item, index) => (
        <ProductCard
          key={item.id}
          item={item}
          eager={firstCategory && index < 2}
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
          {hasDisplayText(item.price) ? <dd>{item.price}</dd> : null}
        </div>
      ))}
    </dl>
  );
});

const CategorySection = memo(function CategorySection({
  category,
  enhancedMetalFx,
  firstCategory,
  metalFxReady,
  reducedMotion,
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
        enhancedMetalFx={enhancedMetalFx}
        metalFxReady={metalFxReady}
        reducedMotion={reducedMotion}
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
        <h2 id="category-nav-title">فهرست منو</h2>
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
              <span className="category-link-title">{category.title}</span>
              <span className="category-link-count" aria-hidden="true">
                {category.items.length.toLocaleString("fa-IR")}
              </span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}

const MenuSearch = memo(function MenuSearch({
  inputRef,
  onChange,
  onClear,
  onFocus,
  query,
}) {
  return (
    <div className="menu-search" role="search">
      <label className="sr-only" htmlFor="menu-search-input">
        جست‌وجو در منو
      </label>
      <input
        ref={inputRef}
        id="menu-search-input"
        type="search"
        value={query}
        autoComplete="off"
        enterKeyHint="search"
        placeholder="جست‌وجو در منو"
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
      />
      {query ? (
        <button
          className="menu-search-clear"
          type="button"
          aria-label="پاک کردن جست‌وجو"
          onClick={onClear}
        >
          پاک
        </button>
      ) : null}
    </div>
  );
});

const MenuFooter = memo(function MenuFooter() {
  return (
    <footer className="foot">
      <div className="foot-inner">
        <img
          src={sitePath("assets/brand/l-cafe-full-white.svg")}
          alt="ال کافه"
        />
        <div className="foot-contact">
          <a href="tel:+989130005767">
            <bdi dir="ltr">09130005767</bdi>
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
        <a className="foot-back" href={sitePath("index.html")}>
          بازگشت به صفحه اصلی
        </a>
      </div>
    </footer>
  );
});

export const MenuMasthead = memo(function MenuMasthead() {
  return (
    <header className="menu-masthead">
      <a className="menu-back-link" href={sitePath("index.html")}>بازگشت</a>
      <span className="menu-brand-mark" aria-hidden="true">
        L
      </span>
    </header>
  );
});

const MenuIndexTrigger = memo(function MenuIndexTrigger({
  activeTitle,
  enhancedMetalFx,
  metalFxReady,
  navOpen,
  onToggle,
  reducedMotion,
  triggerRef,
}) {
  return (
    <div className="category-trigger-anchor">
      <button
        ref={triggerRef}
        className="category-trigger"
        type="button"
        aria-expanded={navOpen}
        aria-controls="category-nav"
        onClick={onToggle}
      >
        <span className="category-trigger-label">فهرست</span>
        <span className="category-trigger-current" aria-hidden="true">
          {activeTitle}
        </span>
      </button>
      {enhancedMetalFx && metalFxReady ? (
        <SafeMetalFx
          variant="button"
          preset="silver"
          theme="light"
          strength={0.94}
          paused={reducedMotion}
          borderRadius={2}
          ringCssPx={1.15}
          shaderScale={1.25}
          normalizeHostStyles={false}
          className="category-trigger-metal"
          style={METAL_TRIGGER_STYLE}
          aria-hidden="true"
        >
          <span className="category-trigger-metal-host" />
        </SafeMetalFx>
      ) : null}
    </div>
  );
});

export function MenuApp({
  categories,
  focusOnMount = false,
  onRefresh,
  snapshotSource = "current",
}) {
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const enhancedMetalFx = useMediaQuery(MOBILE_MENU_QUERY);
  const metalFxReady = useDeferredEnhancement(!reducedMotion);
  const renderableCategories = useMemo(
    () => categories.filter((category) => category.items.length > 0),
    [categories],
  );
  const renderableCategoryIds = useMemo(
    () => new Set(renderableCategories.map((category) => category.id)),
    [renderableCategories],
  );
  const firstRenderableId = renderableCategories[0]?.id ?? "";
  const initialCategoryRef = useRef({ initialized: false, id: "" });
  if (!initialCategoryRef.current.initialized) {
    const hashId = safeHashId();
    initialCategoryRef.current = {
      initialized: true,
      id: renderableCategoryIds.has(hashId) ? hashId : firstRenderableId,
    };
  }

  const [query, setQuery] = useState("");
  const [urlCategoryId, setUrlCategoryId] = useState(initialCategoryRef.current.id);
  const [visibleCategoryId, setVisibleCategoryId] = useState(initialCategoryRef.current.id);
  const [navOpen, setNavOpen] = useState(false);
  const sectionRefs = useRef(new Map());
  const linkRefs = useRef(new Map());
  const navRef = useRef(null);
  const triggerRef = useRef(null);
  const discoveryRef = useRef(null);
  const searchInputRef = useRef(null);
  const searchFeedbackRef = useRef(null);
  const pendingNavigationRef = useRef(null);
  const navigationFrameRef = useRef(null);
  const navigationVersionRef = useRef(0);
  const programmaticTargetRef = useRef(null);
  const focusFrameRef = useRef(null);
  const searchFeedbackFrameRef = useRef(null);
  const lastReconciledLocationRef = useRef("");
  const restoreFocusRef = useRef(focusOnMount);
  const urlCategoryIdRef = useRef(urlCategoryId);
  const visibleCategoryIdRef = useRef(visibleCategoryId);
  const normalizedQuery = useMemo(() => normalizeSearchText(query), [query]);
  const searching = normalizedQuery.length > 0;
  const filteredCategories = useMemo(
    () => filterMenuCategories(renderableCategories, normalizedQuery),
    [normalizedQuery, renderableCategories],
  );
  const renderedCategoryIds = useMemo(
    () => new Set(filteredCategories.map((category) => category.id)),
    [filteredCategories],
  );
  const resultCount = useMemo(
    () => filteredCategories.reduce(
      (total, category) => total + category.items.length,
      0,
    ),
    [filteredCategories],
  );
  const searchingRef = useRef(searching);
  const renderableCategoryIdsRef = useRef(renderableCategoryIds);
  const renderedCategoryIdsRef = useRef(renderedCategoryIds);
  const firstRenderableIdRef = useRef(firstRenderableId);

  urlCategoryIdRef.current = urlCategoryId;
  visibleCategoryIdRef.current = visibleCategoryId;
  searchingRef.current = searching;
  renderableCategoryIdsRef.current = renderableCategoryIds;
  renderedCategoryIdsRef.current = renderedCategoryIds;
  firstRenderableIdRef.current = firstRenderableId;

  const registerSection = useCallback((id, node) => {
    if (node) sectionRefs.current.set(id, node);
    else sectionRefs.current.delete(id);
  }, []);

  const closeNavigation = useCallback((returnFocus = false) => {
    setNavOpen(false);
    if (!returnFocus) return;
    if (focusFrameRef.current !== null) {
      window.cancelAnimationFrame(focusFrameRef.current);
    }
    focusFrameRef.current = window.requestAnimationFrame(() => {
      focusFrameRef.current = null;
      triggerRef.current?.focus({ preventScroll: true });
    });
  }, []);

  const scrollToCategory = useCallback(
    (id, { behavior = reducedMotion ? "auto" : "smooth", focus = true } = {}) => {
      const section = sectionRefs.current.get(id);
      if (!section || !renderedCategoryIdsRef.current.has(id)) return false;
      if (focus) section.querySelector("h2")?.focus({ preventScroll: true });
      section.scrollIntoView({ behavior, block: "start" });
      return true;
    },
    [reducedMotion],
  );

  const schedulePendingNavigation = useCallback(() => {
    const pending = pendingNavigationRef.current;
    if (!pending) return;
    if (navigationFrameRef.current !== null) {
      window.cancelAnimationFrame(navigationFrameRef.current);
    }
    const version = pending.version;
    navigationFrameRef.current = window.requestAnimationFrame(() => {
      navigationFrameRef.current = null;
      const current = pendingNavigationRef.current;
      if (!current || current.version !== version) return;
      if (scrollToCategory(current.id, current)) {
        if (pendingNavigationRef.current?.version === version) {
          pendingNavigationRef.current = null;
        }
      }
    });
  }, [scrollToCategory]);

  const requestNavigation = useCallback((id, options = {}) => {
    const version = navigationVersionRef.current + 1;
    navigationVersionRef.current = version;
    pendingNavigationRef.current = { ...options, id, version };
    programmaticTargetRef.current = "IntersectionObserver" in window ? id : null;
    schedulePendingNavigation();
  }, [schedulePendingNavigation]);

  const cancelPendingNavigation = useCallback(() => {
    navigationVersionRef.current += 1;
    pendingNavigationRef.current = null;
    programmaticTargetRef.current = null;
    if (navigationFrameRef.current !== null) {
      window.cancelAnimationFrame(navigationFrameRef.current);
      navigationFrameRef.current = null;
    }
  }, []);

  const setSelectedCategory = useCallback((id, mode = "replace") => {
    if (!id) return;
    const nextHash = categoryHash(id);
    if (window.location.hash !== nextHash) {
      if (mode === "push") window.history.pushState(null, "", nextHash);
      else window.history.replaceState(window.history.state, "", nextHash);
    }
    lastReconciledLocationRef.current = id;
    urlCategoryIdRef.current = id;
    setUrlCategoryId((current) => (current === id ? current : id));
  }, []);

  const applyVisibleCategory = useCallback((id) => {
    if (!id || !renderedCategoryIdsRef.current.has(id)) return;
    const programmaticTarget = programmaticTargetRef.current;
    if (programmaticTarget && programmaticTarget !== id) return;
    if (programmaticTarget === id) programmaticTargetRef.current = null;

    visibleCategoryIdRef.current = id;
    setVisibleCategoryId((current) => (current === id ? current : id));
    if (!searchingRef.current) setSelectedCategory(id, "replace");
  }, [setSelectedCategory]);

  const reconcileFromLocation = useCallback(({ focus = false, force = false } = {}) => {
    const hashId = safeHashId();
    const id = renderableCategoryIdsRef.current.has(hashId)
      ? hashId
      : firstRenderableIdRef.current;
    if (!id) return;

    const searchControlWillDisappear = Boolean(
      searchFeedbackRef.current?.contains(document.activeElement),
    );
    const nextHash = categoryHash(id);
    if (window.location.hash !== nextHash) {
      window.history.replaceState(window.history.state, "", nextHash);
    }
    if (
      !force
      && lastReconciledLocationRef.current === id
      && urlCategoryIdRef.current === id
      && !searchingRef.current
    ) {
      return;
    }

    lastReconciledLocationRef.current = id;
    urlCategoryIdRef.current = id;
    visibleCategoryIdRef.current = id;
    setUrlCategoryId((current) => (current === id ? current : id));
    setVisibleCategoryId((current) => (current === id ? current : id));
    closeNavigation(false);
    if (searchingRef.current) {
      searchingRef.current = false;
      setQuery("");
    }
    requestNavigation(id, {
      behavior: "auto",
      focus: focus || searchControlWillDisappear,
    });
  }, [closeNavigation, requestNavigation]);

  useEffect(() => {
    schedulePendingNavigation();
  }, [filteredCategories, schedulePendingNavigation]);

  useEffect(() => {
    const focus = restoreFocusRef.current;
    restoreFocusRef.current = false;
    reconcileFromLocation({ focus, force: true });
  }, [reconcileFromLocation, renderableCategories]);

  useEffect(() => {
    const syncFromLocation = () => reconcileFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    window.addEventListener("hashchange", syncFromLocation);
    return () => {
      window.removeEventListener("popstate", syncFromLocation);
      window.removeEventListener("hashchange", syncFromLocation);
    };
  }, [reconcileFromLocation]);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const candidates = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => ({
            entry,
            id: entry.target.getAttribute("aria-labelledby"),
            top: entry.target.getBoundingClientRect().top,
          }))
          .filter(({ id }) => renderedCategoryIdsRef.current.has(id));
        if (candidates.length === 0) return;

        const programmaticTarget = programmaticTargetRef.current;
        if (programmaticTarget) {
          const target = candidates.find(({ id }) => id === programmaticTarget);
          if (!target) return;
          applyVisibleCategory(target.id);
          return;
        }

        const anchor = window.innerHeight * 0.18;
        candidates.sort((left, right) => {
          const distance = Math.abs(left.top - anchor) - Math.abs(right.top - anchor);
          return distance || left.top - right.top;
        });
        applyVisibleCategory(candidates[0].id);
      },
      { rootMargin: "-18% 0px -72% 0px" },
    );

    for (const [id, section] of sectionRefs.current) {
      if (renderedCategoryIds.has(id)) observer.observe(section);
    }
    return () => observer.disconnect();
  }, [applyVisibleCategory, filteredCategories, renderedCategoryIds]);

  useEffect(() => {
    if (!navOpen) return undefined;

    const activeLink = linkRefs.current.get(
      searching
        ? (renderedCategoryIds.has(visibleCategoryId) ? visibleCategoryId : filteredCategories[0]?.id)
        : visibleCategoryId,
    ) ?? linkRefs.current.values().next().value;
    const focusFrame = window.requestAnimationFrame(() => activeLink?.focus());
    const onPointerDown = (event) => {
      if (
        navRef.current?.contains(event.target)
        || discoveryRef.current?.contains(event.target)
      ) {
        return;
      }
      closeNavigation(false);
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
  }, [
    closeNavigation,
    filteredCategories,
    navOpen,
    renderedCategoryIds,
    searching,
    visibleCategoryId,
  ]);

  useEffect(() => () => {
    cancelPendingNavigation();
    if (focusFrameRef.current !== null) {
      window.cancelAnimationFrame(focusFrameRef.current);
    }
    if (searchFeedbackFrameRef.current !== null) {
      window.cancelAnimationFrame(searchFeedbackFrameRef.current);
    }
  }, [cancelPendingNavigation]);

  const changeQuery = useCallback(
    (nextQuery) => {
      const nextNormalizedQuery = normalizeSearchText(nextQuery);
      const startingSearch = !normalizedQuery && Boolean(nextNormalizedQuery);
      const endingSearch = Boolean(normalizedQuery) && !nextNormalizedQuery;
      cancelPendingNavigation();
      searchingRef.current = nextNormalizedQuery.length > 0;
      setQuery(nextQuery);
      closeNavigation(false);
      if (endingSearch) {
        const id = renderableCategoryIdsRef.current.has(urlCategoryIdRef.current)
          ? urlCategoryIdRef.current
          : firstRenderableIdRef.current;
        if (id) {
          visibleCategoryIdRef.current = id;
          setVisibleCategoryId(id);
          requestNavigation(id, { behavior: "auto", focus: false });
        }
      }
      if (startingSearch) {
        if (searchFeedbackFrameRef.current !== null) {
          window.cancelAnimationFrame(searchFeedbackFrameRef.current);
        }
        searchFeedbackFrameRef.current = window.requestAnimationFrame(() => {
          searchFeedbackFrameRef.current = null;
          searchFeedbackRef.current?.scrollIntoView({
            behavior: reducedMotion ? "auto" : "smooth",
            block: "start",
          });
        });
      }
    },
    [
      cancelPendingNavigation,
      closeNavigation,
      normalizedQuery,
      reducedMotion,
      requestNavigation,
    ],
  );

  const clearSearch = useCallback(() => {
    const id = renderableCategoryIdsRef.current.has(urlCategoryIdRef.current)
      ? urlCategoryIdRef.current
      : firstRenderableIdRef.current;
    searchingRef.current = false;
    setQuery("");
    if (id) {
      visibleCategoryIdRef.current = id;
      setVisibleCategoryId(id);
      requestNavigation(id, { behavior: "auto", focus: false });
    }
    if (focusFrameRef.current !== null) {
      window.cancelAnimationFrame(focusFrameRef.current);
    }
    focusFrameRef.current = window.requestAnimationFrame(() => {
      focusFrameRef.current = null;
      searchInputRef.current?.focus({ preventScroll: true });
    });
  }, [requestNavigation]);

  const selectCategory = useCallback(
    (event, id) => {
      event.preventDefault();
      if (!renderableCategoryIdsRef.current.has(id)) return;

      if (focusFrameRef.current !== null) {
        window.cancelAnimationFrame(focusFrameRef.current);
        focusFrameRef.current = null;
      }
      searchingRef.current = false;
      setQuery("");
      visibleCategoryIdRef.current = id;
      setVisibleCategoryId(id);
      setSelectedCategory(id, "push");
      closeNavigation(false);
      requestNavigation(id, {
        behavior: reducedMotion ? "auto" : "smooth",
        focus: true,
      });
    },
    [closeNavigation, reducedMotion, requestNavigation, setSelectedCategory],
  );

  const activeId = searching
    ? (
      renderedCategoryIds.has(visibleCategoryId)
        ? visibleCategoryId
        : (filteredCategories[0]?.id ?? "")
    )
    : (
      renderableCategoryIds.has(visibleCategoryId)
        ? visibleCategoryId
        : urlCategoryId
    );
  const activeTitle = renderableCategories.find(
    (category) => category.id === activeId,
  )?.title ?? "";
  const toggleNavigation = useCallback(() => {
    setNavOpen((current) => !current);
  }, []);

  return (
    <>
      <a className="skip" href="#menu">
        رفتن به منو
      </a>
      <div ref={discoveryRef} className="menu-discovery">
        <MenuSearch
          inputRef={searchInputRef}
          query={query}
          onChange={changeQuery}
          onClear={clearSearch}
          onFocus={() => closeNavigation(false)}
        />
        <MenuIndexTrigger
          activeTitle={activeTitle}
          enhancedMetalFx={enhancedMetalFx}
          metalFxReady={metalFxReady}
          navOpen={navOpen}
          onToggle={toggleNavigation}
          reducedMotion={reducedMotion}
          triggerRef={triggerRef}
        />
      </div>
      <main id="menu">
        <MenuMasthead />
        {snapshotSource === "previous" ? (
          <aside
            className="menu-fallback-notice"
            aria-labelledby="menu-fallback-title"
          >
            <div>
              <h2 id="menu-fallback-title">آخرین نسخه ذخیره‌شده</h2>
              <p>نسخه تازه منو موقتاً در دسترس نیست؛ آخرین نسخه ذخیره‌شده نمایش داده می‌شود.</p>
            </div>
            {onRefresh ? (
              <button type="button" onClick={onRefresh}>
                به‌روزرسانی منو
              </button>
            ) : null}
          </aside>
        ) : null}
        <div
          ref={searchFeedbackRef}
          className="menu-search-feedback"
          aria-live="polite"
          aria-atomic="true"
          hidden={!searching}
        >
          {resultCount > 0 ? (
            <div className="menu-results-note">
              <p>
                <strong>{resultCount.toLocaleString("fa-IR")}</strong> مورد برای «{query.trim()}»
              </p>
              <button type="button" onClick={clearSearch}>
                نمایش همه
              </button>
            </div>
          ) : (
            <div className="menu-no-results">
              <h2>موردی پیدا نشد</h2>
              <p>نام دیگری را امتحان کنید یا همه منو را ببینید.</p>
              <button type="button" onClick={clearSearch}>
                نمایش همه منو
              </button>
            </div>
          )}
        </div>
        {filteredCategories.map((category, index) => (
          <CategorySection
            key={category.id}
            category={category}
            enhancedMetalFx={enhancedMetalFx}
            firstCategory={index === 0}
            metalFxReady={metalFxReady}
            reducedMotion={reducedMotion}
            registerSection={registerSection}
          />
        ))}
      </main>
      <CategoryNavigation
        activeId={activeId}
        categories={renderableCategories}
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
