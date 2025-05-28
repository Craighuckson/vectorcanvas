
"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
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
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; width: number; height: number; visible: boolean } | null>(null);
  const selectionRectRef = useRef<Konva.Rect>(null);
  const [isDraggingLineHandle, setIsDraggingLineHandle] = useState<boolean>(false);
  const [editingShapeId, setEditingShapeId] = useState<string | null>(null);
  const [isDraggingVertex, setIsDraggingVertex] = useState<boolean>(false);
  const [multiSelectBounds, setMultiSelectBounds] = useState<{ x: number, y: number, width: number, height: number, visible: boolean } | null>(null);


  const updateTransformerAppearance = useCallback((konvaTransformer: Konva.Transformer | null, stageScale: number) => {
    if (!konvaTransformer) return;

    const baseAnchorSize = 8;
    const baseRotateAnchorOffset = 20;
    const baseBorderDashElement = 3;
    const basePadding = 2;

    konvaTransformer.anchorSize(Math.max(4, baseAnchorSize / stageScale)); // Ensure minimum visual size of 4px
    konvaTransformer.rotateAnchorOffset(Math.max(10, baseRotateAnchorOffset / stageScale));
    konvaTransformer.borderDash([Math.max(1, baseBorderDashElement / stageScale), Math.max(1, baseBorderDashElement / stageScale)]);
    konvaTransformer.padding(Math.max(1, basePadding / stageScale));
    
    // Ensure anchors are visually distinct (already set in Transformer props but good to centralize if needed)
    // konvaTransformer.anchorStroke("hsl(var(--primary))");
    // konvaTransformer.anchorFill("hsl(var(--background))");
    // konvaTransformer.borderStroke("hsl(var(--primary))");

    konvaTransformer.getLayer()?.batchDraw();
  }, []);


  useEffect(() => {
    if (transformerRef.current && layerRef.current && stageRef.current) {
      const selectedKonvaNodes: Konva.Node[] = [];
      let hideTransformer = false;
      const currentStageScale = stageRef.current.scaleX();

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
          const shape = shapes.find(s => s.id === id);
          const node = layerRef.current?.findOne('#' + id);
          if (node) {
            if (shape && shape.type !== 'line' && !((shape.type === 'polyline' || shape.type === 'polygon') && editingShapeId === shape.id) ) { 
              selectedKonvaNodes.push(node);
            }
            // For multiSelectBounds, include all selected nodes
            const nodeRect = node.getClientRect({ relativeTo: layerRef.current }); // Get rect relative to layer for correct positioning
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
      updateTransformerAppearance(transformerRef.current, currentStageScale);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selectedShapeIds, shapes, editingShapeId, updateTransformerAppearance, stageRef]);


  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isDrawing && currentDrawingShape && (currentDrawingShape.type === 'polyline' || currentDrawingShape.type === 'polygon')) {
        if (event.key === 'Escape' || event.key === 'Enter') {
          event.preventDefault();
          event.stopPropagation(); 

          let finalShape = { ...currentDrawingShape };
          if (finalShape.points.length > 2) { 
            finalShape.points = finalShape.points.slice(0, -2);
          }

          const minPoints = finalShape.type === 'polyline' ? 4 : (finalShape.type === 'polygon' ? 6 : 0);
          if (finalShape.points.length < minPoints) {
            onUpdateShapes(shapes.filter(s => s.id !== finalShape.id)); 
          } else {
            onUpdateSingleShape(finalShape);
          }
          setIsDrawing(false);
          setCurrentDrawingShape(null);
        }
      }
    };

    if (isDrawing && (currentDrawingShape?.type === 'polyline' || currentDrawingShape?.type === 'polygon')) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDrawing, currentDrawingShape, onUpdateSingleShape, onUpdateShapes, shapes]);


  const getPointerPosition = (stage: Konva.Stage | null) => {
    if (!stage) return { x: 0, y: 0 };
    const pos = stage.getPointerPosition();
    if (!pos) return { x: 0, y: 0 };
    return {
      x: (pos.x - stage.x()) / stage.scaleX(),
      y: (pos.y - stage.y()) / stage.scaleY(),
    };
  };

  const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;

    const pos = getPointerPosition(stage);

    if (isPlacingStampActive && currentTool === 'stamp') {
      onPlaceStamp(pos.x, pos.y);
      return;
    }


    if (e.target.name() === 'line-handle' || e.target.name() === 'vertex-handle') {
      setIsDraggingLineHandle(e.target.name() === 'line-handle');
      setIsDraggingVertex(e.target.name() === 'vertex-handle');
      if (selectionRect?.visible) {
        setSelectionRect(prev => prev ? { ...prev, visible: false } : null);
      }
      return;
    }
    
    if (editingShapeId) {
      const clickedShapeId = e.target.id();
      const isVertexHandleOfEditingShape = e.target.name() === 'vertex-handle' && e.target.attrs['data-shape-id'] === editingShapeId;
      const isLineHandleOfEditingShape = e.target.name() === 'line-handle' && e.target.attrs['data-shape-id'] === editingShapeId;

      if (clickedShapeId !== editingShapeId && !isVertexHandleOfEditingShape && !isLineHandleOfEditingShape && e.target === stage) {
        setEditingShapeId(null);
      }
    }


    if (currentTool === 'select') {
      const clickedOnEmpty = e.target === stage;
      if (clickedOnEmpty) {
        setSelectedShapeIds([]);
        setEditingShapeId(null); 
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
      const isSelected = selectedShapeIds.includes(shapeId);

      if (e.evt.metaKey || e.evt.ctrlKey) { 
        setSelectedShapeIds(isSelected ? selectedShapeIds.filter(id => id !== shapeId) : [...selectedShapeIds, shapeId]);
      } else { 
        if (shapeId) { 
            if (!isSelected) { 
                setSelectedShapeIds([shapeId]);
                if (editingShapeId && editingShapeId !== shapeId) setEditingShapeId(null); 
            } else if (selectedShapeIds.length > 1 && selectedShapeIds.includes(shapeId)) {
                setSelectedShapeIds([shapeId]); 
                if (editingShapeId && editingShapeId !== shapeId) setEditingShapeId(null);
            }
        } else { 
            setSelectedShapeIds([]);
            setEditingShapeId(null);
        }
      }
    } else if (['rectangle', 'ellipse', 'line', 'text'].includes(currentTool)) {
      setIsDrawing(true);
      setEditingShapeId(null); 
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
            initialShape = { id, type: 'text', text: defaultText, x: pos.x, y: pos.y, fontSize: 20, fontFamily: 'Arial', fill: defaultStrokeColor, draggable: true };
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
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = getPointerPosition(stage);

    if (currentTool === 'select' && selectionRect?.visible && !isDraggingLineHandle && !isDraggingVertex) {
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
     const stage = e.target.getStage();
     if (!stage) return;

    if (isDraggingLineHandle || isDraggingVertex) {
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
        if (newlySelectedIds.length > 0) setEditingShapeId(null); 
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
        if (finalShape.width !== undefined && finalShape.width < 5) finalShape.width = 5;
        if (finalShape.height !== undefined && finalShape.height < 5) finalShape.height = 5;
         onUpdateSingleShape(finalShape); 
      } else if (finalShape.type === 'line') {
        const points = finalShape.points;
        if (points.length === 4) {
            const [x1,y1,x2, y2] = [points[0], points[1], points[2], points[3]];
            if (Math.sqrt(Math.pow(x2-x1,2) + Math.pow(y2-y1,2)) < 5) { 
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
                setEditingShapeId(prevId => prevId === shapeId ? null : shapeId); 
            } else {
                 setSelectedShapeIds([shapeId]); 
                 setEditingShapeId(shapeId); 
            }
        } else {
            setEditingShapeId(null); 
        }
    }
  };

  const handleDragEnd = (e: KonvaEventObject<DragEvent>, id: string) => {
    const node = e.target;
    const originalShape = shapes.find(s => s.id === id);
    if (originalShape && originalShape.draggable !== false && !isDraggingVertex && !isDraggingLineHandle) { 
        const updatedShape: Shape = {
            ...(originalShape as Shape), 
            x: node.x(),
            y: node.y(),
        };
        onUpdateSingleShape(updatedShape);
    }
    setIsDraggingLineHandle(false);
    setIsDraggingVertex(false);
  };

  const handleTransformEnd = (e: KonvaEventObject<Event>) => {
    const transformedNode = e.target as Konva.Node; 
    const shapeId = transformedNode.id();
    const originalShape = shapes.find(s => s.id === shapeId);

    if (originalShape) {
      let updatedAttrs: Partial<Shape> = {
        x: transformedNode.x(),
        y: transformedNode.y(),
        rotation: parseFloat(transformedNode.rotation().toFixed(2)), 
      };

      if (originalShape.type === 'rectangle' || originalShape.type === 'ellipse') {
        updatedAttrs.width = transformedNode.width() * transformedNode.scaleX();
        updatedAttrs.height = transformedNode.height() * transformedNode.scaleY();
        transformedNode.scaleX(1); 
        transformedNode.scaleY(1);
        updatedAttrs.scaleX = 1; 
        updatedAttrs.scaleY = 1;
      } else if (originalShape.type === 'group' || originalShape.type === 'text' || originalShape.type === 'line' || originalShape.type === 'polyline' || originalShape.type === 'polygon') {
         updatedAttrs.scaleX = parseFloat(transformedNode.scaleX().toFixed(3));
         updatedAttrs.scaleY = parseFloat(transformedNode.scaleY().toFixed(3));
         if (originalShape.type === 'group' || originalShape.type === 'text') { 
             updatedAttrs.width = (originalShape.width || 0) * (updatedAttrs.scaleX || 1);
             updatedAttrs.height = (originalShape.height || 0) * (updatedAttrs.scaleY || 1);
         }
      }
      onUpdateSingleShape({ ...originalShape, ...updatedAttrs } as Shape);
    }
  };

  const handleEndpointDragStart = (type: 'line' | 'vertex', shapeId: string) => {
    if (type === 'line') setIsDraggingLineHandle(true);
    else setIsDraggingVertex(true);
    const stage = stageRef.current;
    if (stage) stage.container().style.cursor = 'grabbing';
  };

  const handleEndpointDragMove = (
      e: KonvaEventObject<DragEvent>,
      shapeId: string,
      pointIndex: number, 
      shapeType: 'line' | 'polyline' | 'polygon'
  ) => {
      const stage = e.target.getStage();
      if (!stage) return;

      const shape = shapes.find(s => s.id === shapeId) as LineShape | PolylineShape | PolygonShape | undefined;
      if (!shape) return;

      const posOnStage = stage.getPointerPosition(); 
      if (!posOnStage) return;

      const relativeX = (posOnStage.x - stage.x()) / stage.scaleX() - (shape.x || 0);
      const relativeY = (posOnStage.y - stage.y()) / stage.scaleY() - (shape.y || 0);
      
      const newPoints = [...shape.points];
      newPoints[pointIndex] = relativeX / (shape.scaleX || 1); 
      newPoints[pointIndex + 1] = relativeY / (shape.scaleY || 1);
      
      const konvaNode = layerRef.current?.findOne('#' + shapeId) as Konva.Line | undefined;
      if (konvaNode) {
          konvaNode.points(newPoints);
      }
      e.target.position({ x: posOnStage.x / stage.scaleX() - stage.x() / stage.scaleX() , y: posOnStage.y / stage.scaleY() - stage.y() / stage.scaleY() });
      layerRef.current?.batchDraw();
  };

  const handleEndpointDragEnd = (
      e: KonvaEventObject<DragEvent>,
      shapeId: string,
      pointIndex: number,
      shapeType: 'line' | 'polyline' | 'polygon'
  ) => {
      setIsDraggingLineHandle(false);
      setIsDraggingVertex(false);
      const stage = stageRef.current;
      if (stage) stage.container().style.cursor = 'default'; 
      if (!stage) return;

      const shape = shapes.find(s => s.id === shapeId) as LineShape | PolylineShape | PolygonShape | undefined;
      if (!shape) return;

      const posOnStage = stage.getPointerPosition(); 
      if (!posOnStage) return;
      
      const relativeX = (posOnStage.x - stage.x()) / stage.scaleX() - (shape.x || 0);
      const relativeY = (posOnStage.y - stage.y()) / stage.scaleY() - (shape.y || 0);
      
      const finalPoints = [...shape.points];
      finalPoints[pointIndex] = relativeX / (shape.scaleX || 1);
      finalPoints[pointIndex + 1] = relativeY / (shape.scaleY || 1);
      
      if (selectionRect?.visible) {
        setSelectionRect(prev => prev ? { ...prev, visible: false } : null);
      }
      onUpdateSingleShape({ ...shape, points: finalPoints });
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
    
    updateTransformerAppearance(transformerRef.current, newScale);
    stage.batchDraw();
  };
  
  const handleVertexMouseAction = (isEnter: boolean) => {
    const stage = stageRef.current;
    if (stage && !isDraggingVertex && !isDraggingLineHandle) { 
        stage.container().style.cursor = isEnter ? 'move' : 'default';
    }
  };


  const renderShape = (shape: Shape): React.ReactNode => {
    const currentStageScale = stageRef.current?.scaleX() || 1;
    const baseHitStrokeWidth = shape.strokeWidth || defaultStrokeWidth;
    const hitStrokeWidth = Math.max(5 / currentStageScale, (baseHitStrokeWidth + 10) / currentStageScale);

    const baseProps: any = {
      key: shape.id,
      id: shape.id,
      x: shape.x,
      y: shape.y,
      rotation: shape.rotation || 0,
      scaleX: shape.scaleX || 1,
      scaleY: shape.scaleY || 1,
      draggable: currentTool === 'select' && (shape.draggable !== false) && !isDraggingLineHandle && !isDraggingVertex && editingShapeId !== shape.id && !(selectedShapeIds.includes(shape.id) && selectedShapeIds.length > 1 && editingShapeId),
      onDragEnd: (evt: KonvaEventObject<DragEvent>) => handleDragEnd(evt, shape.id),
      onTransformEnd: handleTransformEnd,
      opacity: shape.opacity ?? 1,
      strokeScaleEnabled: false, 
      name: 'shape-draggable', 
      perfectDrawEnabled: false, 
    };

    switch (shape.type) {
      case 'rectangle':
        const rect = shape as RectangleShape;
        return <Rect {...baseProps} width={rect.width} height={rect.height} fill={rect.fill} stroke={rect.stroke} strokeWidth={rect.strokeWidth} dash={rect.dash} hitStrokeWidth={hitStrokeWidth} />;
      case 'ellipse':
        const ellipse = shape as EllipseShape;
        return <Ellipse {...baseProps} radiusX={ellipse.width / 2} radiusY={ellipse.height / 2} fill={ellipse.fill} stroke={ellipse.stroke} strokeWidth={ellipse.strokeWidth} dash={ellipse.dash} hitStrokeWidth={hitStrokeWidth} />;
      case 'line':
        const line = shape as LineShape;
        return (
            <KonvaLine 
                {...baseProps} 
                points={line.points} 
                stroke={line.stroke} 
                strokeWidth={line.strokeWidth} 
                dash={line.dash} 
                hitStrokeWidth={hitStrokeWidth}
                onDragMove={(e: KonvaEventObject<DragEvent>) => {
                    if (selectedShapeIds.length === 1 && selectedShapeIds[0] === line.id) {
                        const lineNode = e.target as Konva.Line;
                        const liveLineX = lineNode.x();
                        const liveLineY = lineNode.y();
                        const liveScaleX = lineNode.scaleX(); 
                        const liveScaleY = lineNode.scaleY();
                        if (startHandleRef.current) {
                            startHandleRef.current.x(liveLineX + line.points[0] * liveScaleX);
                            startHandleRef.current.y(liveLineY + line.points[1] * liveScaleY);
                        }
                        if (endHandleRef.current) {
                            endHandleRef.current.x(liveLineX + line.points[2] * liveScaleX);
                            endHandleRef.current.y(liveLineY + line.points[3] * liveScaleY);
                        }
                    }
                }}
            />
        );
      case 'polyline':
        const polyline = shape as PolylineShape;
        return <KonvaLine {...baseProps} 
                          points={polyline.points} 
                          stroke={polyline.stroke} 
                          strokeWidth={polyline.strokeWidth} 
                          dash={polyline.dash} 
                          fillEnabled={false} 
                          hitStrokeWidth={hitStrokeWidth} 
                          onDragMove={(e: KonvaEventObject<DragEvent>) => {
                            if (editingShapeId === polyline.id) { 
                                const draggedNode = e.target as Konva.Line;
                                const liveShapeX = draggedNode.x();
                                const liveShapeY = draggedNode.y();
                                const liveScaleX = draggedNode.scaleX(); 
                                const liveScaleY = draggedNode.scaleY();
                                for (let i = 0; i < polyline.points.length; i += 2) {
                                    const handleNode = layerRef.current?.findOne(`#vertex-handle-${polyline.id}-${i/2}`) as Konva.Circle | undefined;
                                    if (handleNode) {
                                        handleNode.x(liveShapeX + polyline.points[i] * liveScaleX);
                                        handleNode.y(liveShapeY + polyline.points[i+1] * liveScaleY);
                                    }
                                }
                            }
                          }}
                />;
      case 'polygon':
        const polygon = shape as PolygonShape;
        return <KonvaLine {...baseProps} 
                          points={polygon.points} 
                          stroke={polygon.stroke} 
                          strokeWidth={polygon.strokeWidth} 
                          dash={polygon.dash} 
                          fill={polygon.fill} 
                          closed={true} 
                          hitStrokeWidth={hitStrokeWidth}
                          onDragMove={(e: KonvaEventObject<DragEvent>) => {
                             if (editingShapeId === polygon.id) { 
                                const draggedNode = e.target as Konva.Line;
                                const liveShapeX = draggedNode.x();
                                const liveShapeY = draggedNode.y();
                                const liveScaleX = draggedNode.scaleX(); 
                                const liveScaleY = draggedNode.scaleY();
                                for (let i = 0; i < polygon.points.length; i += 2) {
                                    const handleNode = layerRef.current?.findOne(`#vertex-handle-${polygon.id}-${i/2}`) as Konva.Circle | undefined;
                                    if (handleNode) {
                                        handleNode.x(liveShapeX + polygon.points[i] * liveScaleX);
                                        handleNode.y(liveShapeY + polygon.points[i+1] * liveScaleY);
                                    }
                                }
                            }
                          }}
                />;
      case 'text':
        const text = shape as TextShape;
        return <KonvaText {...baseProps} text={text.text} fontSize={text.fontSize} fontFamily={text.fontFamily} fill={text.fill} width={text.width} height={text.height} align={text.align} verticalAlign={text.verticalAlign} padding={text.padding} lineHeight={text.lineHeight} wrap={text.wrap} ellipsis={text.ellipsis} fontStyle={text.fontStyle} textDecoration={text.textDecoration} hitStrokeWidth={hitStrokeWidth}/>;
      case 'group':
        const group = shape as GroupShape;
        const clipFunc = (group.width && group.height) ? (ctx: Konva.Context) => {
            ctx.rect(0, 0, group.width!, group.height!); 
        } : undefined;

        return (
            <KonvaGroup {...baseProps} width={group.width} height={group.height} clipFunc={clipFunc}>
                {group.children.map(child => renderShape(child))}
            </KonvaGroup>
        );
      default:
        return null;
    }
  };

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
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

  
  const currentStageScale = stageRef.current?.scaleX() || 1;
  const handleRadius = 6 / currentStageScale;
  const handleStrokeWidth = 1 / currentStageScale;

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
        draggable={currentTool === 'select' && selectedShapeIds.length === 0 && !isDrawing && !selectionRect?.visible && !isDraggingLineHandle && !isDraggingVertex && !editingShapeId && !isPlacingStampActive}
        style={{ cursor: isPlacingStampActive ? 'copy' : (currentTool === 'select' ? ( (isDrawing || selectionRect?.visible || isDraggingLineHandle || isDraggingVertex || editingShapeId) ? 'crosshair' : (stageRef.current?.isDragging() ? 'grabbing' : 'grab')) : 'crosshair') }}
      >
        <Layer ref={layerRef}>
          {shapes.map(shape => renderShape(shape))}
          <Transformer
            ref={transformerRef}
            boundBoxFunc={(oldBox, newBox) => { 
              if (newBox.width < 5 || newBox.height < 5) {
                return oldBox;
              }
              return newBox;
            }}
            anchorStroke="hsl(var(--primary))"
            anchorFill="hsl(var(--background))"
            // anchorSize, borderDash, rotateAnchorOffset are set dynamically by updateTransformerAppearance
            borderStroke="hsl(var(--primary))"
            rotateEnabled={true} // Default, can be customized if needed
            resizeEnabled={true} // Default
            enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']}
            strokeScaleEnabled={false} // Keep transformer border visually consistent
          />
          {selectedShapeIds.length === 1 && (() => {
            const selectedShape = shapes.find(s => s.id === selectedShapeIds[0]);
            if (!selectedShape) return null;

            const shapeOriginX = selectedShape.x || 0;
            const shapeOriginY = selectedShape.y || 0;
            const shapeScaleX = selectedShape.scaleX || 1;
            const shapeScaleY = selectedShape.scaleY || 1;


            if (selectedShape.type === 'line') {
              const line = selectedShape as LineShape;
              const handlePositions = [
                { x: shapeOriginX + line.points[0] * shapeScaleX, y: shapeOriginY + line.points[1] * shapeScaleY, pointIndex: 0 as const, type: 'line' as const, ref: startHandleRef },
                { x: shapeOriginX + line.points[2] * shapeScaleX, y: shapeOriginY + line.points[3] * shapeScaleY, pointIndex: 2 as const, type: 'line' as const, ref: endHandleRef },
              ];
              return (
                <React.Fragment>
                  {handlePositions.map(hp => (
                    <Circle
                      key={`${line.id}-handle-${hp.pointIndex}`}
                      ref={hp.ref}
                      id={`${line.id}-handle-${hp.pointIndex}`} 
                      x={hp.x}
                      y={hp.y}
                      radius={handleRadius}
                      fill="red" 
                      stroke="white" 
                      strokeWidth={handleStrokeWidth}
                      draggable={currentTool === 'select'}
                      onDragStart={(e) => { e.cancelBubble = true; handleEndpointDragStart(hp.type, line.id);}}
                      onDragMove={(e) => handleEndpointDragMove(e, line.id, hp.pointIndex, hp.type)}
                      onDragEnd={(e) => handleEndpointDragEnd(e, line.id, hp.pointIndex, hp.type)}
                      onMouseEnter={() => handleVertexMouseAction(true)}
                      onMouseLeave={() => handleVertexMouseAction(false)}
                      name="line-handle" 
                      data-shape-id={line.id} 
                      hitStrokeWidth={15 / currentStageScale} 
                    />
                  ))}
                </React.Fragment>
              );
            }
            else if ((selectedShape.type === 'polyline' || selectedShape.type === 'polygon') && editingShapeId === selectedShape.id) {
                const polyShape = selectedShape as PolylineShape | PolygonShape;
                const vertexHandles: JSX.Element[] = [];
                for (let i = 0; i < polyShape.points.length; i += 2) {
                    vertexHandles.push(
                        <Circle
                            key={`${polyShape.id}-vertex-${i/2}`}
                            id={`vertex-handle-${polyShape.id}-${i/2}`} 
                            x={shapeOriginX + polyShape.points[i] * shapeScaleX} 
                            y={shapeOriginY + polyShape.points[i+1] * shapeScaleY}
                            radius={handleRadius}
                            fill="hsl(var(--accent))" 
                            stroke="hsl(var(--accent-foreground))"
                            strokeWidth={handleStrokeWidth}
                            draggable={currentTool === 'select'}
                            onDragStart={(e) => { e.cancelBubble = true; handleEndpointDragStart('vertex', polyShape.id);}}
                            onDragMove={(e) => handleEndpointDragMove(e, polyShape.id, i, polyShape.type)}
                            onDragEnd={(e) => handleEndpointDragEnd(e, polyShape.id, i, polyShape.type)}
                            onMouseEnter={() => handleVertexMouseAction(true)}
                            onMouseLeave={() => handleVertexMouseAction(false)}
                            name="vertex-handle"
                            data-shape-id={polyShape.id}
                            hitStrokeWidth={15 / currentStageScale}
                        />
                    );
                }
                return <React.Fragment>{vertexHandles}</React.Fragment>;
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
              fill="rgba(0, 100, 200, 0.15)" 
              stroke="rgba(0, 100, 200, 0.6)"
              strokeWidth={1 / currentStageScale}
              visible={selectionRect.visible}
              listening={false} 
              name="selection-rectangle-class" 
            />
          )}
          {multiSelectBounds?.visible && (
            <Rect
              x={multiSelectBounds.x}
              y={multiSelectBounds.y}
              width={multiSelectBounds.width}
              height={multiSelectBounds.height}
              stroke="hsl(var(--primary))"
              strokeWidth={1 / currentStageScale}
              dash={[5 / currentStageScale, 5 / currentStageScale]}
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

