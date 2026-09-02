import { useState, useMemo } from "react";
import Badge from "./Badge.jsx";
import Icon from "./Icon.jsx";
import { fmtDate } from "../utils/helpers.js";

const FILTER_TABS = [
  { id: "all", label: "All Vehicles & Rentals" },
  { id: "checked-out", label: "Checked-Out (Active)" },
  { id: "checked-in", label: "Checked-In (Fleet)" },
  { id: "booked", label: "Awaiting Pickup" },
  { id: "history", label: "Previously Rented (History)" },
  { id: "overdue", label: "Overdue / Due Soon" },
];

function fmtDateTime(d) {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RentalsManagement({
  equipment = [],
  bookings = [],
  operators = [],
  telemetry = [],
  users = [],
}) {
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [siteFilter, setSiteFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedItem, setSelectedItem] = useState(null);

  // Build maps for fast O(1) enrichment
  const opMap = useMemo(() => {
    const map = {};
    (operators || []).forEach((op) => {
      map[op.operatorId] = op;
    });
    return map;
  }, [operators]);

  const userMap = useMemo(() => {
    const map = {};
    (users || []).forEach((u) => {
      map[u.userId] = u;
    });
    return map;
  }, [users]);

  const telMap = useMemo(() => {
    const map = {};
    (telemetry || []).forEach((t) => {
      map[t.equipmentId] = t;
    });
    return map;
  }, [telemetry]);

  const eqMap = useMemo(() => {
    const map = {};
    (equipment || []).forEach((eq) => {
      map[eq.equipmentId] = eq;
    });
    return map;
  }, [equipment]);

  // Consolidate bookings and equipment into unified rental items
  const unifiedItems = useMemo(() => {
    const items = [];

    // 1. Process all booking records (both active, booked, and historical completed)
    (bookings || []).forEach((b) => {
      const eq = eqMap[b.equipmentId] || {
        equipmentId: b.equipmentId,
        type: "Equipment",
        siteId: null,
        status: "available",
      };
      const op = b.assignedOperatorId ? opMap[b.assignedOperatorId] : null;
      const user = b.userId ? userMap[b.userId] : null;
      const tel = telMap[b.equipmentId] || null;

      let category = "other";
      let statusLabel = b.qrStatus;

      const isCheckedOut = b.qrStatus === "checked-out";
      const isCompleted = b.qrStatus === "completed";
      const isBooked = b.approvalStatus === "approved" && b.qrStatus === "unused";
      const isPending = b.approvalStatus === "pending_approval";

      // Calculate overdue condition for checked-out rentals
      let isOverdue = false;
      let isDueSoon = false;
      if (isCheckedOut && b.expectedReturnDate) {
        const due = new Date(b.expectedReturnDate);
        const now = new Date();
        if (due < now) isOverdue = true;
        else if ((due - now) / 86400000 <= 2) isDueSoon = true;
      }

      if (isCheckedOut) {
        category = isOverdue ? "overdue" : isDueSoon ? "due-soon" : "checked-out";
        statusLabel = isOverdue ? "overdue" : isDueSoon ? "due-soon" : "checked-out";
      } else if (isCompleted) {
        category = "history";
        statusLabel = "completed";
      } else if (isBooked) {
        category = "booked";
        statusLabel = "booked";
      } else if (isPending) {
        category = "pending";
        statusLabel = "pending_approval";
      }

      items.push({
        id: b.bookingId || `booking_${b._id}`,
        recordType: "booking",
        bookingId: b.bookingId,
        equipmentId: b.equipmentId,
        equipmentType: eq.type || "Equipment",
        siteId: eq.siteId || "—",
        userId: b.userId,
        userName: user?.name || b.userId || "Customer",
        userPhone: user?.phone || "—",
        operatorId: b.assignedOperatorId || eq.lastOperatorId || null,
        operatorName: op?.name || (b.operatorRequest === "self" ? "Self-Operated" : "Unassigned"),
        operatorRequest: b.operatorRequest,
        paymentStatus: b.paymentStatus || "paid",
        approvalStatus: b.approvalStatus,
        qrStatus: b.qrStatus,
        statusLabel,
        category,
        isOverdue,
        isDueSoon,
        rentalDays: b.rentalDays || 7,
        checkOutDate: b.checkOutDate || null,
        expectedReturnDate: b.expectedReturnDate || (isCheckedOut ? eq.checkInDate : null),
        checkInDate: b.checkInDate || (isCompleted ? eq.actualReturnDate : null),
        createdAt: b.createdAt || new Date(),
        engineHoursPerDay: eq.engineHoursPerDay || 0,
        idleHoursPerDay: eq.idleHoursPerDay || 0,
        operatingDays: eq.operatingDays || 0,
        telemetry: tel,
        rawBooking: b,
        rawEquipment: eq,
      });
    });

    // 2. Add currently checked-in / available fleet vehicles that do not have active booking
    (equipment || []).forEach((eq) => {
      const isAvailable = eq.status === "available";
      const hasActiveBooking = items.some(
        (it) => it.equipmentId === eq.equipmentId && (it.qrStatus === "checked-out" || it.qrStatus === "unused")
      );

      if (isAvailable && !hasActiveBooking) {
        const op = eq.lastOperatorId ? opMap[eq.lastOperatorId] : null;
        const tel = telMap[eq.equipmentId] || null;

        items.push({
          id: `eq_${eq.equipmentId}`,
          recordType: "fleet_checked_in",
          bookingId: "In Depot (Ready)",
          equipmentId: eq.equipmentId,
          equipmentType: eq.type,
          siteId: eq.siteId || "Depot",
          userId: "Fleet Yard",
          userName: "Available in Inventory",
          userPhone: "—",
          operatorId: eq.lastOperatorId,
          operatorName: op?.name || (eq.operatorSource === "self" ? "Customer Provided" : "None / Standby"),
          operatorRequest: eq.operatorSource,
          paymentStatus: "n/a",
          approvalStatus: "ready",
          qrStatus: "available",
          statusLabel: "checked-in",
          category: "checked-in",
          isOverdue: false,
          isDueSoon: false,
          rentalDays: eq.operatingDays || 0,
          checkOutDate: eq.checkOutDate || null,
          expectedReturnDate: null,
          checkInDate: eq.actualReturnDate || eq.checkInDate || null,
          createdAt: eq.actualReturnDate || new Date(0),
          engineHoursPerDay: eq.engineHoursPerDay || 0,
          idleHoursPerDay: eq.idleHoursPerDay || 0,
          operatingDays: eq.operatingDays || 0,
          telemetry: tel,
          rawBooking: null,
          rawEquipment: eq,
        });
      }
    });

    return items;
  }, [bookings, equipment, eqMap, opMap, userMap, telMap]);

  // Counts for tabs & KPI summary
  const counts = useMemo(() => {
    const activeCheckedOut = unifiedItems.filter((i) => i.qrStatus === "checked-out").length;
    const checkedInAvailable = equipment.filter((eq) => eq.status === "available").length;
    const awaitingPickup = unifiedItems.filter(
      (i) => i.approvalStatus === "approved" && i.qrStatus === "unused"
    ).length;
    const historyCount = unifiedItems.filter((i) => i.qrStatus === "completed").length;
    const overdueCount = unifiedItems.filter((i) => i.isOverdue || i.isDueSoon).length;

    return {
      all: unifiedItems.length,
      "checked-out": activeCheckedOut,
      "checked-in": checkedInAvailable,
      booked: awaitingPickup,
      history: historyCount,
      overdue: overdueCount,
    };
  }, [unifiedItems, equipment]);

  // Sites list for dropdown
  const siteOptions = useMemo(() => {
    const set = new Set();
    equipment.forEach((eq) => eq.siteId && set.add(eq.siteId));
    bookings.forEach((b) => {
      const eq = eqMap[b.equipmentId];
      if (eq?.siteId) set.add(eq.siteId);
    });
    return Array.from(set).sort();
  }, [equipment, bookings, eqMap]);

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    return unifiedItems
      .filter((item) => {
        // Tab filter
        if (tab === "checked-out" && item.qrStatus !== "checked-out") return false;
        if (tab === "checked-in" && item.statusLabel !== "checked-in" && item.qrStatus !== "available") return false;
        if (tab === "booked" && !(item.approvalStatus === "approved" && item.qrStatus === "unused")) return false;
        if (tab === "history" && item.qrStatus !== "completed") return false;
        if (tab === "overdue" && !item.isOverdue && !item.isDueSoon) return false;

        // Type filter
        if (typeFilter !== "all" && item.equipmentType !== typeFilter) return false;

        // Site filter
        if (siteFilter !== "all" && item.siteId !== siteFilter) return false;

        // Search query
        if (search.trim()) {
          const q = search.toLowerCase().trim();
          const match =
            item.equipmentId?.toLowerCase().includes(q) ||
            item.equipmentType?.toLowerCase().includes(q) ||
            item.bookingId?.toLowerCase().includes(q) ||
            item.userId?.toLowerCase().includes(q) ||
            item.userName?.toLowerCase().includes(q) ||
            item.siteId?.toLowerCase().includes(q) ||
            item.operatorName?.toLowerCase().includes(q) ||
            item.operatorId?.toLowerCase().includes(q);
          if (!match) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "newest") {
          const dateA = new Date(a.checkOutDate || a.createdAt || 0).getTime();
          const dateB = new Date(b.checkOutDate || b.createdAt || 0).getTime();
          return dateB - dateA;
        }
        if (sortBy === "return_date") {
          const dateA = new Date(a.expectedReturnDate || a.checkInDate || 0).getTime();
          const dateB = new Date(b.expectedReturnDate || b.checkInDate || 0).getTime();
          return dateB - dateA;
        }
        if (sortBy === "equipment_id") {
          return (a.equipmentId || "").localeCompare(b.equipmentId || "");
        }
        if (sortBy === "customer") {
          return (a.userName || "").localeCompare(b.userName || "");
        }
        return 0;
      });
  }, [unifiedItems, tab, typeFilter, siteFilter, search, sortBy]);

  return (
    <div className="space-y-5">
      {/* Overview Stat Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-5">
        <div className="card p-4 flex items-center gap-3.5 bg-gradient-to-br from-blue-50/50 to-white">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700">
            <Icon name="scan" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-stone-400">
              Checked-Out (Active)
            </p>
            <p className="font-display text-2xl font-black text-blue-900 mt-0.5">
              {counts["checked-out"]}
            </p>
            <p className="text-[11px] text-blue-600 font-medium truncate">Vehicles on customer sites</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3.5 bg-gradient-to-br from-emerald-50/50 to-white">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
            <Icon name="cube" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-stone-400">
              Checked-In (Fleet)
            </p>
            <p className="font-display text-2xl font-black text-emerald-900 mt-0.5">
              {counts["checked-in"]}
            </p>
            <p className="text-[11px] text-emerald-600 font-medium truncate">Ready in yard / depot</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3.5 bg-gradient-to-br from-purple-50/50 to-white">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-purple-100 text-purple-700">
            <Icon name="check" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-stone-400">
              Awaiting Pickup
            </p>
            <p className="font-display text-2xl font-black text-purple-900 mt-0.5">
              {counts.booked}
            </p>
            <p className="text-[11px] text-purple-600 font-medium truncate">Approved & Paid</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3.5 bg-gradient-to-br from-stone-50 to-white">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-stone-200 text-stone-700">
            <Icon name="chart" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-stone-400">
              Rental History
            </p>
            <p className="font-display text-2xl font-black text-stone-900 mt-0.5">
              {counts.history}
            </p>
            <p className="text-[11px] text-stone-500 font-medium truncate">Previously completed rentals</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3.5 bg-gradient-to-br from-red-50/50 to-white col-span-2 sm:col-span-1">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-100 text-red-700">
            <Icon name="alert" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-stone-400">
              Overdue / Due Soon
            </p>
            <p className={`font-display text-2xl font-black mt-0.5 ${counts.overdue > 0 ? "text-red-700" : "text-stone-900"}`}>
              {counts.overdue}
            </p>
            <p className="text-[11px] text-red-600 font-medium truncate">Requires tracking attention</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 pb-0.5 border-b border-stone-200">
        {FILTER_TABS.map((t) => {
          const active = tab === t.id;
          const count = counts[t.id] ?? (t.id === "all" ? counts.all : 0);
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-t-xl px-3.5 py-2.5 text-xs font-bold transition border-b-2 -mb-px min-h-[40px] ${
                active
                  ? "border-cat-ink bg-white text-stone-900 shadow-sm"
                  : "border-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-100/60"
              }`}
            >
              <span>{t.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  active ? "bg-cat-ink text-white" : "bg-stone-200/80 text-stone-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & Filter Controls */}
      <div className="card p-3.5 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="label">Search Vehicles, Bookings, Customers, Operators</label>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search EQ001, BOOK-..., Joy, Excavator, S001..."
                className="input pl-9 text-xs"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
                <Icon name="scan" className="h-4 w-4" />
              </span>
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="label">Vehicle Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="input text-xs"
            >
              <option value="all">All Vehicle Types</option>
              <option value="Excavator">Excavator</option>
              <option value="Crane">Crane</option>
              <option value="Bulldozer">Bulldozer</option>
              <option value="Grader">Grader</option>
            </select>
          </div>

          <div>
            <label className="label">Site Location</label>
            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              className="input text-xs"
            >
              <option value="all">All Sites</option>
              {siteOptions.map((s) => (
                <option key={s} value={s}>
                  Site {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3 text-xs text-stone-500">
          <div>
            Showing <span className="font-bold text-stone-900">{filteredItems.length}</span> of{" "}
            <span className="font-medium text-stone-700">{unifiedItems.length}</span> vehicle & rental records
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-stone-400">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-800"
            >
              <option value="newest">Newest Activity</option>
              <option value="return_date">Expected / Return Date</option>
              <option value="equipment_id">Vehicle ID</option>
              <option value="customer">Customer Name</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="card overflow-hidden">
        <div className="table-container">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/80">
                <th className="th">Vehicle / Equipment</th>
                <th className="th">Booking Ref</th>
                <th className="th">Status</th>
                <th className="th">Customer</th>
                <th className="th">Operator</th>
                <th className="th">Site</th>
                <th className="th whitespace-nowrap">Check-Out Date</th>
                <th className="th whitespace-nowrap">Expected Return</th>
                <th className="th whitespace-nowrap">Actual Check-In</th>
                <th className="th text-right">Duration</th>
                <th className="th text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredItems.map((item) => {
                const isCheckedOut = item.qrStatus === "checked-out";
                const isCompleted = item.qrStatus === "completed";
                const isAvailable = item.statusLabel === "checked-in";

                return (
                  <tr key={item.id} className="transition hover:bg-stone-50/80">
                    {/* Vehicle */}
                    <td className="td">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-cat-yellow/15 text-cat-ink font-display font-bold text-xs">
                          {item.equipmentType?.slice(0, 2).toUpperCase() || "EQ"}
                        </span>
                        <div>
                          <p className="font-display font-bold text-stone-900 text-sm">
                            {item.equipmentId}
                          </p>
                          <p className="text-[11px] text-stone-500 font-medium">
                            {item.equipmentType}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Booking ID */}
                    <td className="td">
                      <div>
                        <p className="font-mono text-xs font-semibold text-stone-800 break-all">
                          {item.bookingId}
                        </p>
                        {item.paymentStatus && item.paymentStatus !== "n/a" && (
                          <span className="inline-block mt-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            {item.paymentStatus.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="td">
                      <div className="space-y-1">
                        <Badge
                          status={
                            item.isOverdue
                              ? "overdue"
                              : item.isDueSoon
                              ? "due-soon"
                              : item.statusLabel
                          }
                          label={
                            item.isOverdue
                              ? "Overdue Return"
                              : item.isDueSoon
                              ? "Due Soon"
                              : isCheckedOut
                              ? "Checked-Out (On Site)"
                              : isCompleted
                              ? "Checked-In (Returned)"
                              : isAvailable
                              ? "Checked-In (Fleet Yard)"
                              : item.statusLabel
                          }
                        />
                        {isCheckedOut && item.telemetry?.connectionStatus && (
                          <div className="flex items-center gap-1 text-[10px] text-stone-500">
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                item.telemetry.connectionStatus === "online"
                                  ? "bg-emerald-500 animate-pulse"
                                  : "bg-red-500"
                              }`}
                            />
                            <span>Telemetry: {item.telemetry.connectionStatus}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="td">
                      <div>
                        <p className="font-semibold text-stone-900 text-xs truncate max-w-[140px]">
                          {item.userName}
                        </p>
                        <p className="text-[11px] text-stone-400 truncate max-w-[140px]">
                          {item.userId}
                        </p>
                      </div>
                    </td>

                    {/* Operator */}
                    <td className="td">
                      <div>
                        <p className="font-medium text-stone-800 text-xs truncate max-w-[140px]">
                          {item.operatorName}
                        </p>
                        <p className="text-[10px] text-stone-400 capitalize">
                          {item.operatorRequest ? item.operatorRequest.replace(/-/g, " ") : "—"}
                        </p>
                      </div>
                    </td>

                    {/* Site */}
                    <td className="td">
                      <span className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-700">
                        {item.siteId || "—"}
                      </span>
                    </td>

                    {/* Check-Out Date */}
                    <td className="td whitespace-nowrap text-xs text-stone-700">
                      {item.checkOutDate ? (
                        <div>
                          <p className="font-medium text-stone-900">{fmtDate(item.checkOutDate)}</p>
                          <p className="text-[10px] text-stone-400">{new Date(item.checkOutDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>

                    {/* Expected Return Date */}
                    <td className="td whitespace-nowrap text-xs">
                      {item.expectedReturnDate ? (
                        <div>
                          <p
                            className={`font-semibold ${
                              item.isOverdue
                                ? "text-red-600"
                                : item.isDueSoon
                                ? "text-amber-600"
                                : "text-stone-900"
                            }`}
                          >
                            {fmtDate(item.expectedReturnDate)}
                          </p>
                          <p className="text-[10px] text-stone-400">
                            {new Date(item.expectedReturnDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>

                    {/* Actual Check-In Date */}
                    <td className="td whitespace-nowrap text-xs">
                      {item.checkInDate ? (
                        <div>
                          <p className="font-semibold text-emerald-700">{fmtDate(item.checkInDate)}</p>
                          <p className="text-[10px] text-stone-400">
                            {new Date(item.checkInDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      ) : isCheckedOut ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-ping" />
                          Currently on Site
                        </span>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>

                    {/* Duration */}
                    <td className="td text-right whitespace-nowrap text-xs font-bold text-stone-800">
                      {item.rentalDays ? `${item.rentalDays} days` : "—"}
                    </td>

                    {/* Actions */}
                    <td className="td text-center">
                      <button
                        onClick={() => setSelectedItem(item)}
                        className="btn btn-ghost btn-sm text-xs font-bold text-cat-ink hover:bg-stone-200/80 px-2.5 py-1.5"
                      >
                        Inspect Details
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-stone-400">
                    <Icon name="cube" className="mx-auto h-8 w-8 text-stone-300 mb-2" />
                    <p className="font-semibold text-stone-600">No vehicle rentals found</p>
                    <p className="text-xs mt-1">Try adjusting your filters or search keywords.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Inspection Modal */}
      {selectedItem && (
        <RentalDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}

function RentalDetailModal({ item, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3.5 backdrop-blur-sm animate-fade-in">
      <div className="flex max-h-[92vh] w-full max-w-3xl animate-scale-in flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-cat-ink font-display font-bold text-cat-yellow text-sm">
              {item.equipmentType?.slice(0, 2).toUpperCase() || "EQ"}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-extrabold text-stone-900">
                  {item.equipmentId} · {item.equipmentType}
                </h3>
                <Badge
                  status={
                    item.isOverdue
                      ? "overdue"
                      : item.isDueSoon
                      ? "due-soon"
                      : item.statusLabel
                  }
                />
              </div>
              <p className="text-xs text-stone-500 font-mono mt-0.5">
                Ref: {item.bookingId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-200 hover:text-stone-700"
            aria-label="Close modal"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="overflow-y-auto p-5 space-y-6">
          {/* Lifecycle Stepper */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-3">
              Rental & Check-In / Check-Out Lifecycle Timeline
            </p>
            <div className="grid gap-2 sm:grid-cols-4 text-xs">
              <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-3">
                <p className="font-bold text-stone-900">1. Booking Request</p>
                <p className="text-[11px] text-stone-500 mt-1">Payment: {item.paymentStatus}</p>
                <p className="text-[10px] text-stone-400 mt-1">{fmtDateTime(item.createdAt)}</p>
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-3">
                <p className="font-bold text-stone-900">2. Admin Approval</p>
                <p className="text-[11px] text-stone-500 mt-1">Status: {item.approvalStatus}</p>
                <p className="text-[10px] text-stone-400 mt-1">
                  {item.rawBooking?.approvedAt ? fmtDateTime(item.rawBooking.approvedAt) : "—"}
                </p>
              </div>

              <div className={`rounded-xl border p-3 ${item.checkOutDate ? "border-blue-200 bg-blue-50/40" : "border-stone-200 bg-stone-50/50"}`}>
                <p className="font-bold text-stone-900">3. Check-Out / Dispatch</p>
                <p className="text-[11px] text-stone-600 mt-1">Site: {item.siteId}</p>
                <p className="text-[10px] text-stone-500 mt-1">{fmtDateTime(item.checkOutDate)}</p>
              </div>

              <div className={`rounded-xl border p-3 ${item.checkInDate ? "border-emerald-200 bg-emerald-50/40" : "border-stone-200 bg-stone-50/50"}`}>
                <p className="font-bold text-stone-900">4. Check-In / Return</p>
                <p className="text-[11px] text-stone-600 mt-1">
                  {item.checkInDate ? "Returned to Yard" : "Currently on Site"}
                </p>
                <p className="text-[10px] text-stone-500 mt-1">{fmtDateTime(item.checkInDate)}</p>
              </div>
            </div>
          </div>

          {/* Key Details Grid */}
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 rounded-xl border border-stone-200 bg-stone-50/40 p-4 text-xs">
            <div>
              <p className="text-[10px] uppercase font-bold text-stone-400">Customer Details</p>
              <p className="font-bold text-stone-900 mt-0.5">{item.userName}</p>
              <p className="text-stone-500">ID: {item.userId}</p>
              <p className="text-stone-500">Phone: {item.userPhone}</p>
            </div>

            <div>
              <p className="text-[10px] uppercase font-bold text-stone-400">Assigned Operator</p>
              <p className="font-bold text-stone-900 mt-0.5">{item.operatorName}</p>
              <p className="text-stone-500">Operator ID: {item.operatorId || "—"}</p>
              <p className="text-stone-500 capitalize">Mode: {item.operatorRequest || "—"}</p>
            </div>

            <div>
              <p className="text-[10px] uppercase font-bold text-stone-400">Operating Location</p>
              <p className="font-bold text-stone-900 mt-0.5">Site: {item.siteId}</p>
              <p className="text-stone-500">Rental Duration: {item.rentalDays} days</p>
              <p className="text-stone-500">
                Operating Days: {item.operatingDays}d
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase font-bold text-stone-400">Check-Out Timestamp</p>
              <p className="font-bold text-stone-900 mt-0.5">{fmtDateTime(item.checkOutDate)}</p>
            </div>

            <div>
              <p className="text-[10px] uppercase font-bold text-stone-400">Expected Return Date</p>
              <p className={`font-bold mt-0.5 ${item.isOverdue ? "text-red-600" : "text-stone-900"}`}>
                {fmtDateTime(item.expectedReturnDate)}
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase font-bold text-stone-400">Actual Return / Check-In</p>
              <p className="font-bold text-emerald-700 mt-0.5">{fmtDateTime(item.checkInDate)}</p>
            </div>
          </div>

          {/* Telemetry & Machine Utilization Snapshot */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-2">
              Telemetry & Engine Performance Snapshot
            </p>
            <div className="grid gap-3 sm:grid-cols-4 text-xs">
              <div className="rounded-xl border border-stone-200 p-3">
                <p className="text-[10px] text-stone-400 font-semibold uppercase">Engine Hours/Day</p>
                <p className="font-display text-lg font-bold text-stone-900 mt-0.5">
                  {item.engineHoursPerDay} h/d
                </p>
              </div>

              <div className="rounded-xl border border-stone-200 p-3">
                <p className="text-[10px] text-stone-400 font-semibold uppercase">Idle Hours/Day</p>
                <p className="font-display text-lg font-bold text-stone-900 mt-0.5">
                  {item.idleHoursPerDay} h/d
                </p>
              </div>

              <div className="rounded-xl border border-stone-200 p-3">
                <p className="text-[10px] text-stone-400 font-semibold uppercase">Connection Status</p>
                <div className="mt-1">
                  <Badge status={item.telemetry?.connectionStatus || "unknown"} />
                </div>
              </div>

              <div className="rounded-xl border border-stone-200 p-3">
                <p className="text-[10px] text-stone-400 font-semibold uppercase">Fuel Level</p>
                <p className="font-display text-lg font-bold text-stone-900 mt-0.5">
                  {item.telemetry?.fuelLevel != null ? `${Math.round(item.telemetry.fuelLevel)}%` : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Alert Dispatches (if any) */}
          {item.rawBooking?.overdueSmsSent && (
            <div className="rounded-xl border border-red-200 bg-red-50/60 p-3 text-xs text-red-900">
              <div className="flex items-center gap-2 font-bold">
                <Icon name="alert" className="h-4 w-4 text-red-600 shrink-0" />
                <span>Overdue SMS Alert Dispatched</span>
              </div>
              <p className="mt-1 text-red-800 text-[11px]">
                Dispatched at {fmtDateTime(item.rawBooking.overdueSmsSentAt)} · Status: {item.rawBooking.lastSmsStatus || "sent"}
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-stone-100 bg-stone-50 px-5 py-3">
          <button onClick={onClose} className="btn btn-dark btn-sm text-xs font-bold px-4 py-2">
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
