import { StrictMode, useEffect, useState } from "react";
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

function MenuMessageState({ onRetry, status }) {
  const empty = status === "empty";
  return (
    <section className="menu-runtime-state menu-runtime-message">
      <div className="menu-runtime-copy">
        <h1>{empty ? "منو در حال به‌روزرسانی است" : "منو در دسترس نیست"}</h1>
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
  const [state, setState] = useState({ status: "loading", result: null });

  useEffect(() => {
    let active = true;
    loadMenuSnapshot({ force: requestVersion > 0 }).then(
      (result) => {
        if (!active) return;
        setState({
          status: hasMenuItems(result.snapshot) ? "ready" : "empty",
          result,
        });
      },
      () => {
        if (active) setState({ status: "unavailable", result: null });
      },
    );
    return () => {
      active = false;
    };
  }, [requestVersion]);

  const refreshMenu = () => {
    setState({ status: "loading", result: null });
    setRequestVersion((current) => current + 1);
  };

  if (state.status === "ready") {
    return (
      <MenuApp
        categories={state.result.snapshot.categories}
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
        <MenuMessageState status={state.status} onRetry={refreshMenu} />
      )}
    </main>
  );
}

createRoot(document.getElementById("menu-root")).render(
  <StrictMode>
    <MenuRuntime />
  </StrictMode>,
);
