import { useState, useMemo, useEffect, useRef } from 'react';
import { format, subMonths, subYears, startOfYear } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { X, AlertCircle, BarChart3, Activity, Command, Layers } from 'lucide-react';
import { resolveTickers } from './lib/genAIService';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
type TimeframePreset = '1M' | '3M' | '6M' | 'YTD' | '1Y' | '5Y' | '10Y';

interface PointData {
  date: string;
  [key: string]: number | string;
}

export default function App() {
  const [tickers, setTickers] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [chartData, setChartData] = useState<PointData[]>([]);
  const [tickerMeta, setTickerMeta] = useState<Record<string, { resolved: string; color: string; dropped: boolean }>>({});
  
  const initialized = useRef(false);

  // Initialize from URL on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    
    const params = new URLSearchParams(window.location.search);
    const urlTickers = params.get('tickers')?.split(',').filter(Boolean) || ['AAPL', 'MSFT'];
    const urlStart = params.get('start') || format(subMonths(new Date(), 1), 'yyyy-MM-dd');
    const urlEnd = params.get('end') || format(new Date(), 'yyyy-MM-dd');
    
    setTickers(urlTickers.slice(0, 5));
    setStartDate(urlStart);
    setEndDate(urlEnd);
    
    // Auto-fetch on mount if we have valid params
    if (urlTickers.length > 0 && urlStart && urlEnd) {
      setTimeout(() => triggerAnalysis(urlTickers.slice(0, 5), urlStart, urlEnd), 0);
    }
  }, []);

  // Sync to URL
  useEffect(() => {
    if (!initialized.current || !startDate || !endDate) return;
    const params = new URLSearchParams();
    if (tickers.length > 0) params.set('tickers', tickers.join(','));
    params.set('start', startDate);
    params.set('end', endDate);
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  }, [tickers, startDate, endDate]);

  const triggerAnalysis = async (currentTickers: string[], start: string, end: string, candidateTicker?: string) => {
    if (currentTickers.length === 0 && !candidateTicker) {
       setChartData([]);
       setTickerMeta({});
       return;
    }

    if (!start || !end) {
      setError('Please provide both start and end dates.');
      return;
    }

    if (new Date(start) > new Date(end)) {
      setError('Start date must be before end date.');
      return;
    }

    setLoading(true);
    setError(null);
    setWarnings([]);

    // If we're testing a new ticker, create a unified fetch list
    const fetchList = [...currentTickers];
    if (candidateTicker && !fetchList.includes(candidateTicker)) {
      fetchList.push(candidateTicker);
    }

    try {
      const resolvedList = await resolveTickers(fetchList);
      
      const response = await fetch('/api/stock-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: resolvedList, start, end })
      });
      
      if (!response.ok) throw new Error('Failed to fetch stock data (Server Error)');
      
      const data: Record<string, any> = await response.json();
      const merged: Record<string, PointData> = {};
      const newMeta: Record<string, { resolved: string; color: string; dropped: boolean }> = {};
      
      const failedTickers: string[] = [];
      let finalAcceptedTickers: string[] = [];
      const newWarnings: string[] = [];

      const rawSeries: Record<string, any[]> = {};

      resolvedList.forEach((res, index) => {
        const orig = fetchList[index];
        const series = data[res];
        
        if (!series || res === 'DELISTED' || !Array.isArray(series) || series.length === 0) {
          failedTickers.push(orig);
          if (series?.error) console.error(`Error for ${orig}: ${series.error}`);
          return;
        }

        finalAcceptedTickers.push(orig);

        series.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        rawSeries[orig] = series;
      });

      // Handle ticker cycling limit
      if (finalAcceptedTickers.length > 5) {
        finalAcceptedTickers = finalAcceptedTickers.slice(-5); // keep last 5
      }

      // Find the common start date
      let commonStartMs = -1;
      let limitingTicker = '';
      finalAcceptedTickers.forEach(t => {
        const seriesStartTime = new Date(rawSeries[t][0].date).getTime();
        if (seriesStartTime > commonStartMs) {
          commonStartMs = seriesStartTime;
          limitingTicker = t;
        }
      });

      const requestedStartMs = new Date(start).getTime();
      let appliedStartMs = requestedStartMs;

      // Check if the limiting ticker's start date is significantly after requested (e.g., > 5 days)
      if (commonStartMs > requestedStartMs + 5 * 24 * 60 * 60 * 1000) {
         appliedStartMs = commonStartMs;
         const newStartStr = format(new Date(commonStartMs), 'yyyy-MM-dd');
         setStartDate(newStartStr);
         newWarnings.push(`Adjusted Start Date to ${newStartStr} (earliest available overlap due to ${limitingTicker})`);
      }

      finalAcceptedTickers.forEach(orig => {
        const series = rawSeries[orig];
        
        // Find valid points from the applied start date
        const validPoints = series.filter((p: any) => new Date(p.date).getTime() >= appliedStartMs - 12 * 60 * 60 * 1000); 
        
        if (validPoints.length === 0) return; // Should not happen given commonStartMs logic
        
        const baseline = validPoints[0].adjClose;

        validPoints.forEach((point: any) => {
          const d = point.date.split('T')[0];
          if (!merged[d]) merged[d] = { date: d };
          const price = point.adjClose;
          merged[d][`${orig}_pct`] = ((price - baseline) / baseline) * 100;
          merged[d][`${orig}_price`] = price;
        });
      });

      setWarnings(newWarnings);

      // Assign colors to accepted
      finalAcceptedTickers.forEach((t, i) => {
         newMeta[t] = { resolved: resolvedList[fetchList.indexOf(t)], color: COLORS[i % COLORS.length], dropped: false };
      });

      setTickerMeta(newMeta);
      setTickers(finalAcceptedTickers);

      if (failedTickers.length > 0) {
        setError(`Data unavailable for: ${failedTickers.join(', ')}`);
      }

      if (Object.keys(merged).length === 0 || finalAcceptedTickers.length === 0) {
        if (failedTickers.length === 0) setError("Could not retrieve data for the requested dates or tickers.");
        setChartData([]);
        return;
      }
      
      let finalChartData = Object.values(merged).sort((a, b) => {
        return new Date(a.date as string).getTime() - new Date(b.date as string).getTime();
      });

      let lastKnownVals: Record<string, { pct: number, price: number }> = {};
      finalChartData = finalChartData.map(point => {
        const newPoint = { ...point };
        finalAcceptedTickers.forEach(orig => {
          if (!newMeta[orig]?.dropped) {
            if (point[`${orig}_pct`] !== undefined) {
              lastKnownVals[orig] = {
                pct: point[`${orig}_pct`] as number,
                price: point[`${orig}_price`] as number
              };
            } else if (lastKnownVals[orig]) {
              newPoint[`${orig}_pct`] = lastKnownVals[orig].pct;
              newPoint[`${orig}_price`] = lastKnownVals[orig].price;
            }
          }
        });
        return newPoint;
      });
      
      setChartData(finalChartData);
    } catch (err: any) {
      setError(err.message || 'An error occurred fetching data.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTicker = () => {
    if (!currentInput.trim()) return;
    const t = currentInput.trim().toUpperCase();
    setCurrentInput('');
    if (tickers.includes(t)) return;
    triggerAnalysis(tickers, startDate, endDate, t);
  };
  
  const handleRemoveTicker = (t: string) => {
    const newTickers = tickers.filter(ticker => ticker !== t);
    // Don't auto-fetch if we remove, just locally filter the chart?
    // Let's just trigger a full sync to be safe and clean
    triggerAnalysis(newTickers, startDate, endDate);
  };
  
  const applyPreset = (tf: TimeframePreset) => {
    const end = new Date();
    let start = new Date();
    switch (tf) {
      case '1M': start = subMonths(end, 1); break;
      case '3M': start = subMonths(end, 3); break;
      case '6M': start = subMonths(end, 6); break;
      case 'YTD': start = startOfYear(end); break;
      case '1Y': start = subYears(end, 1); break;
      case '5Y': start = subYears(end, 5); break;
      case '10Y': start = subYears(end, 10); break;
    }
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');
    setStartDate(startStr);
    setEndDate(endStr);
    triggerAnalysis(tickers, startStr, endStr);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700/60 shadow-2xl rounded-lg p-4 min-w-[220px] backdrop-blur-md">
          <p className="font-mono text-xs text-slate-400 mb-3 border-b border-slate-700/50 pb-2">{label}</p>
          <div className="space-y-3">
            {payload.map((entry: any, index: number) => {
              const orig = entry.dataKey.replace('_pct', '');
              const price = entry.payload[`${orig}_price`];
              const pct = entry.value;
              const meta = tickerMeta[orig];
              if (!meta) return null;
              
              return (
                <div key={index} className="flex flex-col">
                  <div className="flex justify-between items-center mb-0.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]" style={{ backgroundColor: meta.color, boxShadow: `0 0 8px ${meta.color}60` }} />
                      <span className="font-bold text-slate-200 text-sm tracking-tight">{orig}</span>
                    </div>
                    <span className={cn("font-mono text-sm font-medium", pct >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                      {pct > 0 ? '+' : ''}{pct.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between pl-4">
                    {meta.resolved !== orig && meta.resolved !== 'DELISTED' ? (
                       <span className="text-[9px] uppercase tracking-wider text-slate-500">{meta.resolved}</span>
                    ) : (
                       <span />
                    )}
                    <span className="text-xs font-mono text-slate-400">${price?.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  const summaryData = useMemo(() => {
    if (chartData.length === 0) return null;
    const lastPoint = chartData[chartData.length - 1];
    
    return tickers.map(orig => {
      const meta = tickerMeta[orig];
      if (!meta) return null;
      
      const finalPct = lastPoint[`${orig}_pct`] as number | undefined;
      const finalPrice = lastPoint[`${orig}_price`] as number | undefined;
      
      return {
        orig,
        resolved: meta.resolved,
        color: meta.color,
        finalPct: finalPct ?? 0,
        finalPrice: finalPrice ?? 0
      };
    }).filter(Boolean) as any[];
  }, [chartData, tickers, tickerMeta]);

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200 font-sans pb-24 selection:bg-blue-500/30 overflow-x-hidden">
      
      <header className="pt-12 pb-8 px-6 max-w-7xl mx-auto w-full border-b border-white/5 bg-[#0B1120]/80 sticky top-0 z-50 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="bg-blue-500/20 p-1.5 rounded-lg border border-blue-500/30">
                <Activity className="w-5 h-5 text-blue-400" />
              </div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white">
                Growth Compare
              </h1>
            </div>
            <p className="text-slate-400 text-sm">
              Compare stock performance over time.
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 space-y-6">
        
        {/* TOP CONTROLS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          <div className="lg:col-span-4 bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 flex flex-col gap-4">
            <h2 className="text-xs font-mono text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Command className="w-3.5 h-3.5" />
              Assets <span className="ml-auto text-[10px] text-slate-500">{tickers.length}/5</span>
            </h2>
            
            <div className="flex gap-2">
              <input 
                type="text" 
                className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 font-mono text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all uppercase placeholder:normal-case placeholder:text-slate-600"
                placeholder="Ex. AAPL"
                value={currentInput}
                onChange={e => setCurrentInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddTicker()}
              />
              <button 
                className="bg-slate-700 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-600 focus:ring-2 focus:ring-slate-500 outline-none transition-colors"
                onClick={handleAddTicker}
                disabled={!currentInput.trim()}
              >
                Insert
              </button>
            </div>
            
            <div className="flex flex-wrap gap-2 pt-1 h-auto min-h-[30px]">
              <AnimatePresence mode="popLayout">
                {tickers.map((t, idx) => (
                  <motion.div 
                    layout
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    key={t} 
                    className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-700/50 rounded-md pl-2 pr-1 py-1"
                  >
                    <span 
                      className="w-2 h-2 rounded-full" 
                      style={{ 
                        backgroundColor: tickerMeta[t]?.color || COLORS[idx % COLORS.length],
                        boxShadow: `0 0 6px ${tickerMeta[t]?.color || COLORS[idx % COLORS.length]}40`
                      }} 
                    />
                    <span className="font-mono text-xs font-medium text-slate-200">{t}</span>
                    <button 
                      onClick={() => handleRemoveTicker(t)}
                      className="text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded ml-0.5 p-0.5 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          <div className="lg:col-span-8 bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 flex flex-col gap-4">
             <h2 className="text-xs font-mono text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Layers className="w-3.5 h-3.5" />
              Time Window
            </h2>
            
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <div className="flex gap-3 w-full sm:w-auto">
                <div className="space-y-1.5 flex-1 sm:flex-none sm:w-[140px]">
                  <label className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Start</label>
                  <input 
                    type="date" 
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 font-mono text-xs focus:outline-none focus:border-blue-500 transition-colors custom-date-input text-slate-200"
                    value={startDate}
                    onChange={e => {
                      setStartDate(e.target.value);
                      if (e.target.value.length === 10) triggerAnalysis(tickers, e.target.value, endDate);
                    }}
                  />
                </div>
                <div className="space-y-1.5 flex-1 sm:flex-none sm:w-[140px]">
                  <label className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">End</label>
                  <input 
                    type="date" 
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 font-mono text-xs focus:outline-none focus:border-blue-500 transition-colors custom-date-input text-slate-200"
                    value={endDate}
                    max={format(new Date(), 'yyyy-MM-dd')}
                    onChange={e => {
                      setEndDate(e.target.value);
                      if (e.target.value.length === 10) triggerAnalysis(tickers, startDate, e.target.value);
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-2 sm:mt-0">
                {(['1M', '3M', '6M', 'YTD', '1Y', '5Y', '10Y'] as TimeframePreset[]).map(tf => {
                  let isPresetActive = false;
                  if (endDate === format(new Date(), 'yyyy-MM-dd')) {
                    const end = new Date();
                    let expectedStart = new Date();
                    switch (tf) {
                      case '1M': expectedStart = subMonths(end, 1); break;
                      case '3M': expectedStart = subMonths(end, 3); break;
                      case '6M': expectedStart = subMonths(end, 6); break;
                      case 'YTD': expectedStart = startOfYear(end); break;
                      case '1Y': expectedStart = subYears(end, 1); break;
                      case '5Y': expectedStart = subYears(end, 5); break;
                      case '10Y': expectedStart = subYears(end, 10); break;
                    }
                    if (startDate === format(expectedStart, 'yyyy-MM-dd')) {
                      isPresetActive = true;
                    }
                  }

                  return (
                    <button
                      key={tf}
                      onClick={() => applyPreset(tf)}
                      className={cn(
                        "py-1.5 px-3 font-mono text-[11px] rounded-md transition-colors border",
                        isPresetActive
                          ? "bg-blue-500/20 text-blue-400 border-blue-500/50 font-bold"
                          : "bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-slate-200 hover:border-slate-500"
                      )}
                    >
                      {tf}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {warnings.length > 0 && !loading && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 py-3 px-4 rounded-xl flex items-start gap-3 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-amber-400 mb-1 leading-none pt-0.5">Timeframe Warnings</span>
                {warnings.map((w, idx) => (
                  <p key={idx} className="text-amber-500/80 leading-tight">• {w}</p>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {error && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 py-3 px-4 rounded-xl flex items-center gap-3 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p>{error}</p>
            </div>
          </motion.div>
        )}

        {/* DATA STAGE */}
        <div className="bg-slate-800/20 border border-slate-700/50 rounded-2xl pt-6 px-2 pb-2 sm:p-6 relative flex flex-col w-full h-[450px]">
          {chartData.length > 0 && !loading && (
            <div className="absolute top-4 left-6 flex items-center gap-3 mb-2 z-10 w-full">
              <span className="text-slate-200 font-medium tracking-tight">Percentage Growth</span>
            </div>
          )}

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="w-8 h-8 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin" />
              <span className="text-xs font-mono text-slate-500 uppercase tracking-widest animate-pulse">Loading data...</span>
            </div>
          ) : chartData.length > 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full h-full mt-8 sm:mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#475569" 
                    tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                    tickMargin={12}
                    minTickGap={20}
                  />
                  <YAxis 
                    stroke="#475569"
                    tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                    tickFormatter={(value) => `${value > 0 ? '+' : ''}${value}%`}
                    width={65}
                    orientation="right"
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#334155', strokeWidth: 1 }} />
                  <ReferenceLine y={0} stroke="#334155" strokeWidth={1} />
                  
                  {tickers.map((orig) => {
                    if (tickerMeta[orig]?.dropped) return null;
                    return (
                      <Line
                        key={orig}
                        type="monotone"
                        dataKey={`${orig}_pct`}
                        stroke={tickerMeta[orig]?.color}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0, fill: tickerMeta[orig]?.color }}
                        connectNulls={true}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </motion.div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 opacity-60">
              <BarChart3 className="w-12 h-12 mb-4 stroke-1" />
              <p className="text-sm">Insert assets to populate visualizer</p>
            </div>
          )}
        </div>

        {/* SUMMARY CARDS */}
        {summaryData && !loading && summaryData.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {summaryData.map((d) => (
              <div key={d.orig} className="p-4 rounded-xl border relative overflow-hidden flex flex-col justify-between bg-slate-800/40 border-slate-700/50">
                
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg leading-none" style={{ color: d.color }}>
                      {d.orig}
                    </h3>
                    {d.resolved !== d.orig && d.resolved !== 'DELISTED' && (
                      <p className="text-[9px] uppercase tracking-wider text-slate-500 mt-1.5 flex items-center gap-1 leading-none">
                        <AlertCircle className="w-2.5 h-2.5" /> Exchanged: {d.resolved}
                      </p>
                    )}
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-end gap-2">
                     <div className="flex flex-col">
                      <span className={cn(
                        "text-xl font-medium tracking-tight leading-none", 
                        d.finalPct >= 0 ? "text-slate-100" : "text-slate-300"
                      )}>
                        {d.finalPct > 0 ? '+' : ''}{d.finalPct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-mono text-slate-400 leading-none">${d.finalPrice.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}

      </main>
    </div>
  );
}
