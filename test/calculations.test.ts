import { describe, it, expect } from 'vitest';
import { computePercentageGrowth } from '../src/lib/calculations';

describe('computePercentageGrowth', () => {
  it('calculates the growth relative to the first valid point', () => {
    const mockSeries = [
      { date: '2024-01-01T00:00:00Z', adjClose: 100 },
      { date: '2024-01-02T00:00:00Z', adjClose: 110 },
      { date: '2024-01-03T00:00:00Z', adjClose: 90 },
      { date: '2024-01-04T00:00:00Z', adjClose: 150 },
    ];
    
    // start exactly on 2024-01-01
    const appliedStartMs = new Date('2024-01-01T00:00:00Z').getTime();
    const result = computePercentageGrowth(mockSeries, appliedStartMs);
    
    expect(result).toHaveLength(4);
    expect(result[0].pct).toBe(0); 
    expect(result[1].pct).toBe(10);  // 110 is 10% more than 100
    expect(result[2].pct).toBe(-10); // 90 is 10% less than 100
    expect(result[3].pct).toBe(50);  // 150 is 50% more than 100
  });

  it('filters out previous dates correctly and creates a new baseline', () => {
    const mockSeries = [
      { date: '2023-12-01T00:00:00Z', adjClose: 50 }, // should be ignored
      { date: '2024-01-01T00:00:00Z', adjClose: 100 },
      { date: '2024-01-02T00:00:00Z', adjClose: 150 },
    ];
    
    const appliedStartMs = new Date('2024-01-01T00:00:00Z').getTime();
    const result = computePercentageGrowth(mockSeries, appliedStartMs);
    
    expect(result).toHaveLength(2);
    expect(result[0].pct).toBe(0); // new baseline is 100
    expect(result[1].pct).toBe(50);  // 150 vs 100 = 50%
  });

  it('returns an empty array when no points match', () => {
    const mockSeries = [
      { date: '2023-12-01T00:00:00Z', adjClose: 50 },
    ];
    const appliedStartMs = new Date('2024-01-01T00:00:00Z').getTime();
    const result = computePercentageGrowth(mockSeries, appliedStartMs);
    
    expect(result).toHaveLength(0);
  });
});
