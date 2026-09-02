import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({ baseURL: API_URL });

// ---- Auth ----
export const loginUser = (data) => api.post("/auth/login", data);

// ---- Equipment ----
export const getEquipment = (params) => api.get("/equipment", { params });
export const getEquipmentById = (id) => api.get(`/equipment/${id}`);

// ---- Operators ----
export const getOperators = (type) =>
  api.get("/operators", { params: type ? { type } : {} });
export const createOperator = (data) => api.post("/operators", data);

// ---- Bookings ----
export const createBooking = (data) => api.post("/bookings", data);
export const getUserBookings = (userId) => api.get(`/bookings/${userId}`);
export const getUserOrderHistory = (userId) => api.get(`/bookings/${userId}/history`);
export const getPendingBookings = () => api.get("/bookings/pending/all");
export const getAllBookings = () => api.get("/bookings/all");
export const approveBooking = (bookingId, data) =>
  api.post(`/bookings/${bookingId}/approve`, data);
export const rejectBooking = (bookingId, data) =>
  api.post(`/bookings/${bookingId}/reject`, data);
export const getDynamicQr = (bookingId) =>
  api.get(`/bookings/${bookingId}/dynamic-qr`);
export const sendRentalReminderSms = (bookingId, data) =>
  api.post(`/bookings/${bookingId}/send-reminder-sms`, data);

// ---- Razorpay ----
export const createRazorpayOrder = (data) => api.post("/create-order", data);
export const verifyRazorpayPayment = (data) => api.post("/verify-payment", data);

// ---- Scan ----
export const validateScan = (bookingId) =>
  api.post("/scan/validate", { bookingId });
export const confirmPickup = (data) => api.post("/scan/confirm-pickup", data);
export const assignOperator = (data) => api.post("/scan/assign-operator", data);
export const confirmReturn = (bookingId) =>
  api.post("/scan/confirm-return", { bookingId });

// ---- Maintenance ----
export const getMaintenance = (status) =>
  api.get("/maintenance", { params: status ? { status } : {} });
export const createMaintenance = (data) => api.post("/maintenance", data);
export const updateMaintenance = (id, data) =>
  api.patch(`/maintenance/${id}`, data);

// ---- Users ----
export const getUsers = () => api.get("/users");
export const getUser = (userId) => api.get(`/users/${userId}`);
export const updateUser = (userId, data) => api.patch(`/users/${userId}`, data);
export const updateUserPhone = (userId, phone) =>
  api.patch(`/users/${userId}`, { phone });

// ---- Telemetry ----
export const getTelemetry = (equipmentId) => api.get(`/telemetry/${equipmentId}`);
export const getAllTelemetry = () => api.get("/telemetry");
export const sendTelemetry = (equipmentId, data) =>
  api.post(`/telemetry/${equipmentId}`, data);

// ---- Combined snapshot (equipment + maintenance + bookings + operators + telemetry) ----
export const getContext = () => api.get("/chatbot-context");

// ---- Demand Forecasting ----
export const getForecast = (site_id, equipment_type) =>
  api.get("/forecast", { params: { site_id, equipment_type } });
export const getForecastSummary = () => api.get("/forecast/summary");
export const getForecastMeta = () => api.get("/forecast/meta");

// ---- Fleet Rebalancing / Auto-Dispatch ----
export const getRebalance = () => api.get("/rebalance");

export default api;
