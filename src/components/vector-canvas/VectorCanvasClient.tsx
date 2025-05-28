
"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { v4 as uuidv4 } from 'uuid';
import type Konva from 'konva';
import type { Stage as KonvaStageType } from 'konva/lib/Stage';

import type { Shape, Tool, HistoryEntry, GroupShape, Template } from '@/lib/types';
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

const LOCAL_STORAGE_STAMPS_KEY = 'vectorCanvasStamps';

const initialShapes: Shape[] = [];
const initialSelectedShapeIds: string[] = [];
const initialTool: Tool = 'select';
const initialDefaultFillColor = '#A3E47F'; // Light Lime Green
const initialDefaultStrokeColor = '#000000'; // Black
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

  const [savedStamps, setSavedStamps] = useState<Template[]>([]);
  const [isPlacingStamp, setIsPlacingStamp] = useState<Template | null>(null);


  const stageRef = useRef<KonvaStageType | null>(null);
  const { toast } = useToast();

  const { currentHistory, setHistory, undo, redo, canUndo, canRedo, resetHistory } = useCanvasHistory(initialHistoryEntry);

  // Load stamps from localStorage on initial mount
  useEffect(() => {
    try {
      const storedStamps = localStorage.getItem(LOCAL_STORAGE_STAMPS_KEY);
      if (storedStamps) {
        setSavedStamps(JSON.parse(storedStamps));
      }
    } catch (error) {
      console.error("Failed to load stamps from localStorage:", error);
      toast({ title: "Error loading stamps", description: "Could not retrieve saved stamps.", variant: "destructive"});
    }
  }, [toast]);

  const saveStampsToStorage = useCallback((stampsToSave: Template[]) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_STAMPS_KEY, JSON.stringify(stampsToSave));
    } catch (error) {
      console.error("Failed to save stamps to localStorage:", error);
      toast({ title: "Error saving stamps", description: "Could not persist stamps.", variant: "destructive"});
    }
  }, [toast]);


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
    const newSelectedIds = selectedShapeIds.includes(updatedShape.id) ? selectedShapeIds : [updatedShape.id];
    updateStateAndHistory(newShapes, newSelectedIds);
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
        let sWidth = 0, sHeight = 0;

        if (s.type === 'line' || s.type === 'polyline' || s.type === 'polygon') {
            let sMinXpts = Infinity, sMinYpts = Infinity, sMaxXpts = -Infinity, sMaxYpts = -Infinity;
            for(let i = 0; i < s.points.length; i+=2) {
                const pointX = s.points[i] * (s.scaleX || 1);
                const pointY = s.points[i+1] * (s.scaleY || 1);
                sMinXpts = Math.min(sMinXpts, pointX);
                sMaxXpts = Math.max(sMaxXpts, pointX);
                sMinYpts = Math.min(sMinYpts, pointY);
                sMaxYpts = Math.max(sMaxYpts, pointY);
            }
             minX = Math.min(minX, sCurrentX + sMinXpts);
             minY = Math.min(minY, sCurrentY + sMinYpts);
             maxX = Math.max(maxX, sCurrentX + sMaxXpts);
             maxY = Math.max(maxY, sCurrentY + sMaxYpts);
        } else { 
            sWidth = (s.width || 0) * (s.scaleX || 1);
            sHeight = (s.height || 0) * (s.scaleY || 1);
            minX = Math.min(minX, sCurrentX);
            minY = Math.min(minY, sCurrentY);
            maxX = Math.max(maxX, sCurrentX + sWidth);
            maxY = Math.max(maxY, sCurrentY + sHeight);
        }
    });

    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
        minX = shapesToGroup[0]?.x || 0;
        minY = shapesToGroup[0]?.y || 0;
        maxX = minX + 100; // Default size if calculation fails
        maxY = minY + 100;
    }
    
    const groupWidth = Math.max(5, maxX - minX);
    const groupHeight = Math.max(5, maxY - minY);

    const group: GroupShape = {
      id: uuidv4(),
      type: 'group',
      x: minX,
      y: minY,
      width: groupWidth,
      height: groupHeight,
      children: shapesToGroup.map(s => {
        return {
            ...s,
            x: (s.x || 0) - minX,
            y: (s.y || 0) - minY,
            draggable: false, 
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
            const konvaChildNode = konvaGroupNode.findOne('#'+child.id); // Find by original ID
            if (konvaChildNode) {
                const absPos = konvaChildNode.getAbsolutePosition();
                absoluteX = absPos.x;
                absoluteY = absPos.y;
                newRotation = konvaChildNode.getAbsoluteRotation();
                const absScale = konvaChildNode.getAbsoluteScale();
                newScaleX = absScale.x;
                newScaleY = absScale.y;
            } else { // Fallback if Konva child node not found (should ideally not happen if IDs are stable within group)
                absoluteX += (groupToUngroup.x || 0);
                absoluteY += (groupToUngroup.y || 0);
                newScaleX *= (groupToUngroup.scaleX || 1);
                newScaleY *= (groupToUngroup.scaleY || 1);
                newRotation += (groupToUngroup.rotation || 0);
            }
        } else { // Fallback if group node itself isn't found on stage
            absoluteX += (groupToUngroup.x || 0);
            absoluteY += (groupToUngroup.y || 0);
            newScaleX *= (groupToUngroup.scaleX || 1);
            newScaleY *= (groupToUngroup.scaleY || 1);
            newRotation += (groupToUngroup.rotation || 0);
        }
        return {
            ...child, // Spread the original child properties
            id: uuidv4(), // Give it a new ID as it's now a top-level shape
            x: absoluteX,
            y: absoluteY,
            scaleX: newScaleX,
            scaleY: newScaleY,
            rotation: newRotation,
            draggable: true, // Make it draggable again
        };
    });
    const newShapes = [...remainingShapes, ...ungroupedChildren];
    updateStateAndHistory(newShapes, ungroupedChildren.map(c => c.id));
    toast({ title: "Ungrouped", description: "Group disbanded."});
  }, [shapes, selectedShapeIds, updateStateAndHistory, toast, stageRef]);

  const handleSaveStamp = useCallback((name: string) => {
    const shapesToProcess = shapes.filter(s => selectedShapeIds.includes(s.id));
    if (shapesToProcess.length === 0) {
      toast({ title: "Save Stamp Failed", description: "No shapes selected.", variant: "destructive"});
      return;
    }
    if (!name.trim()) {
      toast({ title: "Save Stamp Failed", description: "Stamp name cannot be empty.", variant: "destructive"});
      return;
    }

    let shapesForStamp: Shape[];
    // If a single group is selected, use its children for the stamp, already relative to group's 0,0
    if (shapesToProcess.length === 1 && shapesToProcess[0].type === 'group') {
      shapesForStamp = JSON.parse(JSON.stringify((shapesToProcess[0] as GroupShape).children));
      // The children's x,y are already relative to the group's origin.
      // Ensure new IDs for these template shapes if they are used directly.
      shapesForStamp.forEach(s => s.id = uuidv4());
    } else {
      // Multiple shapes selected, or a single non-group shape.
      // Normalize their positions relative to their collective bounding box top-left.
      let minX = Infinity, minY = Infinity;
      shapesToProcess.forEach(s => {
          minX = Math.min(minX, s.x || 0);
          minY = Math.min(minY, s.y || 0);
      });

      shapesForStamp = shapesToProcess.map(s => {
          const clonedShape: Shape = JSON.parse(JSON.stringify(s)); // Deep clone
          clonedShape.id = uuidv4(); // New ID for the shape within the template
          clonedShape.x = (s.x || 0) - minX;
          clonedShape.y = (s.y || 0) - minY;
          // If the cloned shape is a group, its children also need new IDs
          if (clonedShape.type === 'group') {
              clonedShape.children = clonedShape.children.map((child: Shape) => ({
                  ...child,
                  id: uuidv4(),
              }));
          }
          return clonedShape;
      });
    }

    const newStamp: Template = { id: uuidv4(), name: name.trim(), shapes: shapesForStamp };
    const updatedStamps = [...savedStamps, newStamp];
    setSavedStamps(updatedStamps);
    saveStampsToStorage(updatedStamps);
    toast({ title: "Stamp Saved", description: `"${name.trim()}" has been saved.` });
  }, [shapes, selectedShapeIds, savedStamps, toast, saveStampsToStorage]);

  const handleDeleteStamp = useCallback((templateId: string) => {
    const updatedStamps = savedStamps.filter(stamp => stamp.id !== templateId);
    setSavedStamps(updatedStamps);
    saveStampsToStorage(updatedStamps);
    toast({ title: "Stamp Deleted" });
  }, [savedStamps, toast, saveStampsToStorage]);


  const handleLoadStamp = useCallback((templateId: string) => {
    const stampToLoad = savedStamps.find(stamp => stamp.id === templateId);
    if (stampToLoad) {
      setIsPlacingStamp(stampToLoad);
      setCurrentTool('stamp'); // Set tool to stamp mode
      toast({ title: "Stamp Loaded", description: `Click on canvas to place "${stampToLoad.name}".` });
    } else {
      toast({ title: "Error", description: "Stamp not found.", variant: "destructive" });
    }
  }, [savedStamps, toast]);
  
  const placeStampOnCanvas = useCallback((clickX: number, clickY: number) => {
    if (!isPlacingStamp) return;

    // Create new instances of the shapes from the template
    const shapesToPlace = isPlacingStamp.shapes.map(templateShape => {
        const newShapeInstance: Shape = JSON.parse(JSON.stringify(templateShape));
        newShapeInstance.id = uuidv4(); // CRITICAL: Ensure every placed shape has a unique ID
        // Template shapes are already relative to 0,0 of the stamp's bounding box
        // newShapeInstance.x will remain as is (relative)
        // newShapeInstance.y will remain as is (relative)
        
        // Ensure children of groups also get new IDs
        if (newShapeInstance.type === 'group') {
            newShapeInstance.children = newShapeInstance.children.map((child: Shape) => ({
                ...child,
                id: uuidv4(),
            }));
        }
        return newShapeInstance;
    });

    // Calculate bounding box of the template shapes to determine group width/height
    let stampMinX = 0, stampMinY = 0, stampMaxX = 0, stampMaxY = 0;
    let first = true;

    isPlacingStamp.shapes.forEach(s => {
        const sX = s.x || 0;
        const sY = s.y || 0;
        let sRight = sX, sBottom = sY;

        if (s.type === 'line' || s.type === 'polyline' || s.type === 'polygon') {
            let pMinX = sX, pMinY = sY, pMaxX = sX, pMaxY = sY;
            if (s.points.length > 0) {
                pMinX = sX + s.points[0] * (s.scaleX || 1);
                pMaxX = sX + s.points[0] * (s.scaleX || 1);
                pMinY = sY + s.points[1] * (s.scaleY || 1);
                pMaxY = sY + s.points[1] * (s.scaleY || 1);
                for (let i = 2; i < s.points.length; i += 2) {
                    pMinX = Math.min(pMinX, sX + s.points[i] * (s.scaleX || 1));
                    pMaxX = Math.max(pMaxX, sX + s.points[i] * (s.scaleX || 1));
                    pMinY = Math.min(pMinY, sY + s.points[i+1] * (s.scaleY || 1));
                    pMaxY = Math.max(pMaxY, sY + s.points[i+1] * (s.scaleY || 1));
                }
            }
            sRight = pMaxX;
            sBottom = pMaxY;
        } else {
            sRight = sX + (s.width || 0) * (s.scaleX || 1);
            sBottom = sY + (s.height || 0) * (s.scaleY || 1);
        }
        
        if (first) {
            stampMinX = sX; stampMinY = sY;
            stampMaxX = sRight; stampMaxY = sBottom;
            first = false;
        } else {
            stampMinX = Math.min(stampMinX, sX);
            stampMinY = Math.min(stampMinY, sY);
            stampMaxX = Math.max(stampMaxX, sRight);
            stampMaxY = Math.max(stampMaxY, sBottom);
        }
    });
    
    const stampGroupWidth = Math.max(5, stampMaxX - stampMinX);
    const stampGroupHeight = Math.max(5, stampMaxY - stampMinY);

    // Create a new group for the placed stamp
    const newStampGroup: GroupShape = {
      id: uuidv4(),
      type: 'group',
      x: clickX, // Position the group at the click
      y: clickY,
      width: stampGroupWidth,
      height: stampGroupHeight,
      children: shapesToPlace.map(shape => ({
        ...shape, 
        // Adjust child positions to be relative to the new group's 0,0 (which is clickX, clickY)
        // Since template shapes x,y are already relative to stampMinX, stampMinY
        x: (shape.x || 0) - stampMinX,
        y: (shape.y || 0) - stampMinY,
        draggable: false,
      })),
      draggable: true,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
    };

    const newShapesList = [...shapes, newStampGroup];
    updateStateAndHistory(newShapesList, [newStampGroup.id]);

    setIsPlacingStamp(null); // Reset placing mode
    setCurrentTool('select'); // Revert to select tool
    toast({ title: "Stamp Placed", description: `"${isPlacingStamp.name}" added to canvas.` });

  }, [isPlacingStamp, shapes, updateStateAndHistory, toast]);


  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const targetElement = event.target as HTMLElement;
      const isInputFocused = ['INPUT', 'TEXTAREA'].includes(targetElement.tagName) || targetElement.isContentEditable;

      if ((event.key === 'Delete' || event.key === 'Backspace') && isInputFocused) {
        return; 
      }
      if ((event.ctrlKey || event.metaKey) && (event.key === 'g' || event.key === 'G') && isInputFocused) {
         return; 
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
      } else if (event.key === 'Escape' && isPlacingStamp) {
          event.preventDefault();
          setIsPlacingStamp(null);
          setCurrentTool('select');
          toast({ title: "Stamp Placement Cancelled" });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, localHandleGroup, handleUngroup, localHandleDeleteSelected, isPlacingStamp, toast]);

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
    // Temporarily hide transformers and handles
    const transformerNode = stageRef.current.findOne('Transformer');
    const wasTransformerVisible = transformerNode?.isVisible();
    if (transformerNode) transformerNode.visible(false);

    const handles = stageRef.current.find('.line-handle, .vertex-handle');
    const handleVisibility: {node: Konva.Node, visible: boolean}[] = [];
    handles.forEach(handle => {
        handleVisibility.push({node: handle, visible: handle.isVisible()});
        handle.visible(false);
    });
    
    const selectionRectNode = stageRef.current.findOne('.selection-rectangle-class');
    const wasSelectionRectVisible = selectionRectNode?.isVisible();
    if (selectionRectNode) selectionRectNode.visible(false);

    stageRef.current.batchDraw(); // Ensure changes are rendered before export

    const dataURL = stageRef.current.toDataURL({
        mimeType: 'image/png',
        quality: 1,
        pixelRatio: 2, // For higher resolution PNGs
        width: canvasWidth,
        height: canvasHeight,
    });

    // Restore visibility
    if (transformerNode && wasTransformerVisible) transformerNode.visible(true);
    handleVisibility.forEach(item => item.node.visible(item.visible));
    if (selectionRectNode && wasSelectionRectVisible) selectionRectNode.visible(true);
    
    stageRef.current.batchDraw(); // Redraw with UI elements back

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
            if (tool !== 'select' && tool !== 'stamp') { // Keep selection if switching to stamp for placement
                setSelectedShapeIds([]);
            }
            if (tool !== 'stamp') {
                setIsPlacingStamp(null); // Cancel stamp placement if switching to another tool
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
        onSaveStamp={handleSaveStamp}
        onLoadStamp={handleLoadStamp}
        onDeleteStamp={handleDeleteStamp}
        savedStamps={savedStamps}
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
            onPlaceStamp={placeStampOnCanvas}
            isPlacingStampActive={!!isPlacingStamp}
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
