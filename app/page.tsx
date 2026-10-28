"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Project = {
  pro_id: string;
  code: string;
  reqId: string | null;
  type: string | null;
  tier: string | null;
  desc: string;
  bidDeadline: string | null;
  createdAt: string | null;
  bucket: "deadline" | "flex";
  biddingStatus: string | null;
  url: string;
};

type ApiResult = { today: string; totalOpen: number; projects: Project[] };

const TOKEN_KEY = "jp_token";
const FILTER_KEY = "jp_filter";

// One-liner yang ditempel ke Console di tab coder.jokiproyek.com.
// Membaca cookie authTokenPlcs, menyalin ke clipboard, dan mencetaknya sebagai cadangan.
const CONSOLE_SNIPPET =
  `copy((document.cookie.match(/(?:^|; )authTokenPlcs=([^;]+)/)||[,''])[1]||'(tidak ada - login dulu)');` +
  `console.log('%cToken tersalin ke clipboard. Paste di app.','color:#4ade80;font-weight:bold',` +
  `(document.cookie.match(/(?:^|; )authTokenPlcs=([^;]+)/)||[,''])[1]||'KOSONG');`;

function tokenExpiry(token: string): Date | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload?.exp ? new Date(payload.exp * 1000) : null;
  } catch {
    return null;
  }
}

