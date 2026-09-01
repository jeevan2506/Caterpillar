/**
 * Caterpillar Equipment Telematics Simulator
 * 
 * Simulates an IoT telematic unit on heavy construction/mining machinery
 * sending real-time heartbeats and operating metrics to the backend.
 * 
 * Usage:
 *   node simulator.js
 * 
 * Configuration options via environment variables or CLI args:
 *   SERVER_URL=http://localhost:5000 (or IP address of your server)
 *   EQUIPMENT_ID=EQ1001
 *   SITE_ID=S003
 *   INTERVAL_MS=5000
 *   MACHINE_STATUS=running (running | idle | stopped)
 * 
 * Examples:
 *   SERVER_URL=http://192.168.1.15:5000 EQUIPMENT_ID=EQ1001 node simulator.js
 *   node simulator.js --url=http://192.168.1.15:5000 --id=EQ1001
 */

const http = require("http");
const https = require("https");
const url = require("url");

// Parse CLI arguments: e.g. --url=http://... --id=EQ1001 --status=running
const args = {};
process.argv.slice(2).forEach((arg) => {
  if (arg.startsWith("--")) {
    const [key, val] = arg.slice(2).split("=");
    args[key] = val || true;
  }
});

const SERVER_URL = (
  process.env.SERVER_URL ||
  args.url ||
  "http://localhost:5000"
).replace(/\/$/, "");

const EQUIPMENT_ID = process.env.EQUIPMENT_ID || args.id || "EQ1001";
const SITE_ID = process.env.SITE_ID || args.site || "S003";
const INTERVAL_MS = parseInt(
  process.env.INTERVAL_MS || args.interval || "5000",
  10
);
let MACHINE_STATUS = process.env.MACHINE_STATUS || args.status || "running";

// Fuel tank capacity in litres (CAT 320-class excavator ~ 400 L)
const FUEL_CAPACITY = parseInt(process.env.FUEL_CAPACITY || args.fuel || "400", 10);

// Rough site coordinates so we can emit a plausible GPS location
const SITE_COORDS = {
  S001: [12.9716, 77.5946],
  S002: [13.0827, 80.2707],
  S003: [17.385, 78.4867],
  S004: [19.076, 72.8777],
  S005: [28.7041, 77.1025],
  S006: [22.5726, 88.3639],
};

// Initial machine metric values
let engineHours = 7.5;
let idleHours = 1.2;
let fuelLevel = 92; // percent of tank
let fuelConsumed = 0; // litres burned this session (cumulative)
let heartbeatCount = 0;

console.log("==================================================");
console.log("🚜 CATERPILLAR EQUIPMENT TELEMETRY SIMULATOR");
console.log("==================================================");
console.log(` Target Server:   ${SERVER_URL}`);
console.log(` Equipment ID:    ${EQUIPMENT_ID}`);
console.log(` Site ID:         ${SITE_ID}`);
console.log(` Initial Status:  ${MACHINE_STATUS.toUpperCase()}`);
console.log(` Heartbeat Every: ${INTERVAL_MS / 1000}s`);
console.log("==================================================");
console.log("Press Ctrl+C to STOP heartbeat (machine goes OFFLINE)");
console.log("==================================================\n");

function sendTelemetry() {
  heartbeatCount++;

  // Realistic simulation changes:
  let burnPct = 0; // % of tank burned this cycle
  if (MACHINE_STATUS === "running") {
    engineHours = parseFloat((engineHours + 0.01).toFixed(2));
    burnPct = 1.5 + Math.random() * 0.4; // heavier burn under load
  } else if (MACHINE_STATUS === "idle") {
    idleHours = parseFloat((idleHours + 0.01).toFixed(2));
    burnPct = 0.3 + Math.random() * 0.1; // idling still sips fuel
  }

  if (burnPct > 0) {
    fuelConsumed = parseFloat((fuelConsumed + (burnPct / 100) * FUEL_CAPACITY).toFixed(1));
    fuelLevel = parseFloat((fuelLevel - burnPct).toFixed(1));
    if (fuelLevel < 15) {
      fuelLevel = 100; // refuelled on site
      console.log(`[${new Date().toLocaleTimeString()}] ⛽ ${EQUIPMENT_ID} refuelled -> tank full`);
    }
  }

  const base = SITE_COORDS[SITE_ID] || [12.9716, 77.5946];
  const latitude = parseFloat((base[0] + (Math.random() - 0.5) * 0.001).toFixed(6));
  const longitude = parseFloat((base[1] + (Math.random() - 0.5) * 0.001).toFixed(6));

  const payload = {
    equipmentId: EQUIPMENT_ID,
    machineStatus: MACHINE_STATUS,
    engineHours,
    idleHours,
    fuelLevel,
    fuelConsumed,
    latitude,
    longitude,
    siteId: SITE_ID,
  };

  const payloadString = JSON.stringify(payload);
  const targetEndpoint = `${SERVER_URL}/api/telemetry/${EQUIPMENT_ID}`;
  const parsedUrl = url.parse(targetEndpoint);
  const client = parsedUrl.protocol === "https:" ? https : http;

  const reqOptions = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
    path: parsedUrl.path,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payloadString),
    },
    timeout: 4000,
  };

  const timestamp = new Date().toLocaleTimeString();

  const req = client.request(reqOptions, (res) => {
    let responseData = "";
    res.on("data", (chunk) => (responseData += chunk));
    res.on("end", () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(
          `[${timestamp}] 🟢 Heartbeat #${heartbeatCount} sent OK -> ${EQUIPMENT_ID} (${MACHINE_STATUS.toUpperCase()}) | Engine: ${engineHours}h | Idle: ${idleHours}h | Fuel: ${fuelLevel}% (${fuelConsumed}L used) | Site: ${SITE_ID}`
        );
      } else {
        console.warn(
          `[${timestamp}] ⚠️ Server responded with HTTP ${res.statusCode}: ${responseData}`
        );
      }
    });
  });

  req.on("error", (err) => {
    console.error(
      `[${timestamp}] 🔴 Connection error sending heartbeat to ${SERVER_URL}: ${err.message}`
    );
  });

  req.on("timeout", () => {
    req.destroy();
    console.error(`[${timestamp}] ⏱️ Request timed out`);
  });

  req.write(payloadString);
  req.end();
}

// Send initial heartbeat immediately, then periodically
sendTelemetry();
const timer = setInterval(sendTelemetry, INTERVAL_MS);

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\n🛑 Simulator STOPPED.");
  console.log("Heartbeat stream paused. Backend will detect equipment as OFFLINE after timeout.");
  clearInterval(timer);
  process.exit(0);
});
