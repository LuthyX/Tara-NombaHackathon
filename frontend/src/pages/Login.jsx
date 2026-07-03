// src/pages/Login.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";
import toast from "react-hot-toast";

export default function Login() {
  const navigate  = useNavigate();
  const { login } = useAuth();
  const [form, setForm]       = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Step 1 — get tokens
      const tokenRes = await api.post("/auth/login", form);
      // Step 2 — get merchant profile
      const meRes = await api.get("/auth/me", {
        headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
      });
      login(tokenRes.data, meRes.data);
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[#E8A838] tracking-tight">Tara</h1>
          <p className="text-gray-400 mt-2 text-sm">Every payment, perfectly placed.</p>
        </div>

        {/* Card */}
        <div className="bg-[#1a1d27] border border-gray-800 rounded-2xl p-8">
          <h2 className="text-white text-xl font-semibold mb-6">Welcome back</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-gray-400 text-sm block mb-1.5">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#E8A838] transition-colors"
                placeholder="you@business.com"
              />
            </div>

            <div>
              <label className="text-gray-400 text-sm block mb-1.5">Password</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#E8A838] transition-colors"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#E8A838] hover:bg-[#d4941f] text-black font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="text-gray-500 text-sm text-center mt-6">
            Don't have an account?{" "}
            <Link to="/register" className="text-[#E8A838] hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
