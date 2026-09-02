import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { saveSession } from "../services/auth.js";
import { loginUser } from "../services/api.js";
import { Spinner } from "../components/ui.jsx";
import Icon from "../components/Icon.jsx";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await loginUser({ username: username.trim(), password });
      const { userId, name, role } = res.data;
      saveSession({ role, userId, name, username: username.trim() });
      if (role === "admin") navigate("/admin");
      else if (role === "operator") navigate("/operator");
      else navigate("/user");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-cat-dark text-white">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-cat-yellow/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-cat-yellow/5 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-3.5 py-8 sm:px-6 sm:py-12">
        {/* Header */}
        <div className="mb-6 sm:mb-9 text-center animate-fade-up">
          <div className="mx-auto mb-4 sm:mb-5 grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded-2xl bg-cat-yellow font-display text-base sm:text-lg font-extrabold text-cat-ink shadow-glow">
            CAT
          </div>
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
            Smart Rental Tracking
          </h1>
          <p className="mx-auto mt-2 sm:mt-3 max-w-md text-xs sm:text-sm text-stone-400 px-2">
            Equipment rental management for construction &amp; mining fleets —
            witnessed pickups, returns and utilisation insights.
          </p>
        </div>

        {/* Login Card */}
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md animate-fade-up rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur-sm shadow-2xl"
        >
          <h2 className="mb-4 sm:mb-5 font-display text-sm sm:text-base font-bold tracking-tight text-white">
            Sign in to your account
          </h2>

          {/* Username */}
          <div className="mb-4">
            <label className="mb-1.5 block text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Username
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500">
                <Icon name="users" className="h-4 w-4" />
              </span>
              <input
                id="login-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. joy, tom, jerry"
                autoComplete="username"
                autoFocus
                className="w-full rounded-xl border border-white/15 bg-white/5 pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-stone-500 outline-none transition focus:border-cat-yellow focus:ring-4 focus:ring-cat-yellow/10 min-h-[42px]"
              />
            </div>
          </div>

          {/* Password */}
          <div className="mb-5">
            <label className="mb-1.5 block text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Password
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500">
                <Icon name="scan" className="h-4 w-4" />
              </span>
              <input
                id="login-password"
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin(e)}
                placeholder="Enter your password"
                autoComplete="current-password"
                className="w-full rounded-xl border border-white/15 bg-white/5 pl-10 pr-14 py-2.5 text-xs sm:text-sm text-white placeholder:text-stone-500 outline-none transition focus:border-cat-yellow focus:ring-4 focus:ring-cat-yellow/10 min-h-[42px]"
              />
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-stone-400 hover:text-cat-yellow transition p-1"
              >
                {showPass ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 flex items-center gap-2.5 rounded-xl bg-red-500/10 px-3.5 py-2.5 text-xs sm:text-sm text-red-400 ring-1 ring-inset ring-red-500/20">
              <Icon name="alert" className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            id="login-submit"
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full py-3 text-xs sm:text-sm font-bold min-h-[44px]"
          >
            {loading ? (
              <>
                <Spinner className="h-4 w-4" /> Signing in…
              </>
            ) : (
              "Sign In"
            )}
          </button>

          {/* Role hint */}
          <div className="mt-4 sm:mt-5 rounded-xl border border-white/5 bg-white/[0.03] p-3 sm:p-3.5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
              Demo credentials
            </p>
            <div className="space-y-1.5 text-xs text-stone-400">
              <div className="flex items-center justify-between">
                <span><span className="font-medium text-stone-300">joy</span> / tom123$</span>
                <span className="rounded-md bg-stone-800 px-1.5 py-0.5 text-[10px] text-stone-400">User</span>
              </div>
              <div className="flex items-center justify-between">
                <span><span className="font-medium text-stone-300">tom</span> / tom123$</span>
                <span className="rounded-md bg-stone-800 px-1.5 py-0.5 text-[10px] text-stone-400">User</span>
              </div>
              <div className="flex items-center justify-between">
                <span><span className="font-medium text-stone-300">jerry</span> / jerry123$</span>
                <span className="rounded-md bg-cat-yellow/20 px-1.5 py-0.5 text-[10px] text-cat-yellow font-semibold">Admin</span>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
