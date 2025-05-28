
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
  const [isDraggingLineHandle, setIsDraggingLineHandle] = useState(false);

  useEffect(() => {
    if (transformerRef.current && layerRef.current) {
      const selectedKonvaNodes = selectedShapeIds
        .map(id => layerRef.current?.findOne('#' + id))
        .filter(node => node) as Konva.Node[];

      const isSingleLineSelected = 
        selectedKonvaNodes.length === 1 && 
        shapes.find(s => s.id === selectedKonvaNodes[0]?.id())?.type === 'line';

      if (isSingleLineSelected) {
        transformerRef.current.nodes([]); 
      } else {
        transformerRef.current.nodes(selectedKonvaNodes);
        transformerRef.current.resizeEnabled(true);
        transformerRef.current.rotateEnabled(true);
      }
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
    
    if (e.target.name() === 'line-handle') {
      return; 
    }

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
          initialShape = { id, type: 'line', x:pos.x, y:pos.y, points: [0, 0, 0, 0], stroke: defaultStrokeColor, strokeWidth: defaultStrokeWidth, dash: dashArray, draggable: true };
          break;
        case 'polyline':
          initialShape = { id, type: 'polyline', x: pos.x, y: pos.y, points: [0,0], stroke: defaultStrokeColor, strokeWidth: defaultStrokeWidth, dash: dashArray, draggable: true };
           break;
        case 'polygon': 
          initialShape = { id, type: 'polygon', x: pos.x, y: pos.y, points: [0,0], stroke: defaultStrokeColor, strokeWidth: defaultStrokeWidth, dash: dashArray, fill: defaultFillColor, closed: true, draggable: true };
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
        if (updatedShape.points.length >=2 && (currentTool === 'polyline' || currentTool === 'polygon')) {
             const tempPoints = [...updatedShape.points];
             if (tempPoints.length === 2 && (currentDrawingShape as PolylineShape | PolygonShape).points.length === 2) { // Drawing the very first segment
                tempPoints.push(pos.x - updatedShape.x, pos.y - updatedShape.y);
             } else { // Modifying the last point of the current segment being drawn
                tempPoints[tempPoints.length-2] = pos.x - updatedShape.x;
                tempPoints[tempPoints.length-1] = pos.y - updatedShape.y;
             }
             updatedShape.points = tempPoints;
        }
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
      } else if (finalShape.type === 'line') {
        const points = finalShape.points;
        if (points.length === 4) {
            const [x2, y2] = [points[2], points[3]];
            if (Math.sqrt(x2 * x2 + y2 * y2) < 5) { 
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
         // Add new fixed point relative to shape's origin
         // For the first segment, currentPoints might be [0,0, mouseX, mouseY]
         // It becomes [0,0, fixedX, fixedY] then we add a new [nextMouseX, nextMouseY] for drawing
         if (currentPoints.length === 2 && currentPoints[0] === 0 && currentPoints[1] === 0) { // Only start point exists
            currentPoints.push(pos.x - finalShape.x, pos.y - finalShape.y);
         } // else, the last point was already set by mouseMove
         
         // Prepare for the next segment: add a new point that will follow the mouse
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
      // Remove the last two points (which were for the "live" segment end)
      if (finalShape.points.length > 2) {
        finalShape.points = finalShape.points.slice(0, -2);
      }
      
      if (finalShape.points.length < (finalShape.type === 'polyline' ? 4 : (finalShape.type === 'polygon' ? 6 : 0))) { 
        onUpdateShapes(shapes.filter(s => s.id !== finalShape.id)); 
      } else {
         onUpdateSingleShape(finalShape); 
      }
      setIsDrawing(false);
      setCurrentDrawingShape(null);
    }
  };

  const handleDragEnd = (e: KonvaEventObject<DragEvent>, id: string) => {
    const node = e.target;
    const originalShape = shapes.find(s => s.id === id);
    if (originalShape) {
        const updatedShape: Shape = {
            ...(originalShape as Shape), // Type assertion
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
        updatedAttrs.scaleX = 1; 
        updatedAttrs.scaleY = 1;
        node.scaleX(1); 
        node.scaleY(1);
      } else { 
        updatedAttrs.scaleX = parseFloat(node.scaleX().toFixed(3));
        updatedAttrs.scaleY = parseFloat(node.scaleY().toFixed(3));
      }
      
      onUpdateSingleShape({ ...originalShape, ...updatedAttrs } as Shape);
    }
  };
  
  const handleLineEndpointDragStart = () => {
    setIsDraggingLineHandle(true);
  };

  const handleLineEndpointDragMove = (e: KonvaEventObject<DragEvent>, lineId: string, pointIndex: 0 | 2) => {
    const stage = e.target.getStage();
    if (!stage) return;
    
    const lineShape = shapes.find(s => s.id === lineId && s.type === 'line') as LineShape | undefined;
    if (!lineShape) return;

    const pos = getPointerPosition(stage); 

    const newPoints = [...lineShape.points];
    newPoints[pointIndex] = pos.x - (lineShape.x || 0);
    newPoints[pointIndex + 1] = pos.y - (lineShape.y || 0);
    
    const lineNode = layerRef.current?.findOne('#' + lineId) as Konva.Line | undefined;
    if(lineNode) {
        lineNode.points(newPoints);
    }
    e.target.position({ x: pos.x, y: pos.y });
    layerRef.current?.batchDraw();
  };
  
  const handleLineEndpointDragEnd = (e: KonvaEventObject<DragEvent>, lineId: string, pointIndex: 0 | 2) => {
    setIsDraggingLineHandle(false);
    const stage = e.target.getStage();
    if (!stage) return;

    const lineShape = shapes.find(s => s.id === lineId && s.type === 'line') as LineShape | undefined;
    if (!lineShape) return;
    
    const pos = getPointerPosition(stage); 

    const finalPoints = [...lineShape.points];
    finalPoints[pointIndex] = pos.x - (lineShape.x || 0);
    finalPoints[pointIndex + 1] = pos.y - (lineShape.y || 0);

    onUpdateSingleShape({ ...lineShape, points: finalPoints });
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
    const baseProps: any = { 
      key: shape.id,
      id: shape.id,
      x: shape.x,
      y: shape.y,
      rotation: shape.rotation || 0,
      scaleX: shape.scaleX || 1,
      scaleY: shape.scaleY || 1,
      draggable: currentTool === 'select' && (shape.draggable !== false) && !isDraggingLineHandle, 
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
        draggable={currentTool === 'select' && selectedShapeIds.length === 0 && !isDrawing && !selectionRect?.visible && !isDraggingLineHandle}
        style={{ cursor: currentTool === 'select' ? ( (isDrawing || selectionRect?.visible || isDraggingLineHandle) ? 'crosshair' : 'grab') : 'crosshair' }}
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
          />
          {selectedShapeIds.length === 1 && (() => {
            const lineShape = shapes.find(s => s.id === selectedShapeIds[0] && s.type === 'line') as LineShape | undefined;
            if (lineShape) {
              const handleRadius = 6 / currentStageScale; 
              const handleStrokeWidth = 1 / currentStageScale;
              const points = lineShape.points;
              const lineX = lineShape.x || 0;
              const lineY = lineShape.y || 0;

              const handlePositions = [
                { x: lineX + points[0], y: lineY + points[1], pointIndex: 0 as const },
                { x: lineX + points[2], y: lineY + points[3], pointIndex: 2 as const },
              ];
              
              return (
                <React.Fragment>
                  {handlePositions.map(hp => (
                    <Circle
                      key={`${lineShape.id}-handle-${hp.pointIndex}`}
                      x={hp.x}
                      y={hp.y}
                      radius={handleRadius}
                      fill="hsl(var(--primary))"
                      stroke="hsl(var(--primary-foreground))"
                      strokeWidth={handleStrokeWidth}
                      draggable={currentTool === 'select'}
                      onDragStart={handleLineEndpointDragStart}
                      onDragMove={(e) => handleLineEndpointDragMove(e, lineShape.id, hp.pointIndex)}
                      onDragEnd={(e) => handleLineEndpointDragEnd(e, lineShape.id, hp.pointIndex)}
                      name="line-handle" 
                      hitStrokeWidth={10 / currentStageScale} 
                    />
                  ))}
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
              fill="rgba(0,160,255,0.3)" 
              stroke="hsl(var(--primary))"
              strokeWidth={1 / currentStageScale} 
              visible={selectionRect.visible}
              listening={false} 
              name="selection-rectangle-class" // Added name for potential use in export hiding
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
};

export default KonvaCanvas;
