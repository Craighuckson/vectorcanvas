
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
            } else if (selectedShapeIds.length > 1) {
                setSelectedShapeIds([shapeId]);
            }
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
          initialShape = { id, type: 'line', x:0, y:0, points: [pos.x, pos.y, pos.x, pos.y], stroke: defaultStrokeColor, strokeWidth: defaultStrokeWidth, dash: dashArray, draggable: true };
          break;
        case 'polyline':
          initialShape = { id, type: 'polyline', x: 0, y: 0, points: [pos.x, pos.y, pos.x, pos.y], stroke: defaultStrokeColor, strokeWidth: defaultStrokeWidth, dash: dashArray, draggable: true };
          break;
        case 'polygon': 
          initialShape = { id, type: 'polygon', x: 0, y: 0, points: [pos.x, pos.y, pos.x, pos.y], stroke: defaultStrokeColor, strokeWidth: defaultStrokeWidth, dash: dashArray, fill: defaultFillColor, closed: true, draggable: true };
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
        updatedShape.points = [updatedShape.points[0], updatedShape.points[1], pos.x, pos.y];
        break;
      case 'polyline':
      case 'polygon':
        const currentPoints = [...updatedShape.points];
        currentPoints[currentPoints.length - 2] = pos.x;
        currentPoints[currentPoints.length - 1] = pos.y;
        updatedShape.points = currentPoints;
        break;
    }
    // Instead of setCurrentDrawingShape, update the shape in the main shapes array
    onUpdateSingleShape(updatedShape);
    setCurrentDrawingShape(updatedShape); // Keep local track for ongoing drawing operation
  };

  const handleMouseUp = (e: KonvaEventObject<MouseEvent>) => {
     const stage = e.target.getStage();
     if (!stage) return;
     // const pos = getPointerPosition(stage); // Not used in current logic here

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
         onUpdateSingleShape(finalShape); // Final update of the shape
      } else if (finalShape.type === 'line' || finalShape.type === 'polyline' || finalShape.type === 'polygon') {
        const points = finalShape.points;
        if (points.length >= 2) {
            const [x1, y1] = [points[0], points[1]];
            const [x2, y2] = [points[points.length-2], points[points.length-1]];
            const dx = x2 - x1;
            const dy = y2 - y1;
            if (Math.sqrt(dx * dx + dy * dy) < 5 && points.length <=2) { // Only discard if it's a tiny single segment line
                // Remove the shape if it's too small
                onUpdateShapes(shapes.filter(s => s.id !== finalShape.id));
                setCurrentDrawingShape(null); 
                setIsDrawing(false);
                return;
            }
        }
         onUpdateSingleShape(finalShape); // Final update for line based shapes
      }
      
      if (currentTool === 'polyline' || currentTool === 'polygon') {
         // For polyline/polygon, mouseUp adds a point. Double-click finalizes.
         // The shape was already added on mouseDown. Now we update its points.
         const currentPoints = [...finalShape.points];
         const pos = getPointerPosition(stage);
         currentPoints.push(pos.x, pos.y); // Add a new point placeholder for next segment
         const updatedPolyShape = {...finalShape, points: currentPoints};
         onUpdateSingleShape(updatedPolyShape);
         setCurrentDrawingShape(updatedPolyShape);
         // setIsDrawing(true) remains true, to continue adding points
         return; // Don't reset isDrawing or currentDrawingShape yet
      }

      // For other tools, drawing is finished
      setIsDrawing(false);
      setCurrentDrawingShape(null);
    }
  };

  const handleDoubleClick = (e: KonvaEventObject<MouseEvent>) => {
    if ((currentDrawingShape?.type === 'polyline' || currentDrawingShape?.type === 'polygon') && isDrawing) {
      let finalShape = { ...currentDrawingShape };
      // Remove the last temporary point added on mouse move/up if it's a duplicate of the second to last,
      // or if it's the very last point added by the click that triggered the double click.
      if (finalShape.points.length >= 4) {
         // The last point is a duplicate from the click that initiated the double click,
         // and the one before that was the end of the segment being drawn.
         // We want to remove the last point as it's the start of a "next" segment we don't want.
        finalShape.points = finalShape.points.slice(0, -2);
      }

      if (finalShape.points.length >= (finalShape.type === 'polyline' ? 4 : 6)) { // Min 2 segments for polyline, 3 for polygon
         onUpdateSingleShape(finalShape); // Finalize the shape
      } else {
        // Not enough points, remove the shape
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
      let updatedShape : Shape = {
        ...originalShape,
        x: node.x(),
        y: node.y(),
      };
      if (originalShape.type === 'line' || originalShape.type === 'polyline' || originalShape.type === 'polygon'){
        const dx = node.x() - (originalShape.x || 0); 
        const dy = node.y() - (originalShape.y || 0);
        
        updatedShape.points = (originalShape as LineShape | PolylineShape | PolygonShape).points.map((p, i) => i % 2 === 0 ? p + dx : p + dy);
        updatedShape.x = originalShape.x || 0; 
        updatedShape.y = originalShape.y || 0;
        node.position({x: originalShape.x || 0, y: originalShape.y || 0}); 
      }
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
        scaleX: parseFloat(node.scaleX().toFixed(3)), 
        scaleY: parseFloat(node.scaleY().toFixed(3)),
      };

      if (originalShape.type === 'rectangle' || originalShape.type === 'ellipse') {
        updatedAttrs.width = node.width() * node.scaleX();
        updatedAttrs.height = node.height() * node.scaleY();
        // Reset scale on node after applying to dimensions for these types
        node.scaleX(1);
        node.scaleY(1);
        updatedAttrs.scaleX = 1; 
        updatedAttrs.scaleY = 1;
      } else if (originalShape.type === 'line' || originalShape.type === 'polyline' || originalShape.type === 'polygon') {
        // For these shapes, we store the scale and rotation. Konva applies it visually.
        // Actual point transformation would be complex. For now, x, y, scale, rotation are stored.
        // The node's width/height are not directly used for these; points define their extent.
      } else if (originalShape.type === 'text') {
         // Text scaling can be handled by scaleX/scaleY. 
         // If you want fontSize to change, it's more complex.
         // Konva handles visual scaling well.
      }
      
      onUpdateSingleShape({ ...originalShape, ...updatedAttrs });
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
    const baseProps = {
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
        return <Ellipse {...baseProps} radiusX={ellipse.width / 2} radiusY={ellipse.height / 2} fill={ellipse.fill} stroke={ellipse.stroke} strokeWidth={ellipse.strokeWidth} dash={ellipse.dash} />;
      case 'line':
        const line = shape as LineShape;
        // For lines, x and y are typically 0,0 and points are absolute.
        // If dragging is applied to x/y, points need adjustment or Konva handles it if x/y are part of its transform origin.
        // The current drag logic adjusts points and resets x/y to 0 for lines.
        return <KonvaLine {...baseProps} x={line.x || 0} y={line.y || 0} points={line.points} stroke={line.stroke} strokeWidth={line.strokeWidth} dash={line.dash} />;
      case 'polyline':
        const polyline = shape as PolylineShape;
        return <KonvaLine {...baseProps} x={polyline.x || 0} y={polyline.y || 0} points={polyline.points} stroke={polyline.stroke} strokeWidth={polyline.strokeWidth} dash={polyline.dash} fillEnabled={false} />;
      case 'polygon':
        const polygon = shape as PolygonShape;
        return <KonvaLine {...baseProps} x={polygon.x || 0} y={polygon.y || 0} points={polygon.points} stroke={polygon.stroke} strokeWidth={polygon.strokeWidth} dash={polygon.dash} fill={polygon.fill} closed={true} />;
      case 'text':
        const text = shape as TextShape;
        return <KonvaText {...baseProps} text={text.text} fontSize={text.fontSize} fontFamily={text.fontFamily} fill={text.fill} width={text.width} height={text.height} align={text.align} verticalAlign={text.verticalAlign} padding={text.padding} lineHeight={text.lineHeight} wrap={text.wrap} ellipsis={text.ellipsis} fontStyle={text.fontStyle} textDecoration={text.textDecoration}/>;
      case 'group':
        const group = shape as GroupShape;
        const clipFunc = (group.width && group.height) ? (ctx: Konva.Context) => {
            ctx.rect(0, 0, group.width!, group.height!);
        } : undefined;

        return (
            <KonvaGroup {...baseProps} clipFunc={clipFunc} width={group.width} height={group.height}>
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
          {/* Render currentDrawingShape separately if it's not yet in shapes array, but current logic adds it immediately */}
          <Transformer
            ref={transformerRef}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 5 || newBox.height < 5) {
                return oldBox;
              }
              return newBox;
            }}
            rotateEnabled={true}
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

    