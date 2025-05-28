
"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Rect, Ellipse, Line as KonvaLine, Text as KonvaText, Group as KonvaGroup, Transformer } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type Konva from 'konva';
import { v4 as uuidv4 } from 'uuid';
import type { Shape, Tool, RectangleShape, EllipseShape, LineShape, PolylineShape, PolygonShape, TextShape, GroupShape, ShapeTool, ShapeType } from '@/lib/types';

interface KonvaCanvasProps {
  stageRef: React.RefObject<Konva.Stage | null>;
  shapes: Shape[];
  selectedShapeIds: string[];
  setSelectedShapeIds: (ids: string[]) => void;
  onUpdateShapes: (shapes: Shape[]) => void; // For batch updates like delete, group
  onUpdateSingleShape: (shape: Shape) => void; // For individual updates (transform, property change)
  onAddShape: (shape: Shape) => void;
  currentTool: Tool;
  defaultFillColor: string;
  defaultStrokeColor: string;
  defaultStrokeWidth: number;
  dashArray: number[];
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

  useEffect(() => {
    if (transformerRef.current && layerRef.current) {
      const selectedNodes = selectedShapeIds
        .map(id => layerRef.current?.findOne('#' + id))
        .filter(node => node) as Konva.Node[];
      
      transformerRef.current.nodes(selectedNodes);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selectedShapeIds, shapes]);

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

    if (currentTool === 'select') {
      const clickedOnEmpty = e.target === stage;
      if (clickedOnEmpty) {
        setSelectedShapeIds([]);
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
            } else if (selectedShapeIds.length > 1 && selectedShapeIds.includes(shapeId)) {
                // If it's already selected and part of a multi-selection, clicking it again without ctrl/meta
                // should make it the only selected item.
                setSelectedShapeIds([shapeId]);
            } else if (!selectedShapeIds.includes(shapeId)) {
                 setSelectedShapeIds([shapeId]);
            }
            // If it's already the only selected item, clicking it does nothing to the selection state.
        } else {
            setSelectedShapeIds([]); 
        }
      }
    } else if (['rectangle', 'ellipse', 'line', 'polyline', 'polygon', 'text'].includes(currentTool)) {
      setIsDrawing(true);
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
        case 'polyline':
          initialShape = { id, type: 'polyline', x: pos.x, y: pos.y, points: [0,0,0,0], stroke: defaultStrokeColor, strokeWidth: defaultStrokeWidth, dash: dashArray, draggable: true };
           break;
        case 'polygon': 
          initialShape = { id, type: 'polygon', x: pos.x, y: pos.y, points: [0,0,0,0], stroke: defaultStrokeColor, strokeWidth: defaultStrokeWidth, dash: dashArray, fill: defaultFillColor, closed: true, draggable: true };
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
      onAddShape(initialShape); // Add shape immediately to make it visible while drawing
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
      case 'polyline':
      case 'polygon':
        // Points are relative to the shape's x,y
        updatedShape.points = [updatedShape.points[0], updatedShape.points[1], pos.x - updatedShape.x, pos.y - updatedShape.y];
        break;
    }
    onUpdateSingleShape(updatedShape);
    setCurrentDrawingShape(updatedShape); 
  };

  const handleMouseUp = (e: KonvaEventObject<MouseEvent>) => {
     const stage = e.target.getStage();
     if (!stage) return;
     const pos = getPointerPosition(stage);

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
        return;
    }

    if (isDrawing && currentDrawingShape) {
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
        if (finalShape.width && finalShape.width < 5) finalShape.width = 5;
        if (finalShape.height && finalShape.height < 5) finalShape.height = 5;
         onUpdateSingleShape(finalShape); 
      } else if (finalShape.type === 'line' || finalShape.type === 'polyline' || finalShape.type === 'polygon') {
        const points = finalShape.points;
        if (points.length >= 2) {
            const [x1, y1] = [points[0], points[1]]; // Relative to shape's x,y
            const [x2, y2] = [points[points.length-2], points[points.length-1]]; // Relative to shape's x,y
            const dx = x2 - x1;
            const dy = y2 - y1;
            if (Math.sqrt(dx * dx + dy * dy) < 5 && points.length <=2) { 
                onUpdateShapes(shapes.filter(s => s.id !== finalShape.id));
                setCurrentDrawingShape(null); 
                setIsDrawing(false);
                return;
            }
        }
         onUpdateSingleShape(finalShape); 
      }
      
      if (currentTool === 'polyline' || currentTool === 'polygon') {
         const currentPoints = [...finalShape.points];
         // Add new point relative to shape's origin
         currentPoints.push(pos.x - finalShape.x, pos.y - finalShape.y);
         const updatedPolyShape = {...finalShape, points: currentPoints};
         onUpdateSingleShape(updatedPolyShape);
         setCurrentDrawingShape(updatedPolyShape);
         return; 
      }

      setIsDrawing(false);
      setCurrentDrawingShape(null);
    }
  };

  const handleDoubleClick = (e: KonvaEventObject<MouseEvent>) => {
    if ((currentDrawingShape?.type === 'polyline' || currentDrawingShape?.type === 'polygon') && isDrawing) {
      let finalShape = { ...currentDrawingShape };
      if (finalShape.points.length >= 4) {
        finalShape.points = finalShape.points.slice(0, -2);
      }

      if (finalShape.points.length >= (finalShape.type === 'polyline' ? 4 : 6)) { 
         onUpdateSingleShape(finalShape); 
      } else {
        onUpdateShapes(shapes.filter(s => s.id !== finalShape.id));
      }
      setIsDrawing(false);
      setCurrentDrawingShape(null);
    }
  };

  const handleDragEnd = (e: KonvaEventObject<DragEvent>, id: string) => {
    const node = e.target;
    const originalShape = shapes.find(s => s.id === id);
    if (originalShape) {
      // For all shapes, including groups, Konva updates node.x() and node.y()
      // to the new absolute position of the shape's origin.
      // Our model stores x and y as the origin, so we just update these.
      // Children within a group maintain their relative positions automatically.
      const updatedShape: Shape = {
        ...(originalShape as Shape), // Cast to ensure all base properties are included
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
        updatedAttrs.width = node.width() * node.scaleX(); // Apply scale to dimensions
        updatedAttrs.height = node.height() * node.scaleY();
        updatedAttrs.scaleX = 1; // Reset scale in model
        updatedAttrs.scaleY = 1;
        node.scaleX(1); // Reset scale on Konva node itself
        node.scaleY(1);
      } else {
        // For groups, lines, polylines, polygons, text:
        // The node's width/height might not be directly settable or meaningful in the same way.
        // We store the scale directly. Konva applies this visual scale.
        updatedAttrs.scaleX = parseFloat(node.scaleX().toFixed(3));
        updatedAttrs.scaleY = parseFloat(node.scaleY().toFixed(3));
        // If it's a group, its width/height are based on its children or initial bounding box calculation
        // and are scaled visually by scaleX/scaleY. We don't change model width/height here.
      }
      
      onUpdateSingleShape({ ...originalShape, ...updatedAttrs } as Shape);
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
    stage.batchDraw();
  };

  const renderShape = (shape: Shape): React.ReactNode => {
    const baseProps: any = { // Use 'any' for baseProps to simplify, or create a more specific base prop type
      key: shape.id,
      id: shape.id,
      x: shape.x,
      y: shape.y,
      rotation: shape.rotation || 0,
      scaleX: shape.scaleX || 1,
      scaleY: shape.scaleY || 1,
      draggable: currentTool === 'select' && (shape.draggable !== false), 
      onDragEnd: (evt: KonvaEventObject<DragEvent>) => handleDragEnd(evt, shape.id),
      onTransformEnd: handleTransformEnd,
      opacity: shape.opacity ?? 1,
      strokeScaleEnabled: false, 
      name: 'shape-draggable',
    };

    switch (shape.type) {
      case 'rectangle':
        const rect = shape as RectangleShape;
        return <Rect {...baseProps} width={rect.width} height={rect.height} fill={rect.fill} stroke={rect.stroke} strokeWidth={rect.strokeWidth} dash={rect.dash} />;
      case 'ellipse':
        const ellipse = shape as EllipseShape;
        // For Ellipse, width and height in our model are diameters. Konva expects radius.
        return <Ellipse {...baseProps} radiusX={ellipse.width / 2} radiusY={ellipse.height / 2} fill={ellipse.fill} stroke={ellipse.stroke} strokeWidth={ellipse.strokeWidth} dash={ellipse.dash} />;
      case 'line':
        const line = shape as LineShape;
        // Points are relative to the shape's x,y
        return <KonvaLine {...baseProps} points={line.points} stroke={line.stroke} strokeWidth={line.strokeWidth} dash={line.dash} />;
      case 'polyline':
        const polyline = shape as PolylineShape;
        return <KonvaLine {...baseProps} points={polyline.points} stroke={polyline.stroke} strokeWidth={polyline.strokeWidth} dash={polyline.dash} fillEnabled={false} />;
      case 'polygon':
        const polygon = shape as PolygonShape;
        return <KonvaLine {...baseProps} points={polygon.points} stroke={polygon.stroke} strokeWidth={polygon.strokeWidth} dash={polygon.dash} fill={polygon.fill} closed={true} />;
      case 'text':
        const text = shape as TextShape;
        return <KonvaText {...baseProps} text={text.text} fontSize={text.fontSize} fontFamily={text.fontFamily} fill={text.fill} width={text.width} height={text.height} align={text.align} verticalAlign={text.verticalAlign} padding={text.padding} lineHeight={text.lineHeight} wrap={text.wrap} ellipsis={text.ellipsis} fontStyle={text.fontStyle} textDecoration={text.textDecoration}/>;
      case 'group':
        const group = shape as GroupShape;
        // The group's width and height are for its unscaled bounding box.
        // Clipping can be useful if children might extend beyond these intended bounds.
        const clipFunc = (group.width && group.height) ? (ctx: Konva.Context) => {
            ctx.rect(0, 0, group.width!, group.height!); // Clip path is relative to the group's origin
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
        draggable={currentTool === 'select' && selectedShapeIds.length === 0 && !isDrawing && !selectionRect?.visible}
        style={{ cursor: currentTool === 'select' ? ( (isDrawing || selectionRect?.visible) ? 'crosshair' : 'grab') : 'crosshair' }}
      >
        <Layer ref={layerRef}>
          {shapes.map(shape => renderShape(shape))}
          <Transformer
            ref={transformerRef}
            boundBoxFunc={(oldBox, newBox) => {
              // Minimum size for transformed shapes
              if (newBox.width < 5 || newBox.height < 5) {
                return oldBox;
              }
              return newBox;
            }}
            rotateEnabled={true}
            // Consider adding resizeEnabled and other props as needed
          />
          {selectionRect?.visible && (
            <Rect
              ref={selectionRectRef}
              x={selectionRect.x}
              y={selectionRect.y}
              width={selectionRect.width}
              height={selectionRect.height}
              fill="rgba(0,160,255,0.3)"
              stroke="rgba(0,160,255,0.7)"
              strokeWidth={1 / (stageRef.current?.scaleX() || 1)} 
              visible={selectionRect.visible}
              listening={false} 
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
};

export default KonvaCanvas;
