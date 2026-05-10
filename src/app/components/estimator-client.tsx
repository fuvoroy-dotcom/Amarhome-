
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
  Link, Link2, Unlink, ArrowUpRight, SplitSquareVertical
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

export default function EstimatorClient() {
  const { toast } = useToast();
  const [designObjects, setDesignObjects] = useState<DesignObject[]>([]);
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [interactionMode, setInteractionMode] = useState<'none' | 'dragging' | 'resizing' | 'rotating' | 'drawing'>('none');
  const [selectedTool, setSelectedTool] = useState<'select' | 'shape' | 'line' | 'text' | 'wall' | 'opening' | 'symbol' | 'pillar' | 'stair' | 'room'>('select');
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

  const firstSelectedObject = useMemo(() => designObjects.find(obj => obj.id === selectedObjectIds[0]), [designObjects, selectedObjectIds]);

  useEffect(() => {
    if (firstSelectedObject) {
      setLocalPropX(formatFeetInches(firstSelectedObject.x));
      setLocalPropY(formatFeetInches(firstSelectedObject.y));
      setLocalPropW(formatFeetInches(firstSelectedObject.w));
      setLocalPropH(formatFeetInches(firstSelectedObject.h));
    }
  }, [firstSelectedObject]);

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
    let minDist = 0.8; 

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

      if (obj.subType === 'wall' || obj.type === 'stair') {
        const p1 = { x: obj.x, y: obj.y };
        const p2 = { x: obj.x + obj.w * cos, y: obj.y + obj.w * sin };
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq > 0) {
          const t = Math.max(0, Math.min(1, ((x - p1.x) * dx + (y - p1.y) * dy) / lenSq));
          const cp = { x: p1.x + t * dx, y: p1.y + t * dy };
          const d = Math.sqrt(Math.pow(x - cp.x, 2) + Math.pow(y - cp.y, 2));
          if (d < minDist) {
            minDist = d;
            bestSnap = cp;
          }
        }
      }
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
        if (dist < 1.5) {
          connected.add(other.id);
          stack.push(other.id);
          return;
        }

        if (curr.subType.includes('wall') || other.subType.includes('wall') || curr.type === 'stair' || other.type === 'stair') {
          const checkNear = (objA: DesignObject, objB: DesignObject) => {
            const rad = (objA.rotation || 0) * (Math.PI / 180);
            const p1 = { x: objA.x, y: objA.y };
            const p2 = { x: objA.x + objA.w * Math.cos(rad), y: objA.y + objA.w * Math.sin(rad) };
            const pm = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            
            const pointsToCheck = [p1, p2, pm];
            let found = false;
            pointsToCheck.forEach(pt => {
              const bRad = (objB.rotation || 0) * (Math.PI / 180);
              const b1 = { x: objB.x, y: objB.y };
              const b2 = { x: objB.x + objB.w * Math.cos(bRad), y: objB.y + objB.w * Math.sin(bRad) };
              const bdx = b2.x - b1.x;
              const bdy = b2.y - b1.y;
              const blenSq = bdx * bdx + bdy * bdy;
              if (blenSq > 0) {
                const t = Math.max(0, Math.min(1, ((pt.x - b1.x) * bdx + (pt.y - b1.y) * bdy) / blenSq));
                const proj = { x: b1.x + t * bdx, y: b1.y + t * bdy };
                if (Math.sqrt(Math.pow(pt.x - proj.x, 2) + Math.pow(pt.y - proj.y, 2)) < 0.8) found = true;
              }
            });
            return found;
          };
          if (checkNear(curr, other) || checkNear(other, curr)) {
            connected.add(other.id);
            stack.push(other.id);
          }
        }
      });
    }
    return Array.from(connected);
  }, []);

  const addObject = useCallback((type: DesignObject['type'], subType: string, label: string, overrides = {}) => {
    const newObj: DesignObject = {
      id: Math.random().toString(36).substr(2, 9),
      type, subType, x: 10, y: 10, w: 2, h: 2, label, 
      color: '#000000', fillColor: subType === 'pillar' ? '#64748b' : '#ffffff',
      strokeWidth: 2, strokeStyle: 'solid', rotation: 0,
      isJoined: true, 
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
      { id: Math.random().toString(36).substr(2, 9), type: 'structure', subType: 'wall', x: startX, y: startY, w: w, h: thickness, label: 'Wall', color: '#000000', fillColor: '#ffffff', strokeWidth: 2, strokeStyle: 'solid', rotation: 0, isJoined: true },
      { id: Math.random().toString(36).substr(2, 9), type: 'structure', subType: 'wall', x: startX, y: startY + h, w: w, h: thickness, label: 'Wall', color: '#000000', fillColor: '#ffffff', strokeWidth: 2, strokeStyle: 'solid', rotation: 0, isJoined: true },
      { id: Math.random().toString(36).substr(2, 9), type: 'structure', subType: 'wall', x: startX, y: startY, w: h, h: thickness, label: 'Wall', color: '#000000', fillColor: '#ffffff', strokeWidth: 2, strokeStyle: 'solid', rotation: 90, isJoined: true },
      { id: Math.random().toString(36).substr(2, 9), type: 'structure', subType: 'wall', x: startX + w, y: startY, w: h, h: thickness, label: 'Wall', color: '#000000', fillColor: '#ffffff', strokeWidth: 2, strokeStyle: 'solid', rotation: 90, isJoined: true },
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

  const handleMouseDown = (e: React.MouseEvent, id: string | null) => {
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

    if (selectedTool === 'stair') {
      const snap = findSnapPoint(curX, curY);
      const pos = snap || { x: curX, y: curY };
      addObject('stair', 'stair', 'Stair', { x: pos.x, y: pos.y, w: 6, h: 3, stepCount: 10 });
      setSelectedTool('select');
      return;
    }

    if (id) {
      e.stopPropagation();
      let newSelection = [...selectedObjectIds];
      
      if (e.ctrlKey || e.metaKey) {
        if (newSelection.includes(id)) {
          newSelection = newSelection.filter(sid => sid !== id);
        } else {
          newSelection.push(id);
        }
      } else {
        if (!newSelection.includes(id)) {
          newSelection = [id];
        }
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
      if (!e.ctrlKey && !e.metaKey) {
        setSelectedObjectIds([]);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = document.getElementById('canvas-workspace')?.getBoundingClientRect();
    if (!rect) return;
    const curX = (e.clientX - rect.left) / zoom;
    const curY = (e.clientY - rect.top) / zoom;

    if (interactionMode === 'drawing' && drawStart) {
      let endX = curX;
      let endY = curY;
      
      if (e.ctrlKey || e.metaKey) {
        const dx = Math.abs(curX - drawStart.x);
        const dy = Math.abs(curY - drawStart.y);
        if (dx > dy) endY = drawStart.y;
        else endX = drawStart.x;
      }
      
      const snap = findSnapPoint(endX, endY);
      setTempDrawEnd(snap || { x: Math.round(endX * 20) / 20, y: Math.round(endY * 20) / 20 });
      setSnapPoint(snap);
      return;
    }

    if (interactionMode === 'dragging' && selectedObjectIds.length > 0) {
      const group = Object.keys(dragOffsets);
      const mainId = selectedObjectIds[0];
      const mainOffset = dragOffsets[mainId];
      
      if (!mainOffset) return;
      
      const potentialX = curX - mainOffset.x;
      const potentialY = curY - mainOffset.y;
      
      const snap = findSnapPoint(potentialX, potentialY, group);
      const targetX = snap ? snap.x : Math.round(potentialX * 20) / 20;
      const targetY = snap ? snap.y : Math.round(potentialY * 20) / 20;
      
      const mainObj = designObjects.find(o => o.id === mainId);
      if (!mainObj) return;
      
      const dx = targetX - mainObj.x;
      const dy = targetY - mainObj.y;
      
      setDesignObjects(prev => prev.map(o => group.includes(o.id) ? { ...o, x: o.x + dx, y: o.y + dy } : o));
      setSnapPoint(snap);
    }

    if (interactionMode === 'resizing' && selectedObjectIds.length === 1) {
      const id = selectedObjectIds[0];
      const curr = designObjects.find(o => o.id === id);
      if (!curr) return;
      const nextW = Math.max(0.1, curX - curr.x);
      const nextH = Math.max(0.1, curY - curr.y);
      setDesignObjects(prev => prev.map(o => o.id === id ? { ...o, w: nextW, h: nextH } : o));
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

  const copyObjects = useCallback(() => {
    if (selectedObjectIds.length > 0) {
      const toCopy = designObjects.filter(o => selectedObjectIds.includes(o.id));
      setClipboard(toCopy.map(o => ({...o})));
      toast({ title: "Copy", description: `${selectedObjectIds.length}টি অবজেক্ট কপি করা হয়েছে।` });
    }
  }, [selectedObjectIds, designObjects, toast]);

  const pasteObjects = useCallback(() => {
    if (clipboard.length > 0) {
      const newIds: string[] = [];
      const pasted = clipboard.map(obj => {
        const id = Math.random().toString(36).substr(2, 9);
        newIds.push(id);
        return { ...obj, id, x: obj.x + 1, y: obj.y + 1 };
      });
      const next = [...designObjects, ...pasted];
      setDesignObjects(next);
      setSelectedObjectIds(newIds);
      saveToHistory(next);
      toast({ title: "Paste", description: `${clipboard.length}টি অবজেক্ট পেস্ট করা হয়েছে।` });
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
      } else {
        toast({ title: "তথ্য নেই", description: "সেভ করা কোনো ডিজাইন পাওয়া যায়নি।" });
      }
    } catch (e: any) {
      const permissionError = new FirestorePermissionError({
        path: 'designs/current-layout',
        operation: 'get',
      } satisfies SecurityRuleContext);
      errorEmitter.emit('permission-error', permissionError);
    }
  };

  const pillarDistances = useMemo(() => {
    const pillars = designObjects.filter(o => o.type === 'pillar');
    const distances: {x1: number, y1: number, x2: number, y2: number, dist: string, horizontal: boolean}[] = [];
    
    pillars.forEach((p1, i) => {
      pillars.forEach((p2, j) => {
        if (i >= j) return;
        const dx = Math.abs((p1.x + p1.w/2) - (p2.x + p2.w/2));
        const dy = Math.abs((p1.y + p1.h/2) - (p2.y + p2.h/2));
        
        if (dy < 0.8 && dx > 1) {
          distances.push({
            x1: p1.x + p1.w/2, y1: p1.y + p1.h/2,
            x2: p2.x + p2.w/2, y2: p2.y + p2.h/2,
            dist: formatFeetInches(dx), horizontal: true
          });
        }
        if (dx < 0.8 && dy > 1) {
          distances.push({
            x1: p1.x + p1.w/2, y1: p1.y + p1.h/2,
            x2: p2.x + p2.w/2, y2: p2.y + p2.h/2,
            dist: formatFeetInches(dy), horizontal: false
          });
        }
      });
    });
    return distances;
  }, [designObjects]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return;
      
      const moveStep = 0.05; 
      
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault(); copyObjects();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault(); pasteObjects();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault(); undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault(); redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault(); saveToFirestore();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteObjects();
      }

      if (selectedObjectIds.length > 0) {
        const group = getConnectedGroup(selectedObjectIds, designObjects);
        let dx = 0, dy = 0;
        if (e.key === 'ArrowUp') dy = -moveStep;
        if (e.key === 'ArrowDown') dy = moveStep;
        if (e.key === 'ArrowLeft') dx = -moveStep;
        if (e.key === 'ArrowRight') dx = moveStep;

        if (dx !== 0 || dy !== 0) {
          e.preventDefault();
          setDesignObjects(prev => prev.map(o => group.includes(o.id) ? { ...o, x: o.x + dx, y: o.y + dy } : o));
          saveToHistory(designObjects);
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY;
        setZoom(prev => {
          const nextZoom = delta > 0 ? prev - 2 : prev + 2;
          return Math.min(150, Math.max(10, nextZoom));
        });
      }
    };

    window.addEventListener('keydown', handleKey);
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [selectedObjectIds, copyObjects, pasteObjects, undo, redo, deleteObjects, designObjects, getConnectedGroup, saveToHistory, saveToFirestore]);

  return (
    <div className="w-full mx-auto p-0 bg-slate-100 min-h-screen flex flex-col overflow-hidden font-body text-slate-900">
      {/* Header */}
      <div className="h-10 bg-slate-800 border-b flex items-center px-4 justify-between shrink-0 text-white">
        <div className="flex items-center gap-6 h-full">
          <div className="flex items-center gap-2 pr-4 border-r border-slate-700">
            <Building className="w-5 h-5 text-blue-400" />
            <span className="font-bold text-xs tracking-tighter uppercase">Architectural Pro Studio</span>
          </div>
          <div className="flex items-center gap-2 px-4 border-r border-slate-700">
            <span className="text-[10px] text-slate-400 font-mono tracking-wider">birganj-pouro-high-74409-9ca38</span>
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
          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Move: 0.05" | Ctrl+S: Save | Ctrl+Wheel: Zoom</span>
          <User className="w-5 h-5 text-slate-400 cursor-pointer hover:text-white" />
        </div>
      </div>

      {/* Ribbon */}
      <div className="h-24 bg-white border-b flex items-center px-4 gap-0 shrink-0 shadow-sm z-30">
        {activeRibbonTab === 'file' && (
           <div className="flex items-center h-full px-2 gap-1">
              <RibbonButton icon={<Save />} label="Save (Ctrl+S)" onClick={saveToFirestore} />
              <RibbonButton icon={<FolderOpen />} label="Open Saved" onClick={loadFromFirestore} />
              <RibbonButton icon={<FilePlus />} label="New Project" onClick={() => { setDesignObjects([]); saveToHistory([]); }} />
              <RibbonButton icon={<Printer />} label="Print Design" onClick={() => window.print()} />
           </div>
        )}
        {activeRibbonTab === 'home' && (
          <>
            <div className="flex items-center border-r px-3 h-full gap-1">
              <RibbonButton icon={<Undo2 />} label="Undo" onClick={undo} />
              <RibbonButton icon={<Redo2 />} label="Redo" onClick={redo} />
            </div>
            <div className="flex items-center border-r px-3 h-full gap-1">
              <RibbonButton icon={<CopyIcon />} label="Copy" onClick={copyObjects} />
              <RibbonButton icon={<ClipboardIcon />} label="Paste" onClick={pasteObjects} />
            </div>
            <div className="flex items-center border-r px-3 h-full gap-2">
              <Select value={firstSelectedObject?.fontSize?.toString() || "14"} onValueChange={(v) => selectedObjectIds.length > 0 && updateObject(selectedObjectIds[0], { fontSize: parseInt(v) }, true)}>
                <SelectTrigger className="h-8 w-24 text-[11px]"><SelectValue placeholder="Size" /></SelectTrigger>
                <SelectContent>{FONT_SIZES.map(s => <SelectItem key={s} value={s.toString()}>{s}pt</SelectItem>)}</SelectContent>
              </Select>
              <div className="flex gap-1">
                 <Button variant={firstSelectedObject?.isBold ? "secondary" : "ghost"} size="icon" className="h-8 w-8 border" onClick={() => selectedObjectIds.length > 0 && updateObject(selectedObjectIds[0], { isBold: !firstSelectedObject?.isBold }, true)}><Bold className="w-4 h-4" /></Button>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 border p-0"><PaintBucket className="w-4 h-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent className="p-2 grid grid-cols-5 gap-1">
                      {COLORS.map(c => <div key={c} onClick={() => selectedObjectIds.length > 0 && updateObject(selectedObjectIds[0], { color: c, fillColor: c }, true)} className="w-6 h-6 rounded border cursor-pointer hover:scale-110" style={{ backgroundColor: c }} />)}
                    </DropdownMenuContent>
                 </DropdownMenu>
              </div>
            </div>
            <RibbonButton icon={<Trash2 />} label="Delete" variant="destructive" onClick={deleteObjects} />
          </>
        )}
        {activeRibbonTab === 'design' && (
          <div className="flex items-center h-full px-2 gap-2">
            <RibbonButton icon={<Square />} label="Add Room" onClick={addRoom} />
            <RibbonButton icon={<Pencil />} label="Add Wall" active={selectedTool === 'wall'} onClick={() => setSelectedTool('wall')} />
            <RibbonButton icon={<PillarIcon />} label="Add Pillar" active={selectedTool === 'pillar'} onClick={() => setSelectedTool('pillar')} />
            <RibbonButton icon={<ArrowUpRight />} label="Add Stair" active={selectedTool === 'stair'} onClick={() => setSelectedTool('stair')} />
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
                <ToolCard icon={<Square />} label="Room" onClick={addRoom} />
                <ToolCard icon={<Pencil />} label="Wall" active={selectedTool === 'wall'} onClick={() => setSelectedTool('wall')} />
                <ToolCard icon={<PillarIcon />} label="Column" active={selectedTool === 'pillar'} onClick={() => setSelectedTool('pillar')} />
                <ToolCard icon={<ArrowUpRight />} label="Stair" active={selectedTool === 'stair'} onClick={() => setSelectedTool('stair')} />
              </div>
              <Accordion type="multiple" defaultValue={["openings", "advanced"]} className="w-full">
                <AccordionItem value="openings" className="border-none">
                  <AccordionTrigger className="h-10 px-0 text-[10px] font-bold text-slate-400 uppercase">Openings</AccordionTrigger>
                  <AccordionContent className="grid grid-cols-2 gap-3">
                    <SymbolButton icon={<DoorOpen />} label="Door" onClick={() => addObject('opening', 'door', 'Door', { w: 3, h: 0.33 })} />
                    <SymbolButton icon={<Wind />} label="Window" onClick={() => addObject('opening', 'window', 'Window', { w: 4, h: 0.33 })} />
                    <SymbolButton icon={<SplitSquareVertical />} label="Double Door" onClick={() => addObject('opening', 'door_double', 'Double Door', { w: 6, h: 0.33 })} />
                    <SymbolButton icon={<Move />} label="Sliding Door" onClick={() => addObject('opening', 'door_sliding', 'Sliding Door', { w: 5, h: 0.33 })} />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="advanced" className="border-none">
                  <AccordionTrigger className="h-10 px-0 text-[10px] font-bold text-slate-400 uppercase">Advanced Symbols</AccordionTrigger>
                  <AccordionContent className="grid grid-cols-2 gap-3">
                    <SymbolButton icon={<Layers />} label="Bifold Door" onClick={() => addObject('opening', 'door_bifold', 'Bifold Door', { w: 4, h: 0.33 })} />
                    <SymbolButton icon={<Grid />} label="Sliding Window" onClick={() => addObject('opening', 'window_sliding', 'Sliding Window', { w: 4, h: 0.33 })} />
                    <SymbolButton icon={<RectangleHorizontal />} label="Fixed Window" onClick={() => addObject('opening', 'window_fixed', 'Fixed Window', { w: 3, h: 0.33 })} />
                    <SymbolButton icon={<Circle />} label="Circular Pillar" onClick={() => addObject('pillar', 'pillar_round', 'Round Pillar', { w: 0.8, h: 0.8 })} />
                    <SymbolButton icon={<TypeIcon />} label="Text" onClick={() => setSelectedTool('text')} />
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
              {showDimensions && pillarDistances.map((d, i) => (
                <div key={`dist-${i}`} className="absolute pointer-events-none z-0" style={{
                  left: Math.min(d.x1, d.x2) * zoom,
                  top: Math.min(d.y1, d.y2) * zoom,
                  width: d.horizontal ? Math.abs(d.x2 - d.x1) * zoom : 2,
                  height: d.horizontal ? 2 : Math.abs(d.y2 - d.y1) * zoom,
                  backgroundColor: 'rgba(59, 130, 246, 0.4)',
                }}>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 py-1 border border-blue-300 rounded text-[11px] font-bold text-blue-600 shadow-md whitespace-nowrap">
                    {d.dist}
                  </div>
                </div>
              ))}

              {designObjects.map(obj => (
                <div key={obj.id} onMouseDown={(e) => handleMouseDown(e, obj.id)}
                  className={cn("absolute flex items-center justify-center transition-shadow", 
                    selectedObjectIds.includes(obj.id) ? "z-30 ring-2 ring-blue-500 shadow-2xl" : "z-10")}
                  style={{ 
                    left: obj.x * zoom, top: obj.y * zoom, width: obj.w * zoom, height: obj.h * zoom, 
                    transformOrigin: '0 0', transform: `rotate(${obj.rotation}deg)`,
                    backgroundColor: (obj.type === 'opening' || obj.type === 'stair') ? 'white' : (obj.type === 'pillar' ? obj.fillColor : (obj.subType === 'wall' ? obj.color : 'transparent')),
                    border: (obj.subType === 'wall' || obj.type === 'opening') ? 'none' : `2px solid ${obj.color}`,
                    borderRadius: (obj.subType === 'pillar_round' || obj.subType === 'oval') ? '100%' : '0px'
                  }}>
                  
                  {/* Side-Aligned Dimension Labels */}
                  {showDimensions && (obj.subType === 'wall' || obj.type === 'stair' || obj.type === 'opening') && (
                    <div className="absolute left-1/2 -translate-x-1/2 -top-10 bg-white/90 px-1.5 py-0.5 rounded border border-slate-300 shadow-md pointer-events-none z-50">
                      <span className="text-[10px] font-bold text-slate-800 whitespace-nowrap">{formatFeetInches(obj.w)}</span>
                    </div>
                  )}

                  {obj.type === 'opening' && (
                    <div className="relative w-full h-full bg-white">
                      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0">
                        {obj.subType === 'door' && (
                          <>
                            <line x1="0" y1="100" x2="0" y2="0" stroke={obj.color} strokeWidth="6" />
                            <path d="M 0 0 A 100 100 0 0 1 100 100" fill="none" stroke={obj.color} strokeWidth="3" strokeDasharray="4 2" />
                          </>
                        )}
                        {obj.subType === 'door_double' && (
                          <>
                            <line x1="0" y1="100" x2="0" y2="50" stroke={obj.color} strokeWidth="6" />
                            <line x1="100" y1="100" x2="100" y2="50" stroke={obj.color} strokeWidth="6" />
                            <path d="M 0 50 A 50 50 0 0 1 50 100" fill="none" stroke={obj.color} strokeWidth="3" strokeDasharray="4 2" />
                            <path d="M 100 50 A 50 50 0 0 0 50 100" fill="none" stroke={obj.color} strokeWidth="3" strokeDasharray="4 2" />
                          </>
                        )}
                        {obj.subType === 'door_sliding' && (
                          <>
                             <rect x="0" y="20" width="60" height="20" fill={obj.color} fillOpacity="0.2" stroke={obj.color} strokeWidth="2" />
                             <rect x="40" y="60" width="60" height="20" fill={obj.color} fillOpacity="0.2" stroke={obj.color} strokeWidth="2" />
                             <line x1="10" y1="30" x2="30" y2="30" stroke={obj.color} strokeWidth="1" />
                          </>
                        )}
                        {obj.subType === 'door_bifold' && (
                          <>
                             <line x1="0" y1="100" x2="25" y2="20" stroke={obj.color} strokeWidth="4" />
                             <line x1="25" y1="20" x2="50" y2="100" stroke={obj.color} strokeWidth="4" />
                             <line x1="50" y1="100" x2="75" y2="20" stroke={obj.color} strokeWidth="4" />
                             <line x1="75" y1="20" x2="100" y2="100" stroke={obj.color} strokeWidth="4" />
                          </>
                        )}
                        {obj.subType === 'window' && (
                          <>
                            <line x1="0" y1="0" x2="0" y2="100" stroke={obj.color} strokeWidth="8" />
                            <line x1="100" y1="0" x2="100" y2="100" stroke={obj.color} strokeWidth="8" />
                            <line x1="0" y1="50" x2="100" y2="50" stroke={obj.color} strokeWidth="2" />
                            <line x1="0" y1="30" x2="100" y2="30" stroke={obj.color} strokeWidth="1" opacity="0.5" />
                            <line x1="0" y1="70" x2="100" y2="70" stroke={obj.color} strokeWidth="1" opacity="0.5" />
                          </>
                        )}
                        {obj.subType === 'window_sliding' && (
                          <>
                            <rect x="0" y="10" width="100" height="80" fill="none" stroke={obj.color} strokeWidth="2" />
                            <line x1="50" y1="10" x2="50" y2="90" stroke={obj.color} strokeWidth="4" />
                            <line x1="10" y1="50" x2="40" y2="50" stroke={obj.color} strokeWidth="1" />
                            <line x1="60" y1="50" x2="90" y2="50" stroke={obj.color} strokeWidth="1" />
                          </>
                        )}
                        {obj.subType === 'window_fixed' && (
                          <>
                            <rect x="0" y="25" width="100" height="50" fill="none" stroke={obj.color} strokeWidth="4" />
                            <line x1="0" y1="50" x2="100" y2="50" stroke={obj.color} strokeWidth="2" />
                          </>
                        )}
                      </svg>
                    </div>
                  )}

                  {obj.type === 'stair' && (
                    <div className="w-full h-full relative border flex flex-col justify-between overflow-hidden">
                       <div className="absolute inset-0 flex flex-col justify-between opacity-50">
                          {Array.from({ length: obj.stepCount || 10 }).map((_, i) => (
                            <div key={i} className="w-full h-[1px] bg-slate-400" />
                          ))}
                       </div>
                       <div className="absolute bottom-2 right-2 text-slate-400 opacity-60">
                          <ArrowUpRight className="w-4 h-4" />
                       </div>
                    </div>
                  )}
                  {obj.type === 'pillar' && <div className="w-full h-full opacity-30 bg-slate-900/10" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.1) 5px, rgba(0,0,0,0.1) 10px)' }} />}
                  {obj.type === 'text' && (
                    <span className={cn("text-center px-1 whitespace-nowrap", obj.isBold && "font-bold")} style={{ color: obj.color, fontSize: obj.fontSize }}>{obj.textContent || obj.label}</span>
                  )}
                  {selectedObjectIds.length === 1 && selectedObjectIds[0] === obj.id && (
                    <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 rounded-full cursor-se-resize z-40 border-2 border-white shadow-lg" 
                      onMouseDown={(e) => handleMouseDown(e, obj.id)} />
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
                <div className="absolute w-20 h-20 bg-blue-500/30 rounded-full border-4 border-blue-600 z-50 pointer-events-none shadow-[0_0_60px_rgba(37,99,235,1)] animate-pulse"
                  style={{ left: snapPoint.x * zoom - 40, top: snapPoint.y * zoom - 40 }} />
              )}
            </div>
          </div>
          <div className="h-10 bg-white border-t flex items-center px-4 justify-between shrink-0 shadow-inner">
             <div className="flex items-center gap-4">
                <div className="flex items-center gap-2"><ZoomOut className="w-4 h-4 text-slate-400" /><Slider value={[zoom]} max={150} min={10} step={2} className="w-40" onValueChange={(val) => setZoom(val[0])} /><ZoomIn className="w-4 h-4 text-slate-400" /></div>
                <span className="text-[10px] font-bold text-slate-500">{zoom}% Precision</span>
             </div>
             <div className="flex items-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span>Arrow Keys: 0.05"</span>
                <span>Ctrl+S: Save Design</span>
                <span>Ctrl+Wheel: Zoom Canvas (2%)</span>
                <span>Ctrl Drawing: Straight Wall</span>
             </div>
          </div>
        </div>

        {/* Inspector Panel */}
        <div className="w-[240px] bg-white border-l z-20 shrink-0 flex flex-col shadow-xl">
           <div className="p-3 border-b bg-slate-50 flex items-center justify-between"><span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Inspector</span><Settings2 className="w-4 h-4 text-slate-400" /></div>
           <ScrollArea className="flex-1 p-3">
              <Accordion type="multiple" defaultValue={["dims", "props"]} className="w-full">
                <AccordionItem value="dims" className="border-none mb-4">
                  <AccordionTrigger className="h-8 px-0 text-[10px] font-bold text-slate-400 uppercase hover:no-underline">Dimensions & Area</AccordionTrigger>
                  <AccordionContent className="pt-2">
                    <div className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-100">
                      <Label className="text-[11px] font-medium text-slate-700 flex items-center gap-2">
                        <Ruler className="w-3.5 h-3.5 text-slate-400" />
                        Show Dimensions
                      </Label>
                      <Switch 
                        checked={showDimensions} 
                        onCheckedChange={setShowDimensions}
                        className="scale-75"
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {firstSelectedObject ? (
                  <AccordionItem value="props" className="border-none">
                    <AccordionTrigger className="h-8 px-0 text-[10px] font-bold text-slate-400 uppercase hover:no-underline">Object Properties</AccordionTrigger>
                    <AccordionContent className="pt-2 space-y-4">
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 space-y-2 shadow-sm">
                         <div className="flex items-center justify-between">
                            <Label className="text-[10px] font-bold text-blue-800 uppercase flex items-center gap-1.5">
                               {firstSelectedObject.isJoined ? <Link2 className="w-3.5 h-3.5 text-blue-600" /> : <Unlink className="w-3.5 h-3.5 text-slate-400" />}
                               সংযুক্ত করুন
                            </Label>
                            <Switch 
                              checked={firstSelectedObject.isJoined} 
                              onCheckedChange={(val) => updateObject(selectedObjectIds[0], { isJoined: val }, true)}
                            />
                         </div>
                         <p className="text-[9px] text-blue-600 leading-tight font-medium">
                           টিক দিলে এটি গ্রুপের সাথে মুভ করবে।
                         </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                         <PropInput label="X Pos" value={localPropX} onChange={setLocalPropX} onBlur={() => updateObject(selectedObjectIds[0], { x: parseFeetInches(localPropX) }, true)} />
                         <PropInput label="Y Pos" value={localPropY} onChange={setLocalPropY} onBlur={() => updateObject(selectedObjectIds[0], { y: parseFeetInches(localPropY) }, true)} />
                         <PropInput label="Width" value={localPropW} onChange={setLocalPropW} onBlur={() => updateObject(selectedObjectIds[0], { w: parseFeetInches(localPropW) }, true)} />
                         <PropInput label="Height" value={localPropH} onChange={setLocalPropH} onBlur={() => updateObject(selectedObjectIds[0], { h: parseFeetInches(localPropH) }, true)} />
                      </div>

                      <div className="space-y-1.5">
                         <Label className="text-[9px] font-bold text-slate-400 uppercase">Rotation (°)</Label>
                         <div className="flex items-center gap-2">
                            <Slider value={[firstSelectedObject.rotation]} max={360} min={0} step={1} className="flex-1" onValueChange={(v) => updateObject(selectedObjectIds[0], { rotation: v[0] }, true)} />
                            <Input type="number" className="h-7 w-12 text-[10px] px-1" value={firstSelectedObject.rotation} onChange={(e) => updateObject(selectedObjectIds[0], { rotation: parseInt(e.target.value) || 0 }, true)} />
                         </div>
                      </div>

                      {firstSelectedObject.type === 'stair' && (
                         <div className="space-y-1.5">
                            <Label className="text-[9px] font-bold text-slate-400 uppercase">Steps</Label>
                            <Input type="number" className="h-7 text-[10px]" value={firstSelectedObject.stepCount} onChange={(e) => updateObject(selectedObjectIds[0], { stepCount: parseInt(e.target.value) || 0 }, true)} />
                         </div>
                      )}

                      {(firstSelectedObject.subType.includes('wall') || firstSelectedObject.type === 'opening') && (
                         <div className="space-y-1.5">
                            <Label className="text-[9px] font-bold text-slate-400 uppercase">Thickness</Label>
                            <Select value={firstSelectedObject.h.toString()} onValueChange={(v) => updateObject(selectedObjectIds[0], { h: parseFloat(v) }, true)}>
                              <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0.25">3 inches</SelectItem>
                                <SelectItem value="0.33">4 inches</SelectItem>
                                <SelectItem value="0.42">5 inches</SelectItem>
                                <SelectItem value="0.83">10 inches</SelectItem>
                              </SelectContent>
                            </Select>
                         </div>
                      )}

                      {firstSelectedObject.type === 'text' && (
                         <div className="space-y-1.5">
                            <Label className="text-[9px] font-bold text-slate-400 uppercase">Label Text</Label>
                            <Input className="h-7 text-[10px]" value={firstSelectedObject.textContent || ""} onChange={(e) => updateObject(selectedObjectIds[0], { textContent: e.target.value }, true)} />
                         </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-center opacity-20">
                    <MousePointer2 className="w-8 h-8 mb-4" />
                    <p className="text-[9px] font-bold uppercase tracking-widest">Select element</p>
                  </div>
                )}
              </Accordion>
           </ScrollArea>
        </div>
      </div>
    </div>
  );
}

function PropInput({ label, value, onChange, onBlur }: { label: string, value: string, onChange: (v: string) => void, onBlur: () => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-[9px] font-bold text-slate-400 uppercase">{label}</Label>
      <Input 
        className="h-7 text-[10px] px-2 bg-slate-50 focus:bg-white" 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        onBlur={onBlur} 
        placeholder="0' 0\" 
      />
    </div>
  );
}

function ToolCard({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <div onClick={onClick} className={cn("flex flex-col items-center justify-center p-2.5 rounded-lg cursor-pointer transition-all border shadow-sm",
      active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50")}>
       {React.cloneElement(icon as React.ReactElement, { className: "w-4 h-4 mb-1.5" })}
       <span className="text-[9px] font-bold uppercase tracking-tighter">{label}</span>
    </div>
  );
}

function SymbolButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) {
  return (
    <Button variant="outline" onClick={onClick} className="w-full flex flex-col items-center justify-center gap-1.5 h-16 p-3 bg-white hover:bg-slate-50 group shadow-sm">
       {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5 text-slate-400 group-hover:text-blue-500" })}
       <span className="text-[9px] font-bold text-slate-500 uppercase">{label}</span>
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
