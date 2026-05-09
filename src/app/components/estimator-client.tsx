
"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { 
  Building, Plus, LayoutGrid, 
  RectangleHorizontal, RefreshCw, Trash2, 
  Download, Clipboard as ClipboardIcon, Copy as CopyIcon, Scissors, Undo2, Redo2,
  Settings2, Move, Pencil, ZoomIn, ZoomOut, Maximize2,
  ChevronDown, PaintBucket, Layers, FlipHorizontal, FlipVertical,
  BringToFront, SendToBack, GripHorizontal, Menu as MenuIcon,
  Paintbrush, Star, RotateCw, Folder, FilePlus, FolderOpen, Save, Printer, Settings, User,
  Grid, Briefcase, Database, Sparkles, Search, PenLine, Box, Type as TypeIcon,
  Ruler, Info, Circle, Triangle, Diamond, ArrowRight, Hexagon, Octagon,
  Bold, MousePointer2, Square, DoorOpen, Wind
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

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];

export default function EstimatorClient() {
  const { toast } = useToast();
  const [designObjects, setDesignObjects] = useState<DesignObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
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
  const [clipboard, setClipboard] = useState<DesignObject | null>(null);

  const [history, setHistory] = useState<DesignObject[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Local state for precision inputs to prevent cursor jumps
  const [localPropX, setLocalPropX] = useState("");
  const [localPropY, setLocalPropY] = useState("");
  const [localPropW, setLocalPropW] = useState("");
  const [localPropH, setLocalPropH] = useState("");

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

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      setDesignObjects([...history[prevIndex].map(obj => ({...obj}))]);
      setSelectedObjectId(null);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setDesignObjects([...history[nextIndex].map(obj => ({...obj}))]);
      setSelectedObjectId(null);
    }
  }, [history, historyIndex]);
  
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
  }, [selectedObjectId, selectedObject]);

  const updateObject = useCallback((id: string, updates: Partial<DesignObject>, save = false) => {
    setDesignObjects(objs => {
      const next = objs.map(o => o.id === id ? { ...o, ...updates } : o);
      if (save) saveToHistory(next);
      return next;
    });
  }, [saveToHistory]);

  const deleteObject = useCallback((id: string | null) => {
    if (!id) return;
    const next = designObjects.filter(o => o.id !== id);
    setDesignObjects(next);
    setSelectedObjectId(null);
    saveToHistory(next);
  }, [designObjects, saveToHistory]);

  const copySelected = useCallback(() => {
    if (selectedObject) {
      setClipboard({ ...selectedObject });
      toast({ title: "Copied to clipboard" });
    }
  }, [selectedObject, toast]);

  const pasteObject = useCallback(() => {
    if (clipboard) {
      const newObj = { ...clipboard, id: Math.random().toString(36).substr(2, 9), x: clipboard.x + 0.5, y: clipboard.y + 0.5 };
      const next = [...designObjects, newObj];
      setDesignObjects(next);
      setSelectedObjectId(newObj.id);
      saveToHistory(next);
      toast({ title: "Pasted object" });
    }
  }, [clipboard, designObjects, saveToHistory, toast]);

  // Handle Keyboard Interactions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      const step = 0.08; // Set step to 0.08 inch per press as requested

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault(); copySelected();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault(); pasteObject();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault(); undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault(); redo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault(); deleteObject(selectedObjectId);
      } else if (selectedObjectId && selectedObject) {
        if (e.key === 'ArrowUp') {
          e.preventDefault(); updateObject(selectedObjectId, { y: selectedObject.y - step }, true);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault(); updateObject(selectedObjectId, { y: selectedObject.y + step }, true);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault(); updateObject(selectedObjectId, { x: selectedObject.x - step }, true);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault(); updateObject(selectedObjectId, { x: selectedObject.x + step }, true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObjectId, selectedObject, copySelected, pasteObject, deleteObject, undo, redo, updateObject]);

  const getPoints = (obj: DesignObject) => {
    const rad = (obj.rotation || 0) * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    if (obj.subType === 'wall') {
      return [
        { x: obj.x, y: obj.y },
        { x: obj.x + obj.w * cos, y: obj.y + obj.w * sin }
      ];
    }
    return [
      { x: obj.x, y: obj.y },
      { x: obj.x + obj.w, y: obj.y },
      { x: obj.x, y: obj.y + obj.h },
      { x: obj.x + obj.w, y: obj.y + obj.h }
    ];
  };

  const getClosestPointOnSegment = (p: {x: number, y: number}, a: {x: number, y: number}, b: {x: number, y: number}) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (dx === 0 && dy === 0) return a;
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
    if (t < 0) return a;
    if (t > 1) return b;
    return { x: a.x + t * dx, y: a.y + t * dy };
  };

  const findSnapPoint = (x: number, y: number, excludeIds: string[] = []) => {
    const threshold = 0.4;
    let bestSnap: {x: number, y: number} | null = null;
    let minDist = threshold;
    
    // Grid snap
    const gx = Math.round(x * 12) / 12;
    const gy = Math.round(y * 12) / 12;
    const gd = Math.sqrt(Math.pow(x - gx, 2) + Math.pow(y - gy, 2));
    if (gd < 0.15) {
      bestSnap = { x: gx, y: gy };
      minDist = gd;
    }

    // Wall segment snap
    designObjects.forEach(obj => {
      if (excludeIds.includes(obj.id)) return;
      const pts = getPoints(obj);
      if (obj.subType === 'wall' && pts.length === 2) {
        const cp = getClosestPointOnSegment({x, y}, pts[0], pts[1]);
        const d = Math.sqrt(Math.pow(x - cp.x, 2) + Math.pow(y - cp.y, 2));
        if (d < minDist) {
          minDist = d;
          bestSnap = cp;
        }
      } else {
        pts.forEach(p => {
          const d = Math.sqrt(Math.pow(x - p.x, 2) + Math.pow(y - p.y, 2));
          if (d < minDist) {
            minDist = d;
            bestSnap = p;
          }
        });
      }
    });
    return bestSnap;
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
            if (dist < 0.15) isNear = true;
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
      x: 5, y: 5, 
      w: subType === 'door' ? 3 : subType === 'window' ? 4 : 6, 
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

    if (selectedTool === 'wall' || interactionMode === 'drawing') {
      e.stopPropagation();
      const snapped = findSnapPoint(curX, curY);
      const startPos = snapped || { x: Math.round(curX * 12) / 12, y: Math.round(curY * 12) / 12 };
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
      const snapped = findSnapPoint(curX, curY, []);
      setTempDrawEnd(snapped || { x: Math.round(curX * 12) / 12, y: Math.round(curY * 12) / 12 });
      setSnapPoint(snapped);
      return;
    }

    if (!selectedObjectId || interactionMode === 'none') return;
    const curr = designObjects.find(o => o.id === selectedObjectId);
    if (!curr) return;

    if (interactionMode === 'dragging') {
      const snapped = findSnapPoint(curX - dragOffset.x, curY - dragOffset.y, connectedGroup);
      const targetX = snapped ? snapped.x : (Math.round((curX - dragOffset.x) * 12) / 12);
      const targetY = snapped ? snapped.y : (Math.round((curY - dragOffset.y) * 12) / 12);
      
      const dx = targetX - curr.x;
      const dy = targetY - curr.y;
      
      setDesignObjects(objs => objs.map(o => connectedGroup.includes(o.id) ? { ...o, x: o.x + dx, y: o.y + dy } : o));
      setSnapPoint(snapped);
    } else if (interactionMode === 'resizing') {
      updateObject(selectedObjectId, { w: Math.max(0.1, curX - curr.x), h: Math.max(0.1, curY - curr.y) });
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
      if (length > 0.1) {
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        const newWall: DesignObject = {
          id: Math.random().toString(36).substr(2, 9),
          type: 'structure', subType: 'wall', 
          x: drawStart.x, y: drawStart.y, 
          w: length, h: currentWallThickness,
          label: 'Wall', color: '#000000', fillColor: '#000000',
          strokeWidth: 0, strokeStyle: 'solid',
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

  return (
    <div className="w-full mx-auto p-0 bg-slate-100 min-h-screen flex flex-col overflow-hidden font-body text-slate-900">
      {/* Header Bar */}
      <div className="h-10 bg-slate-200 border-b flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-6 h-full">
          <div className="flex items-center gap-2 pr-4 border-r border-slate-300">
            <Building className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-sm text-slate-700 tracking-tighter uppercase">SmartDraw Pro</span>
          </div>
          <nav className="flex gap-1 h-full pt-1">
            {['File', 'Home', 'Design', 'Table'].map(item => (
              <Button key={item} variant="ghost" onClick={() => setActiveRibbonTab(item.toLowerCase())}
                className={cn("h-9 px-4 text-[11px] font-bold transition-all rounded-t-md rounded-b-none border-b-2",
                  activeRibbonTab === item.toLowerCase() ? "bg-white text-blue-600 border-blue-600 shadow-sm" : "text-slate-600 hover:bg-slate-300 border-transparent")}>{item}</Button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-white rounded px-2 py-1 shadow-inner border">
             <span className="text-[10px] font-bold text-blue-600">PREMIUM</span>
          </div>
          <User className="w-5 h-5 text-slate-500 cursor-pointer" />
        </div>
      </div>

      {/* Ribbon Toolbar */}
      <div className="h-24 bg-white border-b flex items-center px-4 gap-0 shrink-0 shadow-sm z-30 overflow-x-auto no-scrollbar">
        {activeRibbonTab === 'file' && (
          <div className="flex items-center h-full gap-2 px-2">
            <RibbonButton icon={<FilePlus />} label="New" onClick={() => { setDesignObjects([]); saveToHistory([]); }} />
            <RibbonButton icon={<FolderOpen />} label="Open" />
            <RibbonButton icon={<Save />} label="Save" onClick={() => toast({ title: "Saved Successfully" })} />
            <div className="w-[1px] h-12 bg-slate-200 mx-2" />
            <RibbonButton icon={<Printer />} label="Print" onClick={() => window.print()} />
            <RibbonButton icon={<Download />} label="Export" />
          </div>
        )}
        {activeRibbonTab === 'home' && (
          <>
            <div className="flex items-center border-r px-3 h-full gap-1">
              <RibbonButton icon={<Undo2 />} label="Undo" onClick={undo} disabled={historyIndex <= 0} />
              <RibbonButton icon={<Redo2 />} label="Redo" onClick={redo} disabled={historyIndex >= history.length - 1} />
            </div>
            <div className="flex items-center border-r px-3 h-full gap-1">
              <RibbonButton icon={<ClipboardIcon />} label="Paste" onClick={pasteObject} />
              <div className="flex flex-col gap-1">
                <Button variant="ghost" size="sm" onClick={copySelected} className="h-7 px-2 justify-start gap-2 text-[10px] font-bold uppercase"><CopyIcon className="w-3.5 h-3.5" /> Copy</Button>
                <Button variant="ghost" size="sm" className="h-7 px-2 justify-start gap-2 text-[10px] font-bold uppercase"><Scissors className="w-3.5 h-3.5" /> Cut</Button>
              </div>
            </div>
            <div className="flex items-center border-r px-3 h-full gap-2">
              <div className="flex flex-col gap-1">
                <Select value={selectedObject?.fontSize?.toString() || "14"} onValueChange={(val) => selectedObjectId && updateObject(selectedObjectId, { fontSize: parseInt(val) }, true)}>
                  <SelectTrigger className="h-7 w-20 text-[10px] font-bold"><SelectValue placeholder="Size" /></SelectTrigger>
                  <SelectContent>{FONT_SIZES.map(s => (<SelectItem key={s} value={s.toString()}>{s} pt</SelectItem>))}</SelectContent>
                </Select>
                <div className="flex gap-1">
                  <Button variant={selectedObject?.isBold ? "secondary" : "ghost"} size="icon" className="h-7 w-7 border" onClick={() => selectedObjectId && updateObject(selectedObjectId, { isBold: !selectedObject?.isBold }, true)}><Bold className="w-3.5 h-3.5" /></Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" className="h-7 w-7 border p-0"><PaintBucket className="w-3.5 h-3.5" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent className="p-2 w-48">
                      <div className="grid grid-cols-5 gap-1">
                        {COLORS.map(c => (<div key={c} onClick={() => selectedObjectId && updateObject(selectedObjectId, { color: c, fillColor: c }, true)} className="w-6 h-6 rounded border cursor-pointer hover:scale-110" style={{ backgroundColor: c }} />))}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
            <RibbonButton icon={<Trash2 />} label="Delete" variant="destructive" onClick={() => deleteObject(selectedObjectId)} />
          </>
        )}
        {activeRibbonTab === 'table' && (
          <div className="flex items-center h-full">
            <div className="flex flex-col gap-1 px-4 border-r mr-2">
               <div className="flex items-center gap-2"><Label className="text-[9px] font-bold w-10 text-slate-500">ROWS</Label><Input type="number" value={tableRows} onChange={(e) => setTableRows(parseInt(e.target.value))} className="h-7 w-16 text-[10px] font-bold" /></div>
               <div className="flex items-center gap-2"><Label className="text-[9px] font-bold w-10 text-slate-500">COLS</Label><Input type="number" value={tableCols} onChange={(e) => setTableCols(parseInt(e.target.value))} className="h-7 w-16 text-[10px] font-bold" /></div>
            </div>
            <RibbonButton icon={<LayoutGrid />} label="Insert Table" onClick={() => addObject('table', 'table', 'Table', { rows: tableRows, cols: tableCols })} />
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Library */}
        <div className="w-[320px] bg-slate-50 border-r z-20 shrink-0 flex shadow-lg">
          <div className="w-12 bg-slate-800 flex flex-col items-center py-4 gap-6 shrink-0">
             <Briefcase className="w-5 h-5 text-slate-400 cursor-pointer hover:text-white" />
             <Database className="w-5 h-5 text-slate-400 cursor-pointer hover:text-white" />
             <Sparkles className="w-5 h-5 text-slate-400 cursor-pointer hover:text-white" />
          </div>
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            <div className="p-3 border-b flex items-center justify-between bg-slate-50"><span className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">Library</span><Search className="w-3.5 h-3.5 text-slate-400" /></div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-4">
                <div className="grid grid-cols-4 gap-2 mb-4">
                  <ToolCard icon={<MousePointer2 />} label="Select" active={selectedTool === 'select'} onClick={() => { setSelectedTool('select'); setInteractionMode('none'); }} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><div><ToolCard icon={<Box />} label="Shape" active={selectedTool === 'shape'} onClick={() => setSelectedTool('shape')} /></div></DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64 p-3 grid grid-cols-4 gap-3">
                      {[
                        {s:'rect', i:<Square />}, {s:'oval', i:<Circle />}, {s:'tri', i:<Triangle />}, 
                        {s:'diamond', i:<Diamond />}, {s:'arrow', i:<ArrowRight />}, {s:'hex', i:<Hexagon />}, 
                        {s:'oct', i:<Octagon />}
                      ].map(item => (
                        <div key={item.s} className="p-2 border rounded hover:bg-blue-50 cursor-pointer flex justify-center" onClick={() => addObject('shape', item.s, item.s.toUpperCase())}>{React.cloneElement(item.i as React.ReactElement, { className: "w-6 h-6" })}</div>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <ToolCard icon={<PenLine />} label="Line" active={selectedTool === 'line'} onClick={() => setSelectedTool('line')} />
                  <ToolCard icon={<TypeIcon />} label="Text" active={selectedTool === 'text'} onClick={() => setSelectedTool('text')} />
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="outline" className="w-full justify-start gap-2 h-10 font-bold border-slate-300 bg-blue-50/50"><Pencil className="w-4 h-4 text-blue-600" /><span className="text-xs uppercase">Add Wall</span><ChevronDown className="ml-auto w-3.5 h-3.5 text-slate-400" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    <DropdownMenuItem onClick={() => { setCurrentWallThickness(4/12); setSelectedTool('wall'); setInteractionMode('drawing'); }}>Interior Wall 4"</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setCurrentWallThickness(6/12); setSelectedTool('wall'); setInteractionMode('drawing'); }}>Exterior Wall 6"</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Accordion type="multiple" defaultValue={["openings"]} className="w-full">
                  <AccordionItem value="openings" className="border-slate-200">
                    <AccordionTrigger className="h-10 px-0 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Doors & Windows</AccordionTrigger>
                    <AccordionContent className="grid grid-cols-2 gap-2 pt-1">
                      <SymbolButton icon={<DoorOpen />} label="Single Door" onClick={() => addObject('opening', 'door', 'Door')} />
                      <SymbolButton icon={<Wind />} label="Window" onClick={() => addObject('opening', 'window', 'Window')} />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Workspace */}
        <div className="flex-1 relative flex flex-col overflow-hidden bg-slate-200">
          <div id="canvas-workspace" className="flex-1 relative bg-white overflow-auto cursor-crosshair m-4 shadow-2xl rounded-sm border"
            onMouseDown={(e) => handleMouseDown(e, null)} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
            <div className="absolute inset-0" style={{ 
                backgroundImage: `linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)`,
                backgroundSize: `${zoom}px ${zoom}px`, width: 4000, height: 4000, backgroundColor: 'white'
              }}>
              {designObjects.map(obj => (
                <div key={obj.id} onMouseDown={(e) => handleMouseDown(e, obj.id)}
                  className={cn("absolute flex items-center justify-center cursor-move select-none", 
                    selectedObjectId === obj.id ? "z-30 ring-2 ring-blue-600 shadow-xl" : "z-10")}
                  style={{ 
                    left: obj.x * zoom, top: obj.y * zoom, width: obj.w * zoom, height: obj.h * zoom, 
                    transformOrigin: '0 0', transform: `rotate(${obj.rotation}deg)`,
                    backgroundColor: (obj.subType === 'wall' || obj.type === 'text') ? 'transparent' : obj.fillColor, 
                    borderRadius: obj.subType === 'oval' ? '9999px' : '0px',
                    color: obj.color, 
                    fontSize: obj.type === 'text' ? (obj.fontSize || 14) * (zoom/40) : 'inherit', 
                    fontWeight: (obj.type === 'text' && obj.isBold) ? 'bold' : 'normal' 
                  }}>
                  {obj.subType === 'wall' && <div className="absolute inset-0 border-y" style={{ backgroundColor: obj.color, borderColor: obj.color, height: '100%' }} />}
                  {obj.subType === 'door' && (
                    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="overflow-visible">
                      <line x1="0" y1="100" x2="0" y2="0" stroke={obj.color} strokeWidth="4" />
                      <path d="M 0 0 A 100 100 0 0 1 100 100" fill="none" stroke={obj.color} strokeWidth="2" strokeDasharray="4 2" />
                    </svg>
                  )}
                  {obj.subType === 'window' && (
                    <div className="absolute inset-0 border-x-2 flex flex-col justify-between py-1 bg-white" style={{ borderColor: obj.color }}>
                      <div className="w-full h-[1px]" style={{ backgroundColor: obj.color }} />
                      <div className="w-full h-[2px] opacity-40" style={{ backgroundColor: obj.color }} />
                      <div className="w-full h-[1px]" style={{ backgroundColor: obj.color }} />
                    </div>
                  )}
                  {obj.type === 'text' && <div className="px-2">{obj.textContent}</div>}
                  {obj.type === 'table' && (
                    <div className="grid w-full h-full border" style={{ borderColor: obj.color, gridTemplateColumns: `repeat(${obj.cols}, 1fr)`, gridTemplateRows: `repeat(${obj.rows}, 1fr)` }}>
                      {Array.from({ length: (obj.rows || 1) * (obj.cols || 1) }).map((_, i) => (
                        <div key={i} className="border border-slate-200 bg-white/50" />
                      ))}
                    </div>
                  )}
                  {selectedObjectId === obj.id && (
                    <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-600 rounded-full cursor-se-resize z-40 border-2 border-white shadow-lg" 
                      onMouseDown={(e) => handleMouseDown(e, obj.id, 'resizing')} />
                  )}
                </div>
              ))}
              
              {/* Drawing Preview */}
              {interactionMode === 'drawing' && drawStart && tempDrawEnd && (
                <div className="absolute bg-blue-400/40 pointer-events-none z-50 border border-blue-600 border-dashed"
                  style={{
                    left: drawStart.x * zoom,
                    top: drawStart.y * zoom,
                    width: Math.sqrt(Math.pow(tempDrawEnd.x - drawStart.x, 2) + Math.pow(tempDrawEnd.y - drawStart.y, 2)) * zoom,
                    height: currentWallThickness * zoom,
                    transformOrigin: '0 0',
                    transform: `rotate(${Math.atan2(tempDrawEnd.y - drawStart.y, tempDrawEnd.x - drawStart.x) * (180 / Math.PI)}deg)`,
                  }}
                />
              )}
              
              {/* Snap Indicator (Blue Circle) */}
              {snapPoint && (
                <div className="absolute w-3 h-3 bg-blue-500 rounded-full border-2 border-white z-50 pointer-events-none shadow-lg"
                  style={{ left: snapPoint.x * zoom - 6, top: snapPoint.y * zoom - 6 }} />
              )}
            </div>
          </div>
          
          <div className="h-10 bg-white border-t flex items-center px-4 justify-between shrink-0 shadow-inner">
             <div className="flex items-center gap-4">
                <div className="flex items-center gap-2"><ZoomOut className="w-4 h-4 text-slate-400" /><Slider value={[zoom]} max={150} min={10} step={5} className="w-40" onValueChange={(val) => setZoom(val[0])} /><ZoomIn className="w-4 h-4 text-slate-400" /></div>
                <span className="text-[10px] font-bold text-slate-500">{zoom}% Zoom</span>
             </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-[260px] bg-white border-l z-20 shrink-0 flex flex-col shadow-xl">
           <div className="p-2 border-b bg-slate-50 flex items-center justify-between"><span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Properties</span><Settings2 className="w-3.5 h-3.5 text-slate-400" /></div>
           <ScrollArea className="flex-1">
              <div className="p-2 space-y-3">
                 {selectedObject ? (
                    <div className="space-y-4">
                       {selectedObject.type === 'text' && (
                          <div className="space-y-1"><Label className="text-[8px] font-bold text-slate-500 uppercase">Text Content</Label>
                             <Input className="h-7 text-[10px] bg-slate-50" value={selectedObject.textContent || ''} onChange={(e) => updateObject(selectedObject.id, { textContent: e.target.value }, true)} />
                          </div>
                       )}
                       <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1"><Label className="text-[8px] font-bold text-slate-400 uppercase">Left Pos</Label><Input className="h-7 text-[10px]" value={localPropX} onChange={(e) => setLocalPropX(e.target.value)} onBlur={() => updateObject(selectedObjectId!, { x: parseFeetInches(localPropX) }, true)} placeholder={"0' 0\""} /></div>
                          <div className="space-y-1"><Label className="text-[8px] font-bold text-slate-400 uppercase">Top Pos</Label><Input className="h-7 text-[10px]" value={localPropY} onChange={(e) => setLocalPropY(e.target.value)} onBlur={() => updateObject(selectedObjectId!, { y: parseFeetInches(localPropY) }, true)} placeholder={"0' 0\""} /></div>
                          <div className="space-y-1"><Label className="text-[8px] font-bold text-slate-400 uppercase">Width</Label><Input className="h-7 text-[10px]" value={localPropW} onChange={(e) => setLocalPropW(e.target.value)} onBlur={() => updateObject(selectedObjectId!, { w: parseFeetInches(localPropW) }, true)} placeholder={"0' 0\""} /></div>
                          <div className="space-y-1"><Label className="text-[8px] font-bold text-slate-400 uppercase">Height</Label><Input className="h-7 text-[10px]" value={localPropH} onChange={(e) => setLocalPropH(e.target.value)} onBlur={() => updateObject(selectedObjectId!, { h: parseFeetInches(localPropH) }, true)} placeholder={"0' 0\""} /></div>
                       </div>
                       <div className="space-y-1 pt-2 border-t">
                          <Label className="text-[8px] font-bold text-slate-500 uppercase">Rotation: {selectedObject.rotation}°</Label>
                          <Slider value={[selectedObject.rotation]} max={360} min={0} step={1} onValueChange={(val) => updateObject(selectedObject.id, { rotation: val[0] }, true)} />
                       </div>
                    </div>
                 ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-3 py-24 opacity-30 px-6">
                       <MousePointer2 className="w-8 h-8 text-slate-300" />
                       <p className="text-[9px] uppercase tracking-widest font-bold leading-relaxed">Select element to edit</p>
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
    <div onClick={onClick} className={cn("flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer transition-all border shadow-sm",
      active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50")}>
       {React.cloneElement(icon as React.ReactElement, { className: "w-4 h-4 mb-1" })}
       <span className="text-[9px] font-bold uppercase tracking-tighter">{label}</span>
    </div>
  );
}

function SymbolButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) {
  return (
    <Button variant="outline" onClick={onClick} className="w-full flex flex-col items-center justify-center gap-1.5 h-16 p-2 bg-white hover:bg-slate-50 transition-all group shadow-sm">
       {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5 text-slate-500 group-hover:text-blue-600" })}
       <span className="text-[9px] font-bold text-slate-600 uppercase group-hover:text-slate-900">{label}</span>
    </Button>
  );
}

function RibbonButton({ icon, label, onClick, disabled, variant = "ghost" }: { icon: React.ReactNode, label: string, onClick?: () => void, disabled?: boolean, variant?: any }) {
  return (
    <Button variant={variant} disabled={disabled} onClick={onClick} className="h-20 flex flex-col gap-1.5 px-4 hover:bg-slate-50 min-w-[80px] group transition-colors rounded-none">
      {React.cloneElement(icon as React.ReactElement, { className: cn("w-5 h-5", variant === "destructive" ? "text-red-500" : "text-slate-600 group-hover:text-blue-600") })}
      <span className={cn("text-[9px] uppercase font-bold", variant === "destructive" ? "text-red-600" : "text-slate-500 group-hover:text-slate-800")}>{label}</span>
    </Button>
  );
}
