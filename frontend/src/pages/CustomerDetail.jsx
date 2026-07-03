// src/pages/CustomerDetail.jsx
import { useParams, useOutletContext, useNavigate } from "react-router-dom";
import { useCustomer, useCustomerPayments } from "../hooks/useApi";
import { formatNaira, formatDate, getStatusColor, getStatusLabel } from "../lib/utils";
import {
  ArrowLeft, Copy, Share2, TrendingUp,
  AlertTriangle, BadgeCheck, Clock, CreditCard,
  FileText, CheckCircle2, XCircle, Minus
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";

// ── Payment Timeline Item ─────────────────────────────────────────────────────
function PaymentTimelineItem({ payment, index, total }) {
  const isPaid     = payment.status === "paid";
  const isPartial  = payment.status === "partially_paid";
  const isOverpaid = payment.status === "overpaid";

  const Icon = isPaid ? CheckCircle2 : isOverpaid ? TrendingUp : isPartial ? AlertTriangle : Minus;
  const iconColor = isPaid ? "text-green-400" : isOverpaid ? "text-blue-400" : isPartial ? "text-yellow-400" : "text-gray-500";
  const bgColor   = isPaid ? "bg-green-400/10" : isOverpaid ? "bg-blue-400/10" : isPartial ? "bg-yellow-400/10" : "bg-gray-700/20";

  return (
    <div className="flex gap-4">
      {/* Timeline line + icon */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={`w-8 h-8 rounded-full ${bgColor} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        {index < total - 1 && (
          <div className="w-px flex-1 bg-gray-800 mt-1" />
        )}
      </div>

      {/* Content */}
      <div className={`pb-6 flex-1 ${index === total - 1 ? "pb-0" : ""}`}>
        <div className="bg-[#0f1117] border border-gray-800 rounded-xl p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-white font-semibold">
                {formatNaira(payment.amount_paid)} received
              </p>
              <p className="text-gray-500 text-xs mt-0.5">
                {formatDistanceToNow(new Date(payment.created_at), { addSuffix: true })}
                {" · "}
                {formatDate(payment.created_at)}
              </p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(payment.status)}`}>
              {getStatusLabel(payment.status)}
            </span>
          </div>

          {/* Reconciliation breakdown */}
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="bg-[#1a1d27] rounded-lg p-3">
              <p className="text-gray-500 mb-1">This payment</p>
              <p className="text-white font-semibold">{formatNaira(payment.amount_paid)}</p>
            </div>
            <div className="bg-[#1a1d27] rounded-lg p-3">
              <p className="text-gray-500 mb-1">Running total</p>
              <p className="text-white font-semibold">{formatNaira(payment.running_total)}</p>
            </div>
            <div className="bg-[#1a1d27] rounded-lg p-3">
              <p className="text-gray-500 mb-1">Expected</p>
              <p className="text-white font-semibold">{formatNaira(payment.expected_amount)}</p>
            </div>
          </div>

          {/* Shortfall / credit */}
          {parseFloat(payment.shortfall) > 0 && (
            <div className="mt-3 flex items-center gap-2 text-xs text-yellow-400 bg-yellow-400/10 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                <strong>{formatNaira(payment.shortfall)}</strong> still outstanding after this payment
              </span>
            </div>
          )}
          {parseFloat(payment.credit_balance) > 0 && (
            <div className="mt-3 flex items-center gap-2 text-xs text-blue-400 bg-blue-400/10 rounded-lg px-3 py-2">
              <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                <strong>{formatNaira(payment.credit_balance)}</strong> credit recorded (overpayment)
              </span>
            </div>
          )}

          {/* Nomba reference */}
          {payment.nomba_reference && (
            <p className="text-gray-700 text-xs mt-2">
              Ref: {payment.nomba_reference}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CustomerDetail() {
  const { customerId }              = useParams();
  const { activeWorkspace, config } = useOutletContext();
  const navigate                    = useNavigate();

  const { data: customer, isLoading } = useCustomer(activeWorkspace?.id, customerId);
  const { data: payments = [] }       = useCustomerPayments(activeWorkspace?.id, customerId);

  const copyAccount = () => {
    navigator.clipboard.writeText(customer.virtual_account_number);
    toast.success("Account number copied!");
  };

  const shareViaWhatsApp = () => {
    const text = encodeURIComponent(
      `Hi ${customer.name},\n\nPlease make your ${config?.paymentLabel?.toLowerCase() || "payment"} to:\n\nBank: ${customer.bank_name || "Nomba"}\nAccount Name: ${customer.virtual_account_name || ""}\nAccount Number: ${customer.virtual_account_number}\n\nAmount due: ${formatNaira(customer.expected_amount)}\n\nThank you.`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-800 rounded w-48" />
          <div className="h-40 bg-gray-800 rounded-xl" />
          <div className="h-60 bg-gray-800 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6 text-center">
        <XCircle className="w-10 h-10 text-gray-700 mx-auto mb-3" />
        <p className="text-gray-400">Customer not found</p>
        <button
          onClick={() => navigate("/customers")}
          className="mt-3 text-[#E8A838] text-sm hover:underline"
        >
          Back to {config?.customersLabel?.toLowerCase() || "customers"}
        </button>
      </div>
    );
  }

  const paidPercent     = Math.min(100, (parseFloat(customer.running_total) / parseFloat(customer.expected_amount)) * 100);
  const shortfall       = Math.max(0, parseFloat(customer.expected_amount) - parseFloat(customer.running_total));
  const totalPayments   = payments.length;
  const isFullyPaid     = customer.status === "paid";
  const isOverpaid      = customer.status === "overpaid";
  const isUnderpaid     = customer.status === "partially_paid";
  const isOverdue       = customer.status === "overdue";

  return (
    <div className="p-6 max-w-4xl">
      {/* Back */}
      <button
        onClick={() => navigate("/customers")}
        className="flex items-center gap-2 text-gray-500 hover:text-white text-sm transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {config?.customersLabel || "customers"}
      </button>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* ── Left column (2/3) ── */}
        <div className="col-span-1 md:col-span-2 space-y-5">

          {/* Customer header card */}
          <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-6">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#E8A838]/20 flex items-center justify-center text-[#E8A838] font-bold text-lg flex-shrink-0">
                  {customer.name[0].toUpperCase()}
                </div>
                <div>
                  <h2 className="text-white text-xl font-bold">{customer.name}</h2>
                  <p className="text-gray-500 text-sm mt-0.5">
                    {customer.email || customer.phone || "No contact info"}
                  </p>
                </div>
              </div>
              <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${getStatusColor(customer.status)}`}>
                {getStatusLabel(customer.status)}
              </span>
            </div>

            {/* Progress bar */}
            <div className="mb-5">
              <div className="flex justify-between text-xs text-gray-500 mb-2">
                <span>Payment progress</span>
                <span className="font-medium text-white">{paidPercent.toFixed(1)}%</span>
              </div>
              <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isFullyPaid ? "bg-green-400" :
                    isOverpaid  ? "bg-blue-400" :
                    isOverdue   ? "bg-red-400" :
                    "bg-[#E8A838]"
                  }`}
                  style={{ width: `${Math.min(paidPercent, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs mt-2">
                <span className="text-gray-500">
                  Paid: <span className="text-white font-medium">{formatNaira(customer.running_total)}</span>
                </span>
                <span className="text-gray-500">
                  Target: <span className="text-white font-medium">{formatNaira(customer.expected_amount)}</span>
                </span>
              </div>
            </div>

            {/* Status-specific alert */}
            {isUnderpaid && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  <p className="text-yellow-400 font-semibold text-sm">Underpayment detected</p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-gray-500 mb-1">Expected</p>
                    <p className="text-white font-semibold">{formatNaira(customer.expected_amount)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Received</p>
                    <p className="text-white font-semibold">{formatNaira(customer.running_total)}</p>
                  </div>
                  <div>
                    <p className="text-yellow-400 mb-1">Shortfall</p>
                    <p className="text-yellow-400 font-bold">{formatNaira(shortfall)}</p>
                  </div>
                </div>
                {customer.installment_count > 1 && (
                  <p className="text-yellow-300/70 text-xs mt-2">
                    Installment {customer.installment_paid} of {customer.installment_count} — {formatNaira(parseFloat(customer.expected_amount) / customer.installment_count)} per installment
                  </p>
                )}
              </div>
            )}

            {isOverpaid && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  <p className="text-blue-400 font-semibold text-sm">Overpayment recorded</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-gray-500 mb-1">Expected</p>
                    <p className="text-white font-semibold">{formatNaira(customer.expected_amount)}</p>
                  </div>
                  <div>
                    <p className="text-blue-400 mb-1">Credit balance</p>
                    <p className="text-blue-400 font-bold">{formatNaira(customer.credit_balance)}</p>
                  </div>
                </div>
                <p className="text-blue-300/70 text-xs mt-2">
                  {parseFloat(customer.credit_balance) > 0
                    ? activeWorkspace?.carry_forward_credit
                      ? "Credit will apply to next payment cycle automatically"
                      : "Credit flagged for manual review"
                    : "Overpayment logged"}
                </p>
              </div>
            )}

            {isFullyPaid && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="w-4 h-4 text-green-400" />
                  <p className="text-green-400 font-semibold text-sm">
                    Paid in full — {formatNaira(customer.expected_amount)}
                  </p>
                </div>
                {totalPayments > 1 && (
                  <p className="text-green-300/70 text-xs mt-1">
                    Completed across {totalPayments} payment{totalPayments > 1 ? "s" : ""}
                  </p>
                )}
              </div>
            )}

            {isOverdue && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-red-400" />
                  <p className="text-red-400 font-semibold text-sm">Payment overdue</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-gray-500 mb-1">Due date</p>
                    <p className="text-white font-semibold">{formatDate(customer.due_date)}</p>
                  </div>
                  <div>
                    <p className="text-red-400 mb-1">Outstanding</p>
                    <p className="text-red-400 font-bold">{formatNaira(shortfall)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Key metrics row */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-[#0f1117] rounded-lg p-3 text-center">
                <p className="text-gray-500 text-xs mb-1">Payments</p>
                <p className="text-white font-bold">{totalPayments}</p>
              </div>
              <div className="bg-[#0f1117] rounded-lg p-3 text-center">
                <p className="text-gray-500 text-xs mb-1">Installments</p>
                <p className="text-white font-bold">
                  {customer.installment_count > 1
                    ? `${customer.installment_paid}/${customer.installment_count}`
                    : "—"}
                </p>
              </div>
              <div className="bg-[#0f1117] rounded-lg p-3 text-center">
                <p className="text-gray-500 text-xs mb-1">Due date</p>
                <p className="text-white font-bold text-xs">{customer.due_date ? formatDate(customer.due_date) : "—"}</p>
              </div>
              <div className="bg-[#0f1117] rounded-lg p-3 text-center">
                <p className="text-gray-500 text-xs mb-1">Credit</p>
                <p className={`font-bold ${parseFloat(customer.credit_balance) > 0 ? "text-blue-400" : "text-white"}`}>
                  {parseFloat(customer.credit_balance) > 0 ? formatNaira(customer.credit_balance) : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Payment timeline */}
          <div className="bg-[#1a1d27] border border-gray-800 rounded-xl">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#E8A838]" />
                Payment history
              </h3>
              <span className="text-gray-600 text-xs">{totalPayments} event{totalPayments !== 1 ? "s" : ""}</span>
            </div>

            {payments.length === 0 ? (
              <div className="py-12 text-center">
                <TrendingUp className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No payments recorded yet</p>
                <p className="text-gray-600 text-xs mt-1">
                  Payments appear here automatically when received
                </p>
              </div>
            ) : (
              <div className="p-5">
                <div className="space-y-0">
                  {payments.map((payment, index) => (
                    <PaymentTimelineItem
                      key={payment.id}
                      payment={payment}
                      index={index}
                      total={payments.length}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right column (1/3) ── */}
        <div className="space-y-4">
          {/* Virtual account card */}
          <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-5">
            <h3 className="text-white font-semibold text-sm flex items-center gap-2 mb-4">
              <CreditCard className="w-4 h-4 text-[#E8A838]" />
              Virtual account
            </h3>

            {customer.virtual_account_number ? (
              <>
                <div className="space-y-3 mb-4">
                  <div className="bg-[#0f1117] rounded-lg p-3">
                    <p className="text-gray-500 text-xs mb-1">Bank</p>
                    <p className="text-white text-sm font-medium">{customer.bank_name || "Nomba"}</p>
                  </div>
                  <div className="bg-[#0f1117] rounded-lg p-3">
                    <p className="text-gray-500 text-xs mb-1">Account name</p>
                    <p className="text-white text-sm font-medium leading-tight">{customer.virtual_account_name}</p>
                  </div>
                  <div className="bg-[#0f1117] rounded-lg p-3">
                    <p className="text-gray-500 text-xs mb-1">Account number</p>
                    <p className="text-white font-mono text-lg font-bold tracking-widest">
                      {customer.virtual_account_number}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={copyAccount}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-gray-600 text-sm transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    Copy number
                  </button>
                  <button
                    onClick={shareViaWhatsApp}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-semibold text-sm transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                    Share via WhatsApp
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500 text-sm">Account not yet generated</p>
                <p className="text-gray-600 text-xs mt-1">
                  This happens when Nomba's API is temporarily unavailable
                </p>
              </div>
            )}
          </div>

          {/* Summary card */}
          <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-5">
            <h3 className="text-white font-semibold text-sm mb-4">Statement summary</h3>
            <div className="space-y-3">
              {[
                { label: "Total expected",  value: formatNaira(customer.expected_amount),                                                                   color: "text-white" },
                { label: "Total received",  value: formatNaira(customer.running_total),                                                                      color: "text-green-400" },
                { label: "Outstanding",     value: formatNaira(shortfall),                                                                                   color: shortfall > 0 ? "text-yellow-400" : "text-gray-600" },
                { label: "Credit balance",  value: parseFloat(customer.credit_balance) > 0 ? formatNaira(customer.credit_balance) : "—",                    color: "text-blue-400" },
                { label: "Payment status",  value: getStatusLabel(customer.status),                                                                          color: customer.status === "paid" ? "text-green-400" : customer.status === "overdue" ? "text-red-400" : "text-yellow-400" },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">{row.label}</span>
                  <span className={`font-semibold ${row.color}`}>{row.value}</span>
                </div>
              ))}
              <div className="border-t border-gray-800 pt-3 flex justify-between items-center text-sm">
                <span className="text-gray-500">Workspace</span>
                <span className="text-white font-medium">{activeWorkspace?.name}</span>
              </div>
            </div>
          </div>

          {/* Added date */}
          <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-4 text-xs text-gray-600 text-center">
            Added {formatDistanceToNow(new Date(customer.created_at), { addSuffix: true })}
          </div>
        </div>
      </div>
    </div>
  );
}
