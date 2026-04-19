import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { attachUpdaterLifecycle } from "@/tauri/startup-update";

createRoot(document.getElementById("root")!).render(<App />);
attachUpdaterLifecycle();
