"use client";

import { useCallback, useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  AgentModifierBlocksEditor,
  countNonEmptyModifierBlocks
} from "./AgentModifierBlocksEditor";

type AppSettingsResponse = {
  enumerateVariantsDefault: boolean;
  primaryImageCandidateCount: number;
  timezone: string;
  updatedAt: string | null;
  agentModifiers?: { wayfairAnswers?: string[] };
};

export type WayfairAgentModifiersDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiBase: string;
  /** Called after a successful save (e.g. refresh summary count on parent). */
  onSaved?: () => void;
};

export function WayfairAgentModifiersDialog({
  open,
  onOpenChange,
  apiBase,
  onSaved
}: WayfairAgentModifiersDialogProps) {
  const [blocks, setBlocks] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadFromServer = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`${apiBase}/api/settings/app`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error("加载设置失败");
      }
      const payload = (await res.json()) as AppSettingsResponse;
      setBlocks(payload.agentModifiers?.wayfairAnswers ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "加载失败");
      setBlocks([]);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    if (open) {
      void loadFromServer();
      setSaveError(null);
    }
  }, [open, loadFromServer]);

  const saveAndClose = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const resGet = await fetch(`${apiBase}/api/settings/app`, { cache: "no-store" });
      if (!resGet.ok) {
        throw new Error("读取当前设置失败");
      }
      const current = (await resGet.json()) as AppSettingsResponse;
      const wayfairAnswers = blocks.map((s) => s.trim()).filter(Boolean);
      const resPost = await fetch(`${apiBase}/api/settings/app`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enumerateVariantsDefault: current.enumerateVariantsDefault,
          primaryImageCandidateCount: current.primaryImageCandidateCount,
          timezone: current.timezone,
          agentModifiers: { wayfairAnswers }
        })
      });
      if (!resPost.ok) {
        throw new Error("保存失败");
      }
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Wayfair 填答修改器（全局）</DialogTitle>
          <DialogDescription>
            说明保存在应用设置中，对所有 Run 生效，刷新页面后仍会保留。执行 Wayfair
            填答时会注入 Agent；计划表中硬覆盖的单元格优先生效。
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            加载中…
          </div>
        ) : loadError ? (
          <div className="flex flex-col gap-2">
            <Badge variant="destructive">{loadError}</Badge>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadFromServer()}>
              重试
            </Button>
          </div>
        ) : (
          <AgentModifierBlocksEditor
            idPrefix="global-modifier"
            blocks={blocks}
            onChange={setBlocks}
          />
        )}
        {saveError ? (
          <p className="text-sm text-destructive">{saveError}</p>
        ) : null}
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between sm:gap-0">
          <span className="text-xs text-muted-foreground sm:mr-auto">
            已填条目：{countNonEmptyModifierBlocks(blocks)}
            {!loading && !loadError ? (
              <span className="block text-[11px] mt-1 opacity-80">
                关闭而不点「保存」将丢弃本次未保存的编辑。
              </span>
            ) : null}
          </span>
          <div className="flex flex-wrap gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              关闭
            </Button>
            <Button type="button" onClick={() => void saveAndClose()} disabled={loading || !!loadError || saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中…
                </>
              ) : (
                "保存"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
