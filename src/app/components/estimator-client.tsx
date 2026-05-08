"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Building, Plus, Maximize, DoorClosed, Square, LayoutGrid, 
  RectangleHorizontal, RefreshCw, Trash2, X, MousePointer2,
  Download, Clipboard, Copy, Scissors, ChevronDown, 
  Shapes, Palette, Highlighter, Minus, Undo2, Redo2,
  Settings2, Move
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  estimatorSchema, type EstimatorValues
} from "@/app/lib/schemas";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

type DesignObject = {
  id: string;
  type: 'structure' | 'opening' | 'shape';
  subType: string;
  x: number; y: number; w: number; h: number;
  label: string; color: string; rotation: number;
};

export default function EstimatorClient() {
  const { toast } = useToast();
  const [designObjects, setDesignObjects] = useState<DesignObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [interactionMode, setInteractionMode] = useState<'none' | 'dragging' | 'resizing' | 'rotating'>('none');
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(30);
  const [snapPoint, setSnapPoint] = useState<{x: number, y: number} | null>(null);
  const [connectedGroup, setConnectedGroup] = useState<string[]>([]);
  
  const selectedObject = useMemo(() => designObjects.find(obj => obj.id === selectedObjectId), [designObjects, selectedObjectId]);

  const structuralForm = useForm<EstimatorValues>({
    resolver: zodResolver(estimatorSchema),
    defaultValues: { includeBase: true, includeColumn: true, includeBeam: true, baseCount: 1, baseLengthFt: 5, baseWidthFt: 5, baseThicknessIn: 18, columnCount: 1, columnLengthIn: 12, columnWidthIn: 10, columnHeightFt: 32, beamHeightIn: 12, beamWidthIn: 10, beamLengthFt: 12, columnRodCount: 8, beamRodCount: 6, mainRodFactor: 0.48, ringGapIn: 7, ringRodFactor: 0.12, baseRodLongitudinalCount: 10, baseRodWidthCount: 10 },
  });

  const formatFeetInches = (val: number) => {
    const feet = Math.floor(val);
    const inches = Math.round((val - feet) * 12);
    return `${feet}' ${inches}"`;
  };

  const parseFeetInches = (str: string) => {
    const match = str.match(/(\d+)'\s*(\d+)"/);
    if (match) return parseInt(match[1]) + parseInt(match[2]) / 12;
    const decimalMatch = str.match(/^(\d+(\.\d+)?)$/);
    if (decimalMatch) return parseFloat(str);
    return 0;
  };

  const getGroup = (startId: string, allObjs: DesignObject[]) => {
    const connected = new Set<string>();
    const stack = [startId];
    const threshold = 0.8; 

    while (stack.length > 0) {
      const currentId = stack.pop()!;
      if (connected.has(currentId)) continue;
      connected.add(currentId);

      const curr = allObjs.find(o => o.id === currentId);
      if (!curr) continue;

      allObjs.forEach(other => {
        if (connected.has(other.id)) return;
        const isNear = !(
          other.x > (curr.x + curr.w + threshold) ||
          (other.x + other.w) < (curr.x - threshold) ||
          other.y > (curr.y + curr.h + threshold) ||
          (other.y + other.h) < (curr.y - threshold)
        );
        if (isNear) stack.push(other.id);
      });
    }
    return Array.from(connected);
  };

  const addObject = (type: DesignObject['type'], subType: string, label: string) => {
    const newObj: DesignObject = {
      id: Math.random().toString(36).substr(2, 9),
      type, subType, x: 5, y: 5, w: subType === 'wall' ? 10 : 12, h: subType === 'wall' ? 0.2 : 10,
      label, color: subType === 'wall' ? '#000000' : '#ffffff', rotation: 0
    };
    setDesignObjects([...designObjects, newObj]);
    setSelectedObjectId(newObj.id);
  };

  const handleMouseDown = (e: React.MouseEvent, id: string, mode: any = 'dragging') => {
    e.stopPropagation();
    setSelectedObjectId(id);
    setInteractionMode(mode);
    const obj = designObjects.find(o => o.id === id);
    if (obj) {
      const rect = document.getElementById('canvas-workspace')?.getBoundingClientRect();
      if (rect) {
        setDragOffset({ x: (e.clientX - rect.left) / zoom - obj.x, y: (e.clientY - rect.top) / zoom - obj.y });
      }
      setConnectedGroup(getGroup(id, designObjects));
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!selectedObjectId || interactionMode === 'none') return;
    const rect = document.getElementById('canvas-workspace')?.getBoundingClientRect();
    if (!rect) return;
    
    const curX = (e.clientX - rect.left) / zoom;
    const curY = (e.clientY - rect.top) / zoom;
    const curr = designObjects.find(o => o.id === selectedObjectId);
    if (!curr) return;

    if (interactionMode === 'dragging') {
      const targetX = curX - dragOffset.x;
      const targetY = curY - dragOffset.y;
      
      let dx = targetX - curr.x;
      let dy = targetY - curr.y;

      const snapT = 0.8; 
      let activeSnap: {x: number, y: number} | null = null;

      designObjects.forEach(other => {
        if (connectedGroup.includes(other.id)) return;
        
        const snaps = [
          {x: other.x, y: other.y}, {x: other.x + other.w, y: other.y}, 
          {x: other.x, y: other.y + other.h}, {x: other.x + other.w, y: other.y + other.h},
          {x: other.x + other.w/2, y: other.y}, {x: other.x + other.w/2, y: other.y + other.h},
          {x: other.x, y: other.y + other.h/2}, {x: other.x + other.w, y: other.y + other.h/2}
        ];

        const myPoints = [
          {x: targetX, y: targetY}, {x: targetX + curr.w, y: targetY},
          {x: targetX, y: targetY + curr.h}, {x: targetX + curr.w, y: targetY + curr.h},
          {x: targetX + curr.w/2, y: targetY}, {x: targetX + curr.w/2, y: targetY + curr.h},
          {x: targetX, y: targetY + curr.h/2}, {x: targetX + curr.w, y: targetY + curr.h/2}
        ];

        myPoints.forEach((mp, i) => {
          snaps.forEach(sc => {
            const dist = Math.sqrt(Math.pow(mp.x - sc.x, 2) + Math.pow(mp.y - sc.y, 2));
            if (dist < snapT) {
              if (i === 0) { dx = sc.x - curr.x; dy = sc.y - curr.y; }
              else if (i === 1) { dx = sc.x - curr.w - curr.x; dy = sc.y - curr.y; }
              else if (i === 2) { dx = sc.x - curr.x; dy = sc.y - curr.h - curr.y; }
              else if (i === 3) { dx = sc.x - curr.w - curr.x; dy = sc.y - curr.h - curr.y; }
              else if (i === 4) { dx = sc.x - curr.w/2 - curr.x; dy = sc.y - curr.y; }
              else if (i === 5) { dx = sc.x - curr.w/2 - curr.x; dy = sc.y - curr.h - curr.y; }
              else if (i === 6) { dx = sc.x - curr.x; dy = sc.y - curr.h/2 - curr.y; }
              else if (i === 7) { dx = sc.x - curr.w - curr.x; dy = sc.y - curr.h/2 - curr.y; }
              activeSnap = sc;
            }
          });
        });

        if (Math.abs(targetX - other.x) < snapT) { dx = other.x - curr.x; if(!activeSnap) activeSnap = {x: other.x, y: targetY}; }
        if (Math.abs(targetY - other.y) < snapT) { dy = other.y - curr.y; if(!activeSnap) activeSnap = {x: targetX, y: other.y}; }
        if (Math.abs(targetX + curr.w - (other.x + other.w)) < snapT) { dx = (other.x + other.w) - curr.w - curr.x; if(!activeSnap) activeSnap = {x: other.x + other.w, y: targetY}; }
        if (Math.abs(targetY + curr.h - (other.y + other.h)) < snapT) { dy = (other.y + other.h) - curr.h - curr.y; if(!activeSnap) activeSnap = {x: targetX, y: other.y + other.h}; }
      });

      if (!activeSnap) {
        dx = Math.round((curr.x + dx) * 2) / 2 - curr.x;
        dy = Math.round((curr.y + dy) * 2) / 2 - curr.y;
      }

      setSnapPoint(activeSnap);
      setDesignObjects(objs => objs.map(o => connectedGroup.includes(o.id) ? { ...o, x: o.x + dx, y: o.y + dy } : o));
    } else if (interactionMode === 'resizing') {
      const nextW = Math.max(0.2, Math.round((curX - curr.x) * 2) / 2);
      const nextH = Math.max(0.1, Math.round((curY - curr.y) * 2) / 2);
      setDesignObjects(objs => objs.map(o => o.id === selectedObjectId ? { ...o, w: nextW, h: nextH } : o));
    } else if (interactionMode === 'rotating') {
      const cx = curr.x + curr.w / 2;
      const cy = curr.y + curr.h / 2;
      const angle = Math.atan2(curY - cy, curX - cx) * (180 / Math.PI);
      setDesignObjects(objs => objs.map(o => o.id === selectedObjectId ? { ...o, rotation: Math.round((angle + 90) / 15) * 15 } : o));
    }
  };

  const updateObject = (id: string, updates: Partial<DesignObject>) => {
    setDesignObjects(objs => objs.map(o => o.id === id ? { ...o, ...updates } : o));
  };

  const deleteObject = (id: string) => {
    setDesignObjects(designObjects.filter(o => o.id !== id));
    setSelectedObjectId(null);
  };

  return (
    <div className="w-full max-w-full mx-auto p-0 bg-slate-100 min-h-screen flex flex-col overflow-hidden">
      <Card className="shadow-none border-none overflow-hidden rounded-none bg-white flex-1 flex flex-col">
        <div className="bg-[#0f172a] p-2 text-white text-center shrink-0">
          <h1 className="text-sm font-bold flex items-center justify-center gap-2">
             <Building className="w-4 h-4 text-blue-400" /> আমার বাড়ি প্রফেশনাল ডিজাইন টুল (SmartDraw)
          </h1>
        </div>

        <Tabs defaultValue="design" className="w-full flex-1 flex flex-col overflow-hidden">
          <div className="w-full bg-slate-100 border-b overflow-hidden">
            <ScrollArea className="w-full" orientation="horizontal">
              <div className="flex h-auto bg-transparent px-4 py-1">
                <TabsList className="flex h-auto bg-transparent rounded-none border-none p-0">
                  <TabsTrigger value="structural" className="py-2 text-[12px] whitespace-nowrap">স্ট্রাকচার</TabsTrigger>
                  <TabsTrigger value="slab" className="py-2 text-[12px] whitespace-nowrap">ছাদ</TabsTrigger>
                  <TabsTrigger value="stair" className="py-2 text-[12px] whitespace-nowrap">সিঁড়ি</TabsTrigger>
                  <TabsTrigger value="brick" className="py-2 text-[12px] whitespace-nowrap">গাঁথুনি</TabsTrigger>
                  <TabsTrigger value="plaster" className="py-2 text-[12px] whitespace-nowrap">প্লাস্টার</TabsTrigger>
                  <TabsTrigger value="tile" className="py-2 text-[12px] whitespace-nowrap">টাইলস</TabsTrigger>
                  <TabsTrigger value="fullHouse" className="py-2 text-[12px] whitespace-nowrap">পূর্ণ বাড়ি</TabsTrigger>
                  <TabsTrigger value="design" className="py-2 text-[12px] bg-blue-600 text-white data-[state=active]:bg-blue-700 font-bold whitespace-nowrap">ডিজাইন টুল</TabsTrigger>
                </TabsList>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>

          <TabsContent value="design" className="p-0 m-0 bg-[#f8f9fa] flex flex-col flex-1 overflow-hidden">
            <div className="h-12 bg-white border-b flex items-center px-4 gap-4 shrink-0 shadow-sm z-30 overflow-x-auto">
              <div className="flex items-center gap-1 border-r pr-4">
                <ToolIconButton icon={<Download />} label="Export" />
                <ToolIconButton icon={<Clipboard />} label="Paste" />
                <ToolIconButton icon={<Copy />} label="Copy" />
                <ToolIconButton icon={<Scissors />} label="Cut" />
              </div>
              <div className="flex items-center gap-1 border-r pr-4">
                <ToolIconButton icon={<Plus />} label="Insert" />
                <ToolIconButton icon={<Undo2 />} />
                <ToolIconButton icon={<Redo2 />} />
              </div>
              <div className="flex items-center gap-1 border-r pr-4">
                <ToolIconButton icon={<Shapes />} label="Styles" />
                <ToolIconButton icon={<Palette />} label="Themes" />
                <ToolIconButton icon={<Highlighter />} label="Fill" />
                <ToolIconButton icon={<Minus />} label="Line" />
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              <div className="w-64 bg-white border-r flex flex-col z-20 shadow-lg shrink-0 overflow-hidden">
                <ScrollArea className="flex-1">
                  <Accordion type="multiple" defaultValue={["tools", "symbols"]} className="w-full">
                    <AccordionItem value="tools" className="border-none">
                      <AccordionTrigger className="px-4 py-2 hover:no-underline text-[12px] font-bold text-slate-700 bg-slate-50/50 uppercase tracking-wider">Design Tools</AccordionTrigger>
                      <AccordionContent className="p-4 space-y-2">
                        <Button variant="outline" className="w-full justify-start text-[11px] h-10 gap-2 bg-slate-900 text-white font-bold" onClick={() => addObject('structure', 'wall', 'দেয়াল')}><Maximize className="w-3 h-3"/> Add Single Wall</Button>
                        <Button variant="ghost" className="w-full justify-start text-[11px] h-9 gap-2" onClick={() => addObject('opening', 'door', 'দরজা')}><DoorClosed className="w-3 h-3"/> Add Door</Button>
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="symbols" className="border-none">
                      <AccordionTrigger className="px-4 py-2 hover:no-underline text-[12px] font-bold text-slate-700 bg-slate-50/50 uppercase tracking-wider">Room Shapes</AccordionTrigger>
                      <AccordionContent className="p-4">
                        <div className="grid grid-cols-3 gap-2">
                          <SymbolBox icon={<Square />} onClick={() => addObject('shape', 'room', 'রুম')} label="Room" />
                          <SymbolBox icon={<LayoutGrid />} onClick={() => addObject('shape', 'room', 'L-Room')} label="L-Room" />
                          <SymbolBox icon={<RectangleHorizontal />} onClick={() => addObject('shape', 'room', 'Hall')} label="Hall" />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </ScrollArea>
              </div>

              <div className="flex-1 relative flex flex-col bg-[#e9ecef] overflow-hidden">
                <div className="h-6 bg-white border-b flex items-end relative overflow-hidden z-10 select-none">
                  <div className="absolute left-6 h-full flex items-end" style={{ width: 10000 }}>
                    {Array.from({ length: 200 }).map((_, i) => (
                      <div key={i} className="border-l border-slate-300 h-2 flex flex-col justify-end text-[8px] text-slate-400 font-mono" style={{ width: zoom, minWidth: zoom }}>
                        <span className="pl-0.5 pb-0.5">{i}ft</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-1 overflow-hidden relative">
                  <div className="w-6 bg-white border-r flex flex-col items-end relative overflow-hidden z-10 select-none">
                    <div className="absolute top-0 w-full flex flex-col items-end" style={{ height: 10000 }}>
                      {Array.from({ length: 200 }).map((_, i) => (
                        <div key={i} className="border-t border-slate-300 w-2 flex items-center justify-end text-[8px] text-slate-400 font-mono" style={{ height: zoom, minHeight: zoom }}>
                          <span className="pr-0.5 rotate-90">{i}ft</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div 
                    id="canvas-workspace"
                    className="flex-1 relative bg-[#e9ecef] overflow-auto focus:outline-none"
                    onMouseMove={handleMouseMove}
                    onMouseUp={() => { setInteractionMode('none'); setSnapPoint(null); setConnectedGroup([]); }}
                    onClick={() => { if (interactionMode === 'none') setSelectedObjectId(null); }}
                  >
                    <div className="absolute inset-0" style={{ 
                        backgroundImage: `linear-gradient(#dee2e6 1px, transparent 1px), linear-gradient(90deg, #dee2e6 1px, transparent 1px)`,
                        backgroundSize: `${zoom}px ${zoom}px`, width: 10000, height: 10000, backgroundColor: 'white'
                      }}>
                      {snapPoint && (
                        <div className="absolute w-6 h-6 bg-blue-500 rounded-full z-50 animate-pulse border-2 border-white shadow-lg pointer-events-none"
                          style={{ left: snapPoint.x * zoom - 3, top: snapPoint.y * zoom - 3 }} />
                      )}

                      {designObjects.map(obj => (
                        <div key={obj.id} onMouseDown={(e) => handleMouseDown(e, obj.id)} onClick={(e) => e.stopPropagation()} 
                          className={cn("absolute flex items-center justify-center cursor-move select-none", selectedObjectId === obj.id ? "z-30" : "z-10")}
                          style={{ left: obj.x * zoom, top: obj.y * zoom, width: obj.w * zoom, height: obj.h * zoom, transform: `rotate(${obj.rotation}deg)`, backgroundColor: obj.subType === 'wall' ? '#000' : obj.color, border: selectedObjectId === obj.id ? '2px solid #2563eb' : (obj.subType === 'wall' ? 'none' : '1px solid #ccc') }}>
                          
                          <div className="absolute -top-7 left-0 right-0 flex flex-col items-center pointer-events-none">
                            <div className="w-full h-[1px] bg-blue-400 relative">
                               <div className="absolute left-0 -top-1 w-[1px] h-2 bg-blue-400" />
                               <div className="absolute right-0 -top-1 w-[1px] h-2 bg-blue-400" />
                            </div>
                            <span className="bg-white px-1.5 py-0.5 text-[10px] font-bold text-blue-600 -mt-3 z-10 shadow-sm border border-blue-100 rounded-sm whitespace-nowrap">
                              {formatFeetInches(obj.w)}
                            </span>
                          </div>

                          {obj.type === 'shape' && (
                             <div className="absolute -right-12 top-0 bottom-0 flex flex-row items-center pointer-events-none">
                                <div className="h-full w-[1px] bg-blue-400 relative">
                                   <div className="absolute top-0 -left-1 h-[1px] w-2 bg-blue-400" />
                                   <div className="absolute bottom-0 -left-1 h-[1px] w-2 bg-blue-400" />
                                </div>
                                <span className="bg-white px-1.5 py-0.5 text-[10px] font-bold text-blue-600 -ml-6 rotate-90 z-10 shadow-sm border border-blue-100 rounded-sm">
                                  {formatFeetInches(obj.h)}
                                </span>
                             </div>
                          )}

                          {selectedObjectId === obj.id && (
                            <>
                              <div className="absolute -top-14 left-1/2 -translate-x-1/2 w-8 h-8 bg-white border-2 border-blue-600 rounded-full shadow-lg flex items-center justify-center cursor-pointer hover:bg-blue-50 z-40" onMouseDown={(e) => handleMouseDown(e, obj.id, 'rotating')}>
                                <RefreshCw className="w-4 h-4 text-blue-600" />
                              </div>
                              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-blue-600 rounded-full cursor-se-resize z-40 border-2 border-white shadow-sm" onMouseDown={(e) => handleMouseDown(e, obj.id, 'resizing')} />
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="h-14 bg-white border-t flex items-center px-4 gap-6 shrink-0 z-30 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] overflow-x-auto no-scrollbar">
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Left</span>
                      <Input className="h-8 w-24 text-[11px] font-mono bg-slate-50 border-slate-200" value={selectedObject ? formatFeetInches(selectedObject.x) : ''} onChange={(e) => selectedObject && updateObject(selectedObject.id, { x: parseFeetInches(e.target.value) })} placeholder="0' 0&quot;" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Top</span>
                      <Input className="h-8 w-24 text-[11px] font-mono bg-slate-50 border-slate-200" value={selectedObject ? formatFeetInches(selectedObject.y) : ''} onChange={(e) => selectedObject && updateObject(selectedObject.id, { y: parseFeetInches(e.target.value) })} placeholder="0' 0&quot;" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Width</span>
                      <Input className="h-8 w-24 text-[11px] font-mono bg-slate-50 border-slate-200" value={selectedObject ? formatFeetInches(selectedObject.w) : ''} onChange={(e) => selectedObject && updateObject(selectedObject.id, { w: parseFeetInches(e.target.value) })} placeholder="0' 0&quot;" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Height</span>
                      <Input disabled={selectedObject?.subType === 'wall'} className="h-8 w-24 text-[11px] font-mono bg-slate-50 border-slate-200" value={selectedObject ? formatFeetInches(selectedObject.h) : ''} onChange={(e) => selectedObject && updateObject(selectedObject.id, { h: parseFeetInches(e.target.value) })} placeholder="0' 0&quot;" />
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-4 shrink-0 pr-2">
                    <Slider value={[zoom]} max={150} min={10} step={5} className="w-32" onValueChange={(val) => setZoom(val[0])} />
                    <span className="text-[11px] font-mono text-slate-500 w-12 text-right">{Math.round((zoom/30)*100)}%</span>
                  </div>
                </div>
              </div>

              <div className="w-72 bg-white border-l flex flex-col z-20 shadow-xl shrink-0">
                <div className="p-3 border-b bg-slate-50 flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-blue-600"/>
                  <span className="font-bold text-[11px] uppercase tracking-wider text-slate-600">Properties</span>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-0">
                    {selectedObject ? (
                      <div className="p-4 space-y-6">
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">{selectedObject.label} Edit</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedObjectId(null)}><X className="w-3 h-3"/></Button>
                          </div>
                          <Separator />
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label className="text-[10px] text-slate-500 uppercase font-bold">Width</Label>
                              <Input value={formatFeetInches(selectedObject.w)} onChange={(e) => updateObject(selectedObject.id, { w: parseFeetInches(e.target.value) })} className="h-9 font-mono bg-slate-50" />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[10px] text-slate-500 uppercase font-bold">Height</Label>
                              <Input disabled={selectedObject.subType === 'wall'} value={formatFeetInches(selectedObject.h)} onChange={(e) => updateObject(selectedObject.id, { h: parseFeetInches(e.target.value) })} className="h-9 font-mono bg-slate-50" />
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <Label className="text-[10px] text-slate-500 uppercase font-bold">Rotation (°)</Label>
                              <Input type="number" value={selectedObject.rotation} onChange={(e) => updateObject(selectedObject.id, { rotation: parseInt(e.target.value) || 0 })} className="h-9 w-20 text-center font-mono bg-slate-50" />
                            </div>
                            <Slider value={[selectedObject.rotation]} max={360} min={0} step={15} onValueChange={(val) => updateObject(selectedObject.id, { rotation: val[0] })} />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                             <Button variant="outline" className="h-8 text-[10px]" onClick={() => updateObject(selectedObject.id, { x: selectedObject.x - 0.5 })}><Move className="w-3 h-3 mr-1"/> Left</Button>
                             <Button variant="outline" className="h-8 text-[10px]" onClick={() => updateObject(selectedObject.id, { x: selectedObject.x + 0.5 })}><Move className="w-3 h-3 mr-1"/> Right</Button>
                             <Button variant="outline" className="h-8 text-[10px]" onClick={() => updateObject(selectedObject.id, { y: selectedObject.y - 0.5 })}><Move className="w-3 h-3 mr-1"/> Up</Button>
                             <Button variant="outline" className="h-8 text-[10px]" onClick={() => updateObject(selectedObject.id, { y: selectedObject.y + 0.5 })}><Move className="w-3 h-3 mr-1"/> Down</Button>
                          </div>
                          <Separator />
                          <Button variant="destructive" className="w-full text-xs font-bold py-5 shadow-sm" onClick={() => deleteObject(selectedObject.id)}><Trash2 className="w-4 h-4 mr-2"/> DELETE OBJECT</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="h-[400px] flex flex-col items-center justify-center p-8 text-center text-slate-300">
                        <MousePointer2 className="w-16 h-16 mb-6 opacity-10 animate-pulse" />
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Select an object <br/> on canvas to edit</p>
                      </div>
                    )}
                  </div>
                  <ScrollBar orientation="vertical" />
                </ScrollArea>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="structural" className="p-6 bg-white overflow-auto h-full">
             <div className="max-w-4xl mx-auto p-8 text-center text-slate-400">
                <p>এখানে স্ট্রাকচার ক্যালকুলেটর লোড হবে...</p>
             </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

function ToolIconButton({ icon, label }: { icon: React.ReactNode, label?: string }) {
  return (
    <Button variant="ghost" className="h-10 px-2.5 flex flex-col items-center justify-center gap-0.5 hover:bg-slate-100 transition-colors">
      <div className="flex items-center gap-1">
        {React.cloneElement(icon as React.ReactElement, { className: "w-4 h-4 text-slate-600" })}
      </div>
      {label && <span className="text-[8px] font-bold text-slate-500 leading-none uppercase tracking-tighter">{label}</span>}
    </Button>
  );
}

function SymbolBox({ icon, onClick, label }: { icon: React.ReactNode, onClick: () => void, label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 group cursor-pointer" onClick={onClick}>
      <div className="aspect-square w-full border border-slate-200 rounded-md flex items-center justify-center group-hover:bg-blue-50 group-hover:border-blue-400 transition-all bg-white shadow-sm">
        {React.cloneElement(icon as React.ReactElement, { className: "w-6 h-6 text-slate-400 group-hover:text-blue-500" })}
      </div>
      <span className="text-[9px] font-bold text-slate-400 group-hover:text-blue-600 uppercase tracking-tighter">{label}</span>
    </div>
  );
}
