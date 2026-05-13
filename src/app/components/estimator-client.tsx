
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
  Ruler as RulerIcon, Info, Circle, Triangle, Diamond, ArrowRight, Hexagon, Octagon,
  Bold, MousePointer2, Square, DoorOpen, Wind, TowerControl as PillarIcon,
  Link, Link2, Unlink, ArrowUpRight, SplitSquareVertical, Image as ImageIcon
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
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import html2canvas from 'html2canvas';

type DesignObject = {
  id: string;
  type: 'structure' | 'opening' | 'shape' | 'text' | 'pillar' | 'table' | 'stair';
  subType: string;
  x: number; y: number; w: number; h: number;
  label: string; 
  color: string; 
  fillColor: string; 
  strokeWidth: number;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  rotation: number;
  scaleX?: number;
  scaleY?: number;
  textContent?: string;
  fontSize?: number;
  isBold?: boolean;
  rows?: number;
  cols?: number;
  isJoined?: boolean; 
  stepCount?: number;
};

const COLORS = ['#000000', '#ffffff', '#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#6366f1', '#a855f7', '#64748b'];
const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 48];

// Architectural snap: 0.25 inch = 1/48 of a foot
const ARCH_SNAP = 1/48; 
// Offset to prevent objects from clipping at 0,0 coordinates
const CANVAS_OFFSET = 60; 

