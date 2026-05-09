
"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { 
  Building, Plus, LayoutGrid, 
  RectangleHorizontal, RefreshCw, Trash2, 
  Download, Clipboard, Copy, Scissors, Undo2, Redo2,
  Settings2, Move, Pencil, ZoomIn, ZoomOut, Maximize2,
  ChevronDown, PaintBucket, Layers, FlipHorizontal, FlipVertical,
  BringToFront, SendToBack, GripHorizontal, Menu as MenuIcon,
  Paintbrush, Star, RotateCw, Folder, FilePlus, FolderOpen, Save, Printer, Settings, User,
  Grid, Briefcase, Database, Sparkles, Search, PenLine, Box, Type,
  Ruler, Info, Circle, Triangle, Diamond, ArrowRight, Hexagon, Octagon,
  Bold, MousePointer2, Square, DoorOpen, Wind, Bed, Sofa, Bath, Utensils
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DesignObject = {
  id: string;
  type: 'structure' | 'opening' | 'shape' | 'text' | 'furniture' | 'fixture' | 'stair';
  subType: string;
  x: number; y: number; w: number; h: number;
  label: string; 
  color: string; 
  fillColor: string; 
  strokeWidth: number;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  rotation: number;
  flipH?: boolean;
  flipV?: boolean;
  rows?: number;
  cols?: number;
  textContent?: string;
  fontSize?: number;
  isBold?: boolean;
};

const COLORS = [
  '#000000', '#ffffff', '#ef4444', '#f97316', '#facc15', '#22c55e', 
  '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#64748b', '#d1d5db'
];

const LINE_STYLES = [
  { label: 'Solid', value: 'solid' },
  { label: 'Dashed', value: 'dashed' },
  { label: 'Dotted', value: 'dotted' }
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];

