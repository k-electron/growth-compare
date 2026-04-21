import YahooFinance from 'yahoo-finance2';
const yf = new YahooFinance();
async function run() {
  try {
    const data = await yf.historical('AAPL', { period1: '2024-01-01', period2: '2024-01-05', interval: '1d' });
    console.log(JSON.stringify(data, null, 2));
  } catch(e) {
    console.error(e);
  }
}
run();
