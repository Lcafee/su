import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { MenuApp, MenuMasthead } from "../menu/MenuApp";
import { MenuRuntime } from "../menu/MenuRuntime";
import "../styles/menu.css";
import { DesignStudio } from "./DesignStudio";

// Same menu implementation as production; only the background layer differs.
createRoot(document.getElementById("menu-root")).render(
  <StrictMode>
    <DesignStudio />
    <MenuRuntime AppComponent={MenuApp} MastheadComponent={MenuMasthead} />
  </StrictMode>,
);
