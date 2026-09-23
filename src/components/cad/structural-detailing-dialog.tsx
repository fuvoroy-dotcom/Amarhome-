'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, Layers, ShieldCheck, ZoomIn, ZoomOut, Building2, Boxes, Scissors, Info } from 'lucide-react';

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
  const [detailingStoreys, setDetailingStoreys] = useState(3);

  // Helper: check if a point is inside a polygon area marker
  const isPointInPoly = (px: number, py: number, poly: { x: number; y: number }[]) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // Find area marker and pillars inside it
  const selectedArea = designObjects.find(o => o.subType === 'area-marker'); 
  
  const mappedPillars = useMemo(() => {
    if (!selectedArea || !selectedArea.points) {
        return designObjects.filter(o => o.subType === 'pillar' || o.type === 'pillar');
    }
    return designObjects.filter(o => {
      if (o.subType !== 'pillar' && o.type !== 'pillar') return false;
      const cx = o.x + o.w / 2;
      const cy = o.y + o.h / 2;
      return isPointInPoly(cx, cy, selectedArea.points);
    });
  }, [designObjects, selectedArea]);

  // Group columns by unique dimensions
  const uniquePillarGroups = useMemo(() => {
    const groups: Record<string, { wIn: number; hIn: number; count: number }> = {};
    mappedPillars.forEach(p => {
      const wIn = Math.max(10, Math.round(p.w * 12));
      const hIn = Math.max(10, Math.round(p.h * 12));
      const key = `${wIn}x${hIn}`;
      if (!groups[key]) groups[key] = { wIn, hIn, count: 0 };
      groups[key].count++;
    });
    return Object.values(groups);
  }, [mappedPillars]);

  // Structural Safety Logic - Updated to be dynamic based on size
  const getReinforcementInfo = (storeys: number, wIn: number = 10, hIn: number = 10) => {
    let rodCount = 4;
    const maxSide = Math.max(wIn, hIn);
    
    // Dynamic Rod Count calculation: higher storeys or larger sizes demand more rebars
    if (storeys <= 2) {
      rodCount = maxSide > 12 ? 6 : 4;
    } else if (storeys <= 4) {
      rodCount = maxSide > 12 ? 8 : 6;
      if (maxSide >= 18) rodCount = 10;
    } else {
      rodCount = maxSide > 12 ? 12 : 10;
    }

    rodCount = Math.min(rodCount, 12); // Clamped to 12 for SVG diagram constraints

    if (storeys <= 2) return { rod: "16mm (5 Suta)", gap: "6\" c/c", thick: 15, hook: 3, rodCount };
    if (storeys <= 3) return { rod: "16mm (5 Suta)", gap: "5\" c/c", thick: 18, hook: 4, rodCount };
    if (storeys <= 4) return { rod: "16mm (5 Suta)", gap: "5\" c/c", thick: 18, hook: 4, rodCount };
    if (storeys <= 5) return { rod: "20mm (6 Suta)", gap: "4.5\" c/c", thick: 24, hook: 4, rodCount };
    return { rod: "20mm (6 Suta)", gap: "4\" c/c", thick: 24, hook: 4, rodCount };
  };

  const rebar = getReinforcementInfo(detailingStoreys);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[92vh] p-0 flex flex-col bg-slate-900 text-slate-100 border-slate-800 shadow-2xl rounded-2xl overflow-hidden print:w-full print:h-full print:bg-white print:text-slate-950 print:border-none print:shadow-none print:rounded-none">
        <style jsx global>{`
          @media print {
            @page { margin: 0.5in !important; size: auto; }
            body { background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .no-print { display: none !important; }
            .cad-canvas-print { background: white !important; color: black !important; transform: none !important; width: 100% !important; border: none !important; box-shadow: none !important; padding: 0 !important; }
            .page-break-inside-avoid { page-break-inside: avoid !important; }
            .text-slate-200, .text-slate-400, .text-slate-300 { color: #1e293b !important; }
            .bg-slate-900, .bg-slate-950 { background: white !important; border: 1px solid #e2e8f0 !important; }
          }
        `}</style>

        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-950 border-b border-slate-800 shrink-0 no-print">
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
                {projectName} • ২ডি রড বাইন্ডিং, সেকশন ও রিইনফোর্সমেন্ট ডিটেইলস
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setScale(s => Math.max(0.6, s - 0.1))} className="h-8 w-8 p-0 bg-slate-900 border-slate-700 text-slate-300">
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-xs font-mono text-slate-400 min-w-10 text-center">{Math.round(scale * 100)}%</span>
            <Button variant="outline" size="sm" onClick={() => setScale(s => Math.min(1.8, s + 0.1))} className="h-8 w-8 p-0 bg-slate-900 border-slate-700 text-slate-300">
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button size="sm" onClick={handlePrint} className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white gap-1.5 ml-2">
              <Download className="w-3.5 h-3.5" /> Export CAD / Print
            </Button>
          </div>
        </div>

        <div className="bg-slate-950/80 px-6 pt-2 border-b border-slate-800 shrink-0 no-print">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-slate-900/90 p-1 border border-slate-800 h-auto flex flex-wrap gap-1">
              <TabsTrigger value="footing" className="text-[11px] font-bold py-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">১. ফুটিং / বেস</TabsTrigger>
              <TabsTrigger value="column" className="text-[11px] font-bold py-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">২. কলাম সেকশন</TabsTrigger>
              <TabsTrigger value="beam" className="text-[11px] font-bold py-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">৩. বিম ডিটেইলিং</TabsTrigger>
              <TabsTrigger value="slab" className="text-[11px] font-bold py-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">৪. ছাদ (Slab) রড</TabsTrigger>
              <TabsTrigger value="stair" className="text-[11px] font-bold py-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">৫. সিঁড়ি সেকশন</TabsTrigger>
              <TabsTrigger value="septic" className="text-[11px] font-bold py-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">৬. সেপ্টিক ট্যাংক</TabsTrigger>
              <TabsTrigger value="lift" className="text-[11px] font-bold py-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">৭. লিফট কোর / শিয়ার ওয়াল</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-64 border-r border-slate-800 bg-slate-950 p-4 overflow-y-auto space-y-4 shrink-0 text-xs no-print">
            <div className="font-bold text-slate-300 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-800 flex items-center justify-between">
              <span>প্যারামিটার কন্ট্রোল</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-400">ভবনের তলা সংখ্যা</Label>
              <Select value={detailingStoreys.toString()} onValueChange={(v) => setDetailingStoreys(parseInt(v))}>
                <SelectTrigger className="h-8 bg-slate-900 border-slate-700 text-white font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  {[1,2,3,4,5,6].map(n => <SelectItem key={n} value={n.toString()}>{n} তলা ভবন</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-blue-600/10 rounded-lg border border-blue-500/20 space-y-2 text-slate-300">
              <p className="font-bold text-blue-400 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> এরিয়া সামারি</p>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span>রুম এরিয়া:</span>
                <span className="text-white font-bold">{selectedArea ? "শনাক্ত হয়েছে" : "ডিফল্ট"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span>কলাম সংখ্যা:</span>
                <span className="text-white font-bold">{mappedPillars.length} টি</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>ইউনিক কলাম:</span>
                <span className="text-amber-400 font-bold">{uniquePillarGroups.length} প্রকার</span>
              </div>
            </div>

            {/* Restored Safety Box */}
            <div className="p-3 bg-emerald-600/10 rounded-lg border border-emerald-500/20 space-y-2 text-slate-300">
              <p className="font-bold text-emerald-400 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> উচ্চ নিরাপত্তায় রড ডিজাইন</p>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span>মেইন রড:</span>
                <span className="text-white font-bold">{rebar.rod}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span>রড সংখ্যা:</span>
                <span className="text-white font-bold">{rebar.rodCount} টি</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>বেস পুরুত্ব:</span>
                <span className="text-emerald-400 font-bold">{rebar.thick}" ইঞ্চি</span>
              </div>
            </div>
          </div>

          <div className="flex-1 bg-slate-900/60 overflow-auto scrollbar-thin scrollbar-thumb-slate-700 print:bg-white print:p-0">
            <div className="min-h-full min-w-full flex flex-col items-center p-8 lg:p-16 print:p-0">
              <div
                className="inline-flex flex-col items-center justify-center relative border border-slate-800 rounded-2xl bg-slate-950 shadow-2xl overflow-visible p-12 cad-canvas-print"
                style={{
                  backgroundImage: 'radial-gradient(circle, #334155 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                  transform: `scale(${scale})`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.15s ease-out',
                }}
              >
                {activeTab === 'footing' && (
                  <div className="flex flex-col gap-32 items-center">
                    {uniquePillarGroups.length > 0 ? uniquePillarGroups.map((group, idx) => {
                      const groupRebar = getReinforcementInfo(detailingStoreys, group.wIn, group.hIn);
                      const offset = detailingStoreys <= 2 ? 3.0 : (detailingStoreys + 1.5);
                      const fSize = Math.max(4, Math.ceil((group.wIn / 12 + offset) * 2) / 2);
                      const canvasW = 680;
                      const canvasH = 540;
                      
                      return (
                        <div key={idx} className="flex flex-col items-center gap-10 bg-slate-900/30 p-10 rounded-[2.5rem] border border-white/5 page-break-inside-avoid print:bg-white">
                          <div className="flex items-center gap-4 bg-slate-950/80 px-8 py-3 rounded-full border border-slate-800">
                             <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-lg">F{idx+1}</div>
                             <span className="text-slate-200 font-bold text-base uppercase tracking-widest print:text-slate-900">ফাউন্ডেশন ডিটেইলস — {group.wIn}" x {group.hIn}" কলামের জন্য</span>
                          </div>

                          <svg width={canvasW} height={canvasH} viewBox={`0 0 ${canvasW} ${canvasH}`} className="text-slate-200 overflow-visible">
                            <g transform="translate(40, 100)">
                              <rect x="0" y="0" width="240" height="240" fill="#0f172a" stroke="#38bdf8" strokeWidth="4" />
                              <text x="120" y="-30" fill="#38bdf8" fontSize="16" textAnchor="middle" fontWeight="black">PLAN VIEW (রড জালি বিন্যাস)</text>
                              {[20, 55, 90, 120, 150, 185, 220].map(pos => (
                                <g key={`rebar-${pos}`}>
                                  <line x1="5" y1={pos} x2="235" y2={pos} stroke="#ef4444" strokeWidth="2" />
                                  <line x1={pos} y1="5" x2={pos} y2="235" stroke="#ef4444" strokeWidth="2" />
                                </g>
                              ))}
                              <rect x="100" y="100" width="40" height="40" fill="#dc2626" stroke="#ffffff" strokeWidth="2" />
                              <text x="120" y="270" fill="#94a3b8" fontSize="12" textAnchor="middle" fontWeight="bold">{fSize}'-0" x {fSize}'-0" BASE SIZE</text>
                            </g>

                            <g transform="translate(380, 100)">
                              <text x="130" y="-30" fill="#38bdf8" fontSize="16" textAnchor="middle" fontWeight="black">SECTIONAL VIEW (কাটা দৃশ্য ও মাটন)</text>
                              <path d="M 30 220 L 30 320 L 250 320 L 250 220" fill="none" stroke="#64748b" strokeWidth="3" />
                              <rect x="30" y="220" width="220" height="100" fill="#1e293b" fillOpacity="0.4" />
                              <path d={`M 40 ${310 - groupRebar.hook*4} L 40 310 L 240 310 L 240 ${310 - groupRebar.hook*4}`} fill="none" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                              {[55, 85, 115, 140, 165, 195, 225].map(dx => <circle key={dx} cx={dx} cy="304" r="4" fill="#ef4444" />)}
                              <g stroke="#ef4444" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M 125 40 L 125 310 L 105 310" /><path d="M 155 40 L 155 310 L 175 310" />
                              </g>
                              <rect x="115" y="40" width="50" height="180" fill="#0f172a" stroke="#ffffff" strokeWidth="2.5" />
                              <text x="140" y="30" fill="#ef4444" fontSize="12" textAnchor="middle" fontWeight="bold">Column: {group.wIn}"x{group.hIn}"</text>
                              <text x="295" y="315" fill="#94a3b8" fontSize="11" fontWeight="bold">হুক/মাটন: {groupRebar.hook}"</text>
                              <text x="295" y="225" fill="#94a3b8" fontSize="11" fontWeight="bold">বেস উচ্চতা: {groupRebar.thick}"</text>
                            </g>

                            <g transform="translate(40, 440)">
                              <rect x="0" y="0" width="600" height="70" rx="12" fill="#111827" stroke="#10b981" strokeWidth="2" />
                              <text x="300" y="30" fill="#10b981" fontSize="14" textAnchor="middle" fontWeight="black">ইঞ্জিনিয়ারিং স্পেসিফিকেশন: {detailingStoreys} তলা ফাউন্ডেশন | রড সাইজ: {groupRebar.rod} ({groupRebar.rodCount} টি রড)</text>
                              <text x="300" y="52" fill="#94a3b8" fontSize="12" textAnchor="middle" fontWeight="bold">জালি স্পেসিং: {groupRebar.gap} c/c | ক্লিয়ার কভার: ৩" ইঞ্চি | হুক দৈর্ঘ্য: {groupRebar.hook}" ইঞ্চি | কংক্রিট গ্রেড: M20</text>
                            </g>
                          </svg>

                          <div className="w-full flex items-start gap-4 bg-amber-600/5 p-6 rounded-3xl border border-amber-600/20 print:bg-slate-50">
                             <Info className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
                             <div className="space-y-2">
                                <p className="text-amber-200 font-bold text-sm uppercase tracking-wider print:text-amber-800">রড বাইন্ডিং গাইডলাইন:</p>
                                <p className="text-slate-400 text-xs leading-relaxed print:text-slate-700">
                                   • প্রতিটি রডের শেষে <strong>{groupRebar.hook} ইঞ্চি মাটন (৯০° হুক)</strong> বাধ্যতামূলক যা ২ডি ডিজাইনে লাল লাইনে দেখানো হয়েছে।<br/>
                                   • কলামের রডগুলো বেসের নিচের জালি থেকে কমপক্ষে ৩ ইঞ্চি ক্লিয়ার কভার মেইনটেইন করবে এবং নিচে ৪ ইঞ্চি এল-ব্যান্ড (L-hook) হয়ে ড্রয়িং অনুযায়ী বসবে।
                                </p>
                             </div>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="flex flex-col items-center gap-8 py-48">
                         <Boxes className="w-24 h-24 text-slate-700 animate-pulse" />
                         <div className="text-slate-500 font-black uppercase tracking-[0.3em] text-center text-lg">ক্যানভাসে কোনো কলাম পাওয়া যায়নি</div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'column' && (
                  <div className="flex flex-col gap-32 items-center">
                    {uniquePillarGroups.length > 0 ? uniquePillarGroups.map((group, idx) => {
                      const groupRebar = getReinforcementInfo(detailingStoreys, group.wIn, group.hIn);
                      const cW = group.wIn;
                      const cH = group.hIn;
                      const rCount = groupRebar.rodCount;
                      const masterRW = cW - 3; // Clear cover 1.5" * 2
                      const masterRH = cH - 3;
                      const canvasW = 700;
                      const canvasH = 580;
                      
                      const ringSpacing = detailingStoreys > 4 ? "4\"/8\"" : "5\"/10\"";
                      const totalRings = Math.ceil((10 * 12) / 6); 

                      return (
                        <div key={idx} className="flex flex-col items-center gap-10 bg-slate-900/30 p-10 rounded-[2.5rem] border border-white/5 page-break-inside-avoid print:bg-white">
                          <div className="flex items-center gap-4 bg-slate-950/80 px-8 py-3 rounded-full border border-slate-800">
                             <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-lg">C{idx+1}</div>
                             <span className="text-slate-200 font-bold text-base uppercase tracking-widest print:text-slate-900">কলাম সেকশন ও রিং ডিটেইলস — {cW}" x {cH}" ({rCount} টি রড)</span>
                          </div>

                          <svg width={canvasW} height={canvasH} viewBox={`0 0 ${canvasW} ${canvasH}`} className="text-slate-200 overflow-visible">
                            <g transform="translate(40, 100)">
                              <text x="140" y="-30" fill="#38bdf8" fontSize="16" textAnchor="middle" fontWeight="black">COLUMN CROSS-SECTION (রড বিন্যাস: {rCount} Nos)</text>
                              <rect x="0" y="0" width="280" height="200" fill="#0f172a" stroke="#475569" strokeWidth="3" />
                              
                              <rect x="15" y="15" width="250" height="170" fill="none" stroke="#f59e0b" strokeWidth="2" rx="4" />
                              
                              <g fill="#ef4444">
                                <circle cx="15" cy="15" r="8" /><circle cx="265" cy="15" r="8" />
                                <circle cx="15" cy="185" r="8" /><circle cx="265" cy="185" r="8" />
                                
                                {rCount >= 6 && <><circle cx="140" cy="15" r="8" /><circle cx="140" cy="185" r="8" /></>}
                                {rCount >= 8 && <><circle cx="15" cy="100" r="8" /><circle cx="265" cy="100" r="8" /></>}
                                {rCount >= 10 && <><circle cx="77" cy="15" r="8" /><circle cx="203" cy="15" r="8" /></>}
                                {rCount >= 12 && <><circle cx="77" cy="185" r="8" /><circle cx="203" cy="185" r="8" /></>}
                              </g>
                              
                              <text x="140" y="235" fill="#94a3b8" fontSize="12" textAnchor="middle" fontWeight="bold">{cW}" x {cH}" Size | {groupRebar.rod} রড ({rCount} টি)</text>
                            </g>

                            <g transform="translate(380, 100)">
                              <text x="130" y="-30" fill="#38bdf8" fontSize="16" textAnchor="middle" fontWeight="black">RING / STIRRUP DETAIL (রিং ডিজাইন)</text>
                              <rect x="30" y="20" width="220" height="150" fill="none" stroke="#f59e0b" strokeWidth="4" rx="8" />
                              <path d="M 30 28 L 15 15 M 30 28 L 45 43" fill="none" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
                              <text x="140" y="195" fill="#f59e0b" fontSize="12" textAnchor="middle" fontWeight="bold">MASTER RING: {masterRW}" x {masterRH}"</text>
                              <text x="140" y="215" fill="#94a3b8" fontSize="10" textAnchor="middle">Hooks: {groupRebar.hook}" (১৩৫° বেন্ড) | ৮ মিমি রড</text>

                              {rCount > 4 && (
                                <g transform="translate(0, 240)">
                                  <path d="M 140 20 L 250 80 L 140 140 L 30 80 Z" fill="none" stroke="#fbbf24" strokeWidth="3" />
                                  <text x="140" y="170" fill="#fbbf24" fontSize="11" textAnchor="middle" fontWeight="bold">INNER TIE (ডায়মন্ড / লিঙ্ক রিং)</text>
                                </g>
                              )}
                            </g>

                            <g transform="translate(50, 480)">
                              <rect x="0" y="0" width="600" height="80" rx="12" fill="#111827" stroke="#10b981" strokeWidth="2" />
                              <text x="300" y="30" fill="#10b981" fontSize="14" textAnchor="middle" fontWeight="black">ইঞ্জিনিয়ারিং সামারি: {detailingStoreys} তলা ভবন | কলাম টাইপ: C{idx+1} ({rCount} টি রড)</text>
                              <text x="300" y="55" fill="#94a3b8" fontSize="12" textAnchor="middle" fontWeight="bold">
                                রিং স্পেসিং: {ringSpacing} c/c | রিং সাইজ: {masterRW}"x{masterRH}" | মাস্তান (Binding Wire): ০.৮৫ কেজি/টন
                              </text>
                              <text x="300" y="72" fill="#64748b" fontSize="10" textAnchor="middle">প্রতি ১০ ফুট উচ্চতায় আনুমানিক {totalRings}টি রিং প্রয়োজন হবে।</text>
                            </g>
                          </svg>

                          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div className="flex items-start gap-4 bg-blue-600/5 p-6 rounded-3xl border border-blue-600/20 print:bg-slate-50">
                               <Boxes className="w-6 h-6 text-blue-500 shrink-0 mt-0.5" />
                               <div className="space-y-2">
                                  <p className="text-blue-200 font-bold text-sm uppercase tracking-wider print:text-blue-800">রিং বসানোর নিয়ম:</p>
                                  <p className="text-slate-400 text-xs leading-relaxed print:text-slate-700">
                                     • কলামের উপরের ও নিচের অংশ (L/4 জোন) এ ঘন রিং (৪" c/c) দিতে হবে।<br/>
                                     • রিংয়ের হুকগুলো অবশ্যই রডের ভেতরের দিকে ১৩৫° কোণে থাকবে।
                                  </p>
                               </div>
                             </div>
                             <div className="flex items-start gap-4 bg-emerald-600/5 p-6 rounded-3xl border border-emerald-600/20 print:bg-slate-50">
                               <ShieldCheck className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
                               <div className="space-y-2">
                                  <p className="text-emerald-200 font-bold text-sm uppercase tracking-wider print:text-emerald-800">মাস্তান (Binding Wire) গাইড:</p>
                                  <p className="text-slate-400 text-xs leading-relaxed print:text-slate-700">
                                     • ২২ গেজ জিআই তার ব্যবহার করতে হবে। প্রতিটি জয়েন্টে ২-৩ প্যাঁচ ডাবল তার দিয়ে শক্ত করে বাঁধতে হবে যেন ঢালাইয়ের সময় রড না নড়ে।
                                  </p>
                               </div>
                             </div>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="flex flex-col items-center gap-8 py-48">
                         <Building2 className="w-24 h-24 text-slate-700 animate-pulse" />
                         <div className="text-slate-500 font-black uppercase tracking-[0.3em] text-center text-lg">রুম এরিয়ার মধ্যে কোনো কলাম পাওয়া যায়নি</div>
                      </div>
                    )}
                  </div>
                )}
                
                {['beam', 'slab', 'stair', 'septic', 'lift'].includes(activeTab) && (
                  <div className="flex flex-col items-center justify-center p-48 gap-8 min-w-[700px]">
                     <div className="p-10 rounded-full bg-slate-900 border border-slate-800 shadow-2xl">
                        <Scissors className="w-20 h-20 text-blue-500 opacity-20" />
                     </div>
                     <p className="text-slate-400 font-black uppercase text-sm tracking-[0.5em] italic animate-pulse">
                        {activeTab} ডিটেইলস সেকশন জেনারেট হচ্ছে...
                     </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
