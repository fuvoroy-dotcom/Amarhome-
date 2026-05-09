
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
  type: 'structure' | 'opening' | 'shape' | 'text' | 'furniture' | 'fixture' | 'stair' | 'table';
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
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);

  // Local state for properties inputs to prevent cursor jump
  const [localPropX, setLocalPropX] = useState("");
  const [localPropY, setLocalPropY] = useState("");
  const [localPropW, setLocalPropW] = useState("");
  const [localPropH, setLocalPropH] = useState("");

  const [history, setHistory] = useState<DesignObject[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

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

  useEffect(() => {
    if (selectedObject) {
      setLocalPropX(formatFeetInches(selectedObject.x));
      setLocalPropY(formatFeetInches(selectedObject.y));
      setLocalPropW(formatFeetInches(selectedObject.w));
      setLocalPropH(formatFeetInches(selectedObject.h));
    } else {
      setLocalPropX(""); setLocalPropY(""); setLocalPropW(""); setLocalPropH("");
    }
  }, [selectedObjectId]);

  const getPoints = (obj: DesignObject) => {
    const rad = obj.rotation * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return [
      { x: obj.x, y: obj.y },
      { x: obj.x + obj.w * cos, y: obj.y + obj.w * sin }
    ];
  };

  const getGroup = (startId: string, allObjs: DesignObject[]) => {
    const connected = new Set<string>();
    const stack = [startId];
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
            if (dist < 0.5) isNear = true;
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
      w: subType === 'door' ? 3 : subType === 'window' ? 4 : 8, 
      h: subType === 'door' ? 3 : subType === 'window' ? 0.6 : 6,
      label, color: '#000000', 
      fillColor: type === 'structure' ? '#000000' : '#ffffff',
      strokeWidth: 2, 
      strokeStyle: 'solid',
      rotation: 0,
      textContent: type === 'text' ? 'নতুন টেক্সট' : undefined,
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

    if (interactionMode === 'drawing' || selectedTool === 'wall') {
      e.stopPropagation();
      const snapped = findSnapPoint(curX, curY);
      const startPos = snapped || { x: Math.round(curX * 2) / 2, y: Math.round(curY * 2) / 2 };
      setDrawStart(startPos);
      setTempDrawEnd(startPos);
      setInteractionMode('drawing');
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
      setDesignObjects(objs => objs.map(o => connectedGroup.includes(o.id) ? { ...o, x: o.x + dx, y: o.y + dy } : o));
    } else if (interactionMode === 'resizing') {
      updateObject(selectedObjectId, { w: Math.max(0.5, curX - curr.x), h: Math.max(0.5, curY - curr.y) });
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
          label: 'Wall', color: '#000000', fillColor: 'transparent',
          strokeWidth: 2, strokeStyle: 'solid',
          rotation: angle
        };
        const next = [...designObjects, newWall];
        setDesignObjects(next);
        setSelectedObjectId(newWall.id);
        saveToHistory(next);
      }
      setDrawStart(null); setTempDrawEnd(null); setInteractionMode('none');
    } else if (interactionMode !== 'none') {
      saveToHistory(designObjects);
      setInteractionMode('none');
    }
    setSnapPoint(null); setConnectedGroup([]);
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

  return (
    <div className="w-full mx-auto p-0 bg-slate-100 min-h-screen flex flex-col overflow-hidden font-body text-slate-900">
      <div className="h-10 bg-slate-200 border-b flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-sm text-slate-700 tracking-tighter uppercase">SmartDraw Pro</span>
          </div>
          <nav className="flex gap-4 h-full pt-2">
            {['File', 'Home', 'Design', 'Table'].map(item => (
              <Button key={item} variant="ghost" onClick={() => setActiveRibbonTab(item.toLowerCase())}
                className={cn("h-8 px-4 text-[11px] font-bold transition-all rounded-t-sm rounded-b-none border-b-2 border-transparent",
                  activeRibbonTab === item.toLowerCase() ? "bg-white text-blue-600 border-blue-600 shadow-sm" : "text-slate-600 hover:bg-slate-300")}>{item}</Button>
            ))}
          </nav>
        </div>
        <User className="w-5 h-5 text-slate-500 cursor-pointer" />
      </div>

      <div className="h-24 bg-white border-b flex items-center px-4 gap-0 shrink-0 shadow-sm z-30 overflow-x-auto no-scrollbar">
        {activeRibbonTab === 'home' && (
          <>
            <div className="flex items-center border-r px-3 h-full gap-2">
              <RibbonButton icon={<Undo2 />} label="Undo" onClick={undo} disabled={historyIndex <= 0} />
              <RibbonButton icon={<Redo2 />} label="Redo" onClick={redo} disabled={historyIndex >= history.length - 1} />
            </div>
            <div className="flex items-center border-r px-3 h-full gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" className="h-16 flex flex-col gap-1 px-3 group"><PaintBucket className="w-5 h-5 text-slate-600" /><span className="text-[9px] uppercase font-bold text-slate-500">Fill</span></Button></DropdownMenuTrigger>
                <DropdownMenuContent className="p-2 w-48"><div className="grid grid-cols-5 gap-1">{COLORS.map(c => (<div key={c} onClick={() => selectedObjectId && updateObject(selectedObjectId, { fillColor: c }, true)} className="w-6 h-6 rounded border cursor-pointer hover:scale-110" style={{ backgroundColor: c }} />))}</div></DropdownMenuContent>
              </DropdownMenu>
              <Select value={selectedObject?.fontSize?.toString() || "14"} onValueChange={(val) => selectedObjectId && updateObject(selectedObjectId, { fontSize: parseInt(val) }, true)}>
                <SelectTrigger className="h-7 w-16 text-[10px]"><SelectValue placeholder="14" /></SelectTrigger>
                <SelectContent>{FONT_SIZES.map(s => (<SelectItem key={s} value={s.toString()}>{s}</SelectItem>))}</SelectContent>
              </Select>
              <Button variant={selectedObject?.isBold ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={() => selectedObjectId && updateObject(selectedObjectId, { isBold: !selectedObject?.isBold }, true)}><Bold className="w-3.5 h-3.5" /></Button>
            </div>
            <RibbonButton icon={<Trash2 />} label="Delete" variant="destructive" onClick={() => deleteObject(selectedObjectId)} />
          </>
        )}
        {activeRibbonTab === 'table' && (
          <div className="flex items-center h-full">
            <div className="flex flex-col gap-1 px-3 border-r">
               <div className="flex items-center gap-2"><Label className="text-[9px] font-bold w-8">ROWS</Label><Input type="number" value={tableRows} onChange={(e) => setTableRows(parseInt(e.target.value))} className="h-6 w-12 text-[10px]" /></div>
               <div className="flex items-center gap-2"><Label className="text-[9px] font-bold w-8">COLS</Label><Input type="number" value={tableCols} onChange={(e) => setTableCols(parseInt(e.target.value))} className="h-6 w-12 text-[10px]" /></div>
            </div>
            <RibbonButton icon={<LayoutGrid />} label="Insert Table" onClick={() => addObject('table', 'table', 'Table', { rows: tableRows, cols: tableCols })} />
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-[300px] bg-slate-50 border-r z-20 shrink-0 flex flex-col shadow-lg">
          <div className="p-3 border-b flex items-center justify-between bg-white"><span className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">Library & Tools</span></div>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-4">
              <div className="grid grid-cols-4 gap-2">
                <ToolCard icon={<MousePointer2 />} label="Select" active={selectedTool === 'select'} onClick={() => { setSelectedTool('select'); setInteractionMode('none'); }} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><div><ToolCard icon={<Box />} label="Shape" active={selectedTool === 'shape'} onClick={() => setSelectedTool('shape')} /></div></DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64 p-3 grid grid-cols-4 gap-4">
                    {['rect', 'oval', 'tri', 'diamond', 'arrow', 'hex', 'oct'].map(s => (
                      <div key={s} className="p-2 border rounded hover:bg-blue-50 cursor-pointer flex justify-center" onClick={() => addObject('shape', s, s.toUpperCase())}><Square className="w-6 h-6" /></div>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <ToolCard icon={<PenLine />} label="Line" active={selectedTool === 'line'} onClick={() => setSelectedTool('line')} />
                <ToolCard icon={<Type />} label="Text" active={selectedTool === 'text'} onClick={() => setSelectedTool('text')} />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" className="w-full justify-start gap-2 h-10 font-bold border-slate-300"><Pencil className="w-4 h-4 text-blue-500" /><span className="text-xs uppercase">Insert Wall</span><ChevronDown className="ml-auto w-3.5 h-3.5 text-slate-400" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  {[4, 6, 8, 12].map(w => (<DropdownMenuItem key={w} onClick={() => { setCurrentWallThickness(w/12); setSelectedTool('wall'); setInteractionMode('drawing'); }}>{w}" Wall</DropdownMenuItem>))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Accordion type="multiple" defaultValue={["openings", "furniture"]} className="w-full">
                <AccordionItem value="openings" className="border-slate-200">
                  <AccordionTrigger className="h-10 px-0 text-[10px] font-bold text-slate-600 uppercase tracking-widest">Doors & Windows</AccordionTrigger>
                  <AccordionContent className="grid grid-cols-2 gap-2 pt-1">
                    <SymbolButton icon={<DoorOpen />} label="Door" onClick={() => addObject('opening', 'door', 'Door')} />
                    <SymbolButton icon={<Wind />} label="Window" onClick={() => addObject('opening', 'window', 'Window')} />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="furniture" className="border-slate-200">
                  <AccordionTrigger className="h-10 px-0 text-[10px] font-bold text-slate-600 uppercase tracking-widest">Furniture</AccordionTrigger>
                  <AccordionContent className="grid grid-cols-2 gap-2 pt-1">
                    <SymbolButton icon={<Bed />} label="Bed" onClick={() => addObject('furniture', 'bed', 'Bed')} />
                    <SymbolButton icon={<Sofa />} label="Sofa" onClick={() => addObject('furniture', 'sofa', 'Sofa')} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 relative flex flex-col overflow-hidden bg-slate-200">
          <div id="canvas-workspace" className="flex-1 relative bg-white overflow-auto cursor-crosshair m-4 shadow-2xl rounded-sm border no-scrollbar"
            onMouseDown={(e) => handleMouseDown(e, null)} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
            <div className="absolute inset-0" style={{ 
                backgroundImage: `linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)`,
                backgroundSize: `${zoom}px ${zoom}px`, width: 4000, height: 4000, backgroundColor: 'white'
              }}>
              {designObjects.map(obj => (
                <div key={obj.id} onMouseDown={(e) => handleMouseDown(e, obj.id)}
                  className={cn("absolute flex items-center justify-center cursor-move select-none", selectedObjectId === obj.id ? "z-30 ring-2 ring-blue-600 shadow-xl" : "z-10 shadow-sm")}
                  style={{ left: obj.x * zoom, top: obj.y * zoom, width: obj.w * zoom, height: obj.h * zoom, transformOrigin: '0 50%', transform: `rotate(${obj.rotation}deg)`,
                    backgroundColor: obj.subType === 'wall' ? obj.color : obj.fillColor, borderRadius: obj.subType === 'oval' ? '9999px' : '0px',
                    color: obj.color, fontSize: obj.type === 'text' ? (obj.fontSize || 14) * (zoom/40) : 'inherit', fontWeight: (obj.type === 'text' && obj.isBold) ? 'bold' : 'normal' }}>
                  {obj.subType === 'door' && (
                    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="overflow-visible">
                      <line x1="0" y1="100" x2="0" y2="0" stroke={obj.color} strokeWidth="4" />
                      <path d="M 0 0 A 100 100 0 0 1 100 100" fill="none" stroke={obj.color} strokeWidth="2" strokeDasharray="4 2" />
                    </svg>
                  )}
                  {obj.subType === 'window' && <div className="absolute inset-0 border-x-2 border-slate-900 flex flex-col justify-between py-1 bg-white"><div className="w-full h-[1px] bg-slate-900" /><div className="w-full h-[1px] bg-slate-900" /></div>}
                  {obj.type === 'text' && <div className="px-2">{obj.textContent}</div>}
                  {selectedObjectId === obj.id && <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-600 rounded-full cursor-se-resize z-40 border-2 border-white" onMouseDown={(e) => handleMouseDown(e, obj.id, 'resizing')} />}
                </div>
              ))}
              
              {/* Drawing Preview */}
              {interactionMode === 'drawing' && drawStart && tempDrawEnd && (
                <div className="absolute bg-blue-400/50 pointer-events-none z-50 border border-blue-600 border-dashed"
                  style={{
                    left: drawStart.x * zoom,
                    top: drawStart.y * zoom,
                    width: Math.sqrt(Math.pow(tempDrawEnd.x - drawStart.x, 2) + Math.pow(tempDrawEnd.y - drawStart.y, 2)) * zoom,
                    height: currentWallThickness * zoom,
                    transformOrigin: '0 50%',
                    transform: `rotate(${Math.atan2(tempDrawEnd.y - drawStart.y, tempDrawEnd.x - drawStart.x) * (180 / Math.PI)}deg)`,
                  }}
                />
              )}
            </div>
          </div>
          <div className="h-10 bg-white border-t flex items-center px-4 justify-between shrink-0 shadow-inner">
             <div className="flex items-center gap-2"><ZoomOut className="w-4 h-4" /><Slider value={[zoom]} max={150} min={10} step={5} className="w-40" onValueChange={(val) => setZoom(val[0])} /><ZoomIn className="w-4 h-4" /></div>
          </div>
        </div>

        <div className="w-[280px] bg-white border-l z-20 shrink-0 flex flex-col shadow-xl">
           <div className="p-2 border-b bg-slate-50 flex items-center justify-between"><span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Properties</span><Settings2 className="w-3 h-3 text-slate-400" /></div>
           <ScrollArea className="flex-1">
              <div className="p-2 space-y-3">
                 {selectedObject ? (
                    <div className="space-y-3">
                       {selectedObject.type === 'text' && (
                          <div className="space-y-1"><Label className="text-[8px] font-bold text-slate-500 uppercase">Text Content</Label>
                             <Input className="h-7 text-[10px] bg-slate-50" value={selectedObject.textContent || ''} onChange={(e) => updateObject(selectedObject.id, { textContent: e.target.value }, true)} />
                          </div>
                       )}
                       <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1"><Label className="text-[8px] text-slate-400">Left</Label><Input className="h-7 text-[10px]" value={localPropX} onChange={(e) => setLocalPropX(e.target.value)} onBlur={() => updateObject(selectedObjectId!, { x: parseFeetInches(localPropX) }, true)} placeholder={"0' 0\""} /></div>
                          <div className="space-y-1"><Label className="text-[8px] text-slate-400">Top</Label><Input className="h-7 text-[10px]" value={localPropY} onChange={(e) => setLocalPropY(e.target.value)} onBlur={() => updateObject(selectedObjectId!, { y: parseFeetInches(localPropY) }, true)} placeholder={"0' 0\""} /></div>
                          <div className="space-y-1"><Label className="text-[8px] text-slate-400">Width</Label><Input className="h-7 text-[10px]" value={localPropW} onChange={(e) => setLocalPropW(e.target.value)} onBlur={() => updateObject(selectedObjectId!, { w: parseFeetInches(localPropW) }, true)} placeholder={"0' 0\""} /></div>
                          <div className="space-y-1"><Label className="text-[8px] text-slate-400">Height</Label><Input className="h-7 text-[10px]" value={localPropH} onChange={(e) => setLocalPropH(e.target.value)} onBlur={() => updateObject(selectedObjectId!, { h: parseFeetInches(localPropH) }, true)} placeholder={"0' 0\""} /></div>
                       </div>
                       <div className="space-y-1 pt-2 border-t">
                          <Label className="text-[8px] font-bold text-slate-500 uppercase">Rotation: {selectedObject.rotation}°</Label>
                          <Slider value={[selectedObject.rotation]} max={360} min={0} step={1} onValueChange={(val) => updateObject(selectedObject.id, { rotation: val[0] }, true)} />
                       </div>
                    </div>
                 ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-2 py-20 opacity-30"><MousePointer2 className="w-6 h-6" /><p className="text-[9px] uppercase tracking-widest font-bold">Select an element</p></div>
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
    <div onClick={onClick} className={cn("flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer transition-all border",
      active ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50")}>
       {React.cloneElement(icon as React.ReactElement, { className: "w-4 h-4 mb-1" })}<span className="text-[9px] font-bold uppercase">{label}</span>
    </div>
  );
}

function SymbolButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) {
  return (
    <Button variant="outline" onClick={onClick} className="w-full flex flex-col items-center justify-center gap-1.5 h-16 p-2 bg-white hover:bg-slate-50 transition-all group">
       {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5 text-slate-500 group-hover:text-blue-600" })}
       <span className="text-[9px] font-bold text-slate-600 uppercase group-hover:text-slate-900">{label}</span>
    </Button>
  );
}

function RibbonButton({ icon, label, onClick, disabled, variant = "ghost" }: { icon: React.ReactNode, label: string, onClick?: () => void, disabled?: boolean, variant?: any }) {
  return (
    <Button variant={variant} disabled={disabled} onClick={onClick} className="h-20 flex flex-col gap-1.5 px-4 hover:bg-slate-50 min-w-[80px] group transition-colors rounded-none">
      {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5 text-slate-600 group-hover:text-blue-600" })}
      <span className="text-[9px] uppercase font-bold text-slate-500 group-hover:text-slate-800">{label}</span>
    </Button>
  );
}
