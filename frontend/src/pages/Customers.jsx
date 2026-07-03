// src/pages/Customers.jsx
import { useState, useRef } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import {
  useCustomers, useCreateCustomer,
  useDeleteCustomer, useImportCustomers,
} from "../hooks/useApi";
import { formatNaira, getStatusColor, getStatusLabel } from "../lib/utils";
import { Plus, Upload, Copy, Search, Trash2, ChevronRight, Share2 } from "lucide-react";
import toast from "react-hot-toast";

export default function Customers() {
  const { activeWorkspace, config } = useOutletContext();
  const navigate                    = useNavigate();
  const fileInputRef                = useRef(null);

  const { data: customers = [], isLoading } = useCustomers(activeWorkspace?.id);
  const { mutate: createCustomer, isPending: creating } = useCreateCustomer(activeWorkspace?.id);
  const { mutate: deleteCustomer }  = useDeleteCustomer(activeWorkspace?.id);
  const { mutate: importCustomers, isPending: importing } = useImportCustomers(activeWorkspace?.id);

  const [search, setSearch]             = useState("");
  const [showAddForm, setShowAddForm]   = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState({
    name             : "",
    email            : "",
    phone            : "",
    expected_amount  : "",
    installment_count: 1,
    due_date         : "",
  });

  const filtered = customers.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleAdd = () => {
    if (!form.name || !form.expected_amount) {
      toast.error("Name and expected amount are required");
      return;
    }
    createCustomer(
      {
        ...form,
        expected_amount  : parseFloat(form.expected_amount),
        installment_count: parseInt(form.installment_count),
        due_date         : form.due_date || undefined,
      },
      {
        onSuccess: () => {
          setShowAddForm(false);
          setForm({ name: "", email: "", phone: "", expected_amount: "", installment_count: 1, due_date: "" });
        },
      }
    );
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (file) importCustomers(file);
    e.target.value = "";
  };

  const copyAccountNumber = (number) => {
    navigator.clipboard.writeText(number);
    toast.success("Account number copied!");
  };

  const shareViaWhatsApp = (customer) => {
    const text = encodeURIComponent(
      `Hi ${customer.name},\n\nPlease make your ${config?.paymentLabel?.toLowerCase() || "payment"} to:\n\nBank: ${customer.bank_name || "Nomba"}\nAccount Name: ${customer.virtual_account_name || ""}\nAccount Number: ${customer.virtual_account_number}\n\nAmount: ${formatNaira(customer.expected_amount)}\n\nThank you.`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const statusOptions = [
    { value: "all",            label: "All" },
    { value: "pending",        label: "Pending" },
    { value: "partially_paid", label: "Partial" },
    { value: "paid",           label: "Paid" },
    { value: "overdue",        label: "Overdue" },
    { value: "overpaid",       label: "Overpaid" },
  ];

  if (!activeWorkspace) return null;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-white text-2xl font-bold">
            {config?.customersLabel || "Customers"}
          </h2>
          <p className="text-gray-500 text-sm mt-0.5">
            {customers.length} {config?.customersLabel?.toLowerCase() || "customers"} in {activeWorkspace.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImport}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 text-sm transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden md:inline">{importing ? "Importing..." : "Import CSV"}</span>
            <span className="md:hidden">CSV</span>
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg bg-[#E8A838] hover:bg-[#d4941f] text-black font-semibold text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add {config?.customerLabel || "Customer"}
          </button>
        </div>
      </div>

      {/* ── Search + Filter ─────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${config?.customersLabel?.toLowerCase() || "customers"}...`}
            className="w-full bg-[#1a1d27] border border-gray-800 rounded-lg pl-9 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#E8A838] transition-colors"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                statusFilter === opt.value
                  ? "bg-[#E8A838] text-black"
                  : "bg-[#1a1d27] text-gray-400 hover:text-white border border-gray-800"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* CSV hint — desktop only */}
      <div className="hidden md:flex items-center gap-2 text-xs text-gray-600">
        <span>CSV format:</span>
        <code className="bg-[#1a1d27] px-2 py-0.5 rounded text-gray-400">
          name, email, phone, expected_amount, due_date
        </code>
        <span className="text-gray-700">— email, phone, due_date are optional</span>
      </div>

      {/* ── Customer List ───────────────────────────────────────────────── */}
      <div className="bg-[#1a1d27] border border-gray-800 rounded-xl overflow-hidden">

        {/* Desktop table header */}
        <div className="hidden md:grid grid-cols-12 px-5 py-3 border-b border-gray-800 text-gray-500 text-xs font-medium uppercase tracking-wider">
          <div className="col-span-3">{config?.customerLabel || "Name"}</div>
          <div className="col-span-3">Virtual Account</div>
          <div className="col-span-2 text-right">Expected</div>
          <div className="col-span-2 text-right">Received</div>
          <div className="col-span-1 text-center">Status</div>
          <div className="col-span-1" />
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-gray-500 text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-gray-500 text-sm">
              {search ? "No results found" : config?.emptyMessage}
            </p>
            {!search && (
              <button
                onClick={() => setShowAddForm(true)}
                className="mt-3 text-[#E8A838] text-sm hover:underline"
              >
                Add your first {config?.customerLabel?.toLowerCase() || "customer"} →
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {filtered.map((customer) => (
              <div key={customer.id} className="group">

                {/* ── Desktop Row ──────────────────────────────────────── */}
                <div className="hidden md:grid grid-cols-12 px-5 py-4 items-center hover:bg-[#22263a] transition-colors">
                  <div className="col-span-3">
                    <p className="text-white text-sm font-medium">{customer.name}</p>
                    <p className="text-gray-600 text-xs mt-0.5">
                      {customer.email || customer.phone || "No contact info"}
                    </p>
                  </div>
                  <div className="col-span-3">
                    {customer.virtual_account_number ? (
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="text-white text-sm font-mono">{customer.virtual_account_number}</p>
                          <p className="text-gray-600 text-xs">{customer.bank_name}</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => copyAccountNumber(customer.virtual_account_number)}
                            className="p-1 hover:text-[#E8A838] text-gray-500 transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => shareViaWhatsApp(customer)}
                            className="p-1 hover:text-green-400 text-gray-500 transition-colors"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-600 text-xs">Pending generation</span>
                    )}
                  </div>
                  <div className="col-span-2 text-right">
                    <p className="text-white text-sm">{formatNaira(customer.expected_amount)}</p>
                    {customer.installment_count > 1 && (
                      <p className="text-gray-600 text-xs">
                        {customer.installment_paid}/{customer.installment_count} installments
                      </p>
                    )}
                  </div>
                  <div className="col-span-2 text-right">
                    <p className="text-white text-sm">{formatNaira(customer.running_total)}</p>
                    {parseFloat(customer.running_total) < parseFloat(customer.expected_amount) &&
                      parseFloat(customer.running_total) > 0 && (
                        <p className="text-yellow-500 text-xs">
                          ₦{(parseFloat(customer.expected_amount) - parseFloat(customer.running_total)).toLocaleString()} short
                        </p>
                      )}
                    {parseFloat(customer.credit_balance) > 0 && (
                      <p className="text-blue-400 text-xs">
                        +₦{parseFloat(customer.credit_balance).toLocaleString()} credit
                      </p>
                    )}
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(customer.status)}`}>
                      {getStatusLabel(customer.status)}
                    </span>
                  </div>
                  <div className="col-span-1 flex justify-end items-center gap-1">
                    <button
                      onClick={() => navigate(`/customers/${customer.id}`)}
                      className="p-1.5 hover:text-[#E8A838] text-gray-600 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Remove ${customer.name}?`)) deleteCustomer(customer.id); }}
                      className="p-1.5 hover:text-red-400 text-gray-700 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* ── Mobile Card ───────────────────────────────────────── */}
                <div
                  className="md:hidden px-4 py-4 hover:bg-[#22263a] transition-colors cursor-pointer"
                  onClick={() => navigate(`/customers/${customer.id}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-[#E8A838]/20 flex items-center justify-center text-[#E8A838] font-semibold text-sm flex-shrink-0">
                        {customer.name[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">{customer.name}</p>
                        <p className="text-gray-500 text-xs">
                          {customer.email || customer.phone || "No contact"}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${getStatusColor(customer.status)}`}>
                      {getStatusLabel(customer.status)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-gray-500 text-xs mb-0.5">Virtual account</p>
                      <p className="text-white text-sm font-mono">
                        {customer.virtual_account_number || "Pending"}
                      </p>
                      {customer.bank_name && (
                        <p className="text-gray-600 text-xs">{customer.bank_name}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-gray-500 text-xs mb-0.5">Received / Expected</p>
                      <p className="text-white text-sm font-medium">
                        {formatNaira(customer.running_total)}
                      </p>
                      <p className="text-gray-500 text-xs">
                        of {formatNaira(customer.expected_amount)}
                      </p>
                    </div>
                  </div>

                  {/* Shortfall / credit indicators */}
                  {parseFloat(customer.running_total) > 0 &&
                    parseFloat(customer.running_total) < parseFloat(customer.expected_amount) && (
                      <p className="text-yellow-500 text-xs mb-2">
                        ₦{(parseFloat(customer.expected_amount) - parseFloat(customer.running_total)).toLocaleString()} still outstanding
                      </p>
                    )}
                  {parseFloat(customer.credit_balance) > 0 && (
                    <p className="text-blue-400 text-xs mb-2">
                      +{formatNaira(customer.credit_balance)} credit balance
                    </p>
                  )}

                  {/* Quick action buttons */}
                  {customer.virtual_account_number && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); copyAccountNumber(customer.virtual_account_number); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-gray-700 text-gray-400 text-xs hover:text-white transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" /> Copy number
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); shareViaWhatsApp(customer); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-700/30 border border-green-700/30 text-green-400 text-xs hover:bg-green-700/50 transition-colors"
                      >
                        <Share2 className="w-3.5 h-3.5" /> WhatsApp
                      </button>
                    </div>
                  )}
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add Customer Modal ──────────────────────────────────────────── */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d27] border border-gray-700 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold">
                Add {config?.customerLabel || "customer"}
              </h3>
              <button onClick={() => setShowAddForm(false)} className="text-gray-500 hover:text-white text-xl">
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm block mb-1.5">Full name *</label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#E8A838]"
                  placeholder="e.g. Chioma Obi"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-sm block mb-1.5">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E8A838]"
                    placeholder="chioma@email.com"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-sm block mb-1.5">Phone</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E8A838]"
                    placeholder="08012345678"
                  />
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-sm block mb-1.5">
                  {config?.amountLabel || "Expected amount"} (₦) *
                </label>
                <input
                  type="number"
                  value={form.expected_amount}
                  onChange={(e) => setForm({ ...form, expected_amount: e.target.value })}
                  className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#E8A838]"
                  placeholder="50000"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-sm block mb-1.5">Installments</label>
                  <select
                    value={form.installment_count}
                    onChange={(e) => setForm({ ...form, installment_count: e.target.value })}
                    className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E8A838]"
                  >
                    <option value={1}>1 (lump sum)</option>
                    <option value={2}>2 parts</option>
                    <option value={3}>3 parts</option>
                    <option value={6}>6 parts</option>
                    <option value={12}>12 parts</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-sm block mb-1.5">Due date</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E8A838]"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 py-2.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={creating}
                  className="flex-1 py-2.5 rounded-lg bg-[#E8A838] hover:bg-[#d4941f] text-black font-semibold text-sm disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Add & generate account"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
