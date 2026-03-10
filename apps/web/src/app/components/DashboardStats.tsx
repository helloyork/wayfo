import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type StatItem = {
  label: string;
  value: string;
  hint?: string;
};

export function DashboardStats({ items }: { items: StatItem[] }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle>概览</CardTitle>
        <CardDescription>本地运行与任务概况</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {items.map((item) => (
            <div key={item.label} className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">{item.label}</span>
              <span className="text-2xl font-semibold">{item.value}</span>
              {item.hint ? (
                <span className="text-sm text-muted-foreground">{item.hint}</span>
              ) : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
