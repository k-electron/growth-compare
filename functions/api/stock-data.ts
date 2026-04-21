import YahooFinance from 'yahoo-finance2';

export async function onRequestPost(context: any) {
  try {
    const { request } = context;
    const body = await request.clone().json();
    const { tickers, start, end } = body;
    
    if (!Array.isArray(tickers) || tickers.length === 0) {
       return new Response(JSON.stringify({ error: 'Tickers array is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const results: Record<string, any> = {};
    const promises = tickers.map(async (ticker: string) => {
      try {
        const data = await YahooFinance.historical(ticker, {
          period1: start,
          period2: end,
          interval: '1d',
        });
        results[ticker] = data;
      } catch (error: any) {
        results[ticker] = { error: error.message || 'Unknown error fetching data' };
      }
    });

    await Promise.all(promises);
    return new Response(JSON.stringify(results), { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
    });
  }
}
