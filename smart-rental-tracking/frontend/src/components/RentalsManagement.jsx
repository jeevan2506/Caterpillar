import { useState, useMemo } from "react";
import Badge from "./Badge.jsx";
import Icon from "./Icon.jsx";
import { Spinner, Alert } from "./ui.jsx";
import { fmtDate } from "../utils/helpers.js";
import { sendRentalReminderSms, updateUserPhone } from "../services/api.js";

const FILTER_TABS = [
  { id: "all", label: "All Vehicles & Rentals", icon: "cube" },
  { id: "checked-out", label: "Active on Site", icon: "scan" },
  { id: "checked-in", label: "In Yard Depot", icon: "cube" },
  { id: "booked", label: "Awaiting Pickup", icon: "check" },
  { id: "overdue", label: "Overdue", icon: "alert" },
  { id: "history", label: "History (Returned)", icon: "chart" },
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

function computeRemainingTime(expectedReturnDate) {
  if (!expectedReturnDate) return { text: "—", isOverdue: false, isDueSoon: false, diffMs: 0 };
  const target = new Date(expectedReturnDate).getTime();
  const now = Date.now();
  const diffMs = target - now;

  const absDiff = Math.abs(diffMs);
  const totalMinutes = Math.max(1, Math.round(absDiff / (60 * 1000)));
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMins = totalMinutes % 60;
  const days = Math.floor(totalHours / 24);
  const remainingHours = totalHours % 24;

  let durationText = "";
  if (days > 0) {
    durationText = `${days}d ${remainingHours}h`;
  } else if (totalHours > 0) {
    durationText = `${totalHours}h ${remainingMins}m`;
  } else {
    durationText = `${totalMinutes} min`;
  }

  if (diffMs < 0) {
    return {
      text: `Overdue by ${durationText}`,
      fullText: `${durationText} past due`,
      isOverdue: true,
      isDueSoon: false,
      diffMs,
    };
  }

  const isDueSoon = diffMs <= 48 * 3600 * 1000; // <= 2 days
  return {
    text: `${durationText} left`,
    fullText: `${durationText} remaining`,
    isOverdue: false,
    isDueSoon,
    diffMs,
  };
}

export default function RentalsManagement({
  equipment = [],
  bookings = [],
  operators = [],
  telemetry = [],
  users = [],
  onRefresh,
}) {
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [siteFilter, setSiteFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedItem, setSelectedItem] = useState(null);
  const [editPhoneUser, setEditPhoneUser] = useState(null);
  const [localPhoneOverrides, setLocalPhoneOverrides] = useState({});

  // Build maps for fast O(1) lookups
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
      if (u.userId) map[u.userId] = u;
      if (u.username) map[u.username] = u;
      if (u.userId) map[u.userId.toLowerCase()] = u;
      if (u.username) map[u.username.toLowerCase()] = u;
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

    // 1. Process all booking records
    (bookings || []).forEach((b) => {
      const eq = eqMap[b.equipmentId] || {
        equipmentId: b.equipmentId,
        type: "Equipment",
        siteId: null,
        status: "available",
      };
      const op = b.assignedOperatorId ? opMap[b.assignedOperatorId] : null;
      const user = (b.userId && userMap[b.userId]) || (b.userId && userMap[b.userId.toLowerCase()]) || null;
      const tel = telMap[b.equipmentId] || null;

      let category = "other";
      let statusLabel = b.qrStatus;

      const isCheckedOut = b.qrStatus === "checked-out";
      const isCompleted = b.qrStatus === "completed";
      const isBooked = b.approvalStatus === "approved" && b.qrStatus === "unused";
      const isPending = b.approvalStatus === "pending_approval";

      // Compute expected return date
      const expectedReturn = b.expectedReturnDate
        ? new Date(b.expectedReturnDate)
        : isCheckedOut && eq.checkInDate
        ? new Date(eq.checkInDate)
        : null;

      const remainingTime = isCheckedOut && expectedReturn ? computeRemainingTime(expectedReturn) : null;
      const isOverdue = remainingTime?.isOverdue || false;
      const isDueSoon = remainingTime?.isDueSoon || false;

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

      const userPhone =
        localPhoneOverrides[b.userId] ||
        (user && localPhoneOverrides[user.userId]) ||
        (user && localPhoneOverrides[user.username]) ||
        user?.phone ||
        null;

      items.push({
        id: b.bookingId || `booking_${b._id}`,
        recordType: "booking",
        bookingId: b.bookingId,
        equipmentId: b.equipmentId,
        equipmentType: eq.type || "Equipment",
        siteId: eq.siteId || "—",
        userId: b.userId,
        userName: user?.name || b.userId || "Customer",
        userPhone,
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
        remainingTime,
        rentalDays: b.rentalDays || 7,
        checkOutDate: b.checkOutDate || null,
        expectedReturnDate: expectedReturn,
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

    // 2. Add currently checked-in / available fleet vehicles
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
          siteId: eq.siteId || "Yard",
          userId: "Yard",
          userName: "Available in Inventory",
          userPhone: null,
          operatorId: eq.lastOperatorId,
          operatorName: op?.name || (eq.operatorSource === "self" ? "Customer Provided" : "Standby"),
          operatorRequest: eq.operatorSource,
          paymentStatus: "n/a",
          approvalStatus: "ready",
          qrStatus: "available",
          statusLabel: "checked-in",
          category: "checked-in",
          isOverdue: false,
          isDueSoon: false,
          remainingTime: null,
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
  }, [bookings, equipment, eqMap, opMap, userMap, telMap, localPhoneOverrides]);

  // Counts for tabs & KPI summary
  const counts = useMemo(() => {
    const activeCheckedOut = unifiedItems.filter((i) => i.qrStatus === "checked-out").length;
    const checkedInAvailable = equipment.filter((eq) => eq.status === "available").length;
    const awaitingPickup = unifiedItems.filter(
      (i) => i.approvalStatus === "approved" && i.qrStatus === "unused"
    ).length;
    const historyCount = unifiedItems.filter((i) => i.qrStatus === "completed").length;
    const overdueCount = unifiedItems.filter((i) => i.isOverdue).length;

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
        if (tab === "overdue" && !item.isOverdue) return false;

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
            item.userPhone?.toLowerCase().includes(q) ||
            item.siteId?.toLowerCase().includes(q);
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
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-stone-900 via-stone-800 to-cat-ink p-5 text-white shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-cat-yellow text-cat-ink font-bold">
              <Icon name="cube" className="h-4 w-4" />
            </span>
            <h2 className="font-display text-lg font-black tracking-tight">
              VEHICLE RENTALS & DISPATCH HUB
            </h2>
          </div>
          <p className="mt-1 text-xs text-stone-300">
            Real-time tracking of active job sites, yard depot inventory, return deadlines, and SMS notifications.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onRefresh && onRefresh()}
            className="btn btn-secondary btn-sm text-xs font-bold px-3 py-1.5 flex items-center gap-1.5"
          >
            <Icon name="activity" className="h-3.5 w-3.5" />
            <span>Sync Fleet</span>
          </button>
        </div>
      </div>

      {/* 4 Clean Metric Summary Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <div
          onClick={() => setTab("checked-out")}
          className={`card cursor-pointer p-4 transition-all hover:shadow-md ${
            tab === "checked-out" ? "ring-2 ring-blue-500 bg-blue-50/40" : "bg-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
              Active on Site
            </span>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-100 text-blue-700">
              <Icon name="scan" className="h-4 w-4" />
            </span>
          </div>
          <p className="font-display text-2xl sm:text-3xl font-black text-stone-900 mt-2">
            {counts["checked-out"]}
          </p>
          <p className="text-[11px] text-blue-700 font-semibold mt-0.5">Dispatched to customers</p>
        </div>

        <div
          onClick={() => setTab("checked-in")}
          className={`card cursor-pointer p-4 transition-all hover:shadow-md ${
            tab === "checked-in" ? "ring-2 ring-emerald-500 bg-emerald-50/40" : "bg-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
              In Yard Depot
            </span>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
              <Icon name="cube" className="h-4 w-4" />
            </span>
          </div>
          <p className="font-display text-2xl sm:text-3xl font-black text-stone-900 mt-2">
            {counts["checked-in"]}
          </p>
          <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">Ready for dispatch</p>
        </div>

        <div
          onClick={() => setTab("booked")}
          className={`card cursor-pointer p-4 transition-all hover:shadow-md ${
            tab === "booked" ? "ring-2 ring-purple-500 bg-purple-50/40" : "bg-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
              Awaiting Pickup
            </span>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-purple-100 text-purple-700">
              <Icon name="check" className="h-4 w-4" />
            </span>
          </div>
          <p className="font-display text-2xl sm:text-3xl font-black text-stone-900 mt-2">
            {counts.booked}
          </p>
          <p className="text-[11px] text-purple-700 font-semibold mt-0.5">Approved & Paid</p>
        </div>

        <div
          onClick={() => setTab("overdue")}
          className={`card cursor-pointer p-4 transition-all hover:shadow-md ${
            tab === "overdue" ? "ring-2 ring-red-500 bg-red-50/40" : "bg-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
              Overdue Returns
            </span>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-red-100 text-red-700">
              <Icon name="alert" className="h-4 w-4" />
            </span>
          </div>
          <p className={`font-display text-2xl sm:text-3xl font-black mt-2 ${counts.overdue > 0 ? "text-red-700" : "text-stone-900"}`}>
            {counts.overdue}
          </p>
          <p className="text-[11px] text-red-600 font-semibold mt-0.5">Requires SMS reminder</p>
        </div>
      </div>

      {/* Filter Tabs Bar */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 pt-0.5 -mx-1 px-1">
        {FILTER_TABS.map((t) => {
          const active = tab === t.id;
          const count = counts[t.id] ?? (t.id === "all" ? counts.all : 0);
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                active
                  ? "bg-cat-ink text-white shadow-sm"
                  : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50 active:bg-stone-100"
              }`}
            >
              <span>{t.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  active ? "bg-cat-yellow text-cat-ink" : "bg-stone-100 text-stone-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & Filter Controls */}
      <div className="card p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2 relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Vehicle ID (EQX1001), Customer, Phone, or Site..."
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

          <div className="flex flex-col xs:flex-row items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="input text-xs w-full xs:w-1/2"
            >
              <option value="all">All Vehicle Types</option>
              <option value="Excavator">Excavator</option>
              <option value="Crane">Crane</option>
              <option value="Bulldozer">Bulldozer</option>
              <option value="Grader">Grader</option>
            </select>

            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              className="input text-xs w-full xs:w-1/2"
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
      </div>

      {/* Main Clean Table */}
      <div className="card overflow-hidden">
        <div className="table-container">
          <table className="w-full min-w-[880px] border-collapse text-left">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/80">
                <th className="th">Vehicle</th>
                <th className="th">Status</th>
                <th className="th">Customer & Phone (in DB)</th>
                <th className="th">Time Remaining</th>
                <th className="th">Dates (Out → Return)</th>
                <th className="th text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs">
              {filteredItems.map((item) => {
                const isCheckedOut = item.qrStatus === "checked-out";
                const isAvailable = item.statusLabel === "checked-in";

                return (
                  <tr key={item.id} className="transition hover:bg-stone-50/70">
                    {/* Vehicle Identity */}
                    <td className="td">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cat-yellow/20 text-cat-ink font-bold text-xs">
                          {item.equipmentType?.slice(0, 2).toUpperCase() || "EQ"}
                        </span>
                        <div>
                          <p className="font-display font-bold text-stone-900 text-sm">
                            {item.equipmentId}
                          </p>
                          <p className="text-[11px] text-stone-500 font-medium">
                            {item.equipmentType} · Site {item.siteId}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="td">
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
                            ? "Active on Site"
                            : isAvailable
                            ? "In Yard Depot"
                            : item.statusLabel
                        }
                      />
                    </td>

                    {/* Customer & Phone stored in DB */}
                    <td className="td">
                      <div>
                        <p className="font-bold text-stone-900">{item.userName}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-[11px] text-stone-600 font-semibold">
                            {item.userPhone || <span className="text-stone-400 italic">No phone in DB</span>}
                          </span>
                          {item.userId && item.userId !== "Yard" && (
                            <button
                              onClick={() =>
                                setEditPhoneUser({
                                  userId: item.userId,
                                  name: item.userName,
                                  phone: item.userPhone || "",
                                })
                              }
                              className="text-stone-400 hover:text-cat-ink transition p-0.5"
                              title="Update customer phone number in DB"
                            >
                              ✏️
                            </button>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Time Remaining */}
                    <td className="td whitespace-nowrap">
                      {item.remainingTime ? (
                        <span
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-extrabold ${
                            item.remainingTime.isOverdue
                              ? "bg-red-100 text-red-800 ring-1 ring-red-300"
                              : item.remainingTime.isDueSoon
                              ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                              : "bg-blue-50 text-blue-800"
                          }`}
                        >
                          <Icon
                            name={item.remainingTime.isOverdue ? "alert" : "activity"}
                            className="h-3 w-3"
                          />
                          {item.remainingTime.text}
                        </span>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>

                    {/* Dates */}
                    <td className="td whitespace-nowrap">
                      <div>
                        <p className="font-medium text-stone-800">
                          {item.checkOutDate ? fmtDate(item.checkOutDate) : "—"}{" "}
                          <span className="text-stone-400">→</span>{" "}
                          <span className={item.isOverdue ? "font-bold text-red-600" : "font-semibold text-stone-900"}>
                            {item.expectedReturnDate ? fmtDate(item.expectedReturnDate) : "—"}
                          </span>
                        </p>
                        {item.checkInDate && (
                          <p className="text-[10px] text-emerald-700 font-bold">
                            Returned: {fmtDate(item.checkInDate)}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Inspect Button */}
                    <td className="td text-center">
                      <button
                        onClick={() => setSelectedItem(item)}
                        className="btn btn-dark btn-sm text-xs font-bold px-3.5 py-1.5 shadow-xs"
                      >
                        Inspect Details
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-400">
                    <Icon name="cube" className="mx-auto h-8 w-8 text-stone-300 mb-2" />
                    <p className="font-semibold text-stone-600">No vehicles or rentals match this view</p>
                    <p className="text-xs mt-1">Try switching tabs or searching another keyword.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Page Modal with SMS Alert option */}
      {selectedItem && (
        <RentalDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onEditPhone={(userObj) => {
            setEditPhoneUser(userObj);
          }}
          onRefreshData={onRefresh}
        />
      )}

      {/* Quick Edit Phone Number in DB Modal */}
      {editPhoneUser && (
        <EditPhoneModal
          user={editPhoneUser}
          onClose={() => setEditPhoneUser(null)}
          onSaved={(savedUserId, savedPhone) => {
            const trimmed = savedPhone.trim();
            setLocalPhoneOverrides((prev) => ({
              ...prev,
              [savedUserId]: trimmed,
              [savedUserId.toLowerCase()]: trimmed,
              [editPhoneUser.userId]: trimmed,
              [editPhoneUser.name]: trimmed,
            }));
            if (selectedItem) {
              setSelectedItem((prev) => (prev ? { ...prev, userPhone: trimmed } : null));
            }
            setEditPhoneUser(null);
            onRefresh && onRefresh();
          }}
        />
      )}
    </div>
  );
}

function RentalDetailModal({ item, onClose, onEditPhone, onRefreshData }) {
  const isCheckedOut = item.qrStatus === "checked-out";
  const canSendSms = item.recordType === "booking" && (isCheckedOut || item.qrStatus === "unused");

  const expectedReturn = item.expectedReturnDate ? new Date(item.expectedReturnDate) : new Date();
  const remaining = computeRemainingTime(expectedReturn);

  const defaultMsg = remaining.isOverdue
    ? `Smart Rental Tracking: Your rental of ${item.equipmentId} (${item.equipmentType}) is OVERDUE by ${remaining.fullText}. Expected return was ${expectedReturn.toLocaleDateString()}. Please return the vehicle immediately. Thank you.`
    : `Smart Rental Tracking: Reminder — You have ${remaining.text} remaining on your rental of ${item.equipmentId} (${item.equipmentType}). Due date: ${expectedReturn.toLocaleDateString()}. Thank you.`;

  const [message, setMessage] = useState(defaultMsg);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSendSms() {
    if (!item.userPhone) {
      setError("This user does not have a phone number saved in the database. Please add a phone number first.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // Takes phone number directly from DB on the backend
      const res = await sendRentalReminderSms(item.bookingId, {
        customMessage: message.trim(),
      });

      if (res.data?.success) {
        setSuccess(res.data.message || `SMS reminder sent successfully to customer's DB phone (${item.userPhone})!`);
        onRefreshData && onRefreshData();
      } else {
        setError(res.data?.message || "Failed to send SMS.");
      }
    } catch (err) {
      const serverErr = err.response?.data?.message || err.response?.data?.error || err.message;
      setError(serverErr || "Failed to dispatch SMS alert.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-3.5 backdrop-blur-sm animate-fade-in">
      <div className="flex max-h-[92vh] w-full max-w-3xl animate-scale-in flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl">
        {/* Header */}
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
                Ref: {item.bookingId} · Site {item.siteId}
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

        {/* Content */}
        <div className="overflow-y-auto p-5 space-y-5">
          {/* Send SMS Alert Option in Inspect Section */}
          {canSendSms && (
            <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-200 text-amber-900">
                    <Icon name="spark" className="h-5 w-5" />
                  </span>
                  <div>
                    <h4 className="font-display text-xs font-extrabold text-stone-900 uppercase tracking-wider">
                      Send Remaining Time SMS Alert
                    </h4>
                    <p className="text-xs text-stone-600">
                      Dispatches instant SMS reminder to customer's phone number saved in database.
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                    Time Remaining
                  </span>
                  <p className={`font-display text-sm font-black ${remaining.isOverdue ? "text-red-700" : "text-stone-900"}`}>
                    {remaining.text}
                  </p>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
                  ⚠️ {error}
                </div>
              )}
              {success && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-bold text-emerald-800">
                  ✓ {success}
                </div>
              )}

              {/* Recipient Phone from DB */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-white/90 p-3 border border-amber-200/70 text-xs">
                <div>
                  <span className="font-semibold text-stone-500">Recipient Customer:</span>{" "}
                  <span className="font-bold text-stone-900">{item.userName}</span>
                  <span className="mx-2 text-stone-300">|</span>
                  <span className="font-semibold text-stone-500">Phone (in DB):</span>{" "}
                  <span className="font-mono font-bold text-stone-900">
                    {item.userPhone || <span className="text-red-600 font-sans italic">Not configured in DB</span>}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {item.userId && (
                    <button
                      onClick={() =>
                        onEditPhone({
                          userId: item.userId,
                          name: item.userName,
                          phone: item.userPhone || "",
                        })
                      }
                      className="text-xs font-semibold text-amber-900 hover:underline flex items-center gap-1"
                    >
                      ✏️ Edit DB Phone
                    </button>
                  )}
                </div>
              </div>

              {/* Message Body */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0 text-[11px]">SMS Message Text</label>
                  <button
                    type="button"
                    onClick={() => setMessage(defaultMsg)}
                    className="text-[10px] font-bold text-amber-800 hover:underline"
                  >
                    Reset Text
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="input text-xs leading-relaxed bg-white"
                  placeholder="Enter SMS alert message..."
                />
              </div>

              {/* Send Button */}
              <div className="flex items-center justify-end">
                <button
                  onClick={handleSendSms}
                  disabled={loading}
                  className="btn btn-primary btn-sm text-xs font-bold px-4 py-2 min-h-[38px] flex items-center gap-1.5 shadow-sm"
                >
                  {loading ? (
                    <>
                      <Spinner className="h-4 w-4" />
                      <span>Sending to {item.userPhone || "customer"}...</span>
                    </>
                  ) : (
                    <>
                      <Icon name="spark" className="h-4 w-4 text-cat-ink" />
                      <span>Send SMS Alert to Customer</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-2.5">
              Lifecycle History
            </p>
            <div className="grid gap-2 sm:grid-cols-4 text-xs">
              <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-3">
                <p className="font-bold text-stone-900">1. Booking Request</p>
                <p className="text-[11px] text-stone-500 mt-0.5">Payment: {item.paymentStatus}</p>
                <p className="text-[10px] text-stone-400 mt-1">{fmtDateTime(item.createdAt)}</p>
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-3">
                <p className="font-bold text-stone-900">2. Admin Approval</p>
                <p className="text-[11px] text-stone-500 mt-0.5">Status: {item.approvalStatus}</p>
                <p className="text-[10px] text-stone-400 mt-1">
                  {item.rawBooking?.approvedAt ? fmtDateTime(item.rawBooking.approvedAt) : "—"}
                </p>
              </div>

              <div className={`rounded-xl border p-3 ${item.checkOutDate ? "border-blue-200 bg-blue-50/40" : "border-stone-200 bg-stone-50/50"}`}>
                <p className="font-bold text-stone-900">3. Check-Out</p>
                <p className="text-[11px] text-stone-600 mt-0.5">Site {item.siteId}</p>
                <p className="text-[10px] text-stone-500 mt-1">{fmtDateTime(item.checkOutDate)}</p>
              </div>

              <div className={`rounded-xl border p-3 ${item.checkInDate ? "border-emerald-200 bg-emerald-50/40" : "border-stone-200 bg-stone-50/50"}`}>
                <p className="font-bold text-stone-900">4. Check-In</p>
                <p className="text-[11px] text-stone-600 mt-0.5">
                  {item.checkInDate ? "In Yard" : "On Site"}
                </p>
                <p className="text-[10px] text-stone-500 mt-1">{fmtDateTime(item.checkInDate)}</p>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid gap-3 sm:grid-cols-3 rounded-xl border border-stone-200 bg-stone-50/40 p-4 text-xs">
            <div>
              <p className="text-[10px] uppercase font-bold text-stone-400">Customer</p>
              <p className="font-bold text-stone-900 mt-0.5">{item.userName}</p>
              <p className="text-stone-600 mt-0.5 font-mono">
                Phone: {item.userPhone || <span className="font-sans italic text-stone-400">None in DB</span>}
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase font-bold text-stone-400">Assigned Operator</p>
              <p className="font-bold text-stone-900 mt-0.5">{item.operatorName}</p>
              <p className="text-stone-500">ID: {item.operatorId || "—"}</p>
            </div>

            <div>
              <p className="text-[10px] uppercase font-bold text-stone-400">Expected Return</p>
              <p className={`font-bold mt-0.5 ${item.isOverdue ? "text-red-600" : "text-stone-900"}`}>
                {fmtDateTime(item.expectedReturnDate)}
              </p>
              <p className="text-stone-500">Duration: {item.rentalDays} days</p>
            </div>
          </div>

          {/* Telemetry Metrics */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-2">
              Machine Telemetry Snapshot
            </p>
            <div className="grid gap-2.5 sm:grid-cols-4 text-xs">
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
                <p className="text-[10px] text-stone-400 font-semibold uppercase">Connection</p>
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
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-stone-100 bg-stone-50 px-5 py-3">
          <button onClick={onClose} className="btn btn-ghost btn-sm text-xs font-bold px-4 py-2">
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}

function EditPhoneModal({ user, onClose, onSaved }) {
  const [phone, setPhone] = useState(user.phone || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!phone.trim()) {
      setError("Please enter a phone number.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await updateUserPhone(user.userId, phone.trim());
      onSaved && onSaved(user.userId, phone.trim());
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update phone number in DB.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-3.5 backdrop-blur-sm animate-fade-in">
      <div className="flex max-h-[90vh] w-full max-w-sm animate-scale-in flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-4 py-3.5">
          <h3 className="font-display text-sm font-bold text-stone-900">
            Edit User Phone in Database
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 text-stone-400 hover:text-stone-700">
            ✕
          </button>
        </div>

        <div className="p-4 space-y-3 text-xs">
          {error && <Alert tone="danger">{error}</Alert>}
          <div>
            <label className="label">User</label>
            <p className="font-bold text-stone-800">{user.name} ({user.userId})</p>
          </div>
          <div>
            <label className="label">Phone Number (E.164 / Indian format)</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+919876543210 or +18547770158"
              className="input text-xs font-semibold"
            />
            <p className="text-[10px] text-stone-400 mt-1">
              Updates this user's phone directly in MongoDB for automatic SMS reminders.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-stone-100 bg-stone-50 px-4 py-3">
          <button onClick={onClose} className="btn btn-ghost btn-sm text-xs font-bold px-3 py-1.5">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="btn btn-primary btn-sm text-xs font-bold px-4 py-1.5"
          >
            {loading ? "Saving..." : "Save to DB"}
          </button>
        </div>
      </div>
    </div>
  );
}
