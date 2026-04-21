export async function resolveTickers(inputTickers: string[]): Promise<string[]> {
  const KNOWN_MAPPINGS: Record<string, string> = {
    'FB': 'META',
    'SQUARE': 'SQ',
    'TWTR': 'DELISTED',
    'GOOG': 'GOOGL',
  };

  return inputTickers.map(t => {
    const upper = t.toUpperCase();
    return KNOWN_MAPPINGS[upper] || upper;
  });
}
