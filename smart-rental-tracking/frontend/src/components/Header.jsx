import { useNavigate } from "react-router-dom";
import { clearSession } from "../services/auth.js";
import Icon from "./Icon.jsx";

export default function Header({ title, subtitle, name, role, onMenu }) {
  const navigate = useNavigate();

  function logout() {
    clearSession();
    navigate("/");
  }

  const initials = (name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3.5 sm:px-6">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {onMenu && (
            <button
              onClick={onMenu}
              className="grid h-10 w-10 place-items-center rounded-xl border border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100 md:hidden active:scale-95 transition"
              aria-label="Toggle navigation menu"
            >
              <Icon name="menu" className="h-5 w-5" />
            </button>
          )}
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-cat-ink font-display text-xs sm:text-sm font-extrabold text-cat-yellow">
            CAT
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate font-display text-sm font-bold tracking-tight text-stone-900 sm:text-[15px]">
              {title}
            </p>
            {subtitle && (
              <p className="truncate text-[11px] text-stone-500 hidden xs:block sm:block">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-stone-900 text-xs font-bold text-white shadow-sm">
              {initials}
            </div>
            <div className="hidden sm:block leading-tight text-left">
              <p className="text-xs sm:text-sm font-semibold text-stone-900 truncate max-w-[120px]">{name}</p>
              {role && (
                <p className="text-[10px] uppercase font-bold tracking-wide text-amber-600">
                  {role}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={logout}
            className="btn btn-ghost btn-sm px-2.5 sm:px-3 text-xs flex items-center gap-1.5"
            title="Log out"
            aria-label="Log out"
          >
            <Icon name="logout" className="h-4 w-4 text-stone-500" />
            <span className="hidden md:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
