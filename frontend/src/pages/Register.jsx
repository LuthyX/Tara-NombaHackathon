// src/pages/Register.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";
import toast from "react-hot-toast";

export default function Register() {
  const navigate  = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({
    full_name    : "",
    business_name: "",
    email        : "",
    password     : "",
    phone        : "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const tokenRes = await api.post("/auth/register", form);
      const meRes    = await api.get("/auth/me", {
        headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
      });
      login(tokenRes.data, meRes.data);
      toast.success("Account created! Let's set up your first workspace.");
      navigate("/onboarding");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[#E8A838] tracking-tight">Tara</h1>
          <p className="text-gray-400 mt-2 text-sm">Every payment, perfectly placed.</p>
        </div>

        <div className="bg-[#1a1d27] border border-gray-800 rounded-2xl p-8">
          <h2 className="text-white text-xl font-semibold mb-6">Create your account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-sm block mb-1.5">Full name</label>
                <input
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E8A838] transition-colors"
                  placeholder="Emeka Okafor"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm block mb-1.5">Phone</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E8A838] transition-colors"
                  placeholder="08012345678"
                />
              </div>
            </div>

            <div>
              <label className="text-gray-400 text-sm block mb-1.5">Business name</label>
              <input
                required
                value={form.business_name}
                onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#E8A838] transition-colors"
                placeholder="Sunrise Properties"
              />
            </div>

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
                placeholder="At least 8 characters"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#E8A838] hover:bg-[#d4941f] text-black font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 mt-2"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="text-gray-500 text-sm text-center mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-[#E8A838] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
