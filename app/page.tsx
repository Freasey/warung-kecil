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
  if (!d) return "Fleksibel";
  const t = Date.parse(d);
  if (Number.isNaN(t)) return d;
  return new Date(t).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

export default function Home() {
  const [token, setToken] = useState("");
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // Muat token tersimpan saat halaman dibuka.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TOKEN_KEY) || "";
      if (saved) {
        setToken(saved);
        setDraft(saved);
      }
    } catch {
      /* localStorage bisa diblokir; abaikan */
    }
  }, []);

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

  return (
    <main className="wrap">
      <h1>JP Engineer Tool</h1>
      <p className="sub">
        Daftar proyek bidding JokiProyek, sudah difilter: deadline bidding masih
        berjalan, atau proyek Fleksibel (dibuat ≤ 30 hari & status OPEN).
      </p>

      <section className="card">
        <h2>1. Ambil token</h2>
        <ol className="steps">
          <li>
            Buka & login di{" "}
            <a href="https://coder.jokiproyek.com/login" target="_blank" rel="noreferrer">
              coder.jokiproyek.com
            </a>
            .
          </li>
          <li>
            Di tab itu, buka <b>Console</b> (F12 → Console), tempel kode ini, lalu Enter:
          </li>
        </ol>
        <pre>{CONSOLE_SNIPPET}</pre>
        <div className="row">
          <button className="ghost" onClick={copySnippet}>
            {copied ? "Tersalin ✓" : "Salin kode"}
          </button>
          <span className="meta">Token akan otomatis tersalin ke clipboard di tab itu.</span>
        </div>
      </section>

      <section className="card">
        <h2>2. Tempel token</h2>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Paste token (authTokenPlcs) di sini…"
          spellCheck={false}
        />
        <div className="row" style={{ marginTop: 8 }}>
          <button onClick={saveAndLoad} disabled={!draft.trim() || loading}>
            {loading ? "Memuat…" : "Simpan & Muat"}
          </button>
          {token && (
            <button className="ghost" onClick={clearToken}>
              Hapus token
            </button>
          )}
          {expiry && (
            <span className="meta">
              {expired ? "⚠ Token kedaluwarsa — ambil baru." : `Token berlaku s/d ${expiry.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}`}
            </span>
          )}
        </div>
        {error && <p className="msg err">{error}</p>}
      </section>

      {result && (
        <section>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
            <h2 style={{ margin: 0 }}>
              {result.projects.length} proyek untuk di-bid
            </h2>
            <div className="row">
              <span className="meta">dari {result.totalOpen} proyek terbuka</span>
              <button className="ghost" onClick={() => load(token)} disabled={loading}>
                {loading ? "…" : "Muat ulang"}
              </button>
            </div>
          </div>

          {result.projects.length === 0 && (
            <p className="sub">Belum ada proyek yang cocok dengan filter saat ini.</p>
          )}

          {result.projects.map((p) => (
            <a key={p.pro_id + p.code} className="proj" href={p.url} target="_blank" rel="noreferrer">
              <div className="top">
                <span className="code">{p.code}</span>
                <div className="badges">
                  {p.bucket === "deadline" ? (
                    <span className="badge deadline">Deadline {formatDate(p.bidDeadline)}</span>
                  ) : (
                    <span className="badge flex">Fleksibel</span>
                  )}
                  {p.type && <span className="badge">{p.type}</span>}
                  {p.tier && <span className="badge">{p.tier}</span>}
                </div>
              </div>
              <p className="desc">{p.desc || "—"}</p>
              <span className="meta">
                {p.bucket === "flex" && p.createdAt
                  ? `Dibuat ${formatDate(p.createdAt.slice(0, 10))}`
                  : `Deadline bidding ${formatDate(p.bidDeadline)}`}
              </span>
            </a>
          ))}
        </section>
      )}
    </main>
  );
}
