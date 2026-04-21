export interface RawPoint {
  date: string;
  adjClose: number;
  [key: string]: any;
}

export function computePercentageGrowth(series: RawPoint[], appliedStartMs: number) {
  const validPoints = series.filter(p => new Date(p.date).getTime() >= appliedStartMs - 12 * 60 * 60 * 1000);
  
  if (validPoints.length === 0) return [];
  
  const baseline = validPoints[0].adjClose;
  return validPoints.map(point => ({
    date: point.date.split('T')[0],
    price: point.adjClose,
    pct: ((point.adjClose - baseline) / baseline) * 100
  }));
}
