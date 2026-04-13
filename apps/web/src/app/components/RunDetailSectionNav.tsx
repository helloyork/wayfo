"use client";

import { cn } from "@/lib/utils";

const linkClass =
  "inline-flex shrink-0 items-center rounded-md border border-transparent px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground";

type Props = {
  needsReview: boolean;
};

/**
 * In-page jump links for run detail; keeps long run pages scannable.
 */
export function RunDetailSectionNav({ needsReview }: Props) {
  return (
    <nav
      aria-label="本页区块"
      className="sticky top-0 z-10 -mx-6 mb-2 flex flex-wrap gap-1.5 border-b border-border/70 bg-background/95 px-6 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <a href="#run-overview" className={linkClass}>
        概览
      </a>
      <a href="#run-progress" className={linkClass}>
        进度
      </a>
      <a
        href="#run-review"
        className={cn(
          linkClass,
          needsReview && "border-primary/40 bg-primary/10 text-primary hover:text-primary"
        )}
      >
        Wayfair 审查
      </a>
      <a href="#run-jobs" className={linkClass}>
        任务
      </a>
      <a href="#run-events" className={cn(linkClass, "text-muted-foreground/90")}>
        事件流
      </a>
      <a href="#run-artifacts" className={linkClass}>
        产物
      </a>
    </nav>
  );
}
