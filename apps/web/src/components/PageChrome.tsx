"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Crumb = { label: string; href?: string };

function pathToCrumbs(pathname: string): Crumb[] {
  if (pathname === "/") {
    return [{ label: "主界面" }];
  }
  if (pathname === "/runs") {
    return [{ label: "主界面", href: "/" }, { label: "全部批次" }];
  }
  if (pathname.startsWith("/runs/")) {
    const runId = pathname.slice("/runs/".length);
    return [
      { label: "主界面", href: "/" },
      { label: "全部批次", href: "/runs" },
      { label: runId ? `Run ${runId}` : "Run 详情" },
    ];
  }
  if (pathname === "/products") {
    return [{ label: "主界面", href: "/" }, { label: "产品总览" }];
  }
  if (pathname.startsWith("/products/")) {
    const asin = pathname.slice("/products/".length);
    return [
      { label: "主界面", href: "/" },
      { label: "产品总览", href: "/products" },
      { label: asin ? `ASIN ${asin}` : "产品详情" },
    ];
  }
  if (pathname === "/settings") {
    return [{ label: "主界面", href: "/" }, { label: "设置" }];
  }
  return [{ label: "Wayfo" }];
}

function pathToTitle(pathname: string): string {
  if (pathname === "/") return "主界面";
  if (pathname === "/runs") return "全部批次";
  if (pathname.startsWith("/runs/")) {
    const id = pathname.slice("/runs/".length);
    return id ? `Run · ${id}` : "Run 详情";
  }
  if (pathname === "/products") return "产品总览";
  if (pathname.startsWith("/products/")) {
    const asin = pathname.slice("/products/".length);
    return asin ? `产品 · ${asin}` : "产品详情";
  }
  if (pathname === "/settings") return "设置";
  return "Wayfo";
}

/** Contextual shortcuts in the top bar (do not duplicate full nav). */
function ContextLinks({ pathname }: { pathname: string }) {
  const base =
    "text-xs font-medium text-muted-foreground transition-colors hover:text-foreground";

  if (pathname === "/") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/runs" className={base}>
          全部批次
        </Link>
        <Link href="/products" className={base}>
          产品总览
        </Link>
      </div>
    );
  }
  if (pathname === "/runs") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/" className={base}>
          主界面
        </Link>
        <Link href="/products" className={base}>
          产品总览
        </Link>
      </div>
    );
  }
  if (pathname.startsWith("/runs/")) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/runs" className={base}>
          批次列表
        </Link>
        <Link href="/products" className={base}>
          产品总览
        </Link>
      </div>
    );
  }
  if (pathname === "/products") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/" className={base}>
          主界面
        </Link>
        <Link href="/runs" className={base}>
          全部批次
        </Link>
      </div>
    );
  }
  if (pathname.startsWith("/products/")) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/products" className={base}>
          产品列表
        </Link>
        <Link href="/runs" className={base}>
          全部批次
        </Link>
      </div>
    );
  }
  if (pathname === "/settings") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/" className={base}>
          主界面
        </Link>
        <Link href="/runs" className={base}>
          全部批次
        </Link>
      </div>
    );
  }
  return null;
}

export function PageChrome() {
  const pathname = usePathname() || "/";
  const crumbs = pathToCrumbs(pathname);
  const title = pathToTitle(pathname);

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {crumbs.map((crumb, i) => (
            <span key={`${crumb.label}-${i}`} className="flex items-center gap-1">
              {i > 0 ? (
                <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
              ) : null}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="truncate transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className={cn("truncate", i === crumbs.length - 1 && "font-medium text-foreground")}>
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
        </nav>
        <span className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-base">
          {title}
        </span>
      </div>
      <ContextLinks pathname={pathname} />
    </div>
  );
}
