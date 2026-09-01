import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import { MenuApp, MenuMasthead } from "./MenuApp";
import { loadMenuSnapshot } from "./menuSnapshot";
import "../styles/menu.css";

function hasMenuItems(snapshot) {
  return snapshot.categories.some((category) => category.items.length > 0);
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

function MenuRuntime() {
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
      <MenuApp
        categories={state.result.snapshot.categories}
        focusOnMount={state.restoreFocus}
        snapshotSource={state.result.source}
        onRefresh={refreshMenu}
      />
    );
  }
  return (
    <main id="menu" aria-live="polite" aria-busy={state.status === "loading"}>
      <MenuMasthead />
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

createRoot(document.getElementById("menu-root")).render(
  <StrictMode>
    <MenuRuntime />
  </StrictMode>,
);
