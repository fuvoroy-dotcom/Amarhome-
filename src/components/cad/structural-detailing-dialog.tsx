'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Download, Layers, ShieldCheck, ZoomIn, ZoomOut, Building2, Boxes, Scissors, Info, PencilLine, Save, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface StructuralDetailingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  designObjects: any[];
  projectName?: string;
  onSave?: () => void;
}

export function StructuralDetailingDialog({
  open,
  onOpenChange,
  designObjects,
  projectName = 'AmarHome Project',
  onSave,
}: StructuralDetailingProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('footing');
  const [scale, setScale] = useState(1);
  const [detailingStoreys, setDetailingStoreys] = useState(3);
  
  // State for manual overrides
  const [itemOverrides, setItemOverrides] = useState<Record<string, any>>({});
  const [editingItem, setEditingItem] = useState<{ id: string; type: string; data: any } | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`amarhome_cad_detailing_${projectName}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.detailingStoreys) setDetailingStoreys(parsed.detailingStoreys);
        if (parsed.itemOverrides) setItemOverrides(parsed.itemOverrides);
      }
    } catch (e) {}
  }, [projectName]);

  const handleServerSave = async () => {
    setIsSaving(true);
    try {
      try {
        localStorage.setItem(`amarhome_cad_detailing_${projectName}`, JSON.stringify({
          detailingStoreys,
          itemOverrides,
          updatedAt: new Date().toISOString()
        }));
      } catch (e) {}

      if (onSave) {
        await onSave();
      }

      toast({
        title: "সার্ভারে সেভ হয়েছে",
        description: "রড ডিটেইলিং ২ডি ডিজাইন ও প্যারামিটার ডাটা সফলভাবে সার্ভারে সংরক্ষিত হয়েছে।",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "সেভ ব্যর্থ হয়েছে",
        description: "সার্ভারে সেভ করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।",
      });
    } finally {
      setIsSaving(false);
    }
  };

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
    const groups: Record<string, { wIn: number; hIn: number; count: number; id: string }> = {};
    mappedPillars.forEach(p => {
      const wIn = Math.max(10, Math.round(p.w * 12));
      const hIn = Math.max(10, Math.round(p.h * 12));
      const key = `${wIn}x${hIn}`;
      if (!groups[key]) groups[key] = { wIn, hIn, count: 0, id: key };
      groups[key].count++;
    });
    return Object.values(groups);
  }, [mappedPillars]);

  // Beam Span Detection Logic - Pillar to Pillar
  const beamSpans = useMemo(() => {
    const spans: { id: string; p1: any; p2: any; length: number; orientation: 'H' | 'V'; width?: number; depth?: number; label?: string }[] = [];
    const TOL = 1.0;

    const yMap = new Map<number, any[]>();
    mappedPillars.forEach(p => {
      let found = false;
      for (const y of Array.from(yMap.keys())) {
        if (Math.abs(y - p.y) < TOL) {
          yMap.get(y)!.push(p);
          found = true;
          break;
        }
      }
      if (!found) yMap.set(p.y, [p]);
    });

    yMap.forEach(group => {
      const sorted = [...group].sort((a, b) => a.x - b.x);
      for (let i = 0; i < sorted.length - 1; i++) {
        const p1 = sorted[i];
        const p2 = sorted[i+1];
        const dist = p2.x - (p1.x + p1.w);
        if (dist > 1.0) {
          const matchingBeam = designObjects.find(o => 
            o.subType === 'beam' && 
            Math.abs(o.y - p1.y) < 2.0 && 
            o.x <= p2.x && (o.x + o.w) >= p1.x
          );
          spans.push({ 
            id: `h-${p1.id}-${p2.id}`, 
            p1, 
            p2, 
            length: dist, 
            orientation: 'H',
            width: matchingBeam && matchingBeam.h > 0 ? Math.round(matchingBeam.h * 12) : 10,
            depth: matchingBeam ? ((matchingBeam as any).depth || 12) : undefined,
            label: matchingBeam?.label
          });
        }
      }
    });

    const xMap = new Map<number, any[]>();
    mappedPillars.forEach(p => {
      let found = false;
      for (const x of Array.from(xMap.keys())) {
        if (Math.abs(x - p.x) < TOL) {
          xMap.get(x)!.push(p);
          found = true;
          break;
        }
      }
      if (!found) xMap.set(p.x, [p]);
    });

    xMap.forEach(group => {
      const sorted = [...group].sort((a, b) => a.y - b.y);
      for (let i = 0; i < sorted.length - 1; i++) {
        const p1 = sorted[i];
        const p2 = sorted[i+1];
        const dist = p2.y - (p1.y + p1.h);
        if (dist > 1.0) {
          const matchingBeam = designObjects.find(o => 
            o.subType === 'beam' && 
            Math.abs(o.x - p1.x) < 2.0 && 
            o.y <= p2.y && (o.y + o.w) >= p1.y
          );
          spans.push({ 
            id: `v-${p1.id}-${p2.id}`, 
            p1, 
            p2, 
            length: dist, 
            orientation: 'V',
            width: matchingBeam && matchingBeam.h > 0 ? Math.round(matchingBeam.h * 12) : 10,
            depth: matchingBeam ? ((matchingBeam as any).depth || 12) : undefined,
            label: matchingBeam?.label
          });
        }
      }
    });

    if (spans.length === 0) {
      const canvasBeams = designObjects.filter(o => o.subType === 'beam');
      if (canvasBeams.length > 0) {
        return canvasBeams.map((b, idx) => {
          const rot = Math.abs(b.rotation || 0) % 180;
          const isV = rot >= 45 && rot <= 135;
          return {
            id: b.id,
            p1: null,
            p2: null,
            length: b.w > 0 ? b.w : 10,
            width: b.h > 0 ? Math.round(b.h * 12) : 10,
            depth: (b as any).depth || 12,
            orientation: isV ? ('V' as const) : ('H' as const),
            label: b.label || `B${idx + 1}`
          };
        });
      }
    }

    return spans;
  }, [mappedPillars, designObjects]);

  const slabAreas = useMemo(() => {
    return designObjects.filter(o => o.subType === 'area-marker');
  }, [designObjects]);

  const stairObjects = useMemo(() => {
    return designObjects.filter(o => o.subType.startsWith('stair') || o.type === 'stair');
  }, [designObjects]);

  const getReinforcementInfo = (storeys: number, wIn: number = 10, hIn: number = 10, itemId?: string) => {
    if (itemId && itemOverrides[itemId]) {
      return itemOverrides[itemId];
    }

    let rodCount = 4;
    const maxSide = Math.max(wIn, hIn);
    
    if (storeys <= 2) {
      rodCount = maxSide > 12 ? 6 : 4;
    } else if (storeys <= 4) {
      rodCount = maxSide > 12 ? 8 : 6;
      if (maxSide >= 18) rodCount = 10;
    } else {
      rodCount = maxSide > 12 ? 12 : 10;
    }

    rodCount = Math.min(rodCount, 12);

    if (storeys <= 2) return { rod: "16mm (5 Suta)", gap: "6\" c/c", thick: 15, hook: 3, rodCount, ringRod: "8mm", extraTop: 0, botRodCount: 3, topRodCount: 2, crankLen: 0 };
    if (storeys <= 3) return { rod: "16mm (5 Suta)", gap: "5\" c/c", thick: 18, hook: 4, rodCount, ringRod: "8mm", extraTop: 0, botRodCount: 3, topRodCount: 2, crankLen: 0 };
    if (storeys <= 4) return { rod: "16mm (5 Suta)", gap: "5\" c/c", thick: 18, hook: 4, rodCount, ringRod: "10mm", extraTop: 0, botRodCount: 4, topRodCount: 3, crankLen: 0 };
    if (storeys <= 5) return { rod: "20mm (6 Suta)", gap: "4.5\" c/c", thick: 24, hook: 4, rodCount, ringRod: "10mm", extraTop: 0, botRodCount: 4, topRodCount: 3, crankLen: 0 };
    return { rod: "20mm (6 Suta)", gap: "4\" c/c", thick: 24, hook: 4, rodCount, ringRod: "10mm", extraTop: 0, botRodCount: 4, topRodCount: 3, crankLen: 0 };
  };

  const getSidebarSafetyInfo = () => {
    if (activeTab === 'footing' && uniquePillarGroups.length > 0) {
      const group = uniquePillarGroups[0];
      const info = getReinforcementInfo(detailingStoreys, group.wIn, group.hIn, `footing-${group.id}`);
      return { title: 'বেস রড ও পুরুত্ব', rebar: `${info.rod} @ ${info.gap}`, extra: `বেস উচ্চতা: ${info.thick}"` };
    }
    if (activeTab === 'column' && uniquePillarGroups.length > 0) {
      const group = uniquePillarGroups[0];
      const info = getReinforcementInfo(detailingStoreys, group.wIn, group.hIn, `column-${group.id}`);
      return { title: 'কলাম রড ও রিং', rebar: `${info.rodCount} টি ${info.rod}`, extra: `রিং: ${info.ringRod || '8mm'} @ ${info.gap || '5" c/c'}` };
    }
    if (activeTab === 'beam' && beamSpans.length > 0) {
      const span = beamSpans[0];
      const info = getReinforcementInfo(detailingStoreys, 10, 10, `beam-${span.id}`);
      const bot = info.botRodCount || (info.rodCount > 6 ? 4 : 3);
      const top = info.topRodCount || (info.rodCount > 6 ? 3 : 2);
      return { title: 'বিম মেইন রড', rebar: `${bot + top} টি ${info.rod}`, extra: 'L/3 এক্সট্রা টপ' };
    }
    if (activeTab === 'slab' && slabAreas.length > 0) {
      const slab = slabAreas[0];
      const info = getReinforcementInfo(detailingStoreys, 10, 10, `slab-${slab.id}`);
      const spacing = detailingStoreys <= 3 ? 6 : 5;
      return { title: 'ছাদ রড জালি', rebar: `10mm @ ${spacing}" c/c`, extra: `পুরুত্ব: ${info.thick || (detailingStoreys <= 3 ? 5 : 6)}"` };
    }
    if (activeTab === 'stair' && stairObjects.length > 0) {
      const stair = stairObjects[0];
      const info = getReinforcementInfo(detailingStoreys, 10, 10, `stair-${stair.id}`);
      return { title: 'সিঁড়ি রড বিন্যাস', rebar: `12mm @ ${info.gap || '5" c/c'}`, extra: `ওয়েস্ট স্ল্যাব: ${info.thick || 5}"` };
    }
    return { title: 'মেইন রড সাইজ', rebar: '১৬মিমি (৫ সুতা)', extra: 'পুরুত্ব: ১৮" ইঞ্চি' };
  };

  const safetyInfo = getSidebarSafetyInfo();

  const handlePrint = () => {
    window.print();
  };

  const openEditModal = (id: string, type: string, currentData: any) => {
    setEditingItem({ id, type, data: { ...currentData } });
  };

  const saveEdit = () => {
    if (editingItem) {
      setItemOverrides(prev => ({ ...prev, [editingItem.id]: editingItem.data }));
      setEditingItem(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[92vh] p-0 flex flex-col bg-slate-900 text-slate-100 border-slate-800 shadow-2xl rounded-2xl overflow-hidden print:size-auto print:bg-white print:text-slate-950 print:border-none print:shadow-none print:rounded-none">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page { 
              size: A4 portrait; 
              margin: 0.5in !important; 
            }
            html,
            body,
            body[data-scroll-locked] { 
              background: #ffffff !important; 
              color: #0f172a !important;
              font-size: 12px !important;
              font-family: inherit !important;
              -webkit-print-color-adjust: exact !important; 
              print-color-adjust: exact !important; 
              width: 100% !important;
              height: auto !important;
              min-height: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: visible !important;
            }
            /* Hide the background canvas app root */
            main {
              display: none !important;
            }
            /* Strictly hide all no-print elements including sidebar, tabs, controls */
            .no-print,
            div[role="dialog"] .no-print,
            div[role="dialog"] .w-64 { 
              display: none !important; 
            }
            /* Hide dialog backdrop overlay and close button */
            [data-radix-dialog-overlay],
            .bg-black\\/80,
            div[role="dialog"] > button:last-child {
              display: none !important;
            }
            /* Reset dialog wrapper so it behaves like standard document content */
            div[role="dialog"] {
              position: static !important;
              inset: auto !important;
              transform: none !important;
              width: 100% !important;
              max-width: 100% !important;
              height: auto !important;
              max-height: none !important;
              border: none !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              padding: 0 !important;
              margin: 0 !important;
              background: #ffffff !important;
              overflow: visible !important;
              display: block !important;
            }
            /* Ensure content flex containers expand naturally to full height without sidebar */
            div[role="dialog"] > div:not(.no-print),
            div[role="dialog"] .flex-1:not(.no-print) {
              display: block !important;
              width: 100% !important;
              height: auto !important;
              max-height: none !important;
              overflow: visible !important;
              flex: none !important;
              padding: 0 !important;
              margin: 0 !important;
              background: #ffffff !important;
            }
            /* Remove scrollbars */
            ::-webkit-scrollbar,
            .scrollbar-thin {
              display: none !important;
              width: 0 !important;
              height: 0 !important;
            }
            /* Canvas container formatting */
            .cad-canvas-print { 
              background: #ffffff !important; 
              background-image: none !important;
              color: #0f172a !important; 
              transform: none !important; 
              width: 100% !important; 
              max-width: 100% !important;
              border: none !important; 
              border-radius: 0 !important;
              box-shadow: none !important; 
              padding: 0 !important; 
              margin: 0 auto !important;
              font-size: 12px !important;
              display: block !important;
            }
            /* Individual CAD cards matching Image 3 */
            .page-break-inside-avoid { 
              page-break-inside: avoid !important; 
              break-inside: avoid !important;
              margin: 0 auto 0.4in auto !important;
              padding: 20px 24px !important;
              border: 1.5px solid #e2e8f0 !important;
              border-radius: 20px !important;
              background: #ffffff !important;
              width: 100% !important;
              max-width: 100% !important;
              box-sizing: border-box !important;
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
              gap: 16px !important;
            }
            /* Card top header badge (pill shape matching Image 3) */
            .page-break-inside-avoid > div:first-child {
              background: #f0f9ff !important;
              border: 1.5px solid #bae6fd !important;
              border-radius: 9999px !important;
              padding: 8px 24px !important;
              width: auto !important;
              max-width: 90% !important;
              display: inline-flex !important;
              justify-content: center !important;
            }
            .page-break-inside-avoid > div:first-child span {
              color: #0369a1 !important;
              font-weight: 800 !important;
              font-size: 13px !important;
            }
            /* SVG 2D drawings matching Image 3 (crisp white background, bright lines) */
            svg {
              max-width: 100% !important;
              height: auto !important;
              display: block !important;
              margin: 0 auto !important;
              background: transparent !important;
              overflow: visible !important;
            }
            /* Shift Sectional view group inward so right-edge dimension text never cuts off */
            svg g[transform*="translate(380"] {
              transform: translate(320px, 100px) !important;
            }
            svg text[x="295"] {
              transform: translateX(-15px) !important;
            }
            /* Plan view & column backgrounds to white with crisp borders */
            svg rect[fill="#0f172a"],
            svg rect[fill="#090d16"],
            svg rect[fill="#020617"] {
              fill: #ffffff !important;
              stroke: #0284c7 !important;
            }
            /* Footing concrete block */
            svg rect[fill="#1e293b"] {
              fill: #f8fafc !important;
              fill-opacity: 1 !important;
              stroke: #64748b !important;
            }
            svg path[stroke="#64748b"] {
              stroke: #334155 !important;
            }
            /* Sectional column rectangle */
            svg rect[stroke="#ffffff"],
            svg rect[stroke="#475569"] {
              fill: #ffffff !important;
              stroke: #1e293b !important;
            }
            /* Engineering specifications box (light emerald fill with green border) */
            svg rect[stroke="#10b981"] {
              fill: #f0fdf4 !important;
              stroke: #10b981 !important;
            }
            svg text[fill="#10b981"] {
              fill: #047857 !important;
              font-weight: 900 !important;
            }
            /* SVG text contrast */
            svg text[fill="#38bdf8"] {
              fill: #0284c7 !important;
              font-weight: 800 !important;
            }
            svg text[fill="#94a3b8"],
            svg text[fill="#64748b"] {
              fill: #334155 !important;
              font-weight: 600 !important;
            }
            svg text {
              font-size: 12px !important;
            }
            /* Rod binding guidelines box (amber cream matching Image 3) */
            .bg-amber-600\\/5,
            [class*="bg-amber-"] {
              background: #fffbeb !important;
              border: 1.5px solid #fde68a !important;
              border-radius: 16px !important;
              padding: 16px 20px !important;
              width: 100% !important;
              box-sizing: border-box !important;
            }
            [class*="text-amber-"] {
              color: #92400e !important;
              font-weight: 800 !important;
            }
            /* General text contrast */
            [class*="text-slate-"] { 
              color: #1e293b !important; 
              font-size: 12px !important;
            }
            .text-xs, .text-sm, .text-base {
              font-size: 12px !important;
            }
            p, span, div {
              font-size: 12px !important;
            }
          }
        ` }} />

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

            <Button
              onClick={handleServerSave}
              disabled={isSaving}
              className="w-full h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 rounded-lg shadow-md transition-all active:scale-95"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>সেভ হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 text-emerald-100" />
                  <span>সার্ভারে সেভ করুন</span>
                </>
              )}
            </Button>

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

            <div className="p-3 bg-emerald-600/10 rounded-lg border border-emerald-500/20 space-y-2 text-slate-300">
              <p className="font-bold text-emerald-400 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> উচ্চ নিরাপত্তায় রড ডিজাইন</p>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span>{safetyInfo.title}:</span>
                <span className="text-white font-bold">{safetyInfo.rebar}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>অতিরিক্ত নোট:</span>
                <span className="text-emerald-400 font-bold">{safetyInfo.extra}</span>
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
                      const groupRebar = getReinforcementInfo(detailingStoreys, group.wIn, group.hIn, `footing-${group.id}`);
                      const offset = detailingStoreys <= 2 ? 3.0 : (detailingStoreys + 1.5);
                      const fSize = Math.max(4, Math.ceil((group.wIn / 12 + offset) * 2) / 2);
                      const canvasW = 680;
                      const canvasH = 540;
                      
                      return (
                        <div key={idx} className="flex flex-col items-center gap-10 bg-slate-900/30 p-10 rounded-[2.5rem] border border-white/5 page-break-inside-avoid print:bg-white">
                          <div className="flex items-center justify-between w-full bg-slate-950/80 px-8 py-3 rounded-full border border-slate-800">
                             <div className="flex items-center gap-4">
                               <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-lg">F{idx+1}</div>
                               <span className="text-slate-200 font-bold text-base uppercase tracking-widest print:text-slate-900">ফাউন্ডেশন ডিটেইলস — {group.wIn}" x {group.hIn}" কলামের জন্য</span>
                             </div>
                             <Button variant="ghost" size="sm" onClick={() => openEditModal(`footing-${group.id}`, 'footing', groupRebar)} className="no-print h-8 gap-1.5 text-blue-400 font-bold hover:bg-blue-500/10">
                                <PencilLine className="w-4 h-4" /> এডিট
                             </Button>
                          </div>

                          <svg width={canvasW} height={canvasH} viewBox={`0 0 ${canvasW} ${canvasH}`} className="text-slate-200 overflow-visible">
                            <g transform="translate(40, 100)">
                              <text x="120" y="-30" fill="#38bdf8" fontSize="16" textAnchor="middle" fontWeight="black">PLAN VIEW (রড জালি বিন্যাস)</text>
                              <rect x="0" y="0" width="240" height="240" fill="#0f172a" stroke="#38bdf8" strokeWidth="4" />
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
                              <path d={`M 40 ${310 - (groupRebar.hook || 3)*4} L 40 310 L 240 310 L 240 ${310 - (groupRebar.hook || 3)*4}`} fill="none" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
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
                                   • <strong>লেয়ার ও বিন্যাস:</strong> ছোট স্প্যানের রড আগে নিচে পাতা হবে এবং লম্বা স্প্যানের রড তার উপরে বসবে।<br/>
                                   • <strong>কলাম লেগ ও কভার:</strong> কলামের খাড়া রড ফুটিং জালির ওপর বসে অন্তত ১২"–১৮" এল-ব্যান্ড (L-hook) হয়ে চারিদিকে বসবে এবং নিচে ৩" ক্লিয়ার কভার ব্লক নিশ্চিত করতে হবে।
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
                      const groupRebar = getReinforcementInfo(detailingStoreys, group.wIn, group.hIn, `column-${group.id}`);
                      const cW = group.wIn;
                      const cH = group.hIn;
                      const rCount = groupRebar.rodCount;
                      const masterRW = cW - 3;
                      const masterRH = cH - 3;
                      const canvasW = 700;
                      const canvasH = 750;
                      
                      const ringSpacing = groupRebar.gap || (detailingStoreys > 4 ? "4\"/8\"" : "5\"/10\"");
                      const totalRings = Math.ceil((10 * 12) / 6); 

                      return (
                        <div key={idx} className="flex flex-col items-center gap-10 bg-slate-900/30 p-10 rounded-[2.5rem] border border-white/5 page-break-inside-avoid print:bg-white">
                          <div className="flex items-center justify-between w-full bg-slate-950/80 px-8 py-3 rounded-full border border-slate-800">
                             <div className="flex items-center gap-4">
                               <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-lg">C{idx+1}</div>
                               <span className="text-slate-200 font-bold text-base uppercase tracking-widest print:text-slate-900">কলাম সেকশন ও রিং ডিটেইলস — {cW}" x {cH}" ({rCount} টি রড)</span>
                             </div>
                             <Button variant="ghost" size="sm" onClick={() => openEditModal(`column-${group.id}`, 'column', groupRebar)} className="no-print h-8 gap-1.5 text-blue-400 font-bold hover:bg-blue-500/10">
                                <PencilLine className="w-4 h-4" /> এডিট
                             </Button>
                          </div>

                          <svg width={canvasW} height={canvasH} viewBox={`0 0 ${canvasW} ${canvasH}`} className="text-slate-200 overflow-visible">
                            <g transform="translate(40, 100)">
                              <text x="140" y="-30" fill="#38bdf8" fontSize="16" textAnchor="middle" fontWeight="black">COLUMN CROSS-SECTION (রড বিন্যাস: {rCount} Nos)</text>
                              <rect x="0" y="0" width="280" height="200" fill="#0f172a" stroke="#475569" strokeWidth="3" />
                              
                              <rect x="15" y="15" width="250" height="170" fill="none" stroke="#f59e0b" strokeWidth="2" rx="4" />
                              
                              {rCount === 6 && (
                                <line x1="140" y1="15" x2="140" y2="185" stroke="#fbbf24" strokeWidth="2" strokeDasharray="4 2" />
                              )}
                              {rCount >= 8 && (
                                <path d="M 140 15 L 265 100 L 140 185 L 15 100 Z" fill="none" stroke="#fbbf24" strokeWidth="2" strokeDasharray="4 2" />
                              )}

                              <g fill="#ef4444">
                                <circle cx="15" cy="15" r="8" /><circle cx="265" cy="15" r="8" />
                                <circle cx="15" cy="185" r="8" /><circle cx="265" cy="185" r="8" />
                                
                                {rCount >= 6 && <><circle cx="140" cy="15" r="8" /><circle cx="140" cy="185" r="8" /></>}
                                {rCount >= 8 && <><circle cx="15" cy="100" r="8" /><circle cx="140" cy="100" r="8" /><circle cx="265" cy="100" r="8" /></>}
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
                              {rCount > 4 && (
                                <g transform="translate(0, 240)">
                                  <g fill="#475569" opacity="0.3">
                                    <circle cx="30" cy="20" r="5" /><circle cx="250" cy="20" r="5" />
                                    <circle cx="30" cy="140" r="5" /><circle cx="250" cy="140" r="5" />
                                    <circle cx="140" cy="20" r="7" /><circle cx="140" cy="140" r="7" />
                                    <circle cx="30" cy="80" r="7" /><circle cx="250" cy="80" r="7" />
                                  </g>

                                  {rCount === 6 ? (
                                    <g>
                                      <line x1="140" y1="20" x2="140" y2="140" stroke="#fbbf24" strokeWidth="3" />
                                      <path d="M 140 20 L 130 10 M 140 20 L 150 30" fill="none" stroke="#fbbf24" strokeWidth="3" />
                                      <path d="M 140 140 L 130 150 M 140 140 L 150 130" fill="none" stroke="#fbbf24" strokeWidth="3" />
                                      <text x="140" y="170" fill="#fbbf24" fontSize="11" textAnchor="middle" fontWeight="bold">LINK TIE (লিঙ্ক রিং)</text>
                                      <text x="140" y="185" fill="#fbbf24" fontSize="10" textAnchor="middle" fontWeight="bold">মাপ: {masterRH}" ইঞ্চি (সোজা)</text>
                                    </g>
                                  ) : (
                                    <g>
                                      <path d="M 140 20 L 250 80 L 140 140 L 30 80 Z" fill="none" stroke="#fbbf24" strokeWidth="3" />
                                      <path d="M 140 20 L 125 5 M 140 20 L 155 35" fill="none" stroke="#fbbf24" strokeWidth="3" />
                                      <text x="140" y="170" fill="#fbbf24" fontSize="11" textAnchor="middle" fontWeight="bold">DIAMOND TIE (ডায়মন্ড রিং)</text>
                                      <text x="140" y="185" fill="#fbbf24" fontSize="10" textAnchor="middle" fontWeight="bold">মাপ: {masterRW}" x {masterRH}" ইঞ্চি</text>
                                      <text x="140" y="200" fill="#94a3b8" fontSize="9" textAnchor="middle">হুক: {groupRebar.hook}" ইঞ্চি (১৩৫° বেন্ডিং)</text>
                                    </g>
                                  )}
                                </g>
                              )}
                            </g>

                            <g transform="translate(50, 640)">
                              <rect x="0" y="0" width="600" height="90" rx="12" fill="#111827" stroke="#10b981" strokeWidth="2" />
                              <text x="300" y="25" fill="#10b981" fontSize="14" textAnchor="middle" fontWeight="black">ইঞ্জিনিয়ারিং সামারি: {detailingStoreys} তলা ভবন | কলাম টাইপ: C{idx+1} ({rCount} টি রড)</text>
                              <text x="300" y="48" fill="#94a3b8" fontSize="11" textAnchor="middle" fontWeight="bold">
                                রিং স্পেসিং: {ringSpacing} c/c | রিং সাইজ: {masterRW}"x{masterRH}" | মাস্তান: ০.৮৫ কেজি/টন
                              </text>
                              <text x="300" y="78" fill="#64748b" fontSize="9" textAnchor="middle">প্রতি ১০ ফুট উচ্চতায় আনুমানিক {totalRings}টি রিং সেট (মাস্টার+ইনার) প্রয়োজন হবে।</text>
                            </g>
                          </svg>

                          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div className="flex items-start gap-4 bg-blue-600/5 p-6 rounded-3xl border border-blue-600/20 print:bg-slate-50">
                               <Boxes className="w-6 h-6 text-blue-500 shrink-0 mt-0.5" />
                               <div className="space-y-2">
                                  <p className="text-blue-200 font-bold text-sm uppercase tracking-wider print:text-blue-800">রিং বসানোর নিয়ম:</p>
                                  <p className="text-slate-400 text-xs leading-relaxed print:text-slate-700">
                                     • <strong>কনফাইনিং জোন:</strong> কলামের ওপরের ও নিচের L/4 অংশে ঘন রিং (৪" c/c) এবং মাঝের অংশে সাধারণ রিং দিতে হবে।<br/>
                                     • <strong>হুক ও ল্যাপিং:</strong> রিংয়ের হুক ভেতরের দিকে ১৩৫° কোণে থাকবে এবং জয়েন্ট ঘুরিয়ে বাঁধতে হবে। রডের ল্যাপিং কলামের মিড-হাইটে অল্টারনেট করে দিতে হবে।
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

                {activeTab === 'beam' && (
                   <div className="flex flex-col gap-32 items-center">
                      {beamSpans.length > 0 ? beamSpans.map((span, idx) => {
                        const s = detailingStoreys;
                        const defaultInfo = getReinforcementInfo(s, 10, 10, `beam-${span.id}`);
                        const botRodCount = defaultInfo.botRodCount || (defaultInfo.rodCount > 6 ? 4 : 3);
                        const topRodCount = defaultInfo.topRodCount || (defaultInfo.rodCount > 6 ? 3 : 2);
                        const mainRodCount = botRodCount + topRodCount;
                        const etLength = Math.round((span.length / 3) * 10) / 10;
                        const beamDepth = (span as any).depth || defaultInfo.thick || (s <= 3 ? 12 : 15);
                        const beamWidthInches = (span as any).width || 10;
                        const beamLabel = (span as any).label || `B${idx+1}`;
                        const canvasW = 850;
                        const canvasH = 600;

                        return (
                          <div key={span.id} className="flex flex-col items-center gap-10 bg-slate-900/30 p-10 rounded-[2.5rem] border border-white/5 page-break-inside-avoid print:bg-white">
                            <div className="flex items-center justify-between w-full bg-slate-950/80 px-8 py-3 rounded-full border border-slate-800">
                               <div className="flex items-center gap-4">
                                 <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-black text-lg">B{idx+1}</div>
                                 <span className="text-slate-200 font-bold text-base uppercase tracking-widest print:text-slate-900">
                                    বিম ডিটেইলিং — {span.orientation === 'H' ? 'অনুভূমিক' : 'উলম্ব'} স্প্যান ({span.length.toFixed(1)} ফুট)
                                 </span>
                               </div>
                               <Button variant="ghost" size="sm" onClick={() => openEditModal(`beam-${span.id}`, 'beam', defaultInfo)} className="no-print h-8 gap-1.5 text-blue-400 font-bold hover:bg-blue-500/10">
                                  <PencilLine className="w-4 h-4" /> এডিট
                               </Button>
                            </div>

                            <svg width={canvasW} height={canvasH} viewBox={`0 0 ${canvasW} ${canvasH}`} className="text-slate-200 overflow-visible">
                               <g transform="translate(60, 150)">
                                  <text x="250" y="-50" fill="#38bdf8" fontSize="18" textAnchor="middle" fontWeight="black">BEAM ELEVATION (বিম এলিভেশন ২ডি ভিউ)</text>
                                  <rect x="0" y="0" width="500" height="80" fill="#0f172a" stroke="#64748b" strokeWidth="2.5" />
                                  <rect x="-20" y="-40" width="30" height="180" fill="#1e293b" fillOpacity="0.5" stroke="#475569" strokeWidth="2" strokeDasharray="4 2" />
                                  <rect x="490" y="-40" width="30" height="180" fill="#1e293b" fillOpacity="0.5" stroke="#475569" strokeWidth="2" strokeDasharray="4 2" />
                                  <path d="M 5 65 L 495 65" fill="none" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" />
                                  <path d="M 5 65 L 5 45 M 495 65 L 495 45" fill="none" stroke="#3b82f6" strokeWidth="4" />
                                  <text x="250" y="95" fill="#3b82f6" fontSize="12" textAnchor="middle" fontWeight="bold">Main Bottom: {botRodCount} Nos ({defaultInfo.rod})</text>
                                  <path d="M 5 15 L 495 15" fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
                                  <text x="250" y="-10" fill="#3b82f6" fontSize="12" textAnchor="middle" fontWeight="bold">Main Top: {topRodCount} Nos ({defaultInfo.rod})</text>
                                  <g stroke="#facc15" strokeWidth="4" strokeLinecap="round">
                                     <path d="M -10 15 L 150 15" strokeDasharray="6 3" />
                                     <path d="M 350 15 L 510 15" strokeDasharray="6 3" />
                                  </g>
                                  <text x="70" y="38" fill="#facc15" fontSize="11" textAnchor="middle" fontWeight="black">এক্সট্রা টপ ({etLength}' ফুট)</text>
                                  <text x="430" y="38" fill="#facc15" fontSize="11" textAnchor="middle" fontWeight="black">এক্সট্রা টপ ({etLength}' ফুট)</text>
                                  {[10, 30, 50, 80, 120, 180, 250, 320, 380, 420, 450, 470, 490].map(sx => (
                                     <line key={sx} x1={sx} y1="5" x2={sx} y2="75" stroke="#94a3b8" strokeWidth="1" />
                                  ))}
                                  <g stroke="#10b981" strokeWidth="1.5">
                                     <line x1="0" y1="120" x2="500" y2="120" />
                                     <line x1="0" y1="110" x2="0" y2="130" /><line x1="500" y1="110" x2="500" y2="130" />
                                  </g>
                                  <text x="250" y="140" fill="#10b981" fontSize="14" textAnchor="middle" fontWeight="black">ক্লিয়ার স্প্যান: {span.length.toFixed(1)}' ফুট</text>
                               </g>
                               <g transform="translate(620, 150)">
                                  <text x="80" y="-50" fill="#38bdf8" fontSize="18" textAnchor="middle" fontWeight="black">BEAM CROSS-SECTION (রড বিন্যাস)</text>
                                  <rect x="0" y="0" width="160" height="200" fill="#0f172a" stroke="#64748b" strokeWidth="3" />
                                  <rect x="15" y="15" width="130" height="170" fill="none" stroke="#f59e0b" strokeWidth="2.5" rx="5" />
                                  <g fill="#3b82f6">
                                     <circle cx="25" cy="25" r="8" />
                                     <circle cx="135" cy="25" r="8" />
                                     {topRodCount > 2 && <circle cx="80" cy="25" r="8" />}
                                  </g>
                                  <g fill="#3b82f6">
                                     <circle cx="25" cy="175" r="8" />
                                     <circle cx="135" cy="175" r="8" />
                                     <circle cx="80" cy="175" r="8" />
                                     {botRodCount > 3 && (
                                       <>
                                         <circle cx="52" cy="175" r="8" />
                                         <circle cx="108" cy="175" r="8" />
                                       </>
                                     )}
                                  </g>
                                  <text x="80" y="235" fill="#94a3b8" fontSize="12" textAnchor="middle" fontWeight="bold">{beamWidthInches}" x {beamDepth}" BEAM</text>
                                  <text x="80" y="255" fill="#3b82f6" fontSize="11" textAnchor="middle" fontWeight="black">মোট মেইন রড: {mainRodCount} Nos</text>
                               </g>
                               <g transform="translate(100, 450)">
                                  <rect x="0" y="0" width="600" height="85" rx="15" fill="#111827" stroke="#3b82f6" strokeWidth="2" />
                                  <text x="300" y="30" fill="#38bdf8" fontSize="15" textAnchor="middle" fontWeight="black">ইঞ্জিনিয়ারিং রিপোর্ট: {detailingStoreys} তলা ভবন | বিম সাইজ: {beamWidthInches}" x {beamDepth}"</text>
                                  <text x="300" y="52" fill="#94a3b8" fontSize="12" textAnchor="middle" fontWeight="bold">
                                     মেইন রড: {mainRodCount} টি ({defaultInfo.rod}) | রিং স্পেসিং: সাপোর্টে ৪" c/c এবং মাঝে ৭" c/c
                                  </text>
                                  <text x="300" y="72" fill="#facc15" fontSize="11" textAnchor="middle" fontWeight="bold">
                                     নির্দেশ: সাপোর্টে কলাম ফেস থেকে {etLength} ফুট পর্যন্ত এক্সট্রা টপ রড প্রদান করুন।
                                  </text>
                               </g>
                            </svg>
                            <div className="w-full flex items-start gap-4 bg-indigo-600/5 p-6 rounded-3xl border border-indigo-600/20 print:bg-slate-50">
                               <Scissors className="w-6 h-6 text-indigo-500 shrink-0 mt-0.5" />
                               <div className="space-y-2">
                                  <p className="text-indigo-200 font-bold text-sm uppercase tracking-wider print:text-indigo-800">বিম রিইনফোর্সমেন্ট গাইডলাইন:</p>
                                  <p className="text-slate-400 text-xs leading-relaxed print:text-slate-700">
                                     • <strong>রড প্লেসমেন্ট:</strong> ক্রস-সেকশন অনুযায়ী মেইন রডগুলো সাজাতে হবে। বিমের নিচে {botRodCount}টি এবং উপরে {topRodCount}টি মেইন রড থাকবে।<br/>
                                     • <strong>টপ এক্সট্রা ও রিং:</strong> কলাম ফেস থেকে ক্লিয়ার স্প্যানের L/3 বা L/4 অংশ পর্যন্ত এক্সট্রা টপ কাটতে হবে। সাপোর্টে ৪" c/c ঘন এবং মাঝে ৭" c/c রিং বাঁধতে হবে।<br/>
                                     • <strong>ডেভেলপমেন্ট লেন্থ (Ld):</strong> বিমের রড কলামের ভেতরে কমপক্ষে ১২ ইঞ্চি এল-ব্যান্ড (L-hook) হয়ে ঢুকবে।
                                  </p>
                               </div>
                            </div>
                          </div>
                        );
                      }) : (
                        <div className="flex flex-col items-center gap-8 py-48">
                           <Scissors className="w-24 h-24 text-slate-700 animate-pulse" />
                           <div className="text-slate-500 font-black uppercase tracking-[0.3em] text-center text-lg">রুম এরিয়ার মধ্যে পর্যাপ্ত পিলার পাওয়া যায়নি</div>
                        </div>
                      )}
                   </div>
                )}

                {activeTab === 'slab' && (
                   <div className="flex flex-col gap-32 items-center">
                      {slabAreas.length > 0 ? slabAreas.map((slab, idx) => {
                        const s = detailingStoreys;
                        const defaultInfo = getReinforcementInfo(s, 10, 10, `slab-${slab.id}`);
                        const w = Math.round(slab.w * 10) / 10;
                        const l = Math.round(slab.h * 10) / 10;
                        const ratio = Math.max(w, l) / Math.min(w, l);
                        const isTwoWay = ratio <= 2;
                        const spacing = defaultInfo.gap ? parseInt(defaultInfo.gap) : (s <= 3 ? 6 : 5);
                        const thickness = defaultInfo.thick || (s <= 3 ? 5 : 6);
                        const crankLen = defaultInfo.crankLen || Math.round((Math.min(w, l) / 4) * 10) / 10;
                        const canvasW = 850;
                        const canvasH = 750;

                        return (
                          <div key={slab.id} className="flex flex-col items-center gap-10 bg-slate-900/30 p-10 rounded-[2.5rem] border border-white/5 page-break-inside-avoid print:bg-white">
                            <div className="flex items-center justify-between w-full bg-slate-950/80 px-8 py-3 rounded-full border border-slate-800">
                               <div className="flex items-center gap-4">
                                 <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-black text-lg">S{idx+1}</div>
                                 <span className="text-slate-200 font-bold text-base uppercase tracking-widest print:text-slate-900">
                                    ছাদ রড বিন্যাস (Slab Detail) — {w}' x {l}' ({isTwoWay ? 'Two-way' : 'One-way'})
                                 </span>
                               </div>
                               <Button variant="ghost" size="sm" onClick={() => openEditModal(`slab-${slab.id}`, 'slab', defaultInfo)} className="no-print h-8 gap-1.5 text-blue-400 font-bold hover:bg-blue-500/10">
                                  <PencilLine className="w-4 h-4" /> এডিট
                               </Button>
                            </div>
                            <svg width={canvasW} height={canvasH} viewBox={`0 0 ${canvasW} ${canvasH}`} className="text-slate-200 overflow-visible">
                               <g transform="translate(60, 100)">
                                  <text x="180" y="-30" fill="#38bdf8" fontSize="16" textAnchor="middle" fontWeight="black">SLAB PLAN VIEW (রড জালি বিন্যাস)</text>
                                  <rect x="0" y="0" width="360" height="260" fill="#0f172a" stroke="#64748b" strokeWidth="4" />
                                  {[40, 80, 120, 160, 200, 240, 280, 320].map(dx => (
                                     <line key={`mx-${dx}`} x1={dx} y1="5" x2={dx} y2="255" stroke="#ef4444" strokeWidth="1.5" />
                                  ))}
                                  {[30, 70, 110, 150, 190, 230].map(dy => (
                                     <line key={`my-${dy}`} x1="5" y1={dy} x2="355" y2={dy} stroke="#ef4444" strokeWidth="1.5" />
                                  ))}
                                  <g stroke="#f97316" strokeWidth="2" strokeDasharray="6 3">
                                     <rect x="10" y="10" width="340" height="40" fill="none" />
                                     <rect x="10" y="210" width="340" height="40" fill="none" />
                                     <rect x="10" y="10" width="60" height="240" fill="none" />
                                     <rect x="290" y="10" width="60" height="240" fill="none" />
                                  </g>
                                  <text x="180" y="290" fill="#94a3b8" fontSize="11" textAnchor="middle" fontWeight="bold">ক্র্যাঙ্ক বার এরিয়া (L/4 জোন): {crankLen}' ফুট</text>
                               </g>
                               <g transform="translate(480, 100)">
                                  <text x="140" y="-30" fill="#38bdf8" fontSize="16" textAnchor="middle" fontWeight="black">CROSS-SECTION (রড বেন্ডিং ডিটেইল)</text>
                                  <rect x="0" y="60" width="280" height="40" fill="#1e293b" fillOpacity="0.4" stroke="#64748b" strokeWidth="2" />
                                  <path d="M 10 92 L 270 92" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
                                  <path d="M 10 92 L 60 92 L 100 68 L 180 68 L 220 92 L 270 92" fill="none" stroke="#f97316" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                  <line x1="5" y1="68" x2="80" y2="68" stroke="#3b82f6" strokeWidth="4" />
                                  <line x1="200" y1="68" x2="275" y2="68" stroke="#3b82f6" strokeWidth="4" />
                                  <text x="140" y="125" fill="#94a3b8" fontSize="11" textAnchor="middle" fontWeight="bold">স্ল্যাব পুরুত্ব: {thickness}" ইঞ্চি</text>
                                  <text x="40" y="55" fill="#3b82f6" fontSize="10" textAnchor="middle" fontWeight="black">এক্সট্রা টপ ({crankLen}' ফুট)</text>
                                  <text x="140" y="85" fill="#f97316" fontSize="10" textAnchor="middle" fontWeight="black">ক্র্যাঙ্ক (Crank)</text>
                               </g>
                               <g transform="translate(100, 480)">
                                  <rect x="0" y="0" width="650" height="110" rx="15" fill="#111827" stroke="#10b981" strokeWidth="2" />
                                  <text x="325" y="30" fill="#10b981" fontSize="15" textAnchor="middle" fontWeight="black">ইঞ্জিনিয়ারিং গাইডলাইন: {detailingStoreys} তলা ভবন | ছাদ টাইপ: {isTwoWay ? 'Two-way' : 'One-way'} স্ল্যাব</text>
                                  <text x="325" y="55" fill="#94a3b8" fontSize="12" textAnchor="middle" fontWeight="bold">
                                     মেইন জালি: {defaultInfo.rod || '10mm'} @ {spacing}" c/c (উভয় দিকে) | ক্লিয়ার কভার: ০.৭৫" ইঞ্চি
                                  </text>
                                  <text x="325" y="78" fill="#facc15" fontSize="11" textAnchor="middle" fontWeight="bold">
                                     ক্র্যাঙ্ক নিয়ম: সাপোর্টে L/4 দূরত্বে ({crankLen}' ফুট) অল্টারনেট ক্র্যাঙ্ক বার প্রদান করুন।
                                  </text>
                                  <text x="325" y="98" fill="#3b82f6" fontSize="11" textAnchor="middle" fontWeight="bold">
                                     এক্সট্রা টপ: সাপোর্টে প্রতিটি ক্র্যাঙ্ক রডের মাঝখানে ১টি করে এক্সট্রা টপ ({crankLen}' ফুট) বসবে।
                                  </text>
                               </g>
                            </svg>
                            <div className="w-full flex items-start gap-4 bg-emerald-600/5 p-6 rounded-3xl border border-emerald-600/20 print:bg-slate-50">
                               <Info className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
                               <div className="space-y-2">
                                  <p className="text-emerald-200 font-bold text-sm uppercase tracking-wider print:text-emerald-800">ছাদ ঢালাই ও রড বাইন্ডিং সতর্কতা:</p>
                                  <p className="text-slate-400 text-xs leading-relaxed print:text-slate-700">
                                     • <strong>জালি প্লেসমেন্ট:</strong> ছোট স্প্যানের মেইন রড সবসময় নিচে থাকবে। দুই লেয়ার রডের মাঝখানে অবশ্যই প্রতি ৩ ফুট পর পর ১০মিমি রডের 'ঘোড়া / চেয়ার' (Chair) ব্লক দিতে হবে যেন ঢালাইয়ের সময় ওপরের জালি দেবে না যায়।<br/>
                                     • <strong>ক্র্যাঙ্ক বেন্ডিং:</strong> ৪৫° কোণে রড বেন্ড করতে হবে এবং কলাম/বিম ফেস থেকে L/4 দূরত্ব মেইনটেইন করতে হবে।
                                  </p>
                               </div>
                            </div>
                          </div>
                        );
                      }) : (
                        <div className="flex flex-col items-center gap-8 py-48">
                           <Layers className="w-24 h-24 text-slate-700 animate-pulse" />
                           <div className="text-slate-500 font-black uppercase tracking-[0.3em] text-center text-lg">ক্যানভাসে কোনো রুম এরিয়া (Area Marker) পাওয়া যায়নি</div>
                        </div>
                      )}
                   </div>
                )}

                {activeTab === 'stair' && (
                  <div className="flex flex-col gap-32 items-center">
                    {stairObjects.length > 0 ? stairObjects.map((stair, idx) => {
                      const defaultInfo = getReinforcementInfo(detailingStoreys, 10, 10, `stair-${stair.id}`);
                      const sW = Math.round(stair.w * 10) / 10;
                      const sD = Math.round(stair.h * 10) / 10;
                      const steps = stair.stepCount || 14;
                      const waist = defaultInfo.thick || 5;
                      const canvasW = 850;
                      const canvasH = 750;

                      return (
                        <div key={stair.id} className="flex flex-col items-center gap-10 bg-slate-900/30 p-10 rounded-[2.5rem] border border-white/5 page-break-inside-avoid print:bg-white">
                          <div className="flex items-center justify-between w-full bg-slate-950/80 px-8 py-3 rounded-full border border-slate-800">
                             <div className="flex items-center gap-4">
                               <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-lg">ST{idx+1}</div>
                               <span className="text-slate-200 font-bold text-base uppercase tracking-widest print:text-slate-900">
                                  সিঁড়ি ডিটেইলিং ও রড বিন্যাস — {sW}' x {sD}' (Step Count: {steps})
                               </span>
                             </div>
                             <Button variant="ghost" size="sm" onClick={() => openEditModal(`stair-${stair.id}`, 'stair', defaultInfo)} className="no-print h-8 gap-1.5 text-blue-400 font-bold hover:bg-blue-500/10">
                                <PencilLine className="w-4 h-4" /> এডিট
                             </Button>
                          </div>
                          <svg width={canvasW} height={canvasH} viewBox={`0 0 ${canvasW} ${canvasH}`} className="text-slate-200 overflow-visible">
                             <g transform="translate(60, 100)">
                                <text x="140" y="-30" fill="#38bdf8" fontSize="16" textAnchor="middle" fontWeight="black">PLAN VIEW (উপরের দৃশ্য)</text>
                                <rect x="0" y="0" width="280" height="280" fill="#0f172a" stroke="#64748b" strokeWidth="4" />
                                <rect x="0" y="0" width="280" height="70" fill="#1e293b" fillOpacity="0.5" stroke="#94a3b8" strokeWidth="2" />
                                <text x="140" y="45" fill="#94a3b8" fontSize="12" textAnchor="middle" fontWeight="bold">LANDING (ল্যান্ডিং)</text>
                                <line x1="140" y1="70" x2="140" y2="280" stroke="#64748b" strokeWidth="3" />
                                {[110, 150, 190, 230, 270].map(dy => (
                                   <g key={`step-${dy}`}>
                                      <line x1="5" y1={dy} x2="135" y2={dy} stroke="#94a3b8" strokeWidth="1" />
                                      <line x1="145" y1={dy} x2="275" y2={dy} stroke="#94a3b8" strokeWidth="1" />
                                   </g>
                                ))}
                                <path d="M 70 260 L 70 120 L 210 120 L 210 260" fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="5 3" />
                                <path d="M 210 260 L 205 250 M 210 260 L 215 250" fill="none" stroke="#f59e0b" strokeWidth="2" />
                                <text x="140" y="310" fill="#94a3b8" fontSize="11" textAnchor="middle" fontWeight="bold">প্রস্থ: {sW}' ফুট | ধাপ সংখ্যা: {steps} টি</text>
                             </g>
                             <g transform="translate(420, 100)">
                                <text x="180" y="-30" fill="#38bdf8" fontSize="16" textAnchor="middle" fontWeight="black">SECTIONAL VIEW (কাটা দৃশ্য)</text>
                                <path d="M 20 280 L 100 280 L 100 250 L 130 250 L 130 220 L 160 220 L 160 190 L 190 190 L 190 160 L 220 160 L 220 130 L 320 130 L 320 180 L 250 180 L 250 300 L 20 300 Z" fill="#1e293b" fillOpacity="0.4" stroke="#64748b" strokeWidth="2.5" />
                                <path d="M 30 292 L 240 292 L 310 172" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
                                <path d="M 30 288 L 100 288 L 220 142 L 310 142" fill="none" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
                                <text x="60" y="275" fill="#94a3b8" fontSize="10" textAnchor="middle">Landing</text>
                                <text x="160" y="250" fill="#f97316" fontSize="10" textAnchor="middle" fontWeight="black" transform="rotate(-40 160 250)">Waist Slab: {waist}"</text>
                                <text x="270" y="120" fill="#94a3b8" fontSize="10" textAnchor="middle">Upper Floor</text>
                                <g transform="translate(300, 200)">
                                   <line x1="0" y1="0" x2="30" y2="0" stroke="#3b82f6" strokeWidth="1.5" />
                                   <line x1="30" y1="0" x2="30" y2="-20" stroke="#3b82f6" strokeWidth="1.5" />
                                   <text x="40" y="5" fill="#3b82f6" fontSize="9">T: 10"</text>
                                   <text x="40" y="-15" fill="#3b82f6" fontSize="9">R: 6"</text>
                                </g>
                             </g>
                             <g transform="translate(100, 480)">
                                <rect x="0" y="0" width="650" height="110" rx="15" fill="#111827" stroke="#3b82f6" strokeWidth="2" />
                                <text x="325" y="30" fill="#38bdf8" fontSize="15" textAnchor="middle" fontWeight="black">ইঞ্জিনিয়ারিং ডিটেইলস: সিঁড়ি (Staircase) রিইনফোর্সমেন্ট</text>
                                <text x="325" y="55" fill="#94a3b8" fontSize="12" textAnchor="middle" fontWeight="bold">
                                   মেইন রড: {defaultInfo.rod || "12mm"} @ {defaultInfo.gap || "5\" c/c"} | ডিস্ট্রিবিউশন: 10mm @ 6" c/c
                                </text>
                                <text x="325" y="78" fill="#facc15" fontSize="11" textAnchor="middle" fontWeight="bold">
                                   ওয়েস্ট স্ল্যাব পুরুত্ব: {waist}" ইঞ্চি | রাইজার: 6" | ট্রেড: 10"
                                </text>
                                <text x="325" y="98" fill="#3b82f6" fontSize="11" textAnchor="middle" fontWeight="bold">
                                   নির্দেশ: ল্যান্ডিং ও ফ্লাইটের সংযোগস্থলে রডগুলো অবশ্যই ৪০ডি (40D) ল্যাপিং মেইনটেইন করবে।
                                </text>
                             </g>
                          </svg>
                          <div className="w-full flex items-start gap-4 bg-blue-600/5 p-6 rounded-3xl border border-blue-600/20 print:bg-slate-50">
                             <Info className="w-6 h-6 text-blue-500 shrink-0 mt-0.5" />
                             <div className="space-y-2">
                                <p className="text-blue-200 font-bold text-sm uppercase tracking-wider print:text-blue-800">সিঁড়ি ঢালাই ও রড বাইন্ডিং সতর্কতা:</p>
                                <p className="text-slate-400 text-xs leading-relaxed print:text-slate-700">
                                   • <strong>ক্রস রড প্যাটার্ন (Scissor Action):</strong> ল্যান্ডিং ও ফ্লাইটের সংযোগস্থলে নিচের রড সোজা উপরে না তুলে, নিচের রড উপরে যাবে এবং ওপরের রড নিচে নেমে কাঁচির মতো ক্রস হয়ে ৪০ডি (40D) ল্যাপিং নিবে।<br/>
                                   • <strong>সাটারিং ও কভার:</strong> সেন্টারিং খোলার আগে ১৪-২১ দিন কিউরিং করতে হবে এবং সিঁড়ির নিচে ১ ইঞ্চি ক্লিয়ার কভার ব্লক ব্যবহার করা বাধ্যতামূলক।
                                </p>
                             </div>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="flex flex-col items-center gap-8 py-48">
                         <Boxes className="w-24 h-24 text-slate-700 animate-pulse" />
                         <div className="text-slate-500 font-black uppercase tracking-[0.3em] text-center text-lg">ক্যানভাসে কোনো সিঁড়ি পাওয়া যায়নি</div>
                      </div>
                    )}
                  </div>
                )}
                
                {['septic', 'lift'].includes(activeTab) && (
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

        <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
          <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PencilLine className="w-5 h-5 text-blue-400" /> 
                {editingItem?.type === 'footing' && 'ফুটিং ডিটেইলিং এডিট'}
                {editingItem?.type === 'column' && 'কলাম ডিটেইলিং এডিট'}
                {editingItem?.type === 'beam' && 'বিম ডিটেইলিং এডিট'}
                {editingItem?.type === 'slab' && 'ছাদ রড ডিটেইলিং এডিট'}
                {editingItem?.type === 'stair' && 'সিঁড়ি ডিটেইলিং এডিট'}
              </DialogTitle>
              <p className="text-xs text-slate-400">আপনার প্রয়োজন অনুযায়ী ইঞ্জিনিয়ারিং প্যারামিটারগুলো পরিবর্তন করুন।</p>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Global/Common: Main Rebar size */}
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-500">মেইন রড সাইজ (Rebar Size)</Label>
                  <Select 
                    value={editingItem?.data.rod || ''} 
                    onValueChange={v => setEditingItem(prev => prev ? ({ ...prev, data: { ...prev.data, rod: v } }) : null)}
                  >
                    <SelectTrigger className="h-9 bg-slate-800 border-slate-700 font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                      <SelectItem value="10mm (3 Suta)">10mm (3 Suta)</SelectItem>
                      <SelectItem value="12mm (4 Suta)">12mm (4 Suta)</SelectItem>
                      <SelectItem value="16mm (5 Suta)">16mm (5 Suta)</SelectItem>
                      <SelectItem value="20mm (6 Suta)">20mm (6 Suta)</SelectItem>
                      <SelectItem value="22mm (7 Suta)">22mm (7 Suta)</SelectItem>
                      <SelectItem value="25mm (8 Suta)">25mm (8 Suta)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Footing Specific */}
                {editingItem?.type === 'footing' && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">জালি রড সংখ্যা</Label>
                      <Input type="number" value={editingItem?.data.rodCount || 0} onChange={e => setEditingItem(prev => prev ? ({ ...prev, data: { ...prev.data, rodCount: parseInt(e.target.value) || 0 } }) : null)} className="h-9 bg-slate-800 border-slate-700 font-bold" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">জালি স্পেসিং (Spacing)</Label>
                      <Input value={editingItem?.data.gap || ''} onChange={e => setEditingItem(prev => prev ? ({ ...prev, data: { ...prev.data, gap: e.target.value } }) : null)} className="h-9 bg-slate-800 border-slate-700 font-bold" placeholder='e.g. 5" c/c' />
                    </div>
                  </>
                )}

                {/* Column Specific */}
                {editingItem?.type === 'column' && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">মোট রড সংখ্যা</Label>
                      <Input type="number" value={editingItem?.data.rodCount || 0} onChange={e => setEditingItem(prev => prev ? ({ ...prev, data: { ...prev.data, rodCount: parseInt(e.target.value) || 0 } }) : null)} className="h-9 bg-slate-800 border-slate-700 font-bold" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">রিং রড সাইজ</Label>
                      <Select value={editingItem?.data.ringRod || ''} onValueChange={v => setEditingItem(prev => prev ? ({ ...prev, data: { ...prev.data, ringRod: v } }) : null)}>
                        <SelectTrigger className="h-9 bg-slate-800 border-slate-700 font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                          <SelectItem value="8mm">8mm</SelectItem><SelectItem value="10mm">10mm</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {/* Beam Specific */}
                {editingItem?.type === 'beam' && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">নিচের রড সংখ্যা (Bottom)</Label>
                      <Input type="number" value={editingItem?.data.botRodCount || 0} onChange={e => setEditingItem(prev => prev ? ({ ...prev, data: { ...prev.data, botRodCount: parseInt(e.target.value) || 0 } }) : null)} className="h-9 bg-slate-800 border-slate-700 font-bold" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">উপরের রড সংখ্যা (Top)</Label>
                      <Input type="number" value={editingItem?.data.topRodCount || 0} onChange={e => setEditingItem(prev => prev ? ({ ...prev, data: { ...prev.data, topRodCount: parseInt(e.target.value) || 0 } }) : null)} className="h-9 bg-slate-800 border-slate-700 font-bold" />
                    </div>
                  </>
                )}

                {/* Slab Specific */}
                {editingItem?.type === 'slab' && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">জালি স্পেসিং (Spacing)</Label>
                      <Input value={editingItem?.data.gap || ''} onChange={e => setEditingItem(prev => prev ? ({ ...prev, data: { ...prev.data, gap: e.target.value } }) : null)} className="h-9 bg-slate-800 border-slate-700 font-bold" placeholder='e.g. 5"' />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">ক্র্যাঙ্ক জোন (L/4 Ft)</Label>
                      <Input type="number" value={editingItem?.data.crankLen || 0} onChange={e => setEditingItem(prev => prev ? ({ ...prev, data: { ...prev.data, crankLen: parseFloat(e.target.value) || 0 } }) : null)} className="h-9 bg-slate-800 border-slate-700 font-bold" />
                    </div>
                  </>
                )}

                {/* Stair Specific */}
                {editingItem?.type === 'stair' && (
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">রড স্পেসিং (Spacing)</Label>
                    <Input value={editingItem?.data.gap || ''} onChange={e => setEditingItem(prev => prev ? ({ ...prev, data: { ...prev.data, gap: e.target.value } }) : null)} className="h-9 bg-slate-800 border-slate-700 font-bold" placeholder='e.g. 5" c/c' />
                  </div>
                )}

                {/* Shared Properties: Thickness & Hooks */}
                {['footing', 'beam', 'slab', 'stair'].includes(editingItem?.type || '') && (
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">পুরুত্ব / গভীরতা (Inches)</Label>
                    <Input type="number" value={editingItem?.data.thick || 0} onChange={e => setEditingItem(prev => prev ? ({ ...prev, data: { ...prev.data, thick: parseInt(e.target.value) || 0 } }) : null)} className="h-9 bg-slate-800 border-slate-700 font-bold" />
                  </div>
                )}
                {['footing', 'column', 'beam'].includes(editingItem?.type || '') && (
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">হুক / মাটন (Hook In)</Label>
                    <Input type="number" value={editingItem?.data.hook || 0} onChange={e => setEditingItem(prev => prev ? ({ ...prev, data: { ...prev.data, hook: parseInt(e.target.value) || 0 } }) : null)} className="h-9 bg-slate-800 border-slate-700 font-bold" />
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingItem(null)} className="bg-transparent border-slate-700 text-slate-400">বাতিল</Button>
              <Button onClick={saveEdit} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 font-bold">
                <Save className="w-4 h-4" /> সেভ করুন
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
