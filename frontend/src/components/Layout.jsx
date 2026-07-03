// src/components/Layout.jsx
// Responsive layout — sidebar on desktop, bottom nav on mobile

import { useState } from "react";
import { NavLink, useNavigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWorkspaces, useCreateWorkspace } from "../hooks/useApi";
import { WORKSPACE_CONFIG } from "../lib/utils";
import {
  LayoutDashboard, Users, LogOut, Plus,
  ChevronDown, X, Menu
} from "lucide-react";

export default function Layout() {
  const { merchant, logout }        = useAuth();
  const { data: workspaces = [] }   = useWorkspaces();
  const { mutate: createWorkspace } = useCreateWorkspace();
  const navigate                    = useNavigate();
  const location                    = useLocation();

  const [activeWorkspaceId, setActiveWorkspaceId] = useState(
    () => localStorage.getItem("active_workspace") || workspaces[0]?.id || null
  );
  const [showWorkspacePicker, setShowWorkspacePicker] = useState(false);
  const [showNewWorkspace, setShowNewWorkspace]        = useState(false);
  const [showMobileSidebar, setShowMobileSidebar]      = useState(false);
  const [newWsForm, setNewWsForm] = useState({
    name: "", type: "landlord", carry_forward_credit: false,
  });

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const config          = activeWorkspace ? WORKSPACE_CONFIG[activeWorkspace.type] : null;

  const switchWorkspace = (workspace) => {
    setActiveWorkspaceId(workspace.id);
    localStorage.setItem("active_workspace", workspace.id);
    setShowWorkspacePicker(false);
    setShowMobileSidebar(false);
    navigate("/dashboard");
  };

  const handleCreateWorkspace = () => {
    if (!newWsForm.name.trim()) return;
    createWorkspace(newWsForm, {
      onSuccess: (newWs) => {
        switchWorkspace(newWs);
        setShowNewWorkspace(false);
        setNewWsForm({ name: "", type: "landlord", carry_forward_credit: false });
      },
    });
  };

  const navLinks = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/customers", icon: Users,           label: config?.customersLabel || "Customers" },
  ];

  // ── Sidebar content (shared between desktop + mobile drawer) ──────────────
  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-800 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#E8A838]">Tara</h1>
          <p className="text-gray-600 text-xs mt-0.5">Every payment, perfectly placed.</p>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={() => setShowMobileSidebar(false)}
          className="md:hidden text-gray-500 hover:text-white p-1"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Workspace switcher */}
      <div className="px-3 py-3 border-b border-gray-800">
        <button
          onClick={() => setShowWorkspacePicker(!showWorkspacePicker)}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-[#22263a] transition-colors text-left"
        >
          <span className="text-lg">{config?.icon || "📁"}</span>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {activeWorkspace?.name || "Select workspace"}
            </p>
            <p className="text-gray-500 text-xs">{config?.label || ""}</p>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
        </button>

        {showWorkspacePicker && (
          <div className="mt-1 bg-[#0f1117] border border-gray-700 rounded-lg overflow-hidden">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => switchWorkspace(ws)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#1a1d27] transition-colors text-left ${
                  ws.id === activeWorkspace?.id ? "bg-[#1a1d27]" : ""
                }`}
              >
                <span>{WORKSPACE_CONFIG[ws.type]?.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm truncate">{ws.name}</p>
                  <p className="text-gray-500 text-xs">{WORKSPACE_CONFIG[ws.type]?.label}</p>
                </div>
                {ws.id === activeWorkspace?.id && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#E8A838]" />
                )}
              </button>
            ))}
            <button
              onClick={() => { setShowNewWorkspace(true); setShowWorkspacePicker(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#1a1d27] border-t border-gray-800 text-[#E8A838] text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              New workspace
            </button>
          </div>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navLinks.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setShowMobileSidebar(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-[#E8A838]/10 text-[#E8A838]"
                  : "text-gray-400 hover:text-white hover:bg-[#22263a]"
              }`
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Merchant info + logout */}
      <div className="px-3 py-4 border-t border-gray-800">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-[#E8A838]/20 flex items-center justify-center text-[#E8A838] font-semibold text-sm flex-shrink-0">
            {merchant?.full_name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{merchant?.full_name}</p>
            <p className="text-gray-500 text-xs truncate">{merchant?.business_name}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/5 transition-colors text-sm"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-[#0f1117] text-white overflow-hidden">

      {/* ── Desktop Sidebar (hidden on mobile) ───────────────────────────── */}
      <aside className="hidden md:flex w-60 bg-[#1a1d27] border-r border-gray-800 flex-col flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* ── Mobile Sidebar Drawer ─────────────────────────────────────────── */}
      {showMobileSidebar && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowMobileSidebar(false)}
          />
          {/* Drawer */}
          <aside className="relative w-72 bg-[#1a1d27] border-r border-gray-800 flex flex-col h-full z-10">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#1a1d27] border-b border-gray-800 flex-shrink-0">
          <button
            onClick={() => setShowMobileSidebar(true)}
            className="text-gray-400 hover:text-white p-1"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-[#E8A838]">Tara</h1>
          <div className="text-sm text-gray-500">
            {config?.icon} {activeWorkspace?.name?.split(" ")[0]}
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto pb-20 md:pb-0">
          <Outlet context={{ activeWorkspace, config }} />
        </main>

        {/* ── Mobile Bottom Navigation ──────────────────────────────────── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#1a1d27] border-t border-gray-800 flex items-center justify-around px-4 py-2 z-40">
          {navLinks.map(({ to, icon: Icon, label }) => {
            const isActive = location.pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                className={`flex flex-col items-center gap-1 py-1 px-4 rounded-lg transition-colors ${
                  isActive ? "text-[#E8A838]" : "text-gray-500"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs">{label}</span>
              </NavLink>
            );
          })}
          {/* Add button — quick action on mobile */}
          <button
            onClick={() => navigate("/customers")}
            className="flex flex-col items-center gap-1 py-1 px-4 text-gray-500"
          >
            <div className="w-8 h-8 rounded-full bg-[#E8A838] flex items-center justify-center">
              <Plus className="w-4 h-4 text-black" />
            </div>
            <span className="text-xs">Add</span>
          </button>
        </nav>
      </div>

      {/* ── New Workspace Modal ───────────────────────────────────────────── */}
      {showNewWorkspace && (
        <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d27] border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold">New workspace</h3>
              <button onClick={() => setShowNewWorkspace(false)}>
                <X className="w-5 h-5 text-gray-500 hover:text-white" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm block mb-1.5">Name</label>
                <input
                  autoFocus
                  value={newWsForm.name}
                  onChange={(e) => setNewWsForm({ ...newWsForm, name: e.target.value })}
                  className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#E8A838]"
                  placeholder="e.g. Lekki Phase 1 Properties"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm block mb-1.5">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(WORKSPACE_CONFIG).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => setNewWsForm({ ...newWsForm, type: key })}
                      className={`flex flex-col items-center gap-1 py-3 rounded-lg border text-xs transition-colors ${
                        newWsForm.type === key
                          ? "border-[#E8A838] bg-[#E8A838]/10 text-[#E8A838]"
                          : "border-gray-700 text-gray-400 hover:border-gray-600"
                      }`}
                    >
                      <span className="text-xl">{cfg.icon}</span>
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newWsForm.carry_forward_credit}
                  onChange={(e) => setNewWsForm({ ...newWsForm, carry_forward_credit: e.target.checked })}
                  className="accent-[#E8A838]"
                />
                <span className="text-gray-400 text-sm">Carry forward overpayments</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowNewWorkspace(false)}
                  className="flex-1 py-2.5 rounded-lg border border-gray-700 text-gray-400 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateWorkspace}
                  disabled={!newWsForm.name.trim()}
                  className="flex-1 py-2.5 rounded-lg bg-[#E8A838] hover:bg-[#d4941f] text-black font-semibold text-sm disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
