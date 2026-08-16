import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { LandingApp } from "./LandingApp";
import "../styles/landing.css";

createRoot(document.getElementById("landing-root")).render(
  <StrictMode>
    <LandingApp />
  </StrictMode>,
);
