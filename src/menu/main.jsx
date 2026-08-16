import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import menuData from "../../menu.json";
import { MenuApp } from "./MenuApp";
import "../styles/menu.css";

createRoot(document.getElementById("menu-root")).render(
  <StrictMode>
    <MenuApp categories={menuData.categories} />
  </StrictMode>,
);
