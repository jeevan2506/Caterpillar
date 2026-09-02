// Refined status pill with a leading dot.
const STYLES = {
  available: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  booked: "bg-purple-50 text-purple-700 ring-purple-600/20",
  active: "bg-blue-50 text-blue-700 ring-blue-600/20",
  overdue: "bg-red-50 text-red-700 ring-red-600/20",
  "due-soon": "bg-amber-50 text-amber-700 ring-amber-600/20",
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  pending_approval: "bg-amber-50 text-amber-700 ring-amber-600/20",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  rejected: "bg-red-50 text-red-700 ring-red-600/20",
  unapproved: "bg-stone-100 text-stone-500 ring-stone-400/20",
  refunded: "bg-stone-100 text-stone-600 ring-stone-500/20",
  unused: "bg-stone-100 text-stone-600 ring-stone-500/20",
  "checked-out": "bg-blue-50 text-blue-700 ring-blue-600/20",
  checked_out: "bg-blue-50 text-blue-700 ring-blue-600/20",
  "checked-in": "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  checked_in: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  returned: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  expired: "bg-red-50 text-red-700 ring-red-600/20",
  "in-progress": "bg-blue-50 text-blue-700 ring-blue-600/20",
  resolved: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  assigned: "bg-amber-50 text-amber-700 ring-amber-600/20",
  high: "bg-red-50 text-red-700 ring-red-600/20",
  medium: "bg-amber-50 text-amber-700 ring-amber-600/20",
  low: "bg-stone-100 text-stone-600 ring-stone-500/20",
  online: "bg-emerald-50 text-emerald-700 ring-emerald-600/30",
  offline: "bg-red-50 text-red-700 ring-red-600/30",
  running: "bg-emerald-50 text-emerald-700 ring-emerald-600/30",
  idle: "bg-amber-50 text-amber-700 ring-amber-600/30",
  stopped: "bg-stone-100 text-stone-600 ring-stone-500/30",
  unknown: "bg-stone-100 text-stone-500 ring-stone-400/30",
};

export default function Badge({ status, label }) {
  const cls = STYLES[status] || "bg-stone-100 text-stone-600 ring-stone-500/20";
  return (
    <span className={`badge ${cls}`}>
      <span className="badge-dot" />
      {(label || status || "").replace(/-/g, " ")}
    </span>
  );
}
