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
  ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Info,
  Building2, Layers, Activity, Wind, Ruler, FileCheck2,
  HardHat, Flame, Home, Zap
} from "lucide-react";

interface DesignObject {
  id: string; type: string; subType: string;
  x: number; y: number; w: number; h: number;
  label?: string; textContent?: string;
}

interface BnbcStructuralAuditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  designObjects: DesignObject[];
  projectName: string;
}

type Severity = 'danger' | 'warning' | 'success' | 'info';
interface AuditIssue {
  message: string; severity: Severity;
  clause?: string; recommendation?: string;
}

export function BnbcStructuralAuditDialog({ open, onOpenChange, designObjects, projectName }: BnbcStructuralAuditDialogProps) {
  const [activeTab, setActiveTab] = useState("audit");
  const [soilBearingCapacity, setSoilBearingCapacity] = useState<string>("1.5");
  const [buildingStoreys, setBuildingStoreys] = useState<string>("3");
  const [seismicZone, setSeismicZone] = useState<string>("zone2");

  const pillars = useMemo(() => designObjects.filter(o => o.subType === 'pillar' || o.type === 'pillar'), [designObjects]);
  const walls = useMemo(() => designObjects.filter(o => o.subType === 'wall' || (o.type === 'structure' && o.subType !== 'pillar')), [designObjects]);
  const stairs = useMemo(() => designObjects.filter(o => o.type === 'stair' || o.subType?.startsWith('stair')), [designObjects]);
  const windows = useMemo(() => designObjects.filter(o => o.subType === 'window'), [designObjects]);
  const doors = useMemo(() => designObjects.filter(o => o.subType?.startsWith('door') || o.subType === 'double-door' || o.subType === 'sliding-door'), [designObjects]);
  const textLabels = useMemo(() => designObjects.filter(o => o.type === 'text' || o.subType === 'label'), [designObjects]);
  const bathrooms = useMemo(() => textLabels.filter(o => {
    const t = ((o.textContent || o.label || '')).toLowerCase();
    return t.includes('bath') || t.includes('toilet') || t.includes('washroom') || t.includes('wc') || t.includes('বাথ') || t.includes('টয়লেট') || t.includes('প্রসাধন');
  }), [textLabels]);

  const estimatedFloorArea = useMemo(() => {
    const src = walls.length > 0 ? walls : designObjects.filter(o => o.w > 1 && o.h > 1);
    if (src.length === 0) return 0;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    src.forEach(s => { minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x + s.w); minY = Math.min(minY, s.y); maxY = Math.max(maxY, s.y + s.h); });
    return Math.max(0, Math.round((maxX - minX) * (maxY - minY) * 0.80));
  }, [walls, designObjects]);

  // 1. Column Span Analysis
  const columnSpanAnalysis = useMemo(() => {
    const issues: (AuditIssue & { distance: number })[] = [];
    let maxDistance = 0; let checkedPairs = 0;
    const TOL = 1.2;
    const yGroups: { y: number; items: DesignObject[] }[] = [];
    pillars.forEach(p => { const g = yGroups.find(gr => Math.abs(gr.y - p.y) < TOL); if (g) g.items.push(p); else yGroups.push({ y: p.y, items: [p] }); });
    yGroups.forEach(g => {
      const sorted = [...g.items].sort((a, b) => a.x - b.x);
      for (let i = 0; i < sorted.length - 1; i++) {
        const p1 = sorted[i], p2 = sorted[i+1];
        const dist = Math.abs((p2.x + p2.w/2) - (p1.x + p1.w/2));
        checkedPairs++; maxDistance = Math.max(maxDistance, dist);
        if (dist > 20) issues.push({ message: `কলাম স্প্যান অতিরিক্ত দীর্ঘ: ${dist.toFixed(1)} ফুট (সর্বোচ্চ ২০ ফুট অনুমোদিত)।`, severity: 'danger', distance: dist, clause: 'BNBC Section 6.3 (RCC Beam Design)', recommendation: 'মাঝে একটি অতিরিক্ত কলাম যোগ করুন। ২০ ফুটের বেশি স্প্যানে প্রি-স্ট্রেসড বা পোস্ট-টেনশন বীম ব্যবহার বাধ্যতামূলক।' });
        else if (dist > 15) issues.push({ message: `কলাম স্প্যান মধ্যম-দীর্ঘ: ${dist.toFixed(1)} ফুট।`, severity: 'warning', distance: dist, clause: 'BNBC Section 6.3', recommendation: '১০"×১৬" গভীর ড্রপ বিম ব্যবহার করুন। ডিফ্লেকশন সীমা L/360 নিশ্চিত করুন।' });
        else if (dist < 6 && dist > 0.5) issues.push({ message: `কলাম দুটি অতি নিকটে: ${dist.toFixed(1)} ফুট — অতিরিক্ত কলাম অপচয়।`, severity: 'info', distance: dist, clause: 'Structural Economy', recommendation: 'ট্রিবিউটারি এরিয়া পুনর্বিন্যাস করে কলাম অপসারণ করুন।' });
      }
    });
    if (pillars.length === 0 && designObjects.length > 0) issues.push({ message: 'ড্রয়িংয়ে কোনো কলাম (Pillar) নেই। RCC ভবনে কলাম ছাড়া কাঠামো অসম্ভব।', severity: 'danger', distance: 0, clause: 'BNBC Part 6: Structural Design', recommendation: 'প্রতিটি কোণে ও লোড-বেয়ারিং পয়েন্টে ন্যূনতম ১০"×১০" কলাম যোগ করুন।' });
    return { issues, maxDistance, checkedPairs };
  }, [pillars, designObjects.length]);

  // 2. Stair Analysis
  const stairAnalysis = useMemo(() => {
    const issues: AuditIssue[] = [];
    if (stairs.length === 0 && designObjects.length > 0) { issues.push({ message: 'সিঁড়ি নেই। দোতলা+ ভবনে সিঁড়ি বাধ্যতামূলক।', severity: 'warning', clause: 'BNBC Part 4, Clause 3.3.4', recommendation: 'ন্যূনতম প্রস্থ ৩\' ৩" (১ মিটার), রাইজার উচ্চতা ৭.৫" এর বেশি নয়।' }); return { issues, compliant: false }; }
    let allOk = true;
    stairs.forEach((s, idx) => {
      const w = Math.min(s.w, s.h);
      if (w < 3.0) { allOk = false; issues.push({ message: `সিঁড়ি #${idx+1}: প্রস্থ ${w.toFixed(1)}' — ন্যূনতম ৩'৩" প্রয়োজন।`, severity: 'danger', clause: 'BNBC Part 4, Clause 3.3.4', recommendation: 'প্রস্থ কমপক্ষে ৩ ফুট ৩ ইঞ্চি (১০০ সেমি) করুন। হুইলচেয়ার ও স্ট্রেচারের জন্য ৪ ফুট সুপারিশ।' }); }
      else if (w < 3.25) issues.push({ message: `সিঁড়ি #${idx+1}: প্রস্থ ${w.toFixed(1)}' — সীমানায় আছে।`, severity: 'warning', clause: 'BNBC Part 4, Clause 3.3.4', recommendation: '৩\'৩" করুন। উভয় পাশে হ্যান্ডরেইল বাধ্যতামূলক।' });
      else issues.push({ message: `সিঁড়ি #${idx+1}: প্রস্থ ${w.toFixed(1)}' — BNBC সম্মত ✓`, severity: 'success', clause: 'BNBC Part 4, Clause 3.3.4', recommendation: 'অগ্নি-নিরাপত্তা চিহ্ন ও ইমার্জেন্সি লাইটিং নিশ্চিত করুন।' });
    });
    return { issues, compliant: allOk };
  }, [stairs, designObjects.length]);

  // 3. Ventilation
  const ventilationAnalysis = useMemo(() => {
    const totalWindowArea = windows.reduce((acc, w) => acc + (w.w * (w.h > 1.5 ? w.h : 4.5)), 0);
    const required = estimatedFloorArea * 0.10;
    const pct = estimatedFloorArea > 0 ? (totalWindowArea / estimatedFloorArea) * 100 : 0;
    let status: 'good'|'warning'|'danger' = 'good', message = '', recommendation = '';
    if (windows.length === 0 && designObjects.length > 0) { status = 'danger'; message = 'জানালা নেই! প্রতিটি বাসযোগ্য কক্ষে আলো-বাতাস বাধ্যতামূলক।'; recommendation = `${Math.ceil(required)} Sq.ft জানালা যোগ করুন। ক্রস-ভেন্টিলেশনের জন্য বিপরীত দেয়ালে জানালা রাখুন।`; }
    else if (pct < 8 && designObjects.length > 0) { status = 'danger'; message = `জানালার অনুপাত মাত্র ${pct.toFixed(1)}% (ন্যূনতম ১০% প্রয়োজন)।`; recommendation = `আরও ${Math.ceil(required - totalWindowArea)} Sq.ft জানালা যোগ করুন।`; }
    else if (pct < 10 && designObjects.length > 0) { status = 'warning'; message = `জানালার অনুপাত ${pct.toFixed(1)}% — মানদণ্ডের কাছাকাছি।`; recommendation = '১-২টি অতিরিক্ত জানালা যোগ করুন।'; }
    else if (designObjects.length > 0) { status = 'good'; message = `জানালার অনুপাত ${pct.toFixed(1)}% — BNBC সম্মত ✓`; recommendation = 'ভবিষ্যত সম্প্রসারণে এই অনুপাত বজায় রাখুন।'; }
    return { totalWindowArea, required, pct, status, message, recommendation, count: windows.length };
  }, [windows, estimatedFloorArea, designObjects.length]);

  // 4. Room Size
  const roomSizeAnalysis = useMemo(() => {
    const issues: AuditIssue[] = [];
    const rooms = textLabels.filter(o => o.w > 5 && o.h > 5);
    if (rooms.length === 0 && designObjects.length > 0) { issues.push({ message: 'রুম লেবেল নেই — আয়তন যাচাই করা সম্ভব হয়নি।', severity: 'info', clause: 'BNBC Part 3, Clause 1.6.1', recommendation: 'প্রতিটি কক্ষে লেবেল যোগ করুন। বাসযোগ্য কক্ষের ন্যূনতম আয়তন ৮০ Sq.ft, একটি মাত্রা ≥ ৮ ফুট।' }); return { issues }; }
    rooms.forEach(r => {
      const area = r.w * r.h; const label = r.textContent || r.label || 'রুম';
      if (area < 60) issues.push({ message: `"${label}": ~${Math.round(area)} Sq.ft — অতি ছোট।`, severity: 'danger', clause: 'BNBC Part 3, Clause 1.6.1', recommendation: 'বাসযোগ্য কক্ষ ন্যূনতম ৮০ Sq.ft এবং একটি মাত্রা ≥ ৮ ফুট হতে হবে।' });
      else if (area < 80) issues.push({ message: `"${label}": ~${Math.round(area)} Sq.ft — সীমার কাছাকাছি।`, severity: 'warning', clause: 'BNBC Part 3, Clause 1.6.1', recommendation: '৮০ Sq.ft নিশ্চিত করুন।' });
      else issues.push({ message: `"${label}": ~${Math.round(area)} Sq.ft — সম্মত ✓`, severity: 'success', clause: 'BNBC Part 3, Clause 1.6.1', recommendation: 'আয়তন মানদণ্ড পূরণ করছে।' });
    });
    return { issues };
  }, [textLabels, designObjects.length]);

  // 5. Bathroom
  const bathroomAnalysis = useMemo((): AuditIssue => {
    if (bathrooms.length === 0 && designObjects.length > 0) return { message: 'বাথরুম/টয়লেট চিহ্নিত নেই। প্রতিটি ইউনিটে ন্যূনতম ১টি বাধ্যতামূলক।', severity: 'warning', clause: 'BNBC Part 3, Clause 3.1', recommendation: 'ন্যূনতম ৩০ Sq.ft বাথরুম যোগ করুন। বায়ুচলাচল ও ড্রেন স্লোপ (১:৮০) নিশ্চিত করুন।' };
    if (designObjects.length === 0) return { message: 'অডিট শুরুর অপেক্ষায়...', severity: 'info' };
    return { message: `${bathrooms.length}টি বাথরুম/টয়লেট আছে — প্রাথমিক শর্ত পূরণ ✓`, severity: 'success', clause: 'BNBC Part 3, Clause 3.1', recommendation: 'অ্যান্টি-স্কিড ফ্লোর, এক্সজস্ট ফ্যান ও সঠিক ড্রেনেজ নিশ্চিত করুন।' };
  }, [bathrooms.length, designObjects.length]);

  // 6. Fire & Door
  const fireExitAnalysis = useMemo(() => {
    const issues: AuditIssue[] = [];
    if (doors.length === 0 && designObjects.length > 0) { issues.push({ message: 'কোনো দরজা নেই। জরুরি নির্গমন শূন্য।', severity: 'danger', clause: 'BNBC Part 4, Section 4', recommendation: 'প্রধান দরজা ≥ ৩ ফুট প্রস্থ ও ৭ ফুট উচ্চতা। ৩০০০+ Sq.ft হলে ২টি এক্সিট বাধ্যতামূলক।' }); }
    else if (designObjects.length > 0) {
      const narrow = doors.filter(d => d.w < 2.5 && d.w > 0.3);
      if (narrow.length > 0) issues.push({ message: `${narrow.length}টি দরজা ২'৬" এর কম প্রস্থ — BNBC লঙ্ঘন।`, severity: 'warning', clause: 'BNBC Part 4, Clause 4.2.3', recommendation: 'কক্ষের দরজা ≥ ২\' ৮" (৮০ সেমি), প্রধান দরজা ≥ ৩\' (৯০ সেমি)।' });
      else issues.push({ message: `${doors.length}টি দরজার প্রস্থ গ্রহণযোগ্য ✓`, severity: 'success', clause: 'BNBC Part 4, Clause 4.2.3', recommendation: 'দরজার উচ্চতা ≥ ৭ ফুট নিশ্চিত করুন। অগ্নিরোধী দরজা বিবেচনা করুন।' });
    }
    if (estimatedFloorArea > 3000) issues.push({ message: `মোট আয়তন ~${estimatedFloorArea} Sq.ft — দুটি পৃথক ফায়ার এক্সিট বাধ্যতামূলক।`, severity: 'warning', clause: 'BNBC Part 4, Section 4.3', recommendation: 'দুটি সিঁড়ি বা বিকল্প নির্গমন রুট নিশ্চিত করুন। প্রতি ২৫০ Sq.ft-এ ১টি ফায়ার এক্সটিংগুইশার রাখুন।' });
    return { issues };
  }, [doors, estimatedFloorArea, designObjects.length]);

  // 7. Seismic
  const seismicAnalysis = useMemo((): AuditIssue => {
    const s = parseInt(buildingStoreys) || 3;
    if (seismicZone === 'zone3' && s > 3) return { message: `সিসমিক জোন ৩ (উচ্চ ঝুঁকি) + ${s} তলা — বিশেষ ভূমিকম্প-সহনশীল ডিজাইন অপরিহার্য।`, severity: 'danger', clause: 'BNBC Part 6, Chapter 2', recommendation: 'শিয়ার ওয়াল ও Special Moment Resisting Frame (SMRF) ডিজাইন ব্যবহার করুন। বেস আইসোলেশন বিবেচনা করুন।' };
    if (seismicZone === 'zone3') return { message: `সিসমিক জোন ৩ + ${s} তলা — বিশেষ সাবধানতা প্রয়োজন।`, severity: 'warning', clause: 'BNBC Part 6, Chapter 2', recommendation: 'কলাম-বিম জয়েন্টে অতিরিক্ত টাই রড। প্রতি ৬" পর পর স্টিরাপ বাধ্যতামূলক।' };
    if (seismicZone === 'zone2') return { message: `সিসমিক জোন ২ (মধ্যম ঝুঁকি) — Intermediate MRF ডিজাইন প্রযোজ্য।`, severity: 'info', clause: 'BNBC Part 6, Chapter 2', recommendation: 'কলাম-বিম কানেকশনে পর্যাপ্ত ল্যাপ লেন্থ নিশ্চিত করুন। M20+ কংক্রিট ব্যবহার করুন।' };
    return { message: 'সিসমিক জোন ১ (নিম্ন ঝুঁকি) — সাধারণ RCC ডিজাইন যথেষ্ট।', severity: 'success', clause: 'BNBC Part 6, Chapter 2', recommendation: 'ন্যূনতম M20 গ্রেড কংক্রিট ব্যবহার নিশ্চিত করুন।' };
  }, [buildingStoreys, seismicZone]);

  // Safety Score
  const safetyScore = useMemo(() => {
    // If empty drawing, default to 100% instead of penalizing non-existent building
    if (designObjects.length === 0 || (pillars.length === 0 && walls.length === 0)) return 100;

    let score = 100;
    if (pillars.length === 0) score -= 35;
    if (columnSpanAnalysis.issues.some(i => i.severity === 'danger')) score -= 20;
    if (columnSpanAnalysis.issues.some(i => i.severity === 'warning')) score -= 8;
    if (!stairAnalysis.compliant && stairs.length > 0) score -= 12;
    if (stairs.length === 0) score -= 8;
    if (ventilationAnalysis.status === 'danger') score -= 15;
    if (ventilationAnalysis.status === 'warning') score -= 5;
    if (bathroomAnalysis.severity === 'warning') score -= 5;
    if (fireExitAnalysis.issues.some(i => i.severity === 'danger')) score -= 10;
    if (seismicAnalysis.severity === 'danger') score -= 8;
    return Math.max(0, Math.min(100, score));
  }, [designObjects.length, pillars.length, walls.length, columnSpanAnalysis, stairAnalysis, stairs.length, ventilationAnalysis, bathroomAnalysis, fireExitAnalysis, seismicAnalysis]);

  const countBySeverity = (issues: AuditIssue[], sev: Severity) => issues.filter(i => i.severity === sev).length;
  const allIssues = [
    ...columnSpanAnalysis.issues, ...stairAnalysis.issues,
    ...(designObjects.length > 0 ? [{ severity: ventilationAnalysis.status === 'good' ? 'success' : ventilationAnalysis.status as Severity, message: '' }] : []),
    bathroomAnalysis, ...roomSizeAnalysis.issues, ...fireExitAnalysis.issues, seismicAnalysis
  ] as AuditIssue[];
  const passCount = countBySeverity(allIssues, 'success');
  const warnCount = countBySeverity(allIssues, 'warning');
  const failCount = countBySeverity(allIssues, 'danger');

  const renderIssue = (issue: AuditIssue, idx: number) => (
    <div key={idx} className={`rounded-xl border p-3 text-xs leading-relaxed space-y-1.5 ${
      issue.severity === 'danger' ? 'bg-red-50 border-red-200 text-red-900'
      : issue.severity === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-900'
      : issue.severity === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
      : 'bg-blue-50 border-blue-200 text-blue-900'}`}>
      <div className="flex items-start gap-2">
        {issue.severity === 'danger' ? <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
        : issue.severity === 'warning' ? <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        : issue.severity === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        : <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />}
        <div className="space-y-1 flex-1">
          <p className="font-bold">{issue.message}</p>
          {issue.clause && <p className="text-[10px] font-mono opacity-70">📋 {issue.clause}</p>}
          {issue.recommendation && <p className="text-[11px] opacity-80 border-t border-current/20 pt-1 mt-1">💡 <strong>সমাধান:</strong> {issue.recommendation}</p>}
        </div>
      </div>
    </div>
  );

  // Engineering Calc
  const engineeringCalc = useMemo(() => {
    const sbc = parseFloat(soilBearingCapacity) || 1.5;
    const s = parseInt(buildingStoreys) || 3;
    const raw = 130 * 165 * s; // tributary 130sqft × (DL125+LL40)psf × storeys
    const totalTons = Math.round((raw / 2000) * 1.25);
    const area = totalTons / sbc;
    const side = Math.ceil(Math.sqrt(area) * 4) / 4;
    const thick = Math.min(30, Math.max(12, Math.round(10 + s * 2.5)));
    const specs: Record<string, { col: string; rebar: string; beam: string; slab: string }> = {
      '1': { col: '10"×10"', rebar: '4-16mm 500W', beam: '10"×12"', slab: '4"' },
      '2': { col: '10"×12"', rebar: '6-16mm 500W', beam: '10"×14"', slab: '4.5"' },
      '3': { col: '10"×15"', rebar: '6-16mm+2-12mm 500W', beam: '10"×16"', slab: '5"' },
      '4': { col: '12"×15"', rebar: '8-16mm 500W', beam: '12"×16"', slab: '5"' },
      '5': { col: '12"×18"', rebar: '8-20mm 500W', beam: '12"×18"', slab: '5.5"' },
      '6': { col: '15"×18"', rebar: '10-20mm 500W', beam: '14"×20"', slab: '6"' },
    };
    const sp = specs[buildingStoreys] || specs['6'];
    const grade = s <= 3 ? 'M20 (1:1.5:3)' : s <= 5 ? 'M25 (1:1:2)' : 'M30 (Ready Mix)';
    return { totalTons, area: Math.round(area * 10) / 10, side, thick, grade, ...sp };
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
                <DialogTitle className="text-base md:text-lg font-black text-white">BNBC কোড ও স্ট্রাকচারাল সেফটি অডিটর</DialogTitle>
                <DialogDescription className="text-slate-300 text-xs mt-0.5">
                  Bangladesh National Building Code (BNBC 2020) অনুযায়ী ৭টি ক্যাটাগরিতে বিস্তারিত যাচাই
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
                <span className="text-[9px] font-bold text-slate-300 uppercase block">সেফটি স্কোর</span>
                <span className={`text-xl font-black ${safetyScore >= 80 ? "text-emerald-400" : safetyScore >= 60 ? "text-amber-400" : "text-red-400"}`}>{safetyScore}%</span>
              </div>
              <div className="text-[10px] font-bold space-y-1">
                <div className="text-emerald-400">✅ পাস: {passCount}</div>
                <div className="text-amber-400">⚠️ সতর্কতা: {warnCount}</div>
                <div className="text-red-400">❌ ফেল: {failCount}</div>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-5 pt-3 bg-slate-50 border-b shrink-0">
            <TabsList className="bg-slate-200/80 p-1 gap-1">
              <TabsTrigger value="audit" className="text-xs font-bold gap-1.5 data-[state=active]:bg-white">
                <Activity className="w-3.5 h-3.5 text-blue-600" /> লাইভ BNBC অডিট (৭টি চেক)
              </TabsTrigger>
              <TabsTrigger value="soil" className="text-xs font-bold gap-1.5 data-[state=active]:bg-white">
                <Layers className="w-3.5 h-3.5 text-emerald-600" /> সয়েল ও স্ট্রাকচারাল ক্যালকুলেটর
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <TabsContent value="audit" className="m-0 space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'কলাম সংখ্যা', value: `${pillars.length} টি`, sub: pillars.length > 0 ? `সর্বোচ্চ স্প্যান: ${columnSpanAnalysis.maxDistance.toFixed(1)}'` : '⚠️ কলাম নেই!' },
                  { label: 'সিঁড়ি প্রস্থ', value: stairs.length > 0 ? `${Math.min(stairs[0].w, stairs[0].h).toFixed(1)}'` : 'নাই', sub: stairs.length > 0 ? (stairAnalysis.compliant ? '✅ BNBC সম্মত' : '⚠️ পর্যালোচনা দরকার') : 'সিঁড়ি যোগ করুন' },
                  { label: 'জানালা ও বাতাস', value: `${ventilationAnalysis.pct.toFixed(1)}%`, sub: ventilationAnalysis.status === 'good' ? '✅ পর্যাপ্ত' : '⚠️ ঘাটতি আছে' },
                  { label: 'আনুমানিক ফ্লোর', value: `${estimatedFloorArea} Sq.ft`, sub: `(${(estimatedFloorArea * 0.0929).toFixed(1)} m²)` },
                ].map((s, i) => (
                  <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">{s.label}</span>
                    <span className="text-base font-black text-slate-800">{s.value}</span>
                    <span className="text-[10px] text-slate-500 block">{s.sub}</span>
                  </div>
                ))}
              </div>

              {/* Check 1: Column Spans */}
              <div className="border rounded-xl p-4 bg-white shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-800 flex items-center gap-2"><Building2 className="w-4 h-4 text-indigo-600" /> ১. কলামের দূরত্ব ও বিম স্প্যান বিশ্লেষণ</h4>
                  <span className="text-[10px] text-slate-400">BNBC Section 6.3</span>
                </div>
                <div className="space-y-2">
                  {columnSpanAnalysis.issues.length === 0
                    ? renderIssue({ message: designObjects.length === 0 ? 'ডিজাইন শুরু করার অপেক্ষায়...' : 'কলামের দূরত্ব নিরাপদ সীমার মধ্যে — সকল স্প্যান ১৫ ফুটের নিচে ✓', severity: designObjects.length === 0 ? 'info' : 'success', clause: 'BNBC Section 6.3', recommendation: 'অতিরিক্ত ডিফ্লেকশন বা ক্র্যাকিং ঝুঁকি নেই।' }, 0)
                    : columnSpanAnalysis.issues.map((iss, i) => renderIssue(iss, i))}
                </div>
              </div>

              {/* Check 2: Stairs */}
              <div className="border rounded-xl p-4 bg-white shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-800 flex items-center gap-2"><Ruler className="w-4 h-4 text-purple-600" /> ২. সিঁড়ির মাপ ও জরুরি নির্গমন</h4>
                  <span className="text-[10px] text-slate-400">BNBC Part 4, Clause 3.3.4</span>
                </div>
                <div className="space-y-2">
                  {designObjects.length === 0 
                    ? renderIssue({ message: 'ড্রয়িং শুরু করলে সিঁড়ির নিরাপত্তা যাচাই করা হবে।', severity: 'info' }, 0)
                    : stairAnalysis.issues.map((iss, i) => renderIssue(iss, i))}
                </div>
              </div>

              {/* Check 3: Ventilation */}
              <div className="border rounded-xl p-4 bg-white shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-800 flex items-center gap-2"><Wind className="w-4 h-4 text-sky-600" /> ৩. প্রাকৃতিক আলো ও বায়ুচলাচল</h4>
                  <span className="text-[10px] text-slate-400">BNBC Part 3: Light &amp; Ventilation</span>
                </div>
                {designObjects.length === 0 
                  ? renderIssue({ message: 'জানালা ও বাতাসের অনুপাত এখানে প্রদর্শিত হবে।', severity: 'info' }, 0)
                  : renderIssue({ message: ventilationAnalysis.message, severity: ventilationAnalysis.status === 'good' ? 'success' : ventilationAnalysis.status as Severity, clause: 'জানালা ≥ ফ্লোরের ১০%', recommendation: ventilationAnalysis.recommendation }, 0)
                }
                <div className="flex gap-4 text-[11px] text-slate-500 px-1">
                  <span>জানালা: <strong>{ventilationAnalysis.count}টি</strong></span>
                  <span>বর্তমান: <strong>{ventilationAnalysis.totalWindowArea.toFixed(1)} Sq.ft</strong></span>
                  <span>প্রয়োজন: <strong>{ventilationAnalysis.required.toFixed(1)} Sq.ft</strong></span>
                </div>
              </div>

              {/* Check 4: Room Size */}
              <div className="border rounded-xl p-4 bg-white shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-800 flex items-center gap-2"><Home className="w-4 h-4 text-rose-600" /> ৪. ন্যূনতম কক্ষের আয়তন যাচাই</h4>
                  <span className="text-[10px] text-slate-400">BNBC Part 3, Clause 1.6.1</span>
                </div>
                <div className="space-y-2">
                  {designObjects.length === 0 
                    ? renderIssue({ message: 'রুমের আয়তন ও লেবেল অডিট হবে।', severity: 'info' }, 0)
                    : roomSizeAnalysis.issues.map((iss, i) => renderIssue(iss, i))}
                </div>
              </div>

              {/* Check 5: Bathroom */}
              <div className="border rounded-xl p-4 bg-white shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-800 flex items-center gap-2"><Activity className="w-4 h-4 text-teal-600" /> ৫. বাথরুম ও স্যানিটারি বিধিমালা</h4>
                  <span className="text-[10px] text-slate-400">BNBC Part 3, Clause 3.1</span>
                </div>
                {renderIssue(bathroomAnalysis, 0)}
              </div>

              {/* Check 6: Fire & Door */}
              <div className="border rounded-xl p-4 bg-white shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-800 flex items-center gap-2"><Flame className="w-4 h-4 text-orange-600" /> ৬. অগ্নি-নিরাপত্তা ও দরজার প্রস্থ</h4>
                  <span className="text-[10px] text-slate-400">BNBC Part 4, Section 4</span>
                </div>
                <div className="space-y-2">
                  {designObjects.length === 0 
                    ? renderIssue({ message: 'দরজা ও জরুরি নির্গমন পথ যাচাই করা হবে।', severity: 'info' }, 0)
                    : fireExitAnalysis.issues.map((iss, i) => renderIssue(iss, i))}
                </div>
              </div>

              {/* Check 7: Seismic */}
              <div className="border rounded-xl p-4 bg-white shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-800 flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-600" /> ৭. ভূমিকম্প-সহনশীলতা (Seismic Zone)</h4>
                  <div className="flex items-center gap-2">
                    <Select value={seismicZone} onValueChange={setSeismicZone}>
                      <SelectTrigger className="h-7 text-[10px] font-bold w-36 border-slate-300 bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="zone1">জোন ১ (নিম্ন ঝুঁকি)</SelectItem>
                        <SelectItem value="zone2">জোন ২ (মধ্যম ঝুঁকি)</SelectItem>
                        <SelectItem value="zone3">জোন ৩ (উচ্চ ঝুঁকি)</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-[10px] text-slate-400">BNBC Part 6</span>
                  </div>
                </div>
                {renderIssue(seismicAnalysis, 0)}
              </div>
            </TabsContent>

            {/* TAB 2: SOIL CALCULATOR */}
            <TabsContent value="soil" className="m-0 space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center gap-3 text-xs text-emerald-900">
                <HardHat className="w-5 h-5 text-emerald-600 shrink-0" />
                <div><strong>মাটির ধারণক্ষমতা ও স্ট্রাকচারাল লোড সুপারিশ:</strong> সাইটের সয়েল টেস্ট রিপোর্ট অনুযায়ী BNBC 2020 ও IS 456 মানে হিসাব করা হয়েছে।</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border">
                <div className="space-y-1.5">
                  <Label className="text-xs font-black uppercase text-slate-700">মাটির ধারণক্ষমতা (SBC)</Label>
                  <Select value={soilBearingCapacity} onValueChange={setSoilBearingCapacity}>
                    <SelectTrigger className="bg-white border-slate-300 font-bold h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.75">০.৭৫ টন/বর্গফুট — নরম পলিমাটি / জলাভূমি</SelectItem>
                      <SelectItem value="1.0">১.০ টন/বর্গফুট — নরম কাদা / পলিমাটি</SelectItem>
                      <SelectItem value="1.25">১.২৫ টন/বর্গফুট — মাঝারি নরম মাটি</SelectItem>
                      <SelectItem value="1.5">১.৫ টন/বর্গফুট — সাধারণ দোআঁশ (স্ট্যান্ডার্ড)</SelectItem>
                      <SelectItem value="2.0">২.০ টন/বর্গফুট — শক্ত এঁটেল / লাল মাটি</SelectItem>
                      <SelectItem value="2.5">২.৫ টন/বর্গফুট — বালুকা মিশ্রিত শক্ত মাটি</SelectItem>
                      <SelectItem value="3.0">৩.০ টন/বর্গফুট — অত্যন্ত শক্ত / পাথুরে মাটি</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-black uppercase text-slate-700">ভবনের তলা সংখ্যা</Label>
                  <Select value={buildingStoreys} onValueChange={setBuildingStoreys}>
                    <SelectTrigger className="bg-white border-slate-300 font-bold h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['1','2','3','4','5','6'].map(n => <SelectItem key={n} value={n}>{['একতলা (G+0)','দোতলা (G+1)','তিনতলা (G+2)','চারতলা (G+3)','পাঁচতলা (G+4)','ছয়তলা (G+5)'][parseInt(n)-1]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-2 border-emerald-500/40 rounded-xl overflow-hidden shadow-sm bg-white">
                <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
                  <h4 className="text-xs font-bold flex items-center gap-2 text-emerald-400"><FileCheck2 className="w-4 h-4" /> স্ট্রাকচারাল সুপারিশ — {buildingStoreys} তলা ভবন</h4>
                  <span className="text-[10px] text-slate-400">BNBC 2020 | IS 456 | IS 1893</span>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {[
                    { title: 'আনুমানিক কলাম লোড', value: `~${engineeringCalc.totalTons} টন`, desc: 'DL (১২৫psf) + LL (৪০psf) × তলা সংখ্যা × ফ্যাক্টর অফ সেফটি (১.২৫)' },
                    { title: 'প্রয়োজনীয় ফুটিং সাইজ', value: `${engineeringCalc.side}' × ${engineeringCalc.side}' (${engineeringCalc.area} Sq.ft)`, desc: `গভীরতা: ${engineeringCalc.thick}" | মাটি থেকে ≥ ৪ ফুট নিচে` },
                    { title: 'সুপারিশকৃত কলাম সাইজ', value: engineeringCalc.col, desc: `রিইনফোর্সমেন্ট: ${engineeringCalc.rebar} | স্টিরাপ: ৮mm @ ৬" c/c` },
                    { title: 'বিম ও স্ল্যাব', value: `বিম: ${engineeringCalc.beam} | স্ল্যাব: ${engineeringCalc.slab}`, desc: `কংক্রিট গ্রেড: ${engineeringCalc.grade} | স্ল্যাব রড: ১০mm @ ৬" c/c` },
                  ].map((item, i) => (
                    <div key={i} className={`space-y-1 ${i >= 2 ? 'border-t border-slate-100 pt-3' : ''} ${i % 2 === 0 ? 'sm:border-r sm:pr-4 border-slate-100' : ''}`}>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">{item.title}</span>
                      <span className="text-sm font-black text-slate-800">{item.value}</span>
                      <p className="text-[11px] text-slate-500">{item.desc}</p>
                    </div>
                  ))}
                </div>
                <div className="p-3 bg-amber-50 border-t border-amber-200 text-[11px] text-amber-800">
                  ⚠️ <strong>গুরুত্বপূর্ণ:</strong> এই হিসাব Preliminary Estimation সহায়ক। চূড়ান্ত ড্রয়িংয়ের জন্য নিবন্ধিত চার্টার্ড স্ট্রাকচারাল ইঞ্জিনিয়ারের সয়েল টেস্ট ভেটিং ও সাইন-অফ বাধ্যতামূলক।
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="p-4 bg-slate-50 border-t flex flex-row items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            প্রজেক্ট: <strong>{projectName}</strong> | মোট উপাদান: <strong>{designObjects.length}টি</strong> | স্ক্যান সম্পন্ন
          </span>
          <Button size="sm" onClick={() => onOpenChange(false)} className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4">
            বন্ধ করুন
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
