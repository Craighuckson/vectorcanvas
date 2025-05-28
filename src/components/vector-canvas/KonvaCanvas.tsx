
"use client";

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Stage, Layer, Rect, Ellipse, Line as KonvaLine, Text as KonvaText, Group as KonvaGroup, Transformer, Circle } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type Konva from 'konva';
import { v4 as uuidv4 } from 'uuid';
import type { Shape, Tool, RectangleShape, EllipseShape, LineShape, PolylineShape, PolygonShape, TextShape, GroupShape, ShapeTool, ShapeType } from '@/lib/types';

interface KonvaCanvasProps {
  stageRef: React.RefObject<Konva.Stage | null>;
  shapes: Shape[];
  selectedShapeIds: string[];
  setSelectedShapeIds: (ids: string[]) => void;
  onUpdateShapes: (shapes: Shape[]) => void;
  onUpdateSingleShape: (shape: Shape) => void;
  onAddShape: (shape: Shape) => void;
  onPlaceStamp: (clickX: number, clickY: number) => void;
  isPlacingStampActive: boolean;
  isSnapToGridActive: boolean;
  gridSize: number;
  currentTool: Tool;
  defaultFillColor: string;
  defaultStrokeColor: string;
  defaultStrokeWidth: number;
  dashArray: number[];
  canvasWidth: number; 
  canvasHeight: number; 
}

