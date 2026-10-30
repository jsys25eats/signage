import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { SettingsPage } from "./pages/SettingsPage";
import { DisplayPage } from "./pages/DisplayPage";

const isDisplay = location.pathname.replace(/\/+$/, "") === "/display";

createRoot(document.getElementById("root")!).render(
  <StrictMode>{isDisplay ? <DisplayPage /> : <SettingsPage />}</StrictMode>,
);
