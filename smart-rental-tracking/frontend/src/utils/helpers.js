// Client-side computed helpers used by the Admin dashboard.

export function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

// Overdue / due-soon are computed client-side from the expected return date.
export function displayStatus(eq) {
  if (eq.status !== "active") return eq.status; // available
  if (eq.checkInDate) {
    const due = new Date(eq.checkInDate);
    const now = new Date();
    if (due < now) return "overdue";
    const daysLeft = (due - now) / 86400000;
    if (daysLeft <= 2) return "due-soon";
  }
  return "active";
}

// Returns a list of anomaly objects for one equipment record.
// opts: { telemetry: <matching telemetry record>, maintenance: [<all maintenance records>] }
export function getAnomalies(eq, opts = {}) {
  const { telemetry = null, maintenance = [] } = opts;
  const flags = [];

  // 1. Unassigned — no site or no operator on record
  if (eq.siteId === null || eq.lastOperatorId === null) {
    flags.push({
      type: "UNASSIGNED",
      reason: "No site assigned or no operator on record.",
      severity: "medium",
    });
  }

  // 2. Utilisation family — emit at most ONE flag, most specific first, so a
  //    machine that is idle-heavy doesn't get three overlapping cards.
  const totalHours = eq.engineHoursPerDay + eq.idleHoursPerDay;
  const idleRatio = totalHours > 0 ? eq.idleHoursPerDay / totalHours : 0;
  if (eq.engineHoursPerDay === 0 && eq.operatingDays > 0) {
    flags.push({
      type: "NEVER OPERATED",
      reason: `On rent for ${eq.operatingDays} operating days but 0 engine hours/day — the machine was never started.`,
      severity: "high",
    });
  } else if (idleRatio > 0.6) {
    flags.push({
      type: "UNDERUTILIZED",
      reason: `Idle ratio ${(idleRatio * 100).toFixed(0)}% (idle ${eq.idleHoursPerDay}h vs engine ${eq.engineHoursPerDay}h per day).`,
      severity: idleRatio > 0.85 ? "high" : "medium",
    });
  } else if (eq.idleHoursPerDay >= 10) {
    flags.push({
      type: "EXCESSIVE IDLE",
      reason: `${eq.idleHoursPerDay}h idle per day — sustained long idle hours indicate misallocation.`,
      severity: "medium",
    });
  }

  // 3. Rental integrity — operating days exceed the rental window
  if (eq.checkOutDate && eq.checkInDate) {
    const windowDays = Math.round(
      (new Date(eq.checkInDate) - new Date(eq.checkOutDate)) / 86400000
    );
    if (eq.operatingDays > windowDays) {
      flags.push({
        type: "RENTAL INTEGRITY ISSUE",
        reason: `Operating days (${eq.operatingDays}) exceed the rental window (${windowDays} days).`,
        severity: "high",
      });
    }
  }

  // 4. Open maintenance — a rented/tracked machine with unresolved repairs
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

  // 5a. Low fuel — machine will stall without a refuel
  if (telemetry && telemetry.fuelLevel != null && telemetry.fuelLevel < 15) {
    flags.push({
      type: "LOW FUEL",
      reason: `Fuel level ${Math.round(telemetry.fuelLevel)}% — refuel required.`,
      severity: "high",
    });
  }

  // 5. Telemetry offline — heartbeat lost (possible breakdown / disconnect / theft)
  if (telemetry && telemetry.connectionStatus === "offline") {
    const secs = telemetry.offlineDurationSeconds;
    const threshold = telemetry.timeoutThresholdSeconds ?? 10;
    flags.push({
      type: "TELEMETRY OFFLINE",
      reason:
        secs != null
          ? `No heartbeat for ${secs}s (threshold ${threshold}s) — machine disconnected.`
          : "No telemetry heartbeat received — machine disconnected.",
      severity: "high",
    });
  }

  // 6. Rental overrun — past the expected return date, not checked back in
  if (displayStatus(eq) === "overdue") {
    flags.push({
      type: "RENTAL OVERRUN",
      reason: `Past expected return date (${fmtDate(eq.checkInDate)}) and not checked back in.`,
      severity: "high",
    });
  }

  return flags;
}
