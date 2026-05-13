
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
    const feet = Math.floor(Math.abs(val));
    const inches = Math.round((Math.abs(val) - feet) * 12);
    if (feet === 0 && inches === 0) return "0'";
    if (feet === 0) return `${inches}"`;
    if (inches === 0) return `${feet}'`;
    if (inches === 12) return `${feet + 1}'`;
    return `${feet}' ${inches}"`;
  };

  const parseFeetInches = (str: string) => {
    if (!str || str.trim() === "") return 0;
    const s = str.trim();
    
    // Match "X' Y\""
    const matchFull = s.match(/(\d+)'\s*(\d+)"/);
    if (matchFull) return parseInt(matchFull[1]) + parseInt(matchFull[2]) / 12;
    
    // Match "X'"
    const matchFeet = s.match(/^(\d+)'$/);
    if (matchFeet) return parseInt(matchFeet[1]);
    
    // Match "X\""
    const matchInches = s.match(/^(\d+)"$/);
    if (matchInches) return parseInt(matchInches[1]) / 12;
    
    // Fallback to plain number as feet
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
        if (dist < 1) {
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
                if (Math.sqrt(Math.pow(pt.x - proj.x, 2) + Math.pow(pt.y - proj.y, 2)) < 0.5) found = true;
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

  const copyAsImage = async () => {
    const workspace = document.getElementById('canvas-workspace-inner');
    if (!workspace) return;
    
    toast({ title: "প্রক্রিয়াধীন", description: "ইমেজ জেনারেট করা হচ্ছে..." });
    
    try {
      let options: any = {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      };

      if (selectedObjectIds.length > 0) {
        const selectedObjects = designObjects.filter(o => selectedObjectIds.includes(o.id));
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        selectedObjects.forEach(obj => {
          const rad = (obj.rotation || 0) * (Math.PI / 180);
          const points = [
            { x: obj.x, y: obj.y },
            { x: obj.x + obj.w * Math.cos(rad), y: obj.y + obj.w * Math.sin(rad) },
            { x: obj.x + obj.h * Math.sin(rad), y: obj.y - obj.h * Math.cos(rad) },
            { x: obj.x + obj.w * Math.cos(rad) + obj.h * Math.sin(rad), y: obj.y + obj.w * Math.sin(rad) - obj.h * Math.cos(rad) }
          ];
          points.forEach(p => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
          });
        });

        const padding = 1; 
        options.x = (minX - padding) * zoom;
        options.y = (minY - padding) * zoom;
        options.width = (maxX - minX + padding * 2) * zoom;
        options.height = (maxY - minY + padding * 2) * zoom;
      }

      const canvas = await html2canvas(workspace, options);
      
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          const item = new ClipboardItem({ "image/png": blob });
          await navigator.clipboard.write([item]);
          toast({ title: "সফল", description: selectedObjectIds.length > 0 ? "নির্বাচিত অংশটি ক্লিপবোর্ডে কপি করা হয়েছে।" : "সম্পূর্ণ ড্রয়িংটি ক্লিপবোর্ডে কপি করা হয়েছে।" });
        } catch (err) {
          console.error(err);
          toast({ variant: "destructive", title: "ত্রুটি", description: "ইমেজ ক্লিপবোর্ডে কপি করা যায়নি।" });
        }
      });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "ত্রুটি", description: "ইমেজ তৈরি করতে সমস্যা হয়েছে।" });
    }
  };

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

  // Auto-load saved design on mount
  useEffect(() => {
    loadFromFirestore();
  }, []);

  const handleMouseDown = (e: React.MouseEvent, id: string | null) => {
    const container = document.getElementById('canvas-workspace-inner');
    const rect = container?.getBoundingClientRect();
    if (!rect || !container) return;
    
    const curX = (e.clientX - rect.left) / zoom;
    const curY = (e.clientY - rect.top) / zoom;

    if (selectedTool === 'wall') {
      const snap = findSnapPoint(curX, curY);
      const start = snap || { x: Math.round(curX / ARCH_SNAP) * ARCH_SNAP, y: Math.round(curY / ARCH_SNAP) * ARCH_SNAP };
      setDrawStart(start);
      setTempDrawEnd(start);
      setInteractionMode('drawing');
      return;
    }

    const symbolTools = ['door', 'window', 'door_double', 'door_sliding', 'door_bifold', 'window_sliding', 'window_fixed', 'pillar_round', 'pillar', 'stair', 'text'];
    if (symbolTools.includes(selectedTool)) {
      const snap = findSnapPoint(curX, curY);
      const pos = snap || { x: curX, y: curY };
      
      let type: DesignObject['type'] = 'opening';
      let subType = selectedTool;
      let label = 'Opening';
      let w = 3, h = currentWallThickness;
      
      if (selectedTool === 'pillar' || selectedTool === 'pillar_round') {
        type = 'pillar';
        subType = selectedTool === 'pillar' ? 'pillar' : 'pillar_round';
        label = selectedTool === 'pillar' ? 'Column' : 'Round Pillar';
        w = 0.83; h = 0.83; // 10 inch pillars
      } else if (selectedTool === 'stair') {
        type = 'stair';
        subType = 'stair';
        label = 'Stair';
        w = 6; h = 3;
      } else if (selectedTool === 'text') {
        type = 'text';
        subType = 'text';
        label = 'Label';
        w = 4; h = 1;
      } else if (selectedTool.includes('window')) {
        label = 'Window';
        w = 4;
      } else if (selectedTool === 'door_double') {
        label = 'Double Door';
        w = 6;
      } else if (selectedTool === 'door_sliding') {
        label = 'Sliding Door';
        w = 5;
      } else if (selectedTool === 'door_bifold') {
        label = 'Bifold Door';
        w = 4;
      }
      
      const finalX = (type === 'pillar') ? pos.x - w/2 : pos.x;
      const finalY = (type === 'pillar') ? pos.y - h/2 : pos.y;
      
      addObject(type, subType, label, { 
        x: Math.round(finalX / ARCH_SNAP) * ARCH_SNAP, 
        y: Math.round(finalY / ARCH_SNAP) * ARCH_SNAP, 
        w, h 
      });
      setSelectedTool('select');
      return;
    }

    if (id) {
      e.stopPropagation();
      let newSelection = [...selectedObjectIds];
      
      if (e.ctrlKey || e.metaKey) {
        if (newSelection.includes(id)) {
          setShouldCloneOnMove(true);
        } else {
          newSelection.push(id);
          setShouldCloneOnMove(true);
        }
      } else {
        if (!newSelection.includes(id)) {
          newSelection = [id];
        }
        setShouldCloneOnMove(false);
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
      setShouldCloneOnMove(false);
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
      setTempDrawEnd(snap || { x: Math.round(endX / ARCH_SNAP) * ARCH_SNAP, y: Math.round(endY / ARCH_SNAP) * ARCH_SNAP });
      setSnapPoint(snap);
      return;
    }

    if (interactionMode === 'selecting' && selectionBox) {
      setSelectionBox(prev => prev ? { ...prev, x2: curX, y2: curY } : null);
      return;
    }

    if (interactionMode === 'dragging' && selectedObjectIds.length > 0) {
      if ((e.ctrlKey || e.metaKey) && shouldCloneOnMove) {
        const group = getConnectedGroup(selectedObjectIds, designObjects);
        const clones = group.map(sid => {
          const original = designObjects.find(o => o.id === sid);
          if (!original) return null;
          return {
            ...original,
            id: Math.random().toString(36).substr(2, 9),
            x: original.x,
            y: original.y
          };
        }).filter(Boolean) as DesignObject[];

        if (clones.length > 0) {
          const nextObjects = [...designObjects, ...clones];
          setDesignObjects(nextObjects);
          const cloneIds = clones.map(c => c.id);
          setSelectedObjectIds(cloneIds);
          
          const newOffsets: { [id: string]: { x: number, y: number } } = {};
          clones.forEach(c => {
             newOffsets[c.id] = { x: curX - c.x, y: curY - c.y };
          });
          setDragOffsets(newOffsets);
          setShouldCloneOnMove(false);
          return;
        }
      }

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

    if (interactionMode === 'resizing' && selectedObjectIds.length === 1) {
      const id = selectedObjectIds[0];
      const curr = designObjects.find(o => o.id === id);
      if (!curr) return;
      const nextW = Math.max(ARCH_SNAP, Math.round((curX - curr.x) / ARCH_SNAP) * ARCH_SNAP);
      const nextH = Math.max(ARCH_SNAP, Math.round((curY - curr.y) / ARCH_SNAP) * ARCH_SNAP);
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
    } else if (interactionMode === 'selecting' && selectionBox) {
      const xMin = Math.min(selectionBox.x1, selectionBox.x2);
      const xMax = Math.max(selectionBox.x1, selectionBox.x2);
      const yMin = Math.min(selectionBox.y1, selectionBox.y2);
      const yMax = Math.max(selectionBox.y1, selectionBox.y2);

      const inBox = designObjects.filter(obj => 
        obj.x >= xMin && (obj.x + obj.w) <= xMax &&
        obj.y >= yMin && (obj.y + obj.h) <= yMax
      ).map(o => o.id);

      setSelectedObjectIds(inBox);
      setSelectionBox(null);
    } else if (interactionMode !== 'none') {
      saveToHistory(designObjects);
    }
    setInteractionMode('none');
    setSnapPoint(null);
    setShouldCloneOnMove(false);
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

  const pillarDistances = useMemo(() => {
    if (!showDimensions) return [];
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
  }, [designObjects, showDimensions]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return;
      
      const moveStep = ARCH_SNAP; 
      
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelectedObjectIds(designObjects.map(o => o.id));
        return;
      }
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

  const Ruler = ({ orientation }: { orientation: 'horizontal' | 'vertical' }) => {
    const steps = 4;
    const count = 50;
    const ticks = [];
    for (let i = 0; i < count; i++) {
      ticks.push(i);
    }
    return (
      <div className={cn("bg-slate-50 border-slate-200 overflow-hidden", 
        orientation === 'horizontal' ? "h-8 border-b w-full relative" : "w-8 border-r h-full relative")}>
        {ticks.map(t => (
          <div key={t} className="absolute flex flex-col items-center justify-start overflow-visible" style={
            orientation === 'horizontal' ? { left: t * steps * zoom, top: 0, width: zoom * 4 } : { top: t * steps * zoom, left: 0, height: zoom * 4 }
          }>
            <div className={cn("bg-slate-400", orientation === 'horizontal' ? "w-[1px] h-3" : "h-[1px] w-3")} />
            <span className="text-[9px] font-bold text-slate-500 mt-0.5">{t * steps}</span>
            {orientation === 'horizontal' && (
              <div className="absolute top-0 flex gap-0" style={{ left: '0' }}>
                 {[1,2,3].map(st => <div key={st} className="w-[1px] h-1.5 bg-slate-300" style={{ marginLeft: zoom - 1 }} />)}
              </div>
            )}
            {orientation === 'vertical' && (
              <div className="absolute left-0 flex flex-col gap-0" style={{ top: '0' }}>
                 {[1,2,3].map(st => <div key={st} className="h-[1px] w-1.5 bg-slate-300" style={{ marginTop: zoom - 1 }} />)}
              </div>
            )}
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
          <div className="flex items-center gap-4 h-full">
            <Button variant="ghost" className="h-10 rounded-none hover:bg-slate-700 px-3"><MenuIcon className="w-4 h-4" /></Button>
            <div className="flex items-center gap-2 bg-slate-700 h-7 px-3 rounded text-[11px] font-bold">
               <span>Page 1</span>
               <ChevronDown className="w-3 h-3 text-slate-400" />
            </div>
            <Button variant="ghost" className="h-7 w-7 p-0 bg-slate-700 hover:bg-slate-600 rounded"><Plus className="w-4 h-4" /></Button>
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
          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Snap: 0.25" | Ctrl+S: Save | Ctrl+Wheel: Zoom</span>
          <User className="w-5 h-5 text-slate-400 cursor-pointer hover:text-white" />
        </div>
      </div>

      <div className="h-24 bg-white border-b flex items-center px-4 gap-0 shrink-0 shadow-sm z-30">
        {activeRibbonTab === 'file' && (
           <div className="flex items-center h-full px-2 gap-1">
              <RibbonButton icon={<Save />} label="Save (Ctrl+S)" onClick={saveToFirestore} />
              <RibbonButton icon={<ImageIcon />} label="Copy as Image" onClick={copyAsImage} />
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
        <div className="w-[280px] bg-slate-50 border-r z-20 shrink-0 flex flex-col shadow-inner">
          <div className="p-3 border-b bg-slate-100 flex items-center justify-between"><span className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">Toolbox</span><Settings className="w-4 h-4 text-slate-400" /></div>
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
                    <SymbolButton icon={<DoorOpen />} label="Door" active={selectedTool === 'door'} onClick={() => setSelectedTool('door')} />
                    <SymbolButton icon={<Wind />} label="Window" active={selectedTool === 'window'} onClick={() => setSelectedTool('window')} />
                    <SymbolButton icon={<SplitSquareVertical />} label="Double Door" active={selectedTool === 'door_double'} onClick={() => setSelectedTool('door_double')} />
                    <SymbolButton icon={<Move />} label="Sliding Door" active={selectedTool === 'door_sliding'} onClick={() => setSelectedTool('door_sliding')} />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="advanced" className="border-none">
                  <AccordionTrigger className="h-10 px-0 text-[10px] font-bold text-slate-400 uppercase">Advanced Symbols</AccordionTrigger>
                  <AccordionContent className="grid grid-cols-2 gap-3">
                    <SymbolButton icon={<Layers />} label="Bifold Door" active={selectedTool === 'door_bifold'} onClick={() => setSelectedTool('door_bifold')} />
                    <SymbolButton icon={<Grid />} label="Sliding Window" active={selectedTool === 'window_sliding'} onClick={() => setSelectedTool('window_sliding')} />
                    <SymbolButton icon={<RectangleHorizontal />} label="Fixed Window" active={selectedTool === 'window_fixed'} onClick={() => setSelectedTool('window_fixed')} />
                    <SymbolButton icon={<Circle />} label="Circular Pillar" active={selectedTool === 'pillar_round'} onClick={() => setSelectedTool('pillar_round')} />
                    <SymbolButton icon={<TypeIcon />} label="Text" active={selectedTool === 'text'} onClick={() => setSelectedTool('text')} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
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
                    backgroundSize: `${zoom}px ${zoom}px`, width: 4000, height: 4000
                  }}>
                  
                  {interactionMode === 'selecting' && selectionBox && (
                    <div className="absolute border border-blue-500 bg-blue-500/10 z-[100]" style={{
                      left: Math.min(selectionBox.x1, selectionBox.x2) * zoom,
                      top: Math.min(selectionBox.y1, selectionBox.y2) * zoom,
                      width: Math.abs(selectionBox.x2 - selectionBox.x1) * zoom,
                      height: Math.abs(selectionBox.y2 - selectionBox.y1) * zoom,
                    }} />
                  )}

                  {showDimensions && pillarDistances.map((d, i) => (
                    <div key={`dist-${i}`} className="absolute pointer-events-none z-0" style={{
                      left: Math.min(d.x1, d.x2) * zoom,
                      top: Math.min(d.y1, d.y2) * zoom,
                      width: d.horizontal ? Math.abs(d.x2 - d.x1) * zoom : 2,
                      height: d.horizontal ? 2 : Math.abs(d.y2 - d.y1) * zoom,
                      backgroundColor: 'rgba(59, 130, 246, 0.4)',
                    }}>
                      <div className={cn("absolute bg-white px-2 py-1 border border-blue-300 rounded text-[11px] font-bold text-blue-600 shadow-md whitespace-nowrap",
                        d.horizontal ? "top-full mt-1 left-1/2 -translate-x-1/2" : "left-full ml-1 top-1/2 -translate-y-1/2")}>
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
                        transformOrigin: '0 0', 
                        transform: `rotate(${obj.rotation}deg) scale(${obj.scaleX || 1}, ${obj.scaleY || 1})`,
                        backgroundColor: (obj.type === 'opening' || obj.type === 'stair') ? 'white' : (obj.type === 'pillar' ? obj.fillColor : (obj.subType === 'wall' ? obj.color : 'transparent')),
                        border: (obj.subType === 'wall' || obj.type === 'opening') ? 'none' : `2px solid ${obj.color}`,
                        borderRadius: (obj.subType === 'pillar_round' || obj.subType === 'oval') ? '100%' : '0px'
                      }}>
                      
                      {showDimensions && (obj.subType === 'wall' || obj.type === 'stair' || obj.type === 'opening') && (
                        <div className={cn("absolute left-1/2 -translate-x-1/2 bg-white/95 px-1.5 py-0.5 rounded border border-slate-300 shadow-sm pointer-events-none z-50", 
                            (() => {
                              const norm = (obj.rotation % 360 + 360) % 360;
                              if (norm >= 45 && norm < 135) return "left-full ml-2"; // 90 deg -> Right
                              if (norm >= 135 && norm < 225) return "top-full mt-2"; // 180 deg -> Bottom
                              if (norm >= 225 && norm < 315) return "left-full ml-2"; // 270 deg -> Right
                              return "top-full mt-2"; // 0 deg -> Bottom
                            })()
                          )}>
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
                        <div className="w-full h-full relative border flex overflow-hidden">
                           <div className="flex-1 border-r flex flex-col justify-between">
                              {Array.from({ length: Math.ceil((obj.stepCount || 10) / 2) }).map((_, i) => (
                                <div key={i} className="w-full h-[1px] bg-slate-400" />
                              ))}
                           </div>
                           <div className="flex-1 flex flex-col justify-between">
                              {Array.from({ length: Math.floor((obj.stepCount || 10) / 2) }).map((_, i) => (
                                <div key={i} className="w-full h-[1px] bg-slate-400" />
                              ))}
                           </div>
                           <div className="absolute left-1/2 -translate-x-1/2 h-full w-[2px] bg-slate-300" />
                           <div className="absolute bottom-2 right-2 text-slate-400 opacity-60">
                              <ArrowUpRight className="w-4 h-4" />
                           </div>
                        </div>
                      )}
                      {obj.type === 'pillar' && (
                        <div className="w-full h-full relative overflow-hidden" style={{ backgroundColor: obj.subType === 'pillar_round' ? 'transparent' : obj.fillColor }}>
                          {obj.subType === 'pillar_round' && (
                            <svg width="100%" height="100%" viewBox="0 0 100 100">
                               <circle cx="50" cy="50" r="48" fill={obj.fillColor === '#ffffff' ? 'none' : obj.fillColor} stroke={obj.color} strokeWidth="4" />
                               <line x1="15" y1="15" x2="85" y2="85" stroke={obj.color} strokeWidth="2" />
                               <line x1="85" y1="15" x2="15" y2="85" stroke={obj.color} strokeWidth="2" />
                            </svg>
                          )}
                          {obj.subType === 'pillar' && <div className="w-full h-full" style={{ backgroundColor: obj.fillColor }} />}
                        </div>
                      )}
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
            </div>
          </div>
          <div className="h-10 bg-white border-t flex items-center px-4 justify-between shrink-0 shadow-inner">
             <div className="flex items-center gap-4">
                <div className="flex items-center gap-2"><ZoomOut className="w-4 h-4 text-slate-400" /><Slider value={[zoom]} max={150} min={10} step={2} className="w-40" onValueChange={(val) => setZoom(val[0])} /><ZoomIn className="w-4 h-4 text-slate-400" /></div>
                <span className="text-[10px] font-bold text-slate-500">{zoom}% Precision</span>
             </div>
             <div className="flex items-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span>Arrow Keys: 0.25"</span>
                <span>Ctrl+A: Select All</span>
                <span>Ctrl+S: Save Design</span>
                <span>Ctrl+Wheel: Zoom (2%)</span>
             </div>
          </div>
        </div>

        <div className="w-[240px] bg-white border-l z-20 shrink-0 flex flex-col shadow-xl">
           <div className="p-3 border-b bg-slate-50 flex items-center justify-between"><span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Inspector</span><Settings2 className="w-4 h-4 text-slate-400" /></div>
           <ScrollArea className="flex-1 p-3">
              <Accordion type="multiple" defaultValue={["dims", "props"]} className="w-full">
                <AccordionItem value="dims" className="border-none mb-4">
                  <AccordionTrigger className="h-8 px-0 text-[10px] font-bold text-slate-400 uppercase hover:no-underline">Dimensions & Area</AccordionTrigger>
                  <AccordionContent className="pt-2">
                    <div className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-100">
                      <Label className="text-[11px] font-medium text-slate-700 flex items-center gap-2">
                        <RulerIcon className="w-3.5 h-3.5 text-slate-400" />
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
                         <PropInput label="X POS" value={localPropX} onChange={setLocalPropX} onBlur={() => updateObject(selectedObjectIds[0], { x: parseFeetInches(localPropX) }, true)} />
                         <PropInput label="Y POS" value={localPropY} onChange={setLocalPropY} onBlur={() => updateObject(selectedObjectIds[0], { y: parseFeetInches(localPropY) }, true)} />
                         <PropInput label="WIDTH" value={localPropW} onChange={setLocalPropW} onBlur={() => updateObject(selectedObjectIds[0], { w: parseFeetInches(localPropW) }, true)} />
                         <PropInput label="HEIGHT" value={localPropH} onChange={setLocalPropH} onBlur={() => updateObject(selectedObjectIds[0], { h: parseFeetInches(localPropH) }, true)} />
                      </div>

                      <div className="space-y-2 border-t pt-2">
                         <Label className="text-[9px] font-bold text-slate-400 uppercase">Rotation (°)</Label>
                         <div className="flex items-center gap-2">
                            <Slider value={[firstSelectedObject.rotation]} max={360} min={0} step={1} className="flex-1" onValueChange={(v) => updateObject(selectedObjectIds[0], { rotation: v[0] }, true)} />
                            <Input type="number" className="h-7 w-12 text-[10px] px-1" value={firstSelectedObject.rotation} onChange={(e) => updateObject(selectedObjectIds[0], { rotation: parseInt(e.target.value) || 0 }, true)} />
                         </div>
                         <div className="flex gap-1">
                            <Button variant="outline" className="h-7 flex-1 text-[9px] font-bold" onClick={() => updateObject(selectedObjectIds[0], { rotation: (firstSelectedObject.rotation + 90) % 360 }, true)}>
                               <RotateCw className="w-3 h-3 mr-1" /> +90°
                            </Button>
                            <Button variant="outline" className="h-7 flex-1 text-[9px] font-bold" onClick={() => updateObject(selectedObjectIds[0], { rotation: (firstSelectedObject.rotation - 90 + 360) % 360 }, true)}>
                               <RotateCw className="w-3 h-3 mr-1" /> -90°
                            </Button>
                         </div>
                      </div>

                      {(firstSelectedObject.type === 'opening' || firstSelectedObject.type === 'structure' || firstSelectedObject.type === 'pillar') && (
                         <div className="space-y-1.5 border-t pt-2">
                            <Label className="text-[9px] font-bold text-slate-400 uppercase">Flip / Mirror</Label>
                            <div className="flex gap-2">
                               <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateObject(selectedObjectIds[0], { scaleX: (firstSelectedObject.scaleX || 1) * -1 }, true)}>
                                  <FlipHorizontal className="w-4 h-4" />
                               </Button>
                               <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateObject(selectedObjectIds[0], { scaleY: (firstSelectedObject.scaleY || 1) * -1 }, true)}>
                                  <FlipVertical className="w-4 h-4" />
                               </Button>
                            </div>
                         </div>
                      )}

                      {firstSelectedObject.type === 'stair' && (
                         <div className="space-y-1.5 border-t pt-2">
                            <Label className="text-[9px] font-bold text-slate-400 uppercase">Steps</Label>
                            <Input 
                              type="number" 
                              className="h-7 text-[10px]" 
                              value={firstSelectedObject.stepCount || 10} 
                              onChange={(e) => updateObject(selectedObjectIds[0], { stepCount: parseInt(e.target.value) || 0 }, true)} 
                              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                            />
                         </div>
                      )}

                      {(firstSelectedObject.subType.includes('wall') || firstSelectedObject.type === 'opening') && (
                         <div className="space-y-1.5 border-t pt-2">
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
                         <div className="space-y-1.5 border-t pt-2">
                            <Label className="text-[9px] font-bold text-slate-400 uppercase">Label Text</Label>
                            <Input 
                              className="h-7 text-[10px]" 
                              value={firstSelectedObject.textContent || ""} 
                              onChange={(e) => updateObject(selectedObjectIds[0], { textContent: e.target.value })} 
                              onBlur={() => updateObject(selectedObjectIds[0], { textContent: firstSelectedObject.textContent }, true)}
                              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                            />
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
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          }
        }}
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

function SymbolButton({ icon, label, onClick, active }: { icon: React.ReactNode, label: string, onClick?: () => void, active?: boolean }) {
  return (
    <Button variant={active ? "secondary" : "outline"} onClick={onClick} className={cn("w-full flex flex-col items-center justify-center gap-1.5 h-16 p-3 bg-white hover:bg-slate-50 group shadow-sm", active && "border-blue-500 ring-1 ring-blue-500")}>
       {React.cloneElement(icon as React.ReactElement, { className: cn("w-5 h-5 text-slate-400 group-hover:text-blue-500", active && "text-blue-500") })}
       <span className={cn("text-[9px] font-bold text-slate-500 uppercase", active && "text-blue-600")}>{label}</span>
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
