export interface Point {
  x: number;
  y: number;
}

export interface GridPoint extends Point {
  label?: string;
}

export interface GridLine {
  from: Point;
  to: Point;
  style?: 'primary' | 'secondary';
}
