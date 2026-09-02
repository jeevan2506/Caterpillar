// Client-side computed helpers used by the Admin dashboard.

export function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

// Overdue / due-soon are computed client-side from the expected return date.
export function displayStatus(eq) {
  if (eq.status === "available") return "available";
  if (eq.status === "booked") return "booked";
  
  if (eq.status === "active" || eq.status === "overdue") {
    if (eq.checkInDate) {
      const due = new Date(eq.checkInDate);
      const now = new Date();
      if (due < now) return "overdue";
      const daysLeft = (due - now) / 86400000;
      if (daysLeft <= 2) return "due-soon";
    }
    return "active";
  }
  return eq.status || "available";
}

// Returns a list of real-time anomaly objects for one equipment record.
// opts: { telemetry: <matching telemetry record>, maintenance: [<all maintenance records>], bookings: [...] }
export function getAnomalies(eq, opts = {}) {
  const { telemetry = null, maintenance = [], bookings = [] } = opts;
  const flags = [];

  // 1. Open maintenance — any machine with unresolved repairs currently in DB
  const openMaint = maintenance.filter(
    (m) => m.equipmentId === eq.equipmentId && m.status !== "resolved"
  );
  if (openMaint.length) {
    flags.push({
      type: "OPEN MAINTENANCE",
      reason: `${openMaint.length} unresolved maintenance record(s): ${openMaint
        .map((m) => m.issueReported)
        .join("; ")}.`,
      severity: "medium",
    });
  }

  // Find if there is an active rental booking for this equipment
  const activeBooking = bookings.find(
    (b) => b.equipmentId === eq.equipmentId && b.qrStatus === "checked-out"
  );

  const isRented = eq.status === "active" || eq.status === "overdue" || Boolean(activeBooking);

  // Anomaly checks for deployed/rented fleet based on real-time telematics & booking
  if (isRented) {
    // 2. Unassigned — machine is active on site with no operator on record
    const hasOperator = eq.lastOperatorId || activeBooking?.assignedOperatorId;
    if (!hasOperator) {
      flags.push({
        type: "UNASSIGNED",
        reason: "Vehicle is active on site with no operator assigned.",
        severity: "medium",
      });
    }

    // 3. Real-time utilisation checks from live telemetry stream
    const engineHrs = telemetry?.engineHours ?? eq.engineHoursPerDay ?? 0;
    const idleHrs = telemetry?.idleHours ?? eq.idleHoursPerDay ?? 0;
    const totalHours = engineHrs + idleHrs;
    const idleRatio = totalHours > 0 ? idleHrs / totalHours : 0;

    if (totalHours >= 2 && engineHrs === 0) {
      flags.push({
        type: "NEVER OPERATED",
        reason: `On rent with ${idleHrs.toFixed(1)}h logged but 0 engine hours — the machine was never started.`,
        severity: "high",
      });
    } else if (totalHours >= 3 && idleRatio > 0.6) {
      flags.push({
        type: "UNDERUTILIZED",
        reason: `Idle ratio ${(idleRatio * 100).toFixed(0)}% (idle ${idleHrs.toFixed(1)}h vs engine ${engineHrs.toFixed(1)}h).`,
        severity: idleRatio > 0.85 ? "high" : "medium",
      });
    } else if (idleHrs >= 10) {
      flags.push({
        type: "EXCESSIVE IDLE",
        reason: `${idleHrs.toFixed(1)}h idle time logged — high idle hours indicate misallocation.`,
        severity: "medium",
      });
    }

    // 4. Low fuel — machine telematics indicate fuel below 15%
    if (telemetry && telemetry.fuelLevel != null && telemetry.fuelLevel < 15) {
      flags.push({
        type: "LOW FUEL",
        reason: `Fuel level at ${Math.round(telemetry.fuelLevel)}% — refuel required immediately.`,
        severity: "high",
      });
    }

    // 5. Telemetry offline — heartbeat lost during active deployment
    if (telemetry && telemetry.connectionStatus === "offline") {
      const secs = telemetry.offlineDurationSeconds;
      const threshold = telemetry.timeoutThresholdSeconds ?? 10;
      flags.push({
        type: "TELEMETRY OFFLINE",
        reason:
          secs != null
            ? `No heartbeat for ${secs}s (threshold ${threshold}s) — machine telematics disconnected.`
            : "No telemetry heartbeat received — machine disconnected.",
        severity: "high",
      });
    }

    // 6. Rental overrun — past the expected return date
    const expectedReturn = activeBooking?.expectedReturnDate || eq.checkInDate;
    if (expectedReturn && new Date(expectedReturn) < new Date()) {
      let smsNotice = "";
      if (activeBooking?.overdueSmsSent) {
        smsNotice = " · SMS alert dispatched";
      }
      flags.push({
        type: "RENTAL OVERRUN",
        reason: `Past expected return date (${fmtDate(expectedReturn)}) and not checked back in${smsNotice}.`,
        severity: "high",
        smsStatus: activeBooking?.lastSmsStatus,
      });
    }
  }

  return flags;
}

