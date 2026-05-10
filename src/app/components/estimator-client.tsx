
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
  Bold, MousePointer2, Square, DoorOpen, Wind, TowerControl as PillarIcon,
  Link, Link2, Unlink
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
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
import { Checkbox } from "@/components/ui/checkbox";

type DesignObject = {
  id: string;
  type: 'structure' | 'opening' | 'shape' | 'text' | 'pillar' | 'table';
  subType: string;
  x: number; y: number; w: number; h: number;
  label: string; 
  color: string; 
  fillColor: string; 
  strokeWidth: number;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  rotation: number;
  textContent?: string;
  fontSize?: number;
  isBold?: boolean;
  rows?: number;
  cols?: number;
  isJoined?: boolean; 
};

const COLORS = ['#000000', '#ffffff', '#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#6366f1', '#a855f7', '#64748b'];
const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 48];

export default function EstimatorClient() {
  const { toast } = useToast();
  const [designObjects, setDesignObjects] = useState<DesignObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [interactionMode, setInteractionMode] = useState<'none' | 'dragging' | 'resizing' | 'rotating' | 'drawing'>('none');
  const [selectedTool, setSelectedTool] = useState<'select' | 'shape' | 'line' | 'text' | 'wall' | 'opening' | 'symbol' | 'pillar'>('select');
  const [drawStart, setDrawStart] = useState<{x: number, y: number} | null>(null);
  const [tempDrawEnd, setTempDrawEnd] = useState<{x: number, y: number} | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(40);
  const [snapPoint, setSnapPoint] = useState<{x: number, y: number} | null>(null);
  const [connectedGroup, setConnectedGroup] = useState<string[]>([]);
  const [activeRibbonTab, setActiveRibbonTab] = useState('home');
  const [currentWallThickness, setCurrentWallThickness] = useState(0.33); 
  const [clipboard, setClipboard] = useState<DesignObject | null>(null);
  const [history, setHistory] = useState<DesignObject[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [localPropX, setLocalPropX] = useState("");
  const [localPropY, setLocalPropY] = useState("");
  const [localPropW, setLocalPropW] = useState("");
  const [localPropH, setLocalPropH] = useState("");

  const formatFeetInches = (val: number) => {
    const feet = Math.floor(Math.abs(val));
    const inches = Math.round((Math.abs(val) - feet) * 12);
    if (feet === 0) return `${inches}"`;
    if (inches === 0) return `${feet}'`;
    if (inches === 12) return `${feet + 1}'`;
    return `${feet}' ${inches}"`;
  };

  const parseFeetInches = (str: string) => {
    const match = str.match(/(\d+)'\s*(\d+)"/);
    if (match) return parseInt(match[1]) + parseInt(match[2]) / 12;
    const decimal = parseFloat(str);
    return isNaN(decimal) ? 0 : decimal;
  };

  const selectedObject = useMemo(() => designObjects.find(obj => obj.id === selectedObjectId), [designObjects, selectedObjectId]);

  useEffect(() => {
    if (selectedObject) {
      setLocalPropX(formatFeetInches(selectedObject.x));
      setLocalPropY(formatFeetInches(selectedObject.y));
      setLocalPropW(formatFeetInches(selectedObject.w));
      setLocalPropH(formatFeetInches(selectedObject.h));
    }
  }, [selectedObject]);

  const saveToHistory = useCallback((newObjects: DesignObject[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...newObjects.map(obj => ({...obj}))]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const updateObject = (id: string, updates: Partial<DesignObject>, save = false) => {
    setDesignObjects(prev => {
      const next = prev.map(o => o.id === id ? { ...o, ...updates } : o);
      if (save) saveToHistory(next);
      return next;
    });
  };

  const deleteObject = useCallback((id: string | null) => {
    if (!id) return;
    setDesignObjects(prev => {
      const next = prev.filter(o => o.id !== id);
      saveToHistory(next);
      return next;
    });
    setSelectedObjectId(null);
  }, [saveToHistory]);

  const getPoints = useCallback((obj: DesignObject) => {
    const rad = (obj.rotation || 0) * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    if (obj.subType === 'wall') {
      return [
        { x: obj.x, y: obj.y },
        { x: obj.x + obj.w * cos, y: obj.y + obj.w * sin },
        { x: obj.x + (obj.w/2) * cos, y: obj.y + (obj.w/2) * sin } 
      ];
    }
    return [
      { x: obj.x, y: obj.y },
      { x: obj.x + obj.w, y: obj.y },
      { x: obj.x, y: obj.y + obj.h },
      { x: obj.x + obj.w, y: obj.y + obj.h },
      { x: obj.x + obj.w / 2, y: obj.y + obj.h / 2 }
    ];
  }, []);

  const findSnapPoint = useCallback((x: number, y: number, excludeIds: string[] = []) => {
    let bestSnap: {x: number, y: number} | null = null;
    let minDist = 0.8; 

    designObjects.forEach(obj => {
      if (excludeIds.includes(obj.id)) return;
      const pts = getPoints(obj);
      
      pts.forEach(p => {
        const d = Math.sqrt(Math.pow(x - p.x, 2) + Math.pow(y - p.y, 2));
        if (d < minDist) {
          minDist = d;
          bestSnap = p;
        }
      });

      if (obj.subType === 'wall') {
        const rad = (obj.rotation || 0) * (Math.PI / 180);
        const p1 = { x: obj.x, y: obj.y };
        const p2 = { x: obj.x + obj.w * Math.cos(rad), y: obj.y + obj.w * Math.sin(rad) };
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return;
        const t = Math.max(0, Math.min(1, ((x - p1.x) * dx + (y - p1.y) * dy) / lenSq));
        const cp = { x: p1.x + t * dx, y: p1.y + t * dy };
        const d = Math.sqrt(Math.pow(x - cp.x, 2) + Math.pow(y - cp.y, 2));
        if (d < minDist) {
          minDist = d;
          bestSnap = cp;
        }
      }
    });

    if (!bestSnap) {
      const gx = Math.round(x * 20) / 20; 
      const gy = Math.round(y * 20) / 20;
      if (Math.sqrt(Math.pow(x - gx, 2) + Math.pow(y - gy, 2)) < 0.1) {
        bestSnap = { x: gx, y: gy };
      }
    }
    return bestSnap;
  }, [designObjects, getPoints]);

  const getConnectedGroup = useCallback((startId: string, all: DesignObject[]) => {
    const startObj = all.find(o => o.id === startId);
    if (!startObj || !startObj.isJoined) return [startId];

    const connected = new Set<string>();
    const stack = [startId];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (connected.has(id)) continue;
      connected.add(id);
      const curr = all.find(o => o.id === id);
      if (!curr || !curr.isJoined) continue;

      const pts1 = getPoints(curr);
      all.forEach(other => {
        if (!other.isJoined || connected.has(other.id)) return;
        const pts2 = getPoints(other);
        let near = false;
        pts1.forEach(p1 => pts2.forEach(p2 => {
          if (Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2)) < 0.5) near = true;
        }));
        if (near) stack.push(other.id);
      });
    }
    return Array.from(connected);
  }, [getPoints]);

  const addObject = useCallback((type: DesignObject['type'], subType: string, label: string, overrides = {}) => {
    const newObj: DesignObject = {
      id: Math.random().toString(36).substr(2, 9),
      type, subType, x: 5, y: 5, w: 2, h: 2, label, 
      color: '#000000', fillColor: subType === 'pillar' ? '#64748b' : '#ffffff',
      strokeWidth: 2, strokeStyle: 'solid', rotation: 0,
      isJoined: true, 
      ...overrides
    };
    const next = [...designObjects, newObj];
    setDesignObjects(next);
    setSelectedObjectId(newObj.id);
    saveToHistory(next);
  }, [designObjects, saveToHistory]);

  const handleMouseDown = (e: React.MouseEvent, id: string | null, mode: any = 'dragging') => {
    const rect = document.getElementById('canvas-workspace')?.getBoundingClientRect();
    if (!rect) return;
    const curX = (e.clientX - rect.left) / zoom;
    const curY = (e.clientY - rect.top) / zoom;

    if (selectedTool === 'wall') {
      const snap = findSnapPoint(curX, curY);
      const start = snap || { x: Math.round(curX * 20) / 20, y: Math.round(curY * 20) / 20 };
      setDrawStart(start);
      setTempDrawEnd(start);
      setInteractionMode('drawing');
      return;
    }

    if (selectedTool === 'pillar') {
      const snap = findSnapPoint(curX, curY);
      const pos = snap || { x: curX, y: curY };
      addObject('pillar', 'pillar', 'Column', { x: pos.x - 0.4, y: pos.y - 0.4, w: 0.8, h: 0.8 });
      setSelectedTool('select');
      return;
    }

    if (selectedTool === 'text') {
       addObject('text', 'label', 'Label', { x: curX, y: curY, textContent: 'New Label', fontSize: 14 });
       setSelectedTool('select');
       return;
    }

    if (id) {
      e.stopPropagation();
      setSelectedObjectId(id);
      setInteractionMode(mode);
      const obj = designObjects.find(o => o.id === id);
      if (obj) {
        setDragOffset({ x: curX - obj.x, y: curY - obj.y });
        setConnectedGroup(getConnectedGroup(id, designObjects));
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
      const snap = findSnapPoint(curX, curY);
      setTempDrawEnd(snap || { x: Math.round(curX * 20) / 20, y: Math.round(curY * 20) / 20 });
      setSnapPoint(snap);
      return;
    }

    if (interactionMode === 'dragging' && selectedObjectId) {
      const curr = designObjects.find(o => o.id === selectedObjectId);
      if (!curr) return;
      
      const potentialX = curX - dragOffset.x;
      const potentialY = curY - dragOffset.y;
      
      const snap = findSnapPoint(potentialX, potentialY, connectedGroup);
      const targetX = snap ? snap.x : Math.round(potentialX * 20) / 20;
      const targetY = snap ? snap.y : Math.round(potentialY * 20) / 20;
      
      const dx = targetX - curr.x;
      const dy = targetY - curr.y;
      
      setDesignObjects(prev => prev.map(o => connectedGroup.includes(o.id) ? { ...o, x: o.x + dx, y: o.y + dy } : o));
      setSnapPoint(snap);
    }

    if (interactionMode === 'resizing' && selectedObjectId) {
      const curr = designObjects.find(o => o.id === selectedObjectId);
      if (!curr) return;
      const nextW = Math.max(0.1, curX - curr.x);
      const nextH = Math.max(0.1, curY - curr.y);
      setDesignObjects(prev => prev.map(o => o.id === selectedObjectId ? { ...o, w: nextW, h: nextH } : o));
    }
  };

  const handleMouseUp = () => {
    if (interactionMode === 'drawing' && drawStart && tempDrawEnd) {
      const dx = tempDrawEnd.x - drawStart.x;
      const dy = tempDrawEnd.y - drawStart.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0.2) {
        addObject('structure', 'wall', 'Wall', {
          x: drawStart.x, y: drawStart.y, w: len, h: currentWallThickness,
          rotation: Math.atan2(dy, dx) * (180 / Math.PI)
        });
      }
      setDrawStart(null); setTempDrawEnd(null);
    } else if (interactionMode !== 'none') {
      saveToHistory(designObjects);
    }
    setInteractionMode('none');
    setSnapPoint(null);
  };

  const copyObject = useCallback(() => {
    if (selectedObject) {
      setClipboard({...selectedObject, id: Math.random().toString(36).substr(2, 9)});
      toast({ title: "Copy", description: "অবজেক্টটি কপি করা হয়েছে।" });
    }
  }, [selectedObject, toast]);

  const pasteObject = useCallback(() => {
    if (clipboard) {
      const nextObj = { ...clipboard, id: Math.random().toString(36).substr(2, 9), x: clipboard.x + 0.5, y: clipboard.y + 0.5 };
      const next = [...designObjects, nextObj];
      setDesignObjects(next);
      setSelectedObjectId(nextObj.id);
      saveToHistory(next);
      setClipboard(nextObj);
      toast({ title: "Paste", description: "অবজেক্টটি পেস্ট করা হয়েছে।" });
    }
  }, [clipboard, designObjects, saveToHistory, toast]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const nextIndex = historyIndex - 1;
      setHistoryIndex(nextIndex);
      setDesignObjects(history[nextIndex]);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setDesignObjects(history[nextIndex]);
    }
  }, [history, historyIndex]);

  // Pillar to Pillar Distances Calculation
  const pillarDistances = useMemo(() => {
    const pillars = designObjects.filter(o => o.type === 'pillar');
    const distances: {x1: number, y1: number, x2: number, y2: number, dist: string, horizontal: boolean}[] = [];
    
    pillars.forEach((p1, i) => {
      pillars.forEach((p2, j) => {
        if (i >= j) return;
        const dx = Math.abs((p1.x + p1.w/2) - (p2.x + p2.w/2));
        const dy = Math.abs((p1.y + p1.h/2) - (p2.y + p2.h/2));
        
        // Horizontal distance
        if (dy < 0.5 && dx > 1) {
          distances.push({
            x1: p1.x + p1.w/2, y1: p1.y + p1.h/2,
            x2: p2.x + p2.w/2, y2: p2.y + p2.h/2,
            dist: formatFeetInches(dx),
            horizontal: true
          });
        }
        // Vertical distance
        if (dx < 0.5 && dy > 1) {
          distances.push({
            x1: p1.x + p1.w/2, y1: p1.y + p1.h/2,
            x2: p2.x + p2.w/2, y2: p2.y + p2.h/2,
            dist: formatFeetInches(dy),
            horizontal: false
          });
        }
      });
    });
    return distances;
  }, [designObjects]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return;
      
      const step = 0.05; 
      
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault(); copyObject();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault(); pasteObject();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault(); undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault(); redo();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteObject(selectedObjectId);
      }

      if (selectedObjectId && selectedObject) {
        const group = getConnectedGroup(selectedObjectId, designObjects);
        if (e.key === 'ArrowUp') setDesignObjects(prev => prev.map(o => group.includes(o.id) ? { ...o, y: o.y - step } : o));
        if (e.key === 'ArrowDown') setDesignObjects(prev => prev.map(o => group.includes(o.id) ? { ...o, y: o.y + step } : o));
        if (e.key === 'ArrowLeft') setDesignObjects(prev => prev.map(o => group.includes(o.id) ? { ...o, x: o.x - step } : o));
        if (e.key === 'ArrowRight') setDesignObjects(prev => prev.map(o => group.includes(o.id) ? { ...o, x: o.x + step } : o));
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) saveToHistory(designObjects);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedObjectId, selectedObject, copyObject, pasteObject, undo, redo, deleteObject, designObjects, getConnectedGroup, saveToHistory]);

  return (
    <div className="w-full mx-auto p-0 bg-slate-100 min-h-screen flex flex-col overflow-hidden font-body text-slate-900">
      {/* Header */}
      <div className="h-10 bg-slate-800 border-b flex items-center px-4 justify-between shrink-0 text-white">
        <div className="flex items-center gap-6 h-full">
          <div className="flex items-center gap-2 pr-4 border-r border-slate-700">
            <Building className="w-5 h-5 text-blue-400" />
            <span className="font-bold text-xs tracking-tighter uppercase">Architectural Pro Studio</span>
          </div>
          <nav className="flex gap-0 h-full">
            {['File', 'Home', 'Design', 'Table'].map(item => (
              <Button key={item} variant="ghost" onClick={() => setActiveRibbonTab(item.toLowerCase())}
                className={cn("h-10 px-6 text-[11px] font-bold transition-all rounded-none border-b-2",
                  activeRibbonTab === item.toLowerCase() ? "bg-slate-700 text-white border-blue-400" : "text-slate-400 hover:bg-slate-700 border-transparent")}>{item}</Button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-slate-400">Move Step: 0.05"</span>
          <User className="w-5 h-5 text-slate-400 cursor-pointer hover:text-white" />
        </div>
      </div>

      {/* Ribbon */}
      <div className="h-24 bg-white border-b flex items-center px-4 gap-0 shrink-0 shadow-sm z-30">
        {activeRibbonTab === 'home' && (
          <>
            <div className="flex items-center border-r px-3 h-full gap-1">
              <RibbonButton icon={<Undo2 />} label="Undo" onClick={undo} />
              <RibbonButton icon={<Redo2 />} label="Redo" onClick={redo} />
            </div>
            <div className="flex items-center border-r px-3 h-full gap-1">
              <RibbonButton icon={<CopyIcon />} label="Copy" onClick={copyObject} />
              <RibbonButton icon={<ClipboardIcon />} label="Paste" onClick={pasteObject} />
            </div>
            <div className="flex items-center border-r px-3 h-full gap-2">
              <Select value={selectedObject?.fontSize?.toString() || "14"} onValueChange={(v) => selectedObjectId && updateObject(selectedObjectId, { fontSize: parseInt(v) }, true)}>
                <SelectTrigger className="h-8 w-24 text-[11px]"><SelectValue placeholder="Size" /></SelectTrigger>
                <SelectContent>{FONT_SIZES.map(s => <SelectItem key={s} value={s.toString()}>{s}pt</SelectItem>)}</SelectContent>
              </Select>
              <div className="flex gap-1">
                 <Button variant={selectedObject?.isBold ? "secondary" : "ghost"} size="icon" className="h-8 w-8 border" onClick={() => selectedObjectId && updateObject(selectedObjectId, { isBold: !selectedObject?.isBold }, true)}><Bold className="w-4 h-4" /></Button>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 border p-0"><PaintBucket className="w-4 h-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent className="p-2 grid grid-cols-5 gap-1">
                      {COLORS.map(c => <div key={c} onClick={() => selectedObjectId && updateObject(selectedObjectId, { color: c, fillColor: c }, true)} className="w-6 h-6 rounded border cursor-pointer hover:scale-110" style={{ backgroundColor: c }} />)}
                    </DropdownMenuContent>
                 </DropdownMenu>
              </div>
            </div>
            <RibbonButton icon={<Trash2 />} label="Delete" variant="destructive" onClick={() => deleteObject(selectedObjectId)} />
          </>
        )}
        {activeRibbonTab === 'design' && (
          <div className="flex items-center h-full px-2 gap-4">
            <RibbonButton icon={<Pencil />} label="Add Wall" active={selectedTool === 'wall'} onClick={() => setSelectedTool('wall')} />
            <RibbonButton icon={<PillarIcon />} label="Add Pillar" active={selectedTool === 'pillar'} onClick={() => setSelectedTool('pillar')} />
            <RibbonButton icon={<TypeIcon />} label="Label" active={selectedTool === 'text'} onClick={() => setSelectedTool('text')} />
            <div className="h-full flex flex-col justify-center px-4 border-l gap-1">
               <Label className="text-[9px] font-bold text-slate-400 uppercase">Default Wall Thickness</Label>
               <Select value={currentWallThickness.toString()} onValueChange={(v) => setCurrentWallThickness(parseFloat(v))}>
                  <SelectTrigger className="h-7 w-32 text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.25">3 inches</SelectItem>
                    <SelectItem value="0.33">4 inches</SelectItem>
                    <SelectItem value="0.42">5 inches</SelectItem>
                    <SelectItem value="0.83">10 inches</SelectItem>
                  </SelectContent>
               </Select>
            </div>
            <RibbonButton icon={<MousePointer2 />} label="Select" active={selectedTool === 'select'} onClick={() => setSelectedTool('select')} />
          </div>
        )}
        {activeRibbonTab === 'table' && (
           <div className="flex items-center h-full px-4 gap-4">
              <RibbonButton icon={<LayoutGrid />} label="Insert Table" onClick={() => addObject('table', 'table', 'Table', { rows: 4, cols: 3, w: 6, h: 4 })} />
           </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Toolbox */}
        <div className="w-[280px] bg-white border-r z-20 shrink-0 flex flex-col shadow-lg">
          <div className="p-3 border-b bg-slate-50 flex items-center justify-between"><span className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">Toolbox</span><Settings className="w-4 h-4 text-slate-400" /></div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <ToolCard icon={<MousePointer2 />} label="Select" active={selectedTool === 'select'} onClick={() => setSelectedTool('select')} />
                <ToolCard icon={<Pencil />} label="Wall" active={selectedTool === 'wall'} onClick={() => setSelectedTool('wall')} />
                <ToolCard icon={<PillarIcon />} label="Column" active={selectedTool === 'pillar'} onClick={() => setSelectedTool('pillar')} />
                <ToolCard icon={<TypeIcon />} label="Label" active={selectedTool === 'text'} onClick={() => setSelectedTool('text')} />
              </div>
              <Accordion type="multiple" defaultValue={["openings"]} className="w-full">
                <AccordionItem value="openings" className="border-none">
                  <AccordionTrigger className="h-10 px-0 text-[10px] font-bold text-slate-400 uppercase">Openings</AccordionTrigger>
                  <AccordionContent className="grid grid-cols-2 gap-3">
                    <SymbolButton icon={<DoorOpen />} label="Door" onClick={() => addObject('opening', 'door', 'Door')} />
                    <SymbolButton icon={<Wind />} label="Window" onClick={() => addObject('opening', 'window', 'Window')} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </ScrollArea>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 relative flex flex-col overflow-hidden bg-slate-200">
          <div id="canvas-workspace" className="flex-1 relative bg-white overflow-auto cursor-crosshair m-6 shadow-2xl rounded border"
            onMouseDown={(e) => handleMouseDown(e, null)} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
            <div className="absolute inset-0" style={{ 
                backgroundImage: `linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)`,
                backgroundSize: `${zoom}px ${zoom}px`, width: 4000, height: 4000
              }}>
              
              {/* Distance Indicators between Pillars */}
              {pillarDistances.map((d, i) => (
                <div key={`dist-${i}`} className="absolute pointer-events-none z-0" style={{
                  left: Math.min(d.x1, d.x2) * zoom,
                  top: Math.min(d.y1, d.y2) * zoom,
                  width: d.horizontal ? Math.abs(d.x2 - d.x1) * zoom : 2,
                  height: d.horizontal ? 2 : Math.abs(d.y2 - d.y1) * zoom,
                  backgroundColor: 'rgba(59, 130, 246, 0.3)',
                }}>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 py-1 border border-blue-200 rounded text-[11px] font-bold text-blue-600 shadow-sm whitespace-nowrap">
                    {d.dist}
                  </div>
                </div>
              ))}

              {designObjects.map(obj => (
                <div key={obj.id} onMouseDown={(e) => handleMouseDown(e, obj.id)}
                  className={cn("absolute flex items-center justify-center transition-shadow", 
                    selectedObjectId === obj.id ? "z-30 ring-2 ring-blue-500 shadow-2xl" : "z-10")}
                  style={{ 
                    left: obj.x * zoom, top: obj.y * zoom, width: obj.w * zoom, height: obj.h * zoom, 
                    transformOrigin: '0 0', transform: `rotate(${obj.rotation}deg)`,
                    backgroundColor: obj.subType === 'door' ? 'white' : (obj.type === 'pillar' ? obj.fillColor : (obj.subType === 'wall' ? obj.color : 'transparent')),
                    border: (obj.subType === 'wall' || obj.subType === 'door') ? 'none' : `2px solid ${obj.color}`,
                    borderRadius: obj.subType === 'oval' ? '100%' : '0px'
                  }}>
                  
                  {/* Dimension Labels - Not for Pillars */}
                  {obj.type !== 'pillar' && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/90 px-1 py-0.5 rounded border border-slate-200 shadow-sm pointer-events-none z-50">
                      <span className="text-[10px] font-bold text-slate-800 whitespace-nowrap">
                        {obj.subType === 'wall' ? formatFeetInches(obj.w) : 
                         (obj.type === 'opening' ? formatFeetInches(obj.w) : '')}
                      </span>
                    </div>
                  )}

                  {obj.subType === 'door' && (
                    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <line x1="0" y1="100" x2="0" y2="0" stroke={obj.color} strokeWidth="6" />
                      <path d="M 0 0 A 100 100 0 0 1 100 100" fill="none" stroke={obj.color} strokeWidth="3" strokeDasharray="4 2" />
                    </svg>
                  )}
                  {obj.subType === 'window' && (
                    <div className="absolute inset-0 border-x-4 flex flex-col justify-between py-1 bg-white" style={{ borderColor: obj.color }}>
                      <div className="w-full h-[1px] bg-slate-300" />
                      <div className="w-full h-[1px] bg-slate-400" />
                      <div className="w-full h-[1px] bg-slate-300" />
                    </div>
                  )}
                  {obj.type === 'pillar' && <div className="w-full h-full opacity-30 bg-slate-900/10" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.1) 5px, rgba(0,0,0,0.1) 10px)' }} />}
                  {obj.type === 'text' && (
                    <span className={cn("text-center px-1 whitespace-nowrap", obj.isBold && "font-bold")} style={{ color: obj.color, fontSize: obj.fontSize }}>{obj.textContent || obj.label}</span>
                  )}
                  {selectedObjectId === obj.id && (
                    <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 rounded-full cursor-se-resize z-40 border-2 border-white shadow-lg" 
                      onMouseDown={(e) => handleMouseDown(e, obj.id, 'resizing')} />
                  )}
                </div>
              ))}
              {interactionMode === 'drawing' && drawStart && tempDrawEnd && (
                <div className="absolute bg-blue-500/20 pointer-events-none z-50 border-2 border-blue-500 border-dashed"
                  style={{
                    left: drawStart.x * zoom, top: drawStart.y * zoom,
                    width: Math.sqrt(Math.pow(tempDrawEnd.x - drawStart.x, 2) + Math.pow(tempDrawEnd.y - drawStart.y, 2)) * zoom,
                    height: currentWallThickness * zoom,
                    transformOrigin: '0 0', transform: `rotate(${Math.atan2(tempDrawEnd.y - drawStart.y, tempDrawEnd.x - drawStart.x) * (180 / Math.PI)}deg)`,
                  }}
                />
              )}
              {snapPoint && (
                <div className="absolute w-16 h-16 bg-blue-500/30 rounded-full border-4 border-blue-600 z-50 pointer-events-none shadow-[0_0_40px_rgba(37,99,235,0.9)] animate-pulse"
                  style={{ left: snapPoint.x * zoom - 32, top: snapPoint.y * zoom - 32 }} />
              )}
            </div>
          </div>
          <div className="h-10 bg-white border-t flex items-center px-4 justify-between shrink-0 shadow-inner">
             <div className="flex items-center gap-4">
                <div className="flex items-center gap-2"><ZoomOut className="w-4 h-4 text-slate-400" /><Slider value={[zoom]} max={150} min={10} step={5} className="w-40" onValueChange={(val) => setZoom(val[0])} /><ZoomIn className="w-4 h-4 text-slate-400" /></div>
                <span className="text-[10px] font-bold text-slate-500">{zoom}% Precision</span>
             </div>
             <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span>Arrow Keys: 0.05" Step</span>
                <span>Ctrl+C/V: Copy-Paste</span>
                <span>Ctrl+Z/Y: Undo-Redo</span>
             </div>
          </div>
        </div>

        {/* Inspector Panel */}
        <div className="w-[300px] bg-white border-l z-20 shrink-0 flex flex-col shadow-xl">
           <div className="p-3 border-b bg-slate-50 flex items-center justify-between"><span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Element Inspector</span><Settings2 className="w-4 h-4 text-slate-400" /></div>
           <ScrollArea className="flex-1 p-4">
              {selectedObject ? (
                 <div className="space-y-6">
                    {/* Connection Toggler */}
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                       <div className="flex items-center justify-between">
                          <Label className="text-[11px] font-bold text-slate-700 uppercase flex items-center gap-2">
                             {selectedObject.isJoined ? <Link2 className="w-3.5 h-3.5 text-blue-600" /> : <Unlink className="w-3.5 h-3.5 text-slate-400" />}
                             সংযুক্ত করুন (Connect)
                          </Label>
                          <Switch 
                            checked={selectedObject.isJoined} 
                            onCheckedChange={(val) => updateObject(selectedObjectId!, { isJoined: val }, true)}
                          />
                       </div>
                       <p className="text-[10px] text-slate-500 leading-tight">
                         টিক দেওয়া থাকলে কাছাকাছি থাকা অন্য অবজেক্টের সাথে এটি গ্রুপ হিসেবে মুভ করবে।
                       </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <PropInput label="X Pos" value={localPropX} onChange={setLocalPropX} onBlur={() => updateObject(selectedObjectId!, { x: parseFeetInches(localPropX) }, true)} />
                       <PropInput label="Y Pos" value={localPropY} onChange={setLocalPropY} onBlur={() => updateObject(selectedObjectId!, { y: parseFeetInches(localPropY) }, true)} />
                       <PropInput label="Width (W)" value={localPropW} onChange={setLocalPropW} onBlur={() => updateObject(selectedObjectId!, { w: parseFeetInches(localPropW) }, true)} />
                       <PropInput label="Height (H)" value={localPropH} onChange={setLocalPropH} onBlur={() => updateObject(selectedObjectId!, { h: parseFeetInches(localPropH) }, true)} />
                    </div>

                    <div className="space-y-2">
                       <Label className="text-[9px] font-bold text-slate-400 uppercase">Rotation (°)</Label>
                       <div className="flex items-center gap-3">
                          <Slider value={[selectedObject.rotation]} max={360} min={0} step={1} className="flex-1" onValueChange={(v) => updateObject(selectedObjectId!, { rotation: v[0] }, true)} />
                          <Input type="number" className="h-8 w-16 text-xs" value={selectedObject.rotation} onChange={(e) => updateObject(selectedObjectId!, { rotation: parseInt(e.target.value) || 0 }, true)} />
                       </div>
                    </div>

                    {(selectedObject.subType === 'wall' || selectedObject.subType === 'door') && (
                       <div className="space-y-2">
                          <Label className="text-[9px] font-bold text-slate-400 uppercase">Thickness / H</Label>
                          <Select value={selectedObject.h.toString()} onValueChange={(v) => updateObject(selectedObjectId!, { h: parseFloat(v) }, true)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0.25">3 inches</SelectItem>
                              <SelectItem value="0.33">4 inches</SelectItem>
                              <SelectItem value="0.42">5 inches</SelectItem>
                              <SelectItem value="0.83">10 inches</SelectItem>
                            </SelectContent>
                          </Select>
                       </div>
                    )}

                    {selectedObject.type === 'text' && (
                       <div className="space-y-2">
                          <Label className="text-[9px] font-bold text-slate-400 uppercase">Label Text</Label>
                          <Input value={selectedObject.textContent || ""} onChange={(e) => updateObject(selectedObjectId!, { textContent: e.target.value }, true)} />
                       </div>
                    )}
                 </div>
              ) : (
                 <div className="h-64 flex flex-col items-center justify-center text-center opacity-20">
                    <MousePointer2 className="w-10 h-10 mb-4" />
                    <p className="text-xs font-bold uppercase tracking-widest">Select element to inspect</p>
                 </div>
              )}
           </ScrollArea>
        </div>
      </div>
    </div>
  );
}

function PropInput({ label, value, onChange, onBlur }: { label: string, value: string, onChange: (v: string) => void, onBlur: () => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[9px] font-bold text-slate-400 uppercase">{label}</Label>
      <Input 
        className="h-8 text-xs bg-slate-50 focus:bg-white" 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        onBlur={onBlur} 
        placeholder="0' 0&quot;" 
      />
    </div>
  );
}

function ToolCard({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <div onClick={onClick} className={cn("flex flex-col items-center justify-center p-3 rounded-lg cursor-pointer transition-all border shadow-sm",
      active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50")}>
       {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5 mb-2" })}
       <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
    </div>
  );
}

function SymbolButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) {
  return (
    <Button variant="outline" onClick={onClick} className="w-full flex flex-col items-center justify-center gap-2 h-20 p-4 bg-white hover:bg-slate-50 group shadow-sm">
       {React.cloneElement(icon as React.ReactElement, { className: "w-6 h-6 text-slate-400 group-hover:text-blue-500" })}
       <span className="text-[10px] font-bold text-slate-500 uppercase">{label}</span>
    </Button>
  );
}

function RibbonButton({ icon, label, onClick, disabled, active, variant = "ghost" }: { icon: React.ReactNode, label: string, onClick?: () => void, disabled?: boolean, active?: boolean, variant?: any }) {
  return (
    <Button variant={variant} disabled={disabled} onClick={onClick} className={cn("h-20 flex flex-col gap-2 px-6 min-w-[90px] rounded-none group", active ? "bg-slate-100" : "hover:bg-slate-50")}>
      {React.cloneElement(icon as React.ReactElement, { className: cn("w-5 h-5", variant === 'destructive' ? 'text-red-500' : (active ? 'text-blue-600' : 'text-slate-600 group-hover:text-blue-500')) })}
      <span className={cn("text-[10px] uppercase font-bold", variant === 'destructive' ? 'text-red-600' : (active ? 'text-blue-600' : 'text-slate-500'))}>{label}</span>
    </Button>
  );
}
