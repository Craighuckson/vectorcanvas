
export type ShapeTool = 'rectangle' | 'ellipse' | 'line'; // 'polyline' | 'polygon' | 'text' can be added
export type Tool = 'select' | ShapeTool | 'stamp';

interface BaseShapeStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dash?: number[]; // For Konva: [dash, gap, dash, gap, ...]
}

export interface BaseShape extends BaseShapeStyle {
  id: string;
  type: ShapeTool; // For now, only ShapeTool types. Could be expanded.
  x: number;
  y: number;
  width?: number; // Optional for line, mandatory for others
  height?: number; // Optional for line, mandatory for others
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  points?: number[]; // For line: [x1, y1, x2, y2]. For polyline/polygon: [x1, y1, x2, y2, ...]
}

export interface RectangleShape extends BaseShape {
  type: 'rectangle';
  width: number;
  height: number;
}

export interface EllipseShape extends BaseShape {
  type: 'ellipse';
  width: number; // Represents radiusX * 2
  height: number; // Represents radiusY * 2
}

export interface LineShape extends BaseShape {
  type: 'line';
  points: number[]; // [x1, y1, x2, y2]
}

export type Shape = RectangleShape | EllipseShape | LineShape; // Union of all specific shape types

export interface CanvasState {
  shapes: Shape[];
  selectedShapeIds: string[];
  currentTool: Tool;
  defaultFillColor: string;
  defaultStrokeColor: string;
  defaultStrokeWidth: number;
  currentLineStyle: 'solid' | 'dashed' | 'dotted';
}

export interface HistoryEntry {
  shapes: Shape[];
  selectedShapeIds: string[];
}
