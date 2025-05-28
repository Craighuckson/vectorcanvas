
"use client";

import React from 'react';
import type { Shape, RectangleShape, EllipseShape, LineShape, PolylineShape, PolygonShape, TextShape, GroupShape } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


interface PropertiesPanelProps {
  selectedShapes: Shape[];
  onUpdateShape: (updatedShape: Shape) => void;
}

const commonFontFamilies = ["Arial", "Verdana", "Times New Roman", "Courier New", "Georgia", "Palatino", "Garamond", "Comic Sans MS", "Impact"];
const commonFontStyles = ["normal", "bold", "italic", "bold italic"];
const commonTextDecorations = ["", "underline", "line-through"];
const commonAlignments = ["left", "center", "right"];
const commonVerticalAlignments = ["top", "middle", "bottom"];


export default function PropertiesPanel({ selectedShapes, onUpdateShape }: PropertiesPanelProps) {
  if (selectedShapes.length === 0) {
    return (
      <aside className="w-72 bg-card p-4 border-l border-border flex flex-col">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-lg">Properties</CardTitle>
        </CardHeader>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Select an object to see its properties.</p>
        </div>
      </aside>
    );
  }

  // For multi-select, only show common editable properties or indicate mixed values.
  // For simplicity, this example primarily focuses on single selection editing.
  const singleSelectedShape = selectedShapes.length === 1 ? selectedShapes[0] : null;

  const handleInputChange = (
    shapeId: string,
    field: keyof Shape | keyof TextShape, // Allow TextShape specific fields
    value: string | number | number[] | boolean | undefined
  ) => {
    const shapeToUpdate = selectedShapes.find(s => s.id === shapeId);
    if (shapeToUpdate) {
      let processedValue = value;
      if (typeof value === 'string') {
        if (['x', 'y', 'width', 'height', 'strokeWidth', 'rotation', 'opacity', 'fontSize', 'padding', 'lineHeight', 'letterSpacing'].includes(field as string)) {
           processedValue = parseFloat(value);
           if (isNaN(processedValue as number)) processedValue = (field === 'strokeWidth' || field === 'opacity') ? shapeToUpdate[field as keyof Shape] || 0 : 0; // Default to 0 or previous if invalid
        }
      }
      if (field === 'dash' && typeof value === 'string') {
        processedValue = value.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
      }
      
      onUpdateShape({ ...shapeToUpdate, [field]: processedValue });
    }
  };
  
  const renderShapeProperties = (shape: Shape) => {
    const id = shape.id;
    return (
      <div key={id} className="space-y-3">
        <p className="text-sm font-medium capitalize text-primary">{shape.type} ({id.substring(0,6)})</p>
        
        <div className="grid grid-cols-2 gap-2 items-center">
          <Label htmlFor={`x-${id}`} className="text-xs">X</Label>
          <Input id={`x-${id}`} type="number" value={(shape.x || 0).toFixed(0)} onChange={(e) => handleInputChange(id, 'x', e.target.value)} className="h-8 text-xs" />
          
          <Label htmlFor={`y-${id}`} className="text-xs">Y</Label>
          <Input id={`y-${id}`} type="number" value={(shape.y || 0).toFixed(0)} onChange={(e) => handleInputChange(id, 'y', e.target.value)} className="h-8 text-xs" />
        </div>

        {(shape.type === 'rectangle' || shape.type === 'ellipse' || shape.type === 'text' || shape.type === 'group') && shape.width !== undefined && shape.height !== undefined && (
          <div className="grid grid-cols-2 gap-2 items-center">
            <Label htmlFor={`width-${id}`} className="text-xs">Width</Label>
            <Input id={`width-${id}`} type="number" value={(shape.width || 0).toFixed(0)} onChange={(e) => handleInputChange(id, 'width', e.target.value)} className="h-8 text-xs" />
            
            <Label htmlFor={`height-${id}`} className="text-xs">Height</Label>
            <Input id={`height-${id}`} type="number" value={(shape.height || 0).toFixed(0)} onChange={(e) => handleInputChange(id, 'height', e.target.value)} className="h-8 text-xs" />
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-2 items-center">
            <Label htmlFor={`rotation-${id}`} className="text-xs">Rotation</Label>
            <Input id={`rotation-${id}`} type="number" step="0.1" value={(shape.rotation || 0).toFixed(1)} onChange={(e) => handleInputChange(id, 'rotation', e.target.value)} className="h-8 text-xs" />
            <Label htmlFor={`opacity-${id}`} className="text-xs">Opacity</Label>
            <Input id={`opacity-${id}`} type="number" min="0" max="1" step="0.01" value={(shape.opacity === undefined ? 1 : shape.opacity).toFixed(2)} onChange={(e) => handleInputChange(id, 'opacity', e.target.value)} className="h-8 text-xs" />
        </div>


        {shape.type !== 'group' && ( // Groups usually don't have their own fill/stroke, but their children do
          <>
            <div className="space-y-1">
              <Label htmlFor={`fill-${id}`} className="text-xs">Fill Color</Label>
              <Input id={`fill-${id}`} type="color" value={shape.fill || '#00000000'} onChange={(e) => handleInputChange(id, 'fill', e.target.value)} className="h-8 w-full p-1" />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`stroke-${id}`} className="text-xs">Stroke Color</Label>
              <Input id={`stroke-${id}`} type="color" value={shape.stroke || '#000000'} onChange={(e) => handleInputChange(id, 'stroke', e.target.value)} className="h-8 w-full p-1" />
            </div>
            <div className="grid grid-cols-2 gap-2 items-center">
                <Label htmlFor={`strokeWidth-${id}`} className="text-xs">Stroke Width</Label>
                <Input id={`strokeWidth-${id}`} type="number" min="0" value={shape.strokeWidth || 0} onChange={(e) => handleInputChange(id, 'strokeWidth', e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`dash-${id}`} className="text-xs">Dash Array (e.g., 10,5)</Label>
              <Input id={`dash-${id}`} type="text" placeholder="e.g. 10,5" value={(shape.dash || []).join(',')} onChange={(e) => handleInputChange(id, 'dash', e.target.value)} className="h-8 text-xs" />
            </div>
          </>
        )}

        {shape.type === 'text' && (
          <>
            <Separator />
            <p className="text-xs font-medium mt-2">Text Properties</p>
            <div className="space-y-1">
                <Label htmlFor={`text-${id}`} className="text-xs">Content</Label>
                <Textarea id={`text-${id}`} value={(shape as TextShape).text} onChange={(e) => handleInputChange(id, 'text', e.target.value)} className="text-xs" rows={2}/>
            </div>
            <div className="grid grid-cols-2 gap-2 items-center">
                <Label htmlFor={`fontSize-${id}`} className="text-xs">Font Size</Label>
                <Input id={`fontSize-${id}`} type="number" min="1" value={(shape as TextShape).fontSize || 12} onChange={(e) => handleInputChange(id, 'fontSize', e.target.value)} className="h-8 text-xs" />
                
                <Label htmlFor={`fontFamily-${id}`} className="text-xs">Font Family</Label>
                <Select value={(shape as TextShape).fontFamily || 'Arial'} onValueChange={(val) => handleInputChange(id, 'fontFamily', val)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {commonFontFamilies.map(fam => <SelectItem key={fam} value={fam} className="text-xs">{fam}</SelectItem>)}
                    </SelectContent>
                </Select>

                <Label htmlFor={`fontStyle-${id}`} className="text-xs">Font Style</Label>
                <Select value={(shape as TextShape).fontStyle || 'normal'} onValueChange={(val) => handleInputChange(id, 'fontStyle', val)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {commonFontStyles.map(style => <SelectItem key={style} value={style} className="text-xs">{style}</SelectItem>)}
                    </SelectContent>
                </Select>

                <Label htmlFor={`textDecoration-${id}`} className="text-xs">Decoration</Label>
                <Select value={(shape as TextShape).textDecoration || ''} onValueChange={(val) => handleInputChange(id, 'textDecoration', val)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                        {commonTextDecorations.map(deco => <SelectItem key={deco} value={deco} className="text-xs">{deco || 'None'}</SelectItem>)}
                    </SelectContent>
                </Select>

                <Label htmlFor={`align-${id}`} className="text-xs">Align</Label>
                <Select value={(shape as TextShape).align || 'left'} onValueChange={(val) => handleInputChange(id, 'align', val)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {commonAlignments.map(align => <SelectItem key={align} value={align} className="text-xs capitalize">{align}</SelectItem>)}
                    </SelectContent>
                </Select>

                 <Label htmlFor={`verticalAlign-${id}`} className="text-xs">Vert. Align</Label>
                <Select value={(shape as TextShape).verticalAlign || 'top'} onValueChange={(val) => handleInputChange(id, 'verticalAlign', val)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {commonVerticalAlignments.map(valign => <SelectItem key={valign} value={valign} className="text-xs capitalize">{valign}</SelectItem>)}
                    </SelectContent>
                </Select>

                <Label htmlFor={`padding-${id}`} className="text-xs">Padding</Label>
                <Input id={`padding-${id}`} type="number" min="0" value={(shape as TextShape).padding || 0} onChange={(e) => handleInputChange(id, 'padding', e.target.value)} className="h-8 text-xs" />

                <Label htmlFor={`lineHeight-${id}`} className="text-xs">Line Height</Label>
                <Input id={`lineHeight-${id}`} type="number" min="0" step="0.1" value={(shape as TextShape).lineHeight || 1.2} onChange={(e) => handleInputChange(id, 'lineHeight', e.target.value)} className="h-8 text-xs" />
            </div>
          </>
        )}
        
        {shape.type === 'polyline' && (
             <div className="space-y-1">
                <Label htmlFor={`points-${id}`} className="text-xs">Points (x1,y1,x2,y2...)</Label>
                <Textarea id={`points-${id}`} value={(shape as PolylineShape).points.join(',')} onChange={(e) => handleInputChange(id, 'points', e.target.value.split(',').map(p=>parseFloat(p.trim())).filter(p=>!isNaN(p)))} className="text-xs" rows={2}/>
            </div>
        )}
         {shape.type === 'polygon' && (
             <div className="space-y-1">
                <Label htmlFor={`points-${id}`} className="text-xs">Points (x1,y1,x2,y2...)</Label>
                <Textarea id={`points-${id}`} value={(shape as PolygonShape).points.join(',')} onChange={(e) => handleInputChange(id, 'points', e.target.value.split(',').map(p=>parseFloat(p.trim())).filter(p=>!isNaN(p)))} className="text-xs" rows={2}/>
            </div>
        )}


        <Separator className="my-3"/>
      </div>
    );
  };

  return (
    <aside className="w-72 bg-card p-4 border-l border-border flex flex-col">
      <CardHeader className="p-0 pb-4">
        <CardTitle className="text-lg">Properties</CardTitle>
        {selectedShapes.length > 1 && <CardDescription className="text-xs">{selectedShapes.length} items selected. Common properties can be edited.</CardDescription>}
      </CardHeader>
      <ScrollArea className="flex-1">
        <CardContent className="p-0 space-y-4">
          {/* If multiple selected, could show common properties or a message. For now, iterates or shows first. */}
          {/* Best for UX with multi-select is to identify common properties and allow batch editing. */}
          {singleSelectedShape ? renderShapeProperties(singleSelectedShape) : <p className="text-xs text-muted-foreground">Edit common properties or select a single item for detailed editing.</p>}
          {/* TODO: Add section for editing common properties if multiple shapes are selected */}
        </CardContent>
      </ScrollArea>
    </aside>
  );
}
