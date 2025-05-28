
"use client";

import React, { useState } from 'react';
import type { Tool, Template } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MousePointer2,
  Square,
  Circle as EllipseIcon,
  Minus, // Line
  Spline, // Polyline
  Hexagon, // Polygon
  Type as TextIcon, // Text
  Stamp as StampIcon,
  Group as GroupIcon,
  Ungroup as UngroupIcon,
  Undo2,
  Redo2,
  Palette, // Stroke Color
  Pipette, // Fill Color
  Download, // Export JSON
  Upload, // Import JSON
  ImageDown, // Save as PNG
  Maximize, // Canvas Size Icon
  Trash2, // Delete Stamp
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
  onExportJson: () => void;
  onImportJson: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSaveAsPng: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  selectedShapesCount: number;
  isSingleGroupSelected: boolean; // New prop
  canvasWidth: number;
  setCanvasWidth: (width: number) => void;
  canvasHeight: number;
  setCanvasHeight: (height: number) => void;
  onSaveStamp: (name: string) => void;
  onLoadStamp: (templateId: string) => void;
  onDeleteStamp: (templateId: string) => void;
  savedStamps: Template[];
}

const tools: { name: Tool; icon: React.ElementType; label: string; type: 'shape' | 'action' }[] = [
  { name: 'select', icon: MousePointer2, label: 'Select', type: 'action' },
  { name: 'rectangle', icon: Square, label: 'Rectangle', type: 'shape' },
  { name: 'ellipse', icon: EllipseIcon, label: 'Ellipse', type: 'shape' },
  { name: 'line', icon: Minus, label: 'Line', type: 'shape' },
  { name: 'polyline', icon: Spline, label: 'Polyline', type: 'shape' },
  { name: 'polygon', icon: Hexagon, label: 'Polygon', type: 'shape' },
  { name: 'text', icon: TextIcon, label: 'Text', type: 'shape' },
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
  onExportJson,
  onImportJson,
  onSaveAsPng,
  onGroup,
  onUngroup,
  selectedShapesCount,
  isSingleGroupSelected, // Use new prop
  canvasWidth,
  setCanvasWidth,
  canvasHeight,
  setCanvasHeight,
  onSaveStamp,
  onLoadStamp,
  onDeleteStamp,
  savedStamps,
}: ToolbarProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [stampName, setStampName] = useState('');
  const [stampPopoverOpen, setStampPopoverOpen] = useState(false);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleSaveStampClick = () => {
    if (stampName.trim()) {
      onSaveStamp(stampName.trim());
      setStampName(''); 
    }
  };

  const handleLoadStampClick = (templateId: string) => {
    onLoadStamp(templateId);
    setStampPopoverOpen(false); 
  };
  
  return (
    <TooltipProvider>
      <header className="p-2 border-b border-border bg-card shadow-sm flex items-center space-x-1 h-16 shrink-0 overflow-x-auto">
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

        <Popover open={stampPopoverOpen} onOpenChange={setStampPopoverOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button variant={currentTool === 'stamp' ? 'secondary' : 'ghost'} size="icon" aria-label="Stamps">
                  <StampIcon className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent><p>Manage & Use Stamps</p></TooltipContent>
          </Tooltip>
          <PopoverContent className="w-64 p-4 space-y-3">
            <div>
              <Label htmlFor="stampName" className="text-xs">New Stamp Name</Label>
              <div className="flex space-x-2 mt-1">
                <Input 
                  id="stampName" 
                  value={stampName} 
                  onChange={(e) => setStampName(e.target.value)} 
                  placeholder="e.g., My Icon"
                  className="h-8 text-xs"
                />
                <Button onClick={handleSaveStampClick} size="sm" disabled={selectedShapesCount === 0 || !stampName.trim()} className="text-xs h-8">Save Sel.</Button>
              </div>
            </div>
            <Separator />
            <Label className="text-xs">Load Stamp</Label>
            {savedStamps.length === 0 ? (
              <p className="text-xs text-muted-foreground">No stamps saved yet.</p>
            ) : (
              <ScrollArea className="h-[150px]">
                <div className="space-y-1">
                {savedStamps.map((stamp) => (
                  <div key={stamp.id} className="flex items-center justify-between">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-xs h-8 px-2"
                      onClick={() => handleLoadStampClick(stamp.id)}
                    >
                      {stamp.name}
                    </Button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => onDeleteStamp(stamp.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Delete Stamp</p></TooltipContent>
                    </Tooltip>
                  </div>
                ))}
                </div>
              </ScrollArea>
            )}
          </PopoverContent>
        </Popover>


        <Separator orientation="vertical" className="h-8 mx-1" />

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
                onChange={(e) => setDefaultStrokeWidth(Math.max(0, parseInt(e.target.value, 10)))}
                className="h-9 w-16 text-sm px-2"
                min="0"
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

        <Separator orientation="vertical" className="h-8 mx-1" />
        
        <Popover>
            <Tooltip>
                <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Canvas Size">
                            <Maximize className="h-5 w-5" />
                        </Button>
                    </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent><p>Canvas Size (for Export)</p></TooltipContent>
            </Tooltip>
            <PopoverContent className="w-64 p-4 space-y-2">
                <div className="grid grid-cols-2 items-center gap-2">
                    <Label htmlFor="canvasWidth" className="text-xs">Width (px)</Label>
                    <Input
                        id="canvasWidth"
                        type="number"
                        value={canvasWidth}
                        onChange={(e) => setCanvasWidth(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="h-8 text-xs"
                        min="1"
                    />
                </div>
                <div className="grid grid-cols-2 items-center gap-2">
                    <Label htmlFor="canvasHeight" className="text-xs">Height (px)</Label>
                    <Input
                        id="canvasHeight"
                        type="number"
                        value={canvasHeight}
                        onChange={(e) => setCanvasHeight(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="h-8 text-xs"
                        min="1"
                    />
                </div>
            </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="h-8 mx-1" />


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

        <Separator orientation="vertical" className="h-8 mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onGroup} disabled={selectedShapesCount < 2} aria-label="Group">
              <GroupIcon className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Group (Ctrl+G)</p></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onUngroup} disabled={!isSingleGroupSelected} aria-label="Ungroup">
              <UngroupIcon className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Ungroup (Ctrl+Shift+G)</p></TooltipContent>
        </Tooltip>
        
        <Separator orientation="vertical" className="h-8 mx-1" />
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onExportJson} aria-label="Export JSON">
              <Download className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Export Drawing (JSON)</p></TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={handleImportClick} aria-label="Import JSON">
              <Upload className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Import Drawing (JSON)</p></TooltipContent>
        </Tooltip>
        <Input type="file" ref={fileInputRef} onChange={onImportJson} accept=".json" className="hidden" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onSaveAsPng} aria-label="Save as PNG">
              <ImageDown className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Save as PNG</p></TooltipContent>
        </Tooltip>

      </header>
    </TooltipProvider>
  );
}
