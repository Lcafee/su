import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { MenuApp } from "./MenuApp";
import { loadMenuSnapshot } from "./menuSnapshot";
import "../styles/menu.css";

const snapshotRequest = loadMenuSnapshot();

function MenuRuntime() {
  const [state, setState] = useState({ status: "loading", snapshot: null });

  useEffect(() => {
    let active = true;
    snapshotRequest.then(
      (snapshot) => {
        if (active) setState({ status: "ready", snapshot });
      },
      () => {
        if (active) setState({ status: "failed", snapshot: null });
      },
    );
    return () => {
      active = false;
    };
  }, []);

  if (state.status === "ready") {
    return <MenuApp categories={state.snapshot.categories} />;
  }
  return (
    <main id="menu" aria-live="polite">
      <header className="menu-masthead">
        <h1>منوی ال کافه</h1>
        <span className="menu-brand-mark" aria-hidden="true">L CAFE</span>
      </header>
      <section className="menu-runtime-state">
        {state.status === "failed" ? (
          <>
            <p>دریافت منو موقتاً ممکن نیست. لطفاً دوباره تلاش کنید.</p>
            <button type="button" onClick={() => window.location.reload()}>تلاش دوباره</button>
          </>
        ) : (
          <p>در حال دریافت منو…</p>
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById("menu-root")).render(
  <StrictMode>
    <MenuRuntime />
  </StrictMode>,
);
