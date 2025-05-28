
export type ShapeType = 'rectangle' | 'ellipse' | 'line' | 'polyline' | 'polygon' | 'text' | 'group';
export type ShapeTool = 'rectangle' | 'ellipse' | 'line' | 'polyline' | 'polygon' | 'text';
export type ActionTool = 'select' | 'group' | 'ungroup' | 'stamp';
export type Tool = ShapeTool | ActionTool;

export interface BaseShapeStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dash?: number[]; // For Konva: [dash, gap, dash, gap, ...]
  opacity?: number;
}

export interface BaseShape extends BaseShapeStyle {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  draggable?: boolean; // Individual shape draggable state
  locked?: boolean;
  name?: string; // For easier identification, esp. for groups
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
  points: number[]; // [x1, y1, x2, y2] relative to shape x,y (which is 0,0 for lines usually)
}

export interface PolylineShape extends BaseShape {
  type: 'polyline';
  points: number[]; // [x1, y1, x2, y2, ..., xn, yn] relative to shape x,y
}

export interface PolygonShape extends BaseShape {
  type: 'polygon';
  points: number[]; // [x1, y1, x2, y2, ..., xn, yn] relative to shape x,y (closed path)
  closed?: boolean; // Konva specific property for polygons
}

export interface TextShape extends BaseShape {
  type: 'text';
  text: string;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: string; // 'normal', 'bold', 'italic', 'bold italic'
  textDecoration?: string; // 'underline', 'line-through'
  align?: string; // 'left', 'center', 'right'
  verticalAlign?: string; // 'top', 'middle', 'bottom'
  padding?: number;
  lineHeight?: number;
  letterSpacing?: number;
  wrap?: string; // 'word', 'char', 'none'
  ellipsis?: boolean;
  // width and height for text are often auto-calculated by Konva or can be set for bounding box
}

export interface GroupShape extends BaseShape {
  type: 'group';
  children: Shape[]; // Nested shapes or other groups
  // Group x,y, width, height are derived from children or can be set for clipping
}

export type Shape =
  | RectangleShape
  | EllipseShape
  | LineShape
  | PolylineShape
  | PolygonShape
  | TextShape
  | GroupShape;

export interface CanvasState {
  shapes: Shape[];
  selectedShapeIds: string[];
  currentTool: Tool;
  defaultFillColor: string;
  defaultStrokeColor: string;
  defaultStrokeWidth: number;
  currentLineStyle: 'solid' | 'dashed' | 'dotted';
  // Add other global canvas settings here if needed
}

export interface HistoryEntry {
  shapes: Shape[];
  selectedShapeIds: string[];
  // Could also store view parameters like zoom/pan if needed for history
}

export interface Template {
  id: string;
  name: string;
  shapes: Shape[]; // The shapes that make up the template/stamp
  preview?: string; // Optional: base64 encoded image for preview
}
