
"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { 
  Building, Plus, DoorClosed, Square, LayoutGrid, 
  RectangleHorizontal, RefreshCw, Trash2, X, MousePointer2,
  Download, Clipboard, Copy, Scissors, Undo2, Redo2,
  Settings2, Move, Pencil, ZoomIn, ZoomOut, Maximize2,
  ChevronDown, Type, PaintBucket, Layers, FlipHorizontal, FlipVertical,
  BringToFront, SendToBack, Eraser, GripHorizontal, FileText, Menu as MenuIcon,
  Paintbrush, Star, AlignLeft, Group, RotateCw, Folder, FilePlus, FolderOpen, Save, Printer, Settings, User,
  Table as TableIcon, Columns, Rows, ArrowLeftToLine, ArrowRightToLine, ArrowUpToLine, ArrowDownToLine, 
  Merge, Split, Grid, CheckSquare, Briefcase, Database, Sparkles, Search, PenLine, Box, Type as TextIcon,
  Ruler, RotateCcw, Info, Circle, Triangle, Diamond, ArrowRight, Hexagon, Octagon
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { Checkbox } from "@/components/ui/checkbox";

type DesignObject = {
  id: string;
  type: 'structure' | 'opening' | 'shape';
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
  wallThickness?: number;
};

const COLORS = [
  '#000000', '#ffffff', '#ef4444', '#f97316', '#facc15', '#22c55e', 
  '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#64748b'
];

const LINE_STYLES = [
  { label: 'Solid', value: 'solid' },
  { label: 'Dashed', value: 'dashed' },
  { label: 'Dotted', value: 'dotted' }
];

