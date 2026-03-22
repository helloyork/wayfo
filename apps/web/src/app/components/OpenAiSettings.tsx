"use client";

import { useEffect, useState } from "react";
import { apiBase } from "../../lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type OpenAiSettingsResponse = {
  hasKey: boolean;
  maskedKey: string | null;
  updatedAt: string | null;
  imageModel: string;
  imageModelOptions: Array<{ id: string; label: string }>;
};

/** Display labels for known models (fallback to API label). */
const IMAGE_MODEL_LABELS: Record<string, string> = {
  "gpt-image-1.5": "GPT Image 1.5（推荐）",
  "gpt-image-1.5-2025-12-16": "GPT Image 1.5（快照 2025-12-16）",
  "gpt-image-1": "GPT Image 1",
  "gpt-image-1-mini": "GPT Image 1 mini",
};

function badgeVariant(
  tone: "success" | "warning" | "danger"
): "success" | "warning" | "destructive" {
  if (tone === "success") return "success";
  if (tone === "danger") return "destructive";
  return "warning";
}

export function OpenAiSettings() {
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [imageModel, setImageModel] = useState("gpt-image-1.5");
  const [imageModelOptions, setImageModelOptions] = useState<
    Array<{ id: string; label: string }>
  >([]);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<
    "success" | "warning" | "danger"
  >("warning");
  const [loading, setLoading] = useState(false);

  const loadSettings = async () => {
    const res = await fetch(`${apiBase}/api/settings/openai`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return;
    }
    const payload = (await res.json()) as OpenAiSettingsResponse;
    setHasKey(payload.hasKey);
    setMaskedKey(payload.maskedKey);
    setUpdatedAt(payload.updatedAt);
    setImageModel(payload.imageModel);
    setImageModelOptions(payload.imageModelOptions ?? []);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const onSave = async () => {
    if (!apiKey.trim()) {
      setStatusTone("warning");
      setStatus("请输入 OpenAI API Key");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/settings/openai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, imageModel }),
      });
      if (!res.ok) {
        throw new Error("保存失败");
      }
      setStatusTone("success");
      setStatus("已保存 OpenAI API Key");
      await loadSettings();
    } catch (error) {
      setStatusTone("danger");
      setStatus(error instanceof Error ? error.message : "保存失败");
    } finally {
      setLoading(false);
    }
  };

  const onValidate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/settings/openai/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: apiKey.trim()
          ? JSON.stringify({ apiKey })
          : JSON.stringify({}),
      });
      if (!res.ok) {
        const payload = (await res.json()) as { message?: string };
        throw new Error(payload.message ?? "验证失败");
      }
      setStatusTone("success");
      setStatus("OpenAI API Key 验证通过");
      await loadSettings();
    } catch (error) {
      setStatusTone("danger");
      setStatus(error instanceof Error ? error.message : "验证失败");
    } finally {
      setLoading(false);
    }
  };

  const onSaveImageModel = async () => {
    if (!hasKey) {
      setStatusTone("warning");
      setStatus("请先保存 OpenAI API Key，再设置生图模型");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/settings/openai`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageModel }),
      });
      if (!res.ok) {
        const payload = (await res.json()) as { message?: string };
        throw new Error(payload.message ?? "保存失败");
      }
      setStatusTone("success");
      setStatus("已保存图片重绘模型");
      await loadSettings();
    } catch (error) {
      setStatusTone("danger");
      setStatus(error instanceof Error ? error.message : "保存失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>OpenAI API Key</CardTitle>
        <CardDescription>
          用于 taxonomy 向量库、类目判定、文案与商品图片重绘（images.edit）等。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="openai-image-model">图片重绘模型</Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <Select value={imageModel} onValueChange={setImageModel}>
              <SelectTrigger id="openai-image-model" className="sm:max-w-md">
                <SelectValue placeholder="选择模型" />
              </SelectTrigger>
              <SelectContent>
                {(imageModelOptions.length > 0
                  ? imageModelOptions
                  : [{ id: "gpt-image-1.5", label: "GPT Image 1.5" }]
                ).map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {IMAGE_MODEL_LABELS[opt.id] ?? opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="secondary"
              onClick={onSaveImageModel}
              disabled={loading}
            >
              保存生图模型
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            默认 GPT Image 1.5；保存 API Key 时也会写入当前选择的模型。已生成缓存图不会因换模型自动失效。
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="openai-key">API Key</Label>
          <Input
            id="openai-key"
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={
              maskedKey ? `已保存 ${maskedKey}` : "输入 OpenAI API Key"
            }
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={onSave} disabled={loading}>
            保存
          </Button>
          <Button type="button" onClick={onValidate} disabled={loading}>
            验证
          </Button>
          {updatedAt ? (
            <span className="text-sm text-muted-foreground">
              更新于 {updatedAt}
            </span>
          ) : null}
        </div>
        {status ? (
          <Badge variant={badgeVariant(statusTone)}>{status}</Badge>
        ) : null}
      </CardContent>
    </Card>
  );
}
