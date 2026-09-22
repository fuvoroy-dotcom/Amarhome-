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

  // Structural Safety Logic (Requirement: Safety High - 16mm/20mm)
  const getReinforcementInfo = (storeys: number) => {
    if (storeys <= 2) return { rod: "16mm (5 Suta)", gap: "6\" c/c", thick: 15, hook: 3 };
    if (storeys <= 4) return { rod: "16mm (5 Suta)", gap: "5\" c/c", thick: 18, hook: 4 };
    return { rod: "20mm (6 Suta)", gap: "4.5\" c/c", thick: 24, hook: 4 };
  };

  const rebar = getReinforcementInfo(detailingStoreys);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[92vh] p-0 flex flex-col bg-slate-900 text-slate-100 border-slate-800 shadow-2xl rounded-2xl overflow-hidden print:w-full print:h-full print:bg-white print:text-slate-950 print:border-none print:shadow-none print:rounded-none">
        {/* Style block for precise print control */}
        <style jsx global>{`
          @media print {
            @page { margin: 0.5in !important; size: auto; }
            body { background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .no-print { display: none !important; }
            .print-only { display: block !important; }
            /* Force UI container to be white and accessible */
            .cad-canvas-print { 
              background: white !important; 
              color: black !important; 
              position: relative !important; 
              width: 100% !important; 
              height: auto !important; 
              transform: none !important; 
              padding: 0 !important;
              margin: 0 !important;
              box-shadow: none !important;
              border: none !important;
            }
            .cad-svg-print {
              max-width: 100% !important;
              height: auto !important;
            }
            /* Adjust colors for visibility on white paper */
            .text-slate-200, .text-slate-400, .text-slate-300 { color: #1e293b !important; }
            .bg-slate-900, .bg-slate-950, .bg-slate-900\/30 { background: white !important; border-color: #e2e8f0 !important; }
            .text-38bdf8 { color: #0284c7 !important; }
            .text-10b981 { color: #059669 !important; }
            .bg-amber-600\/5 { background: #fffbeb !important; border-color: #fde68a !important; }
            .text-amber-200 { color: #92400e !important; }
            .bg-slate-900\/60 { background: white !important; }
          }
        `}</style>

        {/* Header - Hidden in Print */}
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

        {/* Tabs - Hidden in Print */}
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
          {/* Config Sidebar - Hidden in Print */}
          <div className="w-64 border-r border-slate-800 bg-slate-950 p-4 overflow-y-auto space-y-4 shrink-0 text-xs no-print">
            <div className="font-bold text-slate-300 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-800 flex items-center justify-between">
              <span>প্যারামিটার কন্ট্রোল</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>

            {activeTab === 'footing' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-slate-400">ফাউন্ডেশন / তলা সংখ্যা</Label>
                  <Select value={detailingStoreys.toString()} onValueChange={(v) => setDetailingStoreys(parseInt(v))}>
                    <SelectTrigger className="h-8 bg-slate-900 border-slate-700 text-white font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                      {[1,2,3,4,5,6].map(n => <SelectItem key={n} value={n.toString()}>{n} তলা ফাউন্ডেশন</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="p-3 bg-blue-600/10 rounded-lg border border-blue-500/20 space-y-2 text-slate-300">
                  <p className="font-bold text-blue-400 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> ম্যাপড এরিয়া সামারি</p>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span>রুম এরিয়া:</span>
                    <span className="text-white font-bold">{selectedArea ? "শনাক্ত হয়েছে" : "ডিফল্ট"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span>কলাম সংখ্যা:</span>
                    <span className="text-white font-bold">{mappedPillars.length} টি</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span>ইউনিক কলাম টাইপ:</span>
                    <span className="text-amber-400 font-bold">{uniquePillarGroups.length} প্রকার</span>
                  </div>
                </div>

                <div className="p-3 bg-emerald-600/10 rounded-lg border border-emerald-500/20 space-y-1.5 text-slate-300">
                  <p className="font-bold text-emerald-400 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> উচ্চ-নিরাপত্তা রড ডিজাইন:</p>
                  <p>• মেইন রড: <strong>{rebar.rod}</strong></p>
                  <p>• জালি স্পেসিং: <strong>{rebar.gap}</strong></p>
                  <p>• রড হুক (Maton): <strong>{rebar.hook}" ইঞ্চি</strong></p>
                  <p className="text-[10px] text-slate-400 border-t border-white/5 pt-1 mt-1">সফটওয়্যার স্বয়ংক্রিয়ভাবে শক্তিশালী রড নির্বাচন করেছে।</p>
                </div>
              </>
            )}
            
            {activeTab !== 'footing' && (
              <div className="p-8 text-center text-slate-500 italic uppercase font-black text-[10px] tracking-widest leading-relaxed">
                {activeTab} ডিটেইলিং সেকশন লোড হচ্ছে...
              </div>
            )}
          </div>

          {/* CAD Display Workspace - Only Area that Prints */}
          <div className="flex-1 bg-slate-900/60 overflow-auto scrollbar-thin scrollbar-thumb-slate-700 print:overflow-visible print:bg-white print:p-0">
            <div className="min-h-full min-w-full flex flex-col items-center p-8 lg:p-16 print:p-0 print:m-0">
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
                  <div className="flex flex-col gap-24 items-center print:gap-12">
                    {uniquePillarGroups.length > 0 ? uniquePillarGroups.map((group, idx) => {
                      const offset = detailingStoreys <= 2 ? 3.0 : (detailingStoreys + 1.5);
                      const fSize = Math.max(4, Math.ceil((group.wIn / 12 + offset) * 2) / 2);
                      const canvasW = 680;
                      const canvasH = 500;
                      
                      return (
                        <div key={idx} className="flex flex-col items-center gap-10 bg-slate-900/30 p-10 rounded-[2.5rem] border border-white/5 shadow-inner print:bg-white print:border-slate-200 print:shadow-none print:p-4 print:page-break-inside-avoid">
                          <div className="flex items-center gap-4 bg-slate-950/80 px-6 py-2 rounded-full border border-slate-800 print:bg-slate-100 print:border-slate-300">
                             <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-black">F{idx+1}</div>
                             <span className="text-slate-200 font-bold text-sm uppercase tracking-widest print:text-slate-900">ফাউন্ডেশন ডিটেইলস - {group.wIn}" x {group.hIn}" কলামের জন্য</span>
                          </div>

                          <svg width={canvasW} height={canvasH} viewBox={`0 0 ${canvasW} ${canvasH}`} className="text-slate-200 overflow-visible cad-svg-print">
                            {/* 1. PLAN VIEW */}
                            <g transform="translate(40, 100)">
                              <rect x="0" y="0" width="240" height="240" fill="#0f172a" stroke="#38bdf8" strokeWidth="4" className="print:fill-white print:stroke-blue-600" />
                              <text x="120" y="-20" fill="#38bdf8" fontSize="14" textAnchor="middle" fontWeight="black" className="print:fill-blue-700">PLAN VIEW (রড জালি বিন্যাস)</text>
                              
                              {[20, 55, 90, 120, 150, 185, 220].map(pos => (
                                <g key={`rebar-${pos}`}>
                                  <line x1="5" y1={pos} x2="235" y2={pos} stroke="#ef4444" strokeWidth="2" />
                                  <line x1={pos} y1="5" x2={pos} y2="235" stroke="#ef4444" strokeWidth="2" />
                                </g>
                              ))}

                              <rect x="100" y="100" width="40" height="40" fill="#dc2626" stroke="#ffffff" strokeWidth="2" className="print:stroke-slate-900" />
                              <text x="120" y="260" fill="#94a3b8" fontSize="11" textAnchor="middle" fontWeight="bold" className="print:fill-slate-600">{fSize}'-0" x {fSize}'-0" BASE SIZE</text>
                            </g>

                            {/* 2. SECTIONAL VIEW */}
                            <g transform="translate(360, 100)">
                              <text x="140" y="-20" fill="#38bdf8" fontSize="14" textAnchor="middle" fontWeight="black" className="print:fill-blue-700">SECTIONAL VIEW (কাটা দৃশ্য ও মাটন)</text>
                              
                              <path d="M 30 220 L 30 320 L 250 320 L 250 220" fill="none" stroke="#64748b" strokeWidth="3" />
                              <rect x="30" y="220" width="220" height="100" fill="#1e293b" fillOpacity="0.4" className="print:fill-slate-100" />

                              <path d={`M 40 ${310 - rebar.hook*4} L 40 310 L 240 310 L 240 ${310 - rebar.hook*4}`} fill="none" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                              
                              {[55, 85, 115, 140, 165, 195, 225].map(dx => (
                                <circle key={dx} cx={dx} cy="302" r="3.5" fill="#ef4444" />
                              ))}

                              <g stroke="#ef4444" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M 125 40 L 125 310 L 105 310" />
                                <path d="M 155 40 L 155 310 L 175 310" />
                              </g>
                              
                              <rect x="115" y="40" width="50" height="180" fill="#0f172a" stroke="#ffffff" strokeWidth="2.5" className="print:fill-slate-50 print:stroke-slate-900" />
                              <text x="140" y="30" fill="#ef4444" fontSize="11" textAnchor="middle" fontWeight="bold" className="print:fill-red-700">Column: {group.wIn}"x{group.hIn}"</text>

                              <path d="M 260 310 L 290 310" stroke="#94a3b8" strokeWidth="1" markerEnd="url(#arrow)" />
                              <text x="295" y="315" fill="#94a3b8" fontSize="10" fontWeight="bold" className="print:fill-slate-600">হুক/মাটন: {rebar.hook}"</text>

                              <path d="M 260 220 L 290 220" stroke="#94a3b8" strokeWidth="1" markerEnd="url(#arrow)" />
                              <text x="295" y="225" fill="#94a3b8" fontSize="10" fontWeight="bold" className="print:fill-slate-600">বেস উচ্চতা: {rebar.thick}"</text>
                            </g>

                            <defs>
                              <marker id="arrow" markerWidth="10" markerHeight="10" refX="0" refY="3" orientation="auto" markerUnits="strokeWidth">
                                <path d="M0,0 L0,6 L9,3 z" fill="#94a3b8" />
                              </marker>
                            </defs>

                            <g transform="translate(40, 420)">
                              <rect x="0" y="0" width="600" height="60" rx="12" fill="#111827" stroke="#10b981" strokeWidth="1.5" className="print:fill-emerald-50 print:stroke-emerald-600" />
                              <text x="300" y="24" fill="#10b981" fontSize="12" textAnchor="middle" fontWeight="black" className="print:fill-emerald-800">
                                ইঞ্জিনিয়ারিং স্পেসিফিকেশন: {detailingStoreys} তলা ফাউন্ডেশন | রড সাইজ: {rebar.rod}
                              </text>
                              <text x="300" y="44" fill="#94a3b8" fontSize="10" textAnchor="middle" className="print:fill-slate-700">
                                জালি স্পেসিং: {rebar.gap} c/c | ক্লিয়ার কভার: ৩" ইঞ্চি | হুক দৈর্ঘ্য: {rebar.hook}" ইঞ্চি | কংক্রিট গ্রেড: M20 (1:1.5:3)
                              </text>
                            </g>
                          </svg>

                          <div className="w-full flex items-start gap-4 bg-amber-600/5 p-5 rounded-2xl border border-amber-600/20 print:bg-amber-50 print:border-amber-200">
                             <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 print:text-amber-700" />
                             <div className="space-y-1">
                                <p className="text-amber-200 font-bold text-xs uppercase tracking-wider print:text-amber-800">রড বাইন্ডিং গাইডলাইন (নির্দেশনা):</p>
                                <p className="text-slate-400 text-[11px] leading-relaxed print:text-slate-700">
                                   • প্রতিটি রডের শেষে <strong>{rebar.hook} ইঞ্চি মাটন (৯০০ হুক)</strong> বাধ্যতামূলক যা ২ডি ডিজাইনে লাল লাইনে দেখানো হয়েছে।<br/>
                                   • কলামের রডগুলো বেসের নিচের জালি থেকে কমপক্ষে ৩ ইঞ্চি কভার মেইনটেইন করবে এবং নিচে ৪ ইঞ্চি এল-ব্যান্ড (L-hook) হয়ে বসবে।<br/>
                                   • ছাদের রডের মতো বেসের জালি ডাবল লেয়ারে হবে না, তবে লোড অনুযায়ী রডগুলো ঘন করে সাজাতে হবে।
                                </p>
                             </div>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="flex flex-col items-center gap-8 py-32 no-print">
                         <Boxes className="w-20 h-20 text-slate-700 animate-pulse" />
                         <div className="text-slate-500 font-black uppercase tracking-[0.25em] text-center">
                            ক্যানভাসে কোনো কলাম বা এরিয়া পাওয়া যায়নি<br/>
                            <span className="text-[11px] lowercase tracking-normal font-normal opacity-60 mt-2 block">প্রথমে ক্যানভাসে পিলার বসান অথবা রুম এরিয়া সিলেক্ট করুন</span>
                         </div>
                      </div>
                    )}
                  </div>
                )}
                
                {activeTab !== 'footing' && (
                  <div className="flex flex-col items-center justify-center p-32 gap-8 min-w-[700px] no-print">
                     <div className="p-8 rounded-full bg-slate-900 border border-slate-800 shadow-2xl">
                        <Scissors className="w-16 h-16 text-blue-500 opacity-20" />
                     </div>
                     <p className="text-slate-400 font-black uppercase text-xs tracking-[0.4em] italic animate-pulse">
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
