
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HelpCircle } from "lucide-react";

const shortcuts = [
  { key: "Ctrl/Cmd + Z", description: "Undo last action" },
  { key: "Ctrl/Cmd + Y (or Shift + Ctrl/Cmd + Z)", description: "Redo last action" },
  { key: "Ctrl/Cmd + G", description: "Group selected shapes" },
  { key: "Ctrl/Cmd + Shift + G", description: "Ungroup selected group" },
  { key: "Delete / Backspace", description: "Delete selected shapes (not while typing in properties)" },
  { key: "Ctrl/Cmd + Click Shape", description: "Add/Remove shape from current selection (Multi-select)" },
  { key: "Drag on Empty Canvas", description: "Marquee select multiple shapes (with Select tool)" },
  { key: "Escape / Enter", description: "Finish drawing Polyline or Polygon" },
  { key: "Escape", description: "Cancel stamp placement mode" },
  { key: "Double Click (Line/Poly/Polygon)", description: "Toggle vertex edit mode (with Select tool)" },
];

export function KeyboardShortcutsHelp() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Help & Shortcuts">
          <HelpCircle className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts & Tips</DialogTitle>
          <DialogDescription>
            Enhance your workflow with these handy shortcuts.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-6">
          <div className="grid gap-4 py-4">
            {shortcuts.map((shortcut, index) => (
              <div key={index} className="grid grid-cols-[200px_1fr] items-start gap-3">
                <span className="text-sm font-medium text-right">{shortcut.key}</span>
                <span className="text-sm text-muted-foreground">{shortcut.description}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
