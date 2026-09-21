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
  Armchair,
  Trees,
  Download,
  Bed,
  Utensils,
  Flower2,
  Car,
  SunMedium,
} from 'lucide-react';

interface InteriorLandscapeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  designObjects: any[];
  projectName?: string;
}

export function InteriorLandscapeDialog({
  open,
  onOpenChange,
  designObjects,
  projectName = 'AmarHome Project',
}: InteriorLandscapeProps) {
  const [activeTab, setActiveTab] = useState<'interior' | 'landscape'>('interior');
  const [roomType, setRoomType] = useState<'masterBed' | 'living' | 'kitchen'>('masterBed');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[92vh] p-0 flex flex-col bg-slate-900 text-slate-100 border-slate-800 shadow-2xl rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-pink-600/20 text-pink-400 border border-pink-500/30">
              <Armchair className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base md:text-lg font-black text-white flex items-center gap-2">
                Interior & Landscape Architecture Studio
                <span className="text-xs px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-400 font-bold border border-pink-500/30">
                  ফার্নিচার ও রুফটপ ল্যান্ডস্কেপিং
                </span>
              </DialogTitle>
              <p className="text-xs text-slate-400">
                {projectName} • ২ডি ইন্টেরিয়র ফার্নিচার প্লেসমেন্ট, ফলস সিলিং ও ছাদবাগান ড্রয়িং
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => window.print()}
            className="h-8 text-xs font-bold bg-pink-600 hover:bg-pink-500 text-white gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> ডিজাইন এক্সপোর্ট
          </Button>
        </div>

        {/* Tab Selection */}
        <div className="bg-slate-950 px-6 pt-2 border-b border-slate-800">
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
            <TabsList className="bg-slate-900 p-1 border border-slate-800 h-auto flex gap-1">
              <TabsTrigger
                value="interior"
                className="text-xs font-bold py-1.5 data-[state=active]:bg-pink-600 data-[state=active]:text-white flex items-center gap-1.5"
              >
                <Armchair className="w-3.5 h-3.5" /> ১. ইন্টেরিয়র ফার্নিচার লেআউট
              </TabsTrigger>
              <TabsTrigger
                value="landscape"
                className="text-xs font-bold py-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white flex items-center gap-1.5"
              >
                <Trees className="w-3.5 h-3.5" /> ২. ল্যান্ডস্কেপ ও ছাদবাগান (Terrace Garden)
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Workspace */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Palette */}
          <div className="w-64 border-r border-slate-800 bg-slate-950 p-4 space-y-4 shrink-0 text-xs">
            {activeTab === 'interior' && (
              <>
                <div className="font-bold text-slate-300 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-800">
                  রুম ক্যাটাগরি
                </div>
                <div className="space-y-1.5">
                  <Button
                    variant={roomType === 'masterBed' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRoomType('masterBed')}
                    className="w-full justify-start gap-2 h-8 text-xs font-bold"
                  >
                    <Bed className="w-4 h-4" /> মাস্টার বেডরুম
                  </Button>
                  <Button
                    variant={roomType === 'living' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRoomType('living')}
                    className="w-full justify-start gap-2 h-8 text-xs font-bold"
                  >
                    <Armchair className="w-4 h-4" /> ড্রয়িং ও লিভিং স্পেস
                  </Button>
                  <Button
                    variant={roomType === 'kitchen' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRoomType('kitchen')}
                    className="w-full justify-start gap-2 h-8 text-xs font-bold"
                  >
                    <Utensils className="w-4 h-4" /> মডার্ন কিচেন লেআউট
                  </Button>
                </div>
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1.5 text-slate-400 text-[11px]">
                  <p className="font-semibold text-slate-200">আর্কিটেকচারাল মাপ:</p>
                  <p>• কিং বেড: 6'-0" x 6'-6"</p>
                  <p>• সাইড টেবিল: 1'-6" x 1'-6"</p>
                  <p>• ওয়ারড্রব: 2'-0" ডেপথ</p>
                </div>
              </>
            )}

            {activeTab === 'landscape' && (
              <>
                <div className="font-bold text-slate-300 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-800">
                  ল্যান্ডস্কেপ উপাদান
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 bg-slate-900 rounded border border-slate-800">
                    <Flower2 className="w-4 h-4 text-emerald-400" />
                    <span>প্ল্যান্টেশন বেড (ফুলবাগান)</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-slate-900 rounded border border-slate-800">
                    <SunMedium className="w-4 h-4 text-amber-400" />
                    <span>সিটিং ও পারগোলা জোন</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-slate-900 rounded border border-slate-800">
                    <Car className="w-4 h-4 text-blue-400" />
                    <span>পেভমেন্ট ও কার পার্কিং স্পট</span>
                  </div>
                </div>
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1 text-slate-400 text-[11px]">
                  <p className="font-semibold text-slate-200">ছাদবাগান সুরক্ষা:</p>
                  <p>• ওয়াটারপ্রুফিং মেমব্রেন</p>
                  <p>• ড্রেনেজ সেল ও জিওটেক্সটাইল ফিল্টার</p>
                </div>
              </>
            )}
          </div>

          {/* Canvas Display */}
          <div className="flex-1 bg-slate-900/60 p-6 overflow-auto flex items-center justify-center">
            <div
              className="w-full h-full min-w-[700px] min-h-[500px] flex items-center justify-center relative border border-slate-800 rounded-xl bg-slate-950 shadow-inner"
              style={{
                backgroundImage:
                  'radial-gradient(circle, #334155 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
            >
              {activeTab === 'interior' && (
                <svg width="660" height="420" viewBox="0 0 660 420" className="text-slate-200">
                  {roomType === 'masterBed' && (
                    <g>
                      {/* Room Wall */}
                      <rect x="80" y="40" width="500" height="340" fill="#0f172a" stroke="#38bdf8" strokeWidth="3" />
                      
                      {/* King Bed with Pillows */}
                      <rect x="230" y="50" width="200" height="220" rx="6" fill="#1e293b" stroke="#f43f5e" strokeWidth="2" />
                      <rect x="250" y="60" width="60" height="35" rx="3" fill="#334155" />
                      <rect x="350" y="60" width="60" height="35" rx="3" fill="#334155" />
                      <text x="330" y="170" fill="#f43f5e" fontSize="13" fontWeight="bold" textAnchor="middle">KING BED (6' x 6.5')</text>

                      {/* Side Tables */}
                      <rect x="175" y="50" width="45" height="45" fill="#334155" stroke="#94a3b8" />
                      <rect x="440" y="50" width="45" height="45" fill="#334155" stroke="#94a3b8" />

                      {/* Wardrobe */}
                      <rect x="90" y="120" width="50" height="220" fill="#1e293b" stroke="#a855f7" strokeWidth="2" />
                      <text x="115" y="235" fill="#a855f7" fontSize="11" fontWeight="bold" transform="rotate(-90 115 235)">WARDROBE (2' Deep)</text>

                      {/* TV Unit & Console */}
                      <rect x="250" y="350" width="160" height="25" fill="#1e293b" stroke="#38bdf8" />
                      <text x="330" y="367" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle">TV CONSOLE</text>
                    </g>
                  )}

                  {roomType === 'living' && (
                    <g>
                      <rect x="80" y="40" width="500" height="340" fill="#0f172a" stroke="#38bdf8" strokeWidth="3" />
                      {/* L-Shaped Sofa */}
                      <path
                        d="M 120 80 L 300 80 L 300 140 L 180 140 L 180 260 L 120 260 Z"
                        fill="#1e293b"
                        stroke="#10b981"
                        strokeWidth="2"
                      />
                      <text x="210" y="115" fill="#10b981" fontSize="12" fontWeight="bold">L-SOFA SET</text>

                      {/* Coffee Table */}
                      <rect x="220" y="170" width="100" height="60" rx="4" fill="#334155" stroke="#f59e0b" strokeWidth="1.5" />
                      <text x="270" y="205" fill="#f59e0b" fontSize="10" textAnchor="middle">Center Table</text>

                      {/* Dining Table with 6 Chairs */}
                      <rect x="400" y="130" width="120" height="160" rx="8" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                      <text x="460" y="215" fill="#38bdf8" fontSize="11" fontWeight="bold" textAnchor="middle">DINING (6-Seater)</text>
                      {[150, 210, 270].map((y) => (
                        <g key={y}>
                          <rect x="375" y={y - 12} width="18" height="24" rx="3" fill="#64748b" />
                          <rect x="527" y={y - 12} width="18" height="24" rx="3" fill="#64748b" />
                        </g>
                      ))}
                    </g>
                  )}

                  {roomType === 'kitchen' && (
                    <g>
                      <rect x="80" y="40" width="500" height="340" fill="#0f172a" stroke="#38bdf8" strokeWidth="3" />
                      {/* L-Countertop */}
                      <path
                        d="M 90 50 L 560 50 L 560 110 L 160 110 L 160 360 L 90 360 Z"
                        fill="#1e293b"
                        stroke="#f59e0b"
                        strokeWidth="2.5"
                      />
                      <text x="280" y="85" fill="#f59e0b" fontSize="12" fontWeight="bold">KITCHEN COUNTERTOP (2'-0" Wide)</text>

                      {/* Sink */}
                      <rect x="450" y="60" width="80" height="40" rx="4" fill="#0284c7" stroke="#ffffff" />
                      <text x="490" y="85" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">SINK</text>

                      {/* Gas Cooktop */}
                      <rect x="220" y="60" width="70" height="40" rx="4" fill="#ef4444" />
                      <circle cx="240" cy="80" r="10" fill="#ffffff" />
                      <circle cx="270" cy="80" r="10" fill="#ffffff" />
                      <text x="255" y="125" fill="#ef4444" fontSize="9" textAnchor="middle">BURNER</text>

                      {/* Refrigerator */}
                      <rect x="100" y="270" width="50" height="60" fill="#475569" stroke="#ffffff" strokeWidth="1.5" />
                      <text x="125" y="305" fill="#ffffff" fontSize="9" textAnchor="middle">FRIDGE</text>
                    </g>
                  )}
                </svg>
              )}

              {activeTab === 'landscape' && (
                <svg width="660" height="420" viewBox="0 0 660 420" className="text-slate-200">
                  {/* Roof Terrace Boundary */}
                  <rect x="60" y="40" width="540" height="340" fill="#064e3b" fillOpacity="0.3" stroke="#10b981" strokeWidth="3" />
                  
                  {/* Paved Walkway */}
                  <path d="M 60 200 L 600 200" stroke="#94a3b8" strokeWidth="40" strokeDasharray="10 2" />
                  <text x="330" y="205" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">PAVER WALKWAY (পেভমেন্ট ওয়াকওয়ে)</text>

                  {/* Planter Beds */}
                  <rect x="80" y="60" width="220" height="50" rx="6" fill="#047857" stroke="#10b981" strokeWidth="2" />
                  <text x="190" y="90" fill="#a7f3d0" fontSize="11" fontWeight="bold" textAnchor="middle">গাছপালা ও ফুলের বেড (Flower Bed)</text>

                  <rect x="360" y="60" width="220" height="50" rx="6" fill="#047857" stroke="#10b981" strokeWidth="2" />
                  <text x="470" y="90" fill="#a7f3d0" fontSize="11" fontWeight="bold" textAnchor="middle">হাইড্রোপনিক কিচেন গার্ডেন</text>

                  {/* Pergola / Seating Zone */}
                  <rect x="80" y="260" width="180" height="100" rx="8" fill="#78350f" fillOpacity="0.4" stroke="#f59e0b" strokeWidth="2" />
                  {[90, 120, 150, 180, 210, 240].map((x) => (
                    <line key={x} x1={x} y1="260" x2={x} y2="360" stroke="#f59e0b" strokeWidth="1.5" />
                  ))}
                  <text x="170" y="315" fill="#fcd34d" fontSize="11" fontWeight="bold" textAnchor="middle">PERGOLA SEATING</text>

                  {/* Grass Lawn Area */}
                  <rect x="340" y="250" width="240" height="110" rx="8" fill="#065f46" stroke="#34d399" strokeWidth="1.5" />
                  <text x="460" y="310" fill="#6ee7b7" fontSize="12" fontWeight="bold" textAnchor="middle">গ্রিন লন এরিয়া (Turf Grass)</text>
                </svg>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
