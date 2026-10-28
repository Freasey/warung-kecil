import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JP Engineer Tool",
  description: "Daftar proyek bidding JokiProyek, sudah difilter.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