export default function EstimatorClient() {
  const { toast } = useToast();
  const [designObjects, setDesignObjects] = useState<DesignObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<DesignObject | null>(null);
  const [interactionMode, setInteractionMode] = useState<'none' | 'dragging' | 'resizing' | 'rotating' | 'drawing'>('none');
  const [selectedTool, setSelectedTool] = useState<'select' | 'shape' | 'line' | 'text'>('select');
  const [drawStart, setDrawStart] = useState<{x: number, y: number} | null>(null);
  const [tempDrawEnd, setTempDrawEnd] = useState<{x: number, y: number} | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(30);
  const [snapPoint, setSnapPoint] = useState<{x: number, y: number} | null>(null);
  const [connectedGroup, setConnectedGroup] = useState<string[]>([]);
  const [activeRibbonTab, setActiveRibbonTab] = useState('home');
  const [currentWallThickness, setCurrentWallThickness] = useState(0.33); 
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);

  // History for Undo/Redo
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
    if (obj.subType !== 'wall') {
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

  const addObject = (type: DesignObject['type'], subType: string, label: string) => {
    if (subType === 'wall') {
      setInteractionMode('drawing');
      setSelectedTool('line');
      toast({ title: "Drawing Mode", description: "মাউস দিয়ে টেনে দেয়াল আঁকুন।" });
      return;
    }
    const newObj: DesignObject = {
      id: Math.random().toString(36).substr(2, 9),
      type, subType, x: 10, y: 10, 
      w: subType === 'table' ? tableCols * 2 : 10, 
      h: subType === 'table' ? tableRows * 1.5 : 8,
      label, color: '#000000', fillColor: '#ffffff',
      strokeWidth: 2, strokeStyle: 'solid',
      rotation: 0,
      rows: subType === 'table' ? tableRows : undefined,
      cols: subType === 'table' ? tableCols : undefined
    };
    const next = [...designObjects, newObj];
    setDesignObjects(next);
    setSelectedObjectId(newObj.id);
    saveToHistory(next);
    toast({ title: "Object Added", description: `${label} ক্যানভাসে যোগ করা হয়েছে।` });
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
      toast({ title: "Pasted", description: "Object pasted." });
    }
  };

  const bringToFront = () => {
    if (!selectedObjectId) return;
    const item = designObjects.find(o => o.id === selectedObjectId);
    if (!item) return;
    const filtered = designObjects.filter(o => o.id !== selectedObjectId);
    const next = [...filtered, item];
    setDesignObjects(next);
    saveToHistory(next);
  };

  const sendToBack = () => {
    if (!selectedObjectId) return;
    const item = designObjects.find(o => o.id === selectedObjectId);
    if (!item) return;
    const filtered = designObjects.filter(o => o.id !== selectedObjectId);
    const next = [item, ...filtered];
    setDesignObjects(next);
    saveToHistory(next);
  };

  const flipH = () => {
    if (selectedObjectId) updateObject(selectedObjectId, { flipH: !selectedObject?.flipH }, true);
  };

  const flipV = () => {
    if (selectedObjectId) updateObject(selectedObjectId, { flipV: !selectedObject?.flipV }, true);
  };

  const handleNewFile = () => {
    setDesignObjects([]);
    setHistory([[]]);
    setHistoryIndex(0);
    setSelectedObjectId(null);
    toast({ title: "New Design", description: "Canvas cleared." });
  };

  return (
    <div className="w-full max-w-full mx-auto p-0 bg-slate-100 min-h-screen flex flex-col overflow-hidden font-body">
      {/* Top Header */}
      <div className="h-10 bg-[#f1f3f4] border-b flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-sm text-slate-700">smartdraw</span>
          </div>
          <nav className="flex gap-4">
            {[
              { id: 'file', label: 'File' },
              { id: 'home', label: 'Home' },
              { id: 'design', label: 'Design' },
              { id: 'table', label: 'Table' },
              { id: 'support', label: 'Support' }
            ].map(item => (
              <Button 
                key={item.id} 
                variant="ghost" 
                onClick={() => setActiveRibbonTab(item.id)}
                className={cn(
                  "h-8 px-2 text-[11px] font-medium transition-colors hover:bg-slate-200",
                  activeRibbonTab === item.id ? "bg-white text-blue-600 shadow-sm font-bold" : "text-slate-600"
                )}
              >
                {item.label}
              </Button>
            ))}
          </nav>
        </div>
        <Button className="bg-orange-400 hover:bg-orange-500 h-7 text-[11px] px-4 font-bold text-white rounded">Buy</Button>
      </div>

      {/* Ribbon Bar */}
      <div className="h-20 bg-white border-b flex items-center px-4 gap-0 shrink-0 shadow-sm z-30 overflow-x-auto no-scrollbar">
        {activeRibbonTab === 'file' && (
          <div className="flex items-center">
            <RibbonButton icon={<Folder />} label="Documents" />
            <RibbonButton icon={<FilePlus />} label="New" onClick={handleNewFile} />
            <RibbonButton icon={<FolderOpen />} label="Open" />
            <RibbonButton icon={<Save />} label="Save a Copy" />
            <RibbonButton icon={<Printer />} label="Print" onClick={() => window.print()} />
            <RibbonButton icon={<Settings />} label="Options" />
            <div className="w-px h-12 bg-slate-200 mx-2" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-16 flex flex-col gap-1 px-3">
                  <User className="w-5 h-5 text-slate-600"/>
                  <div className="flex items-center gap-0.5">
                    <span className="text-[9px] uppercase font-bold text-slate-500">Account</span>
                    <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>Profile Settings</DropdownMenuItem>
                <DropdownMenuItem>Sign Out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {activeRibbonTab === 'home' && (
          <>
            <div className="flex flex-col items-center border-r px-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-16 flex flex-col gap-1 px-3">
                    <Download className="w-5 h-5 text-slate-600"/>
                    <span className="text-[9px] uppercase font-bold text-slate-500">Export</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>Export as PDF</DropdownMenuItem>
                  <DropdownMenuItem>Export as PNG</DropdownMenuItem>
                  <DropdownMenuItem>Export as SVG</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center border-r px-2">
              <RibbonButton icon={<Clipboard />} label="Paste" onClick={pasteObject} disabled={!clipboard} />
              <div className="flex flex-col">
                <RibbonIconButton icon={<Copy />} label="Copy" onClick={copyObject} />
                <RibbonIconButton icon={<Scissors />} label="Cut" onClick={() => { copyObject(); deleteObject(selectedObjectId); }} />
                <RibbonIconButton icon={<Paintbrush />} label="Format Painter" />
              </div>
            </div>

            <div className="flex flex-col items-center border-r px-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-16 flex flex-col gap-1 px-3">
                    <Plus className="w-5 h-5 text-slate-600"/>
                    <span className="text-[9px] uppercase font-bold text-slate-500">Insert</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => { setCurrentWallThickness(0.33); setInteractionMode('drawing'); setSelectedTool('line'); }}>Insert Wall</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addObject('shape', 'room', 'রুম')}>Square Room</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addObject('opening', 'door', 'দরজা')}>Door</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
                      <div key={c} onClick={() => selectedObjectId && updateObject(selectedObjectId, { fillColor: c }, true)} className="w-6 h-6 rounded border cursor-pointer" style={{ backgroundColor: c }} />
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
                     <span className="text-[10px] font-bold text-slate-400 uppercase">Style</span>
                    <div className="flex gap-2">
                      {LINE_STYLES.map(s => (
                        <Button key={s.value} variant="outline" className="h-7 text-[10px] flex-1" onClick={() => selectedObjectId && updateObject(selectedObjectId, { strokeStyle: s.value as any }, true)}>{s.label}</Button>
                      ))}
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Color</span>
                    <div className="grid grid-cols-5 gap-1">
                      {COLORS.map(c => (
                        <div key={c} onClick={() => selectedObjectId && updateObject(selectedObjectId, { color: c }, true)} className="w-5 h-5 rounded border cursor-pointer" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center border-r px-2 gap-2">
               <div className="flex flex-col gap-0.5">
                  <RibbonIconButton icon={<BringToFront />} label="Front" onClick={bringToFront} />
                  <RibbonIconButton icon={<SendToBack />} label="Back" onClick={sendToBack} />
               </div>
               <div className="flex flex-col gap-0.5">
                  <RibbonIconButton icon={<FlipHorizontal />} label="Flip H" onClick={flipH} />
                  <RibbonIconButton icon={<FlipVertical />} label="Flip V" onClick={flipV} />
               </div>
            </div>
            
            <RibbonButton icon={<Trash2 />} label="Delete" variant="destructive" onClick={() => deleteObject(selectedObjectId)} />
          </>
        )}

        {activeRibbonTab === 'table' && (
          <div className="flex items-center gap-4">
             <div className="flex flex-col border-r pr-4 gap-1">
                <div className="flex items-center gap-2">
                   <span className="text-[10px] font-bold text-slate-500">Rows:</span>
                   <Input type="number" value={tableRows} onChange={(e) => setTableRows(parseInt(e.target.value))} className="h-6 w-12 text-xs" />
                </div>
                <div className="flex items-center gap-2">
                   <span className="text-[10px] font-bold text-slate-500">Cols:</span>
                   <Input type="number" value={tableCols} onChange={(e) => setTableCols(parseInt(e.target.value))} className="h-6 w-12 text-xs" />
                </div>
             </div>
             <RibbonButton icon={<Grid />} label="Insert Table" onClick={() => addObject('shape', 'table', 'Table')} />
             <div className="flex flex-col border-x px-2">
                <RibbonIconButton icon={<ArrowUpToLine />} label="Above" />
                <RibbonIconButton icon={<ArrowDownToLine />} label="Below" />
             </div>
             <div className="flex flex-col border-r pr-2">
                <RibbonIconButton icon={<ArrowLeftToLine />} label="Left" />
                <RibbonIconButton icon={<ArrowRightToLine />} label="Right" />
             </div>
             <div className="flex flex-col border-r pr-2">
                <RibbonIconButton icon={<Merge />} label="Join" />
                <RibbonIconButton icon={<Split />} label="Split" />
             </div>
             <RibbonButton icon={<Trash2 />} label="Remove" onClick={() => deleteObject(selectedObjectId)} />
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden bg-slate-50">
        {/* Left Library Sidebar */}
        <div className="flex w-[320px] bg-white border-r z-20 shrink-0 shadow-sm">
          {/* Left Rail */}
          <div className="w-12 border-r bg-slate-50 flex flex-col items-center py-4 gap-6 shrink-0">
             <Briefcase className="w-5 h-5 text-slate-400 cursor-pointer hover:text-blue-500 transition-colors" />
             <Database className="w-5 h-5 text-slate-400 cursor-pointer hover:text-blue-500 transition-colors" />
             <Sparkles className="w-5 h-5 text-slate-400 cursor-pointer hover:text-blue-500 transition-colors" />
             <div className="mt-auto mb-4">
                <Info className="w-5 h-5 text-slate-300" />
             </div>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-3 border-b flex items-center justify-between bg-slate-50/50">
               <div className="flex items-center gap-1 cursor-pointer group">
                  <span className="text-sm font-bold text-slate-700">Tools</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-600" />
               </div>
               <div className="flex items-center gap-1">
                  <MenuIcon className="w-4 h-4 text-slate-400" />
               </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-3 space-y-6">
                {/* Tool Selection Bar */}
                <div className="grid grid-cols-4 gap-1">
                  <ToolCard icon={<MousePointer2 />} label="Select" active={selectedTool === 'select'} onClick={() => { setSelectedTool('select'); setInteractionMode('none'); }} />
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <div>
                        <ToolCard icon={<Box />} label="Shape" active={selectedTool === 'shape'} onClick={() => setSelectedTool('shape')} />
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64 p-3">
                      <div className="grid grid-cols-4 gap-4">
                        <ShapeIcon icon={<Square className="w-6 h-6" />} onClick={() => addObject('shape', 'rect', 'Rectangle')} />
                        <ShapeIcon icon={<Circle className="w-6 h-6" />} onClick={() => addObject('shape', 'oval', 'Oval')} />
                        <ShapeIcon icon={<div className="w-6 h-6 border-2 border-slate-600 skew-x-12" />} onClick={() => addObject('shape', 'para', 'Parallelogram')} />
                        <ShapeIcon icon={<Diamond className="w-6 h-6" />} onClick={() => addObject('shape', 'diamond', 'Diamond')} />
                        
                        <ShapeIcon icon={<div className="w-6 h-6 border-2 border-slate-600 rounded-r-full" />} onClick={() => addObject('shape', 'arc', 'Arc Shape')} />
                        <ShapeIcon icon={<div className="w-6 h-6 border-2 border-slate-600 rounded-full" />} onClick={() => addObject('shape', 'circle', 'Circle')} />
                        <ShapeIcon icon={<div className="w-6 h-6 border-2 border-slate-600 [clip-path:polygon(20%_0%,80%_0%,100%_100%,0%_100%)]" />} onClick={() => addObject('shape', 'trap', 'Trapezoid')} />
                        <ShapeIcon icon={<Triangle className="w-6 h-6" />} onClick={() => addObject('shape', 'tri', 'Triangle')} />
                        
                        <ShapeIcon icon={<div className="w-6 h-6 border-2 border-slate-600 rounded-full h-4" />} onClick={() => addObject('shape', 'capsule', 'Capsule')} />
                        <ShapeIcon icon={<ArrowRight className="w-6 h-6" />} onClick={() => addObject('shape', 'arrow', 'Arrow')} />
                        <ShapeIcon icon={<Hexagon className="w-6 h-6" />} onClick={() => addObject('shape', 'hex', 'Hexagon')} />
                        <ShapeIcon icon={<Octagon className="w-6 h-6" />} onClick={() => addObject('shape', 'oct', 'Octagon')} />
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <ToolCard icon={<PenLine />} label="Line" active={selectedTool === 'line'} onClick={() => setSelectedTool('line')} />
                  <ToolCard icon={<TextIcon />} label="Text" active={selectedTool === 'text'} onClick={() => setSelectedTool('text')} />
                </div>

                {/* Add Wall Section */}
                <div className="space-y-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="w-full justify-start gap-2 h-9 text-slate-700 hover:bg-slate-100 font-medium">
                        <Pencil className="w-4 h-4" />
                        <span className="text-xs">Add Wall</span>
                        <ChevronDown className="ml-auto w-3.5 h-3.5 text-slate-400" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56">
                      <DropdownMenuItem onClick={() => { setCurrentWallThickness(0.33); setInteractionMode('drawing'); setSelectedTool('line'); }}>Interior Wall 4"</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setCurrentWallThickness(0.5); setInteractionMode('drawing'); setSelectedTool('line'); }}>Exterior Wall 6"</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setCurrentWallThickness(0.66); setInteractionMode('drawing'); setSelectedTool('line'); }}>Exterior Wall 8"</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setCurrentWallThickness(1.0); setInteractionMode('drawing'); setSelectedTool('line'); }}>Exterior Wall 12"</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button variant="ghost" className="w-full justify-start gap-2 h-9 text-slate-700 hover:bg-slate-100 font-medium">
                    <Plus className="w-4 h-4" />
                    <span className="text-xs">Add Wall Opening</span>
                  </Button>
                </div>

                {/* Categorized Tools */}
                <Accordion type="multiple" defaultValue={["setup", "room"]} className="w-full">
                  <AccordionItem value="setup" className="border-none">
                    <AccordionTrigger className="h-9 px-0 hover:no-underline text-xs font-bold text-slate-600 uppercase tracking-tighter">Document Setup</AccordionTrigger>
                    <AccordionContent className="space-y-1">
                       <LibraryButton icon={<Ruler className="w-4 h-4" />} label="Units & Scale" />
                       <LibraryButton icon={<Layers className="w-4 h-4" />} label="Scale Image with Ruler" disabled />
                       <LibraryButton icon={<LayoutGrid className="w-4 h-4" />} label="Add Annotation Layer" />
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="adjust" className="border-none">
                    <AccordionTrigger className="h-9 px-0 hover:no-underline text-xs font-bold text-slate-600 uppercase tracking-tighter">Adjust Wall</AccordionTrigger>
                    <AccordionContent className="pb-2 text-[11px] text-slate-500">Edit wall connections and corners.</AccordionContent>
                  </AccordionItem>
                </Accordion>

                {/* Symbols Header */}
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                     <span className="text-sm font-bold text-slate-700">Symbols</span>
                     <div className="flex items-center gap-1 text-blue-600 cursor-pointer">
                        <span className="text-[10px] font-bold">More</span>
                        <Plus className="w-2.5 h-2.5" />
                     </div>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                    <Input placeholder="Search for symbols..." className="pl-8 h-9 text-xs bg-slate-50 border-none" />
                  </div>

                  <Accordion type="multiple" defaultValue={["room"]} className="w-full">
                    <AccordionItem value="room" className="border-none">
                      <AccordionTrigger className="h-9 px-0 hover:no-underline text-xs font-bold text-slate-600 uppercase tracking-tighter">Room Outlines</AccordionTrigger>
                      <AccordionContent className="grid grid-cols-2 gap-2">
                         <div onClick={() => addObject('shape', 'room', 'রুম')} className="h-16 border rounded bg-white flex items-center justify-center cursor-pointer hover:border-blue-400 shadow-sm transition-all"><Square className="w-6 h-6 text-slate-300" /></div>
                         <div onClick={() => addObject('shape', 'room', 'L-Room')} className="h-16 border rounded bg-white flex items-center justify-center cursor-pointer hover:border-blue-400 shadow-sm transition-all"><LayoutGrid className="w-6 h-6 text-slate-300" /></div>
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="doors" className="border-none">
                      <AccordionTrigger className="h-9 px-0 hover:no-underline text-xs font-bold text-slate-600 uppercase tracking-tighter">Doors & Windows</AccordionTrigger>
                      <AccordionContent className="pb-2">
                         <div onClick={() => addObject('opening', 'door', 'Door')} className="h-16 w-full border rounded bg-white flex items-center justify-center cursor-pointer hover:border-blue-400 shadow-sm"><DoorClosed className="w-6 h-6 text-slate-300" /></div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 relative flex flex-col overflow-hidden">
          <div 
            id="canvas-workspace"
            className="flex-1 relative bg-white overflow-auto cursor-crosshair no-scrollbar"
            onMouseDown={(e) => handleMouseDown(e, null)}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            <div className="absolute inset-0" style={{ 
                backgroundImage: `linear-gradient(#f1f3f4 1px, transparent 1px), linear-gradient(90deg, #f1f3f4 1px, transparent 1px)`,
                backgroundSize: `${zoom}px ${zoom}px`, width: 5000, height: 5000, backgroundColor: 'white'
              }}>
              {snapPoint && (
                <div className="absolute w-4 h-4 bg-blue-500 rounded-full z-50 animate-pulse border-2 border-white shadow-md pointer-events-none"
                  style={{ left: snapPoint.x * zoom - 8, top: snapPoint.y * zoom - 8 }} />
              )}

              {interactionMode === 'drawing' && drawStart && tempDrawEnd && (
                <div className="absolute bg-blue-500/10 border-2 border-blue-500 z-40 pointer-events-none"
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
                const isTable = obj.subType === 'table';
                const isSelected = selectedObjectId === obj.id;
                
                return (
                  <div key={obj.id} onMouseDown={(e) => handleMouseDown(e, obj.id)} onClick={(e) => e.stopPropagation()} 
                    className={cn("absolute flex items-center justify-center cursor-move select-none", isSelected ? "z-30" : "z-10")}
                    style={{ 
                      left: obj.x * zoom, 
                      top: obj.y * zoom, 
                      width: obj.w * zoom, 
                      height: obj.h * zoom, 
                      transformOrigin: '0 50%',
                      transform: `rotate(${obj.rotation}deg)`, 
                      backgroundColor: isWall ? obj.color : obj.fillColor,
                      border: isWall ? 'none' : `${obj.strokeWidth}px ${obj.strokeStyle} ${obj.color}`,
                      outline: isSelected ? '2px solid #2563eb' : undefined,
                      outlineOffset: isSelected ? '2px' : undefined,
                      borderRadius: (obj.subType === 'oval' || obj.subType === 'circle' || obj.subType === 'capsule') ? '9999px' : '0px'
                    }}>
                    
                    {isTable && (
                      <div className="absolute inset-0 grid overflow-hidden" style={{ 
                        gridTemplateRows: `repeat(${obj.rows}, 1fr)`,
                        gridTemplateColumns: `repeat(${obj.cols}, 1fr)`
                      }}>
                        {Array.from({ length: (obj.rows || 1) * (obj.cols || 1) }).map((_, i) => (
                          <div key={i} className="border-[0.5px] border-slate-300/30" />
                        ))}
                      </div>
                    )}

                    <div className="absolute -top-7 left-0 right-0 flex justify-center pointer-events-none" style={{ transform: `rotate(${-obj.rotation}deg)` }}>
                      <span className="bg-white/90 px-1 text-[10px] font-bold text-blue-600 rounded shadow-sm border border-blue-100">
                        {formatFeetInches(obj.w)}
                        {!isWall && ` x ${formatFeetInches(obj.h)}`}
                      </span>
                    </div>

                    {isSelected && (
                      <>
                        <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-600 rounded-full cursor-se-resize z-40 border-2 border-white shadow-md hover:scale-125 transition-transform" onMouseDown={(e) => handleMouseDown(e, obj.id, 'resizing')} />
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-5 h-5 bg-white rounded-full cursor-pointer flex items-center justify-center border shadow-md hover:bg-slate-50" onMouseDown={(e) => handleMouseDown(e, obj.id, 'rotating')}>
                           <RotateCw className="w-3 h-3 text-slate-600" />
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mini Status Bar */}
          <div className="h-8 bg-white border-t flex items-center px-4 justify-end gap-4 shrink-0 shadow-sm">
             <div className="flex items-center gap-2">
                <ToolIconButton icon={<ZoomOut />} onClick={() => setZoom(z => Math.max(10, z - 5))} />
                <Slider value={[zoom]} max={150} min={10} step={5} className="w-32" onValueChange={(val) => setZoom(val[0])} />
                <ToolIconButton icon={<ZoomIn />} onClick={() => setZoom(z => Math.min(150, z + 5))} />
                <span className="text-[10px] font-bold text-slate-400 ml-2">{zoom}%</span>
             </div>
          </div>
        </div>

        {/* Right Edit Panel (Permanent) */}
        <div className="w-[280px] bg-white border-l z-20 shrink-0 flex flex-col shadow-sm">
           <div className="p-3 border-b bg-slate-50/50 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700">Properties</span>
              <Settings2 className="w-4 h-4 text-slate-400" />
           </div>
           
           <ScrollArea className="flex-1">
              <div className="p-4 space-y-6">
                 {selectedObject ? (
                    <>
                       <div className="space-y-4">
                          <div className="flex items-center justify-between">
                             <span className="text-[11px] font-bold text-slate-400 uppercase">Position</span>
                             <Ruler className="w-3 h-3 text-slate-300" />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-1">
                                <Label className="text-[10px] text-slate-500 font-bold uppercase">Left</Label>
                                <Input 
                                   className="h-8 text-[11px] font-mono bg-slate-50" 
                                   value={formatFeetInches(selectedObject.x)} 
                                   onChange={(e) => updateObject(selectedObject.id, { x: parseFeetInches(e.target.value) }, true)}
                                   placeholder={"0' 0\""}
                                />
                             </div>
                             <div className="space-y-1">
                                <Label className="text-[10px] text-slate-500 font-bold uppercase">Top</Label>
                                <Input 
                                   className="h-8 text-[11px] font-mono bg-slate-50" 
                                   value={formatFeetInches(selectedObject.y)} 
                                   onChange={(e) => updateObject(selectedObject.id, { y: parseFeetInches(e.target.value) }, true)}
                                   placeholder={"0' 0\""}
                                />
                             </div>
                          </div>
                       </div>

                       <div className="space-y-4 pt-4 border-t">
                          <div className="flex items-center justify-between">
                             <span className="text-[11px] font-bold text-slate-400 uppercase">Dimensions</span>
                             <Maximize2 className="w-3 h-3 text-slate-300" />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-1">
                                <Label className="text-[10px] text-slate-500 font-bold uppercase">Width</Label>
                                <Input 
                                   className="h-8 text-[11px] font-mono bg-slate-50" 
                                   value={formatFeetInches(selectedObject.w)} 
                                   onChange={(e) => updateObject(selectedObject.id, { w: parseFeetInches(e.target.value) }, true)}
                                   placeholder={"0' 0\""}
                                />
                             </div>
                             <div className="space-y-1">
                                <Label className="text-[10px] text-slate-500 font-bold uppercase">Height</Label>
                                <Input 
                                   className="h-8 text-[11px] font-mono bg-slate-50" 
                                   value={formatFeetInches(selectedObject.h)} 
                                   onChange={(e) => updateObject(selectedObject.id, { h: parseFeetInches(e.target.value) }, true)}
                                   placeholder={"0' 0\""}
                                />
                             </div>
                          </div>
                          <div className="space-y-1">
                             <Label className="text-[10px] text-slate-500 font-bold uppercase">Rotation</Label>
                             <div className="flex items-center gap-3">
                                <Slider value={[selectedObject.rotation]} max={360} min={0} step={1} className="flex-1" onValueChange={(val) => updateObject(selectedObject.id, { rotation: val[0] }, true)} />
                                <span className="text-[11px] font-mono w-8">{selectedObject.rotation}°</span>
                             </div>
                          </div>
                       </div>

                       <div className="space-y-4 pt-4 border-t">
                          <span className="text-[11px] font-bold text-slate-400 uppercase">Information</span>
                          <div className="bg-slate-50 p-2 rounded border text-[10px] space-y-2 text-slate-600">
                             <div className="flex justify-between">
                                <span className="font-bold">Type:</span>
                                <span>{selectedObject.subType.toUpperCase()}</span>
                             </div>
                             <div className="flex justify-between">
                                <span className="font-bold">ID:</span>
                                <span className="font-mono">{selectedObject.id}</span>
                             </div>
                             {selectedObject.subType === 'table' && (
                                <>
                                   <div className="flex justify-between">
                                      <span className="font-bold">Rows:</span>
                                      <span>{selectedObject.rows}</span>
                                   </div>
                                   <div className="flex justify-between">
                                      <span className="font-bold">Cols:</span>
                                      <span>{selectedObject.cols}</span>
                                   </div>
                                </>
                             )}
                          </div>
                       </div>
                    </>
                 ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-20">
                       <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center">
                          <MousePointer2 className="w-6 h-6 text-slate-300" />
                       </div>
                       <p className="text-[11px] text-slate-400 font-medium px-6">Select an object to view and edit its properties.</p>
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
      "flex flex-col items-center justify-center p-2 rounded-md cursor-pointer transition-all",
      active ? "bg-amber-100 text-amber-700 shadow-sm border border-amber-200" : "bg-transparent text-slate-500 hover:bg-slate-100"
    )}>
       {React.cloneElement(icon as React.ReactElement, { className: cn("w-4 h-4 mb-1", active && "stroke-[2.5px]") })}
       <span className="text-[9px] font-bold uppercase tracking-tighter">{label}</span>
    </div>
  );
}

function ShapeIcon({ icon, onClick }: { icon: React.ReactNode, onClick: () => void }) {
  return (
    <div onClick={onClick} className="flex items-center justify-center p-2 border rounded hover:bg-amber-100 hover:border-amber-400 cursor-pointer transition-all text-slate-600">
      {icon}
    </div>
  )
}

function LibraryButton({ icon, label, onClick, disabled }: { icon: React.ReactNode, label: string, onClick?: () => void, disabled?: boolean }) {
  return (
    <Button variant="ghost" disabled={disabled} onClick={onClick} className="w-full justify-start gap-2 h-8 px-2 text-slate-700 hover:bg-slate-100 group">
       {React.cloneElement(icon as React.ReactElement, { className: "w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" })}
       <span className="text-[11px] font-medium">{label}</span>
    </Button>
  );
}

function RibbonButton({ icon, label, onClick, disabled, variant = "ghost" }: { icon: React.ReactNode, label: string, onClick?: () => void, disabled?: boolean, variant?: any }) {
  return (
    <Button variant={variant} disabled={disabled} onClick={onClick} className="h-16 flex flex-col gap-1 px-3 hover:bg-slate-100 min-w-[60px] group transition-colors">
      {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5 text-slate-600 group-hover:text-blue-600" })}
      <span className="text-[9px] uppercase font-bold text-slate-500 group-hover:text-slate-700">{label}</span>
    </Button>
  );
}

function RibbonIconButton({ icon, label, onClick, disabled }: { icon: React.ReactNode, label?: string, onClick?: () => void, disabled?: boolean }) {
  return (
    <Button variant="ghost" disabled={disabled} onClick={onClick} className="h-7 w-full flex gap-2 px-2 items-center justify-start hover:bg-slate-100 group transition-colors">
      {React.cloneElement(icon as React.ReactElement, { className: "w-3.5 h-3.5 text-slate-600 group-hover:text-blue-600" })}
      {label && <span className="text-[10px] font-medium text-slate-600 group-hover:text-slate-900">{label}</span>}
    </Button>
  );
}

function ToolIconButton({ icon, onClick }: { icon: React.ReactNode, onClick?: () => void }) {
  return (
    <Button variant="ghost" onClick={onClick} className="h-6 w-6 p-0 flex items-center justify-center hover:bg-slate-100 transition-colors">
      {React.cloneElement(icon as React.ReactElement, { className: "w-4 h-4 text-slate-500" })}
    </Button>
  );
}
