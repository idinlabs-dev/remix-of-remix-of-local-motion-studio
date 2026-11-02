import { Link } from "@tanstack/react-router";
import { Github, Images, LogIn, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

import { getGitHubStatus } from "@/lib/github/github.functions";

export function FloatingMenu() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<{
    configured: boolean;
    connected: boolean;
    login?: string;
    avatarUrl?: string;
  }>({ configured: false, connected: false });

  useEffect(() => {
    let active = true;
    void getGitHubStatus()
      .then((next) => active && setStatus(next))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const login = () => {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/api/github/connect?returnTo=${encodeURIComponent(returnTo)}`);
  };

  return (
    <div className="fixed right-4 top-4 z-50 sm:right-6 sm:top-6">
      <div className="flex items-center gap-2 rounded-full border border-border/80 bg-white/95 p-1.5 shadow-lg shadow-slate-200/60 backdrop-blur">
        {status.connected && status.login && (
          <span className="hidden max-w-32 truncate pl-3 text-xs font-bold text-foreground sm:inline">
            @{status.login}
          </span>
        )}
        <button
          type="button"
          aria-label={open ? "Tutup menu" : "Buka menu"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="grid size-10 place-items-center rounded-full bg-slate-950 text-white transition hover:bg-slate-800"
        >
          {open ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </div>

      {open && (
        <div className="absolute right-0 mt-3 w-64 rounded-2xl border border-border bg-white p-2 shadow-xl shadow-slate-200/70">
          <div className="border-b border-border px-3 pb-3 pt-2">
            <p className="text-sm font-bold">Auto Remotion Studio</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Buat video dengan alur yang simpel.
            </p>
          </div>
          <Link
            to="/gallery"
            onClick={() => setOpen(false)}
            className="mt-2 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition hover:bg-slate-50"
          >
            <Images className="size-4 text-primary" />
            <span>Gallery</span>
          </Link>
          {status.connected ? (
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-800">
              {status.avatarUrl ? (
                <img src={status.avatarUrl} alt="" className="size-5 rounded-full" />
              ) : (
                <Github className="size-4" />
              )}
              <span className="truncate">Login GitHub aktif</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={login}
              className="mt-1 flex w-full items-center gap-3 rounded-xl bg-slate-950 px-3 py-3 text-left text-sm font-bold text-white transition hover:bg-slate-800"
            >
              {status.configured ? <Github className="size-4" /> : <LogIn className="size-4" />}
              <span>Login dengan GitHub</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
