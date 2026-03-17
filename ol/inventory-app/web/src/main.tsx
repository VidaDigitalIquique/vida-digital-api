import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import Reports from "./Reports";
import "./boot-extras";

const root = document.getElementById("root")!;
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <BootExtras />                      {/* <-- se monta aquÃ­ */}
      <Routes>
        <Route path="/reports" element={<Reports />} />
        <Route path="/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
