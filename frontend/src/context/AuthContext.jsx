// src/context/AuthContext.jsx
//
// React Context that manages authentication state globally.
//
// WHAT IS CONTEXT?
// ─────────────────
// Context lets us share data (like the logged-in user) across all components
// without having to pass it down manually through every component as props.
//
// Usage:
//   const { merchant, login, logout } = useAuth();

import { createContext, useContext, useState, useEffect } from "react";
import api from "../lib/api";

// Create the context — this is the "container" for our auth state
const AuthContext = createContext(null);

// AuthProvider wraps our entire app and provides auth state to all children
export function AuthProvider({ children }) {
  const [merchant, setMerchant]   = useState(null);
  const [loading, setLoading]     = useState(true); // true while checking if user is logged in

  // On app load, check if we have a token and fetch the merchant profile
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      // We have a token — fetch the merchant profile to confirm it's still valid
      api.get("/auth/me")
        .then((res) => setMerchant(res.data))
        .catch(() => {
          // Token is invalid or expired — clear storage
          localStorage.clear();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Login: store tokens and set merchant state
  const login = (tokens, merchantData) => {
    localStorage.setItem("access_token", tokens.access_token);
    localStorage.setItem("refresh_token", tokens.refresh_token);
    setMerchant(merchantData);
  };

  // Logout: clear everything
  const logout = () => {
    localStorage.clear();
    setMerchant(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ merchant, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook — makes it easy to use auth anywhere
// Usage: const { merchant } = useAuth();
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
