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
import { Download, Compass, Trees, Building2, Ruler } from 'lucide-react';

interface SitePlanSetbackProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  designObjects: any[];
  projectName?: string;
}

export function SitePlanSetbackDialog({
  open,
  onOpenChange,
  designObjects,
  projectName = 'AmarHome Project',
}: SitePlanSetbackProps) {
  // Auto-inherit building dimensions from canvas objects
  const minX = designObjects.length > 0 ? Math.min(...designObjects.map((o) => o.x)) : 0;
  const maxX = designObjects.length > 0 ? Math.max(...designObjects.map((o) => o.x + (o.w || 1))) : 40;
  const minY = designObjects.length > 0 ? Math.min(...designObjects.map((o) => o.y)) : 0;
  const maxY = designObjects.length > 0 ? Math.max(...designObjects.map((o) => o.y + (o.h || 1))) : 30;

  const buildingW = Math.max(20, Math.round(maxX - minX));
  const buildingL = Math.max(20, Math.round(maxY - minY));

  const [plotLength, setPlotLength] = useState(Math.max(50, buildingL + 15)); // ft
  const [plotWidth, setPlotWidth] = useState(Math.max(35, buildingW + 10)); // ft
  const [roadWidth, setRoadWidth] = useState(20); // ft
  const [ruleType, setRuleType] = useState<'rajuk' | 'pourashava'>('rajuk');

  // Setback rules (BNBC / Rajuk standard)
  const frontSetback = roadWidth >= 20 ? 5 : 6;
  const rearSetback = 4;
  const sideSetback = 3;

  const totalPlotArea = plotLength * plotWidth; // sqft
  const buildableLength = Math.max(0, plotLength - frontSetback - rearSetback);
  const buildableWidth = Math.max(0, plotWidth - sideSetback * 2);
  const buildableArea = buildableLength * buildableWidth;
  const mgcPercent = totalPlotArea > 0 ? ((buildableArea / totalPlotArea) * 100).toFixed(1) : '0';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[92vh] p-0 flex flex-col bg-slate-900 text-slate-100 border-slate-800 shadow-2xl rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base md:text-lg font-black text-white flex items-center gap-2">
                Site Plan & Municipal Setback Studio
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                  পৌরসভা ও রাজউক ইমারত বিধিমালা
                </span>
              </DialogTitle>
              <p className="text-xs text-slate-400">
                {projectName} • অটো-স্পেস ছাড়, সাইট প্ল্যান ও সর্বোচ্চ বিল্ড-যোগ্য এলাকা
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => window.print()}
            className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> সাইট প্ল্যান এক্সপোর্ট
          </Button>
        </div>

        {/* Main Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Settings sidebar */}
          <div className="w-72 border-r border-slate-800 bg-slate-950 p-4 space-y-4 shrink-0 text-xs">
            <div className="font-bold text-slate-300 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-800 flex items-center justify-between">
              <span>জমির পরিমাপ ও রাস্তা</span>
              <Ruler className="w-3.5 h-3.5 text-emerald-400" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-400">বিধিমালা টাইপ</Label>
              <Select value={ruleType} onValueChange={(v: any) => setRuleType(v)}>
                <SelectTrigger className="h-8 bg-slate-900 border-slate-700 text-white font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="rajuk">রাজউক (RAJUK Rules 2008/2024)</SelectItem>
                  <SelectItem value="pourashava">পৌরসভা / সিটি কর্পোরেশন</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-400">জমির দৈর্ঘ্য (ft)</Label>
              <Input
                type="number"
                value={plotLength}
                onChange={(e) => setPlotLength(parseFloat(e.target.value) || 30)}
                className="h-8 bg-slate-900 border-slate-700 text-white font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-400">জমির প্রস্থ (ft)</Label>
              <Input
                type="number"
                value={plotWidth}
                onChange={(e) => setPlotWidth(parseFloat(e.target.value) || 20)}
                className="h-8 bg-slate-900 border-slate-700 text-white font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-400">সামনের রাস্তার প্রস্থ (Road Width ft)</Label>
              <Select
                value={roadWidth.toString()}
                onValueChange={(v) => setRoadWidth(parseInt(v))}
              >
                <SelectTrigger className="h-8 bg-slate-900 border-slate-700 text-white font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="10">১০ ফিট গলি</SelectItem>
                  <SelectItem value="12">১২ ফিট রাস্তা</SelectItem>
                  <SelectItem value="16">১৬ ফিট রাস্তা</SelectItem>
                  <SelectItem value="20">২০ ফিট প্রধান সড়ক</SelectItem>
                  <SelectItem value="30">৩০ ফিট প্রশস্ত রাস্তা</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Calculations Card */}
            <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2 text-slate-300">
              <p className="font-bold text-emerald-400 text-xs flex items-center gap-1.5">
                <Building2 className="w-4 h-4" /> সাইট অ্যানালাইসিস
              </p>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">মোট জমির ক্ষেত্রফল:</span>
                <span className="font-mono font-bold text-white">{totalPlotArea} Sq.ft</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">কাঠা পরিমাপ:</span>
                <span className="font-mono font-bold text-amber-400">
                  {(totalPlotArea / 720).toFixed(2)} কাঠা
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">সামনে ছাড় (Front):</span>
                <span className="font-mono font-bold text-emerald-400">{frontSetback} ft</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">পেছনে ছাড় (Rear):</span>
                <span className="font-mono font-bold text-emerald-400">{rearSetback} ft</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">উভয় পাশে ছাড় (Sides):</span>
                <span className="font-mono font-bold text-emerald-400">{sideSetback} ft</span>
              </div>
              <div className="flex justify-between pt-1 font-bold text-white">
                <span>সর্বোচ্চ ভবন কভারেজ (MGC):</span>
                <span className="text-blue-400 font-mono">{mgcPercent}%</span>
              </div>
            </div>
          </div>

          {/* 2D Site Plan CAD Display */}
          <div className="flex-1 bg-slate-900/60 p-6 overflow-auto flex items-center justify-center">
            <div
              className="w-full h-full min-w-[700px] min-h-[500px] flex items-center justify-center relative border border-slate-800 rounded-xl bg-slate-950 shadow-inner"
              style={{
                backgroundImage:
                  'radial-gradient(circle, #334155 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
            >
              <svg width="680" height="460" viewBox="0 0 680 460" className="text-slate-200">
                {/* North Arrow */}
                <g transform="translate(60, 60)">
                  <circle cx="0" cy="0" r="22" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
                  <path d="M 0 -18 L 6 8 L 0 4 L -6 8 Z" fill="#ef4444" />
                  <text x="0" y="-24" fill="#ef4444" fontSize="11" fontWeight="black" textAnchor="middle">N</text>
                </g>

                {/* Road Line */}
                <rect x="120" y="30" width="460" height="60" fill="#334155" stroke="#64748b" strokeWidth="2" />
                <line x1="130" y1="60" x2="570" y2="60" stroke="#f59e0b" strokeWidth="2" strokeDasharray="8 6" />
                <text x="350" y="55" fill="#f8fafc" fontSize="12" fontWeight="bold" textAnchor="middle">
                  {roadWidth}'-0" WIDE ROAD (প্রধান রাস্তা)
                </text>

                {/* Outer Plot Boundary */}
                <rect x="160" y="110" width="380" height="310" fill="#0f172a" stroke="#10b981" strokeWidth="3" />
                <text x="350" y="102" fill="#10b981" fontSize="11" fontWeight="bold" textAnchor="middle">
                  প্লট সীমানা ({plotWidth}' x {plotLength}')
                </text>

                {/* Setback Dashed Zones */}
                {/* Front */}
                <rect x="160" y="110" width="380" height="40" fill="#f59e0b" fillOpacity="0.1" stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 3" />
                <text x="350" y="135" fill="#f59e0b" fontSize="10" fontWeight="bold" textAnchor="middle">
                  সামনে ছাড় {frontSetback}'-0"
                </text>

                {/* Rear */}
                <rect x="160" y="380" width="380" height="40" fill="#f59e0b" fillOpacity="0.1" stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 3" />
                <text x="350" y="405" fill="#f59e0b" fontSize="10" fontWeight="bold" textAnchor="middle">
                  পেছনে ছাড় {rearSetback}'-0"
                </text>

                {/* Left Side */}
                <rect x="160" y="150" width="35" height="230" fill="#f59e0b" fillOpacity="0.1" stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 3" />
                <text x="177" y="270" fill="#f59e0b" fontSize="9" fontWeight="bold" transform="rotate(-90 177 270)">
                  সাইড {sideSetback}'
                </text>

                {/* Right Side */}
                <rect x="505" y="150" width="35" height="230" fill="#f59e0b" fillOpacity="0.1" stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 3" />
                <text x="522" y="270" fill="#f59e0b" fontSize="9" fontWeight="bold" transform="rotate(90 522 270)">
                  সাইড {sideSetback}'
                </text>

                {/* Maximum Buildable Footprint */}
                <rect x="195" y="150" width="310" height="230" fill="#1e293b" stroke="#38bdf8" strokeWidth="2.5" />
                <text x="350" y="250" fill="#38bdf8" fontSize="14" fontWeight="black" textAnchor="middle">
                  বিল্ড-যোগ্য এলাকা (MGC)
                </text>
                <text x="350" y="275" fill="#94a3b8" fontSize="11" textAnchor="middle">
                  {buildableWidth}' x {buildableLength}' ({buildableArea} Sq.ft)
                </text>

                {/* Greenery / Landscaping Accent */}
                <circle cx="177" cy="130" r="10" fill="#10b981" />
                <circle cx="522" cy="130" r="10" fill="#10b981" />
                <text x="350" y="320" fill="#10b981" fontSize="10" textAnchor="middle">
                  বাগান / ড্রাইভওয়ে এরিয়া
                </text>
              </svg>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
