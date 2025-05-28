
"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { v4 as uuidv4 } from 'uuid';
import type Konva from 'konva';
import type { Stage as KonvaStageType } from 'konva/lib/Stage';

import type { Shape, Tool, HistoryEntry, GroupShape } from '@/lib/types';
import { useCanvasHistory } from '@/hooks/useCanvasHistory';
import Toolbar from '@/components/vector-canvas/Toolbar';
import PropertiesPanel from '@/components/vector-canvas/PropertiesPanel';
import { useToast } from '@/hooks/use-toast';

const DynamicKonvaCanvas = dynamic(
  () => import('@/components/vector-canvas/KonvaCanvas'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex-1 relative bg-muted/30 border-r border-border flex items-center justify-center">
        <p>Loading Canvas...</p>
      </div>
    )
  }
);

const initialShapes: Shape[] = [];
const initialSelectedShapeIds: string[] = [];
const initialTool: Tool = 'select';
const initialDefaultFillColor = '#A3E47F'; 
const initialDefaultStrokeColor = '#46B3AC';
const initialDefaultStrokeWidth = 2;
const initialCurrentLineStyle = 'solid' as const;

const initialHistoryEntry: HistoryEntry = {
  shapes: initialShapes,
  selectedShapeIds: initialSelectedShapeIds,
};

