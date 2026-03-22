"use client";

import {
  WAYFAIR_ANSWERS_MODIFIER_MAX_CHARS_PER_ITEM,
  WAYFAIR_ANSWERS_MODIFIER_MAX_ITEMS
} from "@wayfo/shared";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";

export type AgentModifierBlocksEditorProps = {
  blocks: string[];
  onChange: (blocks: string[]) => void;
  idPrefix: string;
  /** Optional heading inside the editor (not a dialog title). */
  legend?: string;
};

export function countNonEmptyModifierBlocks(blocks: string[]): number {
  return blocks.filter((b) => b.trim().length > 0).length;
}

export function AgentModifierBlocksEditor({
  blocks,
  onChange,
  idPrefix,
  legend
}: AgentModifierBlocksEditorProps) {
  const addBlock = () => {
    if (blocks.length >= WAYFAIR_ANSWERS_MODIFIER_MAX_ITEMS) {
      return;
    }
    onChange([...blocks, ""]);
  };

  const removeAt = (index: number) => {
    onChange(blocks.filter((_, i) => i !== index));
  };

  const updateAt = (index: number, value: string) => {
    const next = [...blocks];
    next[index] = value.slice(0, WAYFAIR_ANSWERS_MODIFIER_MAX_CHARS_PER_ITEM);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-4">
      {legend ? (
        <p className="text-sm text-muted-foreground">{legend}</p>
      ) : null}
      <div className="flex flex-col gap-3">
        {blocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无条目，点击下方按钮添加。</p>
        ) : null}
        {blocks.map((block, index) => (
          <div
            key={`${idPrefix}-row-${index}`}
            className="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={`${idPrefix}-block-${index}`} className="text-xs text-muted-foreground">
                条目 {index + 1}
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeAt(index)}
                aria-label={`删除条目 ${index + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Textarea
              id={`${idPrefix}-block-${index}`}
              value={block}
              onChange={(e) => updateAt(index, e.target.value)}
              placeholder="多行说明，例如价格字段如何对应 Amazon 价格、缺省时的策略等。"
              rows={4}
              className="min-h-[96px] resize-y font-mono text-sm"
              maxLength={WAYFAIR_ANSWERS_MODIFIER_MAX_CHARS_PER_ITEM}
            />
            <p className="text-xs text-muted-foreground text-right">
              {block.length}/{WAYFAIR_ANSWERS_MODIFIER_MAX_CHARS_PER_ITEM}
            </p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addBlock}
          disabled={blocks.length >= WAYFAIR_ANSWERS_MODIFIER_MAX_ITEMS}
        >
          <Plus className="mr-1 h-4 w-4" />
          添加条目
        </Button>
        <span className="text-xs text-muted-foreground">
          最多 {WAYFAIR_ANSWERS_MODIFIER_MAX_ITEMS} 条，每条最多{" "}
          {WAYFAIR_ANSWERS_MODIFIER_MAX_CHARS_PER_ITEM} 字符
        </span>
      </div>
    </div>
  );
}
