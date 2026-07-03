// src/pages/Landing.jsx
// Pre-login marketing page — the first thing judges see

import { Link } from "react-router-dom";
import {
  ArrowRight, CheckCircle, Zap, Shield,
  Users, TrendingUp, AlertTriangle, BadgeCheck
} from "lucide-react";

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ value, label }) {
  return (
    <div className="text-center">
      <p className="text-3xl md:text-4xl font-bold text-[#E8A838]">{value}</p>
      <p className="text-gray-500 text-sm mt-1">{label}</p>
    </div>
  );
}

// ── Feature card ──────────────────────────────────────────────────────────────
function FeatureCard({ icon: Icon, color, bg, title, description }) {
  return (
    <div className="bg-[#1a1d27] border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-colors">
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-4`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <h3 className="text-white font-semibold mb-2">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

// ── Payment status pill ───────────────────────────────────────────────────────
function StatusPill({ status, label }) {
  const styles = {
    paid    : "bg-green-500/15 text-green-400 border-green-500/20",
    partial : "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
    overdue : "bg-red-500/15 text-red-400 border-red-500/20",
    overpaid: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
      {label}
    </span>
  );
}

// ── Mock dashboard preview ────────────────────────────────────────────────────
function DashboardPreview() {
  const tenants = [
    { name: "Emeka Okafor",   account: "6164135804", amount: "₦50,000", received: "₦50,000", status: "paid",     label: "Paid" },
    { name: "Chioma Adeyemi", account: "3560013617", amount: "₦50,000", received: "₦30,000", status: "partial",  label: "Partial" },
    { name: "Bola Tinubu",    account: "9182736450", amount: "₦50,000", received: "₦0",      status: "overdue",  label: "Overdue" },
    { name: "Ngozi Okonkwo",  account: "7261839045", amount: "₦50,000", received: "₦55,000", status: "overpaid", label: "Overpaid" },
  ];

  return (
    <div className="bg-[#1a1d27] border border-gray-700 rounded-2xl overflow-hidden shadow-2xl">
      {/* Mock header */}
      <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <div className="w-3 h-3 rounded-full bg-green-500/60" />
          </div>
          <span className="text-gray-500 text-xs">Sunrise Apartments · Rent Collection</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-gray-600 text-xs">Live</span>
        </div>
      </div>

      {/* Mock stats */}
      <div className="grid grid-cols-4 gap-0 border-b border-gray-800">
        {[
          { label: "Collected",    value: "₦155,000", color: "text-green-400" },
          { label: "Outstanding",  value: "₦70,000",  color: "text-yellow-400" },
          { label: "Tenants",      value: "4",         color: "text-white" },
          { label: "Overdue",      value: "1",         color: "text-red-400" },
        ].map((stat) => (
          <div key={stat.label} className="px-4 py-3 border-r border-gray-800 last:border-r-0">
            <p className="text-gray-600 text-xs">{stat.label}</p>
            <p className={`font-bold text-sm mt-0.5 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Mock tenant list */}
      <div className="divide-y divide-gray-800/50">
        {tenants.map((tenant) => (
          <div key={tenant.name} className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-[#E8A838]/20 flex items-center justify-center text-[#E8A838] text-xs font-bold flex-shrink-0">
                {tenant.name[0]}
              </div>
              <div>
                <p className="text-white text-xs font-medium">{tenant.name}</p>
                <p className="text-gray-600 text-xs font-mono">{tenant.account}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-white text-xs">{tenant.received}</p>
                <p className="text-gray-600 text-xs">of {tenant.amount}</p>
              </div>
              <StatusPill status={tenant.status} label={tenant.label} />
            </div>
          </div>
        ))}
      </div>

      {/* Mock activity */}
      <div className="px-5 py-3 border-t border-gray-800 bg-[#0f1117]/50">
        <p className="text-gray-600 text-xs flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
          Emeka Okafor paid ₦50,000 — reconciled automatically ✓
        </p>
      </div>
    </div>
  );
}

