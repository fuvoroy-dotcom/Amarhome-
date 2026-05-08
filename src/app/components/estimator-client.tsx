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
  Merge, Split, Grid, CheckSquare
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

const LINE_WIDTHS = [1, 2, 4, 6, 8];

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
  const [activeRibbonTab, setActiveRibbonTab] = useState('home');
  
  // Table specific state
  const [tableRowsInput, setTableRowsInput] = useState(4);
  const [tableColsInput, setTableColsInput] = useState(3);

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
      toast({ title: "Drawing Mode", description: "মাউস দিয়ে টেনে দেয়াল আঁকুন।" });
      return;
    }
    const newObj: DesignObject = {
      id: Math.random().toString(36).substr(2, 9),
      type, subType, x: 10, y: 10, w: 10, h: subType === 'table' ? 6 : 8,
      label, color: '#000000', fillColor: '#ffffff',
      strokeWidth: 2, strokeStyle: 'solid',
      rotation: 0,
      rows: subType === 'table' ? tableRowsInput : undefined,
      cols: subType === 'table' ? tableColsInput : undefined
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
    <div className="w-full max-w-full mx-auto p-0 bg-slate-100 min-h-screen flex flex-col overflow-hidden">
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
              { id: 'page', label: 'Page' },
              { id: 'table', label: 'Table' },
              { id: 'options', label: 'Options' },
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

      {/* Professional Ribbon Bar */}
      <div className="h-20 bg-white border-b flex items-center px-4 gap-0 shrink-0 shadow-sm z-30 overflow-x-auto no-scrollbar">
        {activeRibbonTab === 'file' && (
          <div className="flex items-center">
            <RibbonButton icon={<Folder />} label="Documents" />
            <RibbonButton icon={<FilePlus />} label="New" onClick={handleNewFile} />
            <RibbonButton icon={<FolderOpen />} label="Open" />
            <RibbonButton icon={<Save />} label="Save a Copy" />
            <RibbonButton icon={<Printer />} label="Print" onClick={() => window.print()} />
            <RibbonButton icon={<Settings />} label="Options" />
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
                  <DropdownMenuItem onClick={() => toast({ title: "Exporting..." })}>Export as PDF</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast({ title: "Exporting..." })}>Export as PNG</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast({ title: "Exporting..." })}>Export as SVG</DropdownMenuItem>
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
                  <DropdownMenuItem onClick={() => addObject('structure', 'wall', 'দেয়াল')}>Insert Wall</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addObject('shape', 'room', 'রুম')}>Square Room</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addObject('shape', 'room', 'L-Room')}>L-Shaped Room</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => addObject('opening', 'door', 'দরজা')}>Door</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center border-r px-2">
              <RibbonIconButton icon={<Undo2 />} label="Undo" onClick={undo} disabled={historyIndex <= 0} />
              <RibbonIconButton icon={<Redo2 />} label="Redo" onClick={redo} disabled={historyIndex >= history.length - 1} />
            </div>

            <div className="flex items-center border-r px-2">
               <RibbonIconButton icon={<Layers />} label="Styles" />
               <RibbonIconButton icon={<FileText />} label="Themes" />
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
                    <div onClick={() => selectedObjectId && updateObject(selectedObjectId, { fillColor: 'transparent' }, true)} className="w-6 h-6 rounded border cursor-pointer flex items-center justify-center text-[10px] text-slate-400 bg-slate-50">X</div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-16 flex flex-col gap-1 px-3" disabled={!selectedObject}>
                    <GripHorizontal className="w-5 h-5 text-slate-600" />
                    <span className="text-[9px] uppercase font-bold text-slate-500">Line Style</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="p-2 w-48">
                  <div className="space-y-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Style</span>
                      <div className="flex gap-2 mt-1">
                        {LINE_STYLES.map(s => (
                          <Button key={s.value} variant="outline" className="h-7 text-[10px] flex-1" onClick={() => selectedObjectId && updateObject(selectedObjectId, { strokeStyle: s.value as any }, true)}>{s.label}</Button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Width</span>
                      <div className="flex gap-1 mt-1">
                        {LINE_WIDTHS.map(w => (
                          <Button key={w} variant="outline" className="h-7 w-7 text-[10px] p-0" onClick={() => selectedObjectId && updateObject(selectedObjectId, { strokeWidth: w }, true)}>{w}px</Button>
                        ))}
                      </div>
                    </div>
                    <div>
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Color</span>
                       <div className="grid grid-cols-5 gap-1 mt-1">
                        {COLORS.map(c => (
                          <div key={c} onClick={() => selectedObjectId && updateObject(selectedObjectId, { color: c }, true)} className="w-5 h-5 rounded border cursor-pointer" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <RibbonIconButton icon={<Star />} label="Effects" />
            </div>

            <div className="flex items-center border-r px-2 gap-2">
               <div className="flex flex-col gap-0.5">
                 <RibbonIconButton icon={<AlignLeft />} label="Align" />
                 <RibbonIconButton icon={<Group />} label="Group" />
               </div>
               <div className="flex flex-col gap-0.5">
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-7 gap-2 px-2 items-center justify-start hover:bg-slate-100">
                        <RotateCw className="w-3.5 h-3.5 text-slate-600" />
                        <span className="text-[10px] font-medium text-slate-600">Rotate</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                       <DropdownMenuItem onClick={() => selectedObjectId && updateObject(selectedObjectId, { rotation: (selectedObject?.rotation || 0) + 90 }, true)}>Rotate 90°</DropdownMenuItem>
                       <DropdownMenuItem onClick={() => selectedObjectId && updateObject(selectedObjectId, { rotation: (selectedObject?.rotation || 0) - 90 }, true)}>Rotate -90°</DropdownMenuItem>
                    </DropdownMenuContent>
                 </DropdownMenu>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-7 gap-2 px-2 items-center justify-start hover:bg-slate-100">
                        <FlipHorizontal className="w-3.5 h-3.5 text-slate-600" />
                        <span className="text-[10px] font-medium text-slate-600">Flip</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                       <DropdownMenuItem onClick={flipH}>Flip Horizontal</DropdownMenuItem>
                       <DropdownMenuItem onClick={flipV}>Flip Vertical</DropdownMenuItem>
                    </DropdownMenuContent>
                 </DropdownMenu>
               </div>
               <div className="flex flex-col gap-0.5">
                  <RibbonIconButton icon={<BringToFront />} label="Bring to Front" onClick={bringToFront} />
                  <RibbonIconButton icon={<SendToBack />} label="Send to Back" onClick={sendToBack} />
               </div>
            </div>
            
            <RibbonButton icon={<Trash2 />} label="Delete" variant="destructive" onClick={() => deleteObject(selectedObjectId)} />
          </>
        )}

        {activeRibbonTab === 'table' && (
          <div className="flex items-center">
            <div className="flex flex-col items-center border-r px-3">
               <div className="flex items-center gap-2 mb-1">
                 <Rows className="w-3 h-3 text-slate-400" />
                 <span className="text-[10px] font-bold text-slate-500">Rows</span>
                 <Input 
                  type="number" 
                  value={tableRowsInput} 
                  onChange={(e) => setTableRowsInput(parseInt(e.target.value) || 1)}
                  className="h-5 w-10 text-[10px] p-1" 
                />
               </div>
               <div className="flex items-center gap-2">
                 <Columns className="w-3 h-3 text-slate-400" />
                 <span className="text-[10px] font-bold text-slate-500">Cols</span>
                 <Input 
                  type="number" 
                  value={tableColsInput} 
                  onChange={(e) => setTableColsInput(parseInt(e.target.value) || 1)}
                  className="h-5 w-10 text-[10px] p-1" 
                />
               </div>
            </div>
            <div className="flex items-center border-r px-2">
               <RibbonButton icon={<Grid />} label="Insert Table" onClick={() => addObject('shape', 'table', 'Table')} />
               <RibbonButton icon={<Trash2 />} label="Remove Table" onClick={() => deleteObject(selectedObjectId)} />
            </div>
            <div className="flex items-center border-r px-2">
               <div className="flex flex-col gap-1">
                  <RibbonIconButton icon={<ArrowLeftToLine />} label="Insert Left" />
                  <RibbonIconButton icon={<ArrowRightToLine />} label="Insert Right" />
               </div>
               <div className="flex flex-col gap-1">
                  <RibbonIconButton icon={<ArrowUpToLine />} label="Insert Above" />
                  <RibbonIconButton icon={<ArrowDownToLine />} label="Insert Below" />
               </div>
            </div>
            <div className="flex items-center border-r px-2">
               <RibbonButton icon={<Merge />} label="Join Cells" />
               <RibbonButton icon={<Split />} label="Split Cells" />
            </div>
            <div className="flex items-center border-r px-2">
               <RibbonButton icon={<X />} label="Delete" variant="destructive" onClick={() => deleteObject(selectedObjectId)} />
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-16 flex flex-col gap-1 px-3">
                       <LayoutGrid className="w-5 h-5 text-slate-600"/>
                       <div className="flex items-center gap-0.5">
                         <span className="text-[9px] uppercase font-bold text-slate-500">Distribute</span>
                         <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
                       </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                     <DropdownMenuItem>Distribute Rows</DropdownMenuItem>
                     <DropdownMenuItem>Distribute Columns</DropdownMenuItem>
                  </DropdownMenuContent>
               </DropdownMenu>
            </div>
            <div className="flex items-center px-4 gap-2">
               <Checkbox id="text-edit" checked />
               <Label htmlFor="text-edit" className="text-[11px] font-bold text-slate-600">Text Editing</Label>
            </div>
          </div>
        )}
      </div>

      {/* Tabs Row */}
      <div className="w-full bg-slate-100 border-b overflow-hidden shrink-0">
        <ScrollArea orientation="horizontal" className="w-full">
          <div className="flex h-11 bg-transparent px-4">
            <Tabs defaultValue="design" className="h-full">
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
            </Tabs>
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex overflow-hidden bg-[#f8f9fa]">
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
                  <Button variant="outline" className={cn("w-full justify-start text-[11px] h-9 gap-2 font-bold", interactionMode === 'drawing' ? "bg-blue-600 text-white" : "bg-white")} onClick={() => addObject('structure', 'wall', 'দেয়াল')}><Pencil className="w-3 h-3"/> {interactionMode === 'drawing' ? "Drawing..." : "Draw Wall"}</Button>
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
          </ScrollArea>
        </div>

        <div className="flex-1 relative flex flex-col bg-[#e9ecef] overflow-hidden">
          {/* Rulers */}
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
              className="flex-1 relative bg-[#e9ecef] overflow-auto focus:outline-none cursor-crosshair no-scrollbar"
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
                  const isTable = obj.subType === 'table';
                  const isSelected = selectedObjectId === obj.id;
                  
                  return (
                    <div key={obj.id} onMouseDown={(e) => handleMouseDown(e, obj.id)} onClick={(e) => e.stopPropagation()} 
                      className={cn("absolute flex items-center justify-center cursor-move select-none transition-shadow", isSelected ? "z-30 shadow-2xl" : "z-10 shadow-sm")}
                      style={{ 
                        left: obj.x * zoom, 
                        top: obj.y * zoom, 
                        width: obj.w * zoom, 
                        height: isWall ? (obj.strokeWidth || 4) : obj.h * zoom, 
                        transformOrigin: '0 50%',
                        transform: `rotate(${obj.rotation}deg) scaleX(${obj.flipH ? -1 : 1}) scaleY(${obj.flipV ? -1 : 1})`, 
                        backgroundColor: isWall ? obj.color : obj.fillColor,
                        borderStyle: isWall ? 'none' : (obj.strokeStyle || 'solid'),
                        borderColor: isWall ? 'transparent' : obj.color,
                        borderWidth: isWall ? undefined : (obj.strokeWidth || 1),
                        outline: isSelected ? '2px solid #2563eb' : undefined,
                        outlineOffset: isSelected ? '2px' : undefined
                      }}>
                      
                      {isTable && (
                        <div className="absolute inset-0 grid" style={{
                          gridTemplateColumns: `repeat(${obj.cols || 1}, 1fr)`,
                          gridTemplateRows: `repeat(${obj.rows || 1}, 1fr)`
                        }}>
                          {Array.from({ length: (obj.rows || 1) * (obj.cols || 1) }).map((_, i) => (
                            <div key={i} className="border border-slate-300 opacity-50" />
                          ))}
                        </div>
                      )}

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

            {/* Bottom Property Input Row */}
            <div className="absolute bottom-0 left-0 right-0 h-14 bg-white border-t flex items-center px-4 gap-4 z-30 shadow-lg overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Left</span>
                  <Input 
                    className="h-8 w-24 text-[11px] font-mono bg-slate-50 border-slate-200" 
                    value={selectedObject ? formatFeetInches(selectedObject.x) : ''} 
                    onChange={(e) => selectedObject && updateObject(selectedObject.id, { x: parseFeetInches(e.target.value) }, true)} 
                    placeholder={`0' 0"`}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Top</span>
                  <Input 
                    className="h-8 w-24 text-[11px] font-mono bg-slate-50 border-slate-200" 
                    value={selectedObject ? formatFeetInches(selectedObject.y) : ''} 
                    onChange={(e) => selectedObject && updateObject(selectedObject.id, { y: parseFeetInches(e.target.value) }, true)} 
                    placeholder={`0' 0"`}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Width</span>
                  <Input 
                    className="h-8 w-24 text-[11px] font-mono bg-slate-50 border-slate-200" 
                    value={selectedObject ? formatFeetInches(selectedObject.w) : ''} 
                    onChange={(e) => selectedObject && updateObject(selectedObject.id, { w: parseFeetInches(e.target.value) }, true)} 
                    placeholder={`0' 0"`}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Height</span>
                  <Input 
                    disabled={selectedObject?.subType === 'wall'} 
                    className="h-8 w-24 text-[11px] font-mono bg-slate-50 border-slate-200" 
                    value={selectedObject ? formatFeetInches(selectedObject.h) : ''} 
                    onChange={(e) => selectedObject && updateObject(selectedObject.id, { h: parseFeetInches(e.target.value) }, true)} 
                    placeholder={`0' 0"`}
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
        </div>

        {/* Right Properties Panel */}
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
                      <Input value={formatFeetInches(selectedObject.w)} onChange={(e) => updateObject(selectedObject.id, { w: parseFeetInches(e.target.value) }, true)} className="h-9 font-mono bg-slate-50" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-slate-500 uppercase font-bold">Height</Label>
                      <Input disabled={selectedObject.subType === 'wall'} value={formatFeetInches(selectedObject.h)} onChange={(e) => updateObject(selectedObject.id, { h: parseFeetInches(e.target.value) }, true)} className="h-9 font-mono bg-slate-50" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label className="text-[10px] text-slate-500 uppercase font-bold">Rotation (°)</Label>
                      <Input type="number" value={selectedObject.rotation} onChange={(e) => updateObject(selectedObject.id, { rotation: parseInt(e.target.value) || 0 }, true)} className="h-9 w-20 text-center font-mono bg-slate-50" />
                    </div>
                    <Slider value={[selectedObject.rotation]} max={360} min={-360} step={15} onValueChange={(val) => updateObject(selectedObject.id, { rotation: val[0] }, true)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                     <Button variant="outline" className="h-8 text-[10px]" onClick={() => updateObject(selectedObject.id, { x: selectedObject.x - 0.5 }, true)}><Move className="w-3 h-3 mr-1"/> Left</Button>
                     <Button variant="outline" className="h-8 text-[10px]" onClick={() => updateObject(selectedObject.id, { x: selectedObject.x + 0.5 }, true)}><Move className="w-3 h-3 mr-1"/> Right</Button>
                     <Button variant="outline" className="h-8 text-[10px]" onClick={() => updateObject(selectedObject.id, { y: selectedObject.y - 0.5 }, true)}><Move className="w-3 h-3 mr-1"/> Up</Button>
                     <Button variant="outline" className="h-8 text-[10px]" onClick={() => updateObject(selectedObject.id, { y: selectedObject.y + 0.5 }, true)}><Move className="w-3 h-3 mr-1"/> Down</Button>
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
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

function RibbonButton({ icon, label, onClick, disabled, variant = "ghost" }: { icon: React.ReactNode, label: string, onClick?: () => void, disabled?: boolean, variant?: any }) {
  return (
    <Button variant={variant} disabled={disabled} onClick={onClick} className="h-16 flex flex-col gap-1 px-3 hover:bg-slate-100 min-w-[60px]">
      {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5 text-slate-600" })}
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
