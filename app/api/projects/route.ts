import { NextRequest, NextResponse } from "next/server";
import { fetchFilteredProjects, JpError } from "@/lib/jp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server perantara: menerima token dari app kita (header Authorization), memanggil
// API JokiProyek dari sisi server (bebas CORS), lalu mengembalikan proyek yang sudah difilter.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Token kosong. Tempel token dulu." }, { status: 400 });
  }
  try {
    const data = await fetchFilteredProjects(token);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (e) {
    const status = e instanceof JpError ? e.status : 500;
    const message = e instanceof Error ? e.message : "Terjadi kesalahan.";
    return NextResponse.json({ error: message }, { status });
  }
}
