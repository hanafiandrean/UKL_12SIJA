import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

export const metadata: Metadata = {
  title: "Yam.Io — Broiler Monitoring",
  description: "Dashboard suhu & cahaya",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Boleh kasih default: data-theme="dark" (ThemeToggle akan override)
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className="min-h-screen">
        <div className="mx-auto max-w-6xl p-4">
          <header className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold">
              Yam.Io 🐣 — Broiler Monitoring
            </h1>

            <div className="flex items-center gap-2">
              <nav className="hidden sm:flex items-center gap-2">
                <Link href="/" className="btn btn-ghost">📊 Dashboard</Link>
                <Link href="/chat" className="btn btn-ghost">🤖 Kakangku-AI</Link>
                <Link href="/settings" className="btn btn-ghost">⚙️ Settings</Link>
              </nav>
              <ThemeToggle />
            </div>
          </header>

          {children}
        </div>
      </body>
    </html>
  );
}
