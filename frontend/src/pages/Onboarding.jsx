// src/pages/Onboarding.jsx
//
// Shown to new merchants after registration.
// Guides them through creating their first workspace.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateWorkspace } from "../hooks/useApi";
import { WORKSPACE_CONFIG } from "../lib/utils";

const TYPES = [
  {
    key        : "landlord",
    icon       : "🏠",
    title      : "Landlord",
    description: "Collect rent from tenants. Each tenant gets their own account number.",
  },
  {
    key        : "school",
    icon       : "🏫",
    title      : "School / Institution",
    description: "Track fees per student. Bulk import your entire student list via CSV.",
  },
  {
    key        : "business",
    icon       : "💼",
    title      : "Business / Freelancer",
    description: "Invoice clients and vendors. Unique account per client, per project.",
  },
];

export default function Onboarding() {
  const navigate                        = useNavigate();
  const { mutate: createWorkspace, isPending } = useCreateWorkspace();
  const [step, setStep]                 = useState(1); // 1 = pick type, 2 = name it
  const [selectedType, setSelectedType] = useState(null);
  const [name, setName]                 = useState("");
  const [carryForward, setCarryForward] = useState(false);

  const handleTypeSelect = (type) => {
    setSelectedType(type);
    // Pre-fill a sensible default name
    const defaults = {
      landlord: "My Properties",
      school   : "My School",
      business : "My Clients",
    };
    setName(defaults[type]);
    setStep(2);
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    createWorkspace(
      { name, type: selectedType, carry_forward_credit: carryForward },
      {
        onSuccess: () => navigate("/dashboard"),
      }
    );
  };

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[#E8A838] tracking-tight mb-2">Tara</h1>
          <p className="text-gray-400 text-sm">
            {step === 1
              ? "What kind of payments are you collecting?"
              : "Name your workspace"}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className={`h-1.5 w-16 rounded-full ${step >= 1 ? "bg-[#E8A838]" : "bg-gray-700"}`} />
          <div className={`h-1.5 w-16 rounded-full ${step >= 2 ? "bg-[#E8A838]" : "bg-gray-700"}`} />
        </div>

        {step === 1 && (
          <div className="space-y-3">
            {TYPES.map((type) => (
              <button
                key={type.key}
                onClick={() => handleTypeSelect(type.key)}
                className="w-full bg-[#1a1d27] hover:bg-[#22263a] border border-gray-800 hover:border-[#E8A838] rounded-2xl p-5 text-left transition-all group"
              >
                <div className="flex items-start gap-4">
                  <span className="text-3xl">{type.icon}</span>
                  <div>
                    <h3 className="text-white font-semibold group-hover:text-[#E8A838] transition-colors">
                      {type.title}
                    </h3>
                    <p className="text-gray-500 text-sm mt-1">{type.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {step === 2 && selectedType && (
          <div className="bg-[#1a1d27] border border-gray-800 rounded-2xl p-8">
            {/* Selected type badge */}
            <div className="flex items-center gap-2 mb-6">
              <span className="text-2xl">{WORKSPACE_CONFIG[selectedType].icon}</span>
              <span className="text-gray-400 text-sm">
                {WORKSPACE_CONFIG[selectedType].label} workspace
              </span>
              <button
                onClick={() => setStep(1)}
                className="ml-auto text-gray-600 hover:text-gray-400 text-xs underline"
              >
                Change
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="text-gray-400 text-sm block mb-1.5">
                  Workspace name
                </label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#E8A838] transition-colors"
                  placeholder="e.g. Sunrise Apartments"
                />
                <p className="text-gray-600 text-xs mt-1.5">
                  This is how your workspace will appear in the dashboard.
                </p>
              </div>

              {/* Carry forward toggle */}
              <div className="flex items-start gap-3 bg-[#0f1117] rounded-lg p-4">
                <input
                  type="checkbox"
                  id="carry"
                  checked={carryForward}
                  onChange={(e) => setCarryForward(e.target.checked)}
                  className="mt-0.5 accent-[#E8A838]"
                />
                <label htmlFor="carry" className="cursor-pointer">
                  <p className="text-white text-sm font-medium">
                    Carry forward overpayments
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    When someone overpays, apply the excess to their next payment automatically.
                  </p>
                </label>
              </div>

              <button
                onClick={handleCreate}
                disabled={!name.trim() || isPending}
                className="w-full bg-[#E8A838] hover:bg-[#d4941f] text-black font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {isPending ? "Creating workspace..." : "Create workspace →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
