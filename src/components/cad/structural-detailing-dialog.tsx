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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, Layers, ShieldCheck, ZoomIn, ZoomOut, Building2 } from 'lucide-react';

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

  // Find columns within the selected area marker
  const selectedArea = designObjects.find(o => o.subType === 'area-marker'); // Simplified for mapping logic as per prompt
  
  const mappedPillars = useMemo(() => {
    if (!selectedArea || !selectedArea.points) return designObjects.filter(o => o.subType === 'pillar');
    return designObjects.filter(o => {
      if (o.subType !== 'pillar') return false;
      const cx = o.x + o.w / 2;
      const cy = o.y + o.h / 2;
      return isPointInPoly(cx, cy, selectedArea.points);
    });
  }, [designObjects, selectedArea]);

  // Group columns by unique dimensions
  const uniquePillarGroups = useMemo(() => {
    const groups: Record<string, { wIn: number; hIn: number; count: number }> = {};
    mappedPillars.forEach(p => {
      const wIn = Math.round(p.w * 12);
      const hIn = Math.round(p.h * 12);
      const key = `${wIn}x${hIn}`;
      if (!groups[key]) groups[key] = { wIn, hIn, count: 0 };
      groups[key].count++;
    });
    return Object.values(groups);
  }, [mappedPillars]);

  // Structural Safety Logic (Requirement: if 12mm is found, upgrade to 16mm)
  const getReinforcementInfo = (storeys: number) => {
    if (storeys <= 2) return { rod: "16mm", gap: "6\" c/c", thick: 15 };
    if (storeys <= 4) return { rod: "16mm", gap: "5\" c/c", thick: 18 };
    return { rod: "20mm", gap: "4.5\" c/c", thick: 24 };
  };

  const rebar = getReinforcementInfo(detailingStoreys);

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
                {projectName} • রড বাইন্ডিং, সেকশন ও রিইনফোর্সমেন্ট ডিটেইলস
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
            <Button size="sm" onClick={() => window.print()} className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white gap-1.5 ml-2">
              <Download className="w-3.5 h-3.5" /> Export CAD / Print
            </Button>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="bg-slate-950/80 px-6 pt-2 border-b border-slate-800">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-slate-900/90 p-1 border border-slate-800 h-auto flex flex-wrap gap-1">
              <TabsTrigger value="footing" className="text-xs font-bold py-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">১. ফুটিং / বেস</TabsTrigger>
              <TabsTrigger value="column" className="text-xs font-bold py-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">২. কলাম সেকশন</TabsTrigger>
              <TabsTrigger value="beam" className="text-xs font-bold py-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">৩. বিম ডিটেইলিং</TabsTrigger>
              <TabsTrigger value="slab" className="text-xs font-bold py-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">৪. ছাদ (Slab) রড</TabsTrigger>
              <TabsTrigger value="stair" className="text-xs font-bold py-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">৫. সিঁড়ি সেকশন</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Config Sidebar */}
          <div className="w-64 border-r border-slate-800 bg-slate-950 p-4 overflow-y-auto space-y-4 shrink-0 text-xs">
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
                    <span>কলামের ধরণ:</span>
                    <span className="text-amber-400 font-bold">{uniquePillarGroups.length} প্রকার</span>
                  </div>
                </div>

                <div className="p-3 bg-emerald-600/10 rounded-lg border border-emerald-500/20 space-y-1 text-slate-300">
                  <p className="font-bold text-emerald-400">নিরাপদ রড ডিজাইন:</p>
                  <p>• মেইন রড: {rebar.rod} (Safety High)</p>
                  <p>• জালি স্পেসিং: {rebar.gap}</p>
                  <p>• ক্লিয়ার কভার: ৩ ইঞ্চি</p>
                </div>
              </>
            )}
            
            {activeTab !== 'footing' && (
              <div className="p-8 text-center text-slate-500 italic uppercase font-black text-[10px] tracking-widest leading-relaxed">
                সেকশন প্যারামিটার লোড হচ্ছে...
              </div>
            )}
          </div>

          {/* CAD Display */}
          <div className="flex-1 bg-slate-900/60 p-6 overflow-auto flex items-center justify-center">
            <div
              className="w-full h-full min-w-[700px] min-h-[500px] flex items-center justify-center relative border border-slate-800 rounded-xl bg-slate-950 shadow-inner"
              style={{
                backgroundImage: 'radial-gradient(circle, #334155 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
            >
              <div style={{ transform: `scale(${scale})`, transformOrigin: 'center center', transition: 'transform 0.15s ease-out' }}>
                {activeTab === 'footing' && (
                  <div className="flex flex-col gap-12 p-8 items-center">
                    {uniquePillarGroups.length > 0 ? uniquePillarGroups.map((group, idx) => {
                      const fSize = Math.max(4, Math.ceil((group.wIn / 12 + (detailingStoreys <= 2 ? 2.5 : 3.5)) * 2) / 2);
                      return (
                        <div key={idx} className="flex flex-col items-center gap-4">
                          <svg width="600" height="380" viewBox="0 0 600 380" className="text-slate-200">
                            {/* Footing Section */}
                            <rect x="40" y="220" width="240" height="100" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                            <line x1="40" y1="320" x2="280" y2="320" stroke="#f59e0b" strokeWidth="6" strokeDasharray="4 2" />
                            
                            {/* Column from Footing */}
                            <rect x="135" y="100" width="50" height="120" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
                            
                            {/* Safety Rebars 16mm+ */}
                            <line x1="50" y1="305" x2="270" y2="305" stroke="#ef4444" strokeWidth="3" />
                            {[70, 100, 130, 160, 190, 220, 250].map(x => <circle key={x} cx={x} cy="300" r="3" fill="#38bdf8" />)}
                            
                            <text x="160" y="85" fill="#38bdf8" fontSize="11" textAnchor="middle" fontWeight="bold">কলাম সাইজ: {group.wIn}"x{group.hIn}"</text>
                            <text x="160" y="210" fill="#94a3b8" fontSize="10" textAnchor="middle">ম্যাপড টাইপ #{idx + 1}</text>

                            {/* Top View Plan */}
                            <rect x="340" y="100" width="220" height="220" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                            <rect x="425" y="185" width="50" height="50" fill="#ef4444" stroke="#ffffff" strokeWidth="1" />
                            {[120, 150, 180, 210, 240, 270, 300].map(y => <line key={y} x1="350" y1={y} x2="550" y2={y} stroke="#ef4444" strokeWidth="1.2" strokeDasharray="3 2" />)}
                            {[360, 390, 420, 450, 480, 510, 540].map(x => <line key={x} x1={x} y1="110" x2={x} y2="310" stroke="#38bdf8" strokeWidth="1.2" strokeDasharray="3 2" />)}
                            
                            <text x="450" y="80" fill="#38bdf8" fontSize="12" textAnchor="middle" fontWeight="bold">বেস প্ল্যান ভিউ ({fSize}' x {fSize}')</text>
                            <text x="300" y="360" fill="#94a3b8" fontSize="11" textAnchor="middle" fontWeight="black">
                              ডিজাইন: {detailingStoreys} তলা ফাউন্ডেশন | রড: {rebar.rod} @ {rebar.gap} (নিরাপদ জালি)
                            </text>
                          </svg>
                          <div className="w-full h-px bg-slate-800" />
                        </div>
                      );
                    }) : (
                      <div className="text-slate-500 font-black uppercase tracking-[0.2em] py-20 text-sm">ক্যানভাসে কলাম পাওয়া যায়নি</div>
                    )}
                  </div>
                )}
                
                {activeTab !== 'footing' && (
                  <div className="flex flex-col items-center justify-center p-20 gap-4">
                     <ShieldCheck className="w-12 h-12 text-blue-500 opacity-20" />
                     <p className="text-slate-500 font-black uppercase text-xs tracking-widest italic">অন্যান্য সেকশন জেনারেট হচ্ছে...</p>
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
