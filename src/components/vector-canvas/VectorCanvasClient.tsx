
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
      <div className="flex-1 relative bg-white border-r border-border flex items-center justify-center">
        <p>Loading Canvas...</p>
      </div>
    )
  }
);

const initialShapes: Shape[] = [];
const initialSelectedShapeIds: string[] = [];
const initialTool: Tool = 'select';
const initialDefaultFillColor = '#A3E47F';
const initialDefaultStrokeColor = '#000000'; // Updated to black
const initialDefaultStrokeWidth = 2;
const initialCurrentLineStyle = 'solid' as const;
const initialCanvasWidth = 1920;
const initialCanvasHeight = 1080;


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
  const [canvasWidth, setCanvasWidth] = useState<number>(initialCanvasWidth);
  const [canvasHeight, setCanvasHeight] = useState<number>(initialCanvasHeight);

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
    // Preserve selection if the updated shape is already selected, otherwise select it.
    const newSelectedIds = selectedShapeIds.includes(updatedShape.id) ? selectedShapeIds : [updatedShape.id];
    updateStateAndHistory(newShapes, newSelectedIds);
  }, [shapes, selectedShapeIds, updateStateAndHistory]);

  const handleUpdateMultipleShapes = useCallback((updatedShapes: Shape[]) => {
    const newShapes = shapes.map(s => {
      const foundUpdate = updatedShapes.find(us => us.id === s.id);
      return foundUpdate ? foundUpdate : s;
    });
    updateStateAndHistory(newShapes, selectedShapeIds);
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
        const sCurrentX = s.x || 0;
        const sCurrentY = s.y || 0;

        let sWidth = 0;
        let sHeight = 0;

        if (s.type === 'line' || s.type === 'polyline' || s.type === 'polygon') {
            // For line-based shapes, calculate bounding box from points
            let sMinX = Infinity, sMinY = Infinity, sMaxX = -Infinity, sMaxY = -Infinity;
            for(let i = 0; i < s.points.length; i+=2) {
                sMinX = Math.min(sMinX, s.points[i]);
                sMaxX = Math.max(sMaxX, s.points[i]);
                sMinY = Math.min(sMinY, s.points[i+1]);
                sMaxY = Math.max(sMaxY, s.points[i+1]);
            }
            sWidth = sMaxX - sMinX;
            sHeight = sMaxY - sMinY;
            // Adjust currentX, currentY if points are negative relative to origin
             minX = Math.min(minX, sCurrentX + sMinX);
             minY = Math.min(minY, sCurrentY + sMinY);
             maxX = Math.max(maxX, sCurrentX + sMaxX);
             maxY = Math.max(maxY, sCurrentY + sMaxY);

        } else { // For rect, ellipse, text, group
            sWidth = (s.width || 0) * (s.scaleX || 1);
            sHeight = (s.height || 0) * (s.scaleY || 1);
            minX = Math.min(minX, sCurrentX);
            minY = Math.min(minY, sCurrentY);
            maxX = Math.max(maxX, sCurrentX + sWidth);
            maxY = Math.max(maxY, sCurrentY + sHeight);
        }
    });


    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY) || maxX <= minX || maxY <= minY) {
        // Fallback if bounds are not valid (e.g. only points, no dimensions)
        const firstShapePos = shapesToGroup[0] ? {x: shapesToGroup[0].x || 0, y: shapesToGroup[0].y || 0} : {x:0, y:0};
        minX = firstShapePos.x;
        minY = firstShapePos.y;
        maxX = minX + 100; // Default group size
        maxY = minY + 100;
    }


    const group: GroupShape = {
      id: uuidv4(),
      type: 'group',
      x: minX,
      y: minY,
      width: Math.max(5, maxX - minX),
      height: Math.max(5, maxY - minY),
      children: shapesToGroup.map(s => {
        let childX = (s.x || 0) - minX;
        let childY = (s.y || 0) - minY;
        // For line-based shapes whose origin might not be top-left of their points bbox
        if ((s.type === 'line' || s.type === 'polyline' || s.type === 'polygon')) {
            let sMinXpts = Infinity;
             for(let i = 0; i < s.points.length; i+=2) {
                sMinXpts = Math.min(sMinXpts, s.points[i]);
            }
            // childX -= sMinXpts; // This part needs careful thought if points aren't 0,0 based from shape x,y
        }

        return {
            ...s,
            x: childX,
            y: childY,
            draggable: false, // Children within a group are not individually draggable by default
        };
      }),
      draggable: true,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
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

    const konvaGroupNode = stageRef.current?.findOne('#' + groupToUngroup.id) as Konva.Group | undefined;

    const ungroupedChildren = groupToUngroup.children.map(child => {
        let absoluteX = child.x || 0;
        let absoluteY = child.y || 0;
        let newScaleX = child.scaleX || 1;
        let newScaleY = child.scaleY || 1;
        let newRotation = child.rotation || 0;

        if (konvaGroupNode) {
            const transform = konvaGroupNode.getAbsoluteTransform(); // Use absolute transform relative to the stage
            const childOriginalPos = { x: child.x || 0, y: child.y || 0 };
            
            // If children were positioned relative to group's (0,0), transform by group's total transform
            const transformedChildPos = transform.point(childOriginalPos);
            absoluteX = transformedChildPos.x;
            absoluteY = transformedChildPos.y;

            // Decompose the group's absolute transform to apply scale and rotation
            // This is a simplified approach. True decomposition is more complex.
            // For now, we assume children's scale/rotation are relative to the group's scale/rotation.
            newScaleX *= (groupToUngroup.scaleX || 1);
            newScaleY *= (groupToUngroup.scaleY || 1);
            newRotation += (groupToUngroup.rotation || 0);
            // This logic needs refinement if children had their own rotations/scales *before* grouping
            // and those need to be preserved *after* group's transform is applied.
            // Konva's node.absolutePosition(), absoluteRotation(), absoluteScale() might be more direct.
            
            // Attempt to get absolute properties directly from Konva child nodes if they exist
            const konvaChildNode = konvaGroupNode.findOne('#'+child.id);
            if (konvaChildNode) {
                const absPos = konvaChildNode.absolutePosition();
                absoluteX = absPos.x;
                absoluteY = absPos.y;
                newRotation = konvaChildNode.absoluteRotation();
                const absScale = konvaChildNode.absoluteScale();
                newScaleX = absScale.x;
                newScaleY = absScale.y;
            }


        } else { // Fallback if Konva node not found (should be rare)
            // This fallback assumes children x,y are relative to group's origin and group x,y is on stage.
            absoluteX += (groupToUngroup.x || 0);
            absoluteY += (groupToUngroup.y || 0);
            newScaleX *= (groupToUngroup.scaleX || 1);
            newScaleY *= (groupToUngroup.scaleY || 1);
            newRotation += (groupToUngroup.rotation || 0);
        }

        return {
            ...child,
            x: absoluteX,
            y: absoluteY,
            scaleX: newScaleX,
            scaleY: newScaleY,
            rotation: newRotation,
            draggable: true,
        };
    });
    const newShapes = [...remainingShapes, ...ungroupedChildren];
    updateStateAndHistory(newShapes, ungroupedChildren.map(c => c.id));
    toast({ title: "Ungrouped", description: "Group disbanded."});
  }, [shapes, selectedShapeIds, updateStateAndHistory, toast, stageRef]);


  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const targetElement = event.target as HTMLElement;
      const isInputFocused = targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA' || targetElement.isContentEditable;

      // Skip global shortcuts if an input is focused,
      // UNLESS it's a specific drawing finalization key like Enter/Escape
      // which is handled locally in KonvaCanvas now.
      if (isInputFocused && (event.key === 'Delete' || event.key === 'Backspace')) {
        return; // Allow default input behavior
      }
      if (isInputFocused && (event.ctrlKey || event.metaKey) && (event.key === 'g' || event.key === 'G')) {
         return; // Prevent grouping shortcuts if input focused
      }


      if (event.ctrlKey || event.metaKey) {
        if (event.key === 'z') {
          event.preventDefault();
          undo();
        } else if (event.key === 'y' || (event.key === 'Z' && event.shiftKey)) {
          event.preventDefault();
          redo();
        } else if (event.key === 'g' && !isInputFocused) {
          event.preventDefault();
          localHandleGroup();
        } else if (event.key === 'G' && event.shiftKey && !isInputFocused) {
            event.preventDefault();
            handleUngroup();
        }
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && !isInputFocused) {
          event.preventDefault();
          localHandleDeleteSelected();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, localHandleGroup, handleUngroup, localHandleDeleteSelected]);

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
      },
      canvasDimensions: {
        width: canvasWidth,
        height: canvasHeight,
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
  }, [shapes, stageRef, toast, canvasWidth, canvasHeight]);

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
            if (data.canvasDimensions) {
              setCanvasWidth(data.canvasDimensions.width || initialCanvasWidth);
              setCanvasHeight(data.canvasDimensions.height || initialCanvasHeight);
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
  }, [resetHistory, stageRef, toast, setCanvasWidth, setCanvasHeight]);

  const handleSaveAsPng = useCallback(() => {
    if (!stageRef.current) {
      toast({ title: "Error", description: "Canvas not ready.", variant: "destructive" });
      return;
    }
    const transformerNode = stageRef.current.findOne('Transformer');
    const wasTransformerVisible = transformerNode?.isVisible();

    if (transformerNode) transformerNode.visible(false);
    // Hide all custom handles (line endpoints, vertex handles)
    stageRef.current.find('.line-handle, .vertex-handle').forEach(handle => handle.visible(false));
    const selectionRectNode = stageRef.current.findOne('.selection-rectangle-class');
    const wasSelectionRectVisible = selectionRectNode?.isVisible();
    if (selectionRectNode) selectionRectNode.visible(false);

    stageRef.current.batchDraw();

    const dataURL = stageRef.current.toDataURL({
        mimeType: 'image/png',
        quality: 1,
        pixelRatio: 2,
        width: canvasWidth,
        height: canvasHeight,
    });

    if (transformerNode && wasTransformerVisible) transformerNode.visible(true);
    stageRef.current.find('.line-handle, .vertex-handle').forEach(handle => handle.visible(true)); // Consider original visibility if needed
    if (selectionRectNode && wasSelectionRectVisible) selectionRectNode.visible(true);

    stageRef.current.batchDraw();

    const a = document.createElement('a');
    a.href = dataURL;
    a.download = 'vector-canvas-drawing.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast({ title: "Saved as PNG", description: "Drawing exported as PNG." });
  }, [stageRef, toast, canvasWidth, canvasHeight]);

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
        setCurrentTool={(tool) => {
            setCurrentTool(tool);
            // If switching away from select tool, clear current selection and edit mode
            if (tool !== 'select') {
                setSelectedShapeIds([]);
                // Consider if setEditingShapeId(null) is needed here too from KonvaCanvas
            }
        }}
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
        canvasWidth={canvasWidth}
        setCanvasWidth={setCanvasWidth}
        canvasHeight={canvasHeight}
        setCanvasHeight={setCanvasHeight}
      />
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 relative bg-white border-r border-border">
          <DynamicKonvaCanvas
            stageRef={stageRef}
            shapes={shapes}
            selectedShapeIds={selectedShapeIds}
            setSelectedShapeIds={(ids) => updateStateAndHistory(shapes, ids)}
            onUpdateShapes={(updatedShapesList) => updateStateAndHistory(updatedShapesList, selectedShapeIds.filter(id => updatedShapesList.some(s => s.id === id)))}
            onUpdateSingleShape={handleUpdateSingleShape}
            onAddShape={handleAddShape}
            currentTool={currentTool}
            defaultFillColor={defaultFillColor}
            defaultStrokeColor={defaultStrokeColor}
            defaultStrokeWidth={defaultStrokeWidth}
            dashArray={getDashArray()}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
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
