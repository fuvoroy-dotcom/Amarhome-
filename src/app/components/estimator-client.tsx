
"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { 
  Building, LayoutGrid, 
  RectangleHorizontal, Trash2, 
  Clipboard as ClipboardIcon, Copy as CopyIcon, Undo2, Redo2,
  Pencil, ZoomIn, ZoomOut,
  RotateCw, Save, User,
  Type as TypeIcon,
  MousePointer2, Square, DoorOpen, Wind, TowerControl as PillarIcon,
  Image as ImageIcon,
  Rows, FilePlus, FolderOpen, Search, Check,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Hand, Calculator, ArrowLeft, Send, Loader2,
  Layers, Boxes
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { doc, setDoc, getDoc, getDocs, collection, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import html2canvas from 'html2canvas';
import { getConstructionAdvice } from "@/app/actions";

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
  isJoined?: boolean; 
  stepCount?: number;
};

type SavedDesignRef = {
  id: string;
  name: string;
  updatedAt: any;
};

const COLORS = ['#000000', '#ef4444', '#ffffff', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#6366f1', '#a855f7', '#64748b'];
const ARCH_SNAP = 1/48; 
const CANVAS_OFFSET = 40; 

const ROD_OPTIONS = [
  { label: "8 mm (2.5 Suta)", value: 0.12 },
  { label: "10 mm (3 Suta)", value: 0.19 },
  { label: "12 mm (4 Suta)", value: 0.30 },
  { label: "16 mm (5 Suta)", value: 0.48 },
  { label: "20 mm (6 Suta)", value: 0.75 },
  { label: "22 mm (7 Suta)", value: 0.90 },
  { label: "25 mm (8 Suta)", value: 1.17 },
  { label: "28 mm (9 Suta)", value: 1.46 },
  { label: "32 mm (10 Suta)", value: 1.91 },
];

export default function EstimatorClient() {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [designObjects, setDesignObjects] = useState<DesignObject[]>([]);
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<DesignObject[]>([]);
  const [interactionMode, setInteractionMode] = useState<'none' | 'dragging' | 'resizing' | 'rotating' | 'drawing' | 'selecting' | 'pasting' | 'panning'>('none');
  const [selectedTool, setSelectedTool] = useState<string>('select');
  const [drawStart, setDrawStart] = useState<{x: number, y: number} | null>(null);
  const [tempDrawEnd, setTempDrawEnd] = useState<{x: number, y: number} | null>(null);
  const [dragOffsets, setDragOffsets] = useState<{ [id: string]: { x: number, y: number } }>({});
  const [lastPanPos, setLastPanPos] = useState<{ x: number, y: number } | null>(null);
  const [zoom, setZoom] = useState(40);
  const [currentWallThickness, setCurrentWallThickness] = useState(0.4166); // 5 inches
  const [history, setHistory] = useState<DesignObject[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [showDimensions, setShowDimensions] = useState(true);
  const [selectionBox, setSelectionBox] = useState<{x1: number, y1: number, x2: number, y2: number} | null>(null);
  const [viewMode, setViewMode] = useState<'design' | 'estimate'>('design');

  const [projectName, setProjectName] = useState("নতুন প্রজেক্ট");
  const [currentDesignId, setCurrentDesignId] = useState(Math.random().toString(36).substr(2, 9));
  const [savedDesigns, setSavedDesigns] = useState<SavedDesignRef[]>([]);
  const [isOpenDialogOpen, setIsOpenDialogOpen] = useState(false);

  const [localPropX, setLocalPropX] = useState("");
  const [localPropY, setLocalPropY] = useState("");
  const [localPropW, setLocalPropW] = useState("");
  const [localPropH, setLocalPropH] = useState("");
  const [localPropRot, setLocalPropRot] = useState("");
  const [localPropSteps, setLocalPropSteps] = useState("");
  const [localPropText, setLocalPropText] = useState("");

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
      setLocalPropSteps((firstSelectedObject.stepCount || 10).toString());
      setLocalPropText(firstSelectedObject.textContent || "");
    }
  }, [firstSelectedObject?.id, firstSelectedObject?.x, firstSelectedObject?.y, firstSelectedObject?.w, firstSelectedObject?.h, firstSelectedObject?.rotation, firstSelectedObject?.stepCount, firstSelectedObject?.textContent]);

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

  const selectAll = useCallback(() => {
    setSelectedObjectIds(designObjects.map(obj => obj.id));
  }, [designObjects]);

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
      toast({ title: "কপি করা হয়েছে", description: `${selected.length}টি অবজেক্ট ক্লিপবোর্ডে কপি হয়েছে।` });
    }
  }, [designObjects, selectedObjectIds, toast]);

  const copyAsImage = async () => {
    const workspace = document.getElementById('canvas-workspace-inner');
    if (!workspace) return;
    try {
      const capture = await html2canvas(workspace, { backgroundColor: '#ffffff', scale: 2 });
      capture.toBlob(async (blob) => {
        if (blob) {
          try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            toast({ title: "ইমেজ কপি সফল", description: "ডিজাইনটি ইমেজ হিসেবে ক্লিপবোর্ডে কপি হয়েছে।" });
          } catch (err) {
            toast({ variant: "destructive", title: "ত্রুটি", description: "ক্লিপবোর্ডে ইমেজ রাইট করার অনুমতি নেই।" });
          }
        }
      });
    } catch (e) {
      toast({ variant: "destructive", title: "ত্রুটি", description: "ইমেজ তৈরি করতে সমস্যা হয়েছে।" });
    }
  };

  const enterPasteMode = useCallback(() => {
    if (clipboard.length > 0) {
      setInteractionMode('pasting');
      toast({ title: "পেস্ট মোড সক্রিয়", description: "ক্যানভাসের যেখানে পেস্ট করতে চান সেখানে ক্লিক করুন।" });
    } else {
      toast({ variant: "destructive", title: "ক্লিপবোর্ড খালি", description: "প্রথমে কিছু অবজেক্ট কপি করুন।" });
    }
  }, [clipboard, toast]);

  const saveToFirestore = useCallback(() => {
    const { firestore } = initializeFirebase();
    const docRef = doc(firestore, 'designs', currentDesignId);
    const data = { objects: designObjects, name: projectName, updatedAt: serverTimestamp() };
    setDoc(docRef, data, { merge: true }).then(() => {
      toast({ title: "সফল", description: `"${projectName}" ডিজাইনটি সেভ করা হয়েছে।` });
    }).catch(async (serverError) => {
      const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'write', requestResourceData: data });
      errorEmitter.emit('permission-error', permissionError);
    });
  }, [designObjects, projectName, currentDesignId, toast]);

  const handleNewPage = () => {
    setDesignObjects([]);
    setProjectName("নতুন প্রজেক্ট");
    setCurrentDesignId(Math.random().toString(36).substr(2, 9));
    setHistory([[]]);
    setHistoryIndex(0);
    setSelectedObjectIds([]);
    toast({ title: "নতুন পেজ", description: "ক্যানভাস পরিষ্কার করা হয়েছে।" });
  };

  const fetchSavedDesigns = async () => {
    try {
      const { firestore } = initializeFirebase();
      const designsCol = collection(firestore, 'designs');
      const q = query(designsCol, orderBy('updatedAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const designs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || "নামহীন ডিজাইন",
        updatedAt: doc.data().updatedAt
      }));
      setSavedDesigns(designs);
      setIsOpenDialogOpen(true);
    } catch (e) {
      toast({ variant: "destructive", title: "ত্রুটি", description: "সেভ করা ডিজাইনগুলো লোড করা যায়নি।" });
    }
  };

  const loadDesign = async (id: string) => {
    try {
      const { firestore } = initializeFirebase();
      const docRef = doc(firestore, 'designs', id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        setDesignObjects(data.objects || []);
        setProjectName(data.name || "নামহীন ডিজাইন");
        setCurrentDesignId(id);
        setHistory([data.objects || []]);
        setHistoryIndex(0);
        setIsOpenDialogOpen(false);
        toast({ title: "সফল", description: "ডিজাইনটি লোড করা হয়েছে।" });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "ত্রুটি", description: "ডিজাইন লোড করা যায়নি।" });
    }
  };

  const updateObject = (id: string, updates: Partial<DesignObject>, save = false) => {
    setDesignObjects(prev => {
      const obj = prev.find(o => o.id === id);
      if (!obj) return prev;
      const next = prev.map(o => o.id === id ? { ...o, ...updates } : o);
      if (save) saveToHistory(next);
      return next;
    });
  };

  const moveSelectedWithArrows = useCallback((key: string) => {
    if (selectedObjectIds.length === 0) return;
    setDesignObjects(prev => {
      const next = prev.map(o => {
        if (selectedObjectIds.includes(o.id) && !o.isJoined) {
          let dx = 0, dy = 0;
          const step = ARCH_SNAP;
          if (key === 'ArrowUp') dy = -step;
          if (key === 'ArrowDown') dy = step;
          if (key === 'ArrowLeft') dx = -step;
          if (key === 'ArrowRight') dx = step;
          return { ...o, x: Math.round((o.x + dx) * 48) / 48, y: Math.round((o.y + dy) * 48) / 48 };
        }
        return o;
      });
      const moved = next.some((o, i) => o.x !== prev[i].x || o.y !== prev[i].y);
      if (moved) saveToHistory(next);
      return next;
    });
  }, [selectedObjectIds, saveToHistory]);

  const addObjectAt = useCallback((type: DesignObject['type'], subType: string, label: string, x: number, y: number, overrides = {}) => {
    const newObj: DesignObject = {
      id: Math.random().toString(36).substr(2, 9),
      type, subType, x, y, w: 2, h: 2, label, 
      color: '#000000', fillColor: '#ffffff',
      strokeWidth: 2, strokeStyle: 'solid', rotation: 0,
      isJoined: false, fontSize: 14, isBold: false, stepCount: 10,
      ...overrides
    };
    if (subType === 'pillar') newObj.fillColor = '#000000';
    if (subType.startsWith('door') || subType === 'sliding-door') { newObj.w = 3.5; newObj.h = currentWallThickness; }
    if (subType === 'double-door') { newObj.w = 6; newObj.h = currentWallThickness; }
    if (subType === 'window') { newObj.w = 4; newObj.h = currentWallThickness; }
    if (subType === 'stair') { newObj.w = 6; newObj.h = 10; newObj.stepCount = 10; }

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

  const scrollCanvas = (dx: number, dy: number) => {
    if (canvasRef.current) {
      canvasRef.current.scrollBy({ left: dx, top: dy, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const container = canvasRef.current;
    if (!container) return;
    const handleNativeWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -5 : 5; 
        setZoom(prev => Math.min(250, Math.max(0, prev + delta)));
      }
    };
    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleNativeWheel);
  }, [zoom]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
      else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); moveSelectedWithArrows(e.key); }
      else if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'z') { e.preventDefault(); undo(); }
        else if (key === 'y') { e.preventDefault(); redo(); }
        else if (key === 'c') { e.preventDefault(); copySelected(); }
        else if (key === 'v') { e.preventDefault(); enterPasteMode(); }
        else if (key === 's') { e.preventDefault(); saveToFirestore(); }
        else if (key === 'a') { e.preventDefault(); selectAll(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelected, undo, redo, copySelected, enterPasteMode, saveToFirestore, moveSelectedWithArrows, selectAll]);

  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const container = canvasRef.current;
    const rect = container?.getBoundingClientRect();
    if (!rect || !container) return null;
    let clientX, clientY;
    if ('touches' in e) {
      if (e.touches.length === 1) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
      else return null;
    } else { clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY; }
    const curX = (clientX - rect.left - (CANVAS_OFFSET - container.scrollLeft)) / zoom;
    const curY = (clientY - rect.top - (CANVAS_OFFSET - container.scrollTop)) / zoom;
    return { x: curX, y: curY, rawX: clientX, rawY: clientY };
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent, id: string | null) => {
    const coords = getCoords(e);
    if (!coords) return;
    const { x: curX, y: curY, rawX, rawY } = coords;
    const snappedX = Math.round(curX / ARCH_SNAP) * ARCH_SNAP;
    const snappedY = Math.round(curY / ARCH_SNAP) * ARCH_SNAP;

    if (selectedTool === 'move') {
      setInteractionMode('panning');
      setLastPanPos({ x: rawX, y: rawY });
      if (e.cancelable) e.preventDefault();
      return;
    }

    if (interactionMode === 'pasting' && clipboard.length > 0) {
      const minX = Math.min(...clipboard.map(obj => obj.x));
      const minY = Math.min(...clipboard.map(obj => obj.y));
      const pasted = clipboard.map(obj => ({
        ...obj, id: Math.random().toString(36).substr(2, 9),
        x: Math.round((snappedX + (obj.x - minX)) / ARCH_SNAP) * ARCH_SNAP,
        y: Math.round((snappedY + (obj.y - minY)) / ARCH_SNAP) * ARCH_SNAP,
        isJoined: false
      }));
      const next = [...designObjects, ...pasted];
      setDesignObjects(next); setSelectedObjectIds(pasted.map(p => p.id));
      saveToHistory(next); setInteractionMode('none');
      return;
    }

    if (selectedTool !== 'select' && selectedTool !== 'move' && !id) {
        if (selectedTool === 'wall') { const start = { x: snappedX, y: snappedY }; setDrawStart(start); setTempDrawEnd(start); setInteractionMode('drawing'); return; }
        if (selectedTool === 'room') addRoomAt(snappedX, snappedY);
        else if (selectedTool === 'pillar') addObjectAt('pillar', 'pillar', 'Pillar', snappedX, snappedY, { w: 0.83, h: 0.83 });
        else if (selectedTool.startsWith('door')) addObjectAt('opening', selectedTool, 'Door', snappedX, snappedY);
        else if (selectedTool === 'sliding-door') addObjectAt('opening', 'sliding-door', 'Sliding Door', snappedX, snappedY);
        else if (selectedTool === 'double-door') addObjectAt('opening', 'double-door', 'Double Door', snappedX, snappedY);
        else if (selectedTool === 'window') addObjectAt('opening', 'window', 'Window', snappedX, snappedY);
        else if (selectedTool === 'stair') addObjectAt('stair', 'stair', 'Stair', snappedX, snappedY);
        else if (selectedTool === 'label') addObjectAt('text', 'label', 'Label', snappedX, snappedY, { textContent: 'Room Name', w: 4, h: 1 });
        setSelectedTool('select'); return;
    }

    if (id) {
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
      const obj = designObjects.find(o => o.id === id);
      if (!obj) return;
      let newSelection = (e.ctrlKey || (e as any).metaKey) ? (selectedObjectIds.includes(id) ? selectedObjectIds.filter(sid => sid !== id) : [...selectedObjectIds, id]) : [id];
      setSelectedObjectIds(newSelection);
      if (obj.isJoined) return;
      setDragOffsets({ [id]: { x: curX - obj.x, y: curY - obj.y } });
      setInteractionMode('dragging');
      if (e.cancelable) e.preventDefault();
    } else {
      if (selectedTool === 'select') { 
        setSelectedObjectIds([]); 
        setInteractionMode('selecting'); 
        setSelectionBox({ x1: curX, y1: curY, x2: curX, y2: curY }); 
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    const coords = getCoords(e);
    if (!coords) return;
    const { x: curX, y: curY, rawX, rawY } = coords;

    if (interactionMode === 'panning' && lastPanPos && canvasRef.current) {
      if (e.cancelable) e.preventDefault();
      const dx = (rawX - lastPanPos.x) * 1.5;
      const dy = (rawY - lastPanPos.y) * 1.5;
      canvasRef.current.scrollLeft -= dx;
      canvasRef.current.scrollTop -= dy;
      setLastPanPos({ x: rawX, y: rawY });
      return;
    }

    if (interactionMode === 'drawing' && drawStart) {
      if (e.cancelable) e.preventDefault();
      let endX = curX, endY = curY;
      if (e.shiftKey || e.ctrlKey) { if (Math.abs(curX - drawStart.x) > Math.abs(curY - drawStart.y)) endY = drawStart.y; else endX = drawStart.x; }
      setTempDrawEnd({ x: Math.round(endX / ARCH_SNAP) * ARCH_SNAP, y: Math.round(endY / ARCH_SNAP) * ARCH_SNAP });
    } else if (interactionMode === 'selecting' && selectionBox) {
      if (e.cancelable) e.preventDefault();
      setSelectionBox(prev => prev ? { ...prev, x2: curX, y2: curY } : null);
    } else if (interactionMode === 'rotating' && firstSelectedObject) {
      if (e.cancelable) e.preventDefault();
      const centerX = firstSelectedObject.x + firstSelectedObject.w / 2;
      const centerY = firstSelectedObject.y + firstSelectedObject.h / 2;
      const angle = Math.atan2(curY - centerY, curX - centerX) * (180 / Math.PI);
      updateObject(firstSelectedObject.id, { rotation: Math.round(angle / 1) * 1 });
    } else if (interactionMode === 'dragging' && selectedObjectIds.length > 0) {
      if (e.cancelable) e.preventDefault();
      const mainId = selectedObjectIds[0];
      const mainObj = designObjects.find(o => o.id === mainId);
      if (!mainObj || mainObj.isJoined) return;
      const mainOffset = dragOffsets[mainId];
      if (!mainOffset) return;
      let tx = Math.round((curX - mainOffset.x) / ARCH_SNAP) * ARCH_SNAP, ty = Math.round((curY - mainOffset.y) / ARCH_SNAP) * ARCH_SNAP;
      const dx = tx - mainObj.x, dy = ty - mainObj.y;
      if (dx !== 0 || dy !== 0) {
        setDesignObjects(prev => prev.map(o => selectedObjectIds.includes(o.id) && !o.isJoined ? { ...o, x: o.x + dx, y: o.y + dy } : o));
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
    } else if (interactionMode !== 'none' && interactionMode !== 'pasting') saveToHistory(designObjects);
    if (interactionMode !== 'pasting') setInteractionMode('none');
    setLastPanPos(null);
  };

  const renderPillarDistances = () => {
    const pillars = designObjects.filter(obj => obj.subType === 'pillar');
    if (pillars.length < 2) return null;
    const dims: React.ReactNode[] = [];
    const TOL = 1.0;
    const yGroups: { y: number, items: DesignObject[] }[] = [];
    pillars.forEach(p => { let g = yGroups.find(gr => Math.abs(gr.y - p.y) < TOL); if (g) g.items.push(p); else yGroups.push({ y: p.y, items: [p] }); });
    yGroups.forEach(g => {
      const sorted = [...g.items].sort((a, b) => a.x - b.x);
      for (let i = 0; i < sorted.length - 1; i++) {
        const p1 = sorted[i], p2 = sorted[i+1];
        const c1x = p1.x + p1.w / 2, c2x = p2.x + p2.w / 2, c1y = p1.y + p1.h / 2, dist = c2x - c1x;
        if (dist > 0.1) dims.push(<div key={`h-${p1.id}-${p2.id}`} className="absolute pointer-events-none z-20 flex flex-col items-center dimension-label" style={{ left: c1x * zoom + CANVAS_OFFSET, top: (c1y - 1.2) * zoom + CANVAS_OFFSET, width: dist * zoom }}>
          <div className="w-full h-[1px] bg-red-500 relative flex items-center justify-center"><div className="absolute left-0 w-[1px] h-3 bg-red-500 -translate-y-1/2" /><div className="absolute right-0 w-[1px] h-3 bg-red-500 -translate-y-1/2" /><div className="bg-white px-1 text-[9px] font-bold text-red-600 border border-red-200 shadow-sm rounded-sm whitespace-nowrap -translate-y-4">{formatFeetInches(dist)}</div></div>
        </div>);
      }
    });
    const xGroups: { x: number, items: DesignObject[] }[] = [];
    pillars.forEach(p => { let g = xGroups.find(gr => Math.abs(gr.x - p.x) < TOL); if (g) g.items.push(p); else xGroups.push({ x: p.x, items: [p] }); });
    xGroups.forEach(g => {
      const sorted = [...g.items].sort((a, b) => a.y - b.y);
      for (let i = 0; i < sorted.length - 1; i++) {
        const p1 = sorted[i], p2 = sorted[i+1];
        const c1x = p1.x + p1.w / 2, c1y = p1.y + p1.h / 2, c2y = p2.y + p2.h / 2, dist = c2y - c1y;
        if (dist > 0.1) dims.push(<div key={`v-${p1.id}-${p2.id}`} className="absolute pointer-events-none z-20 flex items-center justify-center dimension-label" style={{ left: (c1x + 0.8) * zoom + CANVAS_OFFSET, top: c1y * zoom + CANVAS_OFFSET, height: dist * zoom, width: 20 }}>
          <div className="h-full w-[1px] bg-red-500 relative flex items-center justify-center"><div className="absolute top-0 h-[1px] w-3 bg-red-500 -translate-x-1/2" /><div className="absolute bottom-0 h-[1px] w-3 bg-red-500 -translate-x-1/2" /><div className="bg-white px-1 text-[9px] font-bold text-red-600 border border-red-200 shadow-sm rounded-sm whitespace-nowrap rotate-90 translate-x-4">{formatFeetInches(dist)}</div></div>
        </div>);
      }
    });
    return dims;
  };

  const Ruler = ({ orientation }: { orientation: 'horizontal' | 'vertical' }) => (
    <div className={cn("bg-white/40 backdrop-blur-md border-slate-200 ruler-container", orientation === 'horizontal' ? "h-8 border-b w-full relative shrink-0" : "w-8 border-r h-full relative shrink-0")}>
      {Array.from({ length: 100 }).map((_, t) => (
        <div key={t} className="absolute overflow-visible" style={orientation === 'horizontal' ? { left: t * 4 * zoom + CANVAS_OFFSET, top: 0 } : { top: t * 4 * zoom + CANVAS_OFFSET, left: 0 }}>
          <div className={cn("bg-slate-400", orientation === 'horizontal' ? "w-[1px] h-3 -translate-x-1/2" : "h-[1px] w-3 -translate-y-1/2")} />
          <span className={cn("text-[9px] font-bold text-slate-500 absolute", orientation === 'horizontal' ? "top-3 -translate-x-1/2" : "left-3 -translate-y-1/2")}>{t * 4}</span>
        </div>
      ))}
    </div>
  );

  const renderObjectContent = (obj: DesignObject) => {
    const sw = 1 / zoom;
    if (obj.type === 'opening') {
      return (
        <svg width="100%" height="100%" viewBox={`0 0 ${obj.w} ${obj.h}`} preserveAspectRatio="none" className="overflow-visible pointer-events-none">
          <rect x="0" y="0" width={obj.w} height={obj.h} fill="white" stroke="none" />
          {obj.subType === 'window' && (
            <g><rect x="0" y="0" width={obj.w} height={obj.h} fill="white" stroke={obj.color} strokeWidth={sw * 3} /><line x1="0" y1={obj.h * 0.25} x2={obj.w} y2={obj.h * 0.25} stroke={obj.color} strokeWidth={sw * 1.5} /><line x1="0" y1={obj.h * 0.75} x2={obj.w} y2={obj.h * 0.75} stroke={obj.color} strokeWidth={sw * 1.5} /></g>
          )}
          {obj.subType === 'door-1' && (
            <g><line x1={obj.w} y1={obj.h} x2={obj.w} y2={obj.h - obj.w} stroke={obj.color} strokeWidth={sw * 4} /><path d={`M ${obj.w} ${obj.h - obj.w} A ${obj.w} ${obj.w} 0 0 0 0 ${obj.h}`} fill="none" stroke={obj.color} strokeWidth={sw * 2} strokeDasharray={`${sw*3},${sw*3}`} /></g>
          )}
          {obj.subType === 'door-2' && (
            <g><line x1={0} y1={obj.h} x2={0} y2={obj.h - obj.w} stroke={obj.color} strokeWidth={sw * 4} /><path d={`M 0 ${obj.h - obj.w} A ${obj.w} ${obj.w} 0 0 1 ${obj.w} ${obj.h}`} fill="none" stroke={obj.color} strokeWidth={sw * 2} strokeDasharray={`${sw*3},${sw*3}`} /></g>
          )}
          {obj.subType === 'door-3' && (
            <g><line x1={obj.w} y1={0} x2={obj.w} y2={obj.w} stroke={obj.color} strokeWidth={sw * 4} /><path d={`M ${obj.w} ${obj.w} A ${obj.w} ${obj.w} 0 0 1 0 0`} fill="none" stroke={obj.color} strokeWidth={sw * 2} strokeDasharray={`${sw*3},${sw*3}`} /></g>
          )}
          {obj.subType === 'door-4' && (
            <g><line x1={0} y1={0} x2={0} y2={obj.w} stroke={obj.color} strokeWidth={sw * 4} /><path d={`M 0 ${obj.w} A ${obj.w} ${obj.w} 0 0 0 ${obj.w} 0`} fill="none" stroke={obj.color} strokeWidth={sw * 2} strokeDasharray={`${sw*3},${sw*3}`} /></g>
          )}
          {obj.subType === 'double-door' && (
            <g><line x1="0" y1={obj.h} x2="0" y2={obj.h - obj.w/2} stroke={obj.color} strokeWidth={sw * 4} /><path d={`M 0 ${obj.h - obj.w/2} A ${obj.w/2} ${obj.w/2} 0 0 1 ${obj.w/2} ${obj.h}`} fill="none" stroke={obj.color} strokeWidth={sw * 2} strokeDasharray={`${sw*3},${sw*3}`} /><line x1={obj.w} y1={obj.h} x2={obj.w} y2={obj.h - obj.w/2} stroke={obj.color} strokeWidth={sw * 4} /><path d={`M ${obj.w} ${obj.h - obj.w/2} A ${obj.w/2} ${obj.w/2} 0 0 0 ${obj.w/2} ${obj.h}`} fill="none" stroke={obj.color} strokeWidth={sw * 2} strokeDasharray={`${sw*3},${sw*3}`} /></g>
          )}
          {obj.subType === 'sliding-door' && (
            <g><rect x="0" y={obj.h*0.25} width={obj.w} height={obj.h*0.5} fill="none" stroke={obj.color} strokeWidth={sw * 2} /><line x1={obj.w * 0.4} y1={obj.h*0.25} x2={obj.w * 0.4} y2={obj.h*0.75} stroke={obj.color} strokeWidth={sw * 2} /><line x1={obj.w * 0.4} y1={obj.h*0.5} x2={obj.w * 0.9} y2={obj.h*0.5} stroke={obj.color} strokeWidth={sw * 4} /></g>
          )}
        </svg>
      );
    }
    if (obj.subType === 'stair') {
      const steps = obj.stepCount || 10; const landingH = obj.h * 0.2; const flightW = obj.w * 0.45; const gapW = obj.w * 0.1; const stepH = (obj.h - landingH * 2) / (steps / 2);
      return (
        <svg width="100%" height="100%" viewBox={`0 0 ${obj.w} ${obj.h}`} preserveAspectRatio="none" className="overflow-visible pointer-events-none">
          <rect x="0" y="0" width={obj.w} height={obj.h} fill="white" stroke={obj.color} strokeWidth={sw * 2} /><line x1="0" y1={landingH} x2={obj.w} y2={landingH} stroke={obj.color} strokeWidth={sw * 2} /><line x1="0" y1={obj.h - landingH} x2={obj.w} y2={obj.h - landingH} stroke={obj.color} strokeWidth={sw * 2} /><line x1={flightW} y1={landingH} x2={flightW} y2={obj.h - landingH} stroke={obj.color} strokeWidth={sw * 2} /><line x1={flightW + gapW} y1={landingH} x2={flightW + gapW} y2={obj.h - landingH} stroke={obj.color} strokeWidth={sw * 2} />
          {Array.from({ length: Math.ceil(steps / 2) }).map((_, i) => (<React.Fragment key={i}><line x1="0" y1={landingH + (i+1) * stepH} x2={flightW} y2={landingH + (i+1) * stepH} stroke={obj.color} strokeWidth={sw} /><line x1={flightW + gapW} y1={landingH + (i+1) * stepH} x2={obj.w} y2={landingH + (i+1) * stepH} stroke={obj.color} strokeWidth={sw} /></React.Fragment>))}
        </svg>
      );
    }
    if (obj.type === 'text') return <div className="w-full h-full flex items-center justify-center p-1 pointer-events-none" style={{ color: obj.color, fontSize: (obj.fontSize || 14) * (zoom/40), fontWeight: obj.isBold ? 'bold' : 'normal' }}>{obj.textContent || obj.label}</div>;
    return null;
  };

  const getObjectStyle = (obj: DesignObject): React.CSSProperties => {
    let ox = 0, oy = 0;
    if (obj.rotation === 90) ox = obj.h; 
    else if (obj.rotation === 180) { ox = obj.w; oy = obj.h; } 
    else if (obj.rotation === 270) oy = obj.w;
    
    return { 
      left: (obj.x + ox) * zoom + CANVAS_OFFSET, top: (obj.y + oy) * zoom + CANVAS_OFFSET, width: obj.w * zoom, height: obj.h * zoom, transformOrigin: '0 0', transform: `rotate(${obj.rotation}deg)`, 
      backgroundColor: (obj.subType === 'wall' || obj.subType === 'pillar') ? obj.color : 'transparent',
      outline: selectedObjectIds.includes(obj.id) ? '2px solid #3b82f6' : 'none', cursor: obj.isJoined ? 'not-allowed' : (selectedTool === 'move' ? 'grab' : 'move'), zIndex: selectedObjectIds.includes(obj.id) ? 100 : (obj.type === 'opening' ? 50 : 10),
      touchAction: 'none'
    };
  };

  if (viewMode === 'estimate') {
    return <EstimationView onBack={() => setViewMode('design')} />;
  }

  return (
    <div className="w-full h-[100svh] bg-slate-100 flex flex-col overflow-hidden font-body text-slate-900 select-none relative">
      <div className="h-10 bg-slate-800/90 backdrop-blur-md border-b flex items-center px-4 justify-between shrink-0 text-white z-50">
        <div className="flex items-center gap-2 md:gap-6">
          <Building className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
          <div className="flex items-center gap-2">
            <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} className="h-6 w-32 md:w-48 bg-slate-700 border-none text-[10px] md:text-xs text-white focus:ring-1 focus:ring-blue-500" placeholder="প্রজেক্টের নাম..." />
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <Button variant="ghost" size="sm" className="h-7 text-[10px] md:text-sm hover:bg-slate-700" onClick={saveToFirestore}><Save className="w-3 h-3 md:w-4 md:h-4 md:mr-2 text-green-400"/> SAVE</Button>
          <User className="w-4 h-4 md:w-5 md:h-5 text-slate-400" />
        </div>
      </div>

      <div className="h-14 md:h-16 bg-white/70 backdrop-blur-lg border-b flex items-center px-2 md:px-4 gap-0.5 md:gap-1 shrink-0 shadow-sm z-40 overflow-x-auto no-scrollbar">
        <RibbonButton icon={<FilePlus className="text-blue-500" />} label="New" onClick={handleNewPage} />
        <RibbonButton icon={<FolderOpen className="text-amber-500" />} label="Open" onClick={fetchSavedDesigns} />
        <div className="w-px h-8 bg-slate-200 mx-1 md:mx-2" />
        <RibbonButton icon={<Undo2 />} label="Undo" onClick={undo} />
        <RibbonButton icon={<Redo2 />} label="Redo" onClick={redo} />
        <div className="w-px h-8 bg-slate-200 mx-1 md:mx-2" />
        <RibbonButton icon={<CopyIcon />} label="Copy" onClick={copySelected} />
        <RibbonButton icon={<ImageIcon />} label="As Image" onClick={copyAsImage} />
        <RibbonButton icon={<ClipboardIcon />} label="Paste" onClick={enterPasteMode} active={interactionMode === 'pasting'} />
        <div className="w-px h-8 bg-slate-200 mx-1 md:mx-2" />
        <RibbonButton icon={<Calculator className="text-emerald-500" />} label="হিসাব" onClick={() => setViewMode('estimate')} />
        <div className="w-px h-8 bg-slate-200 mx-1 md:mx-2" />
        <RibbonButton icon={<LayoutGrid />} label="Select All" onClick={selectAll} />
        <Button variant="outline" size="sm" className="text-destructive h-10 flex flex-col items-center justify-center p-1 md:p-2 ml-auto" onClick={deleteSelected}>
          <Trash2 className="w-4 h-4" />
          <span className="text-[8px] uppercase font-bold mt-1">Delete</span>
        </Button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        <div className="w-full md:w-[200px] bg-slate-50/80 backdrop-blur-md border-b md:border-b-0 md:border-r z-30 shrink-0 flex flex-col shadow-inner overflow-hidden">
          <ScrollArea orientation="both" className="h-full w-full">
            <div className="flex md:flex-col gap-2 p-2 md:p-3 items-center md:items-stretch min-w-max md:min-w-0">
              <SymbolButton active={selectedTool === 'select'} icon={<MousePointer2 />} label="Select" onClick={() => setSelectedTool('select')} />
              <SymbolButton active={selectedTool === 'move'} icon={<Hand />} label="Move" onClick={() => setSelectedTool('move')} />
              <SymbolButton active={selectedTool === 'wall'} icon={<Pencil />} label="Wall" onClick={() => setSelectedTool('wall')} />
              <SymbolButton active={selectedTool === 'room'} icon={<Square />} label="Room" onClick={() => setSelectedTool('room')} />
              <SymbolButton active={selectedTool === 'pillar'} icon={<PillarIcon />} label="Pillar" onClick={() => setSelectedTool('pillar')} />
              <SymbolButton active={selectedTool === 'stair'} icon={<Rows />} label="Stair" onClick={() => setSelectedTool('stair')} />
              <SymbolButton active={selectedTool === 'label'} icon={<TypeIcon />} label="Label" onClick={() => setSelectedTool('label')} />
              <div className="w-px h-8 bg-slate-200 mx-1 md:hidden" />
              <div className="flex md:flex-col gap-2 items-center md:items-stretch">
                <SymbolButton active={selectedTool === 'door-1'} icon={<DoorOpen />} label="Door 1" onClick={() => setSelectedTool('door-1')} />
                <SymbolButton active={selectedTool === 'door-2'} icon={<DoorOpen />} label="Door 2" onClick={() => setSelectedTool('door-2')} />
                <SymbolButton active={selectedTool === 'door-3'} icon={<DoorOpen />} label="Door 3" onClick={() => setSelectedTool('door-3')} />
                <SymbolButton active={selectedTool === 'door-4'} icon={<DoorOpen />} label="Door 4" onClick={() => setSelectedTool('door-4')} />
                <SymbolButton active={selectedTool === 'double-door'} icon={<LayoutGrid />} label="Double" onClick={() => setSelectedTool('double-door')} />
                <SymbolButton active={selectedTool === 'sliding-door'} icon={<RectangleHorizontal />} label="Sliding" onClick={() => setSelectedTool('sliding-door')} />
                <SymbolButton active={selectedTool === 'window'} icon={<Wind />} label="Window" onClick={() => setSelectedTool('window')} />
              </div>
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 relative flex flex-col bg-slate-200 overflow-hidden">
          <Ruler orientation="horizontal" />
          <div className="flex-1 flex overflow-hidden relative">
            <Ruler orientation="vertical" />
            <div 
              ref={canvasRef} id="canvas-workspace-inner" 
              className="flex-1 relative bg-white overflow-hidden cursor-crosshair" 
              onMouseDown={(e) => handleMouseDown(e, null)} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onTouchStart={(e) => handleMouseDown(e, null)} onTouchMove={handleMouseMove} onTouchEnd={handleMouseUp}
            >
              <div className="absolute" style={{ backgroundImage: `linear-gradient(#f1f5f9 1px, transparent 1px), linear-gradient(90deg, #f1f5f9 1px, transparent 1px)`, backgroundSize: `${zoom}px ${zoom}px`, backgroundPosition: `${CANVAS_OFFSET}px ${CANVAS_OFFSET}px`, width: 10000, height: 10000 }}>
                {renderPillarDistances()}
                {designObjects.map(obj => (
                  <div key={obj.id} data-id={obj.id} onMouseDown={(e) => handleMouseDown(e, obj.id)} onTouchStart={(e) => handleMouseDown(e, obj.id)} className={cn("absolute design-object-container", selectedObjectIds.includes(obj.id) ? "z-30" : "z-10")} style={getObjectStyle(obj)}>
                    {renderObjectContent(obj)}
                    {selectedObjectIds.includes(obj.id) && !obj.isJoined && (
                       <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-8 h-8 bg-white border border-slate-300 rounded-full flex items-center justify-center cursor-alias shadow-sm hover:bg-slate-50 z-[60] rotation-handle" onMouseDown={(e) => { e.stopPropagation(); setInteractionMode('rotating'); }} onTouchStart={(e) => { e.stopPropagation(); setInteractionMode('rotating'); }}><RotateCw className="w-4 h-4 text-blue-500" /></div>
                    )}
                    {showDimensions && (
                      <>
                        <div className="absolute -top-8 left-0 right-0 flex items-center justify-between pointer-events-none z-[50] dimension-label"><div className="w-[1.5px] h-4 bg-slate-500" /><div className="flex-1 h-[1px] bg-slate-400 mx-0.5 relative flex items-center justify-center"><div className="bg-white/95 px-2 py-0.5 rounded-sm border border-slate-400 shadow-sm"><span className="text-[10px] font-black text-slate-900">{formatFeetInches(obj.w)}</span></div></div><div className="w-[1.5px] h-4 bg-slate-500" /></div>
                        <div className="absolute top-0 bottom-0 -right-10 flex flex-col items-center justify-between pointer-events-none z-[50] dimension-label"><div className="h-[1.5px] w-4 bg-slate-500" /><div className="flex-1 w-[1px] bg-slate-400 my-0.5 relative flex flex-col items-center justify-center"><div className="bg-white/95 px-2 py-0.5 rounded-sm border border-slate-400 shadow-sm rotate-90"><span className="text-[10px] font-black text-slate-900">{formatFeetInches(obj.h)}</span></div></div><div className="h-[1.5px] w-4 bg-slate-500" /></div>
                      </>
                    )}
                  </div>
                ))}
                {interactionMode === 'drawing' && drawStart && tempDrawEnd && (
                  <div className="absolute bg-blue-500/20 border-2 border-blue-500 border-dashed" style={{ left: drawStart.x * zoom + CANVAS_OFFSET, top: drawStart.y * zoom + CANVAS_OFFSET, width: Math.sqrt(Math.pow(tempDrawEnd.x - drawStart.x, 2) + Math.pow(tempDrawEnd.y - drawStart.y, 2)) * zoom, height: currentWallThickness * zoom, transformOrigin: '0 0', transform: `rotate(${Math.atan2(tempDrawEnd.y - drawStart.y, tempDrawEnd.x - drawStart.x) * (180 / Math.PI)}deg)` }} />
                )}
                {interactionMode === 'selecting' && selectionBox && (
                  <div className="absolute border-2 border-blue-500 bg-blue-500/10 z-[70]" style={{ left: Math.min(selectionBox.x1, selectionBox.x2) * zoom + CANVAS_OFFSET, top: Math.min(selectionBox.y1, selectionBox.y2) * zoom + CANVAS_OFFSET, width: Math.abs(selectionBox.x2 - selectionBox.x1) * zoom, height: Math.abs(selectionBox.y2 - selectionBox.y1) * zoom }} />
                )}
              </div>
            </div>
            <div className="absolute bottom-4 right-4 flex flex-col items-center gap-1 z-[60] bg-white/50 p-2 rounded-xl backdrop-blur-sm border border-slate-200">
              <Button variant="outline" size="icon" className="h-8 w-8 bg-white shadow-md" onClick={() => scrollCanvas(0, -100)}><ChevronUp className="w-5 h-5" /></Button>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8 bg-white shadow-md" onClick={() => scrollCanvas(-100, 0)}><ChevronLeft className="w-5 h-5" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-8 bg-white shadow-md" onClick={() => scrollCanvas(0, 100)}><ChevronDown className="w-5 h-5" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-8 bg-white shadow-md" onClick={() => scrollCanvas(100, 0)}><ChevronRight className="w-5 h-5" /></Button>
              </div>
            </div>
          </div>
          <div className="h-8 bg-white/80 backdrop-blur-md border-t flex items-center px-4 justify-between shrink-0 z-40">
            <div className="flex items-center gap-2 md:gap-4">
              <ZoomOut className="w-3.5 h-3.5 text-slate-400 cursor-pointer" onClick={() => setZoom(z => Math.max(0, z - 5))} />
              <Slider value={[zoom]} max={250} min={0} step={5} className="w-20 md:w-32" onValueChange={(val) => setZoom(val[0])} />
              <ZoomIn className="w-3.5 h-3.5 text-slate-400 cursor-pointer" onClick={() => setZoom(z => Math.min(250, z + 5))} />
              <div className="flex items-center gap-1 ml-1 md:ml-2">
                <Input 
                  type="number" 
                  value={zoom} 
                  onChange={(e) => setZoom(Math.min(250, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="h-6 w-12 text-[9px] md:text-[10px] font-bold text-center border-slate-200"
                />
                <span className="text-[9px] font-bold text-slate-400 uppercase">%</span>
              </div>
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <span className="text-[8px] md:text-[10px] font-bold text-slate-500">Dimensions</span>
              <Checkbox checked={showDimensions} onCheckedChange={(val) => setShowDimensions(!!val)} className="scale-75" />
            </div>
          </div>
          <div className="h-14 bg-white/90 backdrop-blur-md border-t flex items-center px-4 gap-4 md:gap-6 shrink-0 z-40 overflow-x-auto no-scrollbar">
            {firstSelectedObject ? (
              <div className="flex items-center gap-4 md:gap-6 min-w-max">
                <div className="flex items-center gap-1.5 md:gap-2 pr-2 md:pr-4 border-r"><Switch checked={firstSelectedObject.isJoined} onCheckedChange={(val) => updateObject(firstSelectedObject.id, { isJoined: val }, true)} className="scale-50 md:scale-75" /><span className="text-[8px] md:text-[9px] font-bold text-slate-500 uppercase">সংযুক্ত</span></div>
                <div className="flex items-center gap-2 md:gap-3">
                  <PropField label="X" value={localPropX} onChange={setLocalPropX} onBlur={() => updateObject(firstSelectedObject.id, { x: parseFeetInches(localPropX) }, true)} disabled={firstSelectedObject.isJoined} />
                  <PropField label="Y" value={localPropY} onChange={setLocalPropY} onBlur={() => updateObject(firstSelectedObject.id, { y: parseFeetInches(localPropY) }, true)} disabled={firstSelectedObject.isJoined} />
                  <PropField label="W" value={localPropW} onChange={setLocalPropW} onBlur={() => updateObject(firstSelectedObject.id, { w: parseFeetInches(localPropW) }, true)} disabled={firstSelectedObject.isJoined} />
                  <PropField label="H" value={localPropH} onChange={setLocalPropH} onBlur={() => updateObject(firstSelectedObject.id, { h: parseFeetInches(localPropH) }, true)} disabled={firstSelectedObject.isJoined} />
                  <PropField label="কোণ" value={localPropRot} onChange={setLocalPropRot} onBlur={() => updateObject(firstSelectedObject.id, { rotation: parseInt(localPropRot) || 0 }, true)} />
                  {firstSelectedObject.subType === 'stair' && (<PropField label="ধাপ" value={localPropSteps} onChange={setLocalPropSteps} onBlur={() => updateObject(firstSelectedObject.id, { stepCount: parseInt(localPropSteps) || 10 }, true)} />)}
                  {firstSelectedObject.type === 'text' && (<PropField label="লেবেল" value={localPropText} onChange={setLocalPropText} onBlur={() => updateObject(firstSelectedObject.id, { textContent: localPropText }, true)} />)}
                </div>
                <div className="flex items-center gap-1 md:gap-1.5 border-l pl-2 md:pl-4">
                  {COLORS.map(c => <div key={c} onClick={() => updateObject(firstSelectedObject.id, { color: c, fillColor: c === '#ffffff' ? '#ffffff' : c }, true)} className={cn("w-4 h-4 md:w-5 md:h-5 rounded-full cursor-pointer border shadow-sm transition-transform hover:scale-110", firstSelectedObject.color === c ? "ring-2 ring-blue-500 ring-offset-1" : "border-slate-200")} style={{ backgroundColor: c }} />)}
                </div>
              </div>
            ) : <div className="flex items-center justify-center w-full text-slate-300 italic text-[9px] md:text-[10px] uppercase tracking-widest font-medium">অবজেক্ট সিলেক্ট করুন</div>}
          </div>
        </div>
      </div>
      <Dialog open={isOpenDialogOpen} onOpenChange={setIsOpenDialogOpen}>
        <DialogContent className="max-w-md bg-white p-0 overflow-hidden rounded-xl border shadow-2xl">
          <DialogHeader className="p-6 bg-slate-50 border-b">
            <DialogTitle className="flex items-center gap-2 text-slate-800"><FolderOpen className="w-5 h-5 text-amber-500" />সেভ করা ডিজাইনগুলো</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] p-4">
            <div className="grid gap-2">
              {savedDesigns.length > 0 ? (
                savedDesigns.map((design) => (
                  <div key={design.id} onClick={() => loadDesign(design.id)} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-blue-50 hover:border-blue-200 cursor-pointer transition-all group">
                    <div className="flex flex-col gap-0.5"><span className="font-bold text-sm text-slate-700 group-hover:text-blue-600">{design.name}</span><span className="text-[10px] text-slate-400">{design.updatedAt ? new Date(design.updatedAt.seconds * 1000).toLocaleString('bn-BD') : "তারিখ অজানা"}</span></div>
                    <div className="flex items-center gap-2"><Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500"><Search className="w-4 h-4" /></Button></div>
                  </div>
                ))
              ) : (<div className="p-8 text-center text-slate-400 italic">কোন ডিজাইন সেভ করা নেই।</div>)}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EstimationView({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState("foundation");
  const [advice, setAdvice] = useState<string | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  
  const [formData, setFormData] = useState({
    baseCount: 0, baseLength: 0, baseWidth: 0, baseThick: 0, baseRodLong: 0, baseRodWidth: 0, baseRodFactor: 0.48,
    columnCount: 0, colLen: 0, colWid: 0, colHeight: 0, colRods: 0, colRodFactor: 0.48, colRingRodFactor: 0.12, colRingGap: 0,
    beamLen: 0, beamHeight: 0, beamWid: 0, beamRods: 0, beamRodFactor: 0.48, beamRingRodFactor: 0.12, beamRingGap: 0,
    slabLen: 0, slabWid: 0, slabThick: 0, slabRodGap: 0, slabRodFactor: 0.30,
    wallLength: 0, wallHeight: 0, wallThick: 5,
    plasterArea: 0, plasterThick: 0, plasterSide: 1,
    floorArea: 0, floorTileLen: 0, floorTileWid: 0, floorTileWastage: 0,
    wallTileArea: 0, wallTileLen: 0, wallTileWid: 0, wallTileWastage: 0
  });

  const handleInputChange = (field: string, val: string) => {
    setFormData(prev => ({ ...prev, [field]: parseFloat(val) || 0 }));
  };

  const calcSection = (name: string) => {
    let cement = 0, sand = 0, stone = 0, rod = 0, bricks = 0, tiles = 0;

    if (name === 'foundation') {
      const vol = (formData.baseLength * formData.baseWidth * (formData.baseThick / 12)) * formData.baseCount;
      if (vol > 0) {
        const dry = vol * 1.54;
        cement = (dry / 5.5) / 1.25; sand = (dry / 5.5) * 1.5; stone = (dry / 5.5) * 3;
        rod = ((formData.baseRodLong * formData.baseLength + formData.baseRodWidth * formData.baseWidth) * formData.baseCount) * formData.baseRodFactor;
      }
    } else if (name === 'column') {
      const vol = (formData.colLen / 12 * formData.colWid / 12 * formData.colHeight) * formData.columnCount;
      if (vol > 0) {
        const dry = vol * 1.54;
        cement = (dry / 5.5) / 1.25; sand = (dry / 5.5) * 1.5; stone = (dry / 5.5) * 3;
        const mainRod = (formData.colHeight * formData.colRods * formData.columnCount) * formData.colRodFactor;
        const ringCount = (formData.colHeight / (formData.colRingGap/12 || 1)) * formData.columnCount;
        const ringRod = (ringCount * (formData.colLen + formData.colWid) * 2 / 12) * formData.colRingRodFactor;
        rod = mainRod + ringRod;
      }
    } else if (name === 'beam') {
      const vol = (formData.beamLen * formData.beamWid / 12 * formData.beamHeight / 12);
      if (vol > 0) {
        const dry = vol * 1.54;
        cement = (dry / 5.5) / 1.25; sand = (dry / 5.5) * 1.5; stone = (dry / 5.5) * 3;
        const mainRod = (formData.beamLen * formData.beamRods) * formData.beamRodFactor;
        const ringCount = (formData.beamLen / (formData.beamRingGap/12 || 1));
        const ringRod = (ringCount * (formData.beamHeight + formData.beamWid) * 2 / 12) * formData.beamRingRodFactor;
        rod = mainRod + ringRod;
      }
    } else if (name === 'slab') {
      const vol = (formData.slabLen * formData.slabWid * (formData.slabThick / 12));
      if (vol > 0) {
        const dry = vol * 1.54;
        cement = (dry / 5.5) / 1.25; sand = (dry / 5.5) * 1.5; stone = (dry / 5.5) * 3;
        rod = ((formData.slabLen / (formData.slabRodGap/12 || 1)) * formData.slabWid + (formData.slabWid / (formData.slabRodGap/12 || 1)) * formData.slabLen) * formData.slabRodFactor;
      }
    } else if (name === 'brickwork') {
      bricks = Math.ceil(formData.wallLength * formData.wallHeight * (formData.wallThick === 5 ? 5 : 10));
      const vol = (formData.wallLength * formData.wallHeight * (formData.wallThick / 12));
      if (vol > 0) {
        const dry = vol * 0.35; 
        cement = (dry / 5) / 1.25; sand = (dry / 5) * 4;
      }
    } else if (name === 'plaster') {
      const vol = (formData.plasterArea * (formData.plasterThick / 12)) * formData.plasterSide;
      if (vol > 0) {
        const dry = vol * 1.54;
        cement = (dry / 5) / 1.25; sand = (dry / 5) * 4;
      }
    } else if (name === 'floorTiles') {
      if (formData.floorArea > 0 && formData.floorTileLen > 0 && formData.floorTileWid > 0) {
        const tileArea = (formData.floorTileLen / 12) * (formData.floorTileWid / 12);
        tiles = Math.ceil((formData.floorArea / tileArea) * (1 + formData.floorTileWastage / 100));
        const dry = formData.floorArea * (1/12) * 1.54;
        cement = (dry / 5) / 1.25; sand = (dry / 5) * 4;
      }
    } else if (name === 'wallTiles') {
      if (formData.wallTileArea > 0 && formData.wallTileLen > 0 && formData.wallTileWid > 0) {
        const tileArea = (formData.wallTileLen / 12) * (formData.wallTileWid / 12);
        tiles = Math.ceil((formData.wallTileArea / tileArea) * (1 + formData.wallTileWastage / 100));
        const dry = formData.wallTileArea * (0.5/12) * 1.54;
        cement = (dry / 5) / 1.25; sand = (dry / 5) * 4;
      }
    }

    return { cement, sand, stone, rod, bricks, tiles };
  };

  const getAdvice = async () => {
    setLoadingAdvice(true);
    const result = await getConstructionAdvice({
      ...formData,
      baseLengthFt: formData.baseLength, baseWidthFt: formData.baseWidth, baseThicknessIn: formData.baseThick,
      columnLengthIn: formData.colLen, columnWidthIn: formData.colWid, columnHeightFt: formData.colHeight,
      columnRodCount: formData.colRods, beamHeightIn: formData.beamHeight, beamWidthIn: formData.beamWid,
      beamLengthFt: formData.beamLen, beamRodCount: formData.beamRods, slabLengthFt: formData.slabLen,
      slabWidthFt: formData.slabWid, slabThicknessIn: formData.slabThick, slabRodGapIn: formData.slabRodGap,
      baseRodLongitudinalCount: formData.baseRodLong, baseRodWidthCount: formData.baseRodWidth,
      ringGapIn: formData.colRingGap || formData.beamRingGap, mainRodFactor: formData.colRodFactor, ringRodFactor: formData.colRingRodFactor
    } as any);
    if (result && 'advice' in result) setAdvice(result.advice);
    setLoadingAdvice(false);
  };

  const sections = ['foundation', 'column', 'beam', 'slab', 'brickwork', 'plaster', 'floorTiles', 'wallTiles'];
  const results = sections.reduce((acc, s) => {
    const res = calcSection(s);
    acc.cement += res.cement; acc.sand += res.sand; acc.stone += res.stone; 
    acc.rod += res.rod; acc.bricks += res.bricks; acc.tiles += res.tiles;
    return acc;
  }, { cement: 0, sand: 0, stone: 0, rod: 0, bricks: 0, tiles: 0 });

  const currentRes = calcSection(activeTab);

  return (
    <div className="flex flex-col h-[100svh] w-full bg-slate-50 overflow-hidden">
      <div className="h-14 bg-white/80 backdrop-blur-md border-b flex items-center px-4 justify-between shadow-sm shrink-0 z-30">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9"><ArrowLeft className="w-5 h-5" /></Button>
          <h2 className="text-sm md:text-lg font-bold text-slate-700 flex items-center gap-2"><Calculator className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" /> নির্মাণ হিসাব ক্যালকুলেটর</h2>
        </div>
        <Button onClick={getAdvice} disabled={loadingAdvice} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-8 md:h-9 text-[10px] md:text-xs">
          {loadingAdvice ? <Loader2 className="animate-spin" /> : <Send className="w-3 h-3" />} এআই পরামর্শ
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-4 md:p-6 pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="bg-white p-4 md:p-6 rounded-xl border shadow-sm">
                <TabsList className="flex w-full h-auto p-1 mb-6 bg-slate-100 overflow-x-auto no-scrollbar gap-1">
                  <TabsTrigger value="foundation" className="text-[10px] md:text-xs px-3 py-2 shrink-0">ফাউন্ডেশন</TabsTrigger>
                  <TabsTrigger value="column" className="text-[10px] md:text-xs px-3 py-2 shrink-0">কলাম</TabsTrigger>
                  <TabsTrigger value="beam" className="text-[10px] md:text-xs px-3 py-2 shrink-0">বিম</TabsTrigger>
                  <TabsTrigger value="slab" className="text-[10px] md:text-xs px-3 py-2 shrink-0">ছাদ</TabsTrigger>
                  <TabsTrigger value="brickwork" className="text-[10px] md:text-xs px-3 py-2 shrink-0">গাথনী</TabsTrigger>
                  <TabsTrigger value="plaster" className="text-[10px] md:text-xs px-3 py-2 shrink-0">প্লাষ্টার</TabsTrigger>
                  <TabsTrigger value="floorTiles" className="text-[10px] md:text-xs px-3 py-2 shrink-0">ফ্লোর টাইলস</TabsTrigger>
                  <TabsTrigger value="wallTiles" className="text-[10px] md:text-xs px-3 py-2 shrink-0">ওয়াল টাইলস</TabsTrigger>
                  <TabsTrigger value="total" className="text-[10px] md:text-xs px-3 py-2 shrink-0 bg-emerald-100 text-emerald-700 font-bold">মোট মালামাল</TabsTrigger>
                </TabsList>

                <TabsContent value="foundation" className="space-y-6 m-0">
                  <div className="grid grid-cols-2 gap-4">
                    <InputField label="বেসের সংখ্যা" value={formData.baseCount} onChange={v => handleInputChange('baseCount', v)} />
                    <InputField label="বেসের দৈর্ঘ্য (ফুট)" value={formData.baseLength} onChange={v => handleInputChange('baseLength', v)} />
                    <InputField label="বেসের প্রস্থ (ফুট)" value={formData.baseWidth} onChange={v => handleInputChange('baseWidth', v)} />
                    <InputField label="পুরুত্ব (ইঞ্চি)" value={formData.baseThick} onChange={v => handleInputChange('baseThick', v)} />
                    <InputField label="রড সংখ্যা (দৈর্ঘ্য বরাবর)" value={formData.baseRodLong} onChange={v => handleInputChange('baseRodLong', v)} />
                    <InputField label="রড সংখ্যা (প্রস্থ বরাবর)" value={formData.baseRodWidth} onChange={v => handleInputChange('baseRodWidth', v)} />
                    <div className="col-span-2 space-y-2"><Label className="text-xs font-bold text-slate-600">রডের ধরন</Label><RodSelect value={formData.baseRodFactor} onChange={v => handleInputChange('baseRodFactor', v)} /></div>
                  </div>
                  <SectionResult res={currentRes} />
                </TabsContent>

                <TabsContent value="column" className="space-y-6 m-0">
                  <div className="grid grid-cols-2 gap-4">
                    <InputField label="কলাম সংখ্যা" value={formData.columnCount} onChange={v => handleInputChange('columnCount', v)} />
                    <InputField label="দৈর্ঘ্য (ইঞ্চি)" value={formData.colLen} onChange={v => handleInputChange('colLen', v)} />
                    <InputField label="প্রস্থ (ইঞ্চি)" value={formData.colWid} onChange={v => handleInputChange('colWid', v)} />
                    <InputField label="উচ্চতা (ফুট)" value={formData.colHeight} onChange={v => handleInputChange('colHeight', v)} />
                    <InputField label="মেইন রড সংখ্যা" value={formData.colRods} onChange={v => handleInputChange('colRods', v)} />
                    <InputField label="রিং গ্যাপ (ইঞ্চি)" value={formData.colRingGap} onChange={v => handleInputChange('colRingGap', v)} />
                    <div className="col-span-1 space-y-2"><Label className="text-xs font-bold text-slate-600">মেইন রড</Label><RodSelect value={formData.colRodFactor} onChange={v => handleInputChange('colRodFactor', v)} /></div>
                    <div className="col-span-1 space-y-2"><Label className="text-xs font-bold text-slate-600">রিং রড</Label><RodSelect value={formData.colRingRodFactor} onChange={v => handleInputChange('colRingRodFactor', v)} limit={3} /></div>
                  </div>
                  <SectionResult res={currentRes} />
                </TabsContent>

                <TabsContent value="beam" className="space-y-6 m-0">
                  <div className="grid grid-cols-2 gap-4">
                    <InputField label="বিমের মোট দৈর্ঘ্য (ফুট)" value={formData.beamLen} onChange={v => handleInputChange('beamLen', v)} />
                    <InputField label="বিম উচ্চতা (ইঞ্চি)" value={formData.beamHeight} onChange={v => handleInputChange('beamHeight', v)} />
                    <InputField label="বিম প্রস্থ (ইঞ্চি)" value={formData.beamWid} onChange={v => handleInputChange('beamWid', v)} />
                    <InputField label="মেইন রড সংখ্যা" value={formData.beamRods} onChange={v => handleInputChange('beamRods', v)} />
                    <InputField label="রিং গ্যাপ (ইঞ্চি)" value={formData.beamRingGap} onChange={v => handleInputChange('beamRingGap', v)} />
                    <div className="col-span-1 space-y-2"><Label className="text-xs font-bold text-slate-600">মেইন রড</Label><RodSelect value={formData.beamRodFactor} onChange={v => handleInputChange('beamRodFactor', v)} /></div>
                    <div className="col-span-1 space-y-2"><Label className="text-xs font-bold text-slate-600">রিং রড</Label><RodSelect value={formData.beamRingRodFactor} onChange={v => handleInputChange('beamRingRodFactor', v)} limit={3} /></div>
                  </div>
                  <SectionResult res={currentRes} />
                </TabsContent>

                <TabsContent value="slab" className="space-y-6 m-0">
                  <div className="grid grid-cols-2 gap-4">
                    <InputField label="ছাদের দৈর্ঘ্য (ফুট)" value={formData.slabLen} onChange={v => handleInputChange('slabLen', v)} />
                    <InputField label="ছাদের প্রস্থ (ফুট)" value={formData.slabWid} onChange={v => handleInputChange('slabWid', v)} />
                    <InputField label="পুরুত্ব (ইঞ্চি)" value={formData.slabThick} onChange={v => handleInputChange('slabThick', v)} />
                    <InputField label="রড গ্যাপ (ইঞ্চি)" value={formData.slabRodGap} onChange={v => handleInputChange('slabRodGap', v)} />
                    <div className="col-span-2 space-y-2"><Label className="text-xs font-bold text-slate-600">রডের ধরন</Label><RodSelect value={formData.slabRodFactor} onChange={v => handleInputChange('slabRodFactor', v)} /></div>
                  </div>
                  <SectionResult res={currentRes} />
                </TabsContent>

                <TabsContent value="brickwork" className="space-y-6 m-0">
                  <div className="grid grid-cols-2 gap-4">
                    <InputField label="দেয়ালের দৈর্ঘ্য (ফুট)" value={formData.wallLength} onChange={v => handleInputChange('wallLength', v)} />
                    <InputField label="দেয়ালের উচ্চতা (ফুট)" value={formData.wallHeight} onChange={v => handleInputChange('wallHeight', v)} />
                    <div className="col-span-2 space-y-2">
                      <Label className="text-xs font-bold text-slate-600">দেয়ালের পুরুত্ব</Label>
                      <Select value={formData.wallThick.toString()} onValueChange={v => handleInputChange('wallThick', v)}>
                        <SelectTrigger className="h-9 bg-slate-50 border-slate-200 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="5">৫ ইঞ্চি দেয়াল</SelectItem><SelectItem value="10">১০ ইঞ্চি দেয়াল</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  <SectionResult res={currentRes} />
                </TabsContent>

                <TabsContent value="plaster" className="space-y-6 m-0">
                  <div className="grid grid-cols-2 gap-4">
                    <InputField label="প্লাষ্টার এরিয়া (স্কয়ার ফুট)" value={formData.plasterArea} onChange={v => handleInputChange('plasterArea', v)} />
                    <InputField label="পুরুত্ব (ইঞ্চি)" value={formData.plasterThick} onChange={v => handleInputChange('plasterThick', v)} />
                    <div className="col-span-2 space-y-2">
                      <Label className="text-xs font-bold text-slate-600">পাশ</Label>
                      <Select value={formData.plasterSide.toString()} onValueChange={v => handleInputChange('plasterSide', v)}>
                        <SelectTrigger className="h-9 bg-slate-50 border-slate-200 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="1">এক পাশ</SelectItem><SelectItem value="2">দুই পাশ</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  <SectionResult res={currentRes} />
                </TabsContent>

                <TabsContent value="floorTiles" className="space-y-6 m-0">
                  <div className="grid grid-cols-2 gap-4">
                    <InputField label="ফ্লোর এরিয়া (স্কয়ার ফুট)" value={formData.floorArea} onChange={v => handleInputChange('floorArea', v)} />
                    <InputField label="টাইলস দৈর্ঘ্য (ইঞ্চি)" value={formData.floorTileLen} onChange={v => handleInputChange('floorTileLen', v)} />
                    <InputField label="টাইলস প্রস্থ (ইঞ্চি)" value={formData.floorTileWid} onChange={v => handleInputChange('floorTileWid', v)} />
                    <InputField label="অপচয় (%)" value={formData.floorTileWastage} onChange={v => handleInputChange('floorTileWastage', v)} />
                  </div>
                  <SectionResult res={currentRes} />
                </TabsContent>

                <TabsContent value="wallTiles" className="space-y-6 m-0">
                  <div className="grid grid-cols-2 gap-4">
                    <InputField label="দেয়ালের ক্ষেত্রফল (স্কয়ার ফুট)" value={formData.wallTileArea} onChange={v => handleInputChange('wallTileArea', v)} />
                    <InputField label="টাইলস দৈর্ঘ্য (ইঞ্চি)" value={formData.wallTileLen} onChange={v => handleInputChange('wallTileLen', v)} />
                    <InputField label="টাইলস প্রস্থ (ইঞ্চি)" value={formData.wallTileWid} onChange={v => handleInputChange('wallTileWid', v)} />
                    <InputField label="অপচয় (%)" value={formData.wallTileWastage} onChange={v => handleInputChange('wallTileWastage', v)} />
                  </div>
                  <SectionResult res={currentRes} />
                </TabsContent>

                <TabsContent value="total" className="space-y-6 m-0">
                  <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-200 space-y-4">
                    <h3 className="font-bold text-emerald-800 flex items-center gap-2"><Boxes className="w-5 h-5" /> মোট সমন্বিত মালামাল</h3>
                    <div className="grid gap-3">
                      <ResultRow label="সিমেন্ট" value={results.cement} unit="ব্যাগ" dark />
                      <ResultRow label="বালু" value={results.sand} unit="সিএফটি" dark />
                      <ResultRow label="পাথর/খোয়া" value={results.stone} unit="সিএফটি" dark />
                      <ResultRow label="রড" value={results.rod} unit="কেজি" dark />
                      <ResultRow label="ইট" value={results.bricks} unit="টি" dark />
                      <ResultRow label="টাইলস (মোট)" value={results.tiles} unit="টি" dark />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {advice && (
                <div className="bg-white p-5 rounded-xl border shadow-sm">
                  <h3 className="text-md font-bold text-emerald-700 mb-3 flex items-center gap-2">⭐ এআই বিশেষজ্ঞ পরামর্শ</h3>
                  <div className="text-[12px] md:text-sm leading-relaxed whitespace-pre-wrap text-slate-600">{advice}</div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-slate-800 text-white p-5 rounded-xl shadow-lg sticky top-6">
                <h3 className="text-md font-bold mb-4 border-b border-white/20 pb-2 flex items-center gap-2"><Calculator className="w-4 h-4" /> ইনস্ট্যান্ট সামারি</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-[11px]"><span className="opacity-70">সিমেন্ট:</span><span className="font-bold">{Math.ceil(results.cement)} ব্যাগ</span></div>
                  <div className="flex justify-between text-[11px]"><span className="opacity-70">বালু:</span><span className="font-bold">{Math.ceil(results.sand)} CFT</span></div>
                  <div className="flex justify-between text-[11px]"><span className="opacity-70">রড:</span><span className="font-bold">{Math.ceil(results.rod)} KG</span></div>
                  <div className="flex justify-between text-[11px]"><span className="opacity-70">ইট:</span><span className="font-bold">{results.bricks} টি</span></div>
                  <div className="flex justify-between text-[11px]"><span className="opacity-70">টাইলস:</span><span className="font-bold">{results.tiles} টি</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionResult({ res }: { res: any }) {
  const hasValues = res.cement > 0 || res.rod > 0 || res.bricks > 0 || res.tiles > 0;
  if (!hasValues) return <div className="p-4 bg-slate-50 border border-dashed rounded-lg text-center text-[10px] text-slate-400">এই সেকশনে কোন ইনপুট দেওয়া হয়নি</div>;
  return (
    <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 space-y-2">
      <h4 className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">সেকশন রেজাল্ট</h4>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {res.cement > 0 && <ResultRow label="সিমেন্ট" value={res.cement} unit="ব্যাগ" small />}
        {res.sand > 0 && <ResultRow label="বালু" value={res.sand} unit="সিএফটি" small />}
        {res.stone > 0 && <ResultRow label="পাথর" value={res.stone} unit="সিএফটি" small />}
        {res.rod > 0 && <ResultRow label="রড" value={res.rod} unit="কেজি" small />}
        {res.bricks > 0 && <ResultRow label="ইট" value={res.bricks} unit="টি" small />}
        {res.tiles > 0 && <ResultRow label="টাইলস" value={res.tiles} unit="টি" small />}
      </div>
    </div>
  );
}

function ResultRow({ label, value, unit, small, dark }: { label: string, value: number, unit: string, small?: boolean, dark?: boolean }) {
  return (
    <div className={cn(
      "flex justify-between items-center rounded-lg border",
      small ? "p-2 bg-white" : "p-3 bg-white/10",
      dark ? "bg-white border-emerald-100" : "border-slate-100"
    )}>
      <span className={cn("font-medium", small ? "text-[9px]" : "text-[11px]", dark ? "text-emerald-900" : "text-slate-600")}>{label}</span>
      <span className={cn("font-black", small ? "text-[10px]" : "text-[12px]", dark ? "text-emerald-700" : "text-slate-900")}>{Math.ceil(value)} {unit}</span>
    </div>
  );
}

function RodSelect({ value, onChange, limit }: { value: number, onChange: (v: string) => void, limit?: number }) {
  const options = limit ? ROD_OPTIONS.slice(0, limit) : ROD_OPTIONS;
  return (
    <Select value={value.toString()} onValueChange={onChange}>
      <SelectTrigger className="bg-slate-50 h-9 text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>{options.map(opt => <SelectItem key={opt.value} value={opt.value.toString()} className="text-xs">{opt.label}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function InputField({ label, value, onChange }: { label: string, value: number, onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-bold text-slate-600">{label}</Label>
      <Input type="number" value={value === 0 ? "" : value} onChange={e => onChange(e.target.value)} placeholder="0" className="h-9 bg-slate-50 border-slate-200 text-xs" />
    </div>
  );
}

function RibbonButton({ icon, label, onClick, active }: { icon: React.ReactNode, label: string, onClick: () => void, active?: boolean }) {
  return <Button variant="ghost" className={cn("h-12 md:h-14 flex flex-col gap-0.5 md:gap-1 px-2 md:px-3", active && "bg-slate-100 text-blue-600")} onClick={onClick}>{React.cloneElement(icon as React.ReactElement, { className: "w-4 h-4 md:w-5 md:h-5" })}<span className="text-[8px] md:text-[9px] uppercase font-bold tracking-tight">{label}</span></Button>;
}

function SymbolButton({ icon, label, onClick, active }: { icon: React.ReactNode, label: string, onClick: () => void, active?: boolean }) {
  return <div onClick={onClick} className={cn("flex items-center gap-2 p-1.5 md:p-2 rounded-md cursor-pointer border transition-all", active ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50")}><div className="shrink-0 scale-75 md:scale-100">{icon}</div><span className="text-[8px] md:text-[10px] font-bold uppercase whitespace-nowrap">{label}</span></div>;
}

function PropField({ label, value, onChange, onBlur, disabled }: { label: string, value: string, onChange: (v: string) => void, onBlur: () => void, disabled?: boolean }) {
  return <div className="flex items-center gap-1"><span className="text-[8px] md:text-[10px] font-black text-slate-300 uppercase min-w-[15px] md:min-w-[50px]">{label}</span><Input className="h-6 md:h-7 w-16 md:w-24 text-[9px] md:text-[11px] font-bold text-center border-slate-200" value={value} onChange={e => onChange(e.target.value)} disabled={disabled} onBlur={onBlur} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></div>;
}
