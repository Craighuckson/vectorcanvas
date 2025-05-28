
"use client";

import React from 'react';
import type { Tool, ShapeTool } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import {
  MousePointer2,
  Square,
  Circle as EllipseIcon, // Renamed to avoid conflict
  Minus,
  Undo2,
  Redo2,
  Palette,
  Download,
  Upload,
  Pipette,
  ZoomIn, 
  ZoomOut,
  GripVertical
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ToolbarProps {
  currentTool: Tool;
  setCurrentTool: (tool: Tool) => void;
  defaultFillColor: string;
  setDefaultFillColor: (color: string) => void;
  defaultStrokeColor: string;
  setDefaultStrokeColor: (color: string) => void;
  defaultStrokeWidth: number;
  setDefaultStrokeWidth: (width: number) => void;
  currentLineStyle: 'solid' | 'dashed' | 'dotted';
  setCurrentLineStyle: (style: 'solid' | 'dashed' | 'dotted') => void;
  onUndo: () => void;
  canUndo: boolean;
  onRedo: () => void;
  canRedo: boolean;
  onExport: () => void;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const tools: { name: Tool; icon: React.ElementType; label: string }[] = [
  { name: 'select', icon: MousePointer2, label: 'Select' },
  { name: 'rectangle', icon: Square, label: 'Rectangle' },
  { name: 'ellipse', icon: EllipseIcon, label: 'Ellipse' },
  { name: 'line', icon: Minus, label: 'Line' },
];

export default function Toolbar({
  currentTool,
  setCurrentTool,
  defaultFillColor,
  setDefaultFillColor,
  defaultStrokeColor,
  setDefaultStrokeColor,
  defaultStrokeWidth,
  setDefaultStrokeWidth,
  currentLineStyle,
  setCurrentLineStyle,
  onUndo,
  canUndo,
  onRedo,
  canRedo,
  onExport,
  onImport,
}: ToolbarProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };
  
  return (
    <TooltipProvider>
      <header className="p-2 border-b border-border bg-card shadow-sm flex items-center space-x-2 h-16 shrink-0">
        {tools.map((tool) => (
          <Tooltip key={tool.name}>
            <TooltipTrigger asChild>
              <Button
                variant={currentTool === tool.name ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setCurrentTool(tool.name)}
                aria-label={tool.label}
              >
                <tool.icon className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{tool.label}</p>
            </TooltipContent>
          </Tooltip>
        ))}

        <Separator orientation="vertical" className="h-8" />

        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Fill Color">
                  <Pipette className="h-5 w-5" style={{ color: defaultFillColor }} />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent><p>Fill Color</p></TooltipContent>
          </Tooltip>
          <PopoverContent className="w-auto p-0">
            <div className="p-2">
              <Label htmlFor="fillColor" className="sr-only">Fill Color</Label>
              <Input
                id="fillColor"
                type="color"
                value={defaultFillColor}
                onChange={(e) => setDefaultFillColor(e.target.value)}
                className="h-10 w-20 p-1 border-none"
              />
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Stroke Color">
                  <Palette className="h-5 w-5" style={{ color: defaultStrokeColor }} />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent><p>Stroke Color</p></TooltipContent>
          </Tooltip>
          <PopoverContent className="w-auto p-0">
             <div className="p-2">
              <Label htmlFor="strokeColor" className="sr-only">Stroke Color</Label>
              <Input
                id="strokeColor"
                type="color"
                value={defaultStrokeColor}
                onChange={(e) => setDefaultStrokeColor(e.target.value)}
                className="h-10 w-20 p-1 border-none"
              />
            </div>
          </PopoverContent>
        </Popover>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center">
              <Input
                type="number"
                value={defaultStrokeWidth}
                onChange={(e) => setDefaultStrokeWidth(Math.max(1, parseInt(e.target.value, 10)))}
                className="h-9 w-16 text-sm px-2"
                min="1"
                aria-label="Stroke Width"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent><p>Stroke Width</p></TooltipContent>
        </Tooltip>

        <Select value={currentLineStyle} onValueChange={(value: 'solid' | 'dashed' | 'dotted') => setCurrentLineStyle(value)}>
          <Tooltip>
            <TooltipTrigger asChild>
              <SelectTrigger className="w-[100px] h-9 text-sm">
                <SelectValue placeholder="Line Style" />
              </SelectTrigger>
            </TooltipTrigger>
            <TooltipContent><p>Line Style</p></TooltipContent>
          </Tooltip>
          <SelectContent>
            <SelectItem value="solid">Solid</SelectItem>
            <SelectItem value="dashed">Dashed</SelectItem>
            <SelectItem value="dotted">Dotted</SelectItem>
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="h-8" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo} aria-label="Undo">
              <Undo2 className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Undo (Ctrl+Z)</p></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onRedo} disabled={!canRedo} aria-label="Redo">
              <Redo2 className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Redo (Ctrl+Y)</p></TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-8" />
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onExport} aria-label="Export JSON">
              <Download className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Export JSON</p></TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={handleImportClick} aria-label="Import JSON">
              <Upload className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Import JSON</p></TooltipContent>
        </Tooltip>
        <Input type="file" ref={fileInputRef} onChange={onImport} accept=".json" className="hidden" />
        
        {/* Placeholder for future tools like Grouping, Zoom */}
        {/* <Separator orientation="vertical" className="h-8" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" disabled><ZoomIn className="h-5 w-5" /></Button>
          </TooltipTrigger>
          <TooltipContent><p>Zoom In</p></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" disabled><ZoomOut className="h-5 w-5" /></Button>
          </TooltipTrigger>
          <TooltipContent><p>Zoom Out</p></TooltipContent>
        </Tooltip> */}
      </header>
    </TooltipProvider>
  );
}
