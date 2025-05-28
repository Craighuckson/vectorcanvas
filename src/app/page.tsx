
"use client";

import React, { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { v4 as uuidv4 } from 'uuid';
import { KonvaEventObject } from 'konva/lib/Node';
import type { Stage } from 'konva/lib/Stage';

import type { Shape, Tool, CanvasState, HistoryEntry, ShapeTool } from '@/lib/types';
import { useCanvasHistory } from '@/hooks/useCanvasHistory';
import Toolbar from '@/components/vector-canvas/Toolbar';
// import KonvaCanvas from '@/components/vector-canvas/KonvaCanvas'; // Original import
import PropertiesPanel from '@/components/vector-canvas/PropertiesPanel';
import { Button } from '@/components/ui/button';
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
const initialDefaultFillColor = '#A3E47F'; // Accent color
const initialDefaultStrokeColor = '#46B3AC'; // Primary color
const initialDefaultStrokeWidth = 2;
const initialCurrentLineStyle = 'solid' as const;


const initialHistoryEntry: HistoryEntry = {
  shapes: initialShapes,
  selectedShapeIds: initialSelectedShapeIds,
};

export default function VectorCanvasPage() {
  const [shapes, setShapes] = useState<Shape[]>(initialShapes);
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>(initialSelectedShapeIds);
  const [currentTool, setCurrentTool] = useState<Tool>(initialTool);
  const [defaultFillColor, setDefaultFillColor] = useState<string>(initialDefaultFillColor);
  const [defaultStrokeColor, setDefaultStrokeColor] = useState<string>(initialDefaultStrokeColor);
  const [defaultStrokeWidth, setDefaultStrokeWidth] = useState<number>(initialDefaultStrokeWidth);
  const [currentLineStyle, setCurrentLineStyle] = useState<'solid' | 'dashed' | 'dotted'>(initialCurrentLineStyle);
  
  const stageRef = React.useRef<Stage | null>(null);
  const { toast } = useToast();

  const { currentHistory, setHistory, undo, redo, canUndo, canRedo, resetHistory } = useCanvasHistory(initialHistoryEntry);

  useEffect(() => {
    if (currentHistory) {
      setShapes(currentHistory.shapes);
      setSelectedShapeIds(currentHistory.selectedShapeIds);
    }
  }, [currentHistory]);

  const updateStateAndHistory = useCallback((newShapes: Shape[], newSelectedShapeIds: string[]) => {
    setShapes(newShapes);
    setSelectedShapeIds(newSelectedShapeIds);
    setHistory({ shapes: newShapes, selectedShapeIds: newSelectedShapeIds });
  }, [setHistory, currentIndex]); // Added currentIndex to dependencies as setHistory uses it

  const handleAddShape = (shape: Shape) => {
    const newShapes = [...shapes, shape];
    updateStateAndHistory(newShapes, [shape.id]);
  };

  const handleUpdateShapes = (updatedShapes: Shape[]) => {
    updateStateAndHistory(updatedShapes, selectedShapeIds);
  };
  
  const handleUpdateSingleShape = (updatedShape: Shape) => {
    const newShapes = shapes.map(s => s.id === updatedShape.id ? updatedShape : s);
    updateStateAndHistory(newShapes, selectedShapeIds.includes(updatedShape.id) ? selectedShapeIds : [updatedShape.id]);
  };

  const handleUndo = () => {
    const prevState = undo();
    if (prevState) {
      // setShapes(prevState.shapes); // Managed by useEffect on currentHistory
      // setSelectedShapeIds(prevState.selectedShapeIds); // Managed by useEffect on currentHistory
    }
  };

  const handleRedo = () => {
    const nextState = redo();
    if (nextState) {
      // setShapes(nextState.shapes); // Managed by useEffect on currentHistory
      // setSelectedShapeIds(nextState.selectedShapeIds); // Managed by useEffect on currentHistory
    }
  };

  const handleExport = () => {
    if (!stageRef.current) {
      toast({ title: "Error", description: "Canvas not ready for export.", variant: "destructive" });
      return;
    }
    const json = JSON.stringify({ shapes, viewParams: { x: stageRef.current.x(), y: stageRef.current.y(), scale: stageRef.current.scaleX() } }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vector-canvas.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "Drawing saved as vector-canvas.json" });
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);
          if (data.shapes && Array.isArray(data.shapes)) {
            const newShapes = data.shapes as Shape[];
            // Basic validation could be added here for each shape
            resetHistory({ shapes: newShapes, selectedShapeIds: [] }); // This will trigger useEffect to update local state
            if(stageRef.current && data.viewParams) {
              stageRef.current.x(data.viewParams.x || 0);
              stageRef.current.y(data.viewParams.y || 0);
              stageRef.current.scaleX(data.viewParams.scale || 1);
              stageRef.current.scaleY(data.viewParams.scale || 1);
              stageRef.current.batchDraw();
            }
            toast({ title: "Imported", description: "Drawing loaded successfully." });
          } else {
            throw new Error("Invalid file format.");
          }
        } catch (error) {
          console.error("Import error:", error);
          toast({ title: "Import Error", description: (error as Error).message || "Could not load file.", variant: "destructive" });
        }
      };
      reader.readAsText(file);
      event.target.value = ''; // Reset file input
    }
  };
  
  const getDashArray = () => {
    if (currentLineStyle === 'dashed') return [10, 5];
    if (currentLineStyle === 'dotted') return [defaultStrokeWidth < 1 ? 1 : defaultStrokeWidth, (defaultStrokeWidth < 1 ? 1 : defaultStrokeWidth) * 1.5];
    return [];
  };

  const selectedShapesObjects = shapes.filter(shape => selectedShapeIds.includes(shape.id));
  
  // Need to get currentIndex for the dependency array of updateStateAndHistory
  // This is a bit of a workaround to access the currentIndex from the hook without exposing it.
  const { currentIndex } = useCanvasHistory(initialHistoryEntry);


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
        onUndo={handleUndo}
        canUndo={canUndo}
        onRedo={handleRedo}
        canRedo={canRedo}
        onExport={handleExport}
        onImport={handleImport}
      />
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 relative bg-muted/30 border-r border-border">
          <DynamicKonvaCanvas
            stageRef={stageRef}
            shapes={shapes}
            selectedShapeIds={selectedShapeIds}
            setSelectedShapeIds={(ids) => updateStateAndHistory(shapes, ids)}
            onUpdateShapes={handleUpdateShapes}
            onUpdateSingleShape={handleUpdateSingleShape}
            currentTool={currentTool}
            defaultFillColor={defaultFillColor}
            defaultStrokeColor={defaultStrokeColor}
            defaultStrokeWidth={defaultStrokeWidth}
            dashArray={getDashArray()}
            onAddShape={handleAddShape}
          />
        </div>
        <PropertiesPanel
          selectedShapes={selectedShapesObjects}
          onUpdateShape={(updatedShape) => {
            const newShapes = shapes.map(s => s.id === updatedShape.id ? updatedShape : s);
            updateStateAndHistory(newShapes, selectedShapeIds);
          }}
        />
      </div>
    </div>
  );
}

