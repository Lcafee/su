import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AdminApp } from "./AdminApp";
import "../../assets/fonts/vazirmatn.css";
import "./admin.css";

createRoot(document.getElementById("admin-root")).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
);
