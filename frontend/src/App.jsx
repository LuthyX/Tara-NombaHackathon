// src/App.jsx
//
// Root component — sets up routing and global providers.
//
// PROVIDERS (outermost to innermost):
//   QueryClientProvider → React Query (data fetching)
//   AuthProvider        → authentication state
//   Router              → URL routing
//   Toaster             → toast notifications
//
// ROUTES:
//   /              → redirect to /dashboard
//   /login         → Login page (public)
//   /register      → Register page (public)
//   /onboarding    → First workspace setup (protected)
//   /dashboard     → Main dashboard (protected)
//   /customers     → Customer list (protected)
//   /customers/:id → Customer detail (protected)

import Landing from "./pages/Landing";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";

import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";

import Login          from "./pages/Login";
import Register       from "./pages/Register";
import Onboarding     from "./pages/Onboarding";
import Dashboard      from "./pages/Dashboard";
import Customers      from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";

// Create React Query client
// staleTime: how long cached data is considered fresh (5 minutes)
// retry: how many times to retry failed requests
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry    : 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          {/* Toast notifications — top-right corner */}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "#1a1d27",
                color      : "#fff",
                border     : "1px solid #374151",
                borderRadius: "10px",
                fontSize   : "14px",
              },
              success: { iconTheme: { primary: "#E8A838", secondary: "#000" } },
            }}
          />

          <Routes>
          <Route path="/" element={<Landing />} />
            {/* Public routes */}
            <Route path="/login"    element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected routes */}
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              }
            />

            {/* Protected routes with sidebar layout */}
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard"        element={<Dashboard />} />
              <Route path="/customers"        element={<Customers />} />
              <Route path="/customers/:customerId" element={<CustomerDetail />} />
            </Route>

            {/* Default redirect */}
            <Route path="/app" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
