import { describe, it, expect } from 'vitest';
import { resolveTickers } from '../src/lib/tickerResolution';

describe('tickerResolution', () => {
  it('resolves known tickers', async () => {
    const input = ['FB', 'TWTR', 'SQUARE'];
    const resolved = await resolveTickers(input);
    expect(resolved).toEqual(['META', 'DELISTED', 'SQ']);
  });

  it('keeps unknown tickers as is except uppercase', async () => {
    const input = ['aapl', 'TSLA', 'unknownTicker'];
    const resolved = await resolveTickers(input);
    expect(resolved).toEqual(['AAPL', 'TSLA', 'UNKNOWNTICKER']);
  });

  it('handles empty input', async () => {
    const resolved = await resolveTickers([]);
    expect(resolved).toEqual([]);
  });
});
