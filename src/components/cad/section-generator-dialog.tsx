'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Download, Scissors, ZoomIn, ZoomOut, Eye } from 'lucide-react';

interface SectionGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  designObjects: any[];
  projectName?: string;
}

export function SectionGeneratorDialog({
  open,
  onOpenChange,
  designObjects,
  projectName = 'AmarHome Project',
}: SectionGeneratorProps) {
  const [cutPlane, setCutPlane] = useState<'A-A' | 'B-B'>('A-A');
  const [storeys, setStoreys] = useState(3);
  const [floorHeight, setFloorHeight] = useState(10); // ft
  const [plinthHeight, setPlinthHeight] = useState(2.5); // ft
  const [scale, setScale] = useState(1);

  // Filter elements
  const walls = designObjects.filter((o) => o.subType === 'wall');
  const doors = designObjects.filter((o) => o.type === 'opening' && o.subType?.includes('door'));
  const windows = designObjects.filter((o) => o.type === 'opening' && o.subType === 'window');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[92vh] p-0 flex flex-col bg-slate-900 text-slate-100 border-slate-800 shadow-2xl rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base md:text-lg font-black text-white flex items-center gap-2">
                Sectional Architectural Drawing Studio
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-bold border border-purple-500/30">
                  খাড়া কাটা ২ডি ভিউ (Section A-A & B-B)
                </span>
              </DialogTitle>
              <p className="text-xs text-slate-400">
                {projectName} • ভবনের ভেতরের উলম্ব ক্রস-সেকশন এলিভেশন ড্রয়িং
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScale((s) => Math.max(0.6, s - 0.1))}
              className="h-8 w-8 p-0 bg-slate-900 border-slate-700 text-slate-300"
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
              className="h-8 w-8 p-0 bg-slate-900 border-slate-700 text-slate-300"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => window.print()}
              className="h-8 text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white gap-1.5 ml-2"
            >
              <Download className="w-3.5 h-3.5" /> প্রিন্ট / সেকশন এক্সপোর্ট
            </Button>
          </div>
        </div>

        {/* Workspace */}
        <div className="flex-1 flex overflow-hidden">
          {/* Controls */}
          <div className="w-64 border-r border-slate-800 bg-slate-950 p-4 space-y-4 shrink-0 text-xs">
            <div className="font-bold text-slate-300 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-800">
              সেকশন কন্ট্রোল
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-400">কাটিং লাইন সিলেক্ট করুন</Label>
              <Select value={cutPlane} onValueChange={(v: any) => setCutPlane(v)}>
                <SelectTrigger className="h-8 bg-slate-900 border-slate-700 text-white font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="A-A">Section A-A (অনুদৈর্ঘ্য / Long Cut)</SelectItem>
                  <SelectItem value="B-B">Section B-B (প্রস্থচ্ছেদী / Cross Cut)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-400">ভবনের তলা সংখ্যা</Label>
              <Input
                type="number"
                value={storeys}
                onChange={(e) => setStoreys(parseInt(e.target.value) || 1)}
                className="h-8 bg-slate-900 border-slate-700 text-white font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-400">ফ্লোর টু ফ্লোর হাইট (ft)</Label>
              <Input
                type="number"
                value={floorHeight}
                onChange={(e) => setFloorHeight(parseFloat(e.target.value) || 10)}
                className="h-8 bg-slate-900 border-slate-700 text-white font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-400">প্লিন্থ লেভেল / ভিটি (ft)</Label>
              <Input
                type="number"
                value={plinthHeight}
                onChange={(e) => setPlinthHeight(parseFloat(e.target.value) || 2.5)}
                className="h-8 bg-slate-900 border-slate-700 text-white font-mono"
              />
            </div>

            <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 space-y-1.5 text-slate-400 text-[11px]">
              <p className="font-semibold text-slate-200">চিহ্নিত উপাদান:</p>
              <p>• দেওয়াল: {walls.length} টি</p>
              <p>• দরজা: {doors.length} টি (উচ্চতা ৭'-০")</p>
              <p>• জানালা: {windows.length} টি (সিল লেভেল ২'-৬")</p>
              <p>• প্যারাপেট ওয়াল: ৩'-০" উচ্চতা</p>
            </div>
          </div>

          {/* Section Elevation CAD Canvas */}
          <div className="flex-1 bg-slate-900/60 p-6 overflow-auto flex items-center justify-center">
            <div
              className="w-full h-full min-w-[760px] min-h-[500px] flex items-center justify-center relative border border-slate-800 rounded-xl bg-slate-950/90 shadow-inner"
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
                <svg width="740" height="460" viewBox="0 0 740 460" className="text-slate-200">
                  {/* Ground Line & Plinth */}
                  <line x1="40" y1="360" x2="680" y2="360" stroke="#10b981" strokeWidth="3" />
                  <text x="50" y="375" fill="#10b981" fontSize="10" fontWeight="bold">G.L. (Ground Level ±0'-0")</text>

                  {/* Plinth Floor */}
                  <rect x="120" y="325" width="480" height="35" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
                  <text x="50" y="335" fill="#38bdf8" fontSize="10" fontWeight="bold">P.L. (+{plinthHeight}'-0")</text>

                  {/* Foundation Footings under ground */}
                  {[140, 360, 580].map((x) => (
                    <g key={x}>
                      <line x1={x} y1="360" x2={x} y2="420" stroke="#64748b" strokeWidth="12" />
                      <rect x={x - 25} y="420" width="50" height="20" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                    </g>
                  ))}
                  <text x="360" y="455" fill="#94a3b8" fontSize="10" textAnchor="middle">RCC COLUMN FOOTING DEEP (5'-0" below GL)</text>

                  {/* Multi-Storey Slabs & Walls */}
                  {Array.from({ length: Math.min(4, storeys) }).map((_, floorIdx) => {
                    const floorY = 325 - (floorIdx + 1) * 75;
                    const wallBottom = 325 - floorIdx * 75;
                    return (
                      <g key={floorIdx}>
                        {/* Floor Slab */}
                        <rect x="110" y={floorY} width="500" height="12" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                        <text x="50" y={floorY + 10} fill="#f59e0b" fontSize="10" fontWeight="bold">
                          {floorIdx === 0 ? '১ম তলা ছাদ' : `${floorIdx + 1}ম তলা ছাদ`}
                        </text>

                        {/* Cut Walls (Left, Center, Right) */}
                        <rect x="135" y={floorY + 12} width="15" height={wallBottom - (floorY + 12)} fill="#475569" stroke="#94a3b8" strokeWidth="1" />
                        <rect x="355" y={floorY + 12} width="15" height={wallBottom - (floorY + 12)} fill="#475569" stroke="#94a3b8" strokeWidth="1" />
                        <rect x="575" y={floorY + 12} width="15" height={wallBottom - (floorY + 12)} fill="#475569" stroke="#94a3b8" strokeWidth="1" />

                        {/* Door Elevation in Left Room */}
                        <rect x="220" y={wallBottom - 50} width="28" height="50" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.5" />
                        <text x="234" y={wallBottom - 25} fill="#f59e0b" fontSize="8" textAnchor="middle">Door</text>

                        {/* Window in Right Room */}
                        <rect x="440" y={wallBottom - 45} width="35" height="30" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
                        <line x1="457" y1={wallBottom - 45} x2="457" y2={wallBottom - 15} stroke="#38bdf8" strokeWidth="1" />
                        <text x="457" y={wallBottom - 28} fill="#38bdf8" fontSize="8" textAnchor="middle">Window</text>
                      </g>
                    );
                  })}

                  {/* Parapet Wall on Roof */}
                  {(() => {
                    const roofY = 325 - Math.min(4, storeys) * 75;
                    return (
                      <g>
                        <rect x="110" y={roofY - 25} width="15" height="25" fill="#475569" stroke="#94a3b8" strokeWidth="1" />
                        <rect x="595" y={roofY - 25} width="15" height="25" fill="#475569" stroke="#94a3b8" strokeWidth="1" />
                        <text x="360" y={roofY - 10} fill="#a855f7" fontSize="10" textAnchor="middle" fontWeight="bold">
                          ROOF TOP PARAPET (3'-0" High)
                        </text>
                      </g>
                    );
                  })()}

                  {/* Cutting Plane Badge */}
                  <rect x="280" y="20" width="160" height="30" rx="6" fill="#581c87" stroke="#c084fc" strokeWidth="2" />
                  <text x="360" y="40" fill="#ffffff" fontSize="13" fontWeight="black" textAnchor="middle">
                    SECTION {cutPlane}
                  </text>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
