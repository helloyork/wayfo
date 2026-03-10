import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type StepItem = {
  title: string;
  status: string;
  detail: string;
  badgeTone?: "success" | "warning" | "danger";
};

const badgeVariantMap = {
  success: "success" as const,
  warning: "warning" as const,
  danger: "destructive" as const,
};

export function StepOverview({ steps }: { steps: StepItem[] }) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>流程步骤</CardTitle>
        <CardDescription>按架构步骤展示</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {steps.map((step) => {
            const variant = step.badgeTone
              ? badgeVariantMap[step.badgeTone]
              : "secondary";
            return (
              <div
                key={step.title}
                className="flex flex-col gap-1 rounded-lg border border-border bg-muted/30 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={variant}>{step.status}</Badge>
                  <span className="font-medium">{step.title}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {step.detail}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
