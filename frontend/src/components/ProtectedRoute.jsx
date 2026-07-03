// src/components/ProtectedRoute.jsx
//
// Wraps routes that require authentication.
// If the user is not logged in, redirect them to /login.
// If we're still checking auth status (loading), show nothing.

import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { merchant, loading } = useAuth();

  // Still checking if user is logged in — show blank screen briefly
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="text-[#E8A838] text-2xl font-bold animate-pulse">Tara</div>
      </div>
    );
  }

  // Not logged in — redirect to login
  if (!merchant) {
    return <Navigate to="/login" replace />;
  }

  // Logged in — render the page
  return children;
}
