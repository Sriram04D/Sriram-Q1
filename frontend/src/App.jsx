
import { useState } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

export default function App() {
  const [token, setToken] = useState(
    sessionStorage.getItem("token")
  );

  function handleLogout() {
    sessionStorage.removeItem("token");
    setToken(null);
  }

  if (!token) {
    return <Login onLogin={setToken} />;
  }

  return <Dashboard onLogout={handleLogout} />;
}
