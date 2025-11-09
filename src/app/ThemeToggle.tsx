"use client";
import { useEffect, useState } from "react";

type Theme = "dark" | "light";

export default function ThemeToggle() {
  const [t, setT] = useState<Theme>("dark");

  const apply = (x: Theme) => {
    document.documentElement.setAttribute("data-theme", x);
    localStorage.setItem("theme", x);
    setT(x);
  };

  useEffect(() => {
    const saved = localStorage.getItem("theme") as Theme | null;
    if (saved) {
      apply(saved);
      return;
    }
    const prefersDark =
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    apply(prefersDark ? "dark" : "light");
  }, []);

  return (
    <button
      type="button"
      onClick={() => apply(t === "dark" ? "light" : "dark")}
      className="btn btn-ghost"
      aria-label="Toggle theme"
    >
      {t === "dark" ? "🌙 Dark" : "☀️ Light"}
    </button>
  );
}
