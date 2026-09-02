import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { MenuApp, MenuMasthead } from "./MenuApp";
import { MenuRuntime } from "./MenuRuntime";
import "../styles/menu.css";

createRoot(document.getElementById("menu-root")).render(
  <StrictMode>
    <MenuRuntime AppComponent={MenuApp} MastheadComponent={MenuMasthead} />
  </StrictMode>,
);
