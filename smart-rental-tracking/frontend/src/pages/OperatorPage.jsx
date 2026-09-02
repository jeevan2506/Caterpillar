import Header from "../components/Header.jsx";
import Icon from "../components/Icon.jsx";
import { getSession } from "../services/auth.js";

const STEPS = [
  {
    icon: "users",
    title: "Assignments are managed by Admin",
    text: "When a customer requests a Caterpillar operator, dispatch assigns a certified operator to the booking.",
  },
  {
    icon: "scan",
    title: "Availability updates on pickup",
    text: "Once Admin confirms the pickup via QR scan, your status switches to “assigned”.",
  },
  {
    icon: "check",
    title: "Freed up on return",
    text: "When the equipment is returned and scanned back in, your status returns to “available”.",
  },
];

export default function OperatorPage() {
  const session = getSession();

  return (
    <div className="min-h-screen">
      <Header
        title="Smart Rental Tracking"
        subtitle="Operator"
        name={session?.name}
        role={session?.role}
      />

      <main className="mx-auto max-w-3xl px-3.5 py-6 sm:px-6 sm:py-10">
        <div className="mb-6 sm:mb-8 rounded-2xl bg-cat-ink p-5 sm:px-8 sm:py-7 text-white">
          <p className="text-xs font-semibold uppercase tracking-wider text-cat-yellow">
            Operator
          </p>
          <h2 className="mt-1 font-display text-xl sm:text-2xl font-extrabold tracking-tight">
            Welcome, {session?.name}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-stone-400">
            Here's how operator dispatch works in the rental workflow.
          </p>
        </div>

        <div className="space-y-3">
          {STEPS.map((s, i) => (
            <div key={i} className="card flex items-start gap-3.5 sm:gap-4 p-4 sm:p-5">
              <span className="grid h-9 w-9 sm:h-10 sm:w-10 shrink-0 place-items-center rounded-xl bg-cat-yellow/15 text-cat-ink">
                <Icon name={s.icon} className="h-4 w-4 sm:h-5 sm:w-5" />
              </span>
              <div>
                <p className="text-sm sm:text-base font-semibold text-stone-900">{s.title}</p>
                <p className="mt-0.5 text-xs sm:text-sm text-stone-500 leading-relaxed">{s.text}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 sm:mt-8 text-center text-xs text-stone-400">
          The primary workflows in this demo are the User and Admin dashboards.
        </p>
      </main>
    </div>
  );
}
