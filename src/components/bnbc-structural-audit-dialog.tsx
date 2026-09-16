"use client";

import React, { useState, useMemo } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Info, 
  Building2, 
  Layers, 
  Activity, 
  Wind, 
  Ruler, 
  FileCheck2,
  HardHat
} from "lucide-react";

interface DesignObject {
  id: string;
  type: string;
  subType: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface BnbcStructuralAuditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  designObjects: DesignObject[];
  projectName: string;
}

export function BnbcStructuralAuditDialog({
  open,
  onOpenChange,
  designObjects,
  projectName
}: BnbcStructuralAuditDialogProps) {
  const [activeTab, setActiveTab] = useState("audit");
  
  // Soil Calculator State
  const [soilBearingCapacity, setSoilBearingCapacity] = useState<string>("1.5"); // ton/sqft
  const [buildingStoreys, setBuildingStoreys] = useState<string>("3"); // 3-storey (G+2)
  const [columnLoadCategory, setColumnLoadCategory] = useState<string>("residential");

  // Filter components
  const pillars = useMemo(() => designObjects.filter(o => o.subType === 'pillar'), [designObjects]);
  const stairs = useMemo(() => designObjects.filter(o => o.type === 'stair'), [designObjects]);
  const windows = useMemo(() => designObjects.filter(o => o.type === 'opening' && o.subType === 'window'), [designObjects]);
  const structures = useMemo(() => designObjects.filter(o => o.type === 'structure' || o.type === 'room'), [designObjects]);

  // Compute total built-up floor area estimate
  const estimatedFloorArea = useMemo(() => {
    if (structures.length === 0) return 600;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    structures.forEach(s => {
      minX = Math.min(minX, s.x);
      maxX = Math.max(maxX, s.x + s.w);
      minY = Math.min(minY, s.y);
      maxY = Math.max(maxY, s.y + s.h);
    });
    const spanW = maxX - minX;
    const spanH = maxY - minY;
    return Math.max(200, Math.round(spanW * spanH * 0.75));
  }, [structures]);

  // Analyze Column Spans (Pillar-to-Pillar distances)
  const columnSpanAnalysis = useMemo(() => {
    const TOL = 1.2;
    const issues: { message: string; severity: 'warning' | 'danger' | 'info'; distance: number; p1: string; p2: string }[] = [];
    let maxDistance = 0;
    let checkedPairs = 0;

    // Group horizontal
    const yGroups: { y: number, items: DesignObject[] }[] = [];
    pillars.forEach(p => { 
      let g = yGroups.find(gr => Math.abs(gr.y - p.y) < TOL); 
      if (g) g.items.push(p); 
      else yGroups.push({ y: p.y, items: [p] }); 
    });

    yGroups.forEach(g => {
      const sorted = [...g.items].sort((a, b) => a.x - b.x);
      for (let i = 0; i < sorted.length - 1; i++) {
        const p1 = sorted[i], p2 = sorted[i+1];
        const dist = Math.abs((p2.x + p2.w/2) - (p1.x + p1.w/2));
        checkedPairs++;
        maxDistance = Math.max(maxDistance, dist);
        if (dist > 18) {
          issues.push({
            message: `কলাম স্প্যান অতিরিক্ত দীর্ঘ (${dist.toFixed(1)} ফুট)। BNBC মানদণ্ডে সাধারণ বীমে ১৮ ফুটের বেশি স্প্যান ঝুঁকিপূর্ণ।`,
            severity: 'danger',
            distance: dist,
            p1: p1.id,
            p2: p2.id
          });
        } else if (dist > 15) {
          issues.push({
            message: `কলাম স্প্যান মধ্যম-দীর্ঘ (${dist.toFixed(1)} ফুট)। ১০"×১৫" সাইজের গভীর ড্রপ বিম (Drop Beam) ব্যবহার আবশ্যক।`,
            severity: 'warning',
            distance: dist,
            p1: p1.id,
            p2: p2.id
          });
        } else if (dist < 7 && dist > 0.5) {
          issues.push({
            message: `কলাম দুটি অতি নিকটে অবস্থিত (${dist.toFixed(1)} ফুট)। অতিরিক্ত কলাম অপসারণ করে খরচ কমানো সম্ভব।`,
            severity: 'info',
            distance: dist,
            p1: p1.id,
            p2: p2.id
          });
        }
      }
    });

    return { issues, maxDistance, checkedPairs };
  }, [pillars]);

  // Analyze Stair Width Compliance (BNBC Part 4, Clause 3.3.4: Min 3'3" for residential)
  const stairAnalysis = useMemo(() => {
    const issues: { message: string; severity: 'warning' | 'danger' | 'success' }[] = [];
    if (stairs.length === 0) {
      return { issues: [{ message: "ড্রয়িংয়ে এখনো কোনো সিঁড়ি যোগ করা হয়নি। দোতলা বা বহুতলের ক্ষেত্রে প্রধান সিঁড়ি বাধ্যতামূলক।", severity: 'warning' as const }], compliant: false };
    }

    let allCompliant = true;
    stairs.forEach((s, idx) => {
      const width = Math.min(s.w, s.h);
      if (width < 3.0) {
        allCompliant = false;
        issues.push({
          message: `সিঁড়ি #${idx + 1} এর প্রস্থ মাত্র ${width.toFixed(1)} ফুট। BNBC কোড অনুযায়ী জরুরি নির্গমন সিঁড়ির সর্বনিম্ন প্রস্থ ৩ ফুট ৩ ইঞ্চি (১ মিটার) হওয়া আবশ্যক।`,
          severity: 'danger'
        });
      } else if (width < 3.25) {
        issues.push({
          message: `সিঁড়ি #${idx + 1} এর প্রস্থ ${width.toFixed(1)} ফুট। এটি কার্যকর হলেও আদর্শ ৩'৩" করার পরামর্শ দেওয়া হচ্ছে।`,
          severity: 'warning'
        });
      } else {
        issues.push({
          message: `সিঁড়ি #${idx + 1} এর প্রস্থ ${width.toFixed(1)} ফুট। এটি BNBC অগ্নি-নিরাপত্তা ও জরুরি নির্গমন বিধিমালার সাথে সম্পূর্ণ সংগতিপূর্ণ।`,
          severity: 'success'
        });
      }
    });

    return { issues, compliant: allCompliant };
  }, [stairs]);

  // Analyze Natural Light & Ventilation (BNBC Window area >= 10% of floor area)
  const ventilationAnalysis = useMemo(() => {
    const totalWindowArea = windows.reduce((acc, w) => acc + (w.w * (w.h > 1 ? w.h : 4.5)), 0);
    const requiredWindowArea = estimatedFloorArea * 0.10;
    const windowRatioPct = estimatedFloorArea > 0 ? (totalWindowArea / estimatedFloorArea) * 100 : 0;

    let status: 'good' | 'warning' | 'danger' = 'good';
    let message = "";

    if (windows.length === 0) {
      status = 'danger';
      message = "পর্যাপ্ত জানালা নেই! BNBC পার্ট ৩ অনুযায়ী বাসযোগ্য প্রতিটি কক্ষে কমপক্ষে ১০% আলো-বাতাস নিশ্চিত করতে হবে।";
    } else if (windowRatioPct < 8) {
      status = 'danger';
      message = `বর্তমান জানালার ক্ষেত্রফল মেঝের মাত্র ${windowRatioPct.toFixed(1)}%। BNBC মানদণ্ড পূরণে আরও জানালা যোগ করা আবশ্যক (কমপক্ষে ১০% প্রয়োজন)।`;
    } else if (windowRatioPct < 10) {
      status = 'warning';
      message = `জানালার আলো-বাতাস অনুপাত ${windowRatioPct.toFixed(1)}%। মানদণ্ডের খুব কাছাকাছি, বাতাস চলাচলের জন্য আরও ১-২টি ক্রস-ভেন্টিলেশন জানালা সুপারিশ করা হলো।`;
    } else {
      status = 'good';
      message = `জানালার আলো-বাতাস অনুপাত ${windowRatioPct.toFixed(1)}%। এটি BNBC স্বাস্থ্যসম্মত আলো ও প্রাকৃতিক বায়ুচলাচল বিধিমালার সাথে সংগতিপূর্ণ।`;
    }

    return { totalWindowArea, requiredWindowArea, windowRatioPct, status, message };
  }, [windows, estimatedFloorArea]);

  // Safety Score (0 - 100)
  const safetyScore = useMemo(() => {
    let score = 95;
    if (pillars.length === 0) score -= 30;
    if (columnSpanAnalysis.issues.some(i => i.severity === 'danger')) score -= 25;
    if (columnSpanAnalysis.issues.some(i => i.severity === 'warning')) score -= 10;
    if (!stairAnalysis.compliant && stairs.length > 0) score -= 15;
    if (ventilationAnalysis.status === 'danger') score -= 15;
    if (ventilationAnalysis.status === 'warning') score -= 5;
    return Math.max(25, Math.min(100, score));
  }, [pillars, columnSpanAnalysis, stairAnalysis, ventilationAnalysis]);

  // Soil & Storey Engineering Calculator
  const engineeringCalc = useMemo(() => {
    const sbc = parseFloat(soilBearingCapacity) || 1.5; // tons/sqft
    const storeys = parseInt(buildingStoreys) || 3;
    
    // Average axial column load estimation (tonnes)
    // Tributary area ~140 sqft per column * (dead load + live load ~ 180 psf per storey)
    const tributaryArea = 140; // sq.ft
    const loadPerStorey = (tributaryArea * 0.17); // ~24 tons per storey with safety factor
    const totalColumnLoadTons = Math.round(loadPerStorey * storeys * 1.25); // including self weight & factor of safety

    // Required Footing Area = Load / SBC
    const reqFootingAreaSqft = totalColumnLoadTons / sbc;
    const footingSideFt = Math.ceil(Math.sqrt(reqFootingAreaSqft) * 2) / 2; // round to nearest 0.5 ft
    const footingThickIn = Math.min(26, Math.max(12, Math.round(10 + storeys * 2.5)));

    // Column Dimensions recommendation
    let colSize = '10" × 10"';
    let rebarSpec = '4-16mm (4 Suta Rebar)';
    if (storeys === 1) {
      colSize = '10" × 10"';
      rebarSpec = '4-16mm 500W Rod';
    } else if (storeys === 2) {
      colSize = '10" × 12"';
      rebarSpec = '6-16mm 500W Rod';
    } else if (storeys === 3) {
      colSize = '10" × 15"';
      rebarSpec = '6-16mm + 2-12mm 500W Rod';
    } else if (storeys === 4) {
      colSize = '12" × 15"';
      rebarSpec = '8-16mm 500W Rod';
    } else if (storeys >= 5) {
      colSize = '12" × 18"';
      rebarSpec = '8-20mm 500W Rod';
    }

    return {
      totalColumnLoadTons,
      reqFootingAreaSqft: Math.round(reqFootingAreaSqft * 10) / 10,
      footingSideFt,
      footingThickIn,
      colSize,
      rebarSpec
    };
  }, [soilBearingCapacity, buildingStoreys]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-white rounded-2xl border shadow-2xl p-0 overflow-hidden flex flex-col max-h-[92vh]">
        <DialogHeader className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <DialogTitle className="text-base md:text-lg font-black text-white flex items-center gap-2">
                  BNBC কোড ও স্ট্রাকচারাল সেফটি অডিটর (AI Compliance)
                </DialogTitle>
                <DialogDescription className="text-slate-300 text-xs mt-0.5">
                  বাংলাদেশ ন্যাশনাল বিল্ডিং কোড (BNBC) অনুযায়ী কাঠামোগত নিরাপত্তা যাচাই ও সয়েল লোড ক্যালকুলেশন
                </DialogDescription>
              </div>
            </div>
            
            {/* Safety Score Pill */}
            <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
              <span className="text-[10px] font-bold text-slate-300 uppercase">সেফটি স্কোর:</span>
              <span className={`text-base font-black ${safetyScore >= 80 ? "text-emerald-400" : safetyScore >= 60 ? "text-amber-400" : "text-red-400"}`}>
                {safetyScore}%
              </span>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-5 pt-3 bg-slate-50 border-b shrink-0">
            <TabsList className="bg-slate-200/80 p-1 gap-1">
              <TabsTrigger value="audit" className="text-xs font-bold gap-1.5 data-[state=active]:bg-white">
                <Activity className="w-3.5 h-3.5 text-blue-600" /> লাইভ BNBC অডিট
              </TabsTrigger>
              <TabsTrigger value="soil" className="text-xs font-bold gap-1.5 data-[state=active]:bg-white">
                <Layers className="w-3.5 h-3.5 text-emerald-600" /> সয়েল টেস্ট ও লোড ক্যালকুলেটর
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* TAB 1: LIVE BNBC AUDIT */}
            <TabsContent value="audit" className="m-0 space-y-4">
              {/* Quick Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">কলাম সংখ্যা</span>
                  <span className="text-base font-black text-slate-800">{pillars.length} টি</span>
                  <span className="text-[10px] text-slate-500 block">সর্বোচ্চ স্প্যান: {columnSpanAnalysis.maxDistance.toFixed(1)}'</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">সিঁড়ি উইডথ</span>
                  <span className="text-base font-black text-slate-800">
                    {stairs.length > 0 ? `${Math.min(stairs[0].w, stairs[0].h).toFixed(1)}'` : "নাই"}
                  </span>
                  <span className={`text-[10px] font-bold block ${stairAnalysis.compliant ? "text-emerald-600" : "text-amber-600"}`}>
                    {stairAnalysis.compliant ? "BNBC সম্মত" : "পর্যালোচনা প্রয়োজন"}
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">জানালা ও বাতাস</span>
                  <span className="text-base font-black text-slate-800">{ventilationAnalysis.windowRatioPct.toFixed(1)}%</span>
                  <span className={`text-[10px] font-bold block ${ventilationAnalysis.status === 'good' ? "text-emerald-600" : "text-amber-600"}`}>
                    {ventilationAnalysis.status === 'good' ? "পর্যাপ্ত ভেন্টিলেশন" : "ঘাটতি রয়েছে"}
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">আনুমানিক ফ্লোর</span>
                  <span className="text-base font-black text-slate-800">{estimatedFloorArea} Sq.ft</span>
                  <span className="text-[10px] text-slate-500 block">({(estimatedFloorArea * 0.0929).toFixed(1)} m²)</span>
                </div>
              </div>

              {/* 1. Column Span Check */}
              <div className="border rounded-xl p-4 bg-white shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-800 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-indigo-600" /> ১. কলামের দূরত্ব ও বিম স্প্যান বিশ্লেষণ (Column Spans)
                  </h4>
                  <span className="text-[10px] text-slate-500 font-medium">BNBC Section 6: RCC Structure</span>
                </div>

                {columnSpanAnalysis.issues.length === 0 ? (
                  <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-800 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>কলামের দূরত্ব নিরাপদ সীমার মধ্যে রয়েছে (সবগুলো স্প্যান ১৮ ফুটের নিচে)। অতিরিক্ত ডিফ্লেকশন বা ক্র্যাকিং ঝুঁকি নেই।</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {columnSpanAnalysis.issues.map((iss, i) => (
                      <div 
                        key={i} 
                        className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs leading-relaxed ${
                          iss.severity === 'danger' 
                            ? "bg-red-50 border-red-200 text-red-900" 
                            : iss.severity === 'warning'
                            ? "bg-amber-50 border-amber-200 text-amber-900"
                            : "bg-blue-50 border-blue-200 text-blue-900"
                        }`}
                      >
                        {iss.severity === 'danger' ? (
                          <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        ) : iss.severity === 'warning' ? (
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        ) : (
                          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        )}
                        <span>{iss.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Staircase Compliance */}
              <div className="border rounded-xl p-4 bg-white shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-800 flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-purple-600" /> ২. সিঁড়ির মাপ ও জরুরি নির্গমন নিরাপত্তা (Stairway Egress)
                  </h4>
                  <span className="text-[10px] text-slate-500 font-medium">BNBC Part 4, Clause 3.3.4</span>
                </div>

                <div className="space-y-2">
                  {stairAnalysis.issues.map((iss, i) => (
                    <div 
                      key={i} 
                      className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs leading-relaxed ${
                        iss.severity === 'danger' 
                          ? "bg-red-50 border-red-200 text-red-900" 
                          : iss.severity === 'warning'
                          ? "bg-amber-50 border-amber-200 text-amber-900"
                          : "bg-emerald-50 border-emerald-200 text-emerald-900"
                      }`}
                    >
                      {iss.severity === 'danger' ? (
                        <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      ) : iss.severity === 'warning' ? (
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      )}
                      <span>{iss.message}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Natural Ventilation */}
              <div className="border rounded-xl p-4 bg-white shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-800 flex items-center gap-2">
                    <Wind className="w-4 h-4 text-sky-600" /> ৩. প্রাকৃতিক আলো ও বায়ুচলাচল অনুপাত (Ventilation Ratio)
                  </h4>
                  <span className="text-[10px] text-slate-500 font-medium">BNBC Part 3: Light & Ventilation</span>
                </div>

                <div 
                  className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs leading-relaxed ${
                    ventilationAnalysis.status === 'danger' 
                      ? "bg-red-50 border-red-200 text-red-900" 
                      : ventilationAnalysis.status === 'warning'
                      ? "bg-amber-50 border-amber-200 text-amber-900"
                      : "bg-emerald-50 border-emerald-200 text-emerald-900"
                  }`}
                >
                  {ventilationAnalysis.status === 'danger' ? (
                    <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  ) : ventilationAnalysis.status === 'warning' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  <span>{ventilationAnalysis.message}</span>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: SOIL BEARING & STOREY CALCULATOR */}
            <TabsContent value="soil" className="m-0 space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center gap-3 text-xs text-emerald-900">
                <HardHat className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <strong>মাটির ধারণক্ষমতা ও স্ট্রাকচারাল লোড সুপারিশ:</strong> সাইটের সয়েল টেস্ট রিপোর্ট অনুযায়ী মাটির বেয়ারিং ক্যাপাসিটি এবং প্রস্তাবিত ভবনের তলা নির্বাচন করুন।
                </div>
              </div>

              {/* Selector Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border">
                <div className="space-y-1.5">
                  <Label className="text-xs font-black uppercase text-slate-700">মাটির ধারণক্ষমতা (Soil Bearing Capacity - SBC)</Label>
                  <Select value={soilBearingCapacity} onValueChange={setSoilBearingCapacity}>
                    <SelectTrigger className="bg-white border-slate-300 font-bold h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1.0">১.০ টন/বর্গফুট (নরম কাদা / পলিমাটি)</SelectItem>
                      <SelectItem value="1.25">১.২৫ টন/বর্গফুট (মাঝারি নরম মাটি)</SelectItem>
                      <SelectItem value="1.5">১.৫ টন/বর্গফুট (সাধারণ দোআঁশ / স্ট্যান্ডার্ড)</SelectItem>
                      <SelectItem value="2.0">২.০ টন/বর্গফুট (শক্ত এঁটেল / লাল মাটি)</SelectItem>
                      <SelectItem value="2.5">২.৫ টন/বর্গফুট (ঘন বালুকা মিশ্রিত শক্ত মাটি)</SelectItem>
                      <SelectItem value="3.0">৩.০ টন/বর্গফুট (অত্যন্ত শক্ত বালু / পাথুরে মাটি)</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-[10px] text-slate-400 block">সয়েল টেস্ট রিপোর্টের Net Allowable Bearing Capacity (Qa)</span>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-black uppercase text-slate-700">প্রস্তাবিত ভবনের উচ্চতা (Building Storeys)</Label>
                  <Select value={buildingStoreys} onValueChange={setBuildingStoreys}>
                    <SelectTrigger className="bg-white border-slate-300 font-bold h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">একতলা (G+0 Storey)</SelectItem>
                      <SelectItem value="2">দোতলা (G+1 Storey)</SelectItem>
                      <SelectItem value="3">তিনতলা (G+2 Storey)</SelectItem>
                      <SelectItem value="4">চারতলা (G+3 Storey)</SelectItem>
                      <SelectItem value="5">পাঁচতলা (G+4 Storey)</SelectItem>
                      <SelectItem value="6">ছয়তলা (G+5 Storey)</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-[10px] text-slate-400 block">ভবনের মোট ছাদের সংখ্যা</span>
                </div>
              </div>

              {/* Engineering Recommendations Box */}
              <div className="border-2 border-emerald-500/40 rounded-xl overflow-hidden shadow-sm bg-white">
                <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
                  <h4 className="text-xs font-bold flex items-center gap-2 text-emerald-400">
                    <FileCheck2 className="w-4 h-4" /> সিভিল ইঞ্জিনিয়ারিং স্ট্রাকচারাল সুপারিশ
                  </h4>
                  <span className="text-[10px] text-slate-400">IS & BNBC Standard Practice</span>
                </div>

                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1 border-b sm:border-b-0 sm:border-r border-slate-100 pb-3 sm:pb-0 sm:pr-4">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">আনুমানিক কলাম এক্সিয়াল লোড</span>
                    <span className="text-sm font-black text-slate-800">~{engineeringCalc.totalColumnLoadTons} টন (Tonnes)</span>
                    <p className="text-[11px] text-slate-500">ডেড লোড, লাইভ লোড এবং ফ্যাক্টর অফ সেফটি সমন্বিত হিসাব।</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">প্রয়োজনীয় ফুটিং সাইজ (Footing Area)</span>
                    <span className="text-sm font-black text-emerald-700">
                      {engineeringCalc.footingSideFt}' × {engineeringCalc.footingSideFt}' ফুট ({engineeringCalc.reqFootingAreaSqft} Sq.ft)
                    </span>
                    <p className="text-[11px] text-slate-500">বেইসের সর্বনিম্ন পুরুত্ব (Depth): <strong>{engineeringCalc.footingThickIn} ইঞ্চি</strong>।</p>
                  </div>

                  <div className="space-y-1 border-t border-slate-100 pt-3">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">সুপারিশকৃত কলাম সাইজ (Main Column)</span>
                    <span className="text-sm font-black text-slate-800">{engineeringCalc.colSize}</span>
                    <p className="text-[11px] text-slate-500">গ্রাউন্ড ফ্লোর ও প্রথম তলার মূল স্ট্রাকচারাল কলামের জন্য প্রযোজ্য।</p>
                  </div>

                  <div className="space-y-1 border-t border-slate-100 pt-3">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">প্রধান রড বিন্যাস (Main Reinforcement)</span>
                    <span className="text-sm font-black text-blue-700">{engineeringCalc.rebarSpec}</span>
                    <p className="text-[11px] text-slate-500">রিং বা টাই রড: ৮ মিমি (২.৫ সুতা) প্রতি ৬ ইঞ্চি পর পর।</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border-t text-[11px] text-slate-500 italic">
                  * বিঃদ্রঃ এই হিসাবটি প্রাক-নকশা (Preliminary Estimation) সহায়ক। চূড়ান্ত স্ট্রাকচারাল ড্রয়িংয়ের জন্য নিবন্ধিত চার্টার্ড স্ট্রাকচারাল ইঞ্জিনিয়ারের সয়েল টেস্ট ভেটিং নেওয়া আবশ্যক।
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="p-4 bg-slate-50 border-t flex flex-row items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            প্রজেক্ট: <strong>{projectName}</strong>
          </span>
          <Button
            size="sm"
            onClick={() => onOpenChange(false)}
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4"
          >
            বন্ধ করুন
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
