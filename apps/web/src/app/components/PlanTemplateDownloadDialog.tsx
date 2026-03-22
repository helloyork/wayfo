"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { matchesTokenizedSearch } from "@/lib/fuzzySearch";

type TaxonomyClassRow = {
  classId: string;
  name: string;
};

type PlanTemplateFieldRow = {
  id: string;
  displayName: string;
};

type PlanTemplateDownloadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marketContext: string;
  apiBase: string;
  taxonomyClasses: TaxonomyClassRow[];
  taxonomyLoading: boolean;
  taxonomyError: string | null;
  onPlanStatus: (message: string, tone: "success" | "warning" | "danger") => void;
  onDownloadBaseTemplate: () => void;
  /** Fires after the dialog has had a chance to paint (e.g. clear parent entry loading). */
  onAfterOpen?: () => void;
};

function yieldToPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

export function PlanTemplateDownloadDialog({
  open,
  onOpenChange,
  marketContext,
  apiBase,
  taxonomyClasses,
  taxonomyLoading,
  taxonomyError,
  onPlanStatus,
  onDownloadBaseTemplate,
  onAfterOpen
}: PlanTemplateDownloadDialogProps) {
  const [classFilter, setClassFilter] = useState("");
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(
    () => new Set()
  );
  const [mergedFields, setMergedFields] = useState<PlanTemplateFieldRow[]>([]);
  const [selectedFieldIds, setSelectedFieldIds] = useState<Set<string>>(
    () => new Set()
  );
  const [fieldFilter, setFieldFilter] = useState("");
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [fieldsError, setFieldsError] = useState<string | null>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setClassFilter("");
      setSelectedClassIds(new Set());
      setMergedFields([]);
      setSelectedFieldIds(new Set());
      setFieldFilter("");
      setFieldsError(null);
      setFieldsLoading(false);
      setDownloadLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let id1 = 0;
    let id2 = 0;
    id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => {
        onAfterOpen?.();
      });
    });
    return () => {
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2);
    };
  }, [open, onAfterOpen]);

  const filteredTaxonomyClasses = useMemo(() => {
    if (!classFilter.trim()) return taxonomyClasses;
    return taxonomyClasses.filter((row) => {
      const haystack = `${row.classId} ${row.name ?? ""}`;
      return matchesTokenizedSearch(haystack, classFilter);
    });
  }, [taxonomyClasses, classFilter]);

  const filteredFields = useMemo(() => {
    if (!fieldFilter.trim()) return mergedFields;
    return mergedFields.filter((f) => {
      const haystack = `${f.id} ${f.displayName ?? ""}`;
      return matchesTokenizedSearch(haystack, fieldFilter);
    });
  }, [mergedFields, fieldFilter]);

  const toggleClassSelected = (classId: string) => {
    setSelectedClassIds((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  };

  const selectAllFilteredClasses = () => {
    setSelectedClassIds((prev) => {
      const next = new Set(prev);
      for (const row of filteredTaxonomyClasses) {
        next.add(row.classId);
      }
      return next;
    });
  };

  const clearClassSelection = () => {
    setSelectedClassIds(new Set());
  };

  const toggleFieldSelected = (fieldId: string) => {
    setSelectedFieldIds((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) next.delete(fieldId);
      else next.add(fieldId);
      return next;
    });
  };

  const selectAllFilteredFields = () => {
    setSelectedFieldIds((prev) => {
      const next = new Set(prev);
      for (const f of filteredFields) {
        next.add(f.id);
      }
      return next;
    });
  };

  const clearFieldSelection = () => {
    setSelectedFieldIds(new Set());
  };

  const loadMergedFields = useCallback(async () => {
    if (!marketContext.trim()) {
      onPlanStatus("请先选择 Market Context", "warning");
      return;
    }
    if (selectedClassIds.size === 0) {
      onPlanStatus("请至少选择一个类目", "warning");
      return;
    }
    const classIds = Array.from(selectedClassIds)
      .map((id) => Number(id))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (classIds.length === 0) {
      onPlanStatus("所选类目 id 无效", "warning");
      return;
    }
    setFieldsLoading(true);
    setFieldsError(null);
    await yieldToPaint();
    try {
      const res = await fetch(`${apiBase}/api/runs/plan-template-fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketContext: marketContext.trim(),
          classIds
        })
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message ?? "加载题目列表失败");
      }
      const data = (await res.json()) as { fields?: PlanTemplateFieldRow[] };
      const fields = data.fields ?? [];
      setMergedFields(fields);
      setSelectedFieldIds(new Set(fields.map((f) => f.id)));
      setFieldFilter("");
      onPlanStatus(`已加载 ${fields.length} 个题目列`, "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "加载题目列表失败";
      setFieldsError(msg);
      setMergedFields([]);
      setSelectedFieldIds(new Set());
      onPlanStatus(msg, "danger");
    } finally {
      setFieldsLoading(false);
    }
  }, [apiBase, marketContext, onPlanStatus, selectedClassIds]);

  const downloadFilteredTemplate = async () => {
    if (!marketContext.trim()) {
      onPlanStatus("请先选择 Market Context", "warning");
      return;
    }
    if (selectedClassIds.size === 0) {
      onPlanStatus("请至少选择一个类目", "warning");
      return;
    }
    if (mergedFields.length === 0) {
      onPlanStatus("请先点击「加载题目列表」", "warning");
      return;
    }
    if (selectedFieldIds.size === 0) {
      onPlanStatus("请至少勾选一个题目列（或改用「仅基础列」）", "warning");
      return;
    }
    const classIds = Array.from(selectedClassIds)
      .map((id) => Number(id))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (classIds.length === 0) {
      onPlanStatus("所选类目 id 无效", "warning");
      return;
    }
    const questionIds = mergedFields
      .filter((f) => selectedFieldIds.has(f.id))
      .map((f) => f.id);
    setDownloadLoading(true);
    await yieldToPaint();
    try {
      const res = await fetch(`${apiBase}/api/runs/plan-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketContext: marketContext.trim(),
          classIds,
          questionIds
        })
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message ?? "模板生成失败");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "plan-template.xlsx";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onPlanStatus("已下载计划模板", "success");
      onOpenChange(false);
    } catch (err) {
      onPlanStatus(
        err instanceof Error ? err.message : "模板下载失败",
        "danger"
      );
    } finally {
      setDownloadLoading(false);
    }
  };

  const handleBaseOnly = () => {
    onDownloadBaseTemplate();
    onPlanStatus("已触发仅基础列下载", "success");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>下载计划模板</DialogTitle>
          <DialogDescription>
            多选 taxonomy 类目后加载题目列表，再勾选需要的题目列，下载生成的 Excel（仍含固定基础列）。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="plan-dialog-class-filter">类目（多选）</Label>
            <Input
              id="plan-dialog-class-filter"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              placeholder="空格分词；& 两侧有无空格均可；支持子串与顺序模糊 classId / 名称"
              autoComplete="off"
            />
            {taxonomyLoading ? (
              <div className="text-sm text-muted-foreground">加载类目中…</div>
            ) : taxonomyError ? (
              <div className="text-sm text-muted-foreground">{taxonomyError}</div>
            ) : (
              <div className="max-h-40 overflow-y-auto rounded-md border border-border p-2 space-y-2">
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={selectAllFilteredClasses}
                  >
                    全选当前筛选
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={clearClassSelection}
                  >
                    清空已选
                  </button>
                  <span>
                    （已选 {selectedClassIds.size} / {taxonomyClasses.length}）
                  </span>
                </div>
                {filteredTaxonomyClasses.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-2">
                    无匹配类目
                  </div>
                ) : (
                  filteredTaxonomyClasses.map((row) => (
                    <label
                      key={row.classId}
                      className="flex cursor-pointer items-start gap-2 rounded-sm px-1 py-0.5 hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selectedClassIds.has(row.classId)}
                        onChange={() => toggleClassSelected(row.classId)}
                      />
                      <span className="text-sm leading-tight">
                        <span className="font-mono text-xs text-muted-foreground">
                          {row.classId}
                        </span>
                        {row.name ? (
                          <span className="block text-foreground">{row.name}</span>
                        ) : null}
                      </span>
                    </label>
                  ))
                )}
              </div>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-fit"
              disabled={fieldsLoading || taxonomyLoading}
              onClick={() => void loadMergedFields()}
            >
              {fieldsLoading ? (
                <>
                  <Loader2 className="animate-spin" />
                  加载中…
                </>
              ) : (
                "加载题目列表"
              )}
            </Button>
            {fieldsError ? (
              <div className="text-sm text-destructive">{fieldsError}</div>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="plan-dialog-field-filter">题目列（多选）</Label>
            <Input
              id="plan-dialog-field-filter"
              value={fieldFilter}
              onChange={(e) => setFieldFilter(e.target.value)}
              placeholder="筛选 questionId 或显示名…"
              autoComplete="off"
              disabled={mergedFields.length === 0}
            />
            {mergedFields.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                加载题目列表后可在此勾选列。
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto rounded-md border border-border p-2 space-y-2">
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={selectAllFilteredFields}
                  >
                    全选当前筛选
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={clearFieldSelection}
                  >
                    清空已选
                  </button>
                  <span>
                    （已选 {selectedFieldIds.size} / {mergedFields.length}）
                  </span>
                </div>
                {filteredFields.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-2">
                    无匹配题目列
                  </div>
                ) : (
                  filteredFields.map((f) => (
                    <label
                      key={f.id}
                      className="flex cursor-pointer items-start gap-2 rounded-sm px-1 py-0.5 hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selectedFieldIds.has(f.id)}
                        onChange={() => toggleFieldSelected(f.id)}
                      />
                      <span className="text-sm leading-tight">
                        <span className="font-mono text-xs text-muted-foreground break-all">
                          {f.id}
                        </span>
                        {f.displayName ? (
                          <span className="block text-foreground">
                            {f.displayName}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" variant="outline" onClick={handleBaseOnly}>
            仅基础列
          </Button>
          <Button
            type="button"
            disabled={
              downloadLoading ||
              fieldsLoading ||
              taxonomyLoading ||
              mergedFields.length === 0 ||
              selectedFieldIds.size === 0
            }
            onClick={() => void downloadFilteredTemplate()}
          >
            {downloadLoading ? (
              <>
                <Loader2 className="animate-spin" />
                生成中…
              </>
            ) : (
              "下载 Excel"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
