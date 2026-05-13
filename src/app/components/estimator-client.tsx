
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
  Link, Link2, Unlink, ArrowUpRight, SplitSquareVertical, Image as ImageIcon,
  Eye, EyeOff, RotateCcw
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

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

// Colors with Black and Red first
const COLORS = ['#000000', '#ef4444', '#ffffff', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#6366f1', '#a855f7', '#64748b'];

// Architectural snap: 0.25 inch = 1/48 of a foot
const ARCH_SNAP = 1/48; 
const CANVAS_OFFSET = 60; 

export default function EstimatorClient() {
  const { toast } = useToast();
  const [designObjects, setDesignObjects] = useState<DesignObject[]>([]);
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<DesignObject[]>([]);
  const [interactionMode, setInteractionMode] = useState<'none' | 'dragging' | 'resizing' | 'rotating' | 'drawing' | 'selecting'>('none');
  const [selectedTool, setSelectedTool] = useState<string>('select');
  const [drawStart, setDrawStart] = useState<{x: number, y: number} | null>(null);
  const [tempDrawEnd, setTempDrawEnd] = useState<{x: number, y: number} | null>(null);
  const [dragOffsets, setDragOffsets] = useState<{ [id: string]: { x: number, y: number } }>({});
  const [zoom, setZoom] = useState(40);
  const [activeRibbonTab, setActiveRibbonTab] = useState('home');
  const [currentWallThickness, setCurrentWallThickness] = useState(0.4166); // 5 inches
  const [history, setHistory] = useState<DesignObject[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [showDimensions, setShowDimensions] = useState(true);
  const [selectionBox, setSelectionBox] = useState<{x1: number, y1: number, x2: number, y2: number} | null>(null);

  const [localPropX, setLocalPropX] = useState("");
  const [localPropY, setLocalPropY] = useState("");
  const [localPropW, setLocalPropW] = useState("");
  const [localPropH, setLocalPropH] = useState("");
  const [localPropRot, setLocalPropRot] = useState("");

  const formatFeetInches = (val: number) => {
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
      setLocalPropRot(firstSelectedObject.rotation.toString());
    }
  }, [firstSelectedObject?.id, firstSelectedObject?.x, firstSelectedObject?.y, firstSelectedObject?.w, firstSelectedObject?.h, firstSelectedObject?.rotation]);

  const saveToHistory = useCallback((newObjects: DesignObject[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...newObjects.map(obj => ({...obj}))]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setDesignObjects([...prev]);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setDesignObjects([...next]);
    }
  }, [history, historyIndex]);

  const deleteSelected = useCallback(() => {
    if (selectedObjectIds.length > 0) {
      const next = designObjects.filter(obj => !selectedObjectIds.includes(obj.id));
      setDesignObjects(next);
      setSelectedObjectIds([]);
      saveToHistory(next);
    }
  }, [designObjects, selectedObjectIds, saveToHistory]);

  const copySelected = useCallback(() => {
    const selected = designObjects.filter(obj => selectedObjectIds.includes(obj.id));
    if (selected.length > 0) {
      setClipboard(selected.map(obj => ({ ...obj })));
      toast({ title: "কপি করা হয়েছে", description: `${selected.length}টি অবজেক্ট কপি হয়েছে।` });
    }
  }, [designObjects, selectedObjectIds, toast]);

  const pasteSelected = useCallback(() => {
    if (clipboard.length > 0) {
      const offset = 0.5;
      const pasted = clipboard.map(obj => ({
        ...obj,
        id: Math.random().toString(36).substr(2, 9),
        x: Math.round((obj.x + offset) / ARCH_SNAP) * ARCH_SNAP,
        y: Math.round((obj.y + offset) / ARCH_SNAP) * ARCH_SNAP,
        isJoined: false
      }));
      const next = [...designObjects, ...pasted];
      setDesignObjects(next);
      setSelectedObjectIds(pasted.map(p => p.id));
      saveToHistory(next);
      toast({ title: "পেস্ট করা হয়েছে", description: `${pasted.length}টি অবজেক্ট পেস্ট হয়েছে।` });
    }
  }, [clipboard, designObjects, saveToHistory, toast]);

  const saveToFirestore = useCallback(() => {
    const { firestore } = initializeFirebase();
    const docRef = doc(firestore, 'designs', 'current-layout');
    const data = { objects: designObjects, updatedAt: serverTimestamp() };
    setDoc(docRef, data, { merge: true }).then(() => {
      toast({ title: "সফল", description: "ডিজাইনটি সেভ করা হয়েছে।" });
    }).catch(async (serverError) => {
      const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'write', requestResourceData: data });
      errorEmitter.emit('permission-error', permissionError);
    });
  }, [designObjects, toast]);

  const updateObject = (id: string, updates: Partial<DesignObject>, save = false) => {
    setDesignObjects(prev => {
      const next = prev.map(o => o.id === id ? { ...o, ...updates } : o);
      if (save) saveToHistory(next);
      return next;
    });
  };

  const moveSelectedWithArrows = useCallback((key: string) => {
    if (selectedObjectIds.length === 0) return;
    
    let dx = 0;
    let dy = 0;
    const step = ARCH_SNAP;

    if (key === 'ArrowUp') dy = -step;
    if (key === 'ArrowDown') dy = step;
    if (key === 'ArrowLeft') dx = -step;
    if (key === 'ArrowRight') dx = step;

    setDesignObjects(prev => {
      const next = prev.map(o => {
        if (selectedObjectIds.includes(o.id) && !o.isJoined) {
          return { 
            ...o, 
            x: Math.round((o.x + dx) * 48) / 48, 
            y: Math.round((o.y + dy) * 48) / 48 
          };
        }
        return o;
      });
      
      const moved = next.some((o, i) => o.x !== prev[i].x || o.y !== prev[i].y);
      if (moved) {
        saveToHistory(next);
      }
      return next;
    });
  }, [selectedObjectIds, saveToHistory]);

  const addObjectAt = useCallback((type: DesignObject['type'], subType: string, label: string, x: number, y: number, overrides = {}) => {
    const newObj: DesignObject = {
      id: Math.random().toString(36).substr(2, 9),
      type, subType, x, y, w: 2, h: 2, label, 
      color: '#000000', fillColor: '#ffffff',
      strokeWidth: 2, strokeStyle: 'solid', rotation: 0,
      scaleX: 1, scaleY: 1, isJoined: false, fontSize: 14, isBold: false, stepCount: 10,
      ...overrides
    };
    if (subType === 'pillar') newObj.fillColor = '#000000';
    if (subType === 'door') { newObj.w = 3; newObj.h = currentWallThickness; }
    if (subType === 'window') { newObj.w = 4; newObj.h = currentWallThickness; }
    if (subType === 'double-door') { newObj.w = 6; newObj.h = currentWallThickness; }

    const next = [...designObjects, newObj];
    setDesignObjects(next);
    setSelectedObjectIds([newObj.id]);
    saveToHistory(next);
  }, [designObjects, saveToHistory, currentWallThickness]);

  const addRoomAt = useCallback((x: number, y: number) => {
    const w = 12, h = 10;
    const thickness = currentWallThickness;
    const roomWalls: DesignObject[] = [
      { id: Math.random().toString(36).substr(2, 9), type: 'structure', subType: 'wall', x: x, y: y, w: w, h: thickness, label: 'Wall', color: '#000000', fillColor: '#ffffff', strokeWidth: 2, strokeStyle: 'solid', rotation: 0, isJoined: false },
      { id: Math.random().toString(36).substr(2, 9), type: 'structure', subType: 'wall', x: x, y: y + h, w: w, h: thickness, label: 'Wall', color: '#000000', fillColor: '#ffffff', strokeWidth: 2, strokeStyle: 'solid', rotation: 0, isJoined: false },
      { id: Math.random().toString(36).substr(2, 9), type: 'structure', subType: 'wall', x: x, y: y, w: h, h: thickness, label: 'Wall', color: '#000000', fillColor: '#ffffff', strokeWidth: 2, strokeStyle: 'solid', rotation: 90, isJoined: false },
      { id: Math.random().toString(36).substr(2, 9), type: 'structure', subType: 'wall', x: x + w, y: y, w: h, h: thickness, label: 'Wall', color: '#000000', fillColor: '#ffffff', strokeWidth: 2, strokeStyle: 'solid', rotation: 90, isJoined: false },
    ];
    const next = [...designObjects, ...roomWalls];
    setDesignObjects(next);
    setSelectedObjectIds(roomWalls.map(w => w.id));
    saveToHistory(next);
  }, [designObjects, currentWallThickness, saveToHistory]);

  const loadFromFirestore = useCallback(async () => {
    try {
      const { firestore } = initializeFirebase();
      const docRef = doc(firestore, 'designs', 'current-layout');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.objects) {
          setDesignObjects(data.objects);
          setHistory([data.objects]);
          setHistoryIndex(0);
        }
      }
    } catch (e: any) { console.error(e); }
  }, []);

  useEffect(() => { loadFromFirestore(); }, [loadFromFirestore]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const zoomSpeed = 0.001; 
        setZoom(prev => {
          const newZoom = prev - e.deltaY * zoomSpeed * prev;
          return Math.min(250, Math.max(5, newZoom));
        });
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected();
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        moveSelectedWithArrows(e.key);
      } else if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'z') { e.preventDefault(); undo(); }
        else if (key === 'y') { e.preventDefault(); redo(); }
        else if (key === 'c') { e.preventDefault(); copySelected(); }
        else if (key === 'v') { e.preventDefault(); pasteSelected(); }
        else if (key === 's') { e.preventDefault(); saveToFirestore(); }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [deleteSelected, undo, redo, copySelected, pasteSelected, saveToFirestore, moveSelectedWithArrows]);

  const handleMouseDown = (e: React.MouseEvent, id: string | null) => {
    const container = document.getElementById('canvas-workspace-inner');
    const rect = container?.getBoundingClientRect();
    if (!rect || !container) return;
    const curX = (e.clientX - rect.left - (CANVAS_OFFSET - container.scrollLeft)) / zoom;
    const curY = (e.clientY - rect.top - (CANVAS_OFFSET - container.scrollTop)) / zoom;
    const snappedX = Math.round(curX / ARCH_SNAP) * ARCH_SNAP;
    const snappedY = Math.round(curY / ARCH_SNAP) * ARCH_SNAP;

    if (selectedTool !== 'select' && selectedTool !== 'wall' && !id) {
        if (selectedTool === 'room') {
            addRoomAt(snappedX, snappedY);
        } else if (selectedTool === 'pillar') {
            addObjectAt('pillar', 'pillar', 'Pillar', snappedX, snappedY, { w: 0.83, h: 0.83 });
        } else if (selectedTool === 'door') {
            addObjectAt('opening', 'door', 'Door', snappedX, snappedY, { w: 3, h: currentWallThickness });
        } else if (selectedTool === 'double-door') {
            addObjectAt('opening', 'double-door', 'Double Door', snappedX, snappedY, { w: 6, h: currentWallThickness });
        } else if (selectedTool === 'window') {
            addObjectAt('opening', 'window', 'Window', snappedX, snappedY, { w: 4, h: currentWallThickness });
        } else if (selectedTool === 'stair') {
            addObjectAt('stair', 'stair', 'Stair', snappedX, snappedY, { w: 8, h: 3, stepCount: 10 });
        } else if (selectedTool === 'label') {
            addObjectAt('text', 'label', 'Label', snappedX, snappedY, { textContent: 'Room Name', w: 4, h: 1 });
        }
        setSelectedTool('select');
        return;
    }

    if (selectedTool === 'wall') {
      const start = { x: snappedX, y: snappedY };
      setDrawStart(start); setTempDrawEnd(start); setInteractionMode('drawing'); return;
    }

    if (id) {
      e.stopPropagation();
      const obj = designObjects.find(o => o.id === id);
      let newSelection = (e.ctrlKey || e.metaKey) ? (selectedObjectIds.includes(id) ? selectedObjectIds.filter(sid => sid !== id) : [...selectedObjectIds, id]) : [id];
      setSelectedObjectIds(newSelection);
      
      if (obj) {
        if (obj.isJoined) return; 
        setDragOffsets({ [id]: { x: curX - obj.x, y: curY - obj.y } });
        setInteractionMode('dragging');
      }
    } else {
      if (selectedTool === 'select') {
        setSelectedObjectIds([]);
        setInteractionMode('selecting'); 
        setSelectionBox({ x1: curX, y1: curY, x2: curX, y2: curY });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const container = document.getElementById('canvas-workspace-inner');
    const rect = container?.getBoundingClientRect();
    if (!rect || !container) return;
    const curX = (e.clientX - rect.left - (CANVAS_OFFSET - container.scrollLeft)) / zoom;
    const curY = (e.clientY - rect.top - (CANVAS_OFFSET - container.scrollTop)) / zoom;

    if (interactionMode === 'drawing' && drawStart) {
      let endX = curX, endY = curY;
      if (e.shiftKey || e.ctrlKey) {
        if (Math.abs(curX - drawStart.x) > Math.abs(curY - drawStart.y)) { endY = drawStart.y; } else { endX = drawStart.x; }
      }
      setTempDrawEnd({ x: Math.round(endX / ARCH_SNAP) * ARCH_SNAP, y: Math.round(endY / ARCH_SNAP) * ARCH_SNAP });
      return;
    }

    if (interactionMode === 'selecting' && selectionBox) { 
      setSelectionBox(prev => prev ? { ...prev, x2: curX, y2: curY } : null); 
    }

    if (interactionMode === 'rotating' && firstSelectedObject) {
      if (firstSelectedObject.isJoined) return; 
      const centerX = firstSelectedObject.x + firstSelectedObject.w / 2;
      const centerY = firstSelectedObject.y + firstSelectedObject.h / 2;
      const angle = Math.atan2(curY - centerY, curX - centerX) * (180 / Math.PI);
      updateObject(firstSelectedObject.id, { rotation: Math.round(angle / 15) * 15 });
    }

    if (interactionMode === 'dragging' && selectedObjectIds.length > 0) {
      const mainId = selectedObjectIds[0];
      const mainObj = designObjects.find(o => o.id === mainId);
      if (!mainObj || mainObj.isJoined) return; 
      const mainOffset = dragOffsets[mainId];
      if (!mainOffset) return;
      let targetX = Math.round((curX - mainOffset.x) / ARCH_SNAP) * ARCH_SNAP;
      let targetY = Math.round((curY - mainOffset.y) / ARCH_SNAP) * ARCH_SNAP;
      const dx = targetX - mainObj.x; 
      const dy = targetY - mainObj.y;
      if (dx !== 0 || dy !== 0) {
        setDesignObjects(prev => prev.map(o => {
          if (selectedObjectIds.includes(o.id) && !o.isJoined) {
            return { ...o, x: o.x + dx, y: o.y + dy };
          }
          return o;
        }));
      }
    }
  };

  const handleMouseUp = () => {
    if (interactionMode === 'drawing' && drawStart && tempDrawEnd) {
      const dx = tempDrawEnd.x - drawStart.x, dy = tempDrawEnd.y - drawStart.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0.1) addObjectAt('structure', 'wall', 'Wall', drawStart.x, drawStart.y, { w: len, h: currentWallThickness, rotation: Math.atan2(dy, dx) * (180 / Math.PI) });
      setDrawStart(null); setTempDrawEnd(null);
    } else if (interactionMode === 'selecting' && selectionBox) {
      const xMin = Math.min(selectionBox.x1, selectionBox.x2), xMax = Math.max(selectionBox.x1, selectionBox.x2);
      const yMin = Math.min(selectionBox.y1, selectionBox.y2), yMax = Math.max(selectionBox.y1, selectionBox.y2);
      const inBox = designObjects.filter(obj => obj.x >= xMin && obj.x <= xMax && obj.y >= yMin && obj.y <= yMax).map(o => o.id);
      setSelectedObjectIds(inBox); setSelectionBox(null);
    } else if (interactionMode !== 'none') { 
      saveToHistory(designObjects); 
    }
    setInteractionMode('none');
  };

  const renderPillarDistances = () => {
    const pillars = designObjects.filter(obj => obj.subType === 'pillar');
    if (pillars.length < 2) return null;

    const dimensions: React.ReactNode[] = [];
    const TOLERANCE = 1.0; 

    // Horizontal Distances
    const yGroups: { y: number, items: DesignObject[] }[] = [];
    pillars.forEach(p => {
      let group = yGroups.find(g => Math.abs(g.y - p.y) < TOLERANCE);
      if (group) group.items.push(p);
      else yGroups.push({ y: p.y, items: [p] });
    });

    yGroups.forEach(group => {
      const sorted = [...group.items].sort((a, b) => a.x - b.x);
      for (let i = 0; i < sorted.length - 1; i++) {
        const p1 = sorted[i];
        const p2 = sorted[i+1];
        const c1x = p1.x + p1.w / 2;
        const c2x = p2.x + p2.w / 2;
        const c1y = p1.y + p1.h / 2;
        const centerDist = c2x - c1x;

        if (centerDist > 0.1) {
          dimensions.push(
            <div key={`h-dist-${p1.id}-${p2.id}`} className="absolute pointer-events-none z-20 flex flex-col items-center"
              style={{
                left: c1x * zoom + CANVAS_OFFSET,
                top: (c1y - 1.2) * zoom + CANVAS_OFFSET,
                width: centerDist * zoom,
              }}>
              <div className="w-full h-[1px] bg-red-500 relative flex items-center justify-center">
                <div className="absolute left-0 w-[1px] h-3 bg-red-500 -translate-y-1/2" />
                <div className="absolute right-0 w-[1px] h-3 bg-red-500 -translate-y-1/2" />
                <div className="bg-white px-1 text-[9px] font-bold text-red-600 border border-red-200 shadow-sm rounded-sm whitespace-nowrap -translate-y-4">
                  {formatFeetInches(centerDist)}
                </div>
              </div>
            </div>
          );
        }
      }
    });

    // Vertical Distances
    const xGroups: { x: number, items: DesignObject[] }[] = [];
    pillars.forEach(p => {
      let group = xGroups.find(g => Math.abs(g.x - p.x) < TOLERANCE);
      if (group) group.items.push(p);
      else xGroups.push({ x: p.x, items: [p] });
    });

    xGroups.forEach(group => {
      const sorted = [...group.items].sort((a, b) => a.y - b.y);
      for (let i = 0; i < sorted.length - 1; i++) {
        const p1 = sorted[i];
        const p2 = sorted[i+1];
        const c1x = p1.x + p1.w / 2;
        const c1y = p1.y + p1.h / 2;
        const c2y = p2.y + p2.h / 2;
        const centerDist = c2y - c1y;

        if (centerDist > 0.1) {
          dimensions.push(
            <div key={`v-dist-${p1.id}-${p2.id}`} className="absolute pointer-events-none z-20 flex items-center"
              style={{
                left: (c1x - 1.2) * zoom + CANVAS_OFFSET,
                top: c1y * zoom + CANVAS_OFFSET,
                height: centerDist * zoom,
              }}>
              <div className="h-full w-[1px] bg-red-500 relative flex items-center justify-center">
                <div className="absolute top-0 h-[1px] w-3 bg-red-500 -translate-x-1/2" />
                <div className="absolute bottom-0 h-[1px] w-3 bg-red-500 -translate-x-1/2" />
                <div className="bg-white px-1 text-[9px] font-bold text-red-600 border border-red-200 shadow-sm rounded-sm whitespace-nowrap -translate-x-10 rotate-90">
                  {formatFeetInches(centerDist)}
                </div>
              </div>
            </div>
          );
        }
      }
    });

    return dimensions;
  };

  const Ruler = ({ orientation }: { orientation: 'horizontal' | 'vertical' }) => {
    const steps = 4; const count = 100; const ticks = []; for (let i = 0; i < count; i++) ticks.push(i);
    return (
      <div className={cn("bg-slate-50 border-slate-200 overflow-hidden", orientation === 'horizontal' ? "h-8 border-b w-full relative shrink-0" : "w-8 border-r h-full relative shrink-0")}>
        {ticks.map(t => (
          <div key={t} className="absolute overflow-visible" style={
            orientation === 'horizontal' ? { left: t * steps * zoom + CANVAS_OFFSET, top: 0 } : { top: t * steps * zoom + CANVAS_OFFSET, left: 0 }
          }>
            <div className={cn("bg-slate-400", orientation === 'horizontal' ? "w-[1px] h-3" : "h-[1px] w-3")} />
            <span className={cn("text-[9px] font-bold text-slate-500 absolute", orientation === 'horizontal' ? "top-3 -translate-x-1/2" : "left-3 -translate-y-1/2")}>
              {t * steps}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const renderObjectContent = (obj: DesignObject) => {
    const isOpening = obj.type === 'opening';
    const isText = obj.type === 'text' || obj.subType === 'label';
    const strokeW = 1 / zoom;
    
    if (isOpening) {
      return (
        <svg width="100%" height="100%" viewBox={`0 0 ${obj.w} ${obj.h}`} preserveAspectRatio="none" className="overflow-visible pointer-events-none">
          {/* The "Gap" effect: Solid white background that covers the wall underneath */}
          <rect x="0" y="0" width={obj.w} height={obj.h} fill="white" stroke="none" />
          
          {obj.subType === 'window' && (
            <g>
              {/* Window frame and internal lines consistent with architectural style */}
              <rect x="0" y="0" width={obj.w} height={obj.h} fill="white" stroke={obj.color} strokeWidth={strokeW * 3} />
              <line x1="0" y1={obj.h * 0.25} x2={obj.w} y2={obj.h * 0.25} stroke={obj.color} strokeWidth={strokeW * 1.5} />
              <line x1="0" y1={obj.h * 0.75} x2={obj.w} y2={obj.h * 0.75} stroke={obj.color} strokeWidth={strokeW * 1.5} />
            </g>
          )}
          {obj.subType === 'door' && (
            <g>
              {/* Door leaf (the solid line) */}
              <line x1="0" y1={obj.h} x2="0" y2={obj.h - obj.w} stroke={obj.color} strokeWidth={strokeW * 4} />
              {/* Swing arc */}
              <path d={`M 0 ${obj.h - obj.w} A ${obj.w} ${obj.w} 0 0 1 ${obj.w} ${obj.h}`} fill="none" stroke={obj.color} strokeWidth={strokeW * 2} strokeDasharray={`${strokeW*3},${strokeW*3}`} />
              {/* Edges of the wall gap */}
              <line x1="0" y1="0" x2="0" y2={obj.h} stroke={obj.color} strokeWidth={strokeW} />
              <line x1={obj.w} y1="0" x2={obj.w} y2={obj.h} stroke={obj.color} strokeWidth={strokeW} />
            </g>
          )}
          {obj.subType === 'double-door' && (
            <g>
              {/* Left Leaf */}
              <line x1="0" y1={obj.h} x2="0" y2={obj.h - obj.w/2} stroke={obj.color} strokeWidth={strokeW * 4} />
              <path d={`M 0 ${obj.h - obj.w/2} A ${obj.w/2} ${obj.w/2} 0 0 1 ${obj.w/2} ${obj.h}`} fill="none" stroke={obj.color} strokeWidth={strokeW * 2} strokeDasharray={`${strokeW*3},${strokeW*3}`} />
              {/* Right Leaf */}
              <line x1={obj.w} y1={obj.h} x2={obj.w} y2={obj.h - obj.w/2} stroke={obj.color} strokeWidth={strokeW * 4} />
              <path d={`M ${obj.w} ${obj.h - obj.w/2} A ${obj.w/2} ${obj.w/2} 0 0 0 ${obj.w/2} ${obj.h}`} fill="none" stroke={obj.color} strokeWidth={strokeW * 2} strokeDasharray={`${strokeW*3},${strokeW*3}`} />
              {/* Edges */}
              <line x1="0" y1="0" x2="0" y2={obj.h} stroke={obj.color} strokeWidth={strokeW} />
              <line x1={obj.w} y1="0" x2={obj.w} y2={obj.h} stroke={obj.color} strokeWidth={strokeW} />
            </g>
          )}
        </svg>
      );
    }

    if (isText) {
      return (
        <div className="w-full h-full flex items-center justify-center p-1 pointer-events-none" 
          style={{ color: obj.color, fontSize: (obj.fontSize || 14) * (zoom/40), fontWeight: obj.isBold ? 'bold' : 'normal' }}>
          {obj.textContent || obj.label}
        </div>
      );
    }

    return null;
  };

  const getObjectStyle = (obj: DesignObject) => {
    let xOffset = 0;
    let yOffset = 0;
    
    // Vertical alignment fix: Ensures X=0 starts at the ruler mark and expands right
    if (obj.rotation === 90) xOffset = obj.h;
    else if (obj.rotation === 180) { xOffset = obj.w; yOffset = obj.h; }
    else if (obj.rotation === 270) yOffset = obj.w;

    return { 
      left: (obj.x + xOffset) * zoom + CANVAS_OFFSET, 
      top: (obj.y + yOffset) * zoom + CANVAS_OFFSET, 
      width: obj.w * zoom, height: obj.h * zoom, transformOrigin: '0 0', 
      transform: `rotate(${obj.rotation}deg)`, 
      backgroundColor: (obj.subType === 'wall' || obj.subType === 'pillar') ? obj.color : 'transparent',
      outline: selectedObjectIds.includes(obj.id) ? '2px solid #3b82f6' : 'none',
      cursor: obj.isJoined ? 'not-allowed' : 'move',
      zIndex: selectedObjectIds.includes(obj.id) ? 100 : (obj.type === 'opening' ? 50 : 10)
    };
  };

  return (
    <div className="w-full h-screen bg-slate-100 flex flex-col overflow-hidden font-body text-slate-900">
      <div className="h-10 bg-slate-800 border-b flex items-center px-4 justify-between shrink-0 text-white z-50">
        <div className="flex items-center gap-6 h-full">
          <div className="flex items-center gap-2 pr-4 border-r border-slate-700">
            <Building className="w-5 h-5 text-blue-400" />
            <span className="font-bold text-xs uppercase tracking-tighter">Architectural Pro Studio</span>
          </div>
          <nav className="flex gap-1 h-full">
            {['File', 'Home', 'Design'].map(item => (
              <Button key={item} variant="ghost" onClick={() => setActiveRibbonTab(item.toLowerCase())}
                className={cn("h-10 px-6 text-[11px] font-bold rounded-none border-b-2", activeRibbonTab === item.toLowerCase() ? "bg-slate-700 text-white border-blue-400" : "text-slate-400 border-transparent")}>{item}</Button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
           <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white" onClick={saveToFirestore}><Save className="w-4 h-4 mr-2"/> SAVE</Button>
           <User className="w-5 h-5 text-slate-400" />
        </div>
      </div>

      <div className="h-16 bg-white border-b flex items-center px-4 gap-0 shrink-0 shadow-sm z-40 overflow-x-auto">
        <div className="flex items-center border-r px-2 h-full gap-1">
          <RibbonButton icon={<Undo2 />} label="Undo" onClick={undo} />
          <RibbonButton icon={<Redo2 />} label="Redo" onClick={redo} />
        </div>
        <div className="flex items-center border-r px-2 h-full gap-1">
          <RibbonButton icon={<CopyIcon />} label="Copy" onClick={copySelected} />
          <RibbonButton icon={<ClipboardIcon />} label="Paste" onClick={pasteSelected} />
        </div>
        <div className="flex items-center border-r px-2 h-full gap-1">
          <RibbonButton icon={<Pencil />} label="Wall" active={selectedTool === 'wall'} onClick={() => setSelectedTool('wall')} />
          <RibbonButton icon={<Square />} label="Room" active={selectedTool === 'room'} onClick={() => setSelectedTool('room')} />
          <RibbonButton icon={<PillarIcon />} label="Pillar" active={selectedTool === 'pillar'} onClick={() => setSelectedTool('pillar')} />
          <RibbonButton icon={<SplitSquareVertical />} label="Stair" active={selectedTool === 'stair'} onClick={() => setSelectedTool('stair')} />
          <RibbonButton icon={<TypeIcon />} label="Label" active={selectedTool === 'label'} onClick={() => setSelectedTool('label')} />
        </div>
        <div className="flex items-center border-r px-2 h-full gap-2">
          <Button variant="outline" size="sm" className="gap-2 h-9 px-4 text-destructive" onClick={deleteSelected}><Trash2 className="w-4 h-4" /> Delete</Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        <div className="w-[200px] bg-slate-50 border-r z-30 shrink-0 flex flex-col shadow-inner">
          <div className="p-2 border-b bg-slate-100 font-bold text-[10px] uppercase tracking-widest text-slate-500">Toolbox</div>
          <ScrollArea className="flex-1 p-3 space-y-4">
            <SymbolButton active={selectedTool === 'select'} icon={<MousePointer2 />} label="Select" onClick={() => setSelectedTool('select')} />
            
            <div className="pt-4 border-t space-y-2">
              <Label className="text-[10px] font-bold text-slate-400 uppercase">Dimensions</Label>
              <div className="flex items-center justify-between bg-white p-2 rounded border border-slate-200">
                <span className="text-[11px] font-medium text-slate-600">Show Dimensions</span>
                <Checkbox checked={showDimensions} onCheckedChange={(val) => setShowDimensions(!!val)} />
              </div>
            </div>

            <div className="pt-4 border-t space-y-2">
              <Label className="text-[10px] font-bold text-slate-400 uppercase">Openings</Label>
              <div className="grid grid-cols-2 gap-2">
                <SymbolButton active={selectedTool === 'door'} icon={<DoorOpen />} label="Door" onClick={() => setSelectedTool('door')} />
                <SymbolButton active={selectedTool === 'double-door'} icon={<LayoutGrid />} label="Double Door" onClick={() => setSelectedTool('double-door')} />
                <SymbolButton active={selectedTool === 'window'} icon={<Wind />} label="Window" onClick={() => setSelectedTool('window')} />
              </div>
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 relative flex flex-col bg-slate-200 overflow-hidden">
          <Ruler orientation="horizontal" />
          <div className="flex-1 flex overflow-hidden">
            <Ruler orientation="vertical" />
            <div id="canvas-workspace-inner" className="flex-1 relative bg-white overflow-auto cursor-crosshair"
              onMouseDown={(e) => handleMouseDown(e, null)} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
              <div className="absolute inset-0" style={{ 
                  backgroundImage: `linear-gradient(#f1f5f9 1px, transparent 1px), linear-gradient(90deg, #f1f5f9 1px, transparent 1px)`,
                  backgroundSize: `${zoom}px ${zoom}px`, backgroundPosition: `${CANVAS_OFFSET}px ${CANVAS_OFFSET}px`, width: 10000, height: 10000
                }}>
                
                {renderPillarDistances()}

                {designObjects.map(obj => (
                  <div key={obj.id} onMouseDown={(e) => handleMouseDown(e, obj.id)}
                    className={cn("absolute", selectedObjectIds.includes(obj.id) ? "z-30" : "z-10")}
                    style={getObjectStyle(obj)}>
                    
                    {renderObjectContent(obj)}

                    {selectedObjectIds.includes(obj.id) && !obj.isJoined && (
                       <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-8 h-8 bg-white border border-slate-300 rounded-full flex items-center justify-center cursor-alias shadow-sm hover:bg-slate-50 transition-colors z-[60]"
                         onMouseDown={(e) => { e.stopPropagation(); setInteractionMode('rotating'); }}>
                         <RotateCw className="w-4 h-4 text-blue-500" />
                       </div>
                    )}

                    {showDimensions && (
                      <>
                        <div className="absolute -top-8 left-0 right-0 flex items-center justify-between pointer-events-none z-[50]">
                           <div className="w-[1.5px] h-4 bg-slate-500" />
                           <div className="flex-1 h-[1px] bg-slate-400 mx-0.5 relative flex items-center justify-center">
                              <div className="bg-white/95 px-2 py-0.5 rounded-sm border border-slate-400 shadow-sm flex items-center gap-1.5">
                                 <span className="text-[10px] font-black text-slate-900 whitespace-nowrap">{formatFeetInches(obj.w)}</span>
                              </div>
                           </div>
                           <div className="w-[1.5px] h-4 bg-slate-500" />
                        </div>

                        <div className="absolute top-0 bottom-0 -right-10 flex flex-col items-center justify-between pointer-events-none z-[50]">
                           <div className="h-[1.5px] w-4 bg-slate-500" />
                           <div className="flex-1 w-[1px] bg-slate-400 my-0.5 relative flex flex-col items-center justify-center">
                              <div className="bg-white/95 px-2 py-0.5 rounded-sm border border-slate-400 shadow-sm flex flex-col items-center rotate-90">
                                 <span className="text-[10px] font-black text-slate-900 whitespace-nowrap">{formatFeetInches(obj.h)}</span>
                              </div>
                           </div>
                           <div className="h-[1.5px] w-4 bg-slate-500" />
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {interactionMode === 'drawing' && drawStart && tempDrawEnd && (
                  <div className="absolute bg-blue-500/20 pointer-events-none z-50 border-2 border-blue-500 border-dashed"
                    style={{
                      left: drawStart.x * zoom + CANVAS_OFFSET, top: drawStart.y * zoom + CANVAS_OFFSET,
                      width: Math.sqrt(Math.pow(tempDrawEnd.x - drawStart.x, 2) + Math.pow(tempDrawEnd.y - drawStart.y, 2)) * zoom,
                      height: currentWallThickness * zoom, transformOrigin: '0 0', transform: `rotate(${Math.atan2(tempDrawEnd.y - drawStart.y, tempDrawEnd.x - drawStart.x) * (180 / Math.PI)}deg)`,
                    }}
                  />
                )}
                {interactionMode === 'selecting' && selectionBox && (
                  <div className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none z-[70]"
                    style={{
                      left: Math.min(selectionBox.x1, selectionBox.x2) * zoom + CANVAS_OFFSET,
                      top: Math.min(selectionBox.y1, selectionBox.y2) * zoom + CANVAS_OFFSET,
                      width: Math.abs(selectionBox.x2 - selectionBox.x1) * zoom,
                      height: Math.abs(selectionBox.y2 - selectionBox.y1) * zoom
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="h-8 bg-white border-t flex items-center px-4 justify-between shrink-0 z-40">
            <div className="flex items-center gap-4">
              <ZoomOut className="w-3.5 h-3.5 text-slate-400 cursor-pointer" onClick={() => setZoom(z => Math.max(5, z - 5))} />
              <Slider value={[zoom]} max={250} min={5} step={1} className="w-32" onValueChange={(val) => setZoom(val[0])} />
              <ZoomIn className="w-3.5 h-3.5 text-slate-400 cursor-pointer" onClick={() => setZoom(z => Math.min(250, z + 5))} />
              <span className="text-[9px] font-bold text-slate-400 uppercase ml-2">{Math.round(zoom)}%</span>
            </div>
          </div>

          <div className="h-14 bg-white border-t flex items-center px-4 gap-6 shrink-0 z-40 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] overflow-x-auto no-scrollbar">
            {firstSelectedObject ? (
              <div className="flex items-center gap-6 min-w-max">
                <div className="flex items-center gap-2 pr-4 border-r shrink-0">
                   <Switch checked={firstSelectedObject.isJoined} onCheckedChange={(val) => updateObject(firstSelectedObject.id, { isJoined: val }, true)} className="scale-75" />
                   <span className="text-[9px] font-bold text-slate-500 uppercase">সংযুক্ত (Lock)</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <PropField label="X" value={localPropX} onChange={setLocalPropX} onBlur={() => updateObject(firstSelectedObject.id, { x: parseFeetInches(localPropX) }, true)} disabled={firstSelectedObject.isJoined} />
                  <PropField label="Y" value={localPropY} onChange={setLocalPropY} onBlur={() => updateObject(firstSelectedObject.id, { y: parseFeetInches(localPropY) }, true)} disabled={firstSelectedObject.isJoined} />
                  <PropField 
                    label={firstSelectedObject.subType === 'wall' ? "L (দৈর্ঘ্য)" : "W (দৈর্ঘ্য)"} 
                    value={localPropW} onChange={setLocalPropW} 
                    onBlur={() => updateObject(firstSelectedObject.id, { w: parseFeetInches(localPropW) }, true)} 
                    disabled={firstSelectedObject.isJoined}
                  />
                  <PropField 
                    label={firstSelectedObject.subType === 'wall' ? "T (পুরুত্ব)" : "H (প্রস্থ)"} 
                    value={localPropH} onChange={setLocalPropH} 
                    onBlur={() => updateObject(firstSelectedObject.id, { h: parseFeetInches(localPropH) }, true)} 
                    disabled={firstSelectedObject.isJoined}
                  />
                  <PropField 
                    label="কোণ (°)" 
                    value={localPropRot} onChange={setLocalPropRot} 
                    onBlur={() => updateObject(firstSelectedObject.id, { rotation: parseInt(localPropRot) || 0 }, true)} 
                    disabled={firstSelectedObject.isJoined} 
                  />
                </div>
                <div className="flex items-center gap-4 shrink-0 min-w-[120px]">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">ঘুরান</span>
                  <Slider value={[firstSelectedObject.rotation]} max={360} min={0} step={1} className="w-24" disabled={firstSelectedObject.isJoined} onValueChange={(v) => updateObject(firstSelectedObject.id, { rotation: v[0] })} />
                </div>
                {(firstSelectedObject.type === 'text' || firstSelectedObject.subType === 'label') && (
                  <div className="flex items-center gap-2 border-l pl-4 shrink-0 w-[200px]">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">লেখা</span>
                    <Input className="h-8 text-[11px] w-full bg-slate-50 border-slate-200" placeholder="Type here..." value={firstSelectedObject.textContent || ""} 
                      onChange={(e) => updateObject(firstSelectedObject.id, { textContent: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); saveToHistory(designObjects); } }}
                      onBlur={() => saveToHistory(designObjects)} />
                  </div>
                )}
                <div className="flex items-center gap-1.5 border-l pl-4 shrink-0">
                  {COLORS.map(c => (
                    <div key={c} onClick={() => updateObject(firstSelectedObject.id, { color: c, fillColor: c === '#ffffff' ? '#ffffff' : c }, true)}
                      className={cn("w-5 h-5 rounded-full cursor-pointer border shadow-sm transition-transform hover:scale-110", firstSelectedObject.color === c ? "ring-2 ring-blue-500 ring-offset-1" : "border-slate-200")}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center w-full text-slate-300 italic text-[10px] uppercase tracking-widest font-medium">অবজেক্ট সিলেক্ট করুন</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RibbonButton({ icon, label, onClick, active }: { icon: React.ReactNode, label: string, onClick: () => void, active?: boolean }) {
  return (
    <Button variant="ghost" className={cn("h-14 flex flex-col gap-1 px-3 transition-all hover:bg-slate-50", active && "bg-slate-100 text-blue-600")} onClick={onClick}>
      {React.cloneElement(icon as React.ReactElement, { className: "w-4.5 h-4.5" })}
      <span className="text-[9px] uppercase font-bold tracking-tight">{label}</span>
    </Button>
  );
}

function SymbolButton({ icon, label, onClick, active }: { icon: React.ReactNode, label: string, onClick: () => void, active?: boolean }) {
  return (
    <div onClick={onClick} className={cn("flex items-center gap-2 p-2 rounded-md cursor-pointer border transition-all", 
      active ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:border-slate-300")}>
      {React.cloneElement(icon as React.ReactElement, { className: "w-4 h-4" })}
      <span className="text-[10px] font-bold uppercase">{label}</span>
    </div>
  );
}

function PropField({ label, value, onChange, onBlur, disabled }: { label: string, value: string, onChange: (v: string) => void, onBlur: () => void, disabled?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-black text-slate-300 uppercase shrink-0 min-w-[50px]">{label}</span>
      <Input className="h-7 w-20 text-[11px] font-bold text-center border-slate-200 focus:ring-1 p-1" value={value} 
        onChange={e => onChange(e.target.value)} 
        disabled={disabled}
        onBlur={onBlur} 
        onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); } }} />
    </div>
  );
}
