# Caterpillar Equipment Telemetry Simulator

This standalone Node.js script acts as an IoT/Telematics device on simulated Caterpillar heavy equipment (e.g. Excavator, Bulldozer, Crane).

It sends real-time heartbeat and telematics telemetry to the Smart Rental Tracking System backend.

---

## 1. Quick Start

Run on any computer with Node.js installed:

```bash
cd machine-simulator
node simulator.js
```

By default, it sends telemetry for `EQX1001` to `http://localhost:5000` every 3 seconds.

> **Note:** the backend does **not** generate any telemetry on its own — a
> machine is only ONLINE while this simulator is sending heartbeats for it.
> Stop the simulator (`Ctrl+C`) and the backend flips that machine to
> **OFFLINE** after the 10s timeout. Run one simulator process per machine
> you want live (use `--id`).

---

## 2. Configuration for Friend's Laptop

When running the simulator on a friend's laptop or secondary machine, configure `SERVER_URL` to point to the host machine's local IP:

### Via Environment Variables:

```bash
# Windows PowerShell:
$env:SERVER_URL="http://192.168.1.15:5000"
$env:EQUIPMENT_ID="EQ1001"
node simulator.js

# Linux / macOS / Git Bash:
SERVER_URL=http://192.168.1.15:5000 EQUIPMENT_ID=EQ1001 node simulator.js
```

### Via Command-Line Arguments:

```bash
node simulator.js --url=http://192.168.1.15:5000 --id=EQ1001 --site=S003
```

---

## 3. Options

| Option | Env Variable | Default | Description |
| --- | --- | --- | --- |
| `--url` | `SERVER_URL` | `http://localhost:5000` | Backend API base URL |
| `--id` | `EQUIPMENT_ID` | `EQX1001` | Equipment ID to simulate |
| `--site` | `SITE_ID` | `S003` | Site ID |
| `--interval`| `INTERVAL_MS` | `3000` | Heartbeat period in milliseconds |
| `--status` | `MACHINE_STATUS` | `running` | `running`, `idle`, or `stopped` |

---

## 4. Testing Offline Detection

1. Start the simulator $\to$ Equipment `EQ1001` shows **ONLINE** & **RUNNING** on the Admin Dashboard.
2. Stop the simulator (`Ctrl + C`) $\to$ No new heartbeats are sent.
3. Within 10 seconds $\to$ Admin Dashboard dynamically switches `EQ1001` to **OFFLINE** and displays a **TELEMETRY CONNECTION LOST** alert.
4. Restart the simulator $\to$ Equipment turns **ONLINE** again on the next heartbeat.
