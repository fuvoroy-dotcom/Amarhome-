'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, Layers, ShieldCheck, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';

interface StructuralDetailingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  designObjects: any[];
  projectName?: string;
}

export function StructuralDetailingDialog({
  open,
  onOpenChange,
  designObjects,
  projectName = 'AmarHome Project',
}: StructuralDetailingProps) {
  const [activeTab, setActiveTab] = useState('footing');
  const [scale, setScale] = useState(1);

  // Auto-inherit real canvas elements
  const canvasPillars = designObjects.filter((o) => o.subType === 'pillar');
  const canvasStair = designObjects.find((o) => o.type === 'stair');
  const canvasAreas = designObjects.filter((o) => o.subType === 'area-marker');

  const defaultColW = canvasPillars.length > 0 ? Math.round(canvasPillars[0].w * 12) : 12;
  const defaultColH = canvasPillars.length > 0 ? Math.round(canvasPillars[0].h * 12) : 12;

  // Config parameters
  const [footingSize, setFootingSize] = useState(defaultColW >= 12 ? 5.5 : 4.5); // ft
  const [footingThick, setFootingThick] = useState(15); // inch
  const [columnW, setColumnW] = useState(defaultColW); // inch
  const [columnH, setColumnH] = useState(defaultColH); // inch
  const [beamSpan, setBeamSpan] = useState(15); // ft
  const [beamDepth, setBeamDepth] = useState(Math.max(12, Math.round(defaultColW * 1.25))); // inch
  const [beamWidth, setBeamWidth] = useState(Math.min(10, defaultColW)); // inch
  const [slabThick, setSlabThick] = useState(5); // inch
  const [stairFlight, setStairFlight] = useState(canvasStair?.stepCount || 10); // steps
  const [septicCapacity, setSepticCapacity] = useState(Math.max(8, canvasAreas.length * 4)); // users
  const [liftCapacity, setLiftCapacity] = useState(6); // persons

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[92vh] p-0 flex flex-col bg-slate-900 text-slate-100 border-slate-800 shadow-2xl rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base md:text-lg font-black text-white flex items-center gap-2">
                Structural Engineering & Rebar Detailing CAD
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                  BNBC 2020 Compliant
                </span>
              </DialogTitle>
              <p className="text-xs text-slate-400">
                {projectName} • 2D রড বাইন্ডিং, সেকশন ও রিইনফোর্সমেন্ট ডিটেইলস
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScale((s) => Math.max(0.6, s - 0.1))}
              className="h-8 w-8 p-0 bg-slate-900 border-slate-700 text-slate-300 hover:text-white"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-xs font-mono text-slate-400 min-w-10 text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScale((s) => Math.min(1.8, s + 0.1))}
              className="h-8 w-8 p-0 bg-slate-900 border-slate-700 text-slate-300 hover:text-white"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => window.print()}
              className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white gap-1.5 ml-2"
            >
              <Download className="w-3.5 h-3.5" /> Export CAD / Print
            </Button>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="bg-slate-950/80 px-6 pt-2 border-b border-slate-800">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-slate-900/90 p-1 border border-slate-800 h-auto flex flex-wrap gap-1">
              <TabsTrigger value="footing" className="text-xs font-bold py-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                ১. ফুটিং / বেস
              </TabsTrigger>
              <TabsTrigger value="column" className="text-xs font-bold py-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                ২. কলাম সেকশন
              </TabsTrigger>
              <TabsTrigger value="beam" className="text-xs font-bold py-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                ৩. বিম ডিটেইলিং
              </TabsTrigger>
              <TabsTrigger value="slab" className="text-xs font-bold py-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                ৪. ছাদ (Slab) রড
              </TabsTrigger>
              <TabsTrigger value="stair" className="text-xs font-bold py-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                ৫. সিঁড়ি সেকশন
              </TabsTrigger>
              <TabsTrigger value="septic" className="text-xs font-bold py-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                ৬. সেপ্টিক ট্যাংক
              </TabsTrigger>
              <TabsTrigger value="lift" className="text-xs font-bold py-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                ৭. লিফট কোর / শিয়ার ওয়াল
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* CAD Viewer Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Config Panel */}
          <div className="w-64 border-r border-slate-800 bg-slate-950 p-4 overflow-y-auto space-y-4 shrink-0 text-xs">
            <div className="font-bold text-slate-300 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-800 flex items-center justify-between">
              <span>প্যারামিটার কন্ট্রোল</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>

            {activeTab === 'footing' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-slate-400">ফুটিং সাইজ (দৈর্ঘ্য/প্রস্থ ft)</Label>
                  <Input
                    type="number"
                    value={footingSize}
                    onChange={(e) => setFootingSize(parseFloat(e.target.value) || 4)}
                    className="h-8 bg-slate-900 border-slate-700 text-white font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-400">পুরুত্ব / ডেপথ (ইঞ্চি)</Label>
                  <Input
                    type="number"
                    value={footingThick}
                    onChange={(e) => setFootingThick(parseFloat(e.target.value) || 12)}
                    className="h-8 bg-slate-900 border-slate-700 text-white font-mono"
                  />
                </div>
                <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 space-y-1 text-slate-400 text-[11px]">
                  <p className="font-semibold text-slate-200">স্পেসিফিকেশন:</p>
                  <p>• সলিং: ৩" সিসি ও বালি ফিলিং</p>
                  <p>• ম্যাট রিইনফোর্সমেন্ট: 12mm @ 5" c/c B/W</p>
                  <p>• ক্লিয়ার কভার: ৩ ইঞ্চি</p>
                </div>
              </>
            )}

            {activeTab === 'column' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-slate-400">কলাম প্রস্থ (ইঞ্চি)</Label>
                  <Input
                    type="number"
                    value={columnW}
                    onChange={(e) => setColumnW(parseFloat(e.target.value) || 10)}
                    className="h-8 bg-slate-900 border-slate-700 text-white font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-400">কলাম দৈর্ঘ্য (ইঞ্চি)</Label>
                  <Input
                    type="number"
                    value={columnH}
                    onChange={(e) => setColumnH(parseFloat(e.target.value) || 12)}
                    className="h-8 bg-slate-900 border-slate-700 text-white font-mono"
                  />
                </div>
                <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 space-y-1 text-slate-400 text-[11px]">
                  <p className="font-semibold text-slate-200">টাই রিং নিয়ম (BNBC):</p>
                  <p>• ১৩৫° সিসমিক হুক (৩" লেগ)</p>
                  <p>• সাপোর্টে স্পেসিং: 4" c/c (L/4 জোন)</p>
                  <p>• মিডস্প্যানে স্পেসিং: 7" c/c</p>
                </div>
              </>
            )}

            {activeTab === 'beam' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-slate-400">বিম ক্লিয়ার স্প্যান (ft)</Label>
                  <Input
                    type="number"
                    value={beamSpan}
                    onChange={(e) => setBeamSpan(parseFloat(e.target.value) || 12)}
                    className="h-8 bg-slate-900 border-slate-700 text-white font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-400">বিম ডেপথ (ইঞ্চি)</Label>
                  <Input
                    type="number"
                    value={beamDepth}
                    onChange={(e) => setBeamDepth(parseFloat(e.target.value) || 12)}
                    className="h-8 bg-slate-900 border-slate-700 text-white font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-400">বিম প্রস্থ (ইঞ্চি)</Label>
                  <Input
                    type="number"
                    value={beamWidth}
                    onChange={(e) => setBeamWidth(parseFloat(e.target.value) || 10)}
                    className="h-8 bg-slate-900 border-slate-700 text-white font-mono"
                  />
                </div>
              </>
            )}

            {activeTab === 'slab' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-slate-400">ছাদের পুরুত্ব (ইঞ্চি)</Label>
                  <Input
                    type="number"
                    value={slabThick}
                    onChange={(e) => setSlabThick(parseFloat(e.target.value) || 5)}
                    className="h-8 bg-slate-900 border-slate-700 text-white font-mono"
                  />
                </div>
                <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 space-y-1 text-slate-400 text-[11px]">
                  <p className="font-semibold text-slate-200">ক্র্যাঙ্ক বার নিয়ম:</p>
                  <p>• অল্টারনেট ক্র্যাঙ্ক: L/7 থেকে ৪৫° ভাঁজ</p>
                  <p>• টপ এক্সট্রা বার: L/4 জোন পর্যন্ত</p>
                  <p>• ক্লিয়ার কভার: ৩/৪ ইঞ্চি (0.75")</p>
                </div>
              </>
            )}

            {activeTab === 'stair' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-slate-400">ধাপের সংখ্যা (Steps)</Label>
                  <Input
                    type="number"
                    value={stairFlight}
                    onChange={(e) => setStairFlight(parseInt(e.target.value) || 10)}
                    className="h-8 bg-slate-900 border-slate-700 text-white font-mono"
                  />
                </div>
                <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 space-y-1 text-slate-400 text-[11px]">
                  <p className="font-semibold text-slate-200">সিঁড়ির স্ট্যান্ডার্ড মাপ:</p>
                  <p>• রাইজার (Riser): ৬ ইঞ্চি</p>
                  <p>• ট্রেড (Tread): ১০ ইঞ্চি</p>
                  <p>• ওয়েস্ট স্ল্যাব: ৫ ইঞ্চি</p>
                </div>
              </>
            )}

            {activeTab === 'septic' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-slate-400">ব্যবহারকারী সংখ্যা (জন)</Label>
                  <Input
                    type="number"
                    value={septicCapacity}
                    onChange={(e) => setSepticCapacity(parseInt(e.target.value) || 10)}
                    className="h-8 bg-slate-900 border-slate-700 text-white font-mono"
                  />
                </div>
                <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 space-y-1 text-slate-400 text-[11px]">
                  <p className="font-semibold text-slate-200">ট্যাংক ডাইমেনশন:</p>
                  <p>• দৈর্ঘ্য: {(septicCapacity * 0.8 + 3).toFixed(1)} ft</p>
                  <p>• প্রস্থ: {(septicCapacity * 0.4 + 2).toFixed(1)} ft</p>
                  <p>• কার্যকর গভীরতা: ৫ ft</p>
                </div>
              </>
            )}

            {activeTab === 'lift' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-slate-400">লিফট ক্যাপাসিটি (জন)</Label>
                  <Select
                    value={liftCapacity.toString()}
                    onValueChange={(v) => setLiftCapacity(parseInt(v))}
                  >
                    <SelectTrigger className="h-8 bg-slate-900 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                      <SelectItem value="4">৪ জন (300 kg)</SelectItem>
                      <SelectItem value="6">৬ জন (450 kg)</SelectItem>
                      <SelectItem value="8">৮ জন (630 kg)</SelectItem>
                      <SelectItem value="10">১০ জন (800 kg)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          {/* Right CAD Canvas View */}
          <div className="flex-1 bg-slate-900/60 p-6 overflow-auto flex items-center justify-center relative">
            {/* Blueprint Grid Background */}
            <div
              className="w-full h-full min-w-[700px] min-h-[500px] flex items-center justify-center relative border border-slate-800 rounded-xl bg-slate-950/90 shadow-inner"
              style={{
                backgroundImage:
                  'radial-gradient(circle, #334155 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
            >
              <div
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.15s ease-out',
                }}
              >
                {/* 1. FOOTING CAD */}
                {activeTab === 'footing' && (
                  <svg width="650" height="420" viewBox="0 0 650 420" className="text-slate-200">
                    <rect x="50" y="240" width="260" height="110" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                    <line x1="50" y1="350" x2="310" y2="350" stroke="#f59e0b" strokeWidth="6" strokeDasharray="3 3" />
                    <text x="180" y="370" fill="#f59e0b" fontSize="11" textAnchor="middle" fontWeight="bold">3" CC SOLING BED</text>
                    
                    {/* Footing Rebar Mesh */}
                    <line x1="60" y1="335" x2="300" y2="335" stroke="#ef4444" strokeWidth="3" />
                    <line x1="60" y1="335" x2="60" y2="310" stroke="#ef4444" strokeWidth="3" />
                    <line x1="300" y1="335" x2="300" y2="310" stroke="#ef4444" strokeWidth="3" />
                    {[80, 110, 140, 170, 200, 230, 260, 285].map((x) => (
                      <circle key={x} cx={x} cy="330" r="3" fill="#38bdf8" />
                    ))}
                    
                    {/* Column from Footing */}
                    <rect x="150" y="100" width="60" height="140" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
                    {/* Dowel Bars */}
                    <line x1="160" y1="80" x2="160" y2="330" stroke="#ef4444" strokeWidth="3" />
                    <line x1="160" y1="330" x2="120" y2="330" stroke="#ef4444" strokeWidth="3" />
                    <line x1="200" y1="80" x2="200" y2="330" stroke="#ef4444" strokeWidth="3" />
                    <line x1="200" y1="330" x2="240" y2="330" stroke="#ef4444" strokeWidth="3" />
                    
                    <text x="180" y="70" fill="#38bdf8" fontSize="12" textAnchor="middle" fontWeight="bold">কলাম ডাওয়েল বার</text>
                    <text x="180" y="210" fill="#94a3b8" fontSize="11" textAnchor="middle">কলাম {columnW}"x{columnH}"</text>
                    
                    {/* Top View of Footing */}
                    <rect x="370" y="130" width="220" height="220" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                    <rect x="450" y="210" width="60" height="60" fill="#0f172a" stroke="#ef4444" strokeWidth="2" />
                    {[150, 180, 210, 240, 270, 300, 330].map((y) => (
                      <line key={y} x1="380" y1={y} x2="580" y2={y} stroke="#ef4444" strokeWidth="1" strokeDasharray="4 2" />
                    ))}
                    {[390, 420, 450, 480, 510, 540, 570].map((x) => (
                      <line key={x} x1={x} y1="140" x2={x} y2="340" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4 2" />
                    ))}
                    <text x="480" y="115" fill="#38bdf8" fontSize="13" textAnchor="middle" fontWeight="bold">টপ ভিউ (ম্যাট রড বাইন্ডিং)</text>
                    <text x="480" y="380" fill="#94a3b8" fontSize="11" textAnchor="middle">বেস সাইজ: {footingSize}' x {footingSize}' (12mm @ 5" c/c B/W)</text>
                  </svg>
                )}

                {/* 2. COLUMN CAD */}
                {activeTab === 'column' && (
                  <svg width="600" height="420" viewBox="0 0 600 420" className="text-slate-200">
                    <rect x="150" y="60" width="300" height="300" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="3" />
                    {/* Tie Rebar Ring with 135 deg seismic hook */}
                    <rect x="180" y="90" width="240" height="240" rx="8" fill="none" stroke="#f59e0b" strokeWidth="3" />
                    <path d="M 180 120 L 195 100 L 220 125" fill="none" stroke="#f59e0b" strokeWidth="3" />
                    
                    {/* Main Rebars (Corner + Side) */}
                    {[
                      {cx: 195, cy: 105}, {cx: 405, cy: 105},
                      {cx: 195, cy: 315}, {cx: 405, cy: 315},
                      {cx: 300, cy: 105}, {cx: 300, cy: 315},
                      {cx: 195, cy: 210}, {cx: 405, cy: 210}
                    ].map((p, i) => (
                      <g key={i}>
                        <circle cx={p.cx} cy={p.cy} r="12" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                        <text x={p.cx} y={p.cy + 4} fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">16</text>
                      </g>
                    ))}
                    
                    <text x="300" y="40" fill="#38bdf8" fontSize="14" textAnchor="middle" fontWeight="bold">
                      কলাম ক্রস-সেকশন ({columnW}" x {columnH}")
                    </text>
                    <text x="300" y="380" fill="#94a3b8" fontSize="11" textAnchor="middle">
                      8 Nos 16mm Main Rebars • 8mm Seismic Ring @ 4"/7" c/c (135° Hook)
                    </text>
                  </svg>
                )}

                {/* 3. BEAM CAD */}
                {activeTab === 'beam' && (
                  <svg width="650" height="400" viewBox="0 0 650 400" className="text-slate-200">
                    <rect x="40" y="100" width="450" height="150" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                    
                    {/* Columns at Ends */}
                    <rect x="20" y="60" width="40" height="230" fill="#0f172a" stroke="#64748b" strokeWidth="2" />
                    <rect x="470" y="60" width="40" height="230" fill="#0f172a" stroke="#64748b" strokeWidth="2" />
                    
                    {/* Top Extra Rebars */}
                    <line x1="50" y1="120" x2="170" y2="120" stroke="#ef4444" strokeWidth="4" />
                    <line x1="360" y1="120" x2="480" y2="120" stroke="#ef4444" strokeWidth="4" />
                    <text x="110" y="112" fill="#ef4444" fontSize="10" fontWeight="bold">Top Extra (L/4)</text>
                    <text x="420" y="112" fill="#ef4444" fontSize="10" fontWeight="bold">Top Extra (L/4)</text>
                    
                    {/* Continuous Top & Bottom Bar */}
                    <line x1="45" y1="130" x2="485" y2="130" stroke="#38bdf8" strokeWidth="3" />
                    <line x1="45" y1="230" x2="485" y2="230" stroke="#ef4444" strokeWidth="4" />
                    <text x="265" y="248" fill="#ef4444" fontSize="10" fontWeight="bold">3 Nos 16mm Bottom Bar</text>
                    
                    {/* Stirrups Lines */}
                    {[65, 90, 115, 145, 185, 230, 275, 320, 365, 395, 420, 445, 470].map((x) => (
                      <line key={x} x1={x} y1="120" x2={x} y2="230" stroke="#f59e0b" strokeWidth="1.5" />
                    ))}
                    
                    <text x="265" y="75" fill="#38bdf8" fontSize="13" textAnchor="middle" fontWeight="bold">
                      বিম লংগিচিউডিনাল ভিউ (স্প্যান {beamSpan} ft, সাইজ {beamWidth}"x{beamDepth}")
                    </text>
                    
                    {/* Cross-section Box */}
                    <rect x="540" y="100" width="80" height="150" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                    <rect x="550" y="110" width="60" height="130" fill="none" stroke="#f59e0b" strokeWidth="2" />
                    <circle cx="557" cy="118" r="4" fill="#38bdf8" />
                    <circle cx="603" cy="118" r="4" fill="#38bdf8" />
                    <circle cx="557" cy="232" r="5" fill="#ef4444" />
                    <circle cx="580" cy="232" r="5" fill="#ef4444" />
                    <circle cx="603" cy="232" r="5" fill="#ef4444" />
                    <text x="580" y="275" fill="#94a3b8" fontSize="10" textAnchor="middle">Cross Sec</text>
                  </svg>
                )}

                {/* 4. SLAB CAD */}
                {activeTab === 'slab' && (
                  <svg width="650" height="400" viewBox="0 0 650 400" className="text-slate-200">
                    <rect x="60" y="120" width="530" height="80" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                    
                    {/* Left/Right Beams */}
                    <rect x="20" y="100" width="60" height="130" fill="#0f172a" stroke="#64748b" strokeWidth="2" />
                    <rect x="570" y="100" width="60" height="130" fill="#0f172a" stroke="#64748b" strokeWidth="2" />
                    
                    {/* Straight Bottom Bar */}
                    <line x1="40" y1="185" x2="610" y2="185" stroke="#ef4444" strokeWidth="3" />
                    
                    {/* Crank Up Rebar */}
                    <path
                      d="M 50 180 L 140 180 L 180 135 L 470 135 L 510 180 L 600 180"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="3"
                    />
                    <text x="325" y="125" fill="#f59e0b" fontSize="11" textAnchor="middle" fontWeight="bold">
                      ক্র্যাঙ্ক রড (Crank Bar 45° Bent-up @ L/7)
                    </text>
                    <text x="325" y="205" fill="#ef4444" fontSize="11" textAnchor="middle" fontWeight="bold">
                      বটম মেইন রড (10mm @ 5" c/c)
                    </text>
                    
                    {/* Binder Dots */}
                    {[100, 150, 200, 250, 300, 350, 400, 450, 500, 550].map((x) => (
                      <circle key={x} cx={x} cy="175" r="4" fill="#38bdf8" />
                    ))}
                    
                    <text x="325" y="70" fill="#38bdf8" fontSize="14" textAnchor="middle" fontWeight="bold">
                      ছাদ রিইনফোর্সমেন্ট সেকশন (Slab Thickness: {slabThick}")
                    </text>
                    <text x="325" y="270" fill="#94a3b8" fontSize="11" textAnchor="middle">
                      One-way / Two-way Slab Detail • Clear Cover: 0.75" (19mm)
                    </text>
                  </svg>
                )}

                {/* 5. STAIR CAD */}
                {activeTab === 'stair' && (
                  <svg width="650" height="420" viewBox="0 0 650 420" className="text-slate-200">
                    {/* Landing Slabs */}
                    <rect x="40" y="290" width="120" height="30" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                    <rect x="490" y="110" width="120" height="30" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                    
                    {/* Steps Profile */}
                    <path
                      d="M 160 290 
                         L 160 260 L 195 260 L 195 230 L 230 230 L 230 200 
                         L 265 200 L 265 170 L 300 170 L 300 140 L 335 140 
                         L 335 110 L 490 110"
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2.5"
                    />
                    {/* Waist Slab Bottom Line */}
                    <path
                      d="M 40 320 L 150 320 L 470 140 L 610 140"
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2.5"
                    />
                    
                    {/* Waist Rebars */}
                    <path
                      d="M 50 310 L 145 310 L 465 130 L 600 130"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="3"
                    />
                    <text x="300" y="260" fill="#ef4444" fontSize="11" fontWeight="bold" transform="rotate(-28 300 260)">
                      মেইন রড: 12mm @ 5" c/c
                    </text>
                    
                    <text x="325" y="50" fill="#38bdf8" fontSize="14" textAnchor="middle" fontWeight="bold">
                      সিঁড়ির আর্কিটেকচারাল ও রিইনফোর্সমেন্ট সেকশন ({stairFlight} Steps)
                    </text>
                    <text x="100" y="340" fill="#94a3b8" fontSize="10">Lower Landing</text>
                    <text x="550" y="160" fill="#94a3b8" fontSize="10">Upper Landing</text>
                  </svg>
                )}

                {/* 6. SEPTIC TANK CAD */}
                {activeTab === 'septic' && (
                  <svg width="650" height="420" viewBox="0 0 650 420" className="text-slate-200">
                    {/* Tank Outer Box */}
                    <rect x="50" y="80" width="550" height="260" fill="#1e293b" stroke="#38bdf8" strokeWidth="3" />
                    
                    {/* Baffle Walls */}
                    <rect x="230" y="140" width="16" height="200" fill="#0f172a" stroke="#64748b" strokeWidth="2" />
                    <rect x="410" y="110" width="16" height="200" fill="#0f172a" stroke="#64748b" strokeWidth="2" />
                    
                    {/* Inlet & Outlet Pipes */}
                    <line x1="20" y1="120" x2="80" y2="120" stroke="#f59e0b" strokeWidth="8" />
                    <line x1="80" y1="120" x2="80" y2="160" stroke="#f59e0b" strokeWidth="8" />
                    <text x="40" y="105" fill="#f59e0b" fontSize="11" fontWeight="bold">ইনলেট 4"</text>
                    
                    <line x1="570" y1="140" x2="630" y2="140" stroke="#10b981" strokeWidth="8" />
                    <line x1="570" y1="170" x2="570" y2="140" stroke="#10b981" strokeWidth="8" />
                    <text x="575" y="125" fill="#10b981" fontSize="11" fontWeight="bold">আউটলেট 4"</text>
                    
                    {/* Manholes */}
                    <rect x="110" y="65" width="60" height="20" fill="#38bdf8" rx="3" />
                    <rect x="290" y="65" width="60" height="20" fill="#38bdf8" rx="3" />
                    <rect x="470" y="65" width="60" height="20" fill="#38bdf8" rx="3" />
                    
                    {/* Water/Sludge Levels */}
                    <line x1="50" y1="150" x2="600" y2="150" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="6 3" />
                    <text x="140" y="240" fill="#94a3b8" fontSize="12" textAnchor="middle">১ম চেম্বার (স্লাজ)</text>
                    <text x="320" y="240" fill="#94a3b8" fontSize="12" textAnchor="middle">২য় চেম্বার</text>
                    <text x="500" y="240" fill="#94a3b8" fontSize="12" textAnchor="middle">৩য় চেম্বার (ফিল্টার)</text>
                    
                    <text x="325" y="40" fill="#38bdf8" fontSize="14" textAnchor="middle" fontWeight="bold">
                      ৩-চেম্বার আরসিসি সেপ্টিক ট্যাংক ({septicCapacity} জনের জন্য)
                    </text>
                    <text x="325" y="375" fill="#94a3b8" fontSize="11" textAnchor="middle">
                      টপ স্ল্যাব রড: 10mm @ 6" c/c B/W • আরসিসি ওয়াল থিকনেস: 6"
                    </text>
                  </svg>
                )}

                {/* 7. LIFT CORE CAD */}
                {activeTab === 'lift' && (
                  <svg width="600" height="420" viewBox="0 0 600 420" className="text-slate-200">
                    {/* Shear Wall Box */}
                    <rect x="130" y="70" width="340" height="280" fill="#1e293b" stroke="#38bdf8" strokeWidth="3" />
                    <rect x="160" y="100" width="280" height="220" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
                    
                    {/* Door Opening */}
                    <rect x="230" y="65" width="140" height="40" fill="#0f172a" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 2" />
                    <text x="300" y="90" fill="#f59e0b" fontSize="11" textAnchor="middle" fontWeight="bold">লিফট ডোর ওপেনিং</text>
                    
                    {/* Double Curtain Rebar Mesh Dots */}
                    {[145, 455].map((x) => (
                      <g key={x}>
                        {[110, 140, 170, 200, 230, 260, 290].map((y) => (
                          <circle key={y} cx={x} cy={y} r="5" fill="#ef4444" />
                        ))}
                      </g>
                    ))}
                    {[180, 210, 240, 270, 300, 330, 360, 390, 420].map((x) => (
                      <circle key={x} cx={x} cy="335" r="5" fill="#ef4444" />
                    ))}
                    
                    <text x="300" y="45" fill="#38bdf8" fontSize="14" textAnchor="middle" fontWeight="bold">
                      আরসিসি লিফট কোর ও শিয়ার ওয়াল ({liftCapacity} জনের লিফট)
                    </text>
                    <text x="300" y="210" fill="#94a3b8" fontSize="13" textAnchor="middle">
                      লিফট শ্যাফট স্পেস: 5'-6" x 5'-6"
                    </text>
                    <text x="300" y="380" fill="#94a3b8" fontSize="11" textAnchor="middle">
                      শিয়ার ওয়াল থিকনেস: 8" • ডাবল কার্টেন 12mm Rebar @ 6" c/c Both Ways
                    </text>
                  </svg>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
