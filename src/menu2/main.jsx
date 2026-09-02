import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { MenuRuntime } from "../menu/MenuRuntime";
import { Menu2App, Menu2Masthead } from "./Menu2App";
import "../styles/menu2.css";

createRoot(document.getElementById("menu-root")).render(
  <StrictMode>
    <MenuRuntime AppComponent={Menu2App} MastheadComponent={Menu2Masthead} />
  </StrictMode>,
);
