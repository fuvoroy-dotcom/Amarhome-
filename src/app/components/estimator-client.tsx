
"use client";

import React, { useState, useMemo, useEffect } from "react";
import { 
  Building, Plus, DoorClosed, Square, LayoutGrid, 
  RectangleHorizontal, RefreshCw, Trash2, X, MousePointer2,
  Download, Clipboard, Copy, Scissors, Undo2, Redo2,
  Settings2, Move, Pencil, ZoomIn, ZoomOut, Maximize2,
  ChevronDown, Type, PaintBucket, Layers, FlipHorizontal, FlipVertical,
  BringToFront, SendToBack, Eraser, GripHorizontal, FileText, Menu as MenuIcon
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

type DesignObject = {
  id: string;
  type: 'structure' | 'opening' | 'shape';
  subType: string;
  x: number; y: number; w: number; h: number;
  label: string; color: string; rotation: number;
  flipH?: boolean;
  flipV?: boolean;
};

export default function EstimatorClient() {
  const { toast } = useToast();
  const [designObjects, setDesignObjects] = useState<DesignObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<DesignObject | null>(null);
  const [interactionMode, setInteractionMode] = useState<'none' | 'dragging' | 'resizing' | 'rotating' | 'drawing'>('none');
  const [drawStart, setDrawStart] = useState<{x: number, y: number} | null>(null);
  const [tempDrawEnd, setTempDrawEnd] = useState<{x: number, y: number} | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(30);
  const [snapPoint, setSnapPoint] = useState<{x: number, y: number} | null>(null);
  const [connectedGroup, setConnectedGroup] = useState<string[]>([]);
  
  const selectedObject = useMemo(() => designObjects.find(obj => obj.id === selectedObjectId), [designObjects, selectedObjectId]);

  const formatFeetInches = (val: number) => {
    const feet = Math.floor(val);
    const inches = Math.round((val - feet) * 12);
    return `${feet}' ${inches}"`;
  };

  const parseFeetInches = (str: string) => {
    if (!str) return 0;
    const match = str.match(/(\d+)'\s*(\d+)"/);
    if (match) return parseInt(match[1]) + parseInt(match[2]) / 12;
    const decimalMatch = str.match(/^(\d+(\.\d+)?)$/);
    if (decimalMatch) return parseFloat(str);
    return 0;
  };

  const getPoints = (obj: DesignObject) => {
    const rad = obj.rotation * (Math.PI / 180);
    return [
      { x: obj.x, y: obj.y },
      { x: obj.x + obj.w * Math.cos(rad), y: obj.y + obj.w * Math.sin(rad) }
    ];
  };

  const getGroup = (startId: string, allObjs: DesignObject[]) => {
    const connected = new Set<string>();
    const stack = [startId];
    const threshold = 0.5;

    while (stack.length > 0) {
      const currentId = stack.pop()!;
      if (connected.has(currentId)) continue;
      connected.add(currentId);

      const curr = allObjs.find(o => o.id === currentId);
      if (!curr) continue;
      const currPoints = getPoints(curr);

      allObjs.forEach(other => {
        if (connected.has(other.id)) return;
        const otherPoints = getPoints(other);
        let isNear = false;
        currPoints.forEach(p1 => {
          otherPoints.forEach(p2 => {
            const dist = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
            if (dist < threshold) isNear = true;
          });
        });
        if (isNear) stack.push(other.id);
      });
    }
    return Array.from(connected);
  };

  const addObject = (type: DesignObject['type'], subType: string, label: string) => {
    if (subType === 'wall') {
      setInteractionMode('drawing');
      toast({ title: "Drawing Mode", description: "Click and drag to draw a wall." });
      return;
    }
    const newObj: DesignObject = {
      id: Math.random().toString(36).substr(2, 9),
      type, subType, x: 10, y: 10, w: 10, h: 5,
      label, color: '#ffffff', rotation: 0
    };
    setDesignObjects([...designObjects, newObj]);
    setSelectedObjectId(newObj.id);
  };

  const findSnapPoint = (x: number, y: number, excludeIds: string[] = []) => {
    const threshold = 0.8;
    let bestSnap: {x: number, y: number} | null = null;
    let minDist = threshold;

    designObjects.forEach(obj => {
      if (excludeIds.includes(obj.id)) return;
      const points = getPoints(obj);
      points.forEach(p => {
        const d = Math.sqrt(Math.pow(x - p.x, 2) + Math.pow(y - p.y, 2));
        if (d < minDist) {
          minDist = d;
          bestSnap = p;
        }
      });
    });
    return bestSnap;
  };

  const handleMouseDown = (e: React.MouseEvent, id: string | null, mode: any = 'dragging') => {
    const rect = document.getElementById('canvas-workspace')?.getBoundingClientRect();
    if (!rect) return;
    const curX = (e.clientX - rect.left) / zoom;
    const curY = (e.clientY - rect.top) / zoom;

    if (interactionMode === 'drawing') {
      e.stopPropagation();
      const snapped = findSnapPoint(curX, curY);
      const startPos = snapped || { x: Math.round(curX * 2) / 2, y: Math.round(curY * 2) / 2 };
      setDrawStart(startPos);
      setTempDrawEnd(startPos);
      return;
    }

    if (id) {
      e.stopPropagation();
      setSelectedObjectId(id);
      setInteractionMode(mode);
      const obj = designObjects.find(o => o.id === id);
      if (obj) {
        setDragOffset({ x: curX - obj.x, y: curY - obj.y });
        setConnectedGroup(getGroup(id, designObjects));
      }
    } else {
      setSelectedObjectId(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = document.getElementById('canvas-workspace')?.getBoundingClientRect();
    if (!rect) return;
    const curX = (e.clientX - rect.left) / zoom;
    const curY = (e.clientY - rect.top) / zoom;

    if (interactionMode === 'drawing' && drawStart) {
      const snapped = findSnapPoint(curX, curY);
      setTempDrawEnd(snapped || { x: Math.round(curX * 2) / 2, y: Math.round(curY * 2) / 2 });
      setSnapPoint(snapped);
      return;
    }

    if (!selectedObjectId || interactionMode === 'none') return;
    const curr = designObjects.find(o => o.id === selectedObjectId);
    if (!curr) return;

    if (interactionMode === 'dragging') {
      const dx = (Math.round((curX - dragOffset.x) * 2) / 2) - curr.x;
      const dy = (Math.round((curY - dragOffset.y) * 2) / 2) - curr.y;
      
      const nextX = curr.x + dx;
      const nextY = curr.y + dy;
      const snapped = findSnapPoint(nextX, nextY, connectedGroup);
      setSnapPoint(snapped);

      setDesignObjects(objs => objs.map(o => 
        connectedGroup.includes(o.id) ? { ...o, x: o.x + dx, y: o.y + dy } : o
      ));
    } else if (interactionMode === 'resizing') {
      const nextW = Math.max(0.5, Math.round((curX - curr.x) * 2) / 2);
      const nextH = Math.max(0.5, Math.round((curY - curr.y) * 2) / 2);
      updateObject(selectedObjectId, { w: nextW, h: nextH });
    } else if (interactionMode === 'rotating') {
      const cx = curr.x + curr.w / 2;
      const cy = curr.y + curr.h / 2;
      const angle = Math.atan2(curY - cy, curX - cx) * (180 / Math.PI);
      updateObject(selectedObjectId, { rotation: Math.round(angle / 15) * 15 });
    }
  };

  const handleMouseUp = () => {
    if (interactionMode === 'drawing' && drawStart && tempDrawEnd) {
      const dx = tempDrawEnd.x - drawStart.x;
      const dy = tempDrawEnd.y - drawStart.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length > 0.5) {
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        const newWall: DesignObject = {
          id: Math.random().toString(36).substr(2, 9),
          type: 'structure', subType: 'wall', 
          x: drawStart.x, y: drawStart.y, 
          w: length, h: 0.1,
          label: 'Wall', color: '#000000', rotation: angle
        };
        setDesignObjects([...designObjects, newWall]);
        setSelectedObjectId(newWall.id);
      }
      setDrawStart(null);
      setTempDrawEnd(null);
      setInteractionMode('none');
    }
    setInteractionMode('none');
    setSnapPoint(null);
    setConnectedGroup([]);
  };

  const updateObject = (id: string, updates: Partial<DesignObject>) => {
    setDesignObjects(objs => objs.map(o => o.id === id ? { ...o, ...updates } : o));
  };

  const deleteObject = (id: string | null) => {
    if (!id) return;
    setDesignObjects(designObjects.filter(o => o.id !== id));
    setSelectedObjectId(null);
  };

  const copyObject = () => {
    if (selectedObject) {
      setClipboard({ ...selectedObject, id: Math.random().toString(36).substr(2, 9) });
      toast({ title: "Copied", description: `${selectedObject.label} copied to clipboard.` });
    }
  };

  const pasteObject = () => {
    if (clipboard) {
      const newObj = { ...clipboard, x: clipboard.x + 2, y: clipboard.y + 2, id: Math.random().toString(36).substr(2, 9) };
      setDesignObjects([...designObjects, newObj]);
      setSelectedObjectId(newObj.id);
      toast({ title: "Pasted", description: "Object pasted into workspace." });
    }
  };

  const bringToFront = () => {
    if (!selectedObjectId) return;
    const item = designObjects.find(o => o.id === selectedObjectId);
    if (!item) return;
    const filtered = designObjects.filter(o => o.id !== selectedObjectId);
    setDesignObjects([...filtered, item]);
  };

  const sendToBack = () => {
    if (!selectedObjectId) return;
    const item = designObjects.find(o => o.id === selectedObjectId);
    if (!item) return;
    const filtered = designObjects.filter(o => o.id !== selectedObjectId);
    setDesignObjects([item, ...filtered]);
  };

  const flipH = () => {
    if (selectedObjectId) updateObject(selectedObjectId, { flipH: !selectedObject?.flipH });
  };

  const flipV = () => {
    if (selectedObjectId) updateObject(selectedObjectId, { flipV: !selectedObject?.flipV });
  };

  return (
    <div className="w-full max-w-full mx-auto p-0 bg-slate-100 min-h-screen flex flex-col overflow-hidden">
      {/* Top Header */}
      <div className="h-10 bg-[#f1f3f4] border-b flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-sm text-slate-700">smartdraw</span>
          </div>
          <nav className="flex gap-4">
            {['File', 'Home', 'Design', 'Page', 'Table', 'Options', 'Support'].map(item => (
              <Button key={item} variant="ghost" className="h-8 px-2 text-[11px] font-medium text-slate-600 hover:bg-slate-200">{item}</Button>
            ))}
          </nav>
        </div>
        <Button className="bg-orange-400 hover:bg-orange-500 h-7 text-[11px] px-4 font-bold text-white rounded">Buy</Button>
      </div>

      {/* Main Functional Ribbon */}
      <div className="h-16 bg-white border-b flex items-center px-4 gap-2 shrink-0 shadow-sm z-30 overflow-x-auto no-scrollbar">
        <div className="flex flex-col items-center border-r pr-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-12 flex flex-col gap-1 px-3">
                <Download className="w-4 h-4 text-slate-600"/>
                <span className="text-[9px] uppercase font-bold text-slate-500">Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => toast({ title: "Exporting..." })}>Export as PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast({ title: "Exporting..." })}>Export as PNG</DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast({ title: "Exporting..." })}>Export as SVG</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-1 border-r pr-2">
          <RibbonButton icon={<Clipboard />} label="Paste" onClick={pasteObject} disabled={!clipboard} />
          <div className="flex flex-col gap-1">
            <RibbonIconButton icon={<Copy />} label="Copy" onClick={copyObject} />
            <RibbonIconButton icon={<Scissors />} label="Cut" onClick={() => { copyObject(); deleteObject(selectedObjectId); }} />
          </div>
          <RibbonButton icon={<Pencil />} label="Format Painter" />
        </div>

        <div className="flex items-center gap-1 border-r pr-2">
           <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-12 flex flex-col gap-1 px-3">
                <Plus className="w-4 h-4 text-slate-600"/>
                <span className="text-[9px] uppercase font-bold text-slate-500">Insert</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => addObject('structure', 'wall', 'দেয়াল')}>Wall (Free Draw)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => addObject('shape', 'room', 'রুম')}>Square Room</DropdownMenuItem>
              <DropdownMenuItem onClick={() => addObject('shape', 'room', 'L-Room')}>L-Shaped Room</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => addObject('opening', 'door', 'দরজা')}>Door</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-1 border-r pr-2">
          <RibbonIconButton icon={<Undo2 />} label="Undo" />
          <RibbonIconButton icon={<Redo2 />} label="Redo" />
        </div>

        <div className="flex items-center gap-1 border-r pr-2">
          <RibbonButton icon={<PaintBucket />} label="Fill" />
          <RibbonButton icon={<GripHorizontal />} label="Line Style" />
          <RibbonButton icon={<Maximize2 />} label="Effects" />
        </div>

        <div className="flex items-center gap-3 border-r pr-2">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <select className="h-6 w-24 text-[10px] border rounded bg-slate-50">
                <option>Arial</option>
                <option>Times New Roman</option>
                <option>Inter</option>
              </select>
              <select className="h-6 w-12 text-[10px] border rounded bg-slate-50">
                <option>10</option>
                <option>12</option>
                <option>14</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Type className="w-3 h-3 text-slate-400"/>
              <span className="font-bold text-xs">B I U</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-1">
            <div className="flex gap-2">
              <RibbonIconButton icon={<BringToFront />} onClick={bringToFront} />
              <RibbonIconButton icon={<SendToBack />} onClick={sendToBack} />
            </div>
            <div className="flex gap-2">
              <RibbonIconButton icon={<FlipHorizontal />} onClick={flipH} />
              <RibbonIconButton icon={<FlipVertical />} onClick={flipV} />
            </div>
          </div>
          <RibbonButton icon={<Eraser />} label="Delete" variant="destructive" onClick={() => deleteObject(selectedObjectId)} />
        </div>
      </div>

      <Tabs defaultValue="design" className="w-full flex-1 flex flex-col overflow-hidden">
        <div className="w-full bg-slate-100 border-b overflow-hidden shrink-0">
          <ScrollArea orientation="horizontal" className="w-full h-11">
            <div className="flex h-full bg-transparent px-4">
              <TabsList className="flex h-full bg-transparent rounded-none border-none p-0">
                <TabsTrigger value="structural" className="px-4 text-[11px] whitespace-nowrap">স্ট্রাকচার</TabsTrigger>
                <TabsTrigger value="slab" className="px-4 text-[11px] whitespace-nowrap">ছাদ</TabsTrigger>
                <TabsTrigger value="stair" className="px-4 text-[11px] whitespace-nowrap">সিঁড়ি</TabsTrigger>
                <TabsTrigger value="brick" className="px-4 text-[11px] whitespace-nowrap">গাঁথুনি</TabsTrigger>
                <TabsTrigger value="plaster" className="px-4 text-[11px] whitespace-nowrap">প্লাস্টার</TabsTrigger>
                <TabsTrigger value="tile" className="px-4 text-[11px] whitespace-nowrap">টাইলস</TabsTrigger>
                <TabsTrigger value="fullHouse" className="px-4 text-[11px] whitespace-nowrap">পূর্ণ বাড়ি</TabsTrigger>
                <TabsTrigger value="design" className="px-4 text-[11px] data-[state=active]:bg-blue-600 data-[state=active]:text-white font-bold whitespace-nowrap">ডিজাইন টুল</TabsTrigger>
              </TabsList>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>

        <TabsContent value="design" className="p-0 m-0 bg-[#f8f9fa] flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar Library */}
            <div className="w-60 bg-white border-r flex flex-col z-20 shadow-md shrink-0 overflow-hidden">
              <div className="p-2 border-b bg-slate-50 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Library</span>
                <MenuIcon className="w-3 h-3 text-slate-400"/>
              </div>
              <ScrollArea className="flex-1">
                <Accordion type="multiple" defaultValue={["tools", "symbols"]} className="w-full">
                  <AccordionItem value="tools" className="border-none">
                    <AccordionTrigger className="px-3 py-2 hover:no-underline text-[11px] font-bold text-slate-600 bg-slate-50/30">Walls & Structure</AccordionTrigger>
                    <AccordionContent className="p-3 space-y-2">
                      <Button variant="outline" className={cn("w-full justify-start text-[11px] h-9 gap-2 font-bold", interactionMode === 'drawing' ? "bg-blue-600 text-white" : "bg-white")} onClick={() => addObject('structure', 'wall', 'দেয়াল')}><Pencil className="w-3 h-3"/> {interactionMode === 'drawing' ? "Drawing..." : "Draw Single Wall"}</Button>
                      <Button variant="ghost" className="w-full justify-start text-[11px] h-9 gap-2" onClick={() => addObject('opening', 'door', 'দরজা')}><DoorClosed className="w-3 h-3"/> Add Door</Button>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="symbols" className="border-none">
                    <AccordionTrigger className="px-3 py-2 hover:no-underline text-[11px] font-bold text-slate-600 bg-slate-50/30">Room Symbols</AccordionTrigger>
                    <AccordionContent className="p-3">
                      <div className="grid grid-cols-3 gap-2">
                        <SymbolBox icon={<Square />} onClick={() => addObject('shape', 'room', 'রুম')} label="Room" />
                        <SymbolBox icon={<LayoutGrid />} onClick={() => addObject('shape', 'room', 'L-Room')} label="L-Room" />
                        <SymbolBox icon={<RectangleHorizontal />} onClick={() => addObject('shape', 'room', 'Hall')} label="Hall" />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
                <ScrollBar orientation="vertical" />
              </ScrollArea>
            </div>

            <div className="flex-1 relative flex flex-col bg-[#e9ecef] overflow-hidden">
              {/* Horizontal Ruler */}
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
                {/* Vertical Ruler */}
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
                  className="flex-1 relative bg-[#e9ecef] overflow-auto focus:outline-none cursor-crosshair"
                  onMouseDown={(e) => handleMouseDown(e, null)}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                >
                  <div className="absolute inset-0" style={{ 
                      backgroundImage: `linear-gradient(#dee2e6 1px, transparent 1px), linear-gradient(90deg, #dee2e6 1px, transparent 1px)`,
                      backgroundSize: `${zoom}px ${zoom}px`, width: 10000, height: 10000, backgroundColor: 'white'
                    }}>
                    {snapPoint && (
                      <div className="absolute w-5 h-5 bg-blue-500 rounded-full z-50 animate-pulse border-2 border-white shadow-lg pointer-events-none"
                        style={{ left: snapPoint.x * zoom - 10, top: snapPoint.y * zoom - 10 }} />
                    )}

                    {interactionMode === 'drawing' && drawStart && tempDrawEnd && (
                      <div className="absolute bg-blue-500/20 border-2 border-blue-500 z-40 pointer-events-none"
                        style={{ 
                          left: drawStart.x * zoom, 
                          top: drawStart.y * zoom, 
                          width: Math.sqrt(Math.pow(tempDrawEnd.x - drawStart.x, 2) + Math.pow(tempDrawEnd.y - drawStart.y, 2)) * zoom,
                          height: 4,
                          transformOrigin: '0 50%',
                          transform: `rotate(${Math.atan2(tempDrawEnd.y - drawStart.y, tempDrawEnd.x - drawStart.x)}rad)`
                        }}>
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-1.5 py-0.5 text-[10px] rounded font-bold shadow-sm">
                          {formatFeetInches(Math.sqrt(Math.pow(tempDrawEnd.x - drawStart.x, 2) + Math.pow(tempDrawEnd.y - drawStart.y, 2)))}
                        </span>
                      </div>
                    )}

                    {designObjects.map(obj => {
                      const isWall = obj.subType === 'wall';
                      const isSelected = selectedObjectId === obj.id;
                      return (
                        <div key={obj.id} onMouseDown={(e) => handleMouseDown(e, obj.id)} onClick={(e) => e.stopPropagation()} 
                          className={cn("absolute flex items-center justify-center cursor-move select-none", isSelected ? "z-30" : "z-10")}
                          style={{ 
                            left: obj.x * zoom, 
                            top: obj.y * zoom, 
                            width: obj.w * zoom, 
                            height: isWall ? 4 : obj.h * zoom, 
                            transformOrigin: '0 50%',
                            transform: `rotate(${obj.rotation}deg) scaleX(${obj.flipH ? -1 : 1}) scaleY(${obj.flipV ? -1 : 1})`, 
                            backgroundColor: isWall ? '#000' : obj.color, 
                            border: isSelected ? '2px solid #2563eb' : (isWall ? 'none' : '1px solid #ccc') 
                          }}>
                          
                          <div className="absolute -top-7 left-0 right-0 flex flex-col items-center pointer-events-none" style={{ transform: `rotate(${-obj.rotation}deg)` }}>
                            <span className="bg-white px-1.5 py-0.5 text-[10px] font-bold text-blue-600 shadow-sm border border-blue-100 rounded-sm whitespace-nowrap">
                              {formatFeetInches(obj.w)}
                              {!isWall && ` x ${formatFeetInches(obj.h)}`}
                            </span>
                          </div>

                          {isSelected && (
                            <>
                              <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-7 h-7 bg-white border-2 border-blue-600 rounded-full shadow-lg flex items-center justify-center cursor-pointer z-40" onMouseDown={(e) => handleMouseDown(e, obj.id, 'rotating')}>
                                <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                              </div>
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-600 rounded-full cursor-se-resize z-40 border-2 border-white shadow-md" onMouseDown={(e) => handleMouseDown(e, obj.id, 'resizing')} />
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Functional Bottom Bar */}
              <div className="h-14 bg-white border-t flex items-center px-4 gap-4 shrink-0 z-30 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Left</span>
                    <Input 
                      className="h-8 w-24 text-[11px] font-mono" 
                      value={selectedObject ? formatFeetInches(selectedObject.x) : ''} 
                      onChange={(e) => selectedObject && updateObject(selectedObject.id, { x: parseFeetInches(e.target.value) })} 
                      placeholder="0' 0&quot;" 
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Top</span>
                    <Input 
                      className="h-8 w-24 text-[11px] font-mono" 
                      value={selectedObject ? formatFeetInches(selectedObject.y) : ''} 
                      onChange={(e) => selectedObject && updateObject(selectedObject.id, { y: parseFeetInches(e.target.value) })} 
                      placeholder="0' 0&quot;" 
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Width</span>
                    <Input 
                      className="h-8 w-24 text-[11px] font-mono" 
                      value={selectedObject ? formatFeetInches(selectedObject.w) : ''} 
                      onChange={(e) => selectedObject && updateObject(selectedObject.id, { w: parseFeetInches(e.target.value) })} 
                      placeholder="0' 0&quot;" 
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Height</span>
                    <Input 
                      disabled={selectedObject?.subType === 'wall'} 
                      className="h-8 w-24 text-[11px] font-mono" 
                      value={selectedObject ? formatFeetInches(selectedObject.h) : ''} 
                      onChange={(e) => selectedObject && updateObject(selectedObject.id, { h: parseFeetInches(e.target.value) })} 
                      placeholder="0' 0&quot;" 
                    />
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-4 shrink-0">
                  <ToolIconButton icon={<ZoomOut />} onClick={() => setZoom(z => Math.max(10, z - 5))} />
                  <Slider value={[zoom]} max={150} min={10} step={5} className="w-24" onValueChange={(val) => setZoom(val[0])} />
                  <ToolIconButton icon={<ZoomIn />} onClick={() => setZoom(z => Math.min(150, z + 5))} />
                  <span className="text-[10px] font-mono text-slate-500 w-10 text-right">{Math.round((zoom/30)*100)}%</span>
                </div>
              </div>
            </div>

            {/* Properties Right Panel */}
            <div className="w-72 bg-white border-l flex flex-col z-20 shadow-xl shrink-0">
              <div className="p-3 border-b bg-slate-50 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-blue-600"/>
                <span className="font-bold text-[11px] uppercase tracking-wider text-slate-600">Object Properties</span>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">
                  {selectedObject ? (
                    <>
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
                        <Slider value={[selectedObject.rotation]} max={360} min={-360} step={15} onValueChange={(val) => updateObject(selectedObject.id, { rotation: val[0] })} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                         <Button variant="outline" className="h-8 text-[10px]" onClick={() => updateObject(selectedObject.id, { x: selectedObject.x - 0.5 })}><Move className="w-3 h-3 mr-1"/> Left</Button>
                         <Button variant="outline" className="h-8 text-[10px]" onClick={() => updateObject(selectedObject.id, { x: selectedObject.x + 0.5 })}><Move className="w-3 h-3 mr-1"/> Right</Button>
                         <Button variant="outline" className="h-8 text-[10px]" onClick={() => updateObject(selectedObject.id, { y: selectedObject.y - 0.5 })}><Move className="w-3 h-3 mr-1"/> Up</Button>
                         <Button variant="outline" className="h-8 text-[10px]" onClick={() => updateObject(selectedObject.id, { y: selectedObject.y + 0.5 })}><Move className="w-3 h-3 mr-1"/> Down</Button>
                      </div>
                      <Separator />
                      <Button variant="destructive" className="w-full text-xs font-bold py-5" onClick={() => deleteObject(selectedObjectId)}><Eraser className="w-4 h-4 mr-2"/> DELETE OBJECT</Button>
                    </>
                  ) : (
                    <div className="h-[400px] flex flex-col items-center justify-center text-center text-slate-300">
                      <MousePointer2 className="w-12 h-12 mb-4 opacity-10 animate-pulse" />
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Select an object <br/> to edit</p>
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
    </div>
  );
}

function RibbonButton({ icon, label, onClick, disabled, variant = "ghost" }: { icon: React.ReactNode, label: string, onClick?: () => void, disabled?: boolean, variant?: any }) {
  return (
    <Button variant={variant} disabled={disabled} onClick={onClick} className="h-12 flex flex-col gap-1 px-3 hover:bg-slate-100 min-w-[60px]">
      {React.cloneElement(icon as React.ReactElement, { className: "w-4 h-4 text-slate-600" })}
      <span className="text-[9px] uppercase font-bold text-slate-500">{label}</span>
    </Button>
  );
}

function RibbonIconButton({ icon, label, onClick, disabled }: { icon: React.ReactNode, label?: string, onClick?: () => void, disabled?: boolean }) {
  return (
    <Button variant="ghost" disabled={disabled} onClick={onClick} className="h-7 w-full flex gap-2 px-2 items-center justify-start hover:bg-slate-100">
      {React.cloneElement(icon as React.ReactElement, { className: "w-3.5 h-3.5 text-slate-600" })}
      {label && <span className="text-[10px] font-medium text-slate-600">{label}</span>}
    </Button>
  );
}

function ToolIconButton({ icon, label, onClick }: { icon: React.ReactNode, label?: string, onClick?: () => void }) {
  return (
    <Button variant="ghost" onClick={onClick} className="h-10 px-2 flex flex-col items-center justify-center gap-0.5 hover:bg-slate-100">
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
