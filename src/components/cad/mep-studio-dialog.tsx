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
import {
  Zap,
  Droplets,
  Download,
  Fan,
  Lightbulb,
  Tv,
  Table,
  Cpu,
  Waves,
} from 'lucide-react';

interface MepStudioProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  designObjects: any[];
  projectName?: string;
}

export function MepStudioDialog({
  open,
  onOpenChange,
  designObjects,
  projectName = 'AmarHome Project',
}: MepStudioProps) {
  const [activeTab, setActiveTab] = useState<'electrical' | 'plumbing' | 'schedule'>('electrical');
  const [wireType, setWireType] = useState<'lighting' | 'power'>('lighting');

  // Count elements from canvas
  const rooms = designObjects.filter((o) => o.subType === 'area-marker');
  const canvasLights = designObjects.filter((o) => o.subType === 'mep-light');
  const canvasFans = designObjects.filter((o) => o.subType === 'mep-fan');
  const canvasSockets = designObjects.filter((o) => o.subType === 'mep-socket');
  const canvasPipes = designObjects.filter((o) => o.subType === 'mep-pipe');
  const canvasSeptics = designObjects.filter((o) => o.subType === 'mep-septic');

  const roomCount = Math.max(3, rooms.length);
  const totalFans = canvasFans.length > 0 ? canvasFans.length : roomCount * 2;
  const totalLights = canvasLights.length > 0 ? canvasLights.length : roomCount * 4;
  const totalSockets = canvasSockets.length > 0 ? canvasSockets.length : roomCount + 2;
  const totalPipeLength = canvasPipes.length > 0 ? canvasPipes.reduce((acc, p) => acc + (p.w || 6), 0) * 15 : 180;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[92vh] p-0 flex flex-col bg-slate-900 text-slate-100 border-slate-800 shadow-2xl rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/30">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base md:text-lg font-black text-white flex items-center gap-2">
                MEP Engineering Studio (Electrical & Plumbing Layout)
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
                  ওয়্যারিং, ফিটিংস ও পাইপলাইন লেআউট
                </span>
              </DialogTitle>
              <p className="text-xs text-slate-400">
                {projectName} • লাইটিং, ফ্যান, এসি সকেট, ঠান্ডা/গরম পানি সরবরাহ ও স্যুয়ারেজ ড্রয়িং
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => window.print()}
            className="h-8 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> MEP শিডিউল এক্সপোর্ট
          </Button>
        </div>

        {/* Tab selection */}
        <div className="bg-slate-950 px-6 pt-2 border-b border-slate-800">
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
            <TabsList className="bg-slate-900 p-1 border border-slate-800 h-auto flex gap-1">
              <TabsTrigger
                value="electrical"
                className="text-xs font-bold py-1.5 data-[state=active]:bg-amber-600 data-[state=active]:text-white flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" /> ১. ইলেকট্রিক্যাল লেআউট (Wiring & Sockets)
              </TabsTrigger>
              <TabsTrigger
                value="plumbing"
                className="text-xs font-bold py-1.5 data-[state=active]:bg-cyan-600 data-[state=active]:text-white flex items-center gap-1.5"
              >
                <Droplets className="w-3.5 h-3.5" /> ২. প্লাম্বিং ও স্যুয়ারেজ (Piping & Drainage)
              </TabsTrigger>
              <TabsTrigger
                value="schedule"
                className="text-xs font-bold py-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white flex items-center gap-1.5"
              >
                <Table className="w-3.5 h-3.5" /> ৩. লোড ক্যালকুলেশন ও ফিটিংস শিডিউল
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Workspace */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Palette */}
          <div className="w-64 border-r border-slate-800 bg-slate-950 p-4 space-y-4 shrink-0 text-xs">
            {activeTab === 'electrical' && (
              <>
                <div className="font-bold text-slate-300 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-800">
                  ইলেকট্রিক্যাল সিম্বল
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 bg-slate-900 rounded border border-slate-800">
                    <Fan className="w-4 h-4 text-amber-400" />
                    <span>সিলিং ফ্যান পয়েন্ট (80W)</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-slate-900 rounded border border-slate-800">
                    <Lightbulb className="w-4 h-4 text-yellow-300" />
                    <span>এলইডি লাইট পয়েন্ট (20W)</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-slate-900 rounded border border-slate-800">
                    <Tv className="w-4 h-4 text-blue-400" />
                    <span>পাওয়ার সকেট (15A/AC Point)</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-slate-900 rounded border border-slate-800">
                    <Cpu className="w-4 h-4 text-emerald-400" />
                    <span>ডিস্ট্রিবিউশন বোর্ড (DB Box)</span>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'plumbing' && (
              <>
                <div className="font-bold text-slate-300 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-800">
                  প্লাম্বিং পাইপলাইন কালার কোড
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 bg-slate-900 rounded border border-slate-800">
                    <div className="w-4 h-1 bg-cyan-400 rounded" />
                    <span>ঠান্ডা পানি লাইন (3/4" CPVC)</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-slate-900 rounded border border-slate-800">
                    <div className="w-4 h-1 bg-red-400 rounded" />
                    <span>গরম পানি লাইন (3/4" PPR)</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-slate-900 rounded border border-slate-800">
                    <div className="w-4 h-1 bg-amber-400 rounded" />
                    <span>ড্রেনেজ পানি (3" uPVC)</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-slate-900 rounded border border-slate-800">
                    <div className="w-4 h-1 bg-emerald-500 rounded" />
                    <span>টয়লেট সয়েল পাইপ (4" PVC)</span>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'schedule' && (
              <div className="space-y-2">
                <div className="font-bold text-slate-300 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-800">
                  লোড সামারি
                </div>
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1.5 text-slate-300 text-[11px]">
                  <p>• কানেক্টেড লোড: <strong>4.8 kW</strong></p>
                  <p>• ডিমান্ড লোড: <strong>3.6 kW</strong></p>
                  <p>• মেইন কেবল: <strong>2x7/0.052 BYA</strong></p>
                  <p>• ওভারহেড ট্যাংক: <strong>1500 Liters</strong></p>
                </div>
              </div>
            )}
          </div>

          {/* Canvas Display */}
          <div className="flex-1 bg-slate-900/60 p-6 overflow-auto flex items-center justify-center">
            <div
              className="w-full h-full min-w-[720px] min-h-[500px] flex items-center justify-center relative border border-slate-800 rounded-xl bg-slate-950 shadow-inner"
              style={{
                backgroundImage:
                  'radial-gradient(circle, #334155 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
            >
              {activeTab === 'electrical' && (
                <svg width="680" height="440" viewBox="0 0 680 440" className="text-slate-200">
                  {/* Floor Layout Outline */}
                  <rect x="60" y="40" width="560" height="360" fill="#0f172a" stroke="#475569" strokeWidth="2.5" />
                  
                  {/* Room Partitions */}
                  <line x1="340" y1="40" x2="340" y2="400" stroke="#475569" strokeWidth="2" />
                  <line x1="60" y1="220" x2="620" y2="220" stroke="#475569" strokeWidth="2" />
                  
                  {/* Room Names */}
                  <text x="200" y="70" fill="#64748b" fontSize="12" fontWeight="bold" textAnchor="middle">মাস্টার বেডরুম</text>
                  <text x="480" y="70" fill="#64748b" fontSize="12" fontWeight="bold" textAnchor="middle">লিভিং ও ডাইনিং</text>
                  <text x="200" y="250" fill="#64748b" fontSize="12" fontWeight="bold" textAnchor="middle">বেডরুম-২</text>
                  <text x="480" y="250" fill="#64748b" fontSize="12" fontWeight="bold" textAnchor="middle">কিচেন ও টয়লেট</text>

                  {/* Distribution Board (DB) */}
                  <rect x="330" y="195" width="20" height="30" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                  <text x="340" y="190" fill="#10b981" fontSize="10" fontWeight="bold" textAnchor="middle">DB Box</text>

                  {/* Ceiling Fans in rooms */}
                  {[
                    { cx: 200, cy: 130 },
                    { cx: 480, cy: 130 },
                    { cx: 200, cy: 310 },
                  ].map((p, i) => (
                    <g key={i}>
                      <circle cx={p.cx} cy={p.cy} r="16" fill="#f59e0b" fillOpacity="0.2" stroke="#f59e0b" strokeWidth="2" />
                      <line x1={p.cx - 10} y1={p.cy} x2={p.cx + 10} y2={p.cy} stroke="#f59e0b" strokeWidth="2" />
                      <line x1={p.cx} y1={p.cy - 10} x2={p.cx} y2={p.cy + 10} stroke="#f59e0b" strokeWidth="2" />
                    </g>
                  ))}

                  {/* Lights */}
                  {[
                    { cx: 120, cy: 90 }, { cx: 280, cy: 90 },
                    { cx: 400, cy: 90 }, { cx: 560, cy: 90 },
                    { cx: 120, cy: 270 }, { cx: 280, cy: 270 },
                    { cx: 480, cy: 310 }, // Kitchen
                  ].map((p, i) => (
                    <circle key={i} cx={p.cx} cy={p.cy} r="8" fill="#facc15" stroke="#ca8a04" strokeWidth="1.5" />
                  ))}

                  {/* Curved Wiring Conduits */}
                  <path d="M 330 210 Q 250 170 200 130" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 3" />
                  <path d="M 350 210 Q 420 170 480 130" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 3" />
                  <path d="M 330 220 Q 250 270 200 310" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 3" />

                  {/* Legend Badge */}
                  <text x="340" y="425" fill="#94a3b8" fontSize="11" textAnchor="middle">
                    230V সিঙ্গল ফেজ ওয়্যারিং লেআউট • সার্কিট ব্রেকার প্রটেকশনসহ
                  </text>
                </svg>
              )}

              {activeTab === 'plumbing' && (
                <svg width="680" height="440" viewBox="0 0 680 440" className="text-slate-200">
                  {/* Floor Outline */}
                  <rect x="60" y="40" width="560" height="360" fill="#0f172a" stroke="#475569" strokeWidth="2.5" />
                  <rect x="360" y="240" width="260" height="160" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
                  <text x="490" y="270" fill="#38bdf8" fontSize="12" fontWeight="bold" textAnchor="middle">বাথরুম ও কিচেন জোন</text>

                  {/* Overhead Tank Location */}
                  <rect x="80" y="60" width="70" height="50" fill="#0284c7" stroke="#38bdf8" strokeWidth="2" rx="4" />
                  <text x="115" y="88" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">Overhead Tank</text>

                  {/* Cold Water Supply Pipe */}
                  <path d="M 150 85 L 450 85 L 450 290" fill="none" stroke="#06b6d4" strokeWidth="4" />
                  <text x="300" y="78" fill="#06b6d4" fontSize="10" fontWeight="bold">ঠান্ডা পানি মেইন (1" CPVC)</text>

                  {/* Hot Water Geyser Line */}
                  <path d="M 450 290 L 530 290" fill="none" stroke="#ef4444" strokeWidth="3" />
                  <text x="500" y="310" fill="#ef4444" fontSize="10" fontWeight="bold">গরম পানি (PPR)</text>

                  {/* Toilet Soil Pipe to Septic */}
                  <path d="M 480 370 L 480 410 L 650 410" fill="none" stroke="#10b981" strokeWidth="5" />
                  <text x="560" y="425" fill="#10b981" fontSize="10" fontWeight="bold">স্যুয়ার পাইপ 4" (to Septic)</text>

                  {/* Kitchen Sink & Commode Points */}
                  <circle cx="450" cy="290" r="10" fill="#3b82f6" stroke="#ffffff" />
                  <circle cx="480" cy="370" r="12" fill="#10b981" stroke="#ffffff" />
                  <text x="480" y="374" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">WC</text>
                </svg>
              )}

              {activeTab === 'schedule' && (
                <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                  <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                    <Table className="w-4 h-4" /> ইলেকট্রিক্যাল ও প্লাম্বিং শিডিউল তালিকা
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left text-slate-300">
                      <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                        <tr>
                          <th className="p-2.5">উপাদান (Item)</th>
                          <th className="p-2.5">সাইজ / স্পেসিফিকেশন</th>
                          <th className="p-2.5">আনুমানিক সংখ্যা</th>
                          <th className="p-2.5">স্ট্যাটাস</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        <tr>
                          <td className="p-2.5 font-bold text-white">সিলিং ফ্যান</td>
                          <td className="p-2.5">56" Energy Saving</td>
                          <td className="p-2.5">{totalFans} টি</td>
                          <td className="p-2.5 text-emerald-400">নির্ধারিত</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-bold text-white">এলইডি লাইট</td>
                          <td className="p-2.5">18W / 12W Day Light</td>
                          <td className="p-2.5">{totalLights} টি</td>
                          <td className="p-2.5 text-emerald-400">নির্ধারিত</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-bold text-white">পাওয়ার সকেট (AC/Geyser)</td>
                          <td className="p-2.5">16A Heavy Duty</td>
                          <td className="p-2.5">{totalSockets} টি</td>
                          <td className="p-2.5 text-emerald-400">নির্ধারিত</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-bold text-white">ঠান্ডা পানির পাইপ</td>
                          <td className="p-2.5">3/4" CPVC Schedule 40</td>
                          <td className="p-2.5">{Math.round(totalPipeLength)} Rft</td>
                          <td className="p-2.5 text-cyan-400">স্ট্যান্ডার্ড</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-bold text-white">স্যুয়ারেজ বর্জ্য পাইপ / সেপ্টিক</td>
                          <td className="p-2.5">4" Class-D PVC Pipe</td>
                          <td className="p-2.5">{canvasSeptics.length > 0 ? `${canvasSeptics.length} টি ট্যাংক সংযুক্ত` : "1 টি ট্যাংক সংযুক্ত"}</td>
                          <td className="p-2.5 text-cyan-400">স্ট্যান্ডার্ড</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
