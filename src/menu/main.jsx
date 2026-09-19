import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { MenuApp, MenuMasthead } from "./MenuApp";
import { MenuRuntime } from "./MenuRuntime";
import "../styles/menu.css";
import { MenuBackgrounds } from "./MenuBackgrounds";

createRoot(document.getElementById("menu-root")).render(
  <StrictMode>
    <MenuBackgrounds />
    <MenuRuntime AppComponent={MenuApp} MastheadComponent={MenuMasthead} />
  </StrictMode>,
);
