import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import TomoTypeApp from "../app/page";
import "../app/globals.css";
import "./mobile.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TomoTypeApp />
  </StrictMode>,
);
