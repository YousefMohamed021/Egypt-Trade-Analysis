import React, { useState, useMemo } from 'react';
import { 
  ComposedChart, Line, BarChart, Bar, AreaChart, Area, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  ReferenceLine, Cell, Treemap
} from 'recharts';
import { 
  Globe, Layers, Filter, MapPin, Package, Activity, 
  BarChart3, Table as TableIcon, Search, LineChart as LineChartIcon,
  AlertTriangle
} from 'lucide-react';

import tradeDataRawInput from './uncomtrade_data.json';
import wbDataRawInput from './worldbank_data.json';

const COLORS = {
  export: '#10b981',    
  import: '#ef4444',    
  primary: '#6366f1',   
  secondary: '#f59e0b', 
  dark: '#1e293b',      
  grid: '#e2e8f0',      
  chart: ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#14b8a6', '#f97316']
};

const safeParseFloat = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleanStr = String(val).replace(/,/g, '').trim();
  const num = parseFloat(cleanStr);
  return isNaN(num) ? 0 : num;
};

const getRegionFromCountry = (country) => {
  if (!country) return "International";
  const map = {
    "Turkey": "MENA", "Saudi Arabia": "MENA", "United Arab Emirates": "MENA", "Libya": "MENA", "Jordan": "MENA", "Egypt": "MENA",
    "Italy": "Europe", "Germany": "Europe", "Spain": "Europe", "United Kingdom": "Europe", "France": "Europe", "Russia": "Europe", "Ukraine": "Europe",
    "USA": "Americas", "Canada": "Americas", "Brazil": "Americas",
    "China": "Asia", "India": "Asia", "South Korea": "Asia", "Japan": "Asia"
  };
  return map[country] || "International"; 
};

const formatCurrency = (value) => {
  if (!value && value !== 0) return '$0';
  if (value < 0) return `-$${Math.abs(value / 1e9).toFixed(2)}B`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
};

