import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { SettingsPage } from "./pages/SettingsPage";
import { DisplayPage } from "./pages/DisplayPage";
import { getLocalRoomId } from "./lib/room";
import { ROOM_ID_PATTERN } from "./lib/protocol";

function App() {
  const path = location.pathname.replace(/\/+$/, "");
  if (path === "/display") return <DisplayPage />;
  const remote = path.match(/^\/r\/([^/]+)$/)?.[1];
  if (remote && ROOM_ID_PATTERN.test(remote)) {
    return <SettingsPage roomId={remote} isLocal={remote === getLocalRoomId()} />;
  }
  return <SettingsPage roomId={getLocalRoomId()} isLocal />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
