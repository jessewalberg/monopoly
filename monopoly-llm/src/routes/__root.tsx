import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import * as React from "react";
import type { QueryClient } from "@tanstack/react-query";
import appCss from "~/styles/app.css?url";

// ============================================================
// ROUTE DEFINITION
// ============================================================

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "LLM Monopoly Arena",
      },
      {
        name: "description",
        content: "Watch AI models compete in the classic game of Monopoly",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/apple-touch-icon.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon-32x32.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: "/favicon-16x16.png",
      },
      { rel: "manifest", href: "/site.webmanifest", color: "#fffff" },
      { rel: "icon", href: "/favicon.ico" },
    ],
  }),
  notFoundComponent: NotFoundPage,
  component: RootComponent,
});

// ============================================================
// ROOT COMPONENT
// ============================================================

function RootComponent() {
  return (
    <RootDocument>
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col">
        <Navigation />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
    </RootDocument>
  );
}

// ============================================================
// ROOT DOCUMENT
// ============================================================

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

// ============================================================
// NAVIGATION
// ============================================================

function Navigation() {
  return (
    <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 text-white font-bold text-xl hover:text-green-400 transition-colors"
          >
            <span className="text-2xl">🎲</span>
            <span className="hidden sm:inline">LLM Monopoly</span>
          </Link>

          {/* Nav Links */}
          <div className="flex items-center gap-1 sm:gap-2">
            <NavLink to="/">Home</NavLink>
            <NavLink to="/play">Play</NavLink>
            <NavLink to="/analytics">Analytics</NavLink>
            <NavLink to="/games">History</NavLink>
          </div>
        </div>
      </nav>
    </header>
  );
}

function NavLink({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors [&.active]:bg-green-600/20 [&.active]:text-green-400"
      activeProps={{ className: "active" }}
    >
      {children}
    </Link>
  );
}

// ============================================================
// FOOTER
// ============================================================

function Footer() {
  return (
    <footer className="bg-slate-900 border-t border-slate-700 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-slate-400 text-sm">
            LLM Monopoly Arena - Watch AI models compete
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span>
              Powered by{" "}
              <a
                href="https://openrouter.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-400 hover:text-green-300"
              >
                OpenRouter
              </a>
            </span>
            <span>
              Built with{" "}
              <a
                href="https://convex.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-400 hover:text-green-300"
              >
                Convex
              </a>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ============================================================
// NOT FOUND PAGE
// ============================================================

function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
      <div className="text-6xl mb-4">🎲</div>
      <h1 className="text-3xl font-bold text-white mb-2">Page Not Found</h1>
      <p className="text-slate-400 mb-6">
        This property hasn't been developed yet!
      </p>
      <Link
        to="/"
        className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
      >
        Return to GO
      </Link>
    </div>
  );
}
