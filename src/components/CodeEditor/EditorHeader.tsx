"use client";

import { Redo2, Undo2 } from "lucide-react";
import React from "react";
import { CopyButton } from "./CopyButton";

interface EditorHeaderProps {
  filename: string;
  code: string;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  filename,
  code,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}) => {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-background-editor-header border-b border-accent">
      <span className="text-xs text-muted-foreground font-mono">
        {filename}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo"
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Undo2 size={14} />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo"
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Redo2 size={14} />
        </button>
        <CopyButton text={code} />
      </div>
    </div>
  );
};
