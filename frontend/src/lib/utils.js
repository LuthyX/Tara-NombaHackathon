// src/lib/utils.js
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// cn() merges Tailwind classes intelligently
// e.g. cn("px-2 py-1", "px-4") → "py-1 px-4" (no conflicts)
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Format naira amounts
// e.g. formatNaira(50000) → "₦50,000.00"
export function formatNaira(amount) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(amount || 0);
}

// Format dates nicely
// e.g. formatDate("2024-01-15") → "Jan 15, 2024"
export function formatDate(dateString) {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Get status badge color based on payment status
export function getStatusColor(status) {
  const colors = {
    paid          : "bg-green-100 text-green-800 border-green-200",
    partially_paid: "bg-yellow-100 text-yellow-800 border-yellow-200",
    pending       : "bg-gray-100 text-gray-800 border-gray-200",
    overpaid      : "bg-blue-100 text-blue-800 border-blue-200",
    overdue       : "bg-red-100 text-red-800 border-red-200",
  };
  return colors[status] || colors.pending;
}

// Get human-readable status label
export function getStatusLabel(status) {
  const labels = {
    paid          : "Paid",
    partially_paid: "Partial",
    pending       : "Pending",
    overpaid      : "Overpaid",
    overdue       : "Overdue",
  };
  return labels[status] || status;
}

// Workspace type config — drives all UI language
// Add a new type here and the whole UI adapts automatically
export const WORKSPACE_CONFIG = {
  landlord: {
    icon           : "🏠",
    label          : "Landlord",
    customerLabel  : "Tenant",
    customersLabel : "Tenants",
    paymentLabel   : "Rent",
    amountLabel    : "Monthly Rent",
    periodLabel    : "Monthly / Yearly",
    emptyMessage   : "Add your first tenant to get started",
  },
  school: {
    icon           : "🏫",
    label          : "School",
    customerLabel  : "Student",
    customersLabel : "Students",
    paymentLabel   : "Fees",
    amountLabel    : "Term Fees",
    periodLabel    : "Per Term / Session",
    emptyMessage   : "Add your first student to get started",
  },
  business: {
    icon           : "💼",
    label          : "Business",
    customerLabel  : "Client",
    customersLabel : "Clients",
    paymentLabel   : "Invoice",
    amountLabel    : "Project Amount",
    periodLabel    : "Per Project / Order",
    emptyMessage   : "Add your first client to get started",
  },
};
