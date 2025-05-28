
"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Rect, Ellipse, Line as KonvaLine, Transformer } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type Konva from 'konva';
import { v4 as uuidv4 } from 'uuid';
import type { Shape, Tool, RectangleShape, EllipseShape, LineShape, ShapeTool } from '@/lib/types';

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
  const [newShape, setNewShape] = useState<Shape | null>(null);
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
    return stage?.getPointerPosition() || { x: 0, y: 0 };
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
      const shapeNode = e.target.getParent()?.className === 'Group' ? e.target.getParent() : e.target; // Handle clicks on transformer anchors
      const shapeId = shapeNode.id();
      
      const isSelected = selectedShapeIds.includes(shapeId);
      if (e.evt.metaKey || e.evt.ctrlKey) {
        setSelectedShapeIds(isSelected ? selectedShapeIds.filter(id => id !== shapeId) : [...selectedShapeIds, shapeId]);
      } else {
        setSelectedShapeIds(shapeId && !isSelected ? [shapeId] : (isSelected && selectedShapeIds.length === 1 ? [shapeId] : []));
        if(shapeId && isSelected && selectedShapeIds.length > 1){
            setSelectedShapeIds([shapeId]);
        } else if (shapeId) {
             setSelectedShapeIds([shapeId]);
        }
      }
    } else if (['rectangle', 'ellipse', 'line'].includes(currentTool)) {
      setIsDrawing(true);
      const id = uuidv4();
      let initialShape: Shape;
      switch (currentTool as ShapeTool) {
        case 'rectangle':
          initialShape = { id, type: 'rectangle', x: pos.x, y: pos.y, width: 0, height: 0, fill: defaultFillColor, stroke: defaultStrokeColor, strokeWidth: defaultStrokeWidth, dash: dashArray };
          break;
        case 'ellipse':
          initialShape = { id, type: 'ellipse', x: pos.x, y: pos.y, width: 0, height: 0, fill: defaultFillColor, stroke: defaultStrokeColor, strokeWidth: defaultStrokeWidth, dash: dashArray };
          break;
        case 'line':
          initialShape = { id, type: 'line', x:0, y:0, points: [pos.x, pos.y, pos.x, pos.y], stroke: defaultStrokeColor, strokeWidth: defaultStrokeWidth, dash: dashArray };
          break;
        default: return; 
      }
      setNewShape(initialShape);
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

    if (!isDrawing || !newShape) return;

    let updatedShape = { ...newShape };
    switch (updatedShape.type) {
      case 'rectangle':
        updatedShape.width = pos.x - updatedShape.x;
        updatedShape.height = pos.y - updatedShape.y;
        break;
      case 'ellipse':
        updatedShape.width = Math.abs(pos.x - updatedShape.x) * 2;
        updatedShape.height = Math.abs(pos.y - updatedShape.y) * 2;
        break;
      case 'line':
        updatedShape.points = [updatedShape.points[0], updatedShape.points[1], pos.x, pos.y];
        break;
    }
    setNewShape(updatedShape);
  };

  const handleMouseUp = (e: KonvaEventObject<MouseEvent>) => {
     const stage = e.target.getStage();
     if (!stage) return;

    if (currentTool === 'select' && selectionRect?.visible && selectionRectRef.current) {
        setSelectionRect(prev => prev ? {...prev, visible: false} : null);
        const selBox = selectionRectRef.current.getClientRect();
        const selected: string[] = [];
        layerRef.current?.find('.shape').forEach(node => {
            const nodeBox = node.getClientRect();
            if (Konva.Util.haveIntersection(selBox, nodeBox)) {
                selected.push(node.id());
            }
        });
        setSelectedShapeIds(selected);
        return;
    }

    if (isDrawing && newShape) {
      setIsDrawing(false);
      // Normalize width/height for rectangles and ellipses
      let finalShape = { ...newShape };
      if ((finalShape.type === 'rectangle' || finalShape.type === 'ellipse')) {
        if (finalShape.width && finalShape.width < 0) {
          finalShape.x = finalShape.x + finalShape.width;
          finalShape.width = -finalShape.width;
        }
        if (finalShape.height && finalShape.height < 0) {
          finalShape.y = finalShape.y + finalShape.height;
          finalShape.height = -finalShape.height;
        }
         // Ensure minimum size
        if (finalShape.width && finalShape.width < 5) finalShape.width = 5;
        if (finalShape.height && finalShape.height < 5) finalShape.height = 5;
      } else if (finalShape.type === 'line') {
        // Ensure minimum line length
        const [x1, y1, x2, y2] = finalShape.points;
        const dx = x2 - x1;
        const dy = y2 - y1;
        if (Math.sqrt(dx * dx + dy * dy) < 5) {
            setNewShape(null); // discard very small lines
            return;
        }
      }
      onAddShape(finalShape);
      setNewShape(null);
    }
  };

  const handleDragEnd = (e: KonvaEventObject<DragEvent>, id: string) => {
    const node = e.target;
    const updatedShape = shapes.find(s => s.id === id);
    if (updatedShape) {
      onUpdateSingleShape({
        ...updatedShape,
        x: node.x(),
        y: node.y(),
      });
    }
  };

  const handleTransformEnd = (e: KonvaEventObject<Event>, id: string) => {
    const node = e.target;
    const updatedShape = shapes.find(s => s.id === id);
    if (updatedShape) {
      onUpdateSingleShape({
        ...updatedShape,
        x: node.x(),
        y: node.y(),
        width: node.width() * node.scaleX(),
        height: node.height() * node.scaleY(),
        rotation: node.rotation(),
        scaleX: 1, // Reset scale after applying to dimensions
        scaleY: 1,
      });
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

    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    
    // Limit zoom
    if (newScale < 0.1 || newScale > 10) return;


    stage.scale({ x: newScale, y: newScale });

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    stage.position(newPos);
    stage.batchDraw();
  };


  // Render shapes
  const renderShapes = () => {
    const allShapesToRender = newShape ? [...shapes, newShape] : shapes;
    return allShapesToRender.map((shape) => {
      const commonProps = {
        key: shape.id,
        id: shape.id,
        x: shape.x,
        y: shape.y,
        rotation: shape.rotation || 0,
        scaleX: shape.scaleX || 1,
        scaleY: shape.scaleY || 1,
        draggable: currentTool === 'select',
        onDragEnd: (e: KonvaEventObject<DragEvent>) => handleDragEnd(e, shape.id),
        onTransformEnd: (e: KonvaEventObject<Event>) => handleTransformEnd(e, shape.id),
        name: 'shape', // for selection logic
      };

      switch (shape.type) {
        case 'rectangle': {
          const rectShape = shape as RectangleShape;
          return (
            <Rect
              {...commonProps}
              width={rectShape.width}
              height={rectShape.height}
              fill={rectShape.fill}
              stroke={rectShape.stroke}
              strokeWidth={rectShape.strokeWidth}
              dash={rectShape.dash}
            />
          );
        }
        case 'ellipse': {
          const ellipseShape = shape as EllipseShape;
          return (
            <Ellipse
              {...commonProps}
              radiusX={ellipseShape.width / 2}
              radiusY={ellipseShape.height / 2}
              fill={ellipseShape.fill}
              stroke={ellipseShape.stroke}
              strokeWidth={ellipseShape.strokeWidth}
              dash={ellipseShape.dash}
            />
          );
        }
        case 'line': {
          const lineShape = shape as LineShape;
          return (
            <KonvaLine
              key={lineShape.id}
              id={lineShape.id}
              points={lineShape.points}
              stroke={lineShape.stroke}
              strokeWidth={lineShape.strokeWidth}
              dash={lineShape.dash}
              draggable={currentTool === 'select'}
              onDragEnd={(e: KonvaEventObject<DragEvent>) => {
                 // Lines need special drag handling if not grouped in x/y based primitives
                 const node = e.target;
                 const dx = node.x(); // Konva Lines drag from 0,0 so node.x() gives delta
                 const dy = node.y();
                 onUpdateSingleShape({
                   ...lineShape,
                   points: lineShape.points.map((p, i) => i % 2 === 0 ? p + dx : p + dy),
                 });
                 node.position({x:0, y:0}); // Reset position after applying delta
              }}
              onTransformEnd={(e: KonvaEventObject<Event>) => {
                const node = e.target;
                // Transformer applies scale/rotation to Lines differently
                // This needs more complex logic to update points based on transform matrix
                // For now, just log or disable transform for lines until fully implemented
                console.log("Line transform end, complex update needed", node.getTransform());
              }}
              name='shape'
            />
          );
        }
        default:
          return null;
      }
    });
  };

  // Ensure canvas resizes with container
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node !== null) {
      const resizeObserver = new ResizeObserver(() => {
        setContainerSize({ width: node.offsetWidth, height: node.offsetHeight });
      });
      resizeObserver.observe(node);
      // Initial size
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
        draggable={currentTool === 'select' && selectedShapeIds.length === 0} // Pan stage when no tool active & no selection
        className="cursor-crosshair"
        style={{ cursor: currentTool === 'select' ? 'grab' : 'crosshair' }}
      >
        <Layer ref={layerRef}>
          {renderShapes()}
          <Transformer
            ref={transformerRef}
            boundBoxFunc={(oldBox, newBox) => {
              // Limit minimum size for transformed shapes
              if (newBox.width < 5 || newBox.height < 5) {
                return oldBox;
              }
              return newBox;
            }}
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
              strokeWidth={1}
              visible={selectionRect.visible}
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
};

export default KonvaCanvas;

