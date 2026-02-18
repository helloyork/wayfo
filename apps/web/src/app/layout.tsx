import "./globals.css";
import Link from "next/link";
import { ReactNode } from "react";

export const metadata = {
  title: "Wayfo",
  description: "Wayfo local-first workflow"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh">
      <body>
        <div className="container stack">
          <header className="row">
            <h1>Wayfo</h1>
            <nav className="row muted">
              <Link href="/">Runs</Link>
              <Link href="/settings">设置</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
