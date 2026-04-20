"use client";

import { Check, Redo2, Save, Undo2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { CopyButton } from "./CopyButton";

interface EditorHeaderProps {
  filename: string;
  code: string;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  hasUnsavedEdits?: boolean;
  onSave?: () => void | Promise<void>;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  filename,
  code,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  hasUnsavedEdits = false,
  onSave,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setJustSaved(false), 1500);
    return () => clearTimeout(t);
  }, [justSaved]);

  const handleSave = async () => {
    if (!onSave || isSaving) return;
    setIsSaving(true);
    try {
      await onSave();
      setJustSaved(true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-background-editor-header border-b border-accent">
      <span className="text-xs text-muted-foreground font-mono">
        {filename}
        {hasUnsavedEdits && !justSaved && (
          <span className="ml-2 text-primary">• unsaved</span>
        )}
      </span>
      <div className="flex items-center gap-1">
        {onSave && (
          <button
            onClick={handleSave}
            disabled={(!hasUnsavedEdits && !justSaved) || isSaving}
            title={justSaved ? "Saved" : "Save manual edits"}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {justSaved ? <Check size={14} className="text-primary" /> : <Save size={14} />}
          </button>
        )}
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
