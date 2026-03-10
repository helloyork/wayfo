import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ReviewItem = {
  title: string;
  description: string;
  owner: string;
};

export function ReviewQueue({ items }: { items: ReviewItem[] }) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>待审查</CardTitle>
        <CardDescription>人工确认入口</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">
            暂无待审查项
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <div
                key={item.title}
                className="flex flex-col gap-1 rounded-lg border border-border bg-muted/30 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="warning">需要确认</Badge>
                  <span className="font-medium">{item.title}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {item.description}
                </div>
                <div className="text-sm text-muted-foreground">
                  归属: {item.owner}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
