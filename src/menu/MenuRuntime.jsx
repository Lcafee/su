import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { loadMenuSnapshot } from "./menuSnapshot";

function hasMenuItems(snapshot) {
  return snapshot.categories.some((category) => category.items.length > 0);
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

export function useMenuNavigation({ categories, focusOnMount, reducedMotion }) {
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

  const [urlCategoryId, setUrlCategoryId] = useState(initialCategoryRef.current.id);
  const [visibleCategoryId, setVisibleCategoryId] = useState(initialCategoryRef.current.id);
  const [navOpen, setNavOpen] = useState(false);
  const sectionRefs = useRef(new Map());
  const linkRefs = useRef(new Map());
  const navRef = useRef(null);
  const triggerRef = useRef(null);
  const discoveryRef = useRef(null);
  const pendingNavigationRef = useRef(null);
  const navigationFrameRef = useRef(null);
  const navigationVersionRef = useRef(0);
  const programmaticTargetRef = useRef(null);
  const focusFrameRef = useRef(null);
  const lastReconciledLocationRef = useRef("");
  const restoreFocusRef = useRef(focusOnMount);
  const urlCategoryIdRef = useRef(urlCategoryId);
  const visibleCategoryIdRef = useRef(visibleCategoryId);
  const renderableCategoryIdsRef = useRef(renderableCategoryIds);
  const firstRenderableIdRef = useRef(firstRenderableId);

  urlCategoryIdRef.current = urlCategoryId;
  visibleCategoryIdRef.current = visibleCategoryId;
  renderableCategoryIdsRef.current = renderableCategoryIds;
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
      if (!section || !renderableCategoryIdsRef.current.has(id)) return false;
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
    if (!id || !renderableCategoryIdsRef.current.has(id)) return;
    const programmaticTarget = programmaticTargetRef.current;
    if (programmaticTarget && programmaticTarget !== id) return;
    if (programmaticTarget === id) programmaticTargetRef.current = null;

    visibleCategoryIdRef.current = id;
    setVisibleCategoryId((current) => (current === id ? current : id));
    setSelectedCategory(id, "replace");
  }, [setSelectedCategory]);

  const reconcileFromLocation = useCallback(({ focus = false, force = false } = {}) => {
    const hashId = safeHashId();
    const id = renderableCategoryIdsRef.current.has(hashId)
      ? hashId
      : firstRenderableIdRef.current;
    if (!id) return;

    const nextHash = categoryHash(id);
    if (window.location.hash !== nextHash) {
      window.history.replaceState(window.history.state, "", nextHash);
    }
    if (
      !force
      && lastReconciledLocationRef.current === id
      && urlCategoryIdRef.current === id
    ) {
      return;
    }

    lastReconciledLocationRef.current = id;
    urlCategoryIdRef.current = id;
    visibleCategoryIdRef.current = id;
    setUrlCategoryId((current) => (current === id ? current : id));
    setVisibleCategoryId((current) => (current === id ? current : id));
    closeNavigation(false);
    requestNavigation(id, { behavior: "auto", focus });
  }, [closeNavigation, requestNavigation]);

  useEffect(() => {
    schedulePendingNavigation();
  }, [renderableCategories, schedulePendingNavigation]);

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
            id: entry.target.getAttribute("aria-labelledby"),
            top: entry.target.getBoundingClientRect().top,
          }))
          .filter(({ id }) => renderableCategoryIdsRef.current.has(id));
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
      if (renderableCategoryIds.has(id)) observer.observe(section);
    }
    return () => observer.disconnect();
  }, [applyVisibleCategory, renderableCategories, renderableCategoryIds]);

  useEffect(() => {
    if (!navOpen) return undefined;

    const activeLink = linkRefs.current.get(visibleCategoryId)
      ?? linkRefs.current.values().next().value;
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
  }, [closeNavigation, navOpen, visibleCategoryId]);

  useEffect(() => () => {
    cancelPendingNavigation();
    if (focusFrameRef.current !== null) {
      window.cancelAnimationFrame(focusFrameRef.current);
    }
  }, [cancelPendingNavigation]);

  const selectCategory = useCallback(
    (event, id) => {
      event.preventDefault();
      if (!renderableCategoryIdsRef.current.has(id)) return;

      if (focusFrameRef.current !== null) {
        window.cancelAnimationFrame(focusFrameRef.current);
        focusFrameRef.current = null;
      }
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

  const activeId = renderableCategoryIds.has(visibleCategoryId)
    ? visibleCategoryId
    : urlCategoryId;
  const activeTitle = renderableCategories.find(
    (category) => category.id === activeId,
  )?.title ?? "";
  const toggleNavigation = useCallback(() => {
    setNavOpen((current) => !current);
  }, []);

  return {
    activeId,
    activeTitle,
    closeNavigation,
    discoveryRef,
    linkRefs,
    navOpen,
    navRef,
    registerSection,
    renderableCategories,
    sectionRefs,
    selectCategory,
    toggleNavigation,
    triggerRef,
  };
}

function MenuLoadingState() {
  return (
    <section className="menu-runtime-state menu-runtime-loading">
      <p className="sr-only">در حال دریافت منو…</p>
      <div className="menu-loading-skeleton" aria-hidden="true">
        <div className="menu-loading-heading">
          <span />
          <span />
        </div>
        <div className="menu-loading-grid">
          {[0, 1].map((slot) => (
            <div key={slot} className="menu-loading-card">
              <span className="menu-loading-photo" />
              <span className="menu-loading-copy">
                <i />
                <i />
                <i />
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MenuMessageState({ headingRef, onRetry, status }) {
  const empty = status === "empty";
  return (
    <section className="menu-runtime-state menu-runtime-message">
      <div className="menu-runtime-copy">
        <h1 ref={headingRef} tabIndex="-1">
          {empty ? "منو در حال به‌روزرسانی است" : "منو در دسترس نیست"}
        </h1>
        <p>
          {empty
            ? "در حال حاضر موردی برای نمایش ثبت نشده است. کمی بعد دوباره بررسی کنید."
            : "ارتباط با منو برقرار نشد. اتصال خود را بررسی کنید و دوباره تلاش کنید."}
        </p>
        <button type="button" onClick={onRetry}>
          {empty ? "به‌روزرسانی منو" : "تلاش دوباره"}
        </button>
      </div>
    </section>
  );
}

export function MenuRuntime({ AppComponent, MastheadComponent }) {
  const [requestVersion, setRequestVersion] = useState(0);
  const [state, setState] = useState({
    status: "loading",
    result: null,
    restoreFocus: false,
  });
  const requestGenerationRef = useRef(0);
  const focusAfterRequestRef = useRef(false);
  const messageHeadingRef = useRef(null);

  useEffect(() => {
    let active = true;
    const generation = requestGenerationRef.current + 1;
    requestGenerationRef.current = generation;
    loadMenuSnapshot({ force: requestVersion > 0 }).then(
      (result) => {
        if (!active || generation !== requestGenerationRef.current) return;
        const restoreFocus = focusAfterRequestRef.current;
        focusAfterRequestRef.current = false;
        setState({
          status: hasMenuItems(result.snapshot) ? "ready" : "empty",
          result,
          restoreFocus,
        });
      },
      () => {
        if (!active || generation !== requestGenerationRef.current) return;
        const restoreFocus = focusAfterRequestRef.current;
        focusAfterRequestRef.current = false;
        setState({ status: "unavailable", result: null, restoreFocus });
      },
    );
    return () => {
      active = false;
    };
  }, [requestVersion]);

  useEffect(() => {
    if (!state.restoreFocus || state.status === "loading" || state.status === "ready") {
      return undefined;
    }
    const frame = window.requestAnimationFrame(() => {
      messageHeadingRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [state.restoreFocus, state.status]);

  const refreshMenu = () => {
    focusAfterRequestRef.current = true;
    setState({ status: "loading", result: null, restoreFocus: false });
    setRequestVersion((current) => current + 1);
  };

  if (state.status === "ready") {
    return (
      <AppComponent
        categories={state.result.snapshot.categories}
        focusOnMount={state.restoreFocus}
        snapshotSource={state.result.source}
        onRefresh={refreshMenu}
      />
    );
  }
  return (
    <main id="menu" aria-live="polite" aria-busy={state.status === "loading"}>
      <MastheadComponent />
      {state.status === "loading" ? (
        <MenuLoadingState />
      ) : (
        <MenuMessageState
          headingRef={messageHeadingRef}
          status={state.status}
          onRetry={refreshMenu}
        />
      )}
    </main>
  );
}