const KonvaCanvas: React.FC<KonvaCanvasProps> = ({
  stageRef,
  shapes,
  selectedShapeIds,
  setSelectedShapeIds,
  onUpdateShapes,
  onUpdateSingleShape,
  onAddShape,
  onPlaceStamp,
  isPlacingStampActive,
  isSnapToGridActive,
  gridSize,
  currentTool,
  defaultFillColor,
  defaultStrokeColor,
  defaultStrokeWidth,
  dashArray,
}) => {
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const layerRef = useRef<Konva.Layer | null>(null);
  const startHandleRef = useRef<Konva.Circle | null>(null);
  const endHandleRef = useRef<Konva.Circle | null>(null);   

  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDrawingShape, setCurrentDrawingShape] = useState<Shape | null>(null);
  const [liveEditingShape, setLiveEditingShape] = useState<Shape | null>(null);
  
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; width: number; height: number; visible: boolean } | null>(null);
  const selectionRectRef = useRef<Konva.Rect>(null);
  
  const [editingShapeId, setEditingShapeId] = useState<string | null>(null);
  const [isDraggingVertex, setIsDraggingVertex] = useState<boolean>(false);
  const [multiSelectBounds, setMultiSelectBounds] = useState<{ x: number, y: number, width: number, height: number, visible: boolean } | null>(null);
  
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, scale: 1 });


  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node !== null) {
      const resizeObserver = new ResizeObserver(() => {
        setContainerSize({ width: node.offsetWidth, height: node.offsetHeight });
      });
      resizeObserver.observe(node);
      setContainerSize({ width: node.offsetWidth, height: node.offsetHeight }); 
      return () => resizeObserver.disconnect(); 
    }
  }, []);

  useEffect(() => {
    if (stageRef.current) {
        setViewTransform({ x: stageRef.current.x(), y: stageRef.current.y(), scale: stageRef.current.scaleX() });
    }
  }, [stageRef, containerSize]);

  const snapValue = useCallback((value: number, size: number): number => {
    return Math.round(value / size) * size;
  }, []);

  const snapPoint = useCallback((point: { x: number, y: number } | null, size: number): { x: number, y: number } => {
    if (!point) return { x: 0, y: 0};
    return {
      x: snapValue(point.x, size),
      y: snapValue(point.y, size),
    };
  }, [snapValue]);

  const getPointerPosition = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    let pos = stage.getPointerPosition(); 
    if (!pos) return { x: 0, y: 0 };

    const worldPos = {
      x: (pos.x - viewTransform.x) / viewTransform.scale,
      y: (pos.y - viewTransform.y) / viewTransform.scale,
    };
    
    if (isSnapToGridActive) {
      return snapPoint(worldPos, gridSize);
    }
    return worldPos;
  }, [isSnapToGridActive, gridSize, snapPoint, viewTransform.x, viewTransform.y, viewTransform.scale, stageRef]);


  const updateTransformerAppearance = useCallback((konvaTransformer: Konva.Transformer | null, currentStageScale: number) => {
    if (!konvaTransformer) return;

    const baseAnchorSize = 8;
    const baseRotateAnchorOffset = 20;
    const baseBorderDashElement = 3;
    const basePadding = 2;

    konvaTransformer.anchorSize(Math.max(4, baseAnchorSize / currentStageScale));
    konvaTransformer.rotateAnchorOffset(Math.max(10, baseRotateAnchorOffset / currentStageScale));
    konvaTransformer.borderDash([Math.max(1, baseBorderDashElement / currentStageScale), Math.max(1, baseBorderDashElement / currentStageScale)]);
    konvaTransformer.padding(Math.max(1, basePadding / currentStageScale));
    
    konvaTransformer.getLayer()?.batchDraw();
  }, []);


  useEffect(() => {
    if (transformerRef.current && layerRef.current && stageRef.current) {
      const selectedKonvaNodes: Konva.Node[] = [];
      let hideTransformer = false;
      const currentStageScaleVal = viewTransform.scale;

      if (selectedShapeIds.length === 1) {
        const singleSelectedShape = shapes.find(s => s.id === selectedShapeIds[0]);
        if (singleSelectedShape) {
          if (singleSelectedShape.type === 'line') {
            hideTransformer = true; 
          } else if ((singleSelectedShape.type === 'polyline' || singleSelectedShape.type === 'polygon') && editingShapeId === singleSelectedShape.id) {
            hideTransformer = true; 
          } else {
            const node = layerRef.current?.findOne('#' + selectedShapeIds[0]);
            if (node) selectedKonvaNodes.push(node);
          }
        }
      } else if (selectedShapeIds.length > 1) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let foundNodesForBounds = false;

        selectedShapeIds.forEach(id => {
          const node = layerRef.current?.findOne('#' + id);
          if (node) {
            const shapeModel = shapes.find(s => s.id === id);
            if (shapeModel && shapeModel.type !== 'line' && !((shapeModel.type === 'polyline' || shapeModel.type === 'polygon') && editingShapeId === shapeModel.id) ) {
              selectedKonvaNodes.push(node);
            }
            const nodeRect = node.getClientRect({ relativeTo: layerRef.current });
            minX = Math.min(minX, nodeRect.x);
            minY = Math.min(minY, nodeRect.y);
            maxX = Math.max(maxX, nodeRect.x + nodeRect.width);
            maxY = Math.max(maxY, nodeRect.y + nodeRect.height);
            foundNodesForBounds = true;
          }
        });
        if (foundNodesForBounds) {
             setMultiSelectBounds({ x: minX, y: minY, width: maxX - minX, height: maxY - minY, visible: true });
        } else {
             setMultiSelectBounds(prev => prev ? { ...prev, visible: false } : null);
        }
      } else {
         setMultiSelectBounds(prev => prev ? { ...prev, visible: false } : null);
      }

      if (hideTransformer || selectedKonvaNodes.length === 0) {
        transformerRef.current.nodes([]);
      } else {
        transformerRef.current.nodes(selectedKonvaNodes);
      }
      updateTransformerAppearance(transformerRef.current, currentStageScaleVal);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selectedShapeIds, shapes, editingShapeId, updateTransformerAppearance, viewTransform.scale, stageRef]);

  useEffect(() => {
    const handleKeyDownDrawing = (event: KeyboardEvent) => {
      if (isDrawing && currentDrawingShape && (currentDrawingShape.type === 'polyline' || currentDrawingShape.type === 'polygon')) {
        if (event.key === 'Enter') { 
          event.preventDefault();
          event.stopPropagation(); 

          let finalShape = { ...currentDrawingShape };
          if (finalShape.points.length > 2) { // Remove the "live" point only if more than one point exists
            finalShape.points = finalShape.points.slice(0, -2); 
          }
          
          const minPointsRequired = finalShape.type === 'polyline' ? 4 : (finalShape.type === 'polygon' ? 6 : 0); 
          if (finalShape.points.length < minPointsRequired) {
            onUpdateShapes(shapes.filter(s => s.id !== finalShape.id)); 
          } else {
            onUpdateSingleShape(finalShape);
          }
          setIsDrawing(false);
          setCurrentDrawingShape(null);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDownDrawing);
    return () => document.removeEventListener('keydown', handleKeyDownDrawing);
  }, [isDrawing, currentDrawingShape, onUpdateSingleShape, onUpdateShapes, shapes]);

  useEffect(() => {
    const handleGeneralEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isDrawing && currentDrawingShape) { 
          event.preventDefault();
          event.stopPropagation();
          onUpdateShapes(shapes.filter(s => s.id !== currentDrawingShape.id));
          setIsDrawing(false);
          setCurrentDrawingShape(null);
          setLiveEditingShape(null);
          return; 
        }
        if (selectionRect?.visible) { 
          event.preventDefault();
          event.stopPropagation();
          setSelectionRect(prev => prev ? { ...prev, visible: false } : null);
          return;
        }
      }
    };
    window.addEventListener('keydown', handleGeneralEscape);
    return () => window.removeEventListener('keydown', handleGeneralEscape);
  }, [isDrawing, currentDrawingShape, shapes, onUpdateShapes, selectionRect, setIsDrawing, setCurrentDrawingShape, setSelectionRect, setLiveEditingShape]);


  const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    const pos = getPointerPosition(); 

    if (isPlacingStampActive && currentTool === 'stamp') {
      onPlaceStamp(pos.x, pos.y);
      return;
    }

    if (e.target.name() === 'line-handle' || e.target.name() === 'vertex-handle') {
      return;
    }
    
    if (editingShapeId) { 
      const clickedShapeId = e.target.id();
      const isVertexHandleOfEditingShape = e.target.name() === 'vertex-handle' && e.target.attrs['data-shape-id'] === editingShapeId;
      if (clickedShapeId !== editingShapeId && !isVertexHandleOfEditingShape && e.target === stageRef.current) {
        setEditingShapeId(null); 
        setLiveEditingShape(null);
      }
    }

    if (currentTool === 'select') {
      const clickedOnEmpty = e.target === stageRef.current;
      if (clickedOnEmpty) {
        setSelectedShapeIds([]);
        setEditingShapeId(null); 
        setLiveEditingShape(null);
        setSelectionRect({ x: pos.x, y: pos.y, width: 0, height: 0, visible: true });
        return;
      }

      let shapeNode = e.target;
      while (shapeNode.getParent() && shapeNode.getParent() !== layerRef.current && !shapeNode.id()) {
         if (shapeNode.getParent() instanceof Konva.Transformer) {
            shapeNode = shapeNode.getParent().nodes()[0] || shapeNode; 
            break;
         }
         shapeNode = shapeNode.getParent();
      }
      const shapeId = shapeNode.id();

      if (e.evt.metaKey || e.evt.ctrlKey) { 
        const isSelected = selectedShapeIds.includes(shapeId);
        setSelectedShapeIds(isSelected ? selectedShapeIds.filter(id => id !== shapeId) : [...selectedShapeIds, shapeId]);
      } else { 
        if (shapeId) { 
            setSelectedShapeIds([shapeId]);
            if (editingShapeId && editingShapeId !== shapeId) {
                setEditingShapeId(null);
                setLiveEditingShape(null);
            }
        } else { 
            setSelectedShapeIds([]);
            setEditingShapeId(null);
            setLiveEditingShape(null);
        }
      }
    } else if (['rectangle', 'ellipse', 'line', 'text'].includes(currentTool)) {
      setIsDrawing(true);
      setEditingShapeId(null); 
      setLiveEditingShape(null);
      const id = uuidv4();
      let initialShape: Shape;

      switch (currentTool as ShapeTool) {
        case 'rectangle':
          initialShape = { id, type: 'rectangle', x: pos.x, y: pos.y, width: 0, height: 0, fill: defaultFillColor, stroke: defaultStrokeColor, strokeWidth: defaultStrokeWidth, dash: dashArray, draggable: true };
          break;
        case 'ellipse':
          initialShape = { id, type: 'ellipse', x: pos.x, y: pos.y, width: 0, height: 0, fill: defaultFillColor, stroke: defaultStrokeColor, strokeWidth: defaultStrokeWidth, dash: dashArray, draggable: true };
          break;
        case 'line':
          initialShape = { id, type: 'line', x:pos.x, y:pos.y, points: [0, 0, 0, 0], stroke: defaultStrokeColor, strokeWidth: defaultStrokeWidth, dash: dashArray, draggable: true };
          break;
        case 'text':
            const defaultText = prompt("Enter text:", "Hello") || "Text";
            initialShape = { id, type: 'text', text: defaultText, x: pos.x, y: pos.y, fontSize: 20, fontFamily: 'Arial', fill: defaultStrokeColor, draggable: true, width: 0, height: 0 }; // Initial width/height for text
            onAddShape(initialShape);
            setIsDrawing(false); 
            setCurrentDrawingShape(null);
            return; 
        default: return; 
      }
      setCurrentDrawingShape(initialShape);
      onAddShape(initialShape); 
    } else if (currentTool === 'polyline' || currentTool === 'polygon') {
        setEditingShapeId(null); 
        setLiveEditingShape(null);
        if (!isDrawing) { 
            setIsDrawing(true);
            const id = uuidv4();
            const initialPolyShape: PolylineShape | PolygonShape = {
                id,
                type: currentTool,
                x: pos.x, 
                y: pos.y,
                points: [0, 0, 0, 0], 
                stroke: defaultStrokeColor,
                strokeWidth: defaultStrokeWidth,
                dash: dashArray,
                fill: currentTool === 'polygon' ? defaultFillColor : undefined, 
                closed: currentTool === 'polygon', 
                draggable: true,
            };
            setCurrentDrawingShape(initialPolyShape);
            onAddShape(initialPolyShape);
        } else { 
            if (currentDrawingShape && (currentDrawingShape.type === 'polyline' || currentDrawingShape.type === 'polygon')) {
                const relativeX = pos.x - currentDrawingShape.x;
                const relativeY = pos.y - currentDrawingShape.y;
                
                const existingPoints = [...currentDrawingShape.points];
                existingPoints[existingPoints.length - 2] = relativeX; 
                existingPoints[existingPoints.length - 1] = relativeY;
                
                existingPoints.push(relativeX, relativeY); 

                const updatedShape = { ...currentDrawingShape, points: existingPoints };
                onUpdateSingleShape(updatedShape); 
                setCurrentDrawingShape(updatedShape);
            }
        }
    }
  };

  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    const pos = getPointerPosition(); 

    if (currentTool === 'select' && selectionRect?.visible && !isDraggingVertex ) {
       setSelectionRect(prev => prev ? {...prev, width: pos.x - prev.x, height: pos.y - prev.y} : null);
       return;
    }

    if (!isDrawing || !currentDrawingShape) return;

    let updatedShape = { ...currentDrawingShape };
    switch (updatedShape.type) {
      case 'rectangle':
        updatedShape.width = pos.x - updatedShape.x;
        updatedShape.height = pos.y - updatedShape.y;
        break;
      case 'ellipse':
        const startX = currentDrawingShape.x; 
        const startY = currentDrawingShape.y;
        updatedShape.x = (startX + pos.x) / 2;
        updatedShape.y = (startY + pos.y) / 2;
        updatedShape.width = Math.abs(pos.x - startX);
        updatedShape.height = Math.abs(pos.y - startY);
        break;
      case 'line':
        updatedShape.points = [0, 0, pos.x - updatedShape.x, pos.y - updatedShape.y];
        break;
      case 'polyline':
      case 'polygon':
        const livePoints = [...updatedShape.points];
        livePoints[livePoints.length-2] = pos.x - updatedShape.x; 
        livePoints[livePoints.length-1] = pos.y - updatedShape.y;
        updatedShape.points = livePoints;
        break;
    }
    const existingKonvaShape = layerRef.current?.findOne('#' + updatedShape.id);
    if (existingKonvaShape) {
        if (updatedShape.type === 'ellipse') {
            existingKonvaShape.x(updatedShape.x);
            existingKonvaShape.y(updatedShape.y);
            (existingKonvaShape as Konva.Ellipse).radiusX(updatedShape.width / 2);
            (existingKonvaShape as Konva.Ellipse).radiusY(updatedShape.height / 2);
        } else if (updatedShape.type === 'rectangle') {
            existingKonvaShape.width(updatedShape.width);
            existingKonvaShape.height(updatedShape.height);
        } else if (updatedShape.type === 'line' || updatedShape.type === 'polyline' || updatedShape.type === 'polygon') {
            (existingKonvaShape as Konva.Line).points(updatedShape.points);
        }
        existingKonvaShape.getLayer()?.batchDraw();
    }
    setCurrentDrawingShape(updatedShape); 
  };

  const handleMouseUp = (e: KonvaEventObject<MouseEvent>) => {
    if (isDraggingVertex) { 
        return;
    }

    if (currentTool === 'select' && selectionRect?.visible && selectionRectRef.current) {
        setSelectionRect(prev => prev ? {...prev, visible: false} : null);
        const selBox = selectionRectRef.current.getClientRect({relativeTo: layerRef.current}); 
        const newlySelectedIds: string[] = [];
        layerRef.current?.find('.shape-draggable').forEach(node => {
            if (node.getParent() instanceof Konva.Transformer) return; 
            const nodeBox = node.getClientRect({relativeTo: layerRef.current});
            if (Konva.Util.haveIntersection(selBox, nodeBox)) {
                newlySelectedIds.push(node.id());
            }
        });
        setSelectedShapeIds(newlySelectedIds);
        if (newlySelectedIds.length > 0) {
            setEditingShapeId(null); 
            setLiveEditingShape(null);
        }
        return;
    }

    if (isDrawing && currentDrawingShape && (currentDrawingShape.type === 'rectangle' || currentDrawingShape.type === 'ellipse' || currentDrawingShape.type === 'line')) {
      let finalShape = { ...currentDrawingShape };

      if ((finalShape.type === 'rectangle' || finalShape.type === 'ellipse')) {
        if (finalShape.width && finalShape.width < 0) {
          finalShape.x = finalShape.x + finalShape.width;
          finalShape.width = -finalShape.width;
        }
        if (finalShape.height && finalShape.height < 0) {
          finalShape.y = finalShape.y + finalShape.height;
          finalShape.height = -finalShape.height;
        }
        if(isSnapToGridActive){ 
            finalShape.x = snapValue(finalShape.x, gridSize);
            finalShape.y = snapValue(finalShape.y, gridSize);
            finalShape.width = Math.max(gridSize, snapValue(finalShape.width, gridSize));
            finalShape.height = Math.max(gridSize, snapValue(finalShape.height, gridSize));
        } else {
            if (finalShape.width !== undefined && finalShape.width < 5) finalShape.width = 5;
            if (finalShape.height !== undefined && finalShape.height < 5) finalShape.height = 5;
        }
         onUpdateSingleShape(finalShape); 
      } else if (finalShape.type === 'line') {
        const points = finalShape.points;
        if (points.length === 4) {
            const [x1,y1,x2, y2] = [points[0], points[1], points[2], points[3]]; 
            const minLength = isSnapToGridActive ? gridSize / 2 : 5;
            if (Math.sqrt(Math.pow(x2-x1,2) + Math.pow(y2-y1,2)) < minLength) { 
                onUpdateShapes(shapes.filter(s => s.id !== finalShape.id)); 
            } else {
                 onUpdateSingleShape(finalShape); 
            }
        }
      }
      setIsDrawing(false);
      setCurrentDrawingShape(null);
    }
  };

  const handleDoubleClick = (e: KonvaEventObject<MouseEvent>) => {
    if (currentTool === 'select') {
        let shapeNode = e.target;
        while (shapeNode.getParent() && shapeNode.getParent() !== layerRef.current && !shapeNode.id()) {
            if (shapeNode.getParent() instanceof Konva.Transformer) {
                shapeNode = shapeNode.getParent().nodes()[0] || shapeNode; 
                break;
            }
            shapeNode = shapeNode.getParent();
        }
        const shapeId = shapeNode.id();
        const shape = shapes.find(s => s.id === shapeId);

        if (shape && (shape.type === 'line' || shape.type === 'polyline' || shape.type === 'polygon')) {
            if (selectedShapeIds.length === 1 && selectedShapeIds[0] === shapeId) {
                setEditingShapeId(prevId => {
                    const newEditingId = prevId === shapeId ? null : shapeId;
                    if (newEditingId) {
                        const shapeToEdit = shapes.find(s => s.id === newEditingId);
                        setLiveEditingShape(shapeToEdit ? JSON.parse(JSON.stringify(shapeToEdit)) : null);
                    } else {
                        setLiveEditingShape(null);
                    }
                    return newEditingId;
                });
            } else {
                 setSelectedShapeIds([shapeId]); 
                 setEditingShapeId(shapeId); 
                 const shapeToEdit = shapes.find(s => s.id === shapeId);
                 setLiveEditingShape(shapeToEdit ? JSON.parse(JSON.stringify(shapeToEdit)) : null);
            }
        } else {
            setEditingShapeId(null); 
            setLiveEditingShape(null);
        }
    }
  };

  const handleDragEnd = (e: KonvaEventObject<DragEvent>, id: string) => {
    const node = e.target;
    const originalShape = shapes.find(s => s.id === id);

    if (originalShape && originalShape.draggable !== false && !isDraggingVertex ) { 
        let newX = node.x();
        let newY = node.y();

        if (isSnapToGridActive && layerRef.current) {
            // Get the current bounding box's top-left in world coordinates
            const currentBBox = node.getClientRect({ relativeTo: layerRef.current });
            const currentBBoxTopLeftX = currentBBox.x;
            const currentBBoxTopLeftY = currentBBox.y;

            // Snap these coordinates
            const snappedBBoxTopLeftX = snapValue(currentBBoxTopLeftX, gridSize);
            const snappedBBoxTopLeftY = snapValue(currentBBoxTopLeftY, gridSize);

            // Calculate the required adjustment to the shape's origin
            const deltaX = snappedBBoxTopLeftX - currentBBoxTopLeftX;
            const deltaY = snappedBBoxTopLeftY - currentBBoxTopLeftY;

            // Calculate the new origin for the shape
            newX = node.x() + deltaX;
            newY = node.y() + deltaY;
        }
        
        node.position({ x: newX, y: newY }); 
        const updatedShape: Shape = {
            ...(originalShape as Shape), 
            x: newX,
            y: newY,
        };
        onUpdateSingleShape(updatedShape);
    }
  };

  const handleTransformEnd = (e: KonvaEventObject<Event>) => {
    const transformedNode = e.target as Konva.Node; 
    const shapeId = transformedNode.id();
    const originalShape = shapes.find(s => s.id === shapeId);

    if (originalShape) {
      let newX = transformedNode.x();
      let newY = transformedNode.y();
      let newRotation = parseFloat(transformedNode.rotation().toFixed(2));
      let newScaleX = parseFloat(transformedNode.scaleX().toFixed(3));
      let newScaleY = parseFloat(transformedNode.scaleY().toFixed(3));
      
      let newWidth = originalShape.width; 
      let newHeight = originalShape.height;

      if (originalShape.type === 'rectangle' || originalShape.type === 'ellipse') {
        newWidth = transformedNode.width() * newScaleX; 
        newHeight = transformedNode.height() * newScaleY; 

        if (isSnapToGridActive) {
            const originXToSnap = originalShape.type === 'ellipse' ? newX - newWidth / 2 : newX;
            const originYToSnap = originalShape.type === 'ellipse' ? newY - newHeight / 2 : newY;

            const snappedOriginX = snapValue(originXToSnap, gridSize);
            const snappedOriginY = snapValue(originYToSnap, gridSize);
            
            newWidth = Math.max(gridSize, snapValue(newWidth, gridSize));
            newHeight = Math.max(gridSize, snapValue(newHeight, gridSize));

            if(originalShape.type === 'ellipse'){
                newX = snappedOriginX + newWidth / 2;
                newY = snappedOriginY + newHeight / 2;
            } else { 
                newX = snappedOriginX;
                newY = snappedOriginY;
            }
        }
        newScaleX = 1; 
        newScaleY = 1;
      } else if (isSnapToGridActive && (originalShape.type === 'group' || originalShape.type === 'text' || originalShape.type === 'line' || originalShape.type === 'polyline' || originalShape.type === 'polygon')) { 
        if (layerRef.current) {
            const currentBBox = transformedNode.getClientRect({ relativeTo: layerRef.current });
            const snappedBBoxTopLeftX = snapValue(currentBBox.x, gridSize);
            const snappedBBoxTopLeftY = snapValue(currentBBox.y, gridSize);
            const deltaX = snappedBBoxTopLeftX - currentBBox.x;
            const deltaY = snappedBBoxTopLeftY - currentBBox.y;
            newX = transformedNode.x() + deltaX;
            newY = transformedNode.y() + deltaY;
        }
      }
      
      transformedNode.x(newX);
      transformedNode.y(newY);
      transformedNode.rotation(newRotation);
      transformedNode.scaleX(newScaleX);
      transformedNode.scaleY(newScaleY);
      if (originalShape.type === 'rectangle' || originalShape.type === 'ellipse') {
        transformedNode.width(newWidth!); 
        transformedNode.height(newHeight!);
      }

      const updatedAttrs: Partial<Shape> = {
        x: newX,
        y: newY,
        rotation: newRotation,
        scaleX: newScaleX,
        scaleY: newScaleY,
        width: newWidth,
        height: newHeight,
      };
      onUpdateSingleShape({ ...originalShape, ...updatedAttrs } as Shape);
    }
  };
  
  const handleEndpointDragStart = (e: KonvaEventObject<DragEvent>, shapeId: string) => {
    e.cancelBubble = true; 
    setIsDraggingVertex(true);
    const stage = stageRef.current;
    if (stage) stage.container().style.cursor = 'grabbing';
    
    const shapeToEdit = shapes.find(s => s.id === shapeId);
    if (shapeToEdit && (shapeToEdit.type === 'line' || shapeToEdit.type === 'polyline' || shapeToEdit.type === 'polygon')) {
        setLiveEditingShape(JSON.parse(JSON.stringify(shapeToEdit))); 
    }
  };

  const handleEndpointDragMove = (
      e: KonvaEventObject<DragEvent>,
      shapeId: string,
      pointIndex: number 
  ) => {
      const stage = e.target.getStage();
      if (!stage || !liveEditingShape || liveEditingShape.id !== shapeId) return;

      const rawPointerPos = stage.getPointerPosition(); 
      if (!rawPointerPos) return;

      let worldX = (rawPointerPos.x - viewTransform.x) / viewTransform.scale;
      let worldY = (rawPointerPos.y - viewTransform.y) / viewTransform.scale;
      let snappedWorldPoint = { x: worldX, y: worldY };

      if (isSnapToGridActive) {
          snappedWorldPoint = snapPoint({ x: worldX, y: worldY }, gridSize);
      }
      
      e.target.x(snappedWorldPoint.x); 
      e.target.y(snappedWorldPoint.y);

      const konvaShapeNode = layerRef.current?.findOne('#' + shapeId) as Konva.Line | undefined;
      if (!konvaShapeNode) return;
      
      const transformToLocal = konvaShapeNode.getAbsoluteTransform().copy().invert();
      const localSnappedPoint = transformToLocal.point(snappedWorldPoint);
      
      setLiveEditingShape(prev => {
          if (!prev || prev.id !== shapeId) return prev;
          const newPoints = [...(prev.points || [])];
          newPoints[pointIndex] = localSnappedPoint.x;
          newPoints[pointIndex + 1] = localSnappedPoint.y;
          return { ...prev, points: newPoints };
      });
  };

  const handleEndpointDragEnd = (
      e: KonvaEventObject<DragEvent>, 
      shapeId: string,
      pointIndex: number 
  ) => {
      setIsDraggingVertex(false);
      const stage = stageRef.current;
      if (stage) stage.container().style.cursor = 'default'; 
      
      if (!liveEditingShape || liveEditingShape.id !== shapeId) {
          setLiveEditingShape(null);
          return;
      }

      const konvaShapeNode = layerRef.current?.findOne('#' + shapeId) as Konva.Line | undefined;
      if (!konvaShapeNode) {
        setLiveEditingShape(null);
        return;
      }
      
      // Use the final points from liveEditingShape, which were derived from snapped world coords
      onUpdateSingleShape(liveEditingShape);
      setLiveEditingShape(null);

      if (selectionRect?.visible) { 
        setSelectionRect(prev => prev ? { ...prev, visible: false } : null);
      }
  };

  const handleStageWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const scaleBy = 1.1;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    let newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    newScale = Math.max(0.1, Math.min(newScale, 10));

    stage.scale({ x: newScale, y: newScale });

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    stage.position(newPos);
    
    setViewTransform({ x: newPos.x, y: newPos.y, scale: newScale });
    updateTransformerAppearance(transformerRef.current, newScale);
    stage.batchDraw();
  };
  
  const handleVertexMouseAction = (isEnter: boolean) => {
    const stage = stageRef.current;
    if (stage && !isDraggingVertex ) { 
        stage.container().style.cursor = isEnter ? 'move' : 'default';
    }
  };

  const renderShape = (shape: Shape): React.ReactNode => {
    const shapeForHandles = (liveEditingShape && liveEditingShape.id === shape.id && editingShapeId === shape.id) 
                                    ? liveEditingShape 
                                    : shape;

    const currentStageScale = viewTransform.scale;
    const baseHitStrokeWidth = shapeForHandles.strokeWidth || defaultStrokeWidth;
    const hitStrokeWidth = Math.max(5 / currentStageScale, (baseHitStrokeWidth + 10) / currentStageScale);


    const baseProps: any = {
      key: shapeForHandles.id,
      id: shapeForHandles.id,
      x: shapeForHandles.x,
      y: shapeForHandles.y,
      rotation: shapeForHandles.rotation || 0,
      scaleX: shapeForHandles.scaleX || 1,
      scaleY: shapeForHandles.scaleY || 1,
      draggable: currentTool === 'select' && (shapeForHandles.draggable !== false) && !isDraggingVertex && editingShapeId !== shapeForHandles.id && !(selectedShapeIds.includes(shapeForHandles.id) && selectedShapeIds.length > 1 && editingShapeId),
      onDragEnd: (evt: KonvaEventObject<DragEvent>) => handleDragEnd(evt, shapeForHandles.id),
      onTransformEnd: handleTransformEnd,
      opacity: shapeForHandles.opacity ?? 1,
      strokeScaleEnabled: false, 
      name: 'shape-draggable', 
      perfectDrawEnabled: false, 
    };

    switch (shapeForHandles.type) {
      case 'rectangle':
        const rect = shapeForHandles as RectangleShape;
        return <Rect {...baseProps} width={rect.width} height={rect.height} fill={rect.fill} stroke={rect.stroke} strokeWidth={rect.strokeWidth} dash={rect.dash} hitStrokeWidth={hitStrokeWidth} />;
      case 'ellipse':
        const ellipse = shapeForHandles as EllipseShape;
        return <Ellipse {...baseProps} radiusX={ellipse.width / 2} radiusY={ellipse.height / 2} fill={ellipse.fill} stroke={ellipse.stroke} strokeWidth={ellipse.strokeWidth} dash={ellipse.dash} hitStrokeWidth={hitStrokeWidth} />;
      case 'line':
        const line = shapeForHandles as LineShape;
        return (
            <KonvaLine 
                {...baseProps} 
                points={line.points} 
                stroke={line.stroke} 
                strokeWidth={line.strokeWidth} 
                dash={line.dash} 
                hitStrokeWidth={hitStrokeWidth}
                onDragMove={(e: KonvaEventObject<DragEvent>) => { 
                    if (selectedShapeIds.length === 1 && selectedShapeIds[0] === line.id && !isDraggingVertex) {
                        const lineNode = e.target as Konva.Line;
                        const absPos = lineNode.absolutePosition();
                        const absRot = lineNode.getAbsoluteRotation();
                        const absScale = lineNode.getAbsoluteScale();

                        const transform = new Konva.Transform();
                        transform.translate(absPos.x, absPos.y); 
                        transform.rotate(Konva.getAngle(absRot));
                        transform.scale(absScale.x, absScale.y);
                        
                        const p1_world = transform.point({x: line.points[0], y: line.points[1]});
                        const p2_world = transform.point({x: line.points[2], y: line.points[3]});

                        if (startHandleRef.current) {
                            startHandleRef.current.absolutePosition(p1_world);
                        }
                        if (endHandleRef.current) {
                            endHandleRef.current.absolutePosition(p2_world);
                        }
                        lineNode.getLayer()?.batchDraw();
                    }
                }}
            />
        );
      case 'polyline':
        const polyline = shapeForHandles as PolylineShape;
        return <KonvaLine {...baseProps} 
                          points={polyline.points} 
                          stroke={polyline.stroke} 
                          strokeWidth={polyline.strokeWidth} 
                          dash={polyline.dash} 
                          fillEnabled={false} 
                          hitStrokeWidth={hitStrokeWidth} 
                          onDragMove={(e: KonvaEventObject<DragEvent>) => {
                            if (editingShapeId === polyline.id && !isDraggingVertex) { 
                                const draggedNode = e.target as Konva.Line;
                                const absTransform = draggedNode.getAbsoluteTransform();
                                
                                for (let i = 0; i < polyline.points.length; i += 2) {
                                    const handleNode = layerRef.current?.findOne(`#vertex-handle-${polyline.id}-${i/2}`) as Konva.Circle | undefined;
                                    if (handleNode) {
                                        const transformedPoint = absTransform.point({x: polyline.points[i], y: polyline.points[i+1]});
                                        handleNode.absolutePosition(transformedPoint);
                                    }
                                }
                                draggedNode.getLayer()?.batchDraw();
                            }
                          }}
                />;
      case 'polygon':
        const polygon = shapeForHandles as PolygonShape;
        return <KonvaLine {...baseProps} 
                          points={polygon.points} 
                          stroke={polygon.stroke} 
                          strokeWidth={polygon.strokeWidth} 
                          dash={polygon.dash} 
                          fill={polygon.fill} 
                          closed={true} 
                          hitStrokeWidth={hitStrokeWidth}
                          onDragMove={(e: KonvaEventObject<DragEvent>) => {
                             if (editingShapeId === polygon.id && !isDraggingVertex) { 
                                const draggedNode = e.target as Konva.Line;
                                const absTransform = draggedNode.getAbsoluteTransform();
                                
                                for (let i = 0; i < polygon.points.length; i += 2) {
                                    const handleNode = layerRef.current?.findOne(`#vertex-handle-${polygon.id}-${i/2}`) as Konva.Circle | undefined;
                                    if (handleNode) {
                                         const transformedPoint = absTransform.point({x: polygon.points[i], y: polygon.points[i+1]});
                                        handleNode.absolutePosition(transformedPoint);
                                    }
                                }
                                draggedNode.getLayer()?.batchDraw();
                            }
                          }}
                />;
      case 'text':
        const text = shapeForHandles as TextShape;
        return <KonvaText {...baseProps} text={text.text} fontSize={text.fontSize} fontFamily={text.fontFamily} fill={text.fill} width={text.width} height={text.height} align={text.align} verticalAlign={text.verticalAlign} padding={text.padding} lineHeight={text.lineHeight} wrap={text.wrap} ellipsis={text.ellipsis} fontStyle={text.fontStyle} textDecoration={text.textDecoration} hitStrokeWidth={hitStrokeWidth}/>;
      case 'group':
        const group = shapeForHandles as GroupShape;
        const clipFunc = (group.width && group.height) ? (ctx: Konva.Context) => {
            ctx.rect(0, 0, group.width!, group.height!); 
        } : undefined;

        return (
            <KonvaGroup {...baseProps} width={group.width} height={group.height} clipFunc={clipFunc}>
                {group.children.map(childId => {
                     const childShape = shapes.find(s => s.id === childId) || 
                                     (liveEditingShape?.type === 'group' && (liveEditingShape as GroupShape).children.find(c => c.id === childId)) ||
                                     (shapeForHandles?.type === 'group' && (shapeForHandles as GroupShape).children.find(c => c.id === childId));
                     return childShape ? renderShape(childShape) : null;
                })}
            </KonvaGroup>
        );
      default:
        const _exhaustiveCheck: never = shapeForHandles;
        return null;
    }
  };

  const handleRadius = Math.max(3, 6 / viewTransform.scale); 
  const handleStrokeWidth = Math.max(0.5, 1 / viewTransform.scale); 

  const gridDots = useMemo(() => {
    if (!isSnapToGridActive || !stageRef.current || gridSize <= 0) {
      return [];
    }
    
    const stageW = containerSize.width;
    const stageH = containerSize.height;

    const viewRectX = -viewTransform.x / viewTransform.scale;
    const viewRectY = -viewTransform.y / viewTransform.scale;
    const viewRectWidth = stageW / viewTransform.scale;
    const viewRectHeight = stageH / viewTransform.scale;

    const startGridX = Math.floor(viewRectX / gridSize) * gridSize;
    const startGridY = Math.floor(viewRectY / gridSize) * gridSize;
    const endGridX = viewRectX + viewRectWidth;
    const endGridY = viewRectY + viewRectHeight;

    const dots = [];
    for (let x = startGridX; x < endGridX; x += gridSize) {
      for (let y = startGridY; y < endGridY; y += gridSize) {
        dots.push({ id: `grid-dot-${x}-${y}`, x, y });
      }
    }
    return dots;
  }, [isSnapToGridActive, gridSize, viewTransform, containerSize.width, containerSize.height]);


  return (
    <div ref={containerRef} className="w-full h-full absolute top-0 left-0">
      <Stage
        ref={stageRef}
        width={containerSize.width}
        height={containerSize.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleStageWheel}
        onDblClick={handleDoubleClick}
        draggable={currentTool === 'select' && selectedShapeIds.length === 0 && !isDrawing && !selectionRect?.visible && !isDraggingVertex && !editingShapeId && !isPlacingStampActive}
        onDragEnd={(e) => { 
          if (e.target === stageRef.current && stageRef.current) {
            setViewTransform({ x: stageRef.current.x(), y: stageRef.current.y(), scale: stageRef.current.scaleX() });
          }
        }}
        style={{ cursor: isPlacingStampActive ? 'copy' : (currentTool === 'select' ? ( (isDrawing || selectionRect?.visible || isDraggingVertex || editingShapeId) ? 'crosshair' : (stageRef.current?.isDragging() ? 'grabbing' : 'grab')) : 'crosshair') }}
      >
        <Layer ref={layerRef}>
          {isSnapToGridActive && gridDots.map(dot => (
            <Circle
              key={dot.id}
              x={dot.x}
              y={dot.y}
              radius={Math.max(0.3, 0.75 / viewTransform.scale)}
              fill="#cccccc"
              listening={false}
              perfectDrawEnabled={false}
            />
          ))}
          {shapes.map(shape => renderShape(shape))}
          <Transformer
            ref={transformerRef}
            boundBoxFunc={(oldBox, newBox) => { 
              if (isSnapToGridActive) {
                newBox.x = snapValue(newBox.x, gridSize);
                newBox.y = snapValue(newBox.y, gridSize);
                newBox.width = Math.max(gridSize, snapValue(newBox.width, gridSize));
                newBox.height = Math.max(gridSize, snapValue(newBox.height, gridSize));
              } else {
                 if (newBox.width < 5) newBox.width = 5;
                 if (newBox.height < 5) newBox.height = 5;
              }
              return newBox;
            }}
            anchorStroke="hsl(var(--primary))"
            anchorFill="hsl(var(--background))"
            borderStroke="hsl(var(--primary))"
            rotateEnabled={true} 
            resizeEnabled={true} 
            enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']}
            strokeScaleEnabled={false} 
          />
          {selectedShapeIds.length === 1 && (() => {
            const selectedShapeModel = shapes.find(s => s.id === selectedShapeIds[0]);
            if (!selectedShapeModel) return null;

            const konvaNode = layerRef.current?.findOne('#' + selectedShapeModel.id);
            if (!konvaNode) return null;
            
            const shapeToUseForHandles = (liveEditingShape && liveEditingShape.id === selectedShapeModel.id && editingShapeId === selectedShapeModel.id) 
                                    ? liveEditingShape 
                                    : selectedShapeModel;
            
            const currentAbsoluteTransform = konvaNode.getAbsoluteTransform();

            if (shapeToUseForHandles.type === 'line') {
              const line = shapeToUseForHandles as LineShape;
              if (line.points.length < 4) return null;
              const p1_world = currentAbsoluteTransform.point({x: line.points[0], y: line.points[1]});
              const p2_world = currentAbsoluteTransform.point({x: line.points[2], y: line.points[3]});
              
              return (
                <React.Fragment>
                  <Circle
                      key={`${line.id}-handle-start`}
                      ref={startHandleRef}
                      id={`${line.id}-handle-start`} 
                      x={p1_world.x} y={p1_world.y}
                      radius={handleRadius} fill="red" stroke="white" strokeWidth={handleStrokeWidth}
                      draggable={currentTool === 'select'}
                      onDragStart={(e) => handleEndpointDragStart(e, line.id)}
                      onDragMove={(e) => handleEndpointDragMove(e, line.id, 0)}
                      onDragEnd={(e) => handleEndpointDragEnd(e, line.id, 0)}
                      onMouseEnter={() => handleVertexMouseAction(true)}
                      onMouseLeave={() => handleVertexMouseAction(false)}
                      name="line-handle" data-shape-id={line.id} 
                      hitStrokeWidth={Math.max(10, 15 / viewTransform.scale)} 
                    />
                    <Circle
                      key={`${line.id}-handle-end`}
                      ref={endHandleRef}
                      id={`${line.id}-handle-end`} 
                      x={p2_world.x} y={p2_world.y}
                      radius={handleRadius} fill="red" stroke="white" strokeWidth={handleStrokeWidth}
                      draggable={currentTool === 'select'}
                      onDragStart={(e) => handleEndpointDragStart(e, line.id)}
                      onDragMove={(e) => handleEndpointDragMove(e, line.id, 2)}
                      onDragEnd={(e) => handleEndpointDragEnd(e, line.id, 2)}
                      onMouseEnter={() => handleVertexMouseAction(true)}
                      onMouseLeave={() => handleVertexMouseAction(false)}
                      name="line-handle" data-shape-id={line.id} 
                      hitStrokeWidth={Math.max(10, 15 / viewTransform.scale)} 
                    />
                </React.Fragment>
              );
            }
            else if ((shapeToUseForHandles.type === 'polyline' || shapeToUseForHandles.type === 'polygon') && editingShapeId === shapeToUseForHandles.id) {
                const polyShape = shapeToUseForHandles as PolylineShape | PolygonShape;
                return (
                    <React.Fragment>
                        {polyShape.points.map((_, i) => {
                            if (i % 2 !== 0) return null; 
                            if (i + 1 >= polyShape.points.length) return null;
                            const p_world = currentAbsoluteTransform.point({x: polyShape.points[i], y: polyShape.points[i+1]});
                            return (
                                <Circle
                                    key={`${polyShape.id}-vertex-${i/2}`}
                                    id={`vertex-handle-${polyShape.id}-${i/2}`} 
                                    x={p_world.x} y={p_world.y}
                                    radius={handleRadius} fill="hsl(var(--accent))" stroke="hsl(var(--accent-foreground))" strokeWidth={handleStrokeWidth}
                                    draggable={currentTool === 'select'}
                                    onDragStart={(e) => handleEndpointDragStart(e, polyShape.id)}
                                    onDragMove={(e) => handleEndpointDragMove(e, polyShape.id, i)}
                                    onDragEnd={(e) => handleEndpointDragEnd(e, polyShape.id, i)}
                                    onMouseEnter={() => handleVertexMouseAction(true)}
                                    onMouseLeave={() => handleVertexMouseAction(false)}
                                    name="vertex-handle" data-shape-id={polyShape.id}
                                    hitStrokeWidth={Math.max(10, 15 / viewTransform.scale)} 
                                />
                            );
                        })}
                    </React.Fragment>
                );
            }
            return null;
          })()}

          {selectionRect?.visible && (
            <Rect
              ref={selectionRectRef}
              x={selectionRect.x}
              y={selectionRect.y}
              width={selectionRect.width}
              height={selectionRect.height}
              fill="rgba(var(--accent-rgb), 0.15)" 
              stroke="hsl(var(--accent))"
              strokeWidth={1 / viewTransform.scale}
              visible={selectionRect.visible}
              listening={false} 
              name="selection-rectangle-class" 
              strokeScaleEnabled={false}
            />
          )}
          {multiSelectBounds?.visible && (
            <Rect
              x={multiSelectBounds.x}
              y={multiSelectBounds.y}
              width={multiSelectBounds.width}
              height={multiSelectBounds.height}
              stroke="hsl(var(--primary))"
              strokeWidth={1 / viewTransform.scale}
              dash={[Math.max(2, 5 / viewTransform.scale), Math.max(2, 5 / viewTransform.scale)]}
              listening={false}
              name="multi-select-bounds-class"
              strokeScaleEnabled={false}
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
};

export default KonvaCanvas;
