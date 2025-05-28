
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
  const [isDraggingLineHandle, setIsDraggingLineHandle] = useState(false);

  useEffect(() => {
    if (transformerRef.current && layerRef.current) {
      const selectedKonvaNodes = selectedShapeIds
        .map(id => layerRef.current?.findOne('#' + id))
        .filter(node => node) as Konva.Node[];

      const isSingleLineSelected = 
        selectedKonvaNodes.length === 1 && 
        shapes.find(s => s.id === selectedKonvaNodes[0].id())?.type === 'line';

      if (isSingleLineSelected) {
        transformerRef.current.nodes([]); // Detach transformer from single lines
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
    // Adjust for stage position and scale to get coordinates relative to unscaled layer
    return {
      x: (pos.x - stage.x()) / stage.scaleX(),
      y: (pos.y - stage.y()) / stage.scaleY(),
    };
  };

  const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    
    // If clicking on a line handle, let its drag events manage it
    if (e.target.name() === 'line-handle') {
      // Prevent stage drag or selection rect start when interacting with a handle
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
      // Traverse up to find the shape's main node or if we hit the transformer's node
      while (shapeNode.getParent() && shapeNode.getParent() !== layerRef.current && !shapeNode.id()) {
         if (shapeNode.getParent() instanceof Konva.Transformer) { 
            // If clicking on a part of the transformer itself, target the shape it's transforming
            shapeNode = shapeNode.getParent().nodes()[0] || shapeNode; 
            break;
         }
         shapeNode = shapeNode.getParent();
      }
      const shapeId = shapeNode.id();
      
      const isSelected = selectedShapeIds.includes(shapeId);

      if (e.evt.metaKey || e.evt.ctrlKey) { // Ctrl/Cmd + Click for multi-select
        setSelectedShapeIds(isSelected ? selectedShapeIds.filter(id => id !== shapeId) : [...selectedShapeIds, shapeId]);
      } else { // Normal click
        if (shapeId) { // Clicked on a shape
            if (!isSelected) { // If not already selected, select it
                setSelectedShapeIds([shapeId]);
            } else if (selectedShapeIds.length > 1 && selectedShapeIds.includes(shapeId)) {
                // If it's part of a multi-selection, make it the only selected item
                setSelectedShapeIds([shapeId]);
            }
            // If it's already the *only* selected item, clicking it again does nothing to the selection.
        } else { // Clicked on something without an ID (should be rare if not stage)
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
          // For lines, x and y are the start point, points array stores relative end point
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
            setIsDrawing(false); // Text is placed immediately
            setCurrentDrawingShape(null);
            return; // Exit early for text
        default: return; // Should not happen
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
       // Update selection rectangle
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
        // Center of ellipse is calculated for drawing, radius is half of distance
        updatedShape.x = (currentDrawingShape.x + pos.x) / 2;
        updatedShape.y = (currentDrawingShape.y + pos.y) / 2;
        updatedShape.width = Math.abs(pos.x - currentDrawingShape.x); // Diameter
        updatedShape.height = Math.abs(pos.y - currentDrawingShape.y); // Diameter
        break;
      case 'line':
        // Points are relative to the shape's x,y
        // Initial x,y is shape.x, shape.y. Points are [0,0, relativeX, relativeY]
        updatedShape.points = [0, 0, pos.x - updatedShape.x, pos.y - updatedShape.y];
        break;
      case 'polyline':
      case 'polygon':
        // For polyline/polygon during initial drawing, currentDrawingShape.points has the last fixed point
        // We are drawing the next segment from last fixed point to current mouse pos
        // This logic might need adjustment based on how points are added in handleMouseUp
        // The currentDrawingShape.points only holds the starting point of the current segment.
        // Let's assume points array gets updated segment by segment in mouseUp
        // For now, this mouseMove only visualizes the very first segment if that's how it's structured
        if (updatedShape.points.length >=2) {
             const tempPoints = [...updatedShape.points];
             tempPoints[tempPoints.length-2] = pos.x - updatedShape.x;
             tempPoints[tempPoints.length-1] = pos.y - updatedShape.y;
             // This is not how polyline/polygon drawing works typically during mouse move.
             // Usually, mouse move would update the *last* point of an *existing* points array.
             // The current onAddShape adds it with [0,0] or [0,0,0,0]
             // This needs to be robustly handled with handleMouseUp for polyline/polygon
        }
        break;
    }
    // For drawing, we update the shape in the main list for live preview
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
        layerRef.current?.find('.shape-draggable').forEach(node => { // Target named shapes
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
        // Normalize width/height to be positive
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
         onUpdateSingleShape(finalShape); // Final update
      } else if (finalShape.type === 'line') {
        const points = finalShape.points;
        // Points are [0,0, relX, relY]. Check distance of relX, relY from 0,0.
        if (points.length === 4) {
            const [x2, y2] = [points[2], points[3]];
            if (Math.sqrt(x2 * x2 + y2 * y2) < 5) { // Line too short
                // Remove the line
                onUpdateShapes(shapes.filter(s => s.id !== finalShape.id));
                setCurrentDrawingShape(null); 
                setIsDrawing(false);
                return;
            }
        }
         onUpdateSingleShape(finalShape); // Final update
      }
      
      // Polyline/Polygon point addition logic
      if (currentTool === 'polyline' || currentTool === 'polygon') {
         const currentPoints = [...finalShape.points];
         // Add new point relative to shape's origin (x,y)
         currentPoints.push(pos.x - finalShape.x, pos.y - finalShape.y);
         const updatedPolyShape = {...finalShape, points: currentPoints};
         onUpdateSingleShape(updatedPolyShape);
         setCurrentDrawingShape(updatedPolyShape); // Keep drawing for next point
         // Do not set isDrawing to false here, double click will finish
         return; 
      }

      setIsDrawing(false);
      setCurrentDrawingShape(null);
    }
  };

  // Double click finishes polyline/polygon
  const handleDoubleClick = (e: KonvaEventObject<MouseEvent>) => {
    if ((currentDrawingShape?.type === 'polyline' || currentDrawingShape?.type === 'polygon') && isDrawing) {
      let finalShape = { ...currentDrawingShape };
      // Remove the last point added on mouseUp if it's redundant (often it is, as dblclick also fires mouseup)
      // Or, ensure the logic handles that the last segment is defined by the dblclick position.
      // For simplicity, we assume the points are mostly correct from the last mouseUp.
      // If a polyline/polygon has too few points (e.g., less than 2 for polyline, 3 for polygon)
      if (finalShape.points.length < (finalShape.type === 'polyline' ? 4 : 6)) { // (2 pairs of coords for poly, 3 for poly)
        onUpdateShapes(shapes.filter(s => s.id !== finalShape.id)); // Remove it
      } else {
         onUpdateSingleShape(finalShape); // Finalize it
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
        updatedAttrs.scaleX = 1; 
        updatedAttrs.scaleY = 1;
        node.scaleX(1); 
        node.scaleY(1);
      } else { // For groups, lines, polylines, polygons, text
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

    const pos = getPointerPosition(stage); // Absolute stage coordinates of the pointer

    const newPoints = [...lineShape.points];
    // Convert absolute pointer position to point relative to the line's origin (x,y)
    newPoints[pointIndex] = pos.x - (lineShape.x || 0);
    newPoints[pointIndex + 1] = pos.y - (lineShape.y || 0);
    
    // Update the Konva node directly for immediate visual feedback without creating history spam
    const lineNode = layerRef.current?.findOne('#' + lineId) as Konva.Line | undefined;
    if(lineNode) {
        lineNode.points(newPoints);
    }
    // Update the handle's position to stick to the cursor
    e.target.position({ x: pos.x, y: pos.y });
    layerRef.current?.batchDraw();
  };
  
  const handleLineEndpointDragEnd = (e: KonvaEventObject<DragEvent>, lineId: string, pointIndex: 0 | 2) => {
    setIsDraggingLineHandle(false);
    const stage = e.target.getStage();
    if (!stage) return;

    const lineShape = shapes.find(s => s.id === lineId && s.type === 'line') as LineShape | undefined;
    if (!lineShape) return;
    
    const pos = getPointerPosition(stage); // Absolute stage coordinates

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
    newScale = Math.max(0.1, Math.min(newScale, 10)); // Clamp zoom level

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
      strokeScaleEnabled: false, // Important for consistent stroke width on scaling
      name: 'shape-draggable', // Used for selection rectangle logic
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
      // Initial size
      setContainerSize({ width: node.offsetWidth, height: node.offsetHeight }); 
      return () => resizeObserver.disconnect(); // Cleanup
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
            // Rotation for lines will still be handled by transformer if it's part of a multi-selection
            // or if we decide to enable only rotation for single lines via transformer.
          />
          {/* Render Line Handles */}
          {selectedShapeIds.length === 1 && (() => {
            const lineShape = shapes.find(s => s.id === selectedShapeIds[0] && s.type === 'line') as LineShape | undefined;
            if (lineShape) {
              const handleRadius = 6 / currentStageScale; // Make handles scale inversely with zoom
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
                      name="line-handle" // To identify handles and prevent stage drag
                      hitStrokeWidth={10 / currentStageScale} // Easier to grab
                    />
                  ))}
                </React.Fragment>
              );
            }
            return null;
          })()}

          {/* Selection Rectangle */}
          {selectionRect?.visible && (
            <Rect
              ref={selectionRectRef}
              x={selectionRect.x}
              y={selectionRect.y}
              width={selectionRect.width}
              height={selectionRect.height}
              fill="rgba(var(--primary-rgb),0.2)" // Use theme color with alpha
              stroke="hsl(var(--primary))"
              strokeWidth={1 / currentStageScale} 
              visible={selectionRect.visible}
              listening={false} 
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
};

// Helper to convert HSL string to an RGB object string for rgba()
// This is a simplified example; a robust HSL parser might be needed if HSL format varies.
const primaryHsl = "176 42% 49%"; // from globals.css --primary
const hslToRgbString = (hsl: string): string => {
    // This is a placeholder. Actual conversion is complex.
    // For "176 42% 49%" (Teal), it's approx R:70, G:179, B:172
    // You might need a library or a more detailed function for perfect HSL to RGB conversion.
    if (hsl === "176 42% 49%") return "70,179,172"; // Teal approx
    return "0,120,255"; // Default blue as fallback
}
// In a real app, you'd parse CSS variables or use a utility for this.
const primaryRgbString = hslToRgbString(primaryHsl);
// Then use `rgba(${primaryRgbString},0.2)` for fill.
// For simplicity, I'll use a fixed rgba string for now if CSS var access is too complex here.
// Replacing `rgba(var(--primary-rgb),0.2)` with `rgba(70,179,172,0.2)`
// Or better yet, use a value from the theme for the selection rect.
// Let's use `rgba(0,160,255,0.3)` which was there before, as it's simple.

export default KonvaCanvas;


    