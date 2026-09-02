// Minimal inline icon set (stroke style). Usage: <Icon name="grid" className="h-5 w-5" />
const PATHS = {
  grid: "M4 5.5A1.5 1.5 0 0 1 5.5 4h4A1.5 1.5 0 0 1 11 5.5v4A1.5 1.5 0 0 1 9.5 11h-4A1.5 1.5 0 0 1 4 9.5v-4Zm9 0A1.5 1.5 0 0 1 14.5 4h4A1.5 1.5 0 0 1 20 5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 13 9.5v-4Zm-9 9A1.5 1.5 0 0 1 5.5 13h4A1.5 1.5 0 0 1 11 14.5v4A1.5 1.5 0 0 1 9.5 20h-4A1.5 1.5 0 0 1 4 18.5v-4Zm9 0a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5v-4Z",
  scan: "M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2m8-16h2a2 2 0 0 1 2 2v2m0 8v2a2 2 0 0 1-2 2h-2M4 12h16",
  cube: "M12 3 3.5 7.5v9L12 21l8.5-4.5v-9L12 3Zm0 0v18m8.5-13.5L12 12 3.5 7.5",
  alert: "M12 9v4m0 4h.01M10.3 4.3 2.6 17.6A2 2 0 0 0 4.3 20.6h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z",
  wrench: "M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.1-.5-.5-2.1 2.6-2.4Z",
  chart: "M4 20V10m5 10V4m5 16v-7m5 7V8",
  users: "M16 19a4 4 0 0 0-8 0M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8 8a3.5 3.5 0 0 0-5-3.2M4 19a3.5 3.5 0 0 1 5-3.2",
  logout: "M15 12H4m0 0 3.5-3.5M4 12l3.5 3.5M10 7V6a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-1",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
  check: "M5 12.5 10 17l9-10",
  chat: "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 4V6Z",
  spark: "M12 3v4m0 10v4M5 12H1m22 0h-4M6.3 6.3 3.5 3.5m17 17-2.8-2.8m0-11.4 2.8-2.8m-17 17 2.8-2.8",
  camera: "M4 8a2 2 0 0 1 2-2h1.5l1-1.5h3l1 1.5H17a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Zm8 3.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  radio: "M4.9 19.1A10 10 0 0 1 2 12a10 10 0 0 1 2.9-7.1M19.1 4.9A10 10 0 0 1 22 12a10 10 0 0 1-2.9 7.1M7.8 16.2A6 6 0 0 1 6 12a6 6 0 0 1 1.8-4.2M16.2 7.8A6 6 0 0 1 18 12a6 6 0 0 1-1.8 4.2M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z",
  activity: "M22 12h-4l-3 9L9 3l-3 9H2",
  gauge: "M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8Zm1-13h-2v5l4 2 1-1.7-3-1.3Z",
  fuel: "M3 22V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17M15 10h2a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2 2 2 0 0 0 2-2V9.8a2 2 0 0 0-.6-1.4L20.8 7M3 11h12M6 7h6",
  "chevron-down": "M6 9l6 6 6-6",
  "chevron-up": "M18 15l-6-6-6 6",
  clock: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4v6l4 2",
};

export default function Icon({ name, className = "h-5 w-5", strokeWidth = 1.6 }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
