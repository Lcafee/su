import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { MenuApp, MenuMasthead } from "./MenuApp";
import { MenuRuntime } from "./MenuRuntime";
import "../styles/menu.css";
import { MenuJourney } from "./MenuJourney";

// The painted mural is the menu surface; it stands in for the pattern overlay.
document.documentElement.dataset.menuBackground = "journey";

createRoot(document.getElementById("menu-root")).render(
  <StrictMode>
    <MenuJourney />
    <MenuRuntime AppComponent={MenuApp} MastheadComponent={MenuMasthead} />
  </StrictMode>,
);
