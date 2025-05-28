
"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { v4 as uuidv4 } from 'uuid';
import type Konva from 'konva';
import type { Stage as KonvaStageType } from 'konva/lib/Stage';

import type { Shape, Tool, HistoryEntry, GroupShape, Template, TextShape } from '@/lib/types';
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
    const targetElement = document.activeElement as HTMLElement;
    const isInputFocused = ['INPUT', 'TEXTAREA'].includes(targetElement.tagName) || targetElement.isContentEditable;
    if (isInputFocused) return;

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
        maxX = minX + 100; 
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

    const stage = stageRef.current;
    if (!stage) {
        toast({ title: "Ungrouping Error", description: "Canvas stage not available.", variant: "destructive"});
        return;
    }

    const remainingShapes = shapes.filter(s => s.id !== groupToUngroup.id);
    const konvaGroupNode = stage.findOne('#' + groupToUngroup.id) as Konva.Group | undefined;

    const ungroupedChildren = groupToUngroup.children.map(child => {
        let absoluteX = child.x || 0;
        let absoluteY = child.y || 0;
        let newScaleX = child.scaleX || 1;
        let newScaleY = child.scaleY || 1;
        let newRotation = child.rotation || 0;

        if (konvaGroupNode) {
            const konvaChildNode = konvaGroupNode.findOne('#'+child.id);
            if (konvaChildNode) {
                const absPos = konvaChildNode.getAbsolutePosition(); 
                const absScale = konvaChildNode.getAbsoluteScale();
                newRotation = konvaChildNode.getAbsoluteRotation();

                absoluteX = (absPos.x - stage.x()) / stage.scaleX();
                absoluteY = (absPos.y - stage.y()) / stage.scaleY();
                
                newScaleX = absScale.x;
                newScaleY = absScale.y;

            } else { 
                console.warn(`Konva child node with id ${child.id} not found in group ${groupToUngroup.id} during ungroup. Using model fallback.`);
                const groupTransform = new Konva.Transform();
                groupTransform.translate(groupToUngroup.x || 0, groupToUngroup.y || 0);
                if (groupToUngroup.rotation) groupTransform.rotate((groupToUngroup.rotation * Math.PI) / 180);
                groupTransform.scale(groupToUngroup.scaleX || 1, groupToUngroup.scaleY || 1);

                const childRelativePos = { x: child.x || 0, y: child.y || 0 };
                const transformedChildPos = groupTransform.point(childRelativePos);
                
                absoluteX = transformedChildPos.x;
                absoluteY = transformedChildPos.y;
                newScaleX = (child.scaleX || 1) * (groupToUngroup.scaleX || 1);
                newScaleY = (child.scaleY || 1) * (groupToUngroup.scaleY || 1);
                newRotation = (child.rotation || 0) + (groupToUngroup.rotation || 0);
            }
        } else { 
            console.warn(`Konva group node with id ${groupToUngroup.id} not found during ungroup. Basic fallback.`);
            absoluteX += (groupToUngroup.x || 0);
            absoluteY += (groupToUngroup.y || 0);
            newScaleX *= (groupToUngroup.scaleX || 1);
            newScaleY *= (groupToUngroup.scaleY || 1);
            newRotation += (groupToUngroup.rotation || 0);
        }
        return {
            ...child,
            id: uuidv4(), 
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

    let shapesForTemplateModel: Shape[];
    
    // Helper to create a deep clone and assign new IDs recursively
    const cloneWithNewIds = (shape: Shape): Shape => {
        const newShape = JSON.parse(JSON.stringify(shape)); // Deep clone
        newShape.id = uuidv4(); // Assign new ID to the shape itself
        if (newShape.type === 'group') {
            newShape.children = newShape.children.map(cloneWithNewIds); // Recursively for children
        }
        return newShape;
    };

    if (shapesToProcess.length === 1 && shapesToProcess[0].type === 'group') {
        // Case 1: A single group is selected. Use its children directly for the template.
        // The children's coordinates are already relative to the group's origin.
        const groupShape = shapesToProcess[0] as GroupShape;
        shapesForTemplateModel = groupShape.children.map(child => {
            const clonedChild = cloneWithNewIds(child); // Clone and assign new ID
            // Ensure children's x,y are their existing relative positions within the group
            clonedChild.x = child.x || 0;
            clonedChild.y = child.y || 0;
            return clonedChild;
        });
    } else if (shapesToProcess.length === 1) {
        // Case 2: A single non-group shape is selected.
        const singleShape = shapesToProcess[0];
        const clonedShape = cloneWithNewIds(singleShape);

        // For text shapes, capture their rendered dimensions if not explicitly set
        if (clonedShape.type === 'text' && (!clonedShape.width || !clonedShape.height) && stageRef.current) {
            const konvaNode = stageRef.current.findOne('#' + singleShape.id) as Konva.Text | undefined;
            if (konvaNode) {
                (clonedShape as TextShape).width = konvaNode.width() / (singleShape.scaleX || 1);
                (clonedShape as TextShape).height = konvaNode.height() / (singleShape.scaleY || 1);
            }
        }
        // Normalize its position to 0,0 for the template
        clonedShape.x = 0;
        clonedShape.y = 0;
        // Preserve original scale and rotation, or reset if desired (e.g., clonedShape.scaleX = 1;)
        // For simplicity, we keep original scale/rotation in template for now.
        shapesForTemplateModel = [clonedShape];

    } else {
        // Case 3: Multiple shapes are selected (or potentially single non-group, handled above).
        // Normalize positions relative to their collective bounding box.
        let minX = Infinity, minY = Infinity;
        shapesToProcess.forEach(s => {
            minX = Math.min(minX, s.x || 0);
            minY = Math.min(minY, s.y || 0);
        });
         if (!isFinite(minX) || !isFinite(minY)) { 
            minX = shapesToProcess[0]?.x || 0; 
            minY = shapesToProcess[0]?.y || 0;
        }

        shapesForTemplateModel = shapesToProcess.map(s => {
            const clonedShape = cloneWithNewIds(s);
            clonedShape.x = (s.x || 0) - minX;
            clonedShape.y = (s.y || 0) - minY;

            if (clonedShape.type === 'text' && (!clonedShape.width || !clonedShape.height) && stageRef.current) {
                const konvaNode = stageRef.current.findOne('#' + s.id) as Konva.Text | undefined;
                if (konvaNode) {
                    (clonedShape as TextShape).width = konvaNode.width() / (s.scaleX || 1);
                    (clonedShape as TextShape).height = konvaNode.height() / (s.scaleY || 1);
                }
            }
            return clonedShape;
        });
    }

    const newStamp: Template = { id: uuidv4(), name: name.trim(), shapes: shapesForTemplateModel };
    const updatedStamps = [...savedStamps, newStamp];
    setSavedStamps(updatedStamps);
    saveStampsToStorage(updatedStamps);
    toast({ title: "Stamp Saved", description: `"${name.trim()}" has been saved.` });
  }, [shapes, selectedShapeIds, savedStamps, toast, saveStampsToStorage, stageRef]);

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
      setCurrentTool('stamp'); 
      toast({ title: "Stamp Loaded", description: `Click on canvas to place "${stampToLoad.name}".` });
    } else {
      toast({ title: "Error", description: "Stamp not found.", variant: "destructive" });
    }
  }, [savedStamps, toast]);
  
  const placeStampOnCanvas = useCallback((clickX: number, clickY: number) => {
    if (!isPlacingStamp) return;

    // Helper to clone shapes and assign new IDs recursively
    const cloneWithNewIdsForPlacement = (shape: Shape): Shape => {
        const newInstance = JSON.parse(JSON.stringify(shape)); // Deep clone template shape
        newInstance.id = uuidv4(); // New ID for the canvas instance
        if (newInstance.type === 'group') {
            newInstance.children = newInstance.children.map(cloneWithNewIdsForPlacement);
        }
        return newInstance;
    };
    
    const shapesToPlace = isPlacingStamp.shapes.map(cloneWithNewIdsForPlacement);

    if (isPlacingStamp.shapes.length === 1) {
        // Place a single item directly, not as a group
        const singleShapeInstance = shapesToPlace[0];
        
        // The template shape x,y should be 0,0 if saved correctly for single items.
        // The clickX, clickY becomes the origin of the placed shape.
        singleShapeInstance.x = clickX + (singleShapeInstance.x || 0); 
        singleShapeInstance.y = clickY + (singleShapeInstance.y || 0);
        singleShapeInstance.draggable = true;

        const newShapesList = [...shapes, singleShapeInstance];
        updateStateAndHistory(newShapesList, [singleShapeInstance.id]);
        toast({ title: "Stamp Placed", description: `"${isPlacingStamp.name}" (single item) added to canvas.` });

    } else {
        // Place multiple items as a group
        let stampMinX = Infinity, stampMinY = Infinity, stampMaxX = -Infinity, stampMaxY = -Infinity;
        let first = true;

        // Calculate bounding box of the *original template shapes* to determine group width/height
        isPlacingStamp.shapes.forEach(s => {
            const sX = s.x || 0; 
            const sY = s.y || 0;
            let sRight = sX, sBottom = sY;

            if (s.type === 'line' || s.type === 'polyline' || s.type === 'polygon') {
                let pMinX = s.points.length > 0 ? s.points[0] : 0;
                let pMaxX = s.points.length > 0 ? s.points[0] : 0;
                let pMinY = s.points.length > 0 ? s.points[1] : 0;
                let pMaxY = s.points.length > 0 ? s.points[1] : 0;
                for (let i = 0; i < s.points.length; i += 2) {
                    const ptX = s.points[i] * (s.scaleX || 1);
                    const ptY = s.points[i+1] * (s.scaleY || 1);
                    pMinX = Math.min(pMinX, ptX); pMaxX = Math.max(pMaxX, ptX);
                    pMinY = Math.min(pMinY, ptY); pMaxY = Math.max(pMaxY, ptY);
                }
                sRight = sX + pMaxX; 
                sBottom = sY + pMaxY;
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
        
        const stampContentWidth = Math.max(5, stampMaxX - stampMinX);
        const stampContentHeight = Math.max(5, stampMaxY - stampMinY);

        const newStampGroup: GroupShape = {
          id: uuidv4(),
          type: 'group',
          x: clickX, 
          y: clickY,
          width: stampContentWidth,
          height: stampContentHeight,
          children: shapesToPlace.map(shape => ({ 
            ...shape, 
            // Template shapes are already normalized, so their x,y are relative to template's 0,0
            x: shape.x || 0, 
            y: shape.y || 0,
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
        toast({ title: "Stamp Placed", description: `"${isPlacingStamp.name}" (group) added to canvas.` });
    }

    setIsPlacingStamp(null); 
    setCurrentTool('select'); 

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

    stageRef.current.batchDraw(); 

    const dataURL = stageRef.current.toDataURL({
        mimeType: 'image/png',
        quality: 1,
        pixelRatio: 2, 
        width: canvasWidth,
        height: canvasHeight,
    });

    if (transformerNode && wasTransformerVisible) transformerNode.visible(true);
    handleVisibility.forEach(item => item.node.visible(item.visible));
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
  const isSingleGroupSelected = selectedShapeIds.length === 1 && selectedShapesObjects[0]?.type === 'group';


  return (
    <div className="flex flex-col h-screen bg-white text-foreground overflow-hidden">
      <Toolbar
        currentTool={currentTool}
        setCurrentTool={(tool) => {
            setCurrentTool(tool);
            if (tool !== 'select' && tool !== 'stamp') { 
                setSelectedShapeIds([]);
            }
            if (tool !== 'stamp') {
                setIsPlacingStamp(null); 
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
        isSingleGroupSelected={isSingleGroupSelected}
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