export default function EstimatorClient() {
  const { toast } = useToast();
  const [designObjects, setDesignObjects] = useState<DesignObject[]>([]);
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [interactionMode, setInteractionMode] = useState<'none' | 'dragging' | 'resizing' | 'rotating' | 'drawing' | 'selecting'>('none');
  const [selectedTool, setSelectedTool] = useState<string>('select');
  const [drawStart, setDrawStart] = useState<{x: number, y: number} | null>(null);
  const [tempDrawEnd, setTempDrawEnd] = useState<{x: number, y: number} | null>(null);
  const [dragOffsets, setDragOffsets] = useState<{ [id: string]: { x: number, y: number } }>({});
  const [zoom, setZoom] = useState(40);
  const [snapPoint, setSnapPoint] = useState<{x: number, y: number} | null>(null);
  const [activeRibbonTab, setActiveRibbonTab] = useState('home');
  const [currentWallThickness, setCurrentWallThickness] = useState(0.33); 
  const [clipboard, setClipboard] = useState<DesignObject[]>([]);
  const [history, setHistory] = useState<DesignObject[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [showDimensions, setShowDimensions] = useState(true);
  const [shouldCloneOnMove, setShouldCloneOnMove] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{x1: number, y1: number, x2: number, y2: number} | null>(null);

  const [localPropX, setLocalPropX] = useState("");
  const [localPropY, setLocalPropY] = useState("");
  const [localPropW, setLocalPropW] = useState("");
  const [localPropH, setLocalPropH] = useState("");

  const formatFeetInches = (val: number) => {
    // Aggressive precision to fix the 4ft -> 3' 11" issue
    const roundedVal = Math.round(val * 48) / 48;
    const absVal = Math.abs(roundedVal);
    const feet = Math.floor(absVal + 0.0001); 
    const inches = Math.round((absVal - feet) * 12);
    
    if (feet === 0 && inches === 0) return "0'";
    if (feet === 0) return `${inches}"`;
    if (inches === 0) return `${feet}'`;
    if (inches === 12) return `${feet + 1}'`;
    return `${feet}' ${inches}"`;
  };

  const parseFeetInches = (str: string) => {
    if (!str || str.trim() === "") return 0;
    const s = str.trim();
    
    const matchFull = s.match(/(\d+)'\s*(\d+)"/);
    if (matchFull) return parseInt(matchFull[1]) + parseInt(matchFull[2]) / 12;
    
    const matchFeet = s.match(/^(\d+)'$/);
    if (matchFeet) return parseInt(matchFeet[1]);
    
    const matchInches = s.match(/^(\d+)"$/);
    if (matchInches) return parseInt(matchInches[1]) / 12;
    
    const decimal = parseFloat(s);
    return isNaN(decimal) ? 0 : decimal;
  };

  const firstSelectedObject = useMemo(() => designObjects.find(obj => obj.id === selectedObjectIds[0]), [designObjects, selectedObjectIds]);

  useEffect(() => {
    if (firstSelectedObject) {
      setLocalPropX(formatFeetInches(firstSelectedObject.x));
      setLocalPropY(formatFeetInches(firstSelectedObject.y));
      setLocalPropW(formatFeetInches(firstSelectedObject.w));
      setLocalPropH(formatFeetInches(firstSelectedObject.h));
    }
  }, [firstSelectedObject?.id, firstSelectedObject?.x, firstSelectedObject?.y, firstSelectedObject?.w, firstSelectedObject?.h]);

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

  const deleteObjects = useCallback(() => {
    if (selectedObjectIds.length === 0) return;
    setDesignObjects(prev => {
      const next = prev.filter(o => !selectedObjectIds.includes(o.id));
      saveToHistory(next);
      return next;
    });
    setSelectedObjectIds([]);
  }, [selectedObjectIds, saveToHistory]);

  const findSnapPoint = useCallback((x: number, y: number, excludeIds: string[] = []) => {
    let bestSnap: {x: number, y: number} | null = null;
    let minDist = 0.5; 

    designObjects.forEach(obj => {
      if (excludeIds.includes(obj.id)) return;
      
      const rad = (obj.rotation || 0) * (Math.PI / 180);
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      
      const pts = (obj.subType === 'wall' || obj.type === 'stair') ? [
        { x: obj.x, y: obj.y },
        { x: obj.x + obj.w * cos, y: obj.y + obj.w * sin }
      ] : [
        { x: obj.x, y: obj.y },
        { x: obj.x + obj.w, y: obj.y },
        { x: obj.x, y: obj.y + obj.h },
        { x: obj.x + obj.w, y: obj.y + obj.h },
        { x: obj.x + obj.w / 2, y: obj.y + obj.h / 2 }
      ];
      
      pts.forEach(p => {
        const d = Math.sqrt(Math.pow(x - p.x, 2) + Math.pow(y - p.y, 2));
        if (d < minDist) {
          minDist = d;
          bestSnap = p;
        }
      });
    });

    return bestSnap;
  }, [designObjects]);

  const getConnectedGroup = useCallback((ids: string[], all: DesignObject[]) => {
    const connected = new Set<string>(ids);
    const stack = [...ids];
    
    while (stack.length > 0) {
      const id = stack.pop()!;
      const curr = all.find(o => o.id === id);
      if (!curr) continue;

      all.forEach(other => {
        if (connected.has(other.id)) return;
        
        const isSelfJoined = curr.isJoined;
        const isOtherJoined = other.isJoined;
        if (!isSelfJoined && !isOtherJoined) return;

        const dist = Math.sqrt(Math.pow(curr.x - other.x, 2) + Math.pow(curr.y - other.y, 2));
        if (dist < 0.5) {
          connected.add(other.id);
          stack.push(other.id);
        }
      });
    }
    return Array.from(connected);
  }, []);

  const addObject = useCallback((type: DesignObject['type'], subType: string, label: string, overrides = {}) => {
    const newObj: DesignObject = {
      id: Math.random().toString(36).substr(2, 9),
      type, subType, x: 10, y: 10, w: 2, h: 2, label, 
      color: '#000000', fillColor: subType === 'pillar' ? '#000000' : '#ffffff',
      strokeWidth: 2, strokeStyle: 'solid', rotation: 0,
      scaleX: 1, scaleY: 1,
      isJoined: true, 
      fontSize: 14,
      isBold: false,
      stepCount: 10,
      ...overrides
    };
    const next = [...designObjects, newObj];
    setDesignObjects(next);
    setSelectedObjectIds([newObj.id]);
    saveToHistory(next);
  }, [designObjects, saveToHistory]);

  const addRoom = useCallback(() => {
    const startX = 10, startY = 10, w = 12, h = 10;
    const thickness = currentWallThickness;
    const roomWalls: DesignObject[] = [
      { id: Math.random().toString(36).substr(2, 9), type: 'structure', subType: 'wall', x: startX, y: startY, w: w, h: thickness, label: 'Wall', color: '#000000', fillColor: '#ffffff', strokeWidth: 2, strokeStyle: 'solid', rotation: 0, scaleX: 1, scaleY: 1, isJoined: true },
      { id: Math.random().toString(36).substr(2, 9), type: 'structure', subType: 'wall', x: startX, y: startY + h, w: w, h: thickness, label: 'Wall', color: '#000000', fillColor: '#ffffff', strokeWidth: 2, strokeStyle: 'solid', rotation: 0, scaleX: 1, scaleY: 1, isJoined: true },
      { id: Math.random().toString(36).substr(2, 9), type: 'structure', subType: 'wall', x: startX, y: startY, w: h, h: thickness, label: 'Wall', color: '#000000', fillColor: '#ffffff', strokeWidth: 2, strokeStyle: 'solid', rotation: 90, scaleX: 1, scaleY: 1, isJoined: true },
      { id: Math.random().toString(36).substr(2, 9), type: 'structure', subType: 'wall', x: startX + w, y: startY, w: h, h: thickness, label: 'Wall', color: '#000000', fillColor: '#ffffff', strokeWidth: 2, strokeStyle: 'solid', rotation: 90, scaleX: 1, scaleY: 1, isJoined: true },
    ];
    const next = [...designObjects, ...roomWalls];
    setDesignObjects(next);
    setSelectedObjectIds(roomWalls.map(w => w.id));
    saveToHistory(next);
    toast({ title: "Room Added", description: "A standard 12'x10' room has been inserted." });
  }, [designObjects, currentWallThickness, saveToHistory, toast]);

  const saveToFirestore = useCallback(() => {
    const { firestore } = initializeFirebase();
    const docRef = doc(firestore, 'designs', 'current-layout');
    const data = {
      objects: designObjects,
      updatedAt: serverTimestamp()
    };

    setDoc(docRef, data, { merge: true })
      .then(() => {
        toast({ title: "সফল", description: "ডিজাইনটি স্থায়ীভাবে সেভ করা হয়েছে।" });
      })
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'write',
          requestResourceData: data,
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
      });
  }, [designObjects, toast]);

  const loadFromFirestore = async () => {
    try {
      const { firestore } = initializeFirebase();
      const docRef = doc(firestore, 'designs', 'current-layout');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        setDesignObjects(data.objects);
        saveToHistory(data.objects);
        toast({ title: "সফল", description: "ডিজাইনটি লোড করা হয়েছে।" });
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadFromFirestore();
  }, []);

  const handleMouseDown = (e: React.MouseEvent, id: string | null) => {
    const container = document.getElementById('canvas-workspace-inner');
    const rect = container?.getBoundingClientRect();
    if (!rect || !container) return;
    
    const curX = (e.clientX - rect.left - CANVAS_OFFSET) / zoom;
    const curY = (e.clientY - rect.top - CANVAS_OFFSET) / zoom;

    if (selectedTool === 'wall') {
      const snap = findSnapPoint(curX, curY);
      const start = snap || { x: Math.round(curX / ARCH_SNAP) * ARCH_SNAP, y: Math.round(curY / ARCH_SNAP) * ARCH_SNAP };
      setDrawStart(start);
      setTempDrawEnd(start);
      setInteractionMode('drawing');
      return;
    }

    if (id) {
      e.stopPropagation();
      let newSelection = [...selectedObjectIds];
      if (e.ctrlKey || e.metaKey) {
        if (newSelection.includes(id)) newSelection = newSelection.filter(sid => sid !== id);
        else newSelection.push(id);
      } else {
        if (!newSelection.includes(id)) newSelection = [id];
      }
      setSelectedObjectIds(newSelection);
      setInteractionMode('dragging');
      
      const group = getConnectedGroup(newSelection, designObjects);
      const newOffsets: { [id: string]: { x: number, y: number } } = {};
      group.forEach(gid => {
        const obj = designObjects.find(o => o.id === gid);
        if (obj) newOffsets[gid] = { x: curX - obj.x, y: curY - obj.y };
      });
      setDragOffsets(newOffsets);
    } else {
      setSelectedObjectIds([]);
      if (selectedTool === 'select') {
        setInteractionMode('selecting');
        setSelectionBox({ x1: curX, y1: curY, x2: curX, y2: curY });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const container = document.getElementById('canvas-workspace-inner');
    const rect = container?.getBoundingClientRect();
    if (!rect || !container) return;
    
    const curX = (e.clientX - rect.left - CANVAS_OFFSET) / zoom;
    const curY = (e.clientY - rect.top - CANVAS_OFFSET) / zoom;

    if (interactionMode === 'drawing' && drawStart) {
      let endX = curX;
      let endY = curY;
      if (e.shiftKey) {
        const dx = Math.abs(curX - drawStart.x);
        const dy = Math.abs(curY - drawStart.y);
        if (dx > dy) endY = drawStart.y;
        else endX = drawStart.x;
      }
      const snap = findSnapPoint(endX, endY);
      setTempDrawEnd(snap || { x: Math.round(endX / ARCH_SNAP) * ARCH_SNAP, y: Math.round(endY / ARCH_SNAP) * ARCH_SNAP });
      setSnapPoint(snap);
      return;
    }

    if (interactionMode === 'selecting' && selectionBox) {
      setSelectionBox(prev => prev ? { ...prev, x2: curX, y2: curY } : null);
    }

    if (interactionMode === 'dragging' && selectedObjectIds.length > 0) {
      const group = Object.keys(dragOffsets);
      const mainId = selectedObjectIds[0];
      const mainOffset = dragOffsets[mainId];
      if (!mainOffset) return;
      
      const potentialX = curX - mainOffset.x;
      const potentialY = curY - mainOffset.y;
      
      const snap = findSnapPoint(potentialX, potentialY, group);
      const targetX = snap ? snap.x : Math.round(potentialX / ARCH_SNAP) * ARCH_SNAP;
      const targetY = snap ? snap.y : Math.round(potentialY / ARCH_SNAP) * ARCH_SNAP;
      
      const mainObj = designObjects.find(o => o.id === mainId);
      if (!mainObj) return;
      const dx = targetX - mainObj.x;
      const dy = targetY - mainObj.y;
      
      if (dx !== 0 || dy !== 0) {
        setDesignObjects(prev => prev.map(o => group.includes(o.id) ? { ...o, x: o.x + dx, y: o.y + dy } : o));
      }
      setSnapPoint(snap);
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
    } else if (interactionMode === 'selecting' && selectionBox) {
      const xMin = Math.min(selectionBox.x1, selectionBox.x2);
      const xMax = Math.max(selectionBox.x1, selectionBox.x2);
      const yMin = Math.min(selectionBox.y1, selectionBox.y2);
      const yMax = Math.max(selectionBox.y1, selectionBox.y2);
      const inBox = designObjects.filter(obj => obj.x >= xMin && obj.x <= xMax && obj.y >= yMin && obj.y <= yMax).map(o => o.id);
      setSelectedObjectIds(inBox);
      setSelectionBox(null);
    } else if (interactionMode !== 'none') {
      saveToHistory(designObjects);
    }
    setInteractionMode('none');
    setSnapPoint(null);
  };

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

  const Ruler = ({ orientation }: { orientation: 'horizontal' | 'vertical' }) => {
    const steps = 4;
    const count = 50;
    const ticks = [];
    for (let i = 0; i < count; i++) ticks.push(i);
    return (
      <div className={cn("bg-slate-50 border-slate-200 overflow-hidden", 
        orientation === 'horizontal' ? "h-8 border-b w-full relative" : "w-8 border-r h-full relative")}>
        {ticks.map(t => (
          <div key={t} className="absolute flex flex-col items-center justify-start overflow-visible" style={
            orientation === 'horizontal' ? { left: t * steps * zoom + CANVAS_OFFSET, top: 0, width: zoom * 4 } : { top: t * steps * zoom + CANVAS_OFFSET, left: 0, height: zoom * 4 }
          }>
            <div className={cn("bg-slate-400", orientation === 'horizontal' ? "w-[1px] h-3" : "h-[1px] w-3")} />
            <span className="text-[9px] font-bold text-slate-500 mt-0.5">{t * steps}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full mx-auto p-0 bg-slate-100 min-h-screen flex flex-col overflow-hidden font-body text-slate-900">
      <div className="h-10 bg-slate-800 border-b flex items-center px-4 justify-between shrink-0 text-white">
        <div className="flex items-center gap-6 h-full">
          <div className="flex items-center gap-2 pr-4 border-r border-slate-700">
            <Building className="w-5 h-5 text-blue-400" />
            <span className="font-bold text-xs tracking-tighter uppercase">Architectural Pro Studio</span>
          </div>
          <nav className="flex gap-0 h-full">
            {['File', 'Home', 'Design'].map(item => (
              <Button key={item} variant="ghost" onClick={() => setActiveRibbonTab(item.toLowerCase())}
                className={cn("h-10 px-6 text-[11px] font-bold transition-all rounded-none border-b-2",
                  activeRibbonTab === item.toLowerCase() ? "bg-slate-700 text-white border-blue-400" : "text-slate-400 hover:bg-slate-700 border-transparent")}>{item}</Button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <User className="w-5 h-5 text-slate-400 cursor-pointer hover:text-white" />
        </div>
      </div>

      <div className="h-24 bg-white border-b flex items-center px-4 gap-0 shrink-0 shadow-sm z-30">
        <div className="flex items-center border-r px-3 h-full gap-1">
          <Button variant="ghost" className="h-20 flex flex-col gap-2 px-6" onClick={undo}><Undo2 className="w-5 h-5" /><span className="text-[10px] uppercase font-bold">Undo</span></Button>
          <Button variant="ghost" className="h-20 flex flex-col gap-2 px-6" onClick={redo}><Redo2 className="w-5 h-5" /><span className="text-[10px] uppercase font-bold">Redo</span></Button>
        </div>
        <div className="flex items-center border-r px-3 h-full gap-2">
           <Button variant="ghost" className={cn("h-20 flex flex-col gap-2 px-6", selectedTool === 'wall' && "bg-slate-100")} onClick={() => setSelectedTool('wall')}><Pencil className="w-5 h-5" /><span className="text-[10px] uppercase font-bold">Wall</span></Button>
           <Button variant="ghost" className="h-20 flex flex-col gap-2 px-6" onClick={addRoom}><Square className="w-5 h-5" /><span className="text-[10px] uppercase font-bold">Room</span></Button>
        </div>
        <div className="flex items-center px-6 h-full gap-4">
           <Button variant="default" className="gap-2" onClick={saveToFirestore}><Save className="w-4 h-4" /> Save Design</Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-[280px] bg-slate-50 border-r z-20 shrink-0 flex flex-col shadow-inner">
          <div className="p-3 border-b bg-slate-100 flex items-center justify-between"><span className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">Toolbox</span></div>
          <ScrollArea className="flex-1 p-4 space-y-6">
             <ToolCard icon={<MousePointer2 />} label="Select" active={selectedTool === 'select'} onClick={() => setSelectedTool('select')} />
             <div className="pt-4 border-t">
               <Label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Dimensions & Area</Label>
               <div className="flex items-center justify-between bg-white p-2 rounded border">
                  <span className="text-[11px]">Show Dimensions</span>
                  <Switch checked={showDimensions} onCheckedChange={setShowDimensions} className="scale-75" />
               </div>
             </div>
          </ScrollArea>
        </div>

        <div className="flex-1 relative flex flex-col overflow-hidden bg-slate-200">
          <div id="canvas-workspace" className="flex-1 relative flex flex-col overflow-hidden m-0 shadow-inner">
            <Ruler orientation="horizontal" />
            <div className="flex-1 flex overflow-hidden">
              <Ruler orientation="vertical" />
              <div id="canvas-workspace-inner" className="flex-1 relative bg-white overflow-auto cursor-crosshair"
                onMouseDown={(e) => handleMouseDown(e, null)} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
                <div className="absolute inset-0" style={{ 
                    backgroundImage: `linear-gradient(#f1f5f9 1px, transparent 1px), linear-gradient(90deg, #f1f5f9 1px, transparent 1px)`,
                    backgroundSize: `${zoom}px ${zoom}px`, 
                    backgroundPosition: `${CANVAS_OFFSET}px ${CANVAS_OFFSET}px`,
                    width: 4000, height: 4000
                  }}>
                  
                  {designObjects.map(obj => (
                    <div key={obj.id} onMouseDown={(e) => handleMouseDown(e, obj.id)}
                      className={cn("absolute flex items-center justify-center transition-shadow", 
                        selectedObjectIds.includes(obj.id) ? "z-30 ring-2 ring-blue-500" : "z-10")}
                      style={{ 
                        left: obj.x * zoom + CANVAS_OFFSET, 
                        top: obj.y * zoom + CANVAS_OFFSET, 
                        width: obj.w * zoom, 
                        height: obj.h * zoom, 
                        transformOrigin: '0 0', 
                        // Vertical wall thickness adjustment to avoid diving inside ruler
                        transform: `rotate(${obj.rotation}deg)${obj.subType === 'wall' && obj.rotation === 90 ? ' translate(0, -100%)' : ''}`,
                        backgroundColor: obj.subType === 'wall' ? '#000000' : obj.fillColor,
                      }}>
                      {showDimensions && (
                        <div className="absolute top-full mt-2 bg-white px-1.5 py-0.5 rounded border border-slate-300 shadow-sm pointer-events-none z-50">
                          <span className="text-[10px] font-bold text-slate-800">{formatFeetInches(obj.w)}</span>
                        </div>
                      )}
                    </div>
                  ))}

                  {interactionMode === 'drawing' && drawStart && tempDrawEnd && (
                    <div className="absolute bg-blue-500/20 pointer-events-none z-50 border-2 border-blue-500 border-dashed"
                      style={{
                        left: drawStart.x * zoom + CANVAS_OFFSET, 
                        top: drawStart.y * zoom + CANVAS_OFFSET,
                        width: Math.sqrt(Math.pow(tempDrawEnd.x - drawStart.x, 2) + Math.pow(tempDrawEnd.y - drawStart.y, 2)) * zoom,
                        height: currentWallThickness * zoom,
                        transformOrigin: '0 0', 
                        transform: `rotate(${Math.atan2(tempDrawEnd.y - drawStart.y, tempDrawEnd.x - drawStart.x) * (180 / Math.PI)}deg)`,
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="h-10 bg-white border-t flex items-center px-4 justify-between shrink-0 shadow-inner">
             <div className="flex items-center gap-4">
                <ZoomOut className="w-4 h-4 text-slate-400" />
                <Slider value={[zoom]} max={150} min={10} step={2} className="w-40" onValueChange={(val) => setZoom(val[0])} />
                <ZoomIn className="w-4 h-4 text-slate-400" />
             </div>
             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Snap: 0.25" Precision
             </div>
          </div>
        </div>

        <div className="w-[300px] bg-white border-l z-20 shrink-0 flex flex-col p-4 shadow-xl">
           <Label className="text-[11px] font-bold text-slate-500 uppercase mb-4">Object Inspector</Label>
           {firstSelectedObject ? (
              <div className="space-y-4">
                <PropInput label="X POS" value={localPropX} onChange={setLocalPropX} onBlur={() => updateObject(selectedObjectIds[0], { x: parseFeetInches(localPropX) }, true)} />
                <PropInput label="Y POS" value={localPropY} onChange={setLocalPropY} onBlur={() => updateObject(selectedObjectIds[0], { y: parseFeetInches(localPropY) }, true)} />
                <PropInput label="WIDTH" value={localPropW} onChange={setLocalPropW} onBlur={() => updateObject(selectedObjectIds[0], { w: parseFeetInches(localPropW) }, true)} />
              </div>
           ) : (
             <div className="h-full flex items-center justify-center text-slate-300 italic text-[11px]">No object selected</div>
           )}
        </div>
      </div>
    </div>
  );
}

function PropInput({ label, value, onChange, onBlur }: { label: string, value: string, onChange: (v: string) => void, onBlur: () => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-[9px] font-bold text-slate-400 uppercase">{label}</Label>
      <Input className="h-8 text-[11px]" value={value} onChange={e => onChange(e.target.value)} onBlur={onBlur} />
    </div>
  );
}

function ToolCard({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <div onClick={onClick} className={cn("flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all border",
      active ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50")}>
       {React.cloneElement(icon as React.ReactElement, { className: "w-4 h-4" })}
       <span className="text-[10px] font-bold uppercase">{label}</span>
    </div>
  );
}
