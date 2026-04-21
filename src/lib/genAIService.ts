import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function resolveTickers(inputTickers: string[]): Promise<string[]> {
  if (inputTickers.length === 0) return [];

  const prompt = `You are a financial data assistant. 
Tickers provided: ${inputTickers.join(', ')}

For each ticker, if it has changed its symbol (like FB to META, TWTR to delisted, or SQUARE to SQ), provide its current active tradable symbol.
If a ticker is completely delisted and doesn't trade under any new ticker (like TWTR), return 'DELISTED'.
If the ticker is still active and valid under the same symbol, keep it exactly as is.
Return a raw JSON object mapping the input string to the resolved string.
Example: {"FB": "META", "AAPL": "AAPL", "TWTR": "DELISTED", "SQUARE": "SQ"}
Do not output markdown block formatting. Only output raw valid JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        temperature: 0,
        responseMimeType: "application/json",
      }
    });

    const text = response.text || "{}";
    const mapping = JSON.parse(text);
    
    // Map back
    return inputTickers.map(t => typeof mapping[t] === 'string' ? mapping[t] : t);
  } catch (err) {
    console.error("Gemini ticket resolution failed:", err);
    return inputTickers;
  }
}
