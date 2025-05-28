
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
  const [currentDrawingShape, setCurrentDrawingShape] = useState<Shape | null>(null); // For multi-stage drawing like polyline
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
    if (!pos) return { x: 0, y: 0 }; // Prevent null pointer if stage is not interactive yet
    // Transform pointer position by stage scale and position for accurate drawing coordinates
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
      // Correctly identify the shape node, even if part of a group or transformer
      let shapeNode = e.target;
      while (shapeNode.getParent() && shapeNode.getParent() !== layerRef.current && !shapeNode.id()) {
         if (shapeNode.getParent() instanceof Konva.Transformer) { // Clicked on transformer anchor
            shapeNode = shapeNode.getParent().nodes()[0] || shapeNode; // Get the transformed node
            break;
         }
         shapeNode = shapeNode.getParent();
      }
      const shapeId = shapeNode.id();
      
      const isSelected = selectedShapeIds.includes(shapeId);
      if (e.evt.metaKey || e.evt.ctrlKey) { // Multi-select with Cmd/Ctrl
        setSelectedShapeIds(isSelected ? selectedShapeIds.filter(id => id !== shapeId) : [...selectedShapeIds, shapeId]);
      } else { // Single select
        setSelectedShapeIds(shapeId && !isSelected ? [shapeId] : (isSelected ? selectedShapeIds : []));
        if(shapeId && isSelected && selectedShapeIds.length > 1) {
             setSelectedShapeIds([shapeId]); // if already selected among others, make it the only selection
        } else if (shapeId && !isSelected) {
             setSelectedShapeIds([shapeId]);
        } else if (!shapeId) {
             setSelectedShapeIds([]); // Clicked on something without ID (e.g. group background if not careful)
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
          initialShape = { id, type: 'polyline', x: 0, y: 0, points: [pos.x, pos.y], stroke: defaultStrokeColor, strokeWidth: defaultStrokeWidth, dash: dashArray, draggable: true };
          break;
        // Placeholder for polygon and text, more complex interactions
        case 'polygon': // Similar to polyline but closed
          initialShape = { id, type: 'polygon', x: 0, y: 0, points: [pos.x, pos.y], stroke: defaultStrokeColor, strokeWidth: defaultStrokeWidth, dash: dashArray, fill: defaultFillColor, closed: true, draggable: true };
           break;
        case 'text':
            const defaultText = prompt("Enter text:", "Hello") || "Text";
            initialShape = { id, type: 'text', text: defaultText, x: pos.x, y: pos.y, fontSize: 20, fontFamily: 'Arial', fill: defaultStrokeColor, draggable: true };
            onAddShape(initialShape);
            setIsDrawing(false); // Text is placed on click, not dragged out typically
            setCurrentDrawingShape(null);
            return; // Exit early for text
        default: return; 
      }
      setCurrentDrawingShape(initialShape);
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
      case 'ellipse': // Center based drawing for ellipse
        updatedShape.width = Math.abs(pos.x - updatedShape.x) * 2;
        updatedShape.height = Math.abs(pos.y - updatedShape.y) * 2;
        break;
      case 'line':
        updatedShape.points = [updatedShape.points[0], updatedShape.points[1], pos.x, pos.y];
        break;
      case 'polyline':
      case 'polygon':
        // For polyline/polygon, update the last point during drag
        const currentPoints = [...updatedShape.points];
        currentPoints[currentPoints.length - 2] = pos.x;
        currentPoints[currentPoints.length - 1] = pos.y;
        updatedShape.points = currentPoints;
        break;
    }
    setCurrentDrawingShape(updatedShape);
  };

  const handleMouseUp = (e: KonvaEventObject<MouseEvent>) => {
     const stage = e.target.getStage();
     if (!stage) return;
     const pos = getPointerPosition(stage);

    if (currentTool === 'select' && selectionRect?.visible && selectionRectRef.current) {
        setSelectionRect(prev => prev ? {...prev, visible: false} : null);
        const selBox = selectionRectRef.current.getClientRect({relativeTo: layerRef.current});
        const selected: string[] = [];
        layerRef.current?.find('.shape-draggable').forEach(node => { // Target draggable shapes
            const nodeBox = node.getClientRect({relativeTo: layerRef.current});
            if (Konva.Util.haveIntersection(selBox, nodeBox)) {
                selected.push(node.id());
            }
        });
        setSelectedShapeIds(selected);
        return;
    }

    if (isDrawing && currentDrawingShape) {
      if (currentDrawingShape.type === 'polyline' || currentDrawingShape.type === 'polygon') {
        // For polyline/polygon, don't finalize on mouseUp, add point on click (handled in handleMouseDown or a double click)
        // Or, if it's the first segment, we keep drawing
        // This logic needs refinement for multi-point shapes.
        // For now, simple polyline: add point on click, finish on Esc or different tool.
        // Let's simplify for now: polyline finishes on mouse up for the first segment.
        // More complex polyline/polygon drawing (multiple clicks) will require state for current path points.
        // For now, currentDrawingShape is the *entire* shape being drawn.
      }

      // Normalize width/height for rectangles and ellipses
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
      } else if (finalShape.type === 'line' || finalShape.type === 'polyline' || finalShape.type === 'polygon') {
        const [x1, y1, x2, y2] = finalShape.points.slice(-4); // Check last segment for lines/polylines
        const dx = x2 - x1;
        const dy = y2 - y1;
        if (Math.sqrt(dx * dx + dy * dy) < 5 && finalShape.points.length <=2) { // Only discard if it's a tiny single segment
            setCurrentDrawingShape(null); 
            setIsDrawing(false);
            return;
        }
      }
      
      // For multi-point shapes like polyline/polygon, this might be an intermediate add.
      // For simple drag-out shapes, this is the final add.
      if (currentTool !== 'polyline' && currentTool !== 'polygon') { // These require special handling for finalization
        onAddShape(finalShape);
        setIsDrawing(false);
        setCurrentDrawingShape(null);
      } else if (currentDrawingShape.type === 'polyline' || currentDrawingShape.type === 'polygon') {
        // For first segment of polyline/polygon
         const currentPoints = [...currentDrawingShape.points];
         currentPoints.push(pos.x, pos.y); // Add a new point placeholder for next segment
         setCurrentDrawingShape({...currentDrawingShape, points: currentPoints});
         // Don't set setIsDrawing(false) yet, continue drawing
      }
    }
  };

  const handleDoubleClick = (e: KonvaEventObject<MouseEvent>) => {
    if ((currentDrawingShape?.type === 'polyline' || currentDrawingShape?.type === 'polygon') && isDrawing) {
      // Finalize polyline/polygon on double click
      let finalShape = { ...currentDrawingShape };
      // Remove the last temporary point added on mouse move/up if it's a duplicate of the second to last
      if (finalShape.points.length >= 4) {
        const lx1 = finalShape.points[finalShape.points.length - 4];
        const ly1 = finalShape.points[finalShape.points.length - 3];
        const lx2 = finalShape.points[finalShape.points.length - 2];
        const ly2 = finalShape.points[finalShape.points.length - 1];
        if (lx1 === lx2 && ly1 === ly2) {
          finalShape.points = finalShape.points.slice(0, -2);
        }
      }
      if (finalShape.points.length >= (finalShape.type === 'polyline' ? 4 : 6)) { // Min 2 segments for polyline, 3 for polygon
         onAddShape(finalShape);
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
        // For line-based shapes, x/y are 0,0 if points are absolute.
        // If we drag them, we need to update all points.
        // Konva's drag gives delta in x(), y().
        const dx = node.x() - (originalShape.x || 0); // originalShape.x should be 0 for these if points are global
        const dy = node.y() - (originalShape.y || 0);
        
        updatedShape.points = (originalShape as LineShape | PolylineShape | PolygonShape).points.map((p, i) => i % 2 === 0 ? p + dx : p + dy);
        updatedShape.x = originalShape.x || 0; // Keep original x/y, or reset to 0,0
        updatedShape.y = originalShape.y || 0;
        node.position({x: originalShape.x || 0, y: originalShape.y || 0}); // Reset visual position after applying delta to points
      }
      onUpdateSingleShape(updatedShape);
    }
  };

  const handleTransformEnd = (e: KonvaEventObject<Event>) => {
    const node = e.target; // This is the shape's Konva node
    const shapeId = node.id();
    const originalShape = shapes.find(s => s.id === shapeId);

    if (originalShape) {
      let updatedAttrs: Partial<Shape> = {
        x: node.x(),
        y: node.y(),
        rotation: parseFloat(node.rotation().toFixed(2)),
        scaleX: parseFloat(node.scaleX().toFixed(3)), // Store scale from transformer
        scaleY: parseFloat(node.scaleY().toFixed(3)),
      };

      if (originalShape.type === 'rectangle' || originalShape.type === 'ellipse') {
        updatedAttrs.width = node.width() * node.scaleX();
        updatedAttrs.height = node.height() * node.scaleY();
        updatedAttrs.scaleX = 1; // Reset scale on node after applying to dimensions
        updatedAttrs.scaleY = 1;
      } else if (originalShape.type === 'line' || originalShape.type === 'polyline' || originalShape.type === 'polygon') {
        // Points need to be transformed. Konva node itself will have new x,y,scale,rotation.
        // For simplicity, we'll store these and apply them in rendering.
        // True point transformation is complex and involves applying the node's transform matrix.
        // For now, the visual representation will be correct due to Konva's transform.
        // We're storing the transform properties to re-apply them.
      } else if (originalShape.type === 'text') {
         // Text scaling might affect fontSize or just scale. Let's use scale for now.
         // Width/height for text are tricky, often auto.
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
    newScale = Math.max(0.1, Math.min(newScale, 10)); // Zoom limits


    stage.scale({ x: newScale, y: newScale });

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    stage.position(newPos);
    stage.batchDraw();
  };

  const renderShape = (shape: Shape): React.ReactNode => {
    const isSelected = selectedShapeIds.includes(shape.id);
    const baseProps = {
      key: shape.id,
      id: shape.id,
      x: shape.x,
      y: shape.y,
      rotation: shape.rotation || 0,
      scaleX: shape.scaleX || 1,
      scaleY: shape.scaleY || 1,
      draggable: currentTool === 'select' && (shape.draggable !== false), // Draggable if tool is select and shape allows
      onDragEnd: (evt: KonvaEventObject<DragEvent>) => handleDragEnd(evt, shape.id),
      onTransformEnd: handleTransformEnd,
      opacity: shape.opacity ?? 1,
      strokeScaleEnabled: false, // Keep stroke width constant during scaling
      name: 'shape-draggable', // Class name for selection logic
      // Shadow for selected items (optional)
      // shadowColor: isSelected ? 'rgba(0, 160, 255, 0.7)' : undefined,
      // shadowBlur: isSelected ? 5 : 0,
      // shadowOffsetX: isSelected ? 2 : 0,
      // shadowOffsetY: isSelected ? 2 : 0,
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
        return <KonvaLine {...baseProps} x={0} y={0} points={line.points} stroke={line.stroke} strokeWidth={line.strokeWidth} dash={line.dash} />;
      case 'polyline':
        const polyline = shape as PolylineShape;
        return <KonvaLine {...baseProps} x={0} y={0} points={polyline.points} stroke={polyline.stroke} strokeWidth={polyline.strokeWidth} dash={polyline.dash} fillEnabled={false} />;
      case 'polygon':
        const polygon = shape as PolygonShape;
        return <KonvaLine {...baseProps} x={0} y={0} points={polygon.points} stroke={polygon.stroke} strokeWidth={polygon.strokeWidth} dash={polygon.dash} fill={polygon.fill} closed={true} />;
      case 'text':
        const text = shape as TextShape;
        return <KonvaText {...baseProps} text={text.text} fontSize={text.fontSize} fontFamily={text.fontFamily} fill={text.fill} width={text.width} height={text.height} align={text.align} verticalAlign={text.verticalAlign} padding={text.padding} lineHeight={text.lineHeight} wrap={text.wrap} ellipsis={text.ellipsis} fontStyle={text.fontStyle} textDecoration={text.textDecoration}/>;
      case 'group':
        const group = shape as GroupShape;
        // Clip group if width/height are set
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
  
  // Render shapes
  const allShapesToRender = currentDrawingShape ? [...shapes, currentDrawingShape] : shapes;


  // Ensure canvas resizes with container
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node !== null) {
      const resizeObserver = new ResizeObserver(() => {
        setContainerSize({ width: node.offsetWidth, height: node.offsetHeight });
      });
      resizeObserver.observe(node);
      setContainerSize({ width: node.offsetWidth, height: node.offsetHeight }); // Initial size
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
        onDblClick={handleDoubleClick} // For finalizing polylines/polygons
        draggable={currentTool === 'select' && selectedShapeIds.length === 0}
        className="cursor-crosshair" // This might need dynamic adjustment based on tool
        style={{ cursor: currentTool === 'select' ? (isDrawing ? 'grabbing' : 'grab') : 'crosshair' }}
      >
        <Layer ref={layerRef}>
          {allShapesToRender.map(shape => renderShape(shape))}
          <Transformer
            ref={transformerRef}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 5 || newBox.height < 5) {
                return oldBox;
              }
              return newBox;
            }}
            // Consider adding rotateAnchorOffset, anchorSize, etc. for better UX
            // Keep aspect ratio for certain shapes if needed (e.g. Shift + drag)
            // enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']}
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
              strokeWidth={1 / (stageRef.current?.scaleX() || 1)} // Keep border thin on zoom
              visible={selectionRect.visible}
              listening={false} // Important for selection rect not to interfere
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
};

export default KonvaCanvas;

    