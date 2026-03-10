import "./globals.css";
import { ReactNode } from "react";
import { AppLayout } from "@/components/AppLayout";

export const metadata = {
  title: "Wayfo",
  description: "Wayfo local-first workflow",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh">
      <body>
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
