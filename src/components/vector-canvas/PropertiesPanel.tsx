
"use client";

import React from 'react';
import type { Shape, RectangleShape, EllipseShape, LineShape } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PropertiesPanelProps {
  selectedShapes: Shape[];
  onUpdateShape: (updatedShape: Shape) => void;
}

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

  const commonProperties = selectedShapes.length === 1 ? selectedShapes[0] : null;

  const handleInputChange = (
    id: string,
    field: keyof Shape,
    value: string | number | number[] | undefined
  ) => {
    const shapeToUpdate = selectedShapes.find(s => s.id === id);
    if (shapeToUpdate) {
      let numericValue = value;
      if (typeof value === 'string' && (field === 'x' || field === 'y' || field === 'width' || field === 'height' || field === 'strokeWidth' || field === 'rotation')) {
         numericValue = parseFloat(value) || 0;
      }
      if (field === 'dash' && typeof value === 'string') {
        numericValue = value.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
      }
      onUpdateShape({ ...shapeToUpdate, [field]: numericValue });
    }
  };
  
  const renderShapeProperties = (shape: Shape) => {
    return (
      <div key={shape.id} className="space-y-3">
        <p className="text-sm font-medium capitalize text-primary">{shape.type} ({shape.id.substring(0,6)})</p>
        <div className="grid grid-cols-2 gap-2 items-center">
          <Label htmlFor={`x-${shape.id}`} className="text-xs">X</Label>
          <Input
            id={`x-${shape.id}`}
            type="number"
            value={shape.x.toFixed(0)}
            onChange={(e) => handleInputChange(shape.id, 'x', e.target.value)}
            className="h-8 text-xs"
          />
          <Label htmlFor={`y-${shape.id}`} className="text-xs">Y</Label>
          <Input
            id={`y-${shape.id}`}
            type="number"
            value={shape.y.toFixed(0)}
            onChange={(e) => handleInputChange(shape.id, 'y', e.target.value)}
            className="h-8 text-xs"
          />
        </div>

        {(shape.type === 'rectangle' || shape.type === 'ellipse') && (
          <div className="grid grid-cols-2 gap-2 items-center">
            <Label htmlFor={`width-${shape.id}`} className="text-xs">Width</Label>
            <Input
              id={`width-${shape.id}`}
              type="number"
              value={(shape as RectangleShape | EllipseShape).width.toFixed(0)}
              onChange={(e) => handleInputChange(shape.id, 'width', e.target.value)}
              className="h-8 text-xs"
            />
            <Label htmlFor={`height-${shape.id}`} className="text-xs">Height</Label>
            <Input
              id={`height-${shape.id}`}
              type="number"
              value={(shape as RectangleShape | EllipseShape).height.toFixed(0)}
              onChange={(e) => handleInputChange(shape.id, 'height', e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor={`fill-${shape.id}`} className="text-xs">Fill</Label>
          <Input
            id={`fill-${shape.id}`}
            type="color"
            value={shape.fill || '#000000'}
            onChange={(e) => handleInputChange(shape.id, 'fill', e.target.value)}
            className="h-8 w-full p-1"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`stroke-${shape.id}`} className="text-xs">Stroke</Label>
          <Input
            id={`stroke-${shape.id}`}
            type="color"
            value={shape.stroke || '#000000'}
            onChange={(e) => handleInputChange(shape.id, 'stroke', e.target.value)}
            className="h-8 w-full p-1"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 items-center">
          <Label htmlFor={`strokeWidth-${shape.id}`} className="text-xs">Stroke Width</Label>
          <Input
            id={`strokeWidth-${shape.id}`}
            type="number"
            min="0"
            value={shape.strokeWidth || 0}
            onChange={(e) => handleInputChange(shape.id, 'strokeWidth', e.target.value)}
            className="h-8 text-xs"
          />
          <Label htmlFor={`rotation-${shape.id}`} className="text-xs">Rotation</Label>
          <Input
            id={`rotation-${shape.id}`}
            type="number"
            value={(shape.rotation || 0).toFixed(0)}
            onChange={(e) => handleInputChange(shape.id, 'rotation', e.target.value)}
            className="h-8 text-xs"
          />
        </div>
         <div className="space-y-1">
          <Label htmlFor={`dash-${shape.id}`} className="text-xs">Dash Array (e.g., 10,5)</Label>
          <Input
            id={`dash-${shape.id}`}
            type="text"
            placeholder="e.g. 10,5"
            value={(shape.dash || []).join(',')}
            onChange={(e) => handleInputChange(shape.id, 'dash', e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <Separator className="my-3"/>
      </div>
    );
  };

  return (
    <aside className="w-72 bg-card p-4 border-l border-border flex flex-col">
      <CardHeader className="p-0 pb-4">
        <CardTitle className="text-lg">Properties</CardTitle>
        {selectedShapes.length > 1 && <p className="text-xs text-muted-foreground">{selectedShapes.length} items selected</p>}
      </CardHeader>
      <ScrollArea className="flex-1">
        <CardContent className="p-0 space-y-4">
          {selectedShapes.map(shape => renderShapeProperties(shape))}
        </CardContent>
      </ScrollArea>
    </aside>
  );
}

