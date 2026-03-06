import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { GoogleOAuthProvider } from "@react-oauth/google";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <GoogleOAuthProvider clientId="522098871996-vuo12fbja9g1gafcuq2cp5r8sg97t7vf.apps.googleusercontent.com">
      <App />
    </GoogleOAuthProvider>
  </StrictMode>
);