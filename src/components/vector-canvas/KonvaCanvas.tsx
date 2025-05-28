
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
  currentTool: Tool;
  defaultFillColor: string;
  defaultStrokeColor: string;
  defaultStrokeWidth: number;
  dashArray: number[];
  canvasWidth: number; // For export, not directly used for stage size here
  canvasHeight: number; // For export
}

const KonvaCanvas: React.FC<KonvaCanvasProps> = ({
  stageRef,
  shapes,
  selectedShapeIds,
  setSelectedShapeIds,
  onUpdateShapes,
  onUpdateSingleShape,
  onAddShape,
  currentTool,
  defaultFillColor,
  defaultStrokeColor,
  defaultStrokeWidth,
  dashArray,
}) => {
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const layerRef = useRef<Konva.Layer | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDrawingShape, setCurrentDrawingShape] = useState<Shape | null>(null);
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; width: number; height: number; visible: boolean } | null>(null);
  const selectionRectRef = useRef<Konva.Rect>(null);
  const [isDraggingLineHandle, setIsDraggingLineHandle] = useState<boolean>(false);
  const [editingShapeId, setEditingShapeId] = useState<string | null>(null);
  const [isDraggingVertex, setIsDraggingVertex] = useState<boolean>(false);

  useEffect(() => {
    if (transformerRef.current && layerRef.current) {
      const selectedKonvaNodes: Konva.Node[] = [];
      let hideTransformer = false;

      if (selectedShapeIds.length === 1) {
        const singleSelectedShape = shapes.find(s => s.id === selectedShapeIds[0]);
        if (singleSelectedShape) {
          if (singleSelectedShape.type === 'line') {
            hideTransformer = true; // Always hide transformer for single lines
          } else if ((singleSelectedShape.type === 'polyline' || singleSelectedShape.type === 'polygon') && editingShapeId === singleSelectedShape.id) {
            hideTransformer = true; // Hide transformer if polyline/polygon is in vertex edit mode
          } else {
            const node = layerRef.current?.findOne('#' + selectedShapeIds[0]);
            if (node) selectedKonvaNodes.push(node);
          }
        }
      } else if (selectedShapeIds.length > 1) {
        selectedShapeIds.forEach(id => {
          const node = layerRef.current?.findOne('#' + id);
          if (node) selectedKonvaNodes.push(node);
        });
      }

      if (hideTransformer) {
        transformerRef.current.nodes([]);
      } else {
        transformerRef.current.nodes(selectedKonvaNodes);
        transformerRef.current.resizeEnabled(true);
        transformerRef.current.rotateEnabled(true);
      }
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selectedShapeIds, shapes, editingShapeId]);


  // Effect for handling Escape/Enter to finish polyline drawing
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isDrawing && currentDrawingShape && (currentDrawingShape.type === 'polyline' || currentDrawingShape.type === 'polygon')) {
        if (event.key === 'Escape' || event.key === 'Enter') {
          event.preventDefault();
          event.stopPropagation(); // Prevent other global listeners

          let finalShape = { ...currentDrawingShape };
          if (finalShape.points.length > 2) { // Remove the last "live" point
            finalShape.points = finalShape.points.slice(0, -2);
          }

          const minPoints = finalShape.type === 'polyline' ? 4 : (finalShape.type === 'polygon' ? 6 : 0);
          if (finalShape.points.length < minPoints) {
            onUpdateShapes(shapes.filter(s => s.id !== finalShape.id)); // Remove if not enough points
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

    if (e.target.name() === 'line-handle' || e.target.name() === 'vertex-handle') {
      return;
    }
    // Clear editing mode if clicking outside editable shape or its handles
    if (editingShapeId && e.target.id() !== editingShapeId && !e.target.hasName('vertex-handle')) {
        setEditingShapeId(null);
    }


    const pos = getPointerPosition(stage);

    if (currentTool === 'select') {
      const clickedOnEmpty = e.target === stage;
      if (clickedOnEmpty) {
        setSelectedShapeIds([]);
        setEditingShapeId(null); // Also clear editing mode
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
                setEditingShapeId(null); // Reset editing mode when selecting a new shape
            } else if (selectedShapeIds.length > 1 && selectedShapeIds.includes(shapeId)) {
                setSelectedShapeIds([shapeId]); // If multiple are selected, and one of them is clicked, select only that one
                setEditingShapeId(null);
            }
            // If it's already the only selected shape, a click doesn't deselect, it might lead to a double-click for edit.
        } else {
            setSelectedShapeIds([]);
            setEditingShapeId(null);
        }
      }
    } else if (['rectangle', 'ellipse', 'line', 'text'].includes(currentTool)) {
      setIsDrawing(true);
      setEditingShapeId(null); // Ensure not in edit mode when drawing
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
        if (!isDrawing) { // First click starts drawing
            setIsDrawing(true);
            const id = uuidv4();
            const initialPolyShape: PolylineShape | PolygonShape = {
                id,
                type: currentTool,
                x: pos.x, // Origin of the shape
                y: pos.y,
                points: [0, 0, 0, 0], // First point relative to origin, second is live
                stroke: defaultStrokeColor,
                strokeWidth: defaultStrokeWidth,
                dash: dashArray,
                fill: currentTool === 'polygon' ? defaultFillColor : undefined,
                closed: currentTool === 'polygon',
                draggable: true,
            };
            setCurrentDrawingShape(initialPolyShape);
            onAddShape(initialPolyShape);
        } else { // Subsequent clicks add points
            if (currentDrawingShape && (currentDrawingShape.type === 'polyline' || currentDrawingShape.type === 'polygon')) {
                const relativeX = pos.x - currentDrawingShape.x;
                const relativeY = pos.y - currentDrawingShape.y;
                
                // Update the second to last point (which was the previous live point)
                const existingPoints = [...currentDrawingShape.points];
                existingPoints[existingPoints.length - 2] = relativeX;
                existingPoints[existingPoints.length - 1] = relativeY;
                
                // Add a new live point
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

    if (currentTool === 'select' && selectionRect?.visible) {
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
        updatedShape.x = (currentDrawingShape.x + pos.x) / 2;
        updatedShape.y = (currentDrawingShape.y + pos.y) / 2;
        updatedShape.width = Math.abs(pos.x - currentDrawingShape.x);
        updatedShape.height = Math.abs(pos.y - currentDrawingShape.y);
        break;
      case 'line':
        updatedShape.points = [0, 0, pos.x - updatedShape.x, pos.y - updatedShape.y];
        break;
      case 'polyline':
      case 'polygon':
        // Update the last (live) point
        const livePoints = [...updatedShape.points];
        livePoints[livePoints.length-2] = pos.x - updatedShape.x;
        livePoints[livePoints.length-1] = pos.y - updatedShape.y;
        updatedShape.points = livePoints;
        break;
    }
    onUpdateSingleShape(updatedShape); // Update in real-time
    setCurrentDrawingShape(updatedShape);
  };

  const handleMouseUp = (e: KonvaEventObject<MouseEvent>) => {
     const stage = e.target.getStage();
     if (!stage) return;

    if (currentTool === 'select' && selectionRect?.visible && selectionRectRef.current) {
        setSelectionRect(prev => prev ? {...prev, visible: false} : null);
        const selBox = selectionRectRef.current.getClientRect({relativeTo: layerRef.current});
        const newlySelectedIds: string[] = [];
        layerRef.current?.find('.shape-draggable').forEach(node => {
            const nodeBox = node.getClientRect({relativeTo: layerRef.current});
            if (Konva.Util.haveIntersection(selBox, nodeBox)) {
                newlySelectedIds.push(node.id());
            }
        });
        setSelectedShapeIds(newlySelectedIds);
        if (newlySelectedIds.length > 0) setEditingShapeId(null); // Clear edit mode on new multi-selection
        return;
    }

    // For tools that draw on drag (rect, ellipse, line)
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
            const [x2, y2] = [points[2], points[3]];
            if (Math.sqrt(x2 * x2 + y2 * y2) < 5) { // If line is too short, remove it
                onUpdateShapes(shapes.filter(s => s.id !== finalShape.id));
            } else {
                 onUpdateSingleShape(finalShape);
            }
        }
      }
      setIsDrawing(false);
      setCurrentDrawingShape(null);
    }
    // Polyline/Polygon drawing is finished by Enter/Escape, not MouseUp after first click.
  };

  const handleDoubleClick = (e: KonvaEventObject<MouseEvent>) => {
    if (currentTool === 'select') {
        const shapeNode = e.target;
        const shapeId = shapeNode.id();
        const shape = shapes.find(s => s.id === shapeId);

        if (shape && (shape.type === 'line' || shape.type === 'polyline' || shape.type === 'polygon')) {
            if (selectedShapeIds.length === 1 && selectedShapeIds[0] === shapeId) {
                setEditingShapeId(prevId => prevId === shapeId ? null : shapeId); // Toggle edit mode
            } else {
                 setSelectedShapeIds([shapeId]); // Select the shape first
                 setEditingShapeId(shapeId); // Then enter edit mode
            }
        } else {
            setEditingShapeId(null); // Not an editable shape type or no shape clicked
        }
    }
  };

  const handleDragEnd = (e: KonvaEventObject<DragEvent>, id: string) => {
    const node = e.target;
    const originalShape = shapes.find(s => s.id === id);
    if (originalShape && originalShape.draggable !== false && !isDraggingVertex && !isDraggingLineHandle) { // Ensure not dragging a vertex
        const updatedShape: Shape = {
            ...(originalShape as Shape),
            x: node.x(),
            y: node.y(),
        };
        onUpdateSingleShape(updatedShape);
    }
  };

  const handleTransformEnd = (e: KonvaEventObject<Event>) => {
    const node = e.target;
    const shapeId = node.id();
    const originalShape = shapes.find(s => s.id === shapeId);

    if (originalShape) {
      let updatedAttrs: Partial<Shape> = {
        x: node.x(),
        y: node.y(),
        rotation: parseFloat(node.rotation().toFixed(2)),
      };

      if (originalShape.type === 'rectangle' || originalShape.type === 'ellipse') {
        updatedAttrs.width = node.width() * node.scaleX();
        updatedAttrs.height = node.height() * node.scaleY();
      } else if (originalShape.type === 'text' || originalShape.type === 'group'){
         updatedAttrs.width = (originalShape.width || 0) * node.scaleX();
         updatedAttrs.height = (originalShape.height || 0) * node.scaleY();
      }
      // For all shapes, if transformer was used, we want to bake scale into dimensions or points
      // and reset node scale, but keep model scale for non-rect/ellipse.
      // This part can be complex. For now, we apply scale to width/height for rect/ellipse
      // and store scaleX/scaleY for others.

      if (originalShape.type === 'rectangle' || originalShape.type === 'ellipse') {
        node.scaleX(1);
        node.scaleY(1);
        updatedAttrs.scaleX = 1;
        updatedAttrs.scaleY = 1;
      } else {
        updatedAttrs.scaleX = parseFloat(node.scaleX().toFixed(3));
        updatedAttrs.scaleY = parseFloat(node.scaleY().toFixed(3));
      }

      onUpdateSingleShape({ ...originalShape, ...updatedAttrs } as Shape);
    }
  };

  const handleEndpointDragStart = (type: 'line' | 'vertex') => {
    if (type === 'line') setIsDraggingLineHandle(true);
    else setIsDraggingVertex(true);
    const stage = stageRef.current;
    if (stage) stage.container().style.cursor = 'grabbing';
  };

  const handleEndpointDragMove = (
      e: KonvaEventObject<DragEvent>,
      shapeId: string,
      pointIndex: number, // For lines, 0 or 2. For poly* this is the actual index in points array (e.g., 0 for x1, 1 for y1)
      shapeType: 'line' | 'polyline' | 'polygon'
  ) => {
      const stage = e.target.getStage();
      if (!stage) return;

      const shape = shapes.find(s => s.id === shapeId) as LineShape | PolylineShape | PolygonShape | undefined;
      if (!shape) return;

      const posOnStage = stage.getPointerPosition();
      if (!posOnStage) return;

      // Convert stage pointer position to be relative to the shape's origin
      const relativeX = (posOnStage.x - stage.x()) / stage.scaleX() - (shape.x || 0);
      const relativeY = (posOnStage.y - stage.y()) / stage.scaleY() - (shape.y || 0);

      const newPoints = [...shape.points];
      if (shapeType === 'line') {
          newPoints[pointIndex] = relativeX; // pointIndex is 0 for start (x1), 2 for end (x2)
          newPoints[pointIndex + 1] = relativeY;
      } else { // polyline or polygon
          newPoints[pointIndex] = relativeX; // pointIndex is the direct index for x
          newPoints[pointIndex + 1] = relativeY; // pointIndex + 1 is for y
      }

      // Update Konva node directly for immediate feedback
      const konvaNode = layerRef.current?.findOne('#' + shapeId) as Konva.Line | undefined;
      if (konvaNode) {
          konvaNode.points(newPoints);
      }
      // Move the handle itself
      e.target.position({ x: relativeX + (shape.x || 0), y: relativeY + (shape.y || 0) });
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
      if (stage) stage.container().style.cursor = 'default'; // Reset cursor
      if (!stage) return;

      const shape = shapes.find(s => s.id === shapeId) as LineShape | PolylineShape | PolygonShape | undefined;
      if (!shape) return;

      const posOnStage = stage.getPointerPosition();
      if (!posOnStage) return;
      
      const relativeX = (posOnStage.x - stage.x()) / stage.scaleX() - (shape.x || 0);
      const relativeY = (posOnStage.y - stage.y()) / stage.scaleY() - (shape.y || 0);
      
      const finalPoints = [...shape.points];
       if (shapeType === 'line') {
          finalPoints[pointIndex] = relativeX;
          finalPoints[pointIndex + 1] = relativeY;
      } else {
          finalPoints[pointIndex] = relativeX;
          finalPoints[pointIndex + 1] = relativeY;
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
    stage.batchDraw();
  };
  
  const handleVertexMouseAction = (isEnter: boolean) => {
    const stage = stageRef.current;
    if (stage) {
        stage.container().style.cursor = isEnter ? 'move' : 'default';
    }
  };


  const renderShape = (shape: Shape): React.ReactNode => {
    const currentStageScale = stageRef.current?.scaleX() || 1;
    const hitStrokeWidth = Math.max(5, (shape.strokeWidth || defaultStrokeWidth) + 10) / currentStageScale;


    const baseProps: any = {
      key: shape.id,
      id: shape.id,
      x: shape.x,
      y: shape.y,
      rotation: shape.rotation || 0,
      scaleX: shape.scaleX || 1,
      scaleY: shape.scaleY || 1,
      draggable: currentTool === 'select' && (shape.draggable !== false) && !isDraggingLineHandle && !isDraggingVertex && editingShapeId !== shape.id,
      onDragEnd: (evt: KonvaEventObject<DragEvent>) => handleDragEnd(evt, shape.id),
      onTransformEnd: handleTransformEnd,
      opacity: shape.opacity ?? 1,
      strokeScaleEnabled: false,
      name: 'shape-draggable',
       perfectDrawEnabled: false, // Can improve perf for complex shapes
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
        return <KonvaLine {...baseProps} points={line.points} stroke={line.stroke} strokeWidth={line.strokeWidth} dash={line.dash} hitStrokeWidth={hitStrokeWidth} />;
      case 'polyline':
        const polyline = shape as PolylineShape;
        return <KonvaLine {...baseProps} points={polyline.points} stroke={polyline.stroke} strokeWidth={polyline.strokeWidth} dash={polyline.dash} fillEnabled={false} hitStrokeWidth={hitStrokeWidth} />;
      case 'polygon':
        const polygon = shape as PolygonShape;
        return <KonvaLine {...baseProps} points={polygon.points} stroke={polygon.stroke} strokeWidth={polygon.strokeWidth} dash={polygon.dash} fill={polygon.fill} closed={true} hitStrokeWidth={hitStrokeWidth} />;
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
        draggable={currentTool === 'select' && selectedShapeIds.length === 0 && !isDrawing && !selectionRect?.visible && !isDraggingLineHandle && !isDraggingVertex && !editingShapeId}
        style={{ cursor: currentTool === 'select' ? ( (isDrawing || selectionRect?.visible || isDraggingLineHandle || isDraggingVertex) ? 'crosshair' : (isDraggingVertex || isDraggingLineHandle ? 'grabbing' : 'grab')) : 'crosshair' }}
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
            anchorSize={8}
            borderStroke="hsl(var(--primary))"
            borderDash={[3,3]}
            rotateAnchorOffset={20}
            padding={2 / currentStageScale}
            enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']}
          />
          {/* Render handles for selected line OR polyline/polygon in edit mode */}
          {selectedShapeIds.length === 1 && (() => {
            const selectedShape = shapes.find(s => s.id === selectedShapeIds[0]);
            if (!selectedShape) return null;

            // Line endpoint handles (always shown when line is selected, not in edit mode concept for line itself)
            if (selectedShape.type === 'line') {
              const line = selectedShape as LineShape;
              const lineX = line.x || 0;
              const lineY = line.y || 0;
              const handlePositions = [
                { x: lineX + line.points[0], y: lineY + line.points[1], pointIndex: 0 as const, type: 'line' as const },
                { x: lineX + line.points[2], y: lineY + line.points[3], pointIndex: 2 as const, type: 'line' as const },
              ];
              return (
                <React.Fragment>
                  {handlePositions.map(hp => (
                    <Circle
                      key={`${line.id}-handle-${hp.pointIndex}`}
                      x={hp.x}
                      y={hp.y}
                      radius={handleRadius}
                      fill="hsl(var(--primary))"
                      stroke="hsl(var(--primary-foreground))"
                      strokeWidth={handleStrokeWidth}
                      draggable={currentTool === 'select'}
                      onDragStart={() => handleEndpointDragStart('line')}
                      onDragMove={(e) => handleEndpointDragMove(e, line.id, hp.pointIndex, hp.type)}
                      onDragEnd={(e) => handleEndpointDragEnd(e, line.id, hp.pointIndex, hp.type)}
                      onMouseEnter={() => handleVertexMouseAction(true)}
                      onMouseLeave={() => handleVertexMouseAction(false)}
                      name="line-handle"
                      hitStrokeWidth={15 / currentStageScale}
                    />
                  ))}
                </React.Fragment>
              );
            }
            // Polyline/Polygon vertex handles (shown only when in edit mode)
            else if ((selectedShape.type === 'polyline' || selectedShape.type === 'polygon') && editingShapeId === selectedShape.id) {
                const polyShape = selectedShape as PolylineShape | PolygonShape;
                const shapeX = polyShape.x || 0;
                const shapeY = polyShape.y || 0;
                const vertexHandles: JSX.Element[] = [];
                for (let i = 0; i < polyShape.points.length; i += 2) {
                    vertexHandles.push(
                        <Circle
                            key={`${polyShape.id}-vertex-${i/2}`}
                            x={shapeX + polyShape.points[i]}
                            y={shapeY + polyShape.points[i+1]}
                            radius={handleRadius}
                            fill="hsl(var(--accent))" // Different color for poly vertices
                            stroke="hsl(var(--accent-foreground))"
                            strokeWidth={handleStrokeWidth}
                            draggable={currentTool === 'select'}
                            onDragStart={() => handleEndpointDragStart('vertex')}
                            onDragMove={(e) => handleEndpointDragMove(e, polyShape.id, i, polyShape.type)}
                            onDragEnd={(e) => handleEndpointDragEnd(e, polyShape.id, i, polyShape.type)}
                            onMouseEnter={() => handleVertexMouseAction(true)}
                            onMouseLeave={() => handleVertexMouseAction(false)}
                            name="vertex-handle"
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
              fill="rgba(var(--accent-rgb, 70, 179, 172), 0.3)" // Example, direct HSL to RGBA needed
              stroke="hsl(var(--accent))"
              strokeWidth={1 / currentStageScale}
              visible={selectionRect.visible}
              listening={false}
              name="selection-rectangle-class"
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
};

export default KonvaCanvas;