function formatDate(d: string | null): string {
  if (!d) return "-";
  const t = Date.parse(d);
  if (Number.isNaN(t)) return d;
  return new Date(t).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Jakarta",
  });
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const mins = Math.floor((Date.now() - t) / 60_000);
  if (mins < 60) return `${Math.max(mins, 1)} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

function daysLeft(date: string | null, today: string): string {
  if (!date) return "";
  const diff = Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000);
  if (diff <= 0) return "hari ini";
  if (diff === 1) return "besok";
  return `${diff} hari lagi`;
}

export default function Home() {
  const [token, setToken] = useState("");
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showSetup, setShowSetup] = useState(true);
  const [showFlex, setShowFlex] = useState(true);
  const [showDeadline, setShowDeadline] = useState(true);

  // Muat token & pilihan filter tersimpan saat halaman dibuka.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TOKEN_KEY) || "";
      if (saved) {
        setToken(saved);
        setDraft(saved);
        setShowSetup(false);
      }
      const f = JSON.parse(localStorage.getItem(FILTER_KEY) || "null");
      if (f) {
        setShowFlex(f.flex !== false);
        setShowDeadline(f.deadline !== false);
      }
    } catch {
      /* localStorage bisa diblokir; abaikan */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify({ flex: showFlex, deadline: showDeadline }));
    } catch {
      /* abaikan */
    }
  }, [showFlex, showDeadline]);

  const expiry = useMemo(() => (token ? tokenExpiry(token) : null), [token]);
  const expired = expiry ? expiry.getTime() < Date.now() : false;

  const load = useCallback(async (tk: string) => {
    if (!tk) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/projects", { headers: { Authorization: `Bearer ${tk}` } });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error || `Gagal (${res.status}).`);
        setResult(null);
        setShowSetup(true);
      } else {
        setResult(body);
      }
    } catch {
      setError("Tidak bisa menghubungi server.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Muat otomatis kalau sudah ada token tersimpan & belum kedaluwarsa.
  useEffect(() => {
    if (token && !expired && !result) load(token);
    if (token && expired) setShowSetup(true);
  }, [token, expired, result, load]);

  function saveAndLoad() {
    const tk = draft.trim();
    if (!tk) return;
    try {
      localStorage.setItem(TOKEN_KEY, tk);
    } catch {
      /* abaikan */
    }
    setToken(tk);
    setResult(null);
    setShowSetup(false);
    load(tk);
  }

  function clearToken() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* abaikan */
    }
    setToken("");
    setDraft("");
    setResult(null);
    setError("");
    setShowSetup(true);
  }

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(CONSOLE_SNIPPET);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard bisa diblokir; user salin manual */
    }
  }

  const all = result?.projects ?? [];
  const flexCount = all.filter((p) => p.bucket === "flex").length;
  const deadlineCount = all.length - flexCount;
  const visible = all.filter((p) => (p.bucket === "flex" ? showFlex : showDeadline));

  return (
    <main className="wrap">
      <header className="head">
        <div>
          <h1>JP Engineer Tool</h1>
          <p className="sub">Proyek bidding JokiProyek yang masih bisa diambil.</p>
        </div>
        {token && !showSetup && (
          <div className="row">
            {expiry && (
              <span className={`meta ${expired ? "err" : ""}`}>
                {expired
                  ? "Token kedaluwarsa"
                  : `Token s/d ${expiry.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}`}
              </span>
            )}
            <button className="ghost sm" onClick={() => setShowSetup(true)}>
              Ganti token
            </button>
          </div>
        )}
      </header>

      {showSetup && (
        <section className="panel">
          <div className="step">
            <span className="num">1</span>
            <div className="grow">
              <p>
                Login di{" "}
                <a href="https://coder.jokiproyek.com/login" target="_blank" rel="noreferrer">
                  coder.jokiproyek.com
                </a>
                , buka <b>Console</b> (F12), tempel kode ini lalu Enter:
              </p>
              <pre>{CONSOLE_SNIPPET}</pre>
              <button className="ghost sm" onClick={copySnippet}>
                {copied ? "Tersalin ✓" : "Salin kode"}
              </button>
            </div>
          </div>
          <div className="step">
            <span className="num">2</span>
            <div className="grow">
              <p>Paste token hasil Console di sini:</p>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="eyJ0eXAiOiJKV1Qi…"
                spellCheck={false}
              />
              <div className="row">
                <button onClick={saveAndLoad} disabled={!draft.trim() || loading}>
                  {loading ? "Memuat…" : "Simpan & Muat"}
                </button>
                {token && (
                  <button className="ghost" onClick={clearToken}>
                    Hapus token
                  </button>
                )}
                {token && !expired && result && (
                  <button className="ghost" onClick={() => setShowSetup(false)}>
                    Tutup
                  </button>
                )}
              </div>
            </div>
          </div>
          {error && <p className="msg err">{error}</p>}
        </section>
      )}

      {!showSetup && error && <p className="msg err">{error}</p>}

      {loading && !result && <p className="sub center">Memuat proyek…</p>}

      {result && (
        <>
          <div className="toolbar">
            <div className="toggles">
              <button
                className={`toggle flex ${showFlex ? "on" : ""}`}
                onClick={() => setShowFlex((v) => !v)}
                aria-pressed={showFlex}
              >
                <span className="dot" /> Fleksibel <b>{flexCount}</b>
              </button>
              <button
                className={`toggle deadline ${showDeadline ? "on" : ""}`}
                onClick={() => setShowDeadline((v) => !v)}
                aria-pressed={showDeadline}
              >
                <span className="dot" /> Deadline <b>{deadlineCount}</b>
              </button>
            </div>
            <button className="ghost sm" onClick={() => load(token)} disabled={loading}>
              {loading ? "Memuat…" : "↻ Muat ulang"}
            </button>
          </div>

          {visible.length === 0 ? (
            <p className="sub center">Tidak ada proyek untuk filter ini.</p>
          ) : (
            <div className="grid">
              {visible.map((p) => (
                <a
                  key={p.pro_id + p.code}
                  className={`card ${p.bucket}`}
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className="card-top">
                    <span className="code">{p.code}</span>
                    <span className="ago">{timeAgo(p.createdAt)}</span>
                  </div>
                  <p className="desc">{p.desc || "Tanpa deskripsi"}</p>
                  <div className="card-bottom">
                    <span className="type">
                      {p.type}
                      {p.tier && p.tier !== "regular" ? ` · ${p.tier}` : ""}
                    </span>
                    {p.bucket === "deadline" ? (
                      <span className="pill deadline">
                        {formatDate(p.bidDeadline)} · {daysLeft(p.bidDeadline, result.today)}
                      </span>
                    ) : (
                      <span className="pill flex">Fleksibel</span>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}
          <p className="meta center foot">
            Menampilkan {visible.length} dari {result.totalOpen} proyek terbuka · urut terbaru
          </p>
        </>
      )}
    </main>
  );
}