// ── Use case card ─────────────────────────────────────────────────────────────
function UseCaseCard({ icon, type, title, description, items }) {
  return (
    <div className="bg-[#1a1d27] border border-gray-800 rounded-2xl p-6">
      <div className="text-3xl mb-3">{icon}</div>
      <span className="text-xs text-[#E8A838] font-semibold uppercase tracking-wider">{type}</span>
      <h3 className="text-white font-bold text-lg mt-1 mb-2">{title}</h3>
      <p className="text-gray-500 text-sm mb-4">{description}</p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2 text-sm text-gray-400">
            <CheckCircle className="w-3.5 h-3.5 text-[#E8A838] flex-shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Main Landing Page ─────────────────────────────────────────────────────────
export default function Landing() {
  return (
    <div className="min-h-screen bg-[#0f1117] text-white">

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <nav className="border-b border-gray-800/50 sticky top-0 bg-[#0f1117]/90 backdrop-blur-sm z-50">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div>
            <span className="text-2xl font-bold text-[#E8A838]">Tara</span>
            <span className="text-gray-600 text-xs ml-2 hidden sm:inline">by Nomba</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-gray-400 hover:text-white text-sm transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="bg-[#E8A838] hover:bg-[#d4941f] text-black font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 pt-16 md:pt-24 pb-16">
        <div className="text-center mb-12">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-[#E8A838]/10 border border-[#E8A838]/20 rounded-full px-4 py-1.5 mb-6">
            <Zap className="w-3.5 h-3.5 text-[#E8A838]" />
            <span className="text-[#E8A838] text-xs font-medium">
              Built on Nomba Virtual Account Infrastructure
            </span>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Every payment,
            <br />
            <span className="text-[#E8A838]">perfectly placed.</span>
          </h1>

          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-8 leading-relaxed">
            Tara gives every payer their own unique bank account number.
            Payments reconcile automatically. No more guessing who paid what.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/register"
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#E8A838] hover:bg-[#d4941f] text-black font-bold px-8 py-3.5 rounded-xl transition-colors text-sm"
            >
              Start collecting payments
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto flex items-center justify-center gap-2 border border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white px-8 py-3.5 rounded-xl transition-colors text-sm"
            >
              Sign in
            </Link>
          </div>
        </div>

        {/* Dashboard preview */}
        <div className="max-w-3xl mx-auto">
          <DashboardPreview />
        </div>
      </section>

      {/* ── The Problem ────────────────────────────────────────────────── */}
      <section className="border-t border-gray-800/50 py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Every Nigerian landlord knows this moment.
            </h2>
            <p className="text-gray-400 leading-relaxed">
              Rent is due on the 1st. You have 10 tenants. You share one account number with all of them.
              Your phone explodes with alerts and you're texting everyone —
              <span className="text-white italic"> "who sent this ₦50,000?"</span>
            </p>
          </div>

          {/* Before / After */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Before */}
            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6">
              <p className="text-red-400 text-xs font-semibold uppercase tracking-wider mb-4">
                Before Tara
              </p>
              <div className="space-y-3">
                {[
                  "One account number, 10 tenants",
                  "Manual checking who paid",
                  "WhatsApp threads to confirm amounts",
                  "Spreadsheets that get out of date",
                  "Disputes over underpayments",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm text-gray-400">
                    <AlertTriangle className="w-4 h-4 text-red-400/60 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* After */}
            <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-6">
              <p className="text-green-400 text-xs font-semibold uppercase tracking-wider mb-4">
                With Tara
              </p>
              <div className="space-y-3">
                {[
                  "Each tenant has their own unique account",
                  "Payments reconcile automatically",
                  "Underpayments flagged instantly",
                  "Real-time dashboard — always current",
                  "Clear statement per tenant",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm text-gray-400">
                    <BadgeCheck className="w-4 h-4 text-green-400 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <section className="border-t border-gray-800/50 py-12 bg-[#1a1d27]/30">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatCard value="1 account"  label="per payer — always" />
            <StatCard value="0 manual"   label="reconciliation work" />
            <StatCard value="3 types"    label="of collection workspace" />
            <StatCard value="Real-time"  label="payment detection" />
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section className="border-t border-gray-800/50 py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Built for how Nigeria actually pays
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Every feature is designed around the real payment behaviours of Nigerian tenants, students, and clients.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FeatureCard
              icon={Zap}
              color="text-[#E8A838]"
              bg="bg-[#E8A838]/10"
              title="Instant reconciliation"
              description="The moment a payment arrives, Tara identifies who paid, compares it to what was expected, and updates the dashboard. No manual work."
            />
            <FeatureCard
              icon={AlertTriangle}
              color="text-yellow-400"
              bg="bg-yellow-400/10"
              title="Underpayment handling"
              description="Partial payments accumulate automatically. If a tenant pays ₦20k today and ₦30k next week, Tara tracks the running total and marks them paid when they reach the target."
            />
            <FeatureCard
              icon={TrendingUp}
              color="text-blue-400"
              bg="bg-blue-400/10"
              title="Overpayment tracking"
              description="When someone pays too much, Tara logs the credit balance. With carry-forward enabled, excess automatically reduces what they owe next cycle."
            />
            <FeatureCard
              icon={Users}
              color="text-purple-400"
              bg="bg-purple-400/10"
              title="Bulk CSV import"
              description="Upload a spreadsheet of 50 students or tenants. Tara generates a unique virtual account number for each one in seconds. No manual entry."
            />
            <FeatureCard
              icon={Shield}
              color="text-green-400"
              bg="bg-green-400/10"
              title="Multiple workspaces"
              description="One login. Manage your rental properties, school fees, and freelance clients in separate workspaces — each with its own dashboard and language."
            />
            <FeatureCard
              icon={BadgeCheck}
              color="text-[#E8A838]"
              bg="bg-[#E8A838]/10"
              title="Nightly cross-check"
              description="Every night, Tara queries Nomba's Transactions API to catch any payments whose webhooks were missed. Nothing falls through the cracks."
            />
          </div>
        </div>
      </section>

      {/* ── Use Cases ──────────────────────────────────────────────────── */}
      <section className="border-t border-gray-800/50 py-16 md:py-24 bg-[#1a1d27]/20">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Who uses Tara
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Three types of collection workspace — one platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <UseCaseCard
              icon="🏠"
              type="Landlord"
              title="Rent collection, simplified"
              description="Stop texting tenants every month asking who paid. Each tenant gets their own account number — payments reconcile themselves."
              items={[
                "Per-tenant virtual accounts",
                "Automatic rent reconciliation",
                "Overdue tenant alerts",
                "WhatsApp payment sharing",
              ]}
            />
            <UseCaseCard
              icon="🏫"
              type="School"
              title="School fees, per student"
              description="Import your entire student list via CSV. Each student gets their own account. Know exactly who has paid their fees and who hasn't."
              items={[
                "Bulk CSV import",
                "Per-student fee tracking",
                "Installment plan support",
                "Term-by-term reporting",
              ]}
            />
            <UseCaseCard
              icon="💼"
              type="Business"
              title="Client payments, tracked"
              description="Whether you're a freelancer, WhatsApp vendor, or consultant — give each client their own account and know exactly what's been paid."
              items={[
                "Per-client virtual accounts",
                "Project-based invoicing",
                "Credit balance carry-forward",
                "Per-client statements",
              ]}
            />
          </div>

          {/* Ajo roadmap callout */}
          <div className="mt-6 bg-[#E8A838]/5 border border-[#E8A838]/15 rounded-2xl p-5 flex items-start gap-4">
            <span className="text-3xl flex-shrink-0">🤝</span>
            <div>
              <p className="text-[#E8A838] text-sm font-semibold mb-1">
                Coming soon — Ajo / Esusu tracker
              </p>
              <p className="text-gray-500 text-sm">
                Rotating savings group management with per-member virtual accounts, cycle tracking, and defaulter detection. A natural extension of Tara's infrastructure.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section className="border-t border-gray-800/50 py-16 md:py-24">
        <div className="max-w-2xl mx-auto px-4 md:px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to stop guessing who paid?
          </h2>
          <p className="text-gray-400 mb-8">
            Set up your first workspace in under 2 minutes.
            No bank account needed. Powered by Nomba.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-[#E8A838] hover:bg-[#d4941f] text-black font-bold px-8 py-4 rounded-xl transition-colors"
          >
            Get started free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-gray-700 text-xs mt-4">
            Already have an account?{" "}
            <Link to="/login" className="text-gray-500 hover:text-gray-400 underline">
              Sign in
            </Link>
          </p>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-800/50 py-8">
        <div className="max-w-6xl mx-auto px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-[#E8A838]">Tara</span>
            <span className="text-gray-700 text-sm">— Every payment, perfectly placed.</span>
          </div>
          <p className="text-gray-700 text-xs">
            Built on{" "}
            <a
              href="https://developer.nomba.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-400 underline"
            >
              Nomba Virtual Account Infrastructure
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