export default function VectorCanvasClient() {
  const [shapes, setShapes] = useState<Shape[]>(initialShapes);
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>(initialSelectedShapeIds);
  const [currentTool, setCurrentTool] = useState<Tool>(initialTool);
  const [defaultFillColor, setDefaultFillColor] = useState<string>(initialDefaultFillColor);
  const [defaultStrokeColor, setDefaultStrokeColor] = useState<string>(initialDefaultStrokeColor);
  const [defaultStrokeWidth, setDefaultStrokeWidth] = useState<number>(initialDefaultStrokeWidth);
  const [currentLineStyle, setCurrentLineStyle] = useState<'solid' | 'dashed' | 'dotted'>(initialCurrentLineStyle);
  
  const stageRef = useRef<KonvaStageType | null>(null);
  const { toast } = useToast();

  const { currentHistory, setHistory, undo, redo, canUndo, canRedo, resetHistory } = useCanvasHistory(initialHistoryEntry);

  const updateStateAndHistory = useCallback((newShapes: Shape[], newSelectedShapeIds: string[]) => {
    setShapes(newShapes);
    setSelectedShapeIds(newSelectedShapeIds);
    setHistory({ shapes: newShapes, selectedShapeIds: newSelectedShapeIds });
  }, [setHistory]);

  const handleAddShape = useCallback((shape: Shape) => {
    const newShapes = [...shapes, shape];
    updateStateAndHistory(newShapes, [shape.id]);
  }, [shapes, updateStateAndHistory]);
  
  const handleUpdateSingleShape = useCallback((updatedShape: Shape) => {
    const newShapes = shapes.map(s => s.id === updatedShape.id ? updatedShape : s);
    updateStateAndHistory(newShapes, selectedShapeIds.includes(updatedShape.id) ? selectedShapeIds : [updatedShape.id]);
  }, [shapes, selectedShapeIds, updateStateAndHistory]);

  const localHandleDeleteSelected = useCallback(() => {
    if (selectedShapeIds.length === 0) return;
    const newShapes = shapes.filter(shape => !selectedShapeIds.includes(shape.id));
    updateStateAndHistory(newShapes, []);
    toast({ title: "Deleted", description: `${selectedShapeIds.length} item(s) removed.`});
  }, [shapes, selectedShapeIds, updateStateAndHistory, toast]);

  const localHandleGroup = useCallback(() => {
    if (selectedShapeIds.length < 2) {
      toast({ title: "Grouping Error", description: "Select at least two shapes to group.", variant: "destructive"});
      return;
    }
    const shapesToGroup = shapes.filter(s => selectedShapeIds.includes(s.id));
    const remainingShapes = shapes.filter(s => !selectedShapeIds.includes(s.id));

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    shapesToGroup.forEach(s => {
        const sMaxX = (s.x || 0) + (s.width || 0) * (s.scaleX || 1);
        const sMaxY = (s.y || 0) + (s.height || 0) * (s.scaleY || 1);
        minX = Math.min(minX, s.x || 0);
        minY = Math.min(minY, s.y || 0);
        maxX = Math.max(maxX, sMaxX);
        maxY = Math.max(maxY, sMaxY);
    });

    const group: GroupShape = {
      id: uuidv4(),
      type: 'group',
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      children: shapesToGroup.map(s => ({...s, x: (s.x || 0) - minX, y: (s.y || 0) - minY})),
      draggable: true,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    };
    const newShapes = [...remainingShapes, group];
    updateStateAndHistory(newShapes, [group.id]);
    toast({ title: "Grouped", description: `${shapesToGroup.length} items grouped.`});
  }, [shapes, selectedShapeIds, updateStateAndHistory, toast]);

  const handleUngroup = useCallback(() => {
    if (selectedShapeIds.length !== 1) {
        toast({ title: "Ungrouping Error", description: "Select a single group to ungroup.", variant: "destructive"});
        return;
    }
    const groupToUngroup = shapes.find(s => s.id === selectedShapeIds[0] && s.type === 'group') as GroupShape | undefined;
    if (!groupToUngroup) {
        toast({ title: "Ungrouping Error", description: "Selected item is not a group.", variant: "destructive"});
        return;
    }
    const remainingShapes = shapes.filter(s => s.id !== groupToUngroup.id);
    const ungroupedChildren = groupToUngroup.children.map(child => ({
        ...child,
        x: (child.x || 0) + (groupToUngroup.x || 0),
        y: (child.y || 0) + (groupToUngroup.y || 0),
    }));
    const newShapes = [...remainingShapes, ...ungroupedChildren];
    updateStateAndHistory(newShapes, ungroupedChildren.map(c => c.id));
    toast({ title: "Ungrouped", description: "Group disbanded."});
  }, [shapes, selectedShapeIds, updateStateAndHistory, toast]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        if (event.key === 'z') {
          event.preventDefault();
          undo();
        } else if (event.key === 'y' || (event.key === 'Z' && event.shiftKey)) {
          event.preventDefault();
          redo();
        } else if (event.key === 'g') {
          event.preventDefault();
          localHandleGroup();
        }
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        localHandleDeleteSelected();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, localHandleGroup, localHandleDeleteSelected]);

  useEffect(() => {
    if (currentHistory) {
      setShapes(currentHistory.shapes);
      setSelectedShapeIds(currentHistory.selectedShapeIds);
    }
  }, [currentHistory]);

  const handleExportJson = useCallback(() => {
    if (!stageRef.current) {
      toast({ title: "Error", description: "Canvas not ready for export.", variant: "destructive" });
      return;
    }
    const exportData = {
      shapes,
      viewParams: {
        x: stageRef.current.x(),
        y: stageRef.current.y(),
        scale: stageRef.current.scaleX(),
      }
    };
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vector-canvas-drawing.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "Drawing saved as vector-canvas-drawing.json" });
  }, [shapes, stageRef, toast]);

  const handleImportJson = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);
          if (data.shapes && Array.isArray(data.shapes)) {
            const newShapes = data.shapes as Shape[];
            resetHistory({ shapes: newShapes, selectedShapeIds: [] }); 
            
            if(stageRef.current && data.viewParams) {
              stageRef.current.x(data.viewParams.x || 0);
              stageRef.current.y(data.viewParams.y || 0);
              stageRef.current.scaleX(data.viewParams.scale || 1);
              stageRef.current.scaleY(data.viewParams.scale || 1);
              stageRef.current.batchDraw();
            }
            toast({ title: "Imported", description: "Drawing loaded successfully." });
          } else {
            throw new Error("Invalid file format. Missing 'shapes' array.");
          }
        } catch (error) {
          console.error("Import error:", error);
          toast({ title: "Import Error", description: (error as Error).message || "Could not load file.", variant: "destructive" });
        }
      };
      reader.readAsText(file);
      event.target.value = ''; 
    }
  }, [resetHistory, stageRef, toast]);

  const handleSaveAsPng = useCallback(() => {
    if (!stageRef.current) {
      toast({ title: "Error", description: "Canvas not ready.", variant: "destructive" });
      return;
    }
    const transformerNode = stageRef.current.findOne('Transformer');
    const transformerWasVisible = transformerNode?.isVisible();
    if (transformerNode) transformerNode.visible(false);
    stageRef.current.batchDraw();

    const dataURL = stageRef.current.toDataURL({ mimeType: 'image/png', quality: 1, pixelRatio: 2 });
    
    if (transformerNode && transformerWasVisible) transformerNode.visible(true); 
    stageRef.current.batchDraw();

    const a = document.createElement('a');
    a.href = dataURL;
    a.download = 'vector-canvas-drawing.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast({ title: "Saved as PNG", description: "Drawing exported as PNG." });
  }, [stageRef, toast]);
  
  const getDashArray = useCallback(() => {
    if (currentLineStyle === 'dashed') return [10, 5];
    if (currentLineStyle === 'dotted') return [defaultStrokeWidth < 1 ? 1 : defaultStrokeWidth, (defaultStrokeWidth < 1 ? 1 : defaultStrokeWidth) * 2];
    return [];
  }, [currentLineStyle, defaultStrokeWidth]);

  const selectedShapesObjects = shapes.filter(shape => selectedShapeIds.includes(shape.id));
  
  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <Toolbar
        currentTool={currentTool}
        setCurrentTool={setCurrentTool}
        defaultFillColor={defaultFillColor}
        setDefaultFillColor={setDefaultFillColor}
        defaultStrokeColor={defaultStrokeColor}
        setDefaultStrokeColor={setDefaultStrokeColor}
        defaultStrokeWidth={defaultStrokeWidth}
        setDefaultStrokeWidth={setDefaultStrokeWidth}
        currentLineStyle={currentLineStyle}
        setCurrentLineStyle={setCurrentLineStyle}
        onUndo={undo}
        canUndo={canUndo}
        onRedo={redo}
        canRedo={canRedo}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onSaveAsPng={handleSaveAsPng}
        onGroup={localHandleGroup}
        onUngroup={handleUngroup}
        selectedShapesCount={selectedShapeIds.length}
      />
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 relative bg-muted/30 border-r border-border">
          <DynamicKonvaCanvas
            stageRef={stageRef}
            shapes={shapes}
            selectedShapeIds={selectedShapeIds}
            setSelectedShapeIds={(ids) => updateStateAndHistory(shapes, ids)} 
            onUpdateShapes={(updatedShapes) => updateStateAndHistory(updatedShapes, selectedShapeIds)} 
            onUpdateSingleShape={handleUpdateSingleShape}
            onAddShape={handleAddShape}
            currentTool={currentTool}
            defaultFillColor={defaultFillColor}
            defaultStrokeColor={defaultStrokeColor}
            defaultStrokeWidth={defaultStrokeWidth}
            dashArray={getDashArray()}
          />
        </div>
        <PropertiesPanel
          selectedShapes={selectedShapesObjects}
          onUpdateShape={handleUpdateSingleShape}
        />
      </div>
    </div>
  );
}
