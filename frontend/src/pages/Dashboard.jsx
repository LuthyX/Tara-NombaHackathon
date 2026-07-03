// src/pages/Dashboard.jsx
import { useOutletContext, useNavigate } from "react-router-dom";
import { useWorkspaceStats, useCustomers, useWorkspaceActivity } from "../hooks/useApi";
import { formatNaira, getStatusColor, getStatusLabel } from "../lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  TrendingUp, Users, AlertCircle, CheckCircle,
  Clock, ArrowRight, Activity, AlertTriangle, BadgeCheck,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const STATUS_COLORS = {
  paid          : "#27AE60",
  partially_paid: "#F39C12",
  pending       : "#6B7280",
  overpaid      : "#3B82F6",
  overdue       : "#EF4444",
};

function ActivityItem({ item, onClick }) {
  const isPaid     = item.status === "paid";
  const isOverpaid = item.status === "overpaid";
  const isPartial  = item.status === "partially_paid";
  const isOverdue  = item.status === "overdue";
  const dotColor   = STATUS_COLORS[item.status] || STATUS_COLORS.pending;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 px-5 py-4 hover:bg-[#22263a] transition-colors text-left group"
    >
      <div className="mt-1 flex-shrink-0">
        <div className="w-2.5 h-2.5 rounded-full mt-0.5" style={{ backgroundColor: dotColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-white text-sm font-medium">{item.customer_name}</p>
            <p className="text-gray-500 text-xs mt-0.5">
              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
            </p>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0 ${getStatusColor(item.status)}`}>
            {getStatusLabel(item.status)}
          </span>
        </div>
        <div className="mt-1.5 text-xs space-y-0.5">
          {isPaid && (
            <p className="text-green-400 flex items-center gap-1">
              <BadgeCheck className="w-3 h-3" />
              {formatNaira(item.amount_paid)} received — paid in full
            </p>
          )}
          {isPartial && (
            <>
              <p className="text-gray-400">{formatNaira(item.amount_paid)} received</p>
              <p className="text-yellow-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {formatNaira(item.shortfall)} still outstanding
              </p>
            </>
          )}
          {isOverpaid && (
            <>
              <p className="text-gray-400">{formatNaira(item.amount_paid)} received</p>
              <p className="text-blue-400">{formatNaira(item.credit_balance)} credit recorded</p>
            </>
          )}
          {isOverdue && (
            <p className="text-red-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Missed due date — {formatNaira(item.expected_amount)} outstanding
            </p>
          )}
        </div>
      </div>
      <ArrowRight className="w-3.5 h-3.5 text-gray-700 group-hover:text-gray-500 transition-colors mt-1 flex-shrink-0" />
    </button>
  );
}

function ReconciliationAlerts({ customers }) {
  const underpaid = customers.filter((c) => c.status === "partially_paid" && parseFloat(c.running_total) > 0);
  const overpaid  = customers.filter((c) => c.status === "overpaid");
  const overdue   = customers.filter((c) => c.status === "overdue");

  if (!underpaid.length && !overpaid.length && !overdue.length) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-white font-semibold text-sm flex items-center gap-2">
        <Activity className="w-4 h-4 text-[#E8A838]" />
        Reconciliation alerts
      </h3>
      <div className="grid grid-cols-3 gap-3">
        {underpaid.length > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <p className="text-yellow-400 text-xs font-semibold uppercase tracking-wider">Underpayments</p>
            </div>
            <p className="text-white text-2xl font-bold mb-1">{underpaid.length}</p>
            <p className="text-yellow-300/70 text-xs">
              {formatNaira(underpaid.reduce((sum, c) => sum + parseFloat(c.expected_amount) - parseFloat(c.running_total), 0))} total shortfall
            </p>
            <div className="mt-3 space-y-1.5">
              {underpaid.slice(0, 3).map((c) => (
                <div key={c.id} className="flex justify-between text-xs">
                  <span className="text-gray-400 truncate mr-2">{c.name}</span>
                  <span className="text-yellow-400 flex-shrink-0">
                    -{formatNaira(parseFloat(c.expected_amount) - parseFloat(c.running_total))}
                  </span>
                </div>
              ))}
              {underpaid.length > 3 && <p className="text-gray-600 text-xs">+{underpaid.length - 3} more</p>}
            </div>
          </div>
        )}

        {overpaid.length > 0 && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <p className="text-blue-400 text-xs font-semibold uppercase tracking-wider">Overpayments</p>
            </div>
            <p className="text-white text-2xl font-bold mb-1">{overpaid.length}</p>
            <p className="text-blue-300/70 text-xs">
              {formatNaira(overpaid.reduce((sum, c) => sum + parseFloat(c.credit_balance || 0), 0))} total credit
            </p>
            <div className="mt-3 space-y-1.5">
              {overpaid.slice(0, 3).map((c) => (
                <div key={c.id} className="flex justify-between text-xs">
                  <span className="text-gray-400 truncate mr-2">{c.name}</span>
                  <span className="text-blue-400 flex-shrink-0">+{formatNaira(c.credit_balance)}</span>
                </div>
              ))}
              {overpaid.length > 3 && <p className="text-gray-600 text-xs">+{overpaid.length - 3} more</p>}
            </div>
          </div>
        )}

        {overdue.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <p className="text-red-400 text-xs font-semibold uppercase tracking-wider">Overdue</p>
            </div>
            <p className="text-white text-2xl font-bold mb-1">{overdue.length}</p>
            <p className="text-red-300/70 text-xs">
              {formatNaira(overdue.reduce((sum, c) => sum + parseFloat(c.expected_amount) - parseFloat(c.running_total), 0))} total overdue
            </p>
            <div className="mt-3 space-y-1.5">
              {overdue.slice(0, 3).map((c) => (
                <div key={c.id} className="flex justify-between text-xs">
                  <span className="text-gray-400 truncate mr-2">{c.name}</span>
                  <span className="text-red-400 flex-shrink-0">
                    {formatNaira(parseFloat(c.expected_amount) - parseFloat(c.running_total))}
                  </span>
                </div>
              ))}
              {overdue.length > 3 && <p className="text-gray-600 text-xs">+{overdue.length - 3} more</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { activeWorkspace, config } = useOutletContext();
  const navigate                    = useNavigate();

  const { data: stats,    isLoading: statsLoading } = useWorkspaceStats(activeWorkspace?.id);
  const { data: customers = [] }                     = useCustomers(activeWorkspace?.id);
  const { data: activity  = [] }                     = useWorkspaceActivity(activeWorkspace?.id);

  if (!activeWorkspace) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-400 text-lg">No workspace selected</p>
          <p className="text-gray-600 text-sm mt-1">Create a workspace to get started</p>
        </div>
      </div>
    );
  }

  const pieData = stats
    ? [
        { name: "Paid",    value: stats.total_paid,    status: "paid" },
        { name: "Partial", value: stats.total_partial,  status: "partially_paid" },
        { name: "Pending", value: stats.total_pending,  status: "pending" },
        { name: "Overdue", value: stats.total_overdue,  status: "overdue" },
      ].filter((d) => d.value > 0)
    : [];

  const barData = customers.slice(-10).map((c) => ({
    name: c.name.split(" ")[0],
    paid: parseFloat(c.running_total) || 0,
    owed: Math.max(0, parseFloat(c.expected_amount) - parseFloat(c.running_total)),
  }));

  const statCards = [
    { label: "Total collected",                               value: formatNaira(stats?.total_collected), icon: TrendingUp,   color: "text-green-400",  bg: "bg-green-400/10"  },
    { label: "Outstanding",                                   value: formatNaira(stats?.total_outstanding),icon: Clock,        color: "text-yellow-400", bg: "bg-yellow-400/10" },
    { label: `Total ${config?.customersLabel || "customers"}`,value: stats?.total_customers ?? "—",        icon: Users,        color: "text-blue-400",   bg: "bg-blue-400/10"   },
    { label: "Overdue",                                       value: stats?.total_overdue ?? "—",           icon: AlertCircle,  color: "text-red-400",    bg: "bg-red-400/10"    },
    { label: "Fully paid",                                    value: stats?.total_paid ?? "—",              icon: CheckCircle,  color: "text-green-400",  bg: "bg-green-400/10"  },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{config?.icon}</span>
          <h2 className="text-white text-2xl font-bold">{activeWorkspace.name}</h2>
        </div>
        <p className="text-gray-500 text-sm mt-1">
          {config?.label} workspace · {config?.paymentLabel} collection
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">

        {statCards.map((card) => (
          <div key={card.label} className="bg-[#1a1d27] border border-gray-800 rounded-xl p-4">
            <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <p className="text-gray-500 text-xs mb-1">{card.label}</p>
            <p className="text-white font-bold text-lg">{statsLoading ? "..." : card.value}</p>
          </div>
        ))}
      </div>

      {/* Reconciliation Alerts */}
      {customers.length > 0 && <ReconciliationAlerts customers={customers} />}

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-2 bg-[#1a1d27] border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 text-sm">Collection breakdown</h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} barSize={12}>
                <XAxis dataKey="name" tick={{ fill: "#6B7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#6B7280", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ backgroundColor: "#0f1117", border: "1px solid #374151", borderRadius: "8px", color: "#fff", fontSize: "12px" }} formatter={(value) => formatNaira(value)} />
                <Bar dataKey="paid" fill="#27AE60" radius={[4, 4, 0, 0]} name="Paid" />
                <Bar dataKey="owed" fill="#374151" radius={[4, 4, 0, 0]} name="Outstanding" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center">
              <p className="text-gray-600 text-sm">Add {config?.customersLabel?.toLowerCase() || "customers"} to see data</p>
            </div>
          )}
        </div>

        <div className="bg-[#1a1d27] border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 text-sm">Status breakdown</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                  {pieData.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
                  ))}
                </Pie>
                <Legend formatter={(value) => <span style={{ color: "#9CA3AF", fontSize: "11px" }}>{value}</span>} />
                <Tooltip contentStyle={{ backgroundColor: "#0f1117", border: "1px solid #374151", borderRadius: "8px", color: "#fff", fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center">
              <p className="text-gray-600 text-sm text-center">No payment data yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Activity feed + recent customers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Activity Feed */}
        <div className="bg-[#1a1d27] border border-gray-800 rounded-xl">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-white font-semibold text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#E8A838]" />
              Reconciliation activity
            </h3>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-gray-600 text-xs">Live</span>
            </div>
          </div>
          {activity.length === 0 ? (
            <div className="py-10 text-center">
              <Activity className="w-8 h-8 text-gray-700 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No activity yet</p>
              <p className="text-gray-600 text-xs mt-1">Payment events appear here as they're reconciled</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800 max-h-80 overflow-y-auto">
              {activity.map((item) => (
                <ActivityItem key={item.id} item={item} onClick={() => navigate(`/customers/${item.customer_id}`)} />
              ))}
            </div>
          )}
        </div>

        {/* Recent customers */}
        <div className="bg-[#1a1d27] border border-gray-800 rounded-xl">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-white font-semibold text-sm">
              Recent {config?.customersLabel?.toLowerCase() || "customers"}
            </h3>
            <button onClick={() => navigate("/customers")} className="text-[#E8A838] text-xs hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {customers.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-gray-500 text-sm">{config?.emptyMessage}</p>
              <button onClick={() => navigate("/customers")} className="mt-3 text-[#E8A838] text-sm hover:underline">
                Add your first {config?.customerLabel?.toLowerCase()} →
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-800 max-h-80 overflow-y-auto">
              {customers.slice(0, 8).map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => navigate(`/customers/${customer.id}`)}
                  className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-[#22263a] transition-colors"
                >
                  <div className="text-left">
                    <p className="text-white text-sm font-medium">{customer.name}</p>
                    <p className="text-gray-600 text-xs mt-0.5">
                      {customer.virtual_account_number ? `Acct: ${customer.virtual_account_number}` : "Account pending"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-white text-sm">{formatNaira(customer.running_total)}</p>
                      <p className="text-gray-600 text-xs">of {formatNaira(customer.expected_amount)}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(customer.status)}`}>
                      {getStatusLabel(customer.status)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
