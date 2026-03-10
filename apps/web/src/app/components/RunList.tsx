import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type RunItem = {
  id: string;
  amazonUrl: string;
  status: string;
  createdAt: string;
};

export function RunList({
  runs,
  title,
  showViewAllLink,
}: {
  runs: RunItem[];
  title: string;
  showViewAllLink?: boolean;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{runs.length} 个</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {runs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">
            暂无 Run
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {runs.map((run) => (
              <div
                key={run.id}
                className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{run.status}</Badge>
                  <span className="font-medium">{run.id}</span>
                </div>
                <div className="text-sm text-muted-foreground">{run.amazonUrl}</div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{run.createdAt}</span>
                  <Link
                    href={`/runs/${run.id}`}
                    className="text-primary hover:underline"
                  >
                    查看详情
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
        {showViewAllLink ? (
          <Link
            href="/runs"
            className="text-center text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            查看全部 Run
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