const formatWeight = (value) => {
  if (!value) return '0kg';
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}M T`;
  return `${(value / 1e6).toFixed(0)}k T`;
};

const truncateText = (text, maxLength = 15) => {
  if (!text) return '';
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
};

const calculateLinearRegression = (data, key) => {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: data.length > 0 ? data[0][key] : 0 };
  
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  data.forEach(point => {
    sumX += point.year;
    sumY += point[key];
    sumXY += point.year * point[key];
    sumXX += point.year * point.year;
  });
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 border border-slate-100 shadow-xl rounded-xl z-50">
        <p className="text-sm font-semibold text-slate-700 mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-xs text-slate-600 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.payload.fill || entry.stroke }} />
            <span className="capitalize">{entry.name}:</span>
            <span className="font-mono font-bold">
              {entry.name.includes('Weight') ? formatWeight(entry.value) : 
               entry.name.includes('%') ? `${Number(entry.value).toFixed(2)}%` : formatCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const TreemapContent = ({ x, y, width, height, index, name, size }) => {
  if (width < 50 || height < 30) return <rect x={x} y={y} width={width} height={height} fill={COLORS.chart[index % COLORS.chart.length]} stroke="#fff" />;
  
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={COLORS.chart[index % COLORS.chart.length]} stroke="#fff" strokeWidth={2} rx={4} />
      <text x={x + width / 2} y={y + height / 2 - 8} textAnchor="middle" fill="#fff" fontSize={16} fontWeight="normal" style={{ pointerEvents: 'none' }}>
        {truncateText(name, 10)}
      </text>
      <text x={x + width / 2} y={y + height / 2 + 12} textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize={14} style={{ pointerEvents: 'none' }}>
        {formatCurrency(size)}
      </text>
    </g>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedYear, setSelectedYear] = useState(null); 
  const [searchTerm, setSearchTerm] = useState('');

  const tradeData = useMemo(() => {
    if (!tradeDataRawInput || !Array.isArray(tradeDataRawInput)) return [];
    
    return tradeDataRawInput.map(row => {
      const year = row.Year || row.year_of_trade;
      const flow = row.Flow_Description || row.flow_description || "Unknown";
      const partner = row.Partner_Country || row.partner_country_name || "Unknown";
      const commodity = row.Traded_Commodities || row.commodity_description || "Unknown";
      
      return {
        Year: parseInt(year) || 0,
        Flow: flow,
        Partner: partner,
        Region: getRegionFromCountry(partner),
        Commodity: commodity,
        Value: safeParseFloat(row.Trade_Value),
        Weight: safeParseFloat(row.WeightofTradedGoods)
      };
    })
    .filter(d => d.Year > 0)
    .filter(d => !d.Commodity.toLowerCase().includes("all commodities"));
  }, []);

  const wbData = useMemo(() => {
    if (!wbDataRawInput || !Array.isArray(wbDataRawInput)) return [];
    
    const years = {};
    wbDataRawInput.forEach(row => {
      const y = parseInt(row.Year || row.year_of_trade);
      if (!y) return;

      if (!years[y]) years[y] = { Year: y, GDP: 0, Inflation: 0 };
      
      const code = row.Indicator_Code || row.indicator_code;
      const value = safeParseFloat(row.Indicator_Value);
      
      if (code === "NY.GDP.MKTP.KD.ZG" || code === "WB_WDI_NY_GDP_MKTP_KD_ZG") {
        years[y].GDP = value;
      }
      if (code === "FP.CPI.TOTL.ZG" || code === "WB_WDI_FP_CPI_TOTL_ZG") {
        years[y].Inflation = value;
      }
    });
    
    return Object.values(years).sort((a,b) => a.Year - b.Year);
  }, []);

  const availableYears = useMemo(() => {
    const years = [...new Set(tradeData.map(d => d.Year))];
    const sorted = years.sort((a, b) => b - a);
    return sorted;
  }, [tradeData]);

  React.useEffect(() => {
    if (availableYears.length > 0 && !selectedYear) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  const currentYearData = useMemo(() => {
    if (!selectedYear) return [];
    return tradeData.filter(row => row.Year === parseInt(selectedYear));
  }, [selectedYear, tradeData]);

  const overviewStats = useMemo(() => {
    let exports = 0, imports = 0;
    currentYearData.forEach(row => {
      if (row.Flow.includes('Export')) exports += row.Value;
      if (row.Flow.includes('Import')) imports += row.Value;
    });
    
    const partnerTotals = {};
    currentYearData.forEach(row => {
      if (!partnerTotals[row.Partner]) partnerTotals[row.Partner] = 0;
      partnerTotals[row.Partner] += row.Value;
    });
    const top3Sum = Object.values(partnerTotals).sort((a,b)=>b-a).slice(0,3).reduce((a,b)=>a+b, 0);
    const totalVol = exports + imports;
    const concentrationRisk = totalVol > 0 ? (top3Sum / totalVol) * 100 : 0;

    const historyMap = {};
    tradeData.forEach(row => {
      if (!historyMap[row.Year]) historyMap[row.Year] = { year: row.Year, exports: 0, imports: 0 };
      if (row.Flow.includes('Export')) historyMap[row.Year].exports += row.Value;
      if (row.Flow.includes('Import')) historyMap[row.Year].imports += row.Value;
    });
    const history = Object.values(historyMap).sort((a,b) => a.year - b.year);

    return { 
      waterfall: [
        { name: 'Exports', value: exports, fill: COLORS.export },
        { name: 'Imports', value: -imports, fill: COLORS.import },
        { name: 'Net', value: exports - imports, fill: (exports - imports) > 0 ? COLORS.export : COLORS.import }
      ],
      history, exports, imports, net: exports - imports, concentrationRisk
    };
  }, [currentYearData, tradeData]);

  const forecastData = useMemo(() => {
    const history = overviewStats.history;
    if (history.length === 0) return [];
    
    const expReg = calculateLinearRegression(history, 'exports');
    const impReg = calculateLinearRegression(history, 'imports');

    const lastYear = history[history.length - 1].year;
    const futureYears = [lastYear + 1, lastYear + 2];
    
    const projections = futureYears.map(year => ({
      year,
      exports: expReg.slope * year + expReg.intercept,
      imports: impReg.slope * year + impReg.intercept,
      isForecast: true
    }));
    return [...history, ...projections];
  }, [overviewStats.history]);

  const filteredGridData = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return currentYearData.filter(row => 
      (row.Partner && row.Partner.toLowerCase().includes(term)) ||
      (row.Commodity && row.Commodity.toLowerCase().includes(term))
    ).slice(0, 100); 
  }, [currentYearData, searchTerm]);

  const commodityStats = useMemo(() => {
    const groups = {};
    currentYearData.forEach(row => {
      const rawName = row.Commodity;
      const name = rawName.split(';')[0].replace(/^\d+\s*-\s*/, '');
      
      if (!groups[name]) groups[name] = { name, value: 0, weight: 0 };
      groups[name].value += row.Value;
      groups[name].weight += row.Weight || 0;
    });
    const sorted = Object.values(groups).sort((a, b) => b.value - a.value);
    
    return { top10: sorted.slice(0, 10), all: sorted.slice(0, 30).map(item => ({ ...item, size: item.value })) };
  }, [currentYearData]);

  const geoStats = useMemo(() => {
    const partners = {};
    const regions = {};
    currentYearData.forEach(row => {
      if (!partners[row.Partner]) partners[row.Partner] = { name: row.Partner, exports: 0, imports: 0 };
      if (!regions[row.Region]) regions[row.Region] = { name: row.Region, exports: 0, imports: 0 };
      
      if (row.Flow.includes('Export')) { partners[row.Partner].exports += row.Value; regions[row.Region].exports += row.Value; }
      if (row.Flow.includes('Import')) { partners[row.Partner].imports += row.Value; regions[row.Region].imports += row.Value; }
    });
    return {
      partners: Object.values(partners).sort((a,b) => (b.exports+b.imports) - (a.exports+a.imports)).slice(0, 10),
      regions: Object.values(regions).sort((a,b) => (b.exports+b.imports) - (a.exports+a.imports))
    };
  }, [currentYearData]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-white md:min-h-screen border-r border-slate-200 p-6 flex flex-col shrink-0">
        <div className="flex items-center gap-3 mb-10">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Globe className="text-white" size={24} />
          </div>
          <div>
            <h1 className="font-bold text-slate-800 text-lg leading-tight">Egypt Trade Analytics</h1>
            <p className="text-xs text-slate-500">Dashboard</p>
          </div>
        </div>
        <nav className="space-y-1">
          {[
            { id: 'overview', label: 'Overview', icon: Layers },
            { id: 'forecast', label: 'Forecast', icon: LineChartIcon },
            { id: 'commodities', label: 'Commodities', icon: Package },
            { id: 'partners', label: 'Partners', icon: BarChart3 },
            { id: 'regions', label: 'Regions', icon: MapPin },
            { id: 'economics', label: 'Economics', icon: Activity },
            { id: 'data', label: 'Data Grid', icon: TableIcon },
          ].map((item) => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === item.id ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 capitalize">{activeTab} Dashboard</h2>
            <p className="text-slate-500">{activeTab === 'forecast' ? 'Projected Performance' : activeTab === 'economics' ? 'Macro Context' : `Year ${selectedYear || '...'}`}</p>
          </div>
          {activeTab !== 'economics' && activeTab !== 'forecast' && (
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
              <Filter size={16} className="text-slate-400" />
              <select value={selectedYear || ''} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="bg-transparent text-sm font-bold text-slate-800 outline-none cursor-pointer">
                {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
              </select>
            </div>
          )}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
               <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm"><p className="text-slate-500 text-xs font-bold uppercase mb-2">Total Exports</p><h3 className="text-2xl font-bold text-emerald-600">{formatCurrency(overviewStats.exports)}</h3></div>
               <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm"><p className="text-slate-500 text-xs font-bold uppercase mb-2">Total Imports</p><h3 className="text-2xl font-bold text-red-500">{formatCurrency(overviewStats.imports)}</h3></div>
               <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm"><p className="text-slate-500 text-xs font-bold uppercase mb-2">Net Balance</p><h3 className={`text-2xl font-bold ${overviewStats.net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(overviewStats.net)}</h3></div>
               <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm"><div className="flex items-center justify-between"><p className="text-slate-500 text-xs font-bold uppercase mb-2">Concentration Risk</p><AlertTriangle size={16} className={overviewStats.concentrationRisk > 50 ? 'text-red-500' : 'text-amber-500'} /></div><h3 className="text-2xl font-bold text-slate-800">{overviewStats.concentrationRisk.toFixed(1)}%</h3><p className="text-xs text-slate-400">Share of Top 3 Partners</p></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm"><h3 className="font-bold text-slate-800 mb-6">Financial Position (Waterfall)</h3><div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%"><BarChart data={overviewStats.waterfall} margin={{ top: 10, right: 30, left: 40, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.grid} /><XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} /><YAxis stroke="#94a3b8" tickFormatter={formatCurrency} axisLine={false} tickLine={false} /><Tooltip cursor={{fill: '#f8fafc'}} content={({active, payload}) => { if (active && payload && payload.length) { return (<div className="bg-white p-3 shadow-lg rounded border border-slate-100"><p className="font-bold">{payload[0].payload.name}</p><p className="font-mono">{formatCurrency(payload[0].value)}</p></div>) } return null; }}/><ReferenceLine y={0} stroke="#cbd5e1" /><Bar dataKey="value" radius={[4, 4, 4, 4]}>{overviewStats.waterfall.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}</Bar></BarChart></ResponsiveContainer>
              </div></div>
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm"><h3 className="font-bold text-slate-800 mb-6">Historical Trend</h3><div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%"><AreaChart data={overviewStats.history} margin={{ top: 10, right: 30, left: 40, bottom: 0 }}><defs><linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.export} stopOpacity={0.1}/><stop offset="95%" stopColor={COLORS.export} stopOpacity={0}/></linearGradient><linearGradient id="colorImp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.import} stopOpacity={0.1}/><stop offset="95%" stopColor={COLORS.import} stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.grid} /><XAxis dataKey="year" stroke="#94a3b8" axisLine={false} tickLine={false} /><YAxis stroke="#94a3b8" axisLine={false} tickLine={false} tickFormatter={(val) => formatCurrency(val)}/><Tooltip content={<CustomTooltip />} /><Legend /><Area type="monotone" dataKey="exports" name="Exports" stroke={COLORS.export} fill="url(#colorExp)" strokeWidth={3}/><Area type="monotone" dataKey="imports" name="Imports" stroke={COLORS.import} fill="url(#colorImp)" strokeWidth={3}/></AreaChart></ResponsiveContainer>
              </div></div>
            </div>
          </div>
        )}

        {activeTab === 'forecast' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-2">Future Outlook (Next 2 Years)</h3>
              <div className="h-[400px]"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={forecastData} margin={{ top: 10, right: 30, left: 40, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.grid} /><XAxis dataKey="year" stroke="#94a3b8" /><YAxis stroke="#94a3b8" tickFormatter={formatCurrency} /><Tooltip content={<CustomTooltip />} /><Legend /><Line type="monotone" dataKey="exports" name="Exports (Proj)" stroke={COLORS.export} strokeWidth={3} strokeDasharray="5 5" dot={{r:5}} /><Line type="monotone" dataKey="imports" name="Imports (Proj)" stroke={COLORS.import} strokeWidth={3} strokeDasharray="5 5" dot={{r:5}} /></ComposedChart></ResponsiveContainer></div>
            </div>
          </div>
        )}

        {activeTab === 'data' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-slate-800">Raw Data Explorer</h3><div className="relative"><Search className="absolute left-3 top-2.5 text-slate-400" size={16} /><input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"/></div></div>
              <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500 font-medium"><tr><th className="p-4">Year</th><th className="p-4">Flow</th><th className="p-4">Partner</th><th className="p-4">Commodity</th><th className="p-4 text-right">Value</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredGridData.map((row, idx) => (<tr key={idx} className="hover:bg-slate-50 transition-colors"><td className="p-4 font-mono text-slate-600">{row.Year}</td><td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold ${row.Flow.includes('Export') ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{row.Flow}</span></td><td className="p-4 font-medium text-slate-800">{row.Partner}</td><td className="p-4 text-slate-600 truncate max-w-[200px]">{row.Commodity}</td><td className="p-4 text-right font-mono text-slate-800">{formatCurrency(row.Value)}</td></tr>))}</tbody></table></div>
            </div>
          </div>
        )}

        {activeTab === 'commodities' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm"><h3 className="font-bold text-slate-800 mb-2">Market Map</h3><div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><Treemap data={commodityStats.all} dataKey="size" aspectRatio={4 / 3} stroke="#fff" fill="#8884d8" content={<TreemapContent />}><Tooltip content={<CustomTooltip />} /></Treemap></ResponsiveContainer></div></div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm"><h3 className="font-bold text-slate-800 mb-6">Top 10 Commodities</h3><div className="h-[400px]"><ResponsiveContainer width="100%" height="100%"><BarChart layout="vertical" data={commodityStats.top10} margin={{ left: 10 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={COLORS.grid} /><XAxis type="number" hide /><YAxis dataKey="name" type="category" width={130} stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v)=>truncateText(v,18)} /><Tooltip content={<CustomTooltip />} /><Bar dataKey="value" name="Value" fill={COLORS.primary} radius={[0, 4, 4, 0]} barSize={20} /></BarChart></ResponsiveContainer></div></div>
          </div>
        )}

        {activeTab === 'partners' && (
           <div className="space-y-6 animate-in fade-in duration-500">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                 <h3 className="font-bold text-slate-800 mb-6">Top Trading Partners</h3>
                 <div className="h-[500px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={geoStats.partners} margin={{ top: 20, right: 30, left: 50, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.grid} /><XAxis dataKey="name" stroke="#94a3b8" axisLine={false} tickLine={false} fontSize={12} tickFormatter={(val) => truncateText(val, 12)} /><YAxis stroke="#94a3b8" axisLine={false} tickLine={false} tickFormatter={(val) => formatCurrency(val)}/><Tooltip content={<CustomTooltip />} cursor={{fill: '#f8fafc'}} /><Legend /><Bar dataKey="exports" name="Exports" stackId="a" fill={COLORS.export} radius={[0, 0, 4, 4]} barSize={40} /><Bar dataKey="imports" name="Imports" stackId="a" fill={COLORS.import} radius={[4, 4, 0, 0]} barSize={40} /></BarChart></ResponsiveContainer></div>
              </div>
           </div>
         )}

         {activeTab === 'regions' && (
           <div className="space-y-6 animate-in fade-in duration-500">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm"><h3 className="font-bold text-slate-800 mb-6">Regional Dependency</h3><div className="h-[450px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={geoStats.regions} layout="vertical" margin={{ left: 20 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={COLORS.grid} /><XAxis type="number" stroke="#94a3b8" tickFormatter={formatCurrency} /><YAxis dataKey="name" type="category" stroke="#64748b" width={100} /><Tooltip content={<CustomTooltip />} /><Legend /><Bar dataKey="exports" name="Exports" stackId="a" fill={COLORS.export} radius={[0, 4, 4, 0]} barSize={30} /><Bar dataKey="imports" name="Imports" stackId="a" fill={COLORS.import} radius={[0, 4, 4, 0]} barSize={30} /></BarChart></ResponsiveContainer></div></div>
           </div>
          )}

        {activeTab === 'economics' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm"><h3 className="font-bold text-slate-800 mb-2">Macro-Economic Context</h3><div className="h-[450px]"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={wbData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.grid} /><XAxis dataKey="Year" stroke="#94a3b8" /><YAxis yAxisId="left" stroke="#94a3b8" label={{ value: 'GDP %', angle: -90, position: 'insideLeft' }} /><YAxis yAxisId="right" orientation="right" stroke="#ef4444" label={{ value: 'Inflation %', angle: 90, position: 'insideRight' }} /><Tooltip content={<CustomTooltip />} /><Legend /><Bar yAxisId="left" dataKey="GDP" name="GDP Growth %" fill={COLORS.secondary} barSize={50} radius={[4, 4, 0, 0]} /><Line yAxisId="right" type="monotone" dataKey="Inflation" name="Inflation %" stroke="#ef4444" strokeWidth={3} dot={{r:5}} /></ComposedChart></ResponsiveContainer></div></div>
          </div>
        )}
      </main>
    </div>
  );
}