// Logika akses API JokiProyek + filter. Hanya dipakai di sisi server (route handler),
// supaya tidak kena CORS dan token tidak bocor ke pihak ketiga.
//
// ATURAN: modul ini hanya melakukan request GET. Jangan tambahkan POST/PUT/PATCH/DELETE
// (mis. submit bid) tanpa keputusan sadar dari pemilik.

const API = "https://api.jokiproyek.com";
const LIST_URL = `${API}/18083/api/bidding/engineer/projects`;
const DETAIL_URL = (code: string) =>
  `${API}/18083/api/bidding/engineer/projects/detail/${encodeURIComponent(code)}`;

// Proyek "Fleksibel" (tanpa deadline bidding) hanya tampil kalau dibuat
// dalam rentang hari ini.
const FLEX_MAX_AGE_DAYS = 30;

export type RawProject = {
  pro_id: string;
  pro_chrg_code: string;
  pro_desc: string | null;
  bid_desc: string | null;
  pro_deadline: string | null;
  bid_deadline_internal: string | null;
  project_type: string | null;
  req_id: string | null;
  is_highest_bid_visible?: boolean;
  highest_bid?: unknown;
  request?: {
    created_at?: string;
    req_tier?: string | null;
    req_budget?: number | null;
  } | null;
};

export type Project = {
  pro_id: string;
  code: string;
  reqId: string | null;
  type: string | null;
  tier: string | null;
  desc: string;
  bidDeadline: string | null; // deadline bidding (yang tampil di website)
  createdAt: string | null;
  bucket: "deadline" | "flex"; // alasan proyek ini lolos filter
  biddingStatus: string | null; // diisi hanya untuk bucket "flex" (hasil endpoint detail)
  url: string;
};

export class JpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

// Tanggal "hari ini" menurut zona waktu Asia/Jakarta, format YYYY-MM-DD.
export function todayJakarta(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
}

function daysBetween(from: string, toISO: string | undefined | null): number {
  if (!toISO) return Infinity;
  const a = Date.parse(from + "T00:00:00Z");
  const b = Date.parse(toISO);
  if (Number.isNaN(a) || Number.isNaN(b)) return Infinity;
  return (a - b) / 86_400_000;
}

async function getJson(url: string, token: string): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, { headers: authHeaders(token), cache: "no-store" });
  } catch {
    throw new JpError(502, "Gagal menghubungi API JokiProyek.");
  }
  if (res.status === 401 || res.status === 403) {
    throw new JpError(401, "Token tidak valid atau sudah kedaluwarsa. Ambil token baru.");
  }
  if (!res.ok) throw new JpError(502, `API JokiProyek membalas ${res.status}.`);
  return res.json();
}

// Jalankan banyak task dengan batas konkurensi, supaya tidak membanjiri API.
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

function toProject(r: RawProject, bucket: Project["bucket"], biddingStatus: string | null): Project {
  const code = r.pro_chrg_code;
  const q = r.req_id ? `?req=${encodeURIComponent(r.req_id)}` : "";
  return {
    pro_id: r.pro_id,
    code,
    reqId: r.req_id ?? null,
    type: r.project_type ?? null,
    tier: r.request?.req_tier ?? null,
    desc: (r.bid_desc || r.pro_desc || "").replace(/\s+/g, " ").trim(),
    bidDeadline: r.bid_deadline_internal ?? null,
    createdAt: r.request?.created_at ?? null,
    bucket,
    biddingStatus,
    url: `https://coder.jokiproyek.com/bidding/${encodeURIComponent(code)}${q}`,
  };
}

export type FetchResult = {
  today: string;
  totalOpen: number; // jumlah proyek mentah dari API (sebelum filter)
  projects: Project[];
};

// Ambil daftar proyek, lalu filter:
//   bucket "deadline": bid_deadline_internal >= hari ini (WIB)
//   bucket "flex":     tanpa bid_deadline_internal, dibuat <= 30 hari, dan bidding_status == OPEN
export async function fetchFilteredProjects(token: string): Promise<FetchResult> {
  const today = todayJakarta();
  const list: RawProject[] = (await getJson(LIST_URL, token))?.data ?? [];

  const deadline = list
    .filter((r) => r.bid_deadline_internal && r.bid_deadline_internal >= today)
    .map((r) => toProject(r, "deadline", null));

  // Kandidat Fleksibel: tanpa deadline bidding & dibuat <= 30 hari.
  const flexCandidates = list.filter(
    (r) => !r.bid_deadline_internal && daysBetween(today, r.request?.created_at) <= FLEX_MAX_AGE_DAYS,
  );

  // Cek status OPEN lewat endpoint detail (hanya untuk kandidat yang sudah lolos filter umur).
  const flex: Project[] = [];
  const details = await pool(flexCandidates, 5, async (r) => {
    try {
      const d = (await getJson(DETAIL_URL(r.pro_chrg_code), token))?.data;
      return { r, status: (d?.bidding_status ?? null) as string | null };
    } catch (e) {
      if (e instanceof JpError && e.status === 401) throw e; // token mati -> hentikan
      return { r, status: null }; // error lain: lewati proyek ini
    }
  });
  for (const { r, status } of details) {
    if ((status ?? "").toUpperCase() === "OPEN") flex.push(toProject(r, "flex", status));
  }

  // Terbaru dulu (berdasarkan waktu proyek dibuat).
  const projects = [...deadline, ...flex].sort((a, b) =>
    (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
  );

  return { today, totalOpen: list.length, projects };
}
