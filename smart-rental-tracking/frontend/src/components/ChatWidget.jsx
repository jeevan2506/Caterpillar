import { useState, useRef, useEffect } from "react";
import axios from "axios";
import Icon from "./Icon.jsx";
import { Spinner } from "./ui.jsx";
import api from "../services/api.js";

// If a webhook URL is configured (e.g. n8n) we call that; otherwise we use the
// backend's built-in /api/chat route (Groq).
const WEBHOOK_URL = import.meta.env.VITE_CHATBOT_WEBHOOK_URL;

const SUGGESTIONS = [
  "Which equipment is underutilized?",
  "What maintenance is pending?",
  "Which operators are available?",
];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      from: "bot",
      text: "Hi — I'm the rental assistant. Ask about equipment, bookings, anomalies or operators.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function send(q) {
    const question = (q ?? input).trim();
    if (!question || loading) return;
    setMessages((m) => [...m, { from: "user", text: question }]);
    setInput("");

    setLoading(true);
    try {
      let reply;
      if (WEBHOOK_URL) {
        try {
          const res = await axios.post(WEBHOOK_URL, { question });
          reply =
            res.data?.answer ||
            res.data?.reply ||
            res.data?.output ||
            (typeof res.data === "string" ? res.data : JSON.stringify(res.data));
        } catch {
          // n8n unreachable → fall back to the backend's built-in /api/chat
          const res = await api.post("/chat", { question });
          reply = res.data.answer;
        }
      } else {
        const res = await api.post("/chat", { question });
        reply = res.data.answer;
      }
      setMessages((m) => [...m, { from: "bot", text: reply }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          from: "bot",
          text:
            err.response?.data?.answer || "Sorry, the assistant could not be reached.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-cat-ink text-cat-yellow shadow-lift transition hover:scale-105"
        aria-label="Open chat"
      >
        <Icon name={open ? "close" : "chat"} className="h-6 w-6" />
      </button>

      {open && (
        <div className="fixed bottom-20 right-3 sm:right-5 z-40 flex h-[28rem] sm:h-[30rem] w-[calc(100vw-1.5rem)] sm:w-[22rem] max-w-[24rem] max-h-[calc(100vh-6rem)] animate-scale-in flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lift">
          <div className="flex items-center justify-between border-b border-stone-100 bg-cat-ink px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-cat-yellow text-cat-ink font-bold">
                <Icon name="spark" className="h-4 w-4" />
              </span>
              <div className="leading-tight">
                <p className="text-xs sm:text-sm font-bold">Rental Assistant</p>
                <p className="text-[10px] text-stone-400">
                  {WEBHOOK_URL ? "Connected via n8n" : "Powered by Groq"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="grid h-7 w-7 place-items-center rounded-lg text-stone-400 hover:bg-white/10 hover:text-white"
              aria-label="Close chat"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto bg-stone-50 p-3 sm:p-3.5">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[88%] rounded-2xl px-3.5 py-2 text-xs sm:text-sm ${
                  m.from === "user"
                    ? "ml-auto rounded-br-sm bg-cat-ink text-white"
                    : "rounded-bl-sm bg-white text-stone-700 shadow-card"
                }`}
              >
                {m.from === "bot" ? <FormattedText text={m.text} /> : m.text}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-stone-400">
                <Spinner className="h-3.5 w-3.5" /> Thinking…
              </div>
            )}
            {messages.length === 1 && (
              <div className="space-y-1.5 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="block w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-left text-xs text-stone-600 transition hover:border-stone-300 min-h-[36px] active:bg-stone-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="flex items-center gap-2 border-t border-stone-100 p-2.5 bg-white">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask a question…"
              className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-xs sm:text-sm outline-none focus:border-stone-400 min-h-[38px]"
            />
            <button
              onClick={() => send()}
              disabled={loading}
              className="btn btn-dark btn-sm px-3.5 py-2 min-h-[38px] text-xs font-bold"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// Lightweight formatter: **bold**, "- " bullets, blank lines. Strips markdown
// tables / headings / stray pipes so answers read cleanly in the narrow bubble.
function inline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function FormattedText({ text }) {
  const lines = (text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^\|?\s*-{2,}/.test(l)); // drop table separator rows

  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (/^[-*]\s+/.test(line)) {
          return (
            <div key={i} className="flex gap-1.5">
              <span className="mt-[2px] text-stone-400">•</span>
              <span>{inline(line.replace(/^[-*]\s+/, ""))}</span>
            </div>
          );
        }
        // markdown table row -> "a — b — c"
        if (line.includes("|")) {
          const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
          return <p key={i}>{inline(cells.join(" — "))}</p>;
        }
        return <p key={i}>{inline(line.replace(/^#+\s*/, ""))}</p>;
      })}
    </div>
  );
}
