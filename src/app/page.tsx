
"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { v4 as uuidv4 } from 'uuid';
import type Konva from 'konva';
import type { Stage as KonvaStageType } from 'konva/lib/Stage';

import type { Shape, Tool, HistoryEntry, GroupShape, ShapeType } from '@/lib/types';
import { useCanvasHistory } from '@/hooks/useCanvasHistory';
import Toolbar from '@/components/vector-canvas/Toolbar';
import PropertiesPanel from '@/components/vector-canvas/PropertiesPanel';
// import { Button } from '@/components/ui/button'; // Potentially for other UI elements
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

export default function VectorCanvasPage() {
  const [isClient, setIsClient] = useState(false);
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

  useEffect(() => {
    setIsClient(true);
    // Keyboard shortcuts
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        if (event.key === 'z') {
          event.preventDefault();
          handleUndo();
        } else if (event.key === 'y' || (event.key === 'Z' && event.shiftKey)) {
          event.preventDefault();
          handleRedo();
        } else if (event.key === 'g') {
          event.preventDefault();
          handleGroup();
        }
        // Add more shortcuts like Ctrl+Shift+G for ungroup
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        handleDeleteSelected();
      } else if (event.key === 'Escape') {
        //setCurrentTool('select'); // Revert to select tool
        // Or cancel current drawing operation if any
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]); // Add other handlers if they become stable

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
  }, [setHistory]);

  const handleAddShape = (shape: Shape) => {
    const newShapes = [...shapes, shape];
    updateStateAndHistory(newShapes, [shape.id]);
  };
  
  const handleUpdateSingleShape = (updatedShape: Shape) => {
    const newShapes = shapes.map(s => s.id === updatedShape.id ? updatedShape : s);
    // If the updated shape is part of a group, we might need to update the group instead/also
    // For now, direct update:
    updateStateAndHistory(newShapes, selectedShapeIds.includes(updatedShape.id) ? selectedShapeIds : [updatedShape.id]);
  };

  const handleDeleteSelected = () => {
    if (selectedShapeIds.length === 0) return;
    const newShapes = shapes.filter(shape => !selectedShapeIds.includes(shape.id));
    // TODO: Handle deleting shapes within groups. If a group is selected, delete the group.
    // If individual items within a group are "selected" (needs more complex selection logic), delete them from group.
    updateStateAndHistory(newShapes, []);
    toast({ title: "Deleted", description: `${selectedShapeIds.length} item(s) removed.`});
  };

  const handleGroup = () => {
    if (selectedShapeIds.length < 2) {
      toast({ title: "Grouping Error", description: "Select at least two shapes to group.", variant: "destructive"});
      return;
    }
    const shapesToGroup = shapes.filter(s => selectedShapeIds.includes(s.id));
    const remainingShapes = shapes.filter(s => !selectedShapeIds.includes(s.id));

    // Basic grouping: calculate bounding box for x,y. Width/height can be auto by Konva or calculated.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    shapesToGroup.forEach(s => {
        // This is a simplification. True bounding box needs to consider rotation and shape type.
        // Konva nodes have getClientRect() which is more accurate.
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
      children: shapesToGroup.map(s => ({...s, x: s.x - minX, y: s.y - minY})), // Adjust children's coords to be relative to group
      draggable: true,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    };
    const newShapes = [...remainingShapes, group];
    updateStateAndHistory(newShapes, [group.id]);
    toast({ title: "Grouped", description: `${shapesToGroup.length} items grouped.`});
  };

  const handleUngroup = () => {
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
        x: child.x + groupToUngroup.x, // Convert back to absolute coordinates
        y: child.y + groupToUngroup.y,
    }));
    const newShapes = [...remainingShapes, ...ungroupedChildren];
    updateStateAndHistory(newShapes, ungroupedChildren.map(c => c.id));
    toast({ title: "Ungrouped", description: "Group disbanded."});
  };


  const handleUndo = () => undo();
  const handleRedo = () => redo();

  const handleExportJson = () => {
    if (!stageRef.current) {
      toast({ title: "Error", description: "Canvas not ready for export.", variant: "destructive" });
      return;
    }
    // Include stage position and scale in the export
    const exportData = {
      shapes,
      viewParams: {
        x: stageRef.current.x(),
        y: stageRef.current.y(),
        scale: stageRef.current.scaleX(), // Assuming uniform scaling
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
  };

  const handleImportJson = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);
          if (data.shapes && Array.isArray(data.shapes)) {
            const newShapes = data.shapes as Shape[];
            // Clear selection and reset history with imported shapes
            resetHistory({ shapes: newShapes, selectedShapeIds: [] }); 
            
            // Apply view parameters if available
            if(stageRef.current && data.viewParams) {
              stageRef.current.x(data.viewParams.x || 0);
              stageRef.current.y(data.viewParams.y || 0);
              stageRef.current.scaleX(data.viewParams.scale || 1);
              stageRef.current.scaleY(data.viewParams.scale || 1);
              stageRef.current.batchDraw(); // Re-draw stage with new position/scale
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
      event.target.value = ''; // Reset file input
    }
  };

  const handleSaveAsPng = () => {
    if (!stageRef.current) {
      toast({ title: "Error", description: "Canvas not ready.", variant: "destructive" });
      return;
    }
    // Ensure transformer is not visible for export
    const transformerNode = stageRef.current.findOne('Transformer');
    const transformerWasVisible = transformerNode?.isVisible();
    if (transformerNode) transformerNode.visible(false);
    stageRef.current.batchDraw(); // redraw without transformer

    // Get data URL (can specify mimeType, quality for jpeg, pixelRatio for higher res)
    const dataURL = stageRef.current.toDataURL({ mimeType: 'image/png', quality: 1, pixelRatio: 2 });
    
    if (transformerNode && transformerWasVisible) transformerNode.visible(true); // Restore transformer visibility
    stageRef.current.batchDraw();


    const a = document.createElement('a');
    a.href = dataURL;
    a.download = 'vector-canvas-drawing.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast({ title: "Saved as PNG", description: "Drawing exported as PNG." });
  };
  
  const getDashArray = () => {
    if (currentLineStyle === 'dashed') return [10, 5];
    if (currentLineStyle === 'dotted') return [defaultStrokeWidth < 1 ? 1 : defaultStrokeWidth, (defaultStrokeWidth < 1 ? 1 : defaultStrokeWidth) * 2]; // Adjust for better dot appearance
    return []; // Solid
  };

  // This provides the actual shape objects to the PropertiesPanel
  const selectedShapesObjects = shapes.filter(shape => selectedShapeIds.includes(shape.id));
  
  if (!isClient) {
    return (
      <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden items-center justify-center">
        <p>Loading Vector Editor...</p>
      </div>
    );
  }

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
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onSaveAsPng={handleSaveAsPng}
        onGroup={handleGroup}
        onUngroup={handleUngroup}
        selectedShapesCount={selectedShapeIds.length}
      />
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 relative bg-muted/30 border-r border-border">
          <DynamicKonvaCanvas
            stageRef={stageRef}
            shapes={shapes}
            selectedShapeIds={selectedShapeIds}
            setSelectedShapeIds={(ids) => updateStateAndHistory(shapes, ids)} // Directly update history for selections
            onUpdateShapes={(updatedShapes) => updateStateAndHistory(updatedShapes, selectedShapeIds)} // For batch ops like delete
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
          onUpdateShape={(updatedShape) => {
             handleUpdateSingleShape(updatedShape);
          }}
          // Pass default colors/stroke for new shapes created from properties if needed
        />
      </div>
    </div>
  );
}