export default function EstimatorClient() {
  const { toast } = useToast();
  const [designObjects, setDesignObjects] = useState<DesignObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<DesignObject | null>(null);
  const [interactionMode, setInteractionMode] = useState<'none' | 'dragging' | 'resizing' | 'rotating' | 'drawing'>('none');
  const [selectedTool, setSelectedTool] = useState<'select' | 'shape' | 'line' | 'text' | 'wall' | 'opening' | 'symbol'>('select');
  const [drawStart, setDrawStart] = useState<{x: number, y: number} | null>(null);
  const [tempDrawEnd, setTempDrawEnd] = useState<{x: number, y: number} | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(40);
  const [snapPoint, setSnapPoint] = useState<{x: number, y: number} | null>(null);
  const [connectedGroup, setConnectedGroup] = useState<string[]>([]);
  const [activeRibbonTab, setActiveRibbonTab] = useState('home');
  const [currentWallThickness, setCurrentWallThickness] = useState(0.5); 

  const [history, setHistory] = useState<DesignObject[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const saveToHistory = useCallback((newObjects: DesignObject[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...newObjects.map(obj => ({...obj}))]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const undo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      setDesignObjects([...history[prevIndex].map(obj => ({...obj}))]);
      setSelectedObjectId(null);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setDesignObjects([...history[nextIndex].map(obj => ({...obj}))]);
      setSelectedObjectId(null);
    }
  };
  
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
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const corners = [
      { x: obj.x, y: obj.y },
      { x: obj.x + obj.w * cos, y: obj.y + obj.w * sin }
    ];
    if (obj.subType !== 'wall' && obj.type !== 'text') {
      corners.push({ x: obj.x - obj.h * sin, y: obj.y + obj.h * cos });
      corners.push({ x: obj.x + obj.w * cos - obj.h * sin, y: obj.y + obj.w * sin + obj.h * cos });
    }
    return corners;
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

  const addObject = (type: DesignObject['type'], subType: string, label: string, overrides: Partial<DesignObject> = {}) => {
    const newObj: DesignObject = {
      id: Math.random().toString(36).substr(2, 9),
      type, subType, 
      x: 10, y: 10, 
      w: 8, h: 6,
      label, color: '#374151', 
      fillColor: type === 'structure' ? '#9ca3af' : '#ffffff',
      strokeWidth: 2, 
      strokeStyle: 'solid',
      rotation: 0,
      textContent: type === 'text' ? 'নতুন লেখা' : undefined,
      fontSize: type === 'text' ? 14 : undefined,
      isBold: false,
      ...overrides
    };
    const next = [...designObjects, newObj];
    setDesignObjects(next);
    setSelectedObjectId(newObj.id);
    saveToHistory(next);
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

    if (selectedTool === 'text' && !id) {
      addObject('text', 'text', 'Text', { x: curX, y: curY });
      setSelectedTool('select');
      return;
    }

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
          w: length, h: currentWallThickness,
          label: 'Wall', color: '#334155', fillColor: 'transparent',
          strokeWidth: 2, strokeStyle: 'solid',
          rotation: angle
        };
        const next = [...designObjects, newWall];
        setDesignObjects(next);
        setSelectedObjectId(newWall.id);
        saveToHistory(next);
      }
      setDrawStart(null);
      setTempDrawEnd(null);
      setInteractionMode('none');
    } else if (interactionMode !== 'none') {
      saveToHistory(designObjects);
      setInteractionMode('none');
    }
    setSnapPoint(null);
    setConnectedGroup([]);
  };

  const updateObject = (id: string, updates: Partial<DesignObject>, save = false) => {
    setDesignObjects(objs => {
      const next = objs.map(o => o.id === id ? { ...o, ...updates } : o);
      if (save) saveToHistory(next);
      return next;
    });
  };

  const deleteObject = (id: string | null) => {
    if (!id) return;
    const next = designObjects.filter(o => o.id !== id);
    setDesignObjects(next);
    setSelectedObjectId(null);
    saveToHistory(next);
  };

  const copyObject = () => {
    if (selectedObject) {
      setClipboard({ ...selectedObject, id: Math.random().toString(36).substr(2, 9) });
      toast({ title: "Copied", description: `${selectedObject.label} copied.` });
    }
  };

  const pasteObject = () => {
    if (clipboard) {
      const newObj = { ...clipboard, x: clipboard.x + 2, y: clipboard.y + 2, id: Math.random().toString(36).substr(2, 9) };
      const next = [...designObjects, newObj];
      setDesignObjects(next);
      setSelectedObjectId(newObj.id);
      saveToHistory(next);
    }
  };

  return (
    <div className="w-full max-w-full mx-auto p-0 bg-slate-100 min-h-screen flex flex-col overflow-hidden font-body text-slate-900">
      {/* Top Header */}
      <div className="h-10 bg-slate-200 border-b flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-sm text-slate-700">SMARTDRAW</span>
          </div>
          <nav className="flex gap-4">
            {['File', 'Home', 'Design', 'Table', 'Support'].map(item => (
              <Button 
                key={item} 
                variant="ghost" 
                onClick={() => setActiveRibbonTab(item.toLowerCase())}
                className={cn(
                  "h-8 px-2 text-[11px] font-medium transition-colors hover:bg-slate-300",
                  activeRibbonTab === item.toLowerCase() ? "bg-white text-blue-600 shadow-sm font-bold" : "text-slate-600"
                )}
              >
                {item}
              </Button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
           <Button className="bg-orange-500 hover:bg-orange-600 h-7 text-[11px] px-4 font-bold text-white rounded shadow-sm border-none">BUY NOW</Button>
           <User className="w-5 h-5 text-slate-500 cursor-pointer" />
        </div>
      </div>

      {/* Ribbon Bar */}
      <div className="h-20 bg-white border-b flex items-center px-4 gap-0 shrink-0 shadow-sm z-30 overflow-x-auto no-scrollbar">
        {activeRibbonTab === 'file' && (
          <div className="flex items-center">
            <RibbonButton icon={<Folder />} label="Documents" />
            <RibbonButton icon={<FilePlus />} label="New" onClick={() => {setDesignObjects([]); setHistory([[]]); setHistoryIndex(0);}} />
            <RibbonButton icon={<FolderOpen />} label="Open" />
            <RibbonButton icon={<Save />} label="Save As" />
            <RibbonButton icon={<Printer />} label="Print" onClick={() => window.print()} />
            <div className="w-px h-12 bg-slate-200 mx-2" />
            <RibbonButton icon={<Settings />} label="Options" />
          </div>
        )}

        {activeRibbonTab === 'home' && (
          <>
            <div className="flex flex-col items-center border-r px-2">
              <RibbonButton icon={<Download />} label="Export" />
            </div>

            <div className="flex items-center border-r px-2">
              <RibbonButton icon={<Clipboard />} label="Paste" onClick={pasteObject} disabled={!clipboard} />
              <div className="flex flex-col">
                <RibbonIconButton icon={<Copy />} label="Copy" onClick={copyObject} />
                <RibbonIconButton icon={<Scissors />} label="Cut" onClick={() => { copyObject(); deleteObject(selectedObjectId); }} />
                <RibbonIconButton icon={<Paintbrush />} label="Format" />
              </div>
            </div>

            <div className="flex flex-col items-center border-r px-2">
               <RibbonButton icon={<Plus />} label="Insert" />
            </div>

            <div className="flex items-center border-r px-2">
              <RibbonIconButton icon={<Undo2 />} label="Undo" onClick={undo} disabled={historyIndex <= 0} />
              <RibbonIconButton icon={<Redo2 />} label="Redo" onClick={redo} disabled={historyIndex >= history.length - 1} />
            </div>

            <div className="flex items-center border-r px-2 gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-16 flex flex-col gap-1 px-3" disabled={!selectedObject}>
                    <PaintBucket className="w-5 h-5 text-slate-600" />
                    <span className="text-[9px] uppercase font-bold text-slate-500">Fill</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="p-2 w-48">
                  <div className="grid grid-cols-5 gap-1">
                    {COLORS.map(c => (
                      <div key={c} onClick={() => selectedObjectId && updateObject(selectedObjectId, { fillColor: c }, true)} className="w-6 h-6 rounded border cursor-pointer hover:scale-110 transition-transform" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-16 flex flex-col gap-1 px-3" disabled={!selectedObject}>
                    <GripHorizontal className="w-5 h-5 text-slate-600" />
                    <span className="text-[9px] uppercase font-bold text-slate-500">Line</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="p-2 w-48">
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      {LINE_STYLES.map(s => (
                        <Button key={s.value} variant="outline" className="h-7 text-[10px] flex-1" onClick={() => selectedObjectId && updateObject(selectedObjectId, { strokeStyle: s.value as any }, true)}>{s.label}</Button>
                      ))}
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {COLORS.map(c => (
                        <div key={c} onClick={() => selectedObjectId && updateObject(selectedObjectId, { color: c }, true)} className="w-5 h-5 rounded border cursor-pointer" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center border-r px-2 gap-2 h-full">
              <Select 
                value={selectedObject?.fontSize?.toString() || "14"} 
                onValueChange={(val) => selectedObjectId && updateObject(selectedObjectId, { fontSize: parseInt(val) }, true)}
              >
                <SelectTrigger className="h-7 w-16 text-[10px]">
                  <SelectValue placeholder="14" />
                </SelectTrigger>
                <SelectContent>
                  {FONT_SIZES.map(s => (
                    <SelectItem key={s} value={s.toString()} className="text-[10px]">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                variant={selectedObject?.isBold ? "secondary" : "ghost"} 
                size="icon" 
                className="h-7 w-7"
                onClick={() => selectedObjectId && updateObject(selectedObjectId, { isBold: !selectedObject.isBold }, true)}
              >
                <Bold className="w-3.5 h-3.5" />
              </Button>
            </div>

            <div className="flex items-center border-r px-2 gap-2">
               <div className="flex flex-col gap-0.5">
                  <RibbonIconButton icon={<BringToFront />} label="Front" onClick={() => {}} />
                  <RibbonIconButton icon={<SendToBack />} label="Back" onClick={() => {}} />
               </div>
               <div className="flex flex-col gap-0.5">
                  <RibbonIconButton icon={<FlipHorizontal />} label="Flip H" onClick={() => updateObject(selectedObjectId!, { flipH: !selectedObject?.flipH }, true)} />
                  <RibbonIconButton icon={<FlipVertical />} label="Flip V" onClick={() => updateObject(selectedObjectId!, { flipV: !selectedObject?.flipV }, true)} />
               </div>
            </div>
            
            <RibbonButton icon={<Trash2 />} label="Delete" variant="destructive" onClick={() => deleteObject(selectedObjectId)} />
          </>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Library Sidebar */}
        <div className="flex w-[320px] bg-slate-50 border-r z-20 shrink-0">
          <div className="w-12 border-r bg-slate-100 flex flex-col items-center py-4 gap-6 shrink-0 shadow-inner">
             <Briefcase className="w-5 h-5 text-slate-400" />
             <Database className="w-5 h-5 text-slate-400" />
             <Sparkles className="w-5 h-5 text-slate-400" />
             <div className="mt-auto mb-4">
                <Info className="w-5 h-5 text-slate-300" />
             </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-3 border-b flex items-center justify-between bg-white/50 backdrop-blur">
               <span className="text-sm font-bold text-slate-700">TOOLS & LIBRARY</span>
               <MenuIcon className="w-4 h-4 text-slate-400" />
            </div>

            <ScrollArea className="flex-1">
              <div className="p-3 space-y-6">
                <div className="grid grid-cols-4 gap-2">
                  <ToolCard icon={<MousePointer2 />} label="Select" active={selectedTool === 'select'} onClick={() => { setSelectedTool('select'); setInteractionMode('none'); }} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <div>
                        <ToolCard icon={<Box />} label="Shape" active={selectedTool === 'shape'} onClick={() => setSelectedTool('shape')} />
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64 p-3 grid grid-cols-4 gap-4">
                        <ShapeIcon icon={<Square className="w-6 h-6" />} onClick={() => addObject('shape', 'rect', 'Rectangle')} />
                        <ShapeIcon icon={<Circle className="w-6 h-6" />} onClick={() => addObject('shape', 'oval', 'Oval')} />
                        <ShapeIcon icon={<Triangle className="w-6 h-6" />} onClick={() => addObject('shape', 'tri', 'Triangle')} />
                        <ShapeIcon icon={<Diamond className="w-6 h-6" />} onClick={() => addObject('shape', 'diamond', 'Diamond')} />
                        <ShapeIcon icon={<ArrowRight className="w-6 h-6" />} onClick={() => addObject('shape', 'arrow', 'Arrow')} />
                        <ShapeIcon icon={<Hexagon className="w-6 h-6" />} onClick={() => addObject('shape', 'hex', 'Hexagon')} />
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <ToolCard icon={<PenLine />} label="Line" active={selectedTool === 'line'} onClick={() => setSelectedTool('line')} />
                  <ToolCard icon={<Type />} label="Text" active={selectedTool === 'text'} onClick={() => setSelectedTool('text')} />
                </div>

                <div className="space-y-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-start gap-2 h-9 text-slate-700 bg-white font-bold border-slate-300 shadow-sm">
                        <Pencil className="w-4 h-4 text-blue-500" />
                        <span className="text-xs">Add Wall</span>
                        <ChevronDown className="ml-auto w-3.5 h-3.5 text-slate-400" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56">
                      <DropdownMenuItem onClick={() => { setCurrentWallThickness(0.33); setInteractionMode('drawing'); }}>Interior Wall 4"</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setCurrentWallThickness(0.5); setInteractionMode('drawing'); }}>Exterior Wall 6"</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setCurrentWallThickness(0.66); setInteractionMode('drawing'); }}>Exterior Wall 8"</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <Accordion type="multiple" defaultValue={["openings", "symbols", "furniture"]} className="w-full">
                  <AccordionItem value="openings" className="border-slate-200">
                    <AccordionTrigger className="h-9 px-0 hover:no-underline text-[10px] font-bold text-slate-600 uppercase">Doors & Windows</AccordionTrigger>
                    <AccordionContent className="grid grid-cols-2 gap-2">
                       <SymbolButton icon={<DoorOpen />} label="Door" onClick={() => addObject('opening', 'door', 'Single Door', { w: 3, h: 3, color: '#94a3b8' })} />
                       <SymbolButton icon={<Wind />} label="Window" onClick={() => addObject('opening', 'window', 'Sliding Window', { w: 4, h: 0.5, color: '#3b82f6' })} />
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="furniture" className="border-slate-200">
                    <AccordionTrigger className="h-9 px-0 hover:no-underline text-[10px] font-bold text-slate-600 uppercase">Furniture</AccordionTrigger>
                    <AccordionContent className="grid grid-cols-2 gap-2">
                       <SymbolButton icon={<Bed />} label="Bed" onClick={() => addObject('furniture', 'bed', 'King Bed', { w: 6, h: 7, fillColor: '#fde68a' })} />
                       <SymbolButton icon={<Sofa />} label="Sofa" onClick={() => addObject('furniture', 'sofa', '3 Seater', { w: 6, h: 3, fillColor: '#fecaca' })} />
                       <SymbolButton icon={<Utensils />} label="Dining" onClick={() => addObject('furniture', 'table', 'Dining Table', { w: 5, h: 3, fillColor: '#e2e8f0' })} />
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="symbols" className="border-slate-200">
                    <AccordionTrigger className="h-9 px-0 hover:no-underline text-[10px] font-bold text-slate-600 uppercase">Fixtures & Stairs</AccordionTrigger>
                    <AccordionContent className="grid grid-cols-2 gap-2">
                       <SymbolButton icon={<Bath />} label="Toilet" onClick={() => addObject('fixture', 'toilet', 'Toilet', { w: 1.5, h: 2.5, fillColor: '#f1f5f9' })} />
                       <SymbolButton icon={<Grid />} label="Stairs" onClick={() => addObject('stair', 'stair', 'Straight Stairs', { w: 4, h: 10, fillColor: '#cbd5e1' })} />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 relative flex flex-col overflow-hidden bg-slate-200">
          <div 
            id="canvas-workspace"
            className="flex-1 relative bg-white overflow-auto cursor-crosshair m-4 shadow-2xl no-scrollbar rounded-sm border"
            onMouseDown={(e) => handleMouseDown(e, null)}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            <div className="absolute inset-0" style={{ 
                backgroundImage: `linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)`,
                backgroundSize: `${zoom}px ${zoom}px`, width: 4000, height: 4000, backgroundColor: 'white'
              }}>
              
              {designObjects.map(obj => {
                const isSelected = selectedObjectId === obj.id;
                const isWall = obj.subType === 'wall';
                const isText = obj.type === 'text';
                const isDoor = obj.subType === 'door';
                const isWindow = obj.subType === 'window';
                const isStair = obj.type === 'stair';
                
                return (
                  <div key={obj.id} onMouseDown={(e) => handleMouseDown(e, obj.id)} 
                    className={cn("absolute flex items-center justify-center cursor-move select-none", isSelected ? "z-30" : "z-10")}
                    style={{ 
                      left: obj.x * zoom, 
                      top: obj.y * zoom, 
                      width: obj.w * zoom, 
                      height: obj.h * zoom, 
                      transformOrigin: '0 50%',
                      transform: `rotate(${obj.rotation}deg)`, 
                      backgroundColor: isWall ? obj.color : obj.fillColor,
                      border: (isWall || isText || isDoor) ? 'none' : `${obj.strokeWidth}px ${obj.strokeStyle} ${obj.color}`,
                      outline: isSelected ? '2px solid #2563eb' : undefined,
                      outlineOffset: '2px',
                      borderRadius: obj.subType === 'oval' ? '9999px' : '0px',
                      color: isText ? obj.color : 'inherit',
                      fontSize: isText ? (obj.fontSize || 14) * (zoom/40) : 'inherit',
                      fontWeight: (isText && obj.isBold) ? 'bold' : 'normal',
                      textAlign: 'center',
                    }}>
                    
                    {isDoor && (
                      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="overflow-visible">
                         <line x1="0" y1="100" x2="100" y2="0" stroke={obj.color} strokeWidth="4" />
                         <path d="M 100 0 A 100 100 0 0 0 0 100" fill="none" stroke={obj.color} strokeWidth="2" strokeDasharray="4 2" />
                         <line x1="0" y1="100" x2="0" y2="0" stroke={obj.color} strokeWidth="4" />
                      </svg>
                    )}

                    {isWindow && (
                      <div className="absolute inset-0 flex flex-col justify-center items-center gap-1">
                         <div className="w-full h-px bg-slate-400" />
                         <div className="w-full h-px bg-slate-400" />
                      </div>
                    )}

                    {isStair && (
                      <div className="absolute inset-0 flex flex-col">
                        {Array.from({length: Math.floor(obj.h * 1.5)}).map((_, i) => (
                          <div key={i} className="flex-1 border-b border-slate-400" />
                        ))}
                      </div>
                    )}

                    {isText && <div className="w-full break-words px-2">{obj.textContent}</div>}
                    
                    {isSelected && (
                      <>
                        <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-600 rounded-full cursor-se-resize z-40 border-2 border-white shadow-md" onMouseDown={(e) => handleMouseDown(e, obj.id, 'resizing')} />
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-6 h-6 bg-white rounded-full cursor-pointer flex items-center justify-center border shadow-md hover:bg-blue-50" onMouseDown={(e) => handleMouseDown(e, obj.id, 'rotating')}>
                           <RotateCw className="w-4 h-4 text-blue-600" />
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="h-8 bg-white border-t flex items-center px-4 justify-between shrink-0 shadow-inner">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Workspace: Floor Plan 1</span>
             <div className="flex items-center gap-2">
                <ToolIconButton icon={<ZoomOut />} onClick={() => setZoom(z => Math.max(10, z - 5))} />
                <Slider value={[zoom]} max={150} min={10} step={5} className="w-32" onValueChange={(val) => setZoom(val[0])} />
                <ToolIconButton icon={<ZoomIn />} onClick={() => setZoom(z => Math.min(150, z + 5))} />
                <span className="text-[10px] font-bold text-slate-500 ml-2 w-8 text-right">{zoom}%</span>
             </div>
          </div>
        </div>

        {/* Right Properties Panel */}
        <div className="w-[280px] bg-white border-l z-20 shrink-0 flex flex-col shadow-lg">
           <div className="p-3 border-b bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">PROPERTIES</span>
              <Settings2 className="w-4 h-4 text-slate-400" />
           </div>
           
           <ScrollArea className="flex-1">
              <div className="p-3 space-y-4">
                 {selectedObject ? (
                    <>
                       {selectedObject.type === 'text' && (
                          <div className="space-y-1.5">
                             <Label className="text-[9px] font-bold text-slate-500 uppercase">Text Content</Label>
                             <Input 
                               className="h-8 text-[11px] font-medium bg-slate-50 border-slate-200" 
                               value={selectedObject.textContent || ''} 
                               onChange={(e) => updateObject(selectedObject.id, { textContent: e.target.value }, true)}
                             />
                          </div>
                       )}

                       <div className="space-y-1.5">
                          <span className="text-[9px] font-bold text-slate-500 uppercase">POSITION</span>
                          <div className="grid grid-cols-2 gap-2">
                             <div className="space-y-1">
                                <Label className="text-[8px] text-slate-400 font-bold uppercase">Left</Label>
                                <Input 
                                   className="h-7 text-[10px] bg-slate-50 border-slate-200" 
                                   value={formatFeetInches(selectedObject.x)} 
                                   onChange={(e) => updateObject(selectedObject.id, { x: parseFeetInches(e.target.value) }, true)}
                                   placeholder={"0' 0\""}
                                />
                             </div>
                             <div className="space-y-1">
                                <Label className="text-[8px] text-slate-400 font-bold uppercase">Top</Label>
                                <Input 
                                   className="h-7 text-[10px] bg-slate-50 border-slate-200" 
                                   value={formatFeetInches(selectedObject.y)} 
                                   onChange={(e) => updateObject(selectedObject.id, { y: parseFeetInches(e.target.value) }, true)}
                                   placeholder={"0' 0\""}
                                />
                             </div>
                          </div>
                       </div>

                       <div className="space-y-1.5 pt-2 border-t">
                          <span className="text-[9px] font-bold text-slate-500 uppercase">DIMENSIONS</span>
                          <div className="grid grid-cols-2 gap-2">
                             <div className="space-y-1">
                                <Label className="text-[8px] text-slate-400 font-bold uppercase">Width</Label>
                                <Input 
                                   className="h-7 text-[10px] bg-slate-50 border-slate-200" 
                                   value={formatFeetInches(selectedObject.w)} 
                                   onChange={(e) => updateObject(selectedObject.id, { w: parseFeetInches(e.target.value) }, true)}
                                   placeholder={"0' 0\""}
                                />
                             </div>
                             <div className="space-y-1">
                                <Label className="text-[8px] text-slate-400 font-bold uppercase">Height</Label>
                                <Input 
                                   className="h-7 text-[10px] bg-slate-50 border-slate-200" 
                                   value={formatFeetInches(selectedObject.h)} 
                                   onChange={(e) => updateObject(selectedObject.id, { h: parseFeetInches(e.target.value) }, true)}
                                   placeholder={"0' 0\""}
                                />
                             </div>
                          </div>
                       </div>

                       <div className="space-y-1.5 pt-2 border-t">
                          <Label className="text-[9px] font-bold text-slate-500 uppercase">ROTATION</Label>
                          <div className="flex items-center gap-2">
                             <Slider value={[selectedObject.rotation]} max={360} min={0} step={1} className="flex-1" onValueChange={(val) => updateObject(selectedObject.id, { rotation: val[0] }, true)} />
                             <span className="text-[10px] font-mono font-bold w-8 text-right text-slate-600">{selectedObject.rotation}°</span>
                          </div>
                       </div>
                    </>
                 ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-3 py-24 opacity-40">
                       <MousePointer2 className="w-8 h-8 text-slate-300" />
                       <p className="text-[11px] text-slate-400 font-bold uppercase px-6">Select an object to customize.</p>
                    </div>
                 )}
              </div>
           </ScrollArea>
        </div>
      </div>
    </div>
  );
}

function ToolCard({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <div onClick={onClick} className={cn(
      "flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer transition-all border",
      active ? "bg-blue-50 text-blue-600 border-blue-200 shadow-sm" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
    )}>
       {React.cloneElement(icon as React.ReactElement, { className: "w-4 h-4 mb-1" })}
       <span className="text-[9px] font-bold uppercase tracking-tight">{label}</span>
    </div>
  );
}

function ShapeIcon({ icon, onClick }: { icon: React.ReactNode, onClick: () => void }) {
  return (
    <div onClick={onClick} className="flex items-center justify-center p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-all text-slate-600">
      {icon}
    </div>
  )
}

function SymbolButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) {
  return (
    <Button variant="outline" onClick={onClick} className="w-full flex flex-col items-center justify-center gap-1.5 h-16 p-2 bg-white border-slate-200 hover:bg-slate-50 hover:border-blue-300 transition-all">
       {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5 text-slate-500" })}
       <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tight">{label}</span>
    </Button>
  );
}

function RibbonButton({ icon, label, onClick, disabled, variant = "ghost" }: { icon: React.ReactNode, label: string, onClick?: () => void, disabled?: boolean, variant?: any }) {
  return (
    <Button variant={variant} disabled={disabled} onClick={onClick} className="h-16 flex flex-col gap-1 px-3 hover:bg-slate-100 min-w-[70px] group transition-colors">
      {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5 text-slate-600 group-hover:text-blue-600 transition-colors" })}
      <span className="text-[9px] uppercase font-bold text-slate-500 group-hover:text-slate-800 transition-colors">{label}</span>
    </Button>
  );
}

function RibbonIconButton({ icon, label, onClick, disabled }: { icon: React.ReactNode, label?: string, onClick?: () => void, disabled?: boolean }) {
  return (
    <Button variant="ghost" disabled={disabled} onClick={onClick} className="h-7 w-full flex gap-2 px-2 items-center justify-start hover:bg-slate-100 group transition-colors">
      {React.cloneElement(icon as React.ReactElement, { className: "w-3.5 h-3.5 text-slate-600 group-hover:text-blue-600" })}
      {label && <span className="text-[10px] font-bold text-slate-600 group-hover:text-slate-900">{label}</span>}
    </Button>
  );
}

function ToolIconButton({ icon, onClick }: { icon: React.ReactNode, onClick?: () => void }) {
  return (
    <Button variant="ghost" onClick={onClick} className="h-6 w-6 p-0 flex items-center justify-center hover:bg-slate-200 transition-colors rounded-full">
      {React.cloneElement(icon as React.ReactElement, { className: "w-4 h-4 text-slate-500" })}
    </Button>
  );
}
