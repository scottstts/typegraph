import "@xyflow/react/dist/style.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HostedApp } from "./hosted/HostedApp.js";
import "./styles/app.css";
import "./styles/hosted.css";

const root = document.getElementById("root");

if (root === null) {
  throw new Error("Missing root element");
}

createRoot(root).render(
  <StrictMode>
    <HostedApp />
  </StrictMode>
);
