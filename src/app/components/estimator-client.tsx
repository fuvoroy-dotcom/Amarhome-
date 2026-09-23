
"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { 
  Building, LayoutGrid, 
  RectangleHorizontal, Trash2, 
  Clipboard as ClipboardIcon, Copy as CopyIcon, Undo2, Redo2,
  Pencil, ZoomIn, ZoomOut,
  RotateCw, Save, User,
  Bold as BoldIcon,
  MousePointer2, Square, DoorOpen, Wind, TowerControl as PillarIcon,
  ImageIcon,
  Rows, FilePlus, FolderOpen, Search,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Hand, Calculator, ArrowLeft, Send, Loader2,
  Layers, Boxes, Plus, X,
  ArrowUpToLine, FileText, Download, Type as TypeIcon, Cloud,
  TrendingUp, Sparkles, ShieldCheck, ClipboardList, Bed, Armchair, UtensilsCrossed, Bath, Magnet, CookingPot, Maximize2,
  ArrowUpRight as StairIcon,
  Lightbulb, Fan, Zap, Droplets, Trees, Flower2, Car
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
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
import { doc, setDoc, getDoc, getDocs, deleteDoc, collection, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useAuth } from '@/firebase/auth-context';
import { uploadDesignSnapshot, uploadExportBlob } from '@/firebase/storage-service';
import { UserProfileMenu } from '@/components/user-profile-menu';
import { CloudGalleryDialog } from '@/components/cloud-gallery-dialog';
import { ThreeDViewDialog } from '@/components/three-d-view-dialog';
import { MarketPriceSyncDialog, MaterialPrices } from '@/components/market-price-sync-dialog';
import { AdvancedPdfReportDialog } from '@/components/advanced-pdf-report-dialog';
import { BnbcStructuralAuditDialog } from '@/components/bnbc-structural-audit-dialog';
import { DailySiteManagementDialog } from '@/components/daily-site-management-dialog';
import { StructuralDetailingDialog } from '@/components/cad/structural-detailing-dialog';
import { SectionGeneratorDialog } from '@/components/cad/section-generator-dialog';
import { SitePlanSetbackDialog } from '@/components/cad/site-plan-setback-dialog';
import { MepStudioDialog } from '@/components/cad/mep-studio-dialog';
import { InteriorLandscapeDialog } from '@/components/cad/interior-landscape-dialog';
import html2canvas from 'html2canvas';
import { getConstructionAdvice } from "@/app/actions";


type DesignObject = {
  id: string;
  type: 'structure' | 'opening' | 'shape' | 'text' | 'pillar' | 'table' | 'stair' | 'furniture' | 'mep' | 'landscape';
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
  points?: {x: number, y: number}[];
  depth?: number; 
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
  { label: '8 mm (2.5 Suta)', factor: 0.12 },
  { label: '10 mm (3 Suta)', factor: 0.19 },
  { label: '12 mm (4 Suta)', factor: 0.30 },
  { label: '16 mm (5 Suta)', factor: 0.48 },
  { label: '20 mm (6 Suta)', factor: 0.75 },
  { label: '22 mm (7 Suta)', factor: 0.90 },
  { label: '25 mm (8 Suta)', factor: 1.17 },
];

export default function EstimatorClient() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isCloudGalleryOpen, setIsCloudGalleryOpen] = useState(false);
  const [isCloudUploading, setIsCloudUploading] = useState(false);
  const [is3DViewOpen, setIs3DViewOpen] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const bottomBarRef = useRef<HTMLDivElement>(null);
  const [designObjects, setDesignObjects] = useState<DesignObject[]>([]);
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<DesignObject[]>([]);
  const [interactionMode, setInteractionMode] = useState<'none' | 'dragging' | 'resizing' | 'rotating' | 'drawing' | 'selecting' | 'pasting' | 'panning' | 'drawing-poly'>('none');
  const [selectedTool, setSelectedTool] = useState<string>('select');
  const [drawStart, setDrawStart] = useState<{x: number, y: number} | null>(null);
  const [tempDrawEnd, setTempDrawEnd] = useState<{x: number, y: number} | null>(null);
  const [dragOffsets, setDragOffsets] = useState<{ [id: string]: { x: number, y: number } }>({});
  const [lastPanPos, setLastPanPos] = useState<{ x: number, y: number } | null>(null);
  const [polyPoints, setPolyPoints] = useState<{x: number, y: number}[]>([]);
  
  const [zoom, setZoom] = useState(40);
  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(0);

  const displayZoom = useMemo(() => zoom * 0.5, [zoom]);
  const safeDisplayZoom = useMemo(() => Math.max(displayZoom, 0.1), [displayZoom]);

  const [currentWallThickness, setCurrentWallThickness] = useState(0.4166);
  const [currentBeamLength, setCurrentBeamLength] = useState(10);
  const [currentBeamWidth, setCurrentBeamWidth] = useState(0.833);
  const [currentBeamDepth, setCurrentBeamDepth] = useState(12); 
  const [history, setHistory] = useState<DesignObject[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [showDimensions, setShowDimensions] = useState(false);
  const [showPillarDistances, setShowPillarDistances] = useState(false);
  const [unitSystem, setUnitSystem] = useState<'imperial' | 'metric'>('imperial');
  const [isMarketSyncOpen, setIsMarketSyncOpen] = useState(false);
  const [isAdvancedPdfReportOpen, setIsAdvancedPdfReportOpen] = useState(false);
  const [pdfReportPayload, setPdfReportPayload] = useState<{ total: any; grandTotalCost: number } | null>(null);
  const [isBnbcAuditOpen, setIsBnbcAuditOpen] = useState(false);
  const [isSiteLedgerOpen, setIsSiteLedgerOpen] = useState(false);
  const [isStructuralDetailingOpen, setIsStructuralDetailingOpen] = useState(false);
  const [isSectionCutOpen, setIsSectionCutOpen] = useState(false);
  const [isSitePlanSetbackOpen, setIsSitePlanSetbackOpen] = useState(false);
  const [isMepStudioOpen, setIsMepStudioOpen] = useState(false);
  const [isInteriorLandscapeOpen, setIsInteriorLandscapeOpen] = useState(false);
  const [isSmartSnapEnabled, setIsSmartSnapEnabled] = useState(true);
  const [activeSnapGuides, setActiveSnapGuides] = useState<{ x?: number; y?: number } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{x1: number, y1: number, x2: number, y2: number} | null>(null);

  const [projectName, setProjectName] = useState("নতুন প্রজেক্ট");
  const [currentDesignId, setCurrentDesignId] = useState(Math.random().toString(36).substr(2, 9));
  const [savedDesigns, setSavedDesigns] = useState<SavedDesignRef[]>([]);
  const [isOpenDialogOpen, setIsOpenDialogOpen] = useState(false);
  const [isEstimationDialogOpen, setIsEstimationDialogOpen] = useState(false);

  const gridConfig = useMemo(() => {
    if (zoom < 10) return { interval: 20, minor: 5, labelScale: 0.8 };
    if (zoom < 25) return { interval: 10, minor: 2, labelScale: 0.9 };
    return { interval: 4, minor: 1, labelScale: 1.0 };
  }, [zoom]);

  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportSettings, setExportSettings] = useState({
    format: 'png' as 'png' | 'pdf',
    area: 'all' as 'all' | 'custom',
    xStart: 0, xEnd: 60, yStart: 0, yEnd: 60,
    targetProjectId: '',
    showDimensions: false,
    showPillars: false
  });

  const [foundations, setFoundations] = useState([{ id: '1', count: 0, len: 0, wid: 0, thick: 0, rodLong: 0, rodWidth: 0, rodFactor: 0.48, aggregateType: 'stone' }]);
  const [columns, setColumns] = useState([{ id: '1', count: 0, len: 0, wid: 0, height: 0, rods: 0, rodFactor: 0.48, ringRodFactor: 0.12, ringGap: 6, aggregateType: 'stone' }]);
  const [beams, setBeams] = useState([{ id: '1', len: 0, height: 0, wid: 0, rods: 0, rodFactor: 0.48, ringRodFactor: 0.12, ringGap: 6, aggregateType: 'stone' }]);
  const [slabs, setSlabs] = useState([{ id: '1', len: 0, wid: 0, thick: 0, rodGap: 5, rodFactor: 0.30, aggregateType: 'stone' }]);
  const [stairs, setStairs] = useState([{ id: '1', count: 0, wLen: 0, wid: 0, thick: 5, steps: 10, riser: 6, tread: 10, lLen: 0, lWid: 0, mainFactor: 0.30, distFactor: 0.19, mainGap: 5, distGap: 6, aggregateType: 'stone' }]);
  const [brickworks, setBrickworks] = useState([{ id: '1', len: 0, height: 0, thick: 5 }]);
  const [plasters, setPlasters] = useState([{ id: '1', len: 0, height: 0, thick: 0.5, sides: 1 }]);
  const [floorTiles, setFloorTiles] = useState([{ id: '1', len: 0, wid: 0, tLen: 0, tWid: 0, wastage: 10 }]);
  const [wallTiles, setWallTiles] = useState([{ id: '1', len: 0, height: 0, tLen: 0, tWid: 0, wastage: 10 }]);
  const [septicTanks, setSepticTanks] = useState([{ id: '1', count: 0, len: 0, wid: 0, depth: 0, aggregateType: 'stone' }]);
  const [soakWells, setSoakWells] = useState([{ id: '1', count: 0, dia: 0, depth: 0 }]);
  const [prices, setPrices] = useState({
    cement: 0, sand: 0, stone: 0, chips: 0, rod: 0, bricks: 0, floorTiles: 0, wallTiles: 0, labor: 0, doors: 0, windows: 0,
    electric: 0, fittings: 0, paint: 0, others: 0
  });

  const [materialsLedger, setMaterialsLedger] = useState<any[]>([]);
  const [laborLedger, setLaborLedger] = useState<any[]>([]);

  const [localPropX, setLocalPropX] = useState("");
  const [localPropY, setLocalPropY] = useState("");
  const [localPropW, setLocalPropW] = useState("");
  const [localPropH, setLocalPropH] = useState("");
  const [localPropRot, setLocalPropRot] = useState("");
  const [localPropSteps, setLocalPropSteps] = useState("");
  const [localPropText, setLocalPropText] = useState("");
  const [localPropFontSize, setLocalPropFontSize] = useState("");
  const [localPropDepth, setLocalPropDepth] = useState("12");

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

  const formatDimension = (val: number, system = unitSystem) => {
    if (system === 'metric') {
      const meters = Math.abs(val) * 0.3048;
      if (meters < 1 && meters > 0) {
        return `${Math.round(meters * 100)} cm`;
      }
      return `${meters.toFixed(2)} m`;
    }
    return formatFeetInches(val);
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

  const parseDimensionInput = (str: string, system = unitSystem) => {
    if (!str || str.trim() === "") return 0;
    const s = str.trim().toLowerCase();
    if (system === 'metric') {
      if (s.endsWith('cm')) {
        const cm = parseFloat(s.replace('cm', '')) || 0;
        return (cm / 100) / 0.3048;
      }
      if (s.endsWith('m')) {
        const m = parseFloat(s.replace('m', '')) || 0;
        return m / 0.3048;
      }
      const num = parseFloat(s);
      return isNaN(num) ? 0 : num / 0.3048;
    }
    return parseFeetInches(str);
  };

  const firstSelectedObject = useMemo(() => designObjects.find(obj => obj.id === selectedObjectIds[0]), [designObjects, selectedObjectIds]);

  useEffect(() => {
    if (firstSelectedObject) {
      setLocalPropX(formatDimension(firstSelectedObject.x, unitSystem));
      setLocalPropY(formatDimension(firstSelectedObject.y, unitSystem));
      setLocalPropW(formatDimension(firstSelectedObject.w, unitSystem));
      setLocalPropH(formatDimension(firstSelectedObject.h, unitSystem));
      setLocalPropRot(firstSelectedObject.rotation.toString());
      setLocalPropSteps((firstSelectedObject.stepCount || 10).toString());
      setLocalPropText(firstSelectedObject.textContent || "");
      setLocalPropFontSize((firstSelectedObject.fontSize || 14).toString());
    }
  }, [firstSelectedObject?.id, firstSelectedObject?.x, firstSelectedObject?.y, firstSelectedObject?.w, firstSelectedObject?.h, firstSelectedObject?.rotation, firstSelectedObject?.stepCount, firstSelectedObject?.textContent, firstSelectedObject?.fontSize, unitSystem]);

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

  const handleExport = async (exportMode: 'download' | 'cloud' = 'download') => {
    try {
      let objectsToExport = designObjects;
      let nameToExport = projectName;

      if (exportSettings.targetProjectId && exportSettings.targetProjectId !== currentDesignId) {
        const { firestore } = initializeFirebase();
        const docRef = doc(firestore, 'designs', exportSettings.targetProjectId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          objectsToExport = data.objects || [];
          nameToExport = data.name || "design";
        }
      }

      let xMin = 0, xMax = 60, yMin = 0, yMax = 60;
      if (exportSettings.area === 'custom') {
        xMin = Math.min(exportSettings.xStart, exportSettings.xStart);
        xMax = Math.max(exportSettings.xStart, exportSettings.xEnd);
        yMin = Math.min(exportSettings.yStart, exportSettings.yStart);
        yMax = Math.max(exportSettings.yStart, exportSettings.yEnd);
      }
      
      const wFt = xMax - xMin;
      const hFt = yMax - yMin;
      const exportZoom = 50; 
      const pW = wFt * exportZoom;
      const pH = hFt * exportZoom;
      
      const exportContainer = document.createElement('div');
      exportContainer.style.position = 'absolute';
      exportContainer.style.left = '0px';
      exportContainer.style.top = '0px';
      exportContainer.style.width = `${pW}px`;
      exportContainer.style.height = `${pH}px`;
      exportContainer.style.backgroundColor = '#ffffff';
      exportContainer.style.overflow = 'hidden';
      exportContainer.style.zIndex = '-99999';
      document.body.appendChild(exportContainer);

      objectsToExport.forEach(obj => {
        if (obj.x + obj.w < xMin || obj.x > xMax || obj.y + obj.h < yMin || obj.y > yMax) return;

        let ox = 0, oy = 0;
        if (obj.rotation === 90) ox = obj.h;
        else if (obj.rotation === 180) { ox = obj.w; oy = obj.h; }
        else if (obj.rotation === 270) oy = obj.w;

        const leftPx = (obj.x - xMin + ox) * exportZoom;
        const topPx = (obj.y - yMin + oy) * exportZoom;
        const widthPx = obj.w * exportZoom;
        const heightPx = obj.h * exportZoom;

        const objDiv = document.createElement('div');
        objDiv.style.position = 'absolute';
        objDiv.style.left = `${leftPx}px`;
        objDiv.style.top = `${topPx}px`;
        objDiv.style.width = `${widthPx}px`;
        objDiv.style.height = `${heightPx}px`;
        objDiv.style.transformOrigin = '0 0';
        objDiv.style.transform = `rotate(${obj.rotation}deg)`;
        objDiv.style.overflow = 'visible'; 
        
        const isStructure = obj.subType === 'wall' || obj.subType === 'pillar';
        const isBeam = obj.subType === 'beam';
        const isPillar = obj.subType === 'pillar' || obj.type === 'pillar';
        if (isBeam) {
          objDiv.style.backgroundColor = 'rgba(59, 130, 246, 0.15)';
          objDiv.style.border = '1.5px dashed #2563eb';
          const bIndex = objectsToExport.filter(o => o.subType === 'beam').findIndex(o => o.id === obj.id);
          const beamLabel = obj.label && obj.label !== 'Beam' && obj.label !== 'BEAM' ? obj.label : `B${bIndex >= 0 ? bIndex + 1 : 1}`;
          objDiv.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;"><span style="font-size:10px;font-weight:900;color:#1d4ed8;background:rgba(255,255,255,0.95);padding:1px 5px;border-radius:2px;border:1px solid #bfdbfe;white-space:nowrap;">${beamLabel}</span></div>`;
        } else if (isPillar) {
          objDiv.style.backgroundColor = obj.color;
          objDiv.style.border = '1px solid rgba(0,0,0,0.5)';
          const pIndex = objectsToExport.filter(o => o.subType === 'pillar' || o.type === 'pillar').findIndex(o => o.id === obj.id);
          const pillarLabel = obj.label && obj.label !== 'Pillar' ? obj.label : `C${pIndex >= 0 ? pIndex + 1 : 1}`;
          objDiv.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;"><span style="font-size:${10 * (exportZoom/40)}px;font-weight:900;color:white;white-space:nowrap;">${pillarLabel}</span></div>`;
        } else if (isStructure) {
          objDiv.style.backgroundColor = obj.color;
          objDiv.style.border = '1px solid rgba(0,0,0,0.5)';
        }
        
        const sw = 1 / exportZoom;
        let svgContent = '';
        if (obj.type === 'opening') {
          if (obj.subType === 'window') {
            svgContent = `<svg width="100%" height="100%" viewBox="0 0 ${obj.w} ${obj.h}" preserveAspectRatio="none" style="overflow: visible"><rect x="0" y="0" width="${obj.w}" height="${obj.h}" fill="white" stroke="none"/><rect x="0" y="0" width="${obj.w}" height="${obj.h}" fill="white" stroke="${obj.color}" stroke-width="${sw * 3}"/><line x1="0" y1="${obj.h * 0.25}" x2="${obj.w}" y2="${obj.h * 0.25}" stroke="${obj.color}" stroke-width="${sw * 1.5}"/><line x1="0" y1="${obj.h * 0.75}" x2="${obj.w}" y2="${obj.h * 0.75}" stroke="${obj.color}" stroke-width="${sw * 1.5}"/></svg>`;
          } else if (obj.subType === 'door-1') {
            svgContent = `<svg width="100%" height="100%" viewBox="0 0 ${obj.w} ${obj.h}" preserveAspectRatio="none" style="overflow: visible"><rect x="0" y="0" width="${obj.w}" height="${obj.h}" fill="white" stroke="none"/><line x1="${obj.w}" y1="${obj.h}" x2="${obj.w}" y2="${obj.h - obj.w}" stroke="${obj.color}" stroke-width="${sw * 4}"/><path d="M ${obj.w} ${obj.h - obj.w} A ${obj.w} ${obj.w} 0 0 0 0 ${obj.h}" fill="none" stroke="${obj.color}" stroke-width="${sw * 2}" stroke-dasharray="${sw*3},${sw*3}"/></svg>`;
          } else if (obj.subType === 'door-2') {
            svgContent = `<svg width="100%" height="100%" viewBox="0 0 ${obj.w} ${obj.h}" preserveAspectRatio="none" style="overflow: visible"><rect x="0" y="0" width="${obj.w}" height="${obj.h}" fill="white" stroke="none"/><line x1="0" y1="${obj.h}" x2="0" y2="${obj.h - obj.w}" stroke="${obj.color}" stroke-width="${sw * 4}"/><path d="M 0 ${obj.h - obj.w} A ${obj.w} ${obj.w} 0 0 1 ${obj.w} ${obj.h}" fill="none" stroke="${obj.color}" stroke-width="${sw * 2}" stroke-dasharray="${sw*3},${sw*3}"/></svg>`;
          } else if (obj.subType === 'door-3') {
            svgContent = `<svg width="100%" height="100%" viewBox="0 0 ${obj.w} ${obj.h}" preserveAspectRatio="none" style="overflow: visible"><rect x="0" y="0" width="${obj.w}" height="${obj.h}" fill="white" stroke="none"/><line x1="${obj.w}" y1="0" x2="${obj.w}" y2="${obj.w}" stroke="${obj.color}" stroke-width="${sw * 4}"/><path d="M ${obj.w} ${obj.w} A ${obj.w} ${obj.w} 0 0 1 0 0" fill="none" stroke="${obj.color}" stroke-width="${sw * 2}" stroke-dasharray="${sw*3},${sw*3}"/></svg>`;
          } else if (obj.subType === 'door-4') {
            svgContent = `<svg width="100%" height="100%" viewBox="0 0 ${obj.w} ${obj.h}" preserveAspectRatio="none" style="overflow: visible"><rect x="0" y="0" width="${obj.w}" height="${obj.h}" fill="white" stroke="none"/><line x1="0" y1="0" x2="0" y2="${obj.w}" stroke="${obj.color}" stroke-width="${sw * 4}"/><path d="M 0 ${obj.w} A ${obj.w} ${obj.w} 0 0 0 ${obj.w} 0" fill="none" stroke="${obj.color}" stroke-width="${sw * 2}" stroke-dasharray="${sw*3},${sw*3}"/></svg>`;
          } else if (obj.subType === 'double-door') {
            svgContent = `<svg width="100%" height="100%" viewBox="0 0 ${obj.w} ${obj.h}" preserveAspectRatio="none" style="overflow: visible"><rect x="0" y="0" width="${obj.w}" height="${obj.h}" fill="white" stroke="none"/><line x1="0" y1="${obj.h}" x2="0" y2="${obj.h - obj.w/2} " stroke="${obj.color}" stroke-width="${sw * 4}"/><path d="M 0 ${obj.h - obj.w/2} A ${obj.w/2} ${obj.w/2} 0 0 1 ${obj.w/2} ${obj.h}" fill="none" stroke="${obj.color}" stroke-width="${sw * 2}" stroke-dasharray="${sw*3},${sw*3}"/><line x1="${obj.w}" y1="${obj.h}" x2="${obj.w}" y2="${obj.h - obj.w/2}" stroke="${obj.color}" stroke-width="${sw * 4}"/><path d="M ${obj.w} ${obj.h - obj.w/2} A ${obj.w/2} ${obj.w/2} 0 0 0 ${obj.w/2} ${obj.h}" fill="none" stroke="${obj.color}" stroke-width="${sw * 2}" stroke-dasharray="${sw*3},${sw*3}"/></svg>`;
          } else if (obj.subType === 'sliding-door') {
            svgContent = `<svg width="100%" height="100%" viewBox="0 0 ${obj.w} ${obj.h}" preserveAspectRatio="none" style="overflow: visible"><rect x="0" y="${obj.h*0.25}" width="${obj.w}" height="${obj.h*0.5}" fill="none" stroke="${obj.color}" stroke-width="${sw * 2}"/><line x1="${obj.w * 0.4}" y1="${obj.h*0.25}" x2="${obj.w * 0.4}" y2="${obj.h*0.75}" stroke="${obj.color}" stroke-width="${sw * 2}"/><line x1="${obj.w * 0.4} " y1="${obj.h*0.5}" x2="${obj.w * 0.9}" y2="${obj.h*0.5}" stroke="${obj.color}" stroke-width="${sw * 4}"/></svg>`;
          }
        } else if (obj.subType === 'stair-u') {
          const steps = obj.stepCount || 15;
          const landingH = obj.h * 0.25;
          const flightW = obj.w * 0.3;
          const midFlightH = obj.h - 2 * landingH;
          const sCount = Math.floor(steps / 3);
          const stepH = midFlightH / sCount;
          const stepW = (obj.w - 2 * flightW) / sCount;
          let stairLines = '';
          for (let i = 0; i < sCount; i++) {
            stairLines += `<line x1="0" y1="${obj.h - landingH - (i * stepH)}" x2="${flightW}" y2="${obj.h - landingH - (i * stepH)}" stroke="${obj.color}" stroke-width="${sw}"/>`;
            stairLines += `<line x1="${flightW + (i * stepW)}" y1="${landingH}" x2="${flightW + (i * stepW)}" y2="0" stroke="${obj.color}" stroke-width="${sw}"/>`;
            stairLines += `<line x1="${obj.w - flightW}" y1="${landingH + (i * stepH)}" x2="${obj.w}" y2="${landingH + (i * stepH)}" stroke="${obj.color}" stroke-width="${sw}"/>`;
          }
          svgContent = `<svg width="100%" height="100%" viewBox="0 0 ${obj.w} ${obj.h}" preserveAspectRatio="none" style="overflow: visible"><rect x="0" y="0" width="${obj.w}" height="${obj.h}" fill="white" stroke="${obj.color}" stroke-width="${sw * 2}"/><line x1="${flightW}" y1="0" x2="${flightW}" y2="${obj.h}" stroke="${obj.color}" stroke-width="${sw * 2}"/><line x1="${obj.w - flightW}" y1="0" x2="${obj.w - flightW}" y2="${obj.h}" stroke="${obj.color}" stroke-width="${sw * 2}"/><line x1="${flightW}" y1="${landingH}" x2="${obj.w - flightW}" y2="${landingH}" stroke="${obj.color}" stroke-width="${sw * 2}"/><line x1="${flightW}" y1="${obj.h - landingH}" x2="${obj.w - flightW}" y2="${obj.h - landingH}" stroke="${obj.color}" stroke-width="${sw * 2}">${stairLines}</svg>`;
        } else if (obj.subType === 'stair-dogleg') {
          const steps = obj.stepCount || 10;
          const landingH = obj.h * 0.2;
          const railW = obj.w * 0.1;
          const flightW = (obj.w - railW) / 2;
          const midH = obj.h - landingH;
          const sCount = Math.floor(steps / 2);
          const stepH = midH / sCount;
          let stairLines = '';
          for (let i = 0; i < sCount; i++) {
            stairLines += `<line x1="0" y1="${landingH + (i+1) * stepH}" x2="${flightW}" y2="${landingH + (i+1) * stepH}" stroke="${obj.color}" stroke-width="${sw}"/>`;
            stairLines += `<line x1="${obj.w - flightW}" y1="${landingH + (i+1) * stepH}" x2="${obj.w}" y2="${landingH + (i+1) * stepH}" stroke="${obj.color}" stroke-width="${sw}"/>`;
          }
          svgContent = `<svg width="100%" height="100%" viewBox="0 0 ${obj.w} ${obj.h}" preserveAspectRatio="none" style="overflow: visible"><rect x="0" y="0" width="${obj.w}" height="${obj.h}" fill="white" stroke-width="${sw * 2}"/><line x1="0" y1="${landingH}" x2="${obj.w}" y2="${landingH}" stroke="${obj.color}" stroke-width="${sw * 2}"/><line x1="${flightW}" y1="${landingH}" x2="${flightW}" y2="${obj.h}" stroke="${obj.color}" stroke-width="${sw * 2}"/><line x1="${obj.w - flightW}" y1="${landingH}" x2="${obj.w - flightW}" y2="${landingH}" stroke="${obj.color}" stroke-width="${sw * 2}"/>${stairLines}</svg>`;
        } else if (obj.type === 'text') {
          const labelText = obj.textContent || obj.label;
          const dimText = `L: ${formatDimension(Math.max(obj.w, obj.h))} × W: ${formatDimension(Math.min(obj.w, obj.h))}`;
          objDiv.innerHTML = `<div style="color:${obj.color}; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; font-family:Inter, sans-serif; font-weight:${obj.isBold ? '900' : 'normal'}; font-size:${(obj.fontSize || 14) * (exportZoom / 16)}px; width:100%; height:100%; text-transform:uppercase;"><div>${labelText}</div><div style="font-size:0.85em; opacity:0.8;">(${dimText})</div></div>`;
        } else if (obj.subType === 'area-marker' && obj.points) {
          const pts = obj.points.map(p => `${(p.x - obj.x) * exportZoom},${(p.y - obj.y) * exportZoom}`).join(' ');
          svgContent = `<svg width="100%" height="100%" style="overflow: visible"><polygon points="${pts}" fill="rgba(59, 130, 246, 0.15)" stroke="#3b82f6" stroke-width="2" stroke-dasharray="4,4" /></svg>`;
        }

        if (svgContent) {
          objDiv.innerHTML = svgContent;
        }
        exportContainer.appendChild(objDiv);
      });

      if (exportSettings.showDimensions) {
        objectsToExport.forEach(obj => {
          if (obj.x + obj.w < xMin || obj.x > xMax || obj.y + obj.h < yMin || obj.y > yMax) return;
          const hLabel = document.createElement('div');
          hLabel.style.position = 'absolute';
          hLabel.style.left = `${(obj.x - xMin) * exportZoom}px`;
          hLabel.style.top = `${(obj.y - yMin - 0.8) * exportZoom}px`;
          hLabel.style.width = `${obj.w * exportZoom}px`;
          hLabel.style.display = 'flex';
          hLabel.style.justifyContent = 'center';
          hLabel.style.pointerEvents = 'none';
          hLabel.innerHTML = `<div style="background:white; border:1px solid #64748b; border-radius:2px; padding:0 4px; font-weight:900; color:#0f172a; font-size:${10 * (exportZoom/40)}px; white-space:nowrap;">${formatDimension(obj.w)}</div>`;
          exportContainer.appendChild(hLabel);

          const vLabel = document.createElement('div');
          vLabel.style.position = 'absolute';
          vLabel.style.left = `${(obj.x + obj.w - xMin + 0.8) * exportZoom}px`;
          vLabel.style.top = `${(obj.y - yMin) * exportZoom}px`;
          vLabel.style.height = `${obj.h * exportZoom}px`;
          vLabel.style.display = 'flex';
          vLabel.style.alignItems = 'center';
          vLabel.style.pointerEvents = 'none';
          vLabel.innerHTML = `<div style="background:white; border:1px solid #64748b; border-radius:2px; padding:0 4px; font-weight:900; color:#0f172a; font-size:${10 * (exportZoom/40)}px; white-space:nowrap; transform:rotate(90deg);">${formatDimension(obj.h)}</div>`;
          exportContainer.appendChild(vLabel);
        });
      }

      if (exportSettings.showPillars) {
        const pillars = objectsToExport.filter(obj => obj.subType === 'pillar');
        const TOL = 1.0;
        const yGroups: { y: number, items: DesignObject[] }[] = [];
        pillars.forEach(p => { let g = yGroups.find(gr => Math.abs(gr.y - p.y) < TOL); if (g) g.items.push(p); else yGroups.push({ y: p.y, items: [p] }); });
        yGroups.forEach(g => {
          const sorted = [...g.items].sort((a, b) => a.x - b.x);
          for (let i = 0; i < sorted.length - 1; i++) {
            const p1 = sorted[i], p2 = sorted[i+1];
            const c1x = p1.x + p1.w / 2, c2x = p2.x + p2.w / 2, c1y = p1.y + p1.h / 2, dist = c2x - c1x;
            if (dist > 0.1) {
              const pLine = document.createElement('div');
              pLine.style.position = 'absolute';
              pLine.style.left = `${(c1x - xMin) * exportZoom}px`;
              pLine.style.top = `${(c1y - 1.2 - yMin) * exportZoom}px`;
              pLine.style.width = `${dist * exportZoom}px`;
              pLine.innerHTML = `<div style="width:100%; height:1px; background:#ef4444; position:relative; display:flex; align-items:center; justify-content:center;"><div style="position:absolute; left:0; width:1px; height:10px; background:#ef4444;"></div><div style="position:absolute; right:0; width:1px; height:10px; background:#ef4444;"></div><div style="background:white; border:1px solid #ef4444; color:#ef4444; padding:0 4px; font-weight:bold; font-size:${9 * (exportZoom/40)}px; border-radius:2px; transform:translateY(-12px); white-space:nowrap;">${formatDimension(dist)}</div></div>`;
              exportContainer.appendChild(pLine);
            }
          }
        });
        const xGroups: { x: number, items: DesignObject[] }[] = [];
        pillars.forEach(p => { let g = xGroups.find(gr => Math.abs(gr.x - p.x) < TOL); if (g) g.items.push(p); else xGroups.push({ x: p.x, items: [p] }); });
        xGroups.forEach(g => {
          const sorted = [...g.items].sort((a, b) => a.y - b.y);
          for (let i = 0; i < sorted.length - 1; i++) {
            const p1 = sorted[i], p2 = sorted[i+1];
            const c1x = p1.x + p1.w / 2, c1y = p1.y + p1.h / 2, c2y = p2.y + p2.h / 2, dist = c2y - c1y;
            if (dist > 0.1) {
              const pLine = document.createElement('div');
              pLine.style.position = 'absolute';
              pLine.style.left = `${(c1x + 0.8 - xMin) * exportZoom}px`;
              pLine.style.top = `${(c1y - yMin) * exportZoom}px`;
              pLine.style.height = `${dist * exportZoom}px`;
              pLine.innerHTML = `<div style="height:100%; width:1px; background:#ef4444; position:relative; display:flex; align-items:center; justify-content:center;"><div style="position:absolute; top:0; height:1px; width:10px; background:#ef4444;"></div><div style="position:absolute; bottom:0; height:1px; width:10px; background:#ef4444;"></div><div style="background:white; border:1px solid #ef4444; color:#ef4444; padding:0 4px; font-weight:bold; font-size:${9 * (exportZoom/40)}px; border-radius:2px; transform:rotate(90deg) translateX(12px); white-space:nowrap;">${formatDimension(dist)}</div></div>`;
              exportContainer.appendChild(pLine);
            }
          }
        });
      }

      const finalCanvas = await html2canvas(exportContainer, { 
        backgroundColor: '#ffffff', 
        scale: 2, 
        useCORS: true,
        width: pW,
        height: pH,
        windowWidth: pW + 100,
        windowHeight: pH + 100,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0
      });
      document.body.removeChild(exportContainer);

      if (exportMode === 'cloud') {
        if (!user) {
          toast({ 
            variant: "destructive", 
            title: "লগইন আবশ্যক", 
            description: "ক্লাউড স্টোরেজে সেভ করতে অনুগ্রহ করে প্রথমে উপরে ডানপাশের 'লগইন' বাটনে ক্লিক করুন।" 
          });
          return;
        }
        setIsCloudUploading(true);
        try {
          const fileName = `${nameToExport || 'design'}_${Date.now()}.${exportSettings.format}`;
          if (exportSettings.format === 'png') {
            const dataUrl = finalCanvas.toDataURL('image/png');
            await uploadDesignSnapshot(user.uid, exportSettings.targetProjectId || currentDesignId, dataUrl, fileName);
            toast({ title: "ক্লাউডে সংরক্ষিত", description: "স্ন্যাপশটটি আপনার ক্লাউড অ্যাকাউন্টে সফলভাবে সেভ করা হয়েছে।" });
          } else {
            const { jsPDF } = await import('jspdf');
            const pdf = new jsPDF({
              orientation: pW > pH ? 'l' : 'p',
              unit: 'mm',
              format: 'a4'
            });
            const margin = 12.7; 
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const availableW = pdfWidth - (margin * 2);
            const availableH = pdfHeight - (margin * 2);
            const pageRatio = availableW / availableH;
            const canvasRatio = finalCanvas.width / finalCanvas.height;
            let printW = availableW;
            let printH = availableH;
            if (canvasRatio > pageRatio) {
              printH = availableW / canvasRatio;
            } else {
              printW = availableH * canvasRatio;
            }
            const maxDim = 1000;
            let targetW = pW;
            let targetH = pH;
            if (pW > maxDim || pH > maxDim) {
              if (pW > pH) {
                targetH = Math.round((pH * maxDim) / pW);
                targetW = maxDim;
              } else {
                targetW = Math.round((pW * maxDim) / pH);
                targetH = maxDim;
              }
            }
            const scaledCanvas = document.createElement('canvas');
            scaledCanvas.width = targetW;
            scaledCanvas.height = targetH;
            const sCtx = scaledCanvas.getContext('2d');
            if (sCtx) {
              sCtx.fillStyle = '#ffffff';
              sCtx.fillRect(0, 0, targetW, targetH);
              sCtx.drawImage(finalCanvas, 0, 0, targetW, targetH);
            }
            const jpegData = (sCtx ? scaledCanvas : finalCanvas).toDataURL('image/jpeg', 0.72);
            pdf.addImage(
              jpegData, 
              'JPEG', 
              margin + (availableW - printW) / 2, 
              margin + (availableH - printH) / 2, 
              printW, 
              printH,
              undefined,
              'FAST'
            );
            const pdfBlob = pdf.output('blob');
            await uploadExportBlob(user.uid, exportSettings.targetProjectId || currentDesignId, pdfBlob, fileName, jpegData);
            toast({ title: "ক্লাউডে সংরক্ষিত", description: "পিডিএফটি আপনার ক্লাউড অ্যাকাউন্টে সেভ করা হয়েছে।" });
          }
        } finally {
          setIsCloudUploading(false);
        }
      } else {
        if (exportSettings.format === 'png') {
          const link = document.createElement('a');
          link.download = `${nameToExport || 'design'}.png`;
          link.href = finalCanvas.toDataURL('image/png');
          link.click();
          toast({ title: "সফল", description: "ইমেজটি ডাউনলোড করা হয়েছে।" });
        } else {
          const { jsPDF } = await import('jspdf');
          const pdf = new jsPDF({
            orientation: pW > pH ? 'l' : 'p',
            unit: 'mm',
            format: 'a4'
          });
          
          const margin = 12.7; 
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          
          const availableW = pdfWidth - (margin * 2);
          const availableH = pdfHeight - (margin * 2);
          
          const pageRatio = availableW / availableH;
          const canvasRatio = finalCanvas.width / finalCanvas.height;
          
          let printW = availableW;
          let printH = availableH;
          
          if (canvasRatio > pageRatio) {
            printH = availableW / canvasRatio;
          } else {
            printW = availableH * canvasRatio;
          }
          
          const localJpeg = finalCanvas.toDataURL('image/jpeg', 0.85);
          pdf.addImage(
            localJpeg, 
            'JPEG', 
            margin + (availableW - printW) / 2, 
            margin + (availableH - printH) / 2, 
            printW, 
            printH
          );
          pdf.save(`${nameToExport || 'design'}.pdf`);
          toast({ title: "সফল", description: "পিডিএফটি ডাউনলোড করা হয়েছে।" });
        }
      }
      setIsExportDialogOpen(false);
    } catch (e) {
      console.error(e);
      setIsCloudUploading(false);
      toast({ variant: "destructive", title: "ত্রুটি", description: "এক্সপোর্ট করতে সমস্যা হয়েছে।" });
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

  const sendToBack = useCallback(() => {
    if (selectedObjectIds.length === 0) return;
    setDesignObjects(prev => {
      const selected = prev.filter(o => selectedObjectIds.includes(o.id));
      const rest = prev.filter(o => !selectedObjectIds.includes(o.id));
      const next = [...selected, ...rest]; 
      saveToHistory(next);
      return next;
    });
    toast({ title: "লেয়ার পরিবর্তন", description: "অবজেক্টটি নিচে পাঠানো হয়েছে।" });
  }, [selectedObjectIds, saveToHistory, toast]);

  const bringToFront = useCallback(() => {
    if (selectedObjectIds.length === 0) return;
    setDesignObjects(prev => {
      const selected = prev.filter(o => selectedObjectIds.includes(o.id));
      const rest = prev.filter(o => !selectedObjectIds.includes(o.id));
      const next = [...rest, ...selected]; 
      saveToHistory(next);
      return next;
    });
    toast({ title: "লেয়ার পরিবর্তন", description: "অবজেক্টটি উপরে আনা হয়েছে।" });
  }, [selectedObjectIds, saveToHistory, toast]);

  const saveToFirestore = useCallback(() => {
    const { firestore } = initializeFirebase();
    const docRef = doc(firestore, 'designs', currentDesignId);
    const data: any = { 
      objects: designObjects, 
      name: projectName, 
      updatedAt: serverTimestamp(),
      userId: user?.uid || null,
      userEmail: user?.email || null,
      estimations: {
        foundations, columns, beams, slabs, stairs, brickworks, plasters, floorTiles, wallTiles, septicTanks, soakWells
      },
      prices: prices,
      ledger: {
        materials: materialsLedger,
        labor: laborLedger
      }
    };
    setDoc(docRef, data, { merge: true }).then(() => {
      try {
        localStorage.setItem('last_saved_design_id', currentDesignId);
      } catch (e) {}
      toast({ 
        title: "সফল", 
        description: user 
          ? `"${projectName}" ডিজাইন আপনার অ্যাকাউন্টে সফলভাবে সেভ হয়েছে।` 
          : `"${projectName}" ডিজাইন সেভ করা হয়েছে (লগইন করলে যেকোনো ডিভাইস থেকে পাবেন)।` 
      });
    }).catch(async (serverError) => {
      const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'write', requestResourceData: data });
      errorEmitter.emit('permission-error', permissionError);
    });
  }, [designObjects, projectName, currentDesignId, foundations, columns, beams, slabs, stairs, brickworks, plasters, floorTiles, wallTiles, septicTanks, soakWells, prices, materialsLedger, laborLedger, user, toast]);

  const duplicateProject = useCallback(() => {
    const newId = Math.random().toString(36).substr(2, 9);
    const newName = "কপি - " + projectName;
    setCurrentDesignId(newId);
    setProjectName(newName);
    toast({ title: "ডুপ্লিকেট সফল", description: `প্রজেক্টটির একটি কপি তৈরি করা হয়েছে। এখন এটি "${newName}" নামে সেভ করতে পারবেন।` });
  }, [projectName, toast]);

  const deleteProjectFromDb = async (id: string, name: string) => {
    if (!confirm(`আপনি কি নিশ্চিত যে "${name}" প্রজেক্টটি ডিলিট করতে চান?`)) return;
    try {
      const { firestore } = initializeFirebase();
      await deleteDoc(doc(firestore, 'designs', id));
      toast({ title: "সফল", description: "প্রজেক্টটি মুছে ফেলা হয়েছে।" });
      fetchSavedDesigns(); 
    } catch (e) {
      toast({ variant: "destructive", title: "ত্রুটি", description: "প্রজেক্টটি ডিলিট করা যায়নি।" });
    }
  };

  const handleNewPage = () => {
    setDesignObjects([]);
    setProjectName("নতুন প্রজেক্ট");
    setCurrentDesignId(Math.random().toString(36).substr(2, 9));
    setHistory([[]]);
    setHistoryIndex(0);
    setSelectedObjectIds([]);
    setFoundations([{ id: '1', count: 0, len: 0, wid: 0, thick: 0, rodLong: 0, rodWidth: 0, rodFactor: 0.48, aggregateType: 'stone' }]);
    setColumns([{ id: '1', count: 0, len: 0, wid: 0, height: 0, rods: 0, rodFactor: 0.48, ringRodFactor: 0.12, ringGap: 6, aggregateType: 'stone' }]);
    setBeams([{ id: '1', len: 0, height: 0, wid: 0, rods: 0, rodFactor: 0.48, ringRodFactor: 0.12, ringGap: 6, aggregateType: 'stone' }]);
    setSlabs([{ id: '1', len: 0, wid: 0, thick: 0, rodGap: 5, rodFactor: 0.30, aggregateType: 'stone' }]);
    setStairs([{ id: '1', count: 0, wLen: 0, wid: 0, thick: 5, steps: 10, riser: 6, tread: 10, lLen: 0, lWid: 0, mainFactor: 0.30, distFactor: 0.19, mainGap: 5, distGap: 6, aggregateType: 'stone' }]);
    setBrickworks([{ id: '1', len: 0, height: 0, thick: 5 }]);
    setPlasters([{ id: '1', len: 0, height: 0, thick: 0.5, sides: 1 }]);
    setFloorTiles([{ id: '1', len: 0, wid: 0, tLen: 0, tWid: 0, wastage: 10 }]);
    setWallTiles([{ id: '1', len: 0, height: 0, tLen: 0, tWid: 0, wastage: 10 }]);
    setSepticTanks([{ id: '1', count: 0, len: 0, wid: 0, depth: 0, aggregateType: 'stone' }]);
    setSoakWells([{ id: '1', count: 0, dia: 0, depth: 0 }]);
    setPrices({
      cement: 0, sand: 0, stone: 0, chips: 0, rod: 0, bricks: 0, floorTiles: 0, wallTiles: 0, labor: 0, doors: 0, windows: 0,
      electric: 0, fittings: 0, paint: 0, others: 0
    });
    setMaterialsLedger([]);
    setLaborLedger([]);
    toast({ title: "নতুন পেজ", description: "ক্যানভাস এবং হিসাব পরিষ্কার করা হয়েছে।" });
  };

  const fetchSavedDesigns = async () => {
    try {
      const { firestore } = initializeFirebase();
      const designsCol = collection(firestore, 'designs');
      const querySnapshot = await getDocs(designsCol);
      const designs = querySnapshot.docs
        .map(doc => ({
          id: doc.id,
          name: doc.data().name || "নামহীন ডিজাইন",
          updatedAt: doc.data().updatedAt,
          userId: doc.data().userId
        }))
        .filter(d => !user || !d.userId || d.userId === user.uid || !d.userId)
        .sort((a, b) => {
          const timeA = a.updatedAt?.seconds || 0;
          const timeB = b.updatedAt?.seconds || 0;
          return timeB - timeA;
        });
      setSavedDesigns(designs);
      return designs;
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "ত্রুটি", description: "সেভ করা ডিজাইনগুলো লোড করা যায়নি।" });
      return [];
    }
  };

  const loadDesign = async (id: string): Promise<boolean> => {
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
        if (data.estimations) {
          const est = data.estimations;
          if (est.foundations) setFoundations(est.foundations);
          if (est.columns) setColumns(est.columns);
          if (est.beams) setBeams(est.beams);
          if (est.slabs) setSlabs(est.slabs);
          if (est.stairs) setStairs(est.stairs);
          if (est.brickworks) setBrickworks(est.brickworks);
          if (est.plasters) setPlasters(est.plasters);
          if (est.floorTiles) setFloorTiles(est.floorTiles);
          if (est.wallTiles) setWallTiles(est.wallTiles);
          if (est.septicTanks) setSepticTanks(est.septicTanks);
          if (est.soakWells) setSoakWells(est.soakWells);
        }
        if (data.prices) setPrices(data.prices);
        if (data.ledger) {
          if (data.ledger.materials) setMaterialsLedger(data.ledger.materials);
          if (data.ledger.labor) setLaborLedger(data.ledger.labor);
        }
        setIsOpenDialogOpen(false);
        try {
          localStorage.setItem('last_saved_design_id', id);
        } catch (e) {}
        toast({ title: "সফল", description: "ডিজাইন এবং হিসাব লোড করা হয়েছে।" });
        return true;
      }
      return false;
    } catch (e) {
      toast({ variant: "destructive", title: "ত্রুটি", description: "ডিজাইন লোড করা যায়নি।" });
      return false;
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
          const step = 1/12; 
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

  const findRoomBoundaries = (x: number, y: number) => {
    const walls = designObjects.filter(obj => obj.subType === 'wall');
    let left = -Infinity, right = Infinity, top = -Infinity, bottom = Infinity;
    const TOL = 0.5;

    walls.forEach(w => {
      const isVert = Math.abs(w.rotation % 180) === 90;
      if (isVert) {
        if (y >= w.y - TOL && y <= w.y + w.w + TOL) {
           if (w.x < x) left = Math.max(left, w.x + w.h);
           else if (w.x > x) right = Math.min(right, w.x);
        }
      } else {
        if (x >= w.x - TOL && x <= w.x + w.w + TOL) {
          if (w.y < y) top = Math.max(top, w.y + w.h);
          else if (w.y > y) bottom = Math.min(bottom, w.y);
        }
      }
    });

    const w = (right !== Infinity && left !== -Infinity) ? (right - left) : 8;
    const h = (bottom !== Infinity && top !== -Infinity) ? (bottom - top) : 8;
    const finalX = left !== -Infinity ? left : x;
    const finalY = top !== -Infinity ? top : y;

    return { x: finalX, y: finalY, w, h };
  };

  const addObjectAt = useCallback((type: DesignObject['type'], subType: string, label: string, x: number, y: number, overrides = {}) => {
    let finalX = x, finalY = y, finalW = 2, finalH = 2, finalText = label;

    if (type === 'text' && subType.startsWith('room-label')) {
      const bounds = findRoomBoundaries(x, y);
      finalX = bounds.x; finalY = bounds.y; finalW = bounds.w; finalH = bounds.h;
      
      const count = designObjects.filter(o => o.subType === subType).length + 1;
      const padded = count.toString().padStart(2, '0');
      
      if (subType === 'room-label-bed') finalText = `B ROOM-${padded}`;
      else if (subType === 'room-label-bath') finalText = `BATH-${padded}`;
      else if (subType === 'room-label-kitchen') finalText = `KITCHEN-${padded}`;
      else if (subType === 'room-label-living') finalText = `LIVING-${padded}`;
      else if (subType === 'room-label-dining') finalText = `DINING-${padded}`;
      else if (subType === 'room-label-mandir') finalText = `MANDIR-${padded}`;
      else if (subType === 'room-label-stair') finalText = `STAIR-${padded}`;
    }

    const newObj: DesignObject = {
      id: Math.random().toString(36).substr(2, 9),
      type, subType, x: finalX, y: finalY, w: finalW, h: finalH, label, 
      color: '#000000', fillColor: '#ffffff',
      strokeWidth: 2, strokeStyle: 'solid', rotation: 0,
      isJoined: false, fontSize: 14, isBold: true, stepCount: 10,
      textContent: finalText,
      ...overrides
    };

    if (subType === 'pillar') {
      const count = designObjects.filter(o => o.subType === 'pillar' || o.type === 'pillar').length + 1;
      newObj.label = `C${count}`;
      newObj.fillColor = '#000000';
    }
    if (subType === 'beam') {
      const count = designObjects.filter(o => o.subType === 'beam').length + 1;
      newObj.label = `B${count}`;
      newObj.color = '#2563eb';
      newObj.fillColor = '#3b82f622';
    }
    if (subType.startsWith('door') || subType === 'sliding-door') { newObj.w = 3.5; newObj.h = currentWallThickness; }
    if (subType === 'double-door') { newObj.w = 6; newObj.h = currentWallThickness; }
    if (subType === 'window') { newObj.w = 4; newObj.h = currentWallThickness; }
    if (subType === 'stair-u') { newObj.w = 8; newObj.h = 10; newObj.stepCount = 15; }
    if (subType === 'stair-dogleg') { newObj.w = 6; newObj.h = 10; newObj.stepCount = 10; }
    
    // Default Furniture sizes
    if (subType === 'furniture-bed') { newObj.w = 6.5; newObj.h = 5; }
    if (subType === 'furniture-sofa') { newObj.w = 6; newObj.h = 2.5; }
    if (subType === 'furniture-dining') { newObj.w = 4.5; newObj.h = 3.5; }
    if (subType === 'furniture-kitchen') { newObj.w = 6; newObj.h = 2; }
    if (subType === 'furniture-bath') { newObj.w = 2.5; newObj.h = 3; }
    
    // MEP tools dimensions
    if (subType === 'mep-light') { newObj.w = 1.2; newObj.h = 1.2; }
    if (subType === 'mep-fan') { newObj.w = 2.5; newObj.h = 2.5; }
    if (subType === 'mep-socket') { newObj.w = 1.0; newObj.h = 1.0; }
    if (subType === 'mep-pipe') { newObj.w = 6; newObj.h = 0.5; }
    if (subType === 'mep-septic') { newObj.w = 8; newObj.h = 5; }

    // Landscape tools dimensions
    if (subType === 'landscape-tree') { newObj.w = 4; newObj.h = 4; }
    if (subType === 'landscape-garden') { newObj.w = 10; newObj.h = 6; }
    if (subType === 'landscape-car') { newObj.w = 7; newObj.h = 14; }

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

  const scrollBottomBar = (direction: 'left' | 'right') => {
    if (bottomBarRef.current) {
      const scrollAmount = 300;
      bottomBarRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const container = canvasRef.current;
    if (!container) return;
    const handleNativeWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -1 : 1; 
        setZoom(prev => Math.min(250, Math.max(5, prev + delta)));
      }
    };
    const handleScroll = () => {
      setScrollX(container.scrollLeft);
      setScrollY(container.scrollTop);
    };
    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('wheel', handleNativeWheel);
      container.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    fetchSavedDesigns();
  }, [user]);

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
    const curX = (clientX - rect.left - (CANVAS_OFFSET - container.scrollLeft)) / displayZoom;
    const curY = (clientY - rect.top - (CANVAS_OFFSET - container.scrollTop)) / displayZoom;
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

    if (selectedTool === 'area-marker') {
      const point = { x: snappedX, y: snappedY };
      if (polyPoints.length >= 3) {
        const first = polyPoints[0];
        const dist = Math.sqrt(Math.pow(snappedX - first.x, 2) + Math.pow(snappedY - first.y, 2));
        if (dist < 0.6) {
          const minX = Math.min(...polyPoints.map(p => p.x));
          const maxX = Math.max(...polyPoints.map(p => p.x));
          const minY = Math.min(...polyPoints.map(p => p.y));
          const maxY = Math.max(...polyPoints.map(p => p.y));
          
          addObjectAt('shape', 'area-marker', 'রুম এলাকা', minX, minY, {
            w: maxX - minX,
            h: maxY - minY,
            points: [...polyPoints],
            fillColor: 'rgba(59, 130, 246, 0.15)'
          });
          setPolyPoints([]);
          setInteractionMode('none');
          setSelectedTool('select');
          toast({ title: "সফল", description: "রুম এরিয়া সম্পন্ন হয়েছে।" });
          return;
        }
      }
      setPolyPoints([...polyPoints, point]);
      setInteractionMode('drawing-poly');
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
        if (selectedTool === 'wall' || selectedTool === 'beam') { 
          const start = { x: snappedX, y: snappedY }; 
          setDrawStart(start); 
          setTempDrawEnd(start); 
          setInteractionMode('drawing'); 
          return; 
        }
        if (selectedTool === 'room') addRoomAt(snappedX, snappedY);
        else if (selectedTool === 'pillar') {
          const count = designObjects.filter(o => o.subType === 'pillar' || o.type === 'pillar').length + 1;
          addObjectAt('pillar', 'pillar', `C${count}`, snappedX, snappedY, { w: 1, h: 1, label: `C${count}` });
        }
        else if (selectedTool === 'door-1') addObjectAt('opening', 'door-1', 'Door 1', snappedX, snappedY);
        else if (selectedTool === 'door-2') addObjectAt('opening', 'door-2', 'Door 2', snappedX, snappedY);
        else if (selectedTool === 'door-3') addObjectAt('opening', 'door-3', 'Door 3', snappedX, snappedY);
        else if (selectedTool === 'door-4') addObjectAt('opening', 'door-4', 'Door 4', snappedX, snappedY);
        else if (selectedTool === 'double-door') addObjectAt('opening', 'double-door', 'Double Door', snappedX, snappedY);
        else if (selectedTool === 'sliding-door') addObjectAt('opening', 'sliding-door', 'Sliding Door', snappedX, snappedY);
        else if (selectedTool === 'window') addObjectAt('opening', 'window', 'Window', snappedX, snappedY);
        else if (selectedTool === 'stair-u') addObjectAt('stair', 'stair-u', 'Stair 1', snappedX, snappedY);
        else if (selectedTool === 'stair-dogleg') addObjectAt('stair', 'stair-dogleg', 'Stair 2', snappedX, snappedY);
        else if (selectedTool === 'room-label-bed') addObjectAt('text', 'room-label-bed', 'Bed Room', snappedX, snappedY);
        else if (selectedTool === 'room-label-bath') addObjectAt('text', 'room-label-bath', 'Bath Room', snappedX, snappedY);
        else if (selectedTool === 'room-label-kitchen') addObjectAt('text', 'room-label-kitchen', 'Kitchen', snappedX, snappedY);
        else if (selectedTool === 'room-label-living') addObjectAt('text', 'room-label-living', 'Living Room', snappedX, snappedY);
        else if (selectedTool === 'room-label-dining') addObjectAt('text', 'room-label-dining', 'Dining Room', snappedX, snappedY);
        else if (selectedTool === 'room-label-mandir') addObjectAt('text', 'room-label-mandir', 'Mandir', snappedX, snappedY);
        else if (selectedTool === 'room-label-stair') addObjectAt('text', 'room-label-stair', 'Stair Room', snappedX, snappedY);
        else if (selectedTool === 'label') addObjectAt('text', 'label', 'Label', snappedX, snappedY, { textContent: 'Room Name', w: 4, h: 1 });
        // Furniture tools
        else if (selectedTool === 'furniture-bed') addObjectAt('furniture', 'furniture-bed', 'Bed', snappedX, snappedY);
        else if (selectedTool === 'furniture-sofa') addObjectAt('furniture', 'furniture-sofa', 'Sofa', snappedX, snappedY);
        else if (selectedTool === 'furniture-dining') addObjectAt('furniture', 'furniture-dining', 'Dining Table', snappedX, snappedY);
        else if (selectedTool === 'furniture-kitchen') addObjectAt('furniture', 'furniture-kitchen', 'Kitchen Set', snappedX, snappedY);
        else if (selectedTool === 'furniture-bath') addObjectAt('furniture', 'furniture-bath', 'Commode', snappedX, snappedY);
        // MEP tools
        else if (selectedTool === 'mep-light') addObjectAt('mep', 'mep-light', 'Light', snappedX, snappedY);
        else if (selectedTool === 'mep-fan') addObjectAt('mep', 'mep-fan', 'Fan', snappedX, snappedY);
        else if (selectedTool === 'mep-socket') addObjectAt('mep', 'mep-socket', 'Power Socket', snappedX, snappedY);
        else if (selectedTool === 'mep-pipe') addObjectAt('mep', 'mep-pipe', 'Water Pipe', snappedX, snappedY);
        else if (selectedTool === 'mep-septic') addObjectAt('mep', 'mep-septic', 'Septic Tank', snappedX, snappedY);
        // Landscape tools
        else if (selectedTool === 'landscape-tree') addObjectAt('landscape', 'landscape-tree', 'Tree', snappedX, snappedY);
        else if (selectedTool === 'landscape-garden') addObjectAt('landscape', 'landscape-garden', 'Lawn Garden', snappedX, snappedY);
        else if (selectedTool === 'landscape-car') addObjectAt('landscape', 'landscape-car', 'Parking Spot', snappedX, snappedY);

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

    if (selectedTool === 'area-marker' && interactionMode === 'drawing-poly') {
      setTempDrawEnd({ x: Math.round(curX / ARCH_SNAP) * ARCH_SNAP, y: Math.round(curY / ARCH_SNAP) * ARCH_SNAP });
    }

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
      if ((selectedTool === 'wall' || selectedTool === 'beam') && (e.shiftKey || e.ctrlKey)) { 
        if (Math.abs(curX - drawStart.x) > Math.abs(curY - drawStart.y)) endY = drawStart.y; 
        else endX = drawStart.x; 
      }
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
      let tx = Math.round((curX - mainOffset.x) / ARCH_SNAP) * ARCH_SNAP;
      let ty = Math.round((curY - mainOffset.y) / ARCH_SNAP) * ARCH_SNAP;

      if (isSmartSnapEnabled) {
        const SNAP_THRESHOLD = 0.6; 
        let guideX: number | undefined = undefined;
        let guideY: number | undefined = undefined;

        for (const other of designObjects) {
          if (selectedObjectIds.includes(other.id)) continue;
          const targetXs = [other.x, other.x + other.w / 2, other.x + other.w];
          for (const candX of targetXs) {
            if (Math.abs(tx - candX) < SNAP_THRESHOLD) { tx = candX; guideX = candX; break; }
          }
          const targetYs = [other.y, other.y + other.h / 2, other.y + other.h];
          for (const candY of targetYs) {
            if (Math.abs(ty - candY) < SNAP_THRESHOLD) { ty = candY; guideY = candY; break; }
          }
        }
        setActiveSnapGuides(guideX !== undefined || guideY !== undefined ? { x: guideX, y: guideY } : null);
      } else {
        setActiveSnapGuides(null);
      }

      const dx = tx - mainObj.x, dy = ty - mainObj.y;
      if (dx !== 0 || dy !== 0) {
        setDesignObjects(prev => prev.map(o => {
          if (selectedObjectIds.includes(o.id) && !o.isJoined) {
            const nextX = o.x + dx, nextY = o.y + dy;
            const updates: any = { x: nextX, y: nextY };
            if (o.points) updates.points = o.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
            return { ...o, ...updates };
          }
          return o;
        }));
      }
    }
  };

  const handleMouseUp = () => {
    if (interactionMode === 'drawing' && drawStart && tempDrawEnd) {
      if (selectedTool === 'wall' || selectedTool === 'beam') {
        const dx = tempDrawEnd.x - drawStart.x, dy = tempDrawEnd.y - drawStart.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0.5) {
          if (selectedTool === 'beam') {
            const count = designObjects.filter(o => o.subType === 'beam').length + 1;
            addObjectAt('structure', 'beam', `B${count}`, drawStart.x, drawStart.y, { 
              w: Math.round(len * 10) / 10, 
              h: 0.833, 
              rotation: Math.round(Math.atan2(dy, dx) * (180 / Math.PI)),
              color: '#2563eb',
              fillColor: '#3b82f622'
            });
          } else {
            addObjectAt('structure', 'wall', 'Wall', drawStart.x, drawStart.y, { w: len, h: currentWallThickness, rotation: Math.atan2(dy, dx) * (180 / Math.PI) });
          }
        } else if (selectedTool === 'beam') {
          const count = designObjects.filter(o => o.subType === 'beam').length + 1;
          addObjectAt('structure', 'beam', `B${count}`, drawStart.x, drawStart.y, { 
            w: 10, 
            h: 0.833, 
            rotation: 0,
            color: '#2563eb',
            fillColor: '#3b82f622'
          });
        }
      }
      setDrawStart(null); setTempDrawEnd(null);
    } else if (interactionMode === 'selecting' && selectionBox) {
      const xMin = Math.min(selectionBox.x1, selectionBox.x2), xMax = Math.max(selectionBox.x1, selectionBox.x2);
      const yMin = Math.min(selectionBox.y1, selectionBox.y2), yMax = Math.max(selectionBox.y1, selectionBox.y2);
      const inBox = designObjects.filter(obj => obj.x >= xMin && obj.x <= xMax && obj.y >= yMin && obj.y <= yMax).map(o => o.id);
      setSelectedObjectIds(inBox); setSelectionBox(null);
    } else if (interactionMode !== 'none' && interactionMode !== 'pasting' && interactionMode !== 'drawing-poly') saveToHistory(designObjects);
    
    if (interactionMode !== 'pasting' && interactionMode !== 'drawing-poly') setInteractionMode('none');
    setLastPanPos(null);
    setActiveSnapGuides(null);
  };

  // Persistence: Auto-load last saved project on mount/refresh
  useEffect(() => {
    let isMounted = true;
    const autoLoadLastProject = async () => {
      try {
        const lastSavedId = typeof window !== 'undefined' ? localStorage.getItem('last_saved_design_id') : null;
        if (lastSavedId) {
          const ok = await loadDesign(lastSavedId);
          if (ok) return;
        }
        // If not found in localStorage or failed to load, automatically load the most recent saved project from database
        const designs = await fetchSavedDesigns();
        if (isMounted && designs && designs.length > 0) {
          await loadDesign(designs[0].id);
        }
      } catch (e) {
        console.error("Auto load last project error:", e);
      }
    };

    const timer = setTimeout(() => {
      autoLoadLastProject();
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  const renderPillarDistances = () => {
    if (!showPillarDistances) return null;
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
        if (dist > 0.1) dims.push(<div key={`h-${p1.id}-${p2.id}`} className="absolute pointer-events-none z-20 flex flex-col items-center dimension-label" style={{ left: c1x * displayZoom + CANVAS_OFFSET, top: (c1y - 1.2) * displayZoom + CANVAS_OFFSET, width: dist * displayZoom }}>
          <div className="w-full h-[1px] bg-red-500 relative flex items-center justify-center"><div className="absolute left-0 w-[1px] h-3 bg-red-500 -translate-y-1/2" /><div className="absolute right-0 w-[1px] h-3 bg-red-500 -translate-y-1/2" /><div className="bg-white px-1 text-[9px] font-bold text-red-600 border border-red-200 shadow-sm rounded-sm whitespace-nowrap -translate-y-4" style={{ fontSize: Math.max(8, 9 * gridConfig.labelScale) + 'px' }}>{formatDimension(dist)}</div></div>
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
        if (dist > 0.1) dims.push(<div key={`v-${p1.id}-${p2.id}`} className="absolute pointer-events-none z-20 flex items-center justify-center dimension-label" style={{ left: (c1x + 0.8) * displayZoom + CANVAS_OFFSET, top: c1y * displayZoom + CANVAS_OFFSET, height: dist * displayZoom, width: 20 }}>
          <div className="h-full w-[1px] bg-red-500 relative flex items-center justify-center"><div className="absolute top-0 h-[1px] w-3 bg-red-500 -translate-x-1/2" /><div className="absolute bottom-0 h-[1px] w-3 bg-red-500 -translate-x-1/2" /><div className="bg-white px-1 text-[9px] font-bold text-red-600 border border-red-200 shadow-sm rounded-sm whitespace-nowrap rotate-90 translate-x-4" style={{ fontSize: Math.max(8, 9 * gridConfig.labelScale) + 'px' }}>{formatDimension(dist)}</div></div>
        </div>);
      }
    });
    return dims;
  };

  const Ruler = ({ orientation }: { orientation: 'horizontal' | 'vertical' }) => {
    const scrollVal = orientation === 'horizontal' ? scrollX : scrollY;
    const interval = gridConfig.interval;
    const safeZoom = Math.max(displayZoom, 0.1); 
    const startUnit = Math.floor((scrollVal - CANVAS_OFFSET) / (interval * safeZoom)) * interval;
    const count = Math.min(Math.ceil(2000 / (interval * safeZoom)), 500); 
    const units = [];
    for (let t = 0; t <= count; t++) units.push(startUnit + t * interval);

    return (
      <div className={cn("bg-slate-900 border-slate-800 ruler-container", orientation === 'horizontal' ? "h-8 border-b w-full relative shrink-0" : "w-8 border-r h-full relative shrink-0")}>
        {units.map((posValue) => (
          <div key={posValue} className="absolute overflow-visible" style={orientation === 'horizontal' ? { left: posValue * safeZoom + CANVAS_OFFSET - scrollX, top: 0 } : { top: posValue * safeZoom + CANVAS_OFFSET - scrollY, left: 0 }}>
            <div className={cn("bg-slate-700", orientation === 'horizontal' ? "w-[1px] h-3 -translate-x-1/2" : "h-[1px] w-3 -translate-y-1/2")} />
            <span className={cn("text-[9px] font-bold text-slate-400 absolute whitespace-nowrap", orientation === 'horizontal' ? "top-3 -translate-x-1/2" : "left-3 -translate-y-1/2")}>
              {unitSystem === 'metric' ? `${(posValue * 0.3048).toFixed(1)}m` : posValue}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const calculatePolygonArea = (points: {x: number, y: number}[]) => {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      let j = (i + 1) % points.length;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    return Math.abs(area / 2);
  };

  const renderObjectContent = (obj: DesignObject) => {
    const sw = 1 / displayZoom;
    if (obj.subType === 'area-marker') {
      const areaSqFt = obj.points ? Math.round(calculatePolygonArea(obj.points)) : Math.round(obj.w * obj.h);
      if (obj.points) {
        const minX = Math.min(...obj.points.map(p => p.x));
        const minY = Math.min(...obj.points.map(p => p.y));
        const pts = obj.points.map(p => `${(p.x - minX) * displayZoom},${(p.y - minY) * displayZoom}`).join(' ');
        return (
          <div className="w-full h-full relative pointer-events-none">
            <svg width="100%" height="100%" className="overflow-visible">
              <polygon points={pts} fill="rgba(59, 130, 246, 0.15)" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4,4" />
              {obj.points.map((p, i) => {
                const next = obj.points![(i + 1) % obj.points!.length];
                const dist = Math.sqrt(Math.pow(next.x - p.x, 2) + Math.pow(next.y - p.y, 2));
                const mx = ((p.x + next.x) / 2 - minX) * displayZoom;
                const my = ((p.y + next.y) / 2 - minY) * displayZoom;
                const label = formatDimension(dist);
                return (
                  <g key={`side-${i}`}>
                    <rect x={mx - 24} y={my - 10} width={48} height={18} rx={3} fill="white" stroke="#3b82f6" strokeWidth={1} opacity={0.9} />
                    <text x={mx} y={my + 4} textAnchor="middle" fontSize={9} fontWeight="bold" fill="#1e40af" fontFamily="monospace">{label}</text>
                  </g>
                );
              })}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-white/90 px-2 py-0.5 rounded shadow-sm border border-blue-200 flex flex-col items-center">
                <span className="text-[9px] font-black text-blue-600 uppercase tracking-tighter">{obj.label || "রুম এলাকা"}</span>
                <span className="text-[12px] font-black text-slate-900 leading-none">{areaSqFt} Sq.ft</span>
              </div>
            </div>
          </div>
        );
      }
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-blue-500/10 border-2 border-dashed border-blue-400/60 rounded-sm pointer-events-none">
          <div className="bg-white/90 px-2 py-0.5 rounded shadow-sm flex flex-col items-center">
            <span className="text-[9px] font-black text-blue-600 uppercase tracking-tighter">{obj.label || "রুম এলাকা"}</span>
            <span className="text-[12px] font-black text-slate-900 leading-none">{areaSqFt} Sq.ft</span>
          </div>
        </div>
      );
    }
    if (obj.subType === 'beam') {
      const bIndex = designObjects.filter(o => o.subType === 'beam').findIndex(o => o.id === obj.id);
      const beamLabel = obj.label && obj.label !== 'Beam' && obj.label !== 'BEAM' ? obj.label : `B${bIndex >= 0 ? bIndex + 1 : 1}`;
      return (
        <div className="w-full h-full flex items-center justify-center relative pointer-events-none select-none overflow-hidden">
          <div className="absolute inset-0 border border-dashed border-blue-500 bg-blue-500/15" />
          <span className="text-[10px] font-black text-blue-800 bg-white/95 px-1.5 py-0.5 rounded shadow-xs z-10 whitespace-nowrap border border-blue-200">
            {beamLabel}
          </span>
        </div>
      );
    }
    if (obj.subType === 'pillar' || obj.type === 'pillar') {
      const pIndex = designObjects.filter(o => o.subType === 'pillar' || o.type === 'pillar').findIndex(o => o.id === obj.id);
      const pillarLabel = obj.label && obj.label !== 'Pillar' ? obj.label : `C${pIndex >= 0 ? pIndex + 1 : 1}`;
      return (
        <div className="w-full h-full flex items-center justify-center pointer-events-none select-none overflow-hidden">
          <span className="text-[10px] font-black text-white px-1 py-0.5 whitespace-nowrap leading-none drop-shadow-sm">
            {pillarLabel}
          </span>
        </div>
      );
    }
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
    if (obj.subType === 'stair-u') {
      const steps = obj.stepCount || 15; const landingH = obj.h * 0.25; const flightW = obj.w * 0.3;
      const midFlightH = obj.h - 2 * landingH; const sCount = Math.floor(steps / 3);
      const oStepH = midFlightH / sCount; const oStepW = (obj.w - 2 * flightW) / sCount;
      return (
        <svg width="100%" height="100%" viewBox={`0 0 ${obj.w} ${obj.h}`} preserveAspectRatio="none" className="overflow-visible pointer-events-none">
          <rect x="0" y="0" width={obj.w} height={obj.h} fill="white" stroke={obj.color} strokeWidth={sw * 2} />
          <line x1={flightW} y1={0} x2={flightW} y2={obj.h} stroke={obj.color} strokeWidth={sw * 2} /><line x1={obj.w - flightW} y1={0} x2={obj.w - flightW} y2={obj.h} stroke={obj.color} strokeWidth={sw * 2} /><line x1={flightW} y1={landingH} x2={obj.w - flightW} y2={landingH} stroke={obj.color} strokeWidth={sw * 2} /><line x1={flightW} y1={obj.h - landingH} x2={obj.w - flightW} y2={obj.h - landingH} stroke={obj.color} strokeWidth={sw * 2} />
          {Array.from({ length: sCount }).map((_, i) => <line key={`f1-${i}`} x1="0" y1={obj.h - landingH - (i * oStepH)} x2={flightW} y2={obj.h - landingH - (i * oStepH)} stroke={obj.color} strokeWidth={sw} />)}
          {Array.from({ length: sCount }).map((_, i) => <line key={`f2-${i}`} x1={flightW + (i * oStepW)} y1={landingH} x2={flightW + (i * oStepW)} y2={0} stroke={obj.color} strokeWidth={sw} />)}
          {Array.from({ length: sCount }).map((_, i) => <line key={`f3-${i}`} x1={obj.w - flightW} y1={landingH + (i * oStepH)} x2={obj.w} y2={landingH + (i * oStepH)} stroke={obj.color} strokeWidth={sw} />)}
        </svg>
      );
    }
    if (obj.subType === 'stair-dogleg') {
      const steps = obj.stepCount || 10; const landingH = obj.h * 0.2; const railW = obj.w * 0.1;
      const flightW = (obj.w - railW) / 2; const midH = obj.h - landingH; const sCount = Math.floor(steps / 2); const oStepH = midH / sCount;
      return (
        <svg width="100%" height="100%" viewBox={`0 0 ${obj.w} ${obj.h}`} preserveAspectRatio="none" className="overflow-visible pointer-events-none">
          <rect x="0" y="0" width={obj.w} height={obj.h} fill="white" stroke={obj.color} strokeWidth={sw * 2} />
          <line x1="0" y1={landingH} x2={obj.w} y2={landingH} stroke={obj.color} strokeWidth={sw * 2} /><line x1={flightW} y1={landingH} x2={flightW} y2={obj.h} stroke={obj.color} strokeWidth={sw * 2} /><line x1={obj.w - flightW} y1={landingH} x2={obj.w - flightW} y2={landingH} stroke={obj.color} strokeWidth={sw * 2} />
          {Array.from({ length: sCount }).map((_, i) => <line key={`dl-l-${i}`} x1="0" y1={landingH + (i+1) * oStepH} x2={flightW} y2={landingH + (i+1) * oStepH} stroke={obj.color} strokeWidth={sw} />)}
          {Array.from({ length: sCount }).map((_, i) => <line key={`dl-r-${i}`} x1={obj.w - flightW} y1={landingH + (i+1) * oStepH} x2={obj.w} y2={landingH + (i+1) * oStepH} stroke={obj.color} strokeWidth={sw} />)}
        </svg>
      );
    }
    if (obj.type === 'text') {
      const labelText = obj.textContent || obj.label;
      const dimText = `L: ${formatDimension(Math.max(obj.w, obj.h))} × W: ${formatDimension(Math.min(obj.w, obj.h))}`;
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-1 pointer-events-none text-center leading-tight font-black" style={{ color: obj.color, fontSize: Math.max(10, (obj.fontSize || 14) * (displayZoom/16)) + 'px', fontWeight: obj.isBold ? '900' : 'normal' }}>
          <div className="whitespace-nowrap uppercase tracking-tighter">{labelText}</div>
          <div className="text-[0.85em] opacity-80 whitespace-nowrap">({dimText})</div>
        </div>
      );
    }
    if (obj.type === 'furniture') {
      const sw = 1 / displayZoom;
      return (
        <svg width="100%" height="100%" viewBox={`0 0 ${obj.w} ${obj.h}`} preserveAspectRatio="none" className="overflow-visible pointer-events-none">
           {obj.subType === 'furniture-bed' && (
             <g>
               <rect x={0} y={0} width={obj.w} height={obj.h} fill="white" stroke={obj.color} strokeWidth={sw * 2} />
               <rect x={0} y={0} width={obj.w} height={obj.h * 0.2} fill={obj.color} fillOpacity="0.1" stroke={obj.color} strokeWidth={sw} />
               <rect x={obj.w * 0.1} y={obj.h * 0.25} width={obj.w * 0.35} height={obj.h * 0.15} fill="white" stroke={obj.color} strokeWidth={sw} />
               <rect x={obj.w * 0.55} y={obj.h * 0.25} width={obj.w * 0.35} height={obj.h * 0.15} fill="white" stroke={obj.color} strokeWidth={sw} />
               <rect x={obj.w * 0.05} y={obj.h * 0.45} width={obj.w * 0.9} height={obj.h * 0.5} fill="white" stroke={obj.color} strokeWidth={sw} />
             </g>
           )}
           {obj.subType === 'furniture-sofa' && (
             <g>
               <rect x={0} y={0} width={obj.w} height={obj.h} fill="white" stroke={obj.color} strokeWidth={sw * 2} rx={obj.w * 0.05} />
               <rect x={0} y={0} width={obj.w * 0.15} height={obj.h} fill="white" stroke={obj.color} strokeWidth={sw} rx={obj.w * 0.02} />
               <rect x={obj.w * 0.85} y={0} width={obj.w * 0.15} height={obj.h} fill="white" stroke={obj.color} strokeWidth={sw} rx={obj.w * 0.02} />
               <rect x={obj.w * 0.15} y={0} width={obj.w * 0.7} height={obj.h * 0.25} fill="white" stroke={obj.color} strokeWidth={sw} rx={obj.w * 0.02} />
               <line x1={obj.w * 0.38} y1={obj.h * 0.25} x2={obj.w * 0.38} y2={obj.h} stroke={obj.color} strokeWidth={sw} />
               <line x1={obj.w * 0.62} y1={obj.h * 0.25} x2={obj.w * 0.62} y2={obj.h} stroke={obj.color} strokeWidth={sw} />
             </g>
           )}
           {obj.subType === 'furniture-dining' && (
             <g>
               <rect x={obj.w * 0.15} y={obj.h * 0.15} width={obj.w * 0.7} height={obj.h * 0.7} fill="#fff9e6" stroke={obj.color} strokeWidth={sw * 2} rx={obj.w * 0.05} />
               <rect x={obj.w * 0.3} y={0} width={obj.w * 0.15} height={obj.h * 0.15} fill={obj.color} rx={sw * 2} />
               <rect x={obj.w * 0.55} y={0} width={obj.w * 0.15} height={obj.h * 0.15} fill={obj.color} rx={sw * 2} />
               <rect x={obj.w * 0.3} y={obj.h * 0.85} width={obj.w * 0.15} height={obj.h * 0.15} fill={obj.color} rx={sw * 2} />
               <rect x={obj.w * 0.55} y={obj.h * 0.85} width={obj.w * 0.15} height={obj.h * 0.15} fill={obj.color} rx={sw * 2} />
               <rect x={0} y={obj.h * 0.35} width={obj.w * 0.15} height={obj.h * 0.3} fill={obj.color} rx={sw * 2} />
               <rect x={obj.w * 0.85} y={obj.h * 0.35} width={obj.w * 0.15} height={obj.h * 0.3} fill={obj.color} rx={sw * 2} />
             </g>
           )}
           {obj.subType === 'furniture-kitchen' && (
             <g>
               <rect x={0} y={0} width={obj.w} height={obj.h} fill="white" stroke={obj.color} strokeWidth={sw * 2} />
               <rect x={obj.w * 0.05} y={obj.h * 0.1} width={obj.w * 0.3} height={obj.h * 0.8} fill="none" stroke={obj.color} strokeWidth={sw} />
               <circle cx={obj.w * 0.2} cy={obj.h * 0.5} r={obj.h * 0.2} fill={obj.color} fillOpacity="0.2" />
               <rect x={obj.w * 0.5} y={obj.h * 0.1} width={obj.w * 0.45} height={obj.h * 0.8} fill="#1a1a1a" stroke={obj.color} strokeWidth={sw} />
               <circle cx={obj.w * 0.62} cy={obj.h * 0.5} r={obj.h * 0.25} fill="none" stroke="#ff7b00" strokeWidth={sw * 2} />
               <circle cx={obj.w * 0.82} cy={obj.h * 0.5} r={obj.h * 0.25} fill="none" stroke="#ff7b00" strokeWidth={sw * 2} />
             </g>
           )}
           {obj.subType === 'furniture-bath' && (
              <g>
                <rect x={obj.w * 0.1} y={0} width={obj.w * 0.8} height={obj.h * 0.25} fill="white" stroke={obj.color} strokeWidth={sw * 2} />
                <ellipse cx={obj.w * 0.5} cy={obj.h * 0.65} rx={obj.w * 0.35} ry={obj.h * 0.3} fill="white" stroke={obj.color} strokeWidth={sw * 2} />
                <circle cx={obj.w * 0.5} cy={obj.h * 0.65} r={obj.w * 0.1} fill={obj.color} fillOpacity="0.1" stroke={obj.color} strokeWidth={sw} />
              </g>
           )}
        </svg>
      );
    }
    if (obj.type === 'mep') {
      const sw = 1 / displayZoom;
      return (
        <svg width="100%" height="100%" viewBox={`0 0 ${obj.w} ${obj.h}`} preserveAspectRatio="none" className="overflow-visible pointer-events-none">
          {obj.subType === 'mep-light' && (
            <g>
              <circle cx={obj.w * 0.5} cy={obj.h * 0.5} r={Math.min(obj.w, obj.h) * 0.4} fill="#fef08a" stroke="#ca8a04" strokeWidth={sw * 2} />
              <line x1={obj.w * 0.2} y1={obj.h * 0.5} x2={obj.w * 0.8} y2={obj.h * 0.5} stroke="#ca8a04" strokeWidth={sw} />
              <line x1={obj.w * 0.5} y1={obj.h * 0.2} x2={obj.w * 0.5} y2={obj.h * 0.8} stroke="#ca8a04" strokeWidth={sw} />
            </g>
          )}
          {obj.subType === 'mep-fan' && (
            <g>
              <circle cx={obj.w * 0.5} cy={obj.h * 0.5} r={Math.min(obj.w, obj.h) * 0.45} fill="none" stroke="#f59e0b" strokeWidth={sw * 1.5} strokeDasharray="2 2" />
              <circle cx={obj.w * 0.5} cy={obj.h * 0.5} r={Math.min(obj.w, obj.h) * 0.15} fill="#f59e0b" />
              <line x1={obj.w * 0.5} y1={obj.h * 0.1} x2={obj.w * 0.5} y2={obj.h * 0.9} stroke="#f59e0b" strokeWidth={sw * 2} />
              <line x1={obj.w * 0.1} y1={obj.h * 0.5} x2={obj.w * 0.9} y2={obj.h * 0.5} stroke="#f59e0b" strokeWidth={sw * 2} />
            </g>
          )}
          {obj.subType === 'mep-socket' && (
            <g>
              <rect x={obj.w * 0.1} y={obj.h * 0.1} width={obj.w * 0.8} height={obj.h * 0.8} rx={obj.w * 0.1} fill="#1e293b" stroke="#38bdf8" strokeWidth={sw * 2} />
              <circle cx={obj.w * 0.35} cy={obj.h * 0.5} r={obj.w * 0.08} fill="#ffffff" />
              <circle cx={obj.w * 0.65} cy={obj.h * 0.5} r={obj.w * 0.08} fill="#ffffff" />
              <circle cx={obj.w * 0.5} cy={obj.h * 0.3} r={obj.w * 0.09} fill="#ffffff" />
            </g>
          )}
          {obj.subType === 'mep-pipe' && (
            <g>
              <line x1={0} y1={obj.h * 0.5} x2={obj.w} y2={obj.h * 0.5} stroke="#06b6d4" strokeWidth={sw * 6} strokeLinecap="round" />
              <line x1={0} y1={obj.h * 0.5} x2={obj.w} y2={obj.h * 0.5} stroke="#ffffff" strokeWidth={sw * 2} strokeDasharray="3 3" />
            </g>
          )}
          {obj.subType === 'mep-septic' && (
            <g>
              <rect x={0} y={0} width={obj.w} height={obj.h} fill="#1e293b" stroke="#10b981" strokeWidth={sw * 2.5} rx={obj.w * 0.04} />
              <line x1={obj.w * 0.35} y1={0} x2={obj.w * 0.35} y2={obj.h} stroke="#64748b" strokeWidth={sw * 2} />
              <line x1={obj.w * 0.7} y1={0} x2={obj.w * 0.7} y2={obj.h} stroke="#64748b" strokeWidth={sw * 2} />
              <text x={obj.w * 0.5} y={obj.h * 0.55} fill="#10b981" fontSize={Math.max(8, obj.w * 0.12)} fontWeight="bold" textAnchor="middle">SEPTIC TANK</text>
            </g>
          )}
        </svg>
      );
    }
    if (obj.type === 'landscape') {
      const sw = 1 / displayZoom;
      return (
        <svg width="100%" height="100%" viewBox={`0 0 ${obj.w} ${obj.h}`} preserveAspectRatio="none" className="overflow-visible pointer-events-none">
          {obj.subType === 'landscape-tree' && (
            <g>
              <circle cx={obj.w * 0.5} cy={obj.h * 0.5} r={Math.min(obj.w, obj.h) * 0.45} fill="#15803d" fillOpacity="0.25" stroke="#16a34a" strokeWidth={sw * 2} />
              <circle cx={obj.w * 0.5} cy={obj.h * 0.5} r={Math.min(obj.w, obj.h) * 0.3} fill="#16a34a" fillOpacity="0.4" />
              <circle cx={obj.w * 0.5} cy={obj.h * 0.5} r={Math.min(obj.w, obj.h) * 0.1} fill="#78350f" />
            </g>
          )}
          {obj.subType === 'landscape-garden' && (
            <g>
              <rect x={0} y={0} width={obj.w} height={obj.h} fill="#052e16" fillOpacity="0.3" stroke="#22c55e" strokeWidth={sw * 2} rx={obj.w * 0.05} />
              <text x={obj.w * 0.5} y={obj.h * 0.55} fill="#4ade80" fontSize={Math.max(8, obj.w * 0.12)} fontWeight="bold" textAnchor="middle">GARDEN / লন</text>
            </g>
          )}
          {obj.subType === 'landscape-car' && (
            <g>
              <rect x={0} y={0} width={obj.w} height={obj.h} fill="#1e293b" stroke="#38bdf8" strokeWidth={sw * 2} rx={obj.w * 0.08} />
              <rect x={obj.w * 0.15} y={obj.h * 0.2} width={obj.w * 0.7} height={obj.h * 0.6} fill="#0f172a" rx={obj.w * 0.05} />
              <text x={obj.w * 0.5} y={obj.h * 0.55} fill="#38bdf8" fontSize={Math.max(8, obj.w * 0.1)} fontWeight="bold" textAnchor="middle">PARKING (CAR)</text>
            </g>
          )}
        </svg>
      );
    }
    return null;
  };

  const getObjectStyle = (obj: DesignObject) => {
    let ox = 0, oy = 0;
    if (obj.rotation === 90) ox = obj.h; 
    else if (obj.rotation === 180) { ox = obj.w; oy = obj.h; } 
    else if (obj.rotation === 270) oy = obj.w;
    
    const isStructure = obj.subType === 'wall' || obj.subType === 'pillar';
    const isBeam = obj.subType === 'beam';
    const isAreaMarker = obj.subType === 'area-marker';
    return { 
      left: (obj.x + ox) * displayZoom + CANVAS_OFFSET, top: (obj.y + oy) * displayZoom + CANVAS_OFFSET, width: obj.w * displayZoom, height: obj.h * displayZoom, transformOrigin: '0 0', transform: `rotate(${obj.rotation}deg)`, 
      backgroundColor: isBeam ? 'rgba(59, 130, 246, 0.15)' : (isStructure ? obj.color : 'transparent'),
      border: isBeam ? '1.5px dashed #2563eb' : (isStructure ? '1px solid rgba(0,0,0,0.5)' : 'none'),
      outline: selectedObjectIds.includes(obj.id) ? '2px solid #ef4444' : 'none',
      cursor: isAreaMarker ? 'default' : (obj.isJoined ? 'not-allowed' : (selectedTool === 'move' ? 'grab' : 'move')),
      zIndex: isAreaMarker ? 1 : (isBeam ? 25 : (selectedObjectIds.includes(obj.id) ? 1000 : (obj.type === 'opening' ? 50 : 10))),
      pointerEvents: 'auto' as const,
      touchAction: 'none'
    };
  };

  return (
    <div className="w-full h-[100svh] bg-slate-900 flex flex-col overflow-hidden font-body text-slate-200 select-none relative pb-12">
      <div className="h-14 md:h-16 bg-slate-900 border-b border-slate-800 flex items-center px-2 md:px-3 justify-between shrink-0 text-white z-50 py-1 gap-2">
        <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
          <Building className="w-4 h-4 md:w-5 md:h-5 text-blue-400 shrink-0" />
          <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} className="h-8 w-24 md:w-36 lg:w-44 bg-slate-800 border-slate-700 text-[11px] md:text-xs text-white font-black focus:ring-1 focus:ring-blue-500 px-2" placeholder="প্রজেক্টের নাম..." />
        </div>
        
        <div className="flex-1 flex items-center justify-start gap-1 overflow-x-auto overflow-y-hidden flex-nowrap py-1 px-1 scrollbar-thin scrollbar-thumb-slate-700">
          <RibbonButton icon={<FilePlus />} label="New" onClick={handleNewPage} color="default" className="shrink-0" />
          <RibbonButton icon={<FolderOpen />} label="Open" onClick={() => fetchSavedDesigns().then(() => setIsOpenDialogOpen(true))} color="default" className="shrink-0" />
          <div className="w-px h-7 bg-slate-800 mx-0.5 shrink-0" />
          <RibbonButton icon={<Undo2 />} label="Undo" onClick={undo} color="blue" className="shrink-0" />
          <RibbonButton icon={<Redo2 />} label="Redo" onClick={redo} color="blue" className="shrink-0" />
          <div className="w-px h-7 bg-slate-800 mx-0.5 shrink-0" />
          <RibbonButton icon={<CopyIcon />} label="Copy" onClick={copySelected} color="amber" className="shrink-0" />
          <RibbonButton icon={<ClipboardIcon />} label="Paste" onClick={enterPasteMode} active={interactionMode === 'pasting'} color="amber" className="shrink-0" />
          <div className="w-px h-7 bg-slate-800 mx-0.5 shrink-0" />
          <RibbonButton icon={<CopyIcon />} label="Duplicate" onClick={duplicateProject} color="emerald" className="shrink-0" />
          <RibbonButton icon={<ImageIcon />} label="As Image" onClick={() => setIsExportDialogOpen(true)} color="emerald" className="shrink-0" />
          <RibbonButton icon={<Calculator />} label="হিসাব" onClick={() => setIsEstimationDialogOpen(true)} color="emerald" className="shrink-0" />
          <RibbonButton icon={<Square className="w-3.5 h-3.5" />} label={unitSystem === 'imperial' ? "ft" : "m"} onClick={() => setUnitSystem(unitSystem === 'imperial' ? 'metric' : 'imperial')} color="cyan" className="shrink-0" />
          <div className="w-px h-7 bg-slate-800 mx-0.5 shrink-0" />
          <RibbonButton icon={<ShieldCheck className="w-4 h-4" />} label="BNBC" onClick={() => setIsBnbcAuditOpen(true)} color="indigo" className="shrink-0" />
          <RibbonButton icon={<ClipboardList className="w-4 h-4" />} label="খতিয়ান" onClick={() => setIsSiteLedgerOpen(true)} color="emerald" className="shrink-0" />
          <div className="w-px h-7 bg-slate-800 mx-0.5 shrink-0" />
          <RibbonButton icon={<Layers className="w-4 h-4 text-blue-400" />} label="রড ডিটেইলিং" onClick={() => setIsStructuralDetailingOpen(true)} color="blue" className="shrink-0 font-bold" />
          <RibbonButton icon={<Building className="w-4 h-4 text-purple-400" />} label="সেকশন A-A" onClick={() => setIsSectionCutOpen(true)} color="violet" className="shrink-0 font-bold" />
          <RibbonButton icon={<Square className="w-4 h-4 text-emerald-400" />} label="সাইট প্ল্যান" onClick={() => setIsSitePlanSetbackOpen(true)} color="emerald" className="shrink-0 font-bold" />
          <RibbonButton icon={<Sparkles className="w-4 h-4 text-amber-400" />} label="MEP ওয়্যারিং" onClick={() => setIsMepStudioOpen(true)} color="amber" className="shrink-0 font-bold" />
          <RibbonButton icon={<Armchair className="w-4 h-4 text-pink-400" />} label="ইন্টেরিয়র" onClick={() => setIsInteriorLandscapeOpen(true)} color="pink" className="shrink-0 font-bold" />
          <div className="w-px h-7 bg-slate-800 mx-0.5 shrink-0" />
          <RibbonButton icon={<Magnet className="w-4 h-4" />} label={isSmartSnapEnabled ? "স্ন্যাপ: ON" : "স্ন্যাপ: OFF"} onClick={() => setIsSmartSnapEnabled(!isSmartSnapEnabled)} active={isSmartSnapEnabled} color="cyan" className="shrink-0" />
          <RibbonButton icon={<LayoutGrid />} label="All" onClick={selectAll} color="indigo" className="shrink-0" />
          <RibbonButton icon={<Layers />} label="3D View" onClick={() => setIs3DViewOpen(true)} color="indigo" className="shrink-0" />
          <Trash2 className="w-4 h-4 text-red-500 cursor-pointer ml-1" onClick={deleteSelected} />
        </div>

        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <Button variant="ghost" size="sm" className="h-7 text-[10px] md:text-sm hover:bg-slate-800 font-black text-white" onClick={saveToFirestore}><Save className="w-3 h-3 md:w-4 md:h-4 md:mr-2 text-green-400"/> SAVE</Button>
          <UserProfileMenu onOpenCloudGallery={() => setIsCloudGalleryOpen(true)} />
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        <div className="w-full md:w-[124px] bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 z-30 shrink-0 flex flex-col shadow-inner overflow-hidden">
          <ScrollArea orientation="both" className="h-full w-full">
            <div className="flex md:flex-col gap-1.5 p-1 items-center md:items-stretch min-w-max md:min-w-0 pr-10 md:pr-0">
              <SymbolButton active={selectedTool === 'select'} icon={<MousePointer2 />} label="Select" onClick={() => setSelectedTool('select')} color="blue" />
              <SymbolButton active={selectedTool === 'move'} icon={<Hand />} label="Move" onClick={() => setSelectedTool('move')} color="amber" />
              <SymbolButton active={selectedTool === 'wall'} icon={<Pencil />} label="Wall" onClick={() => setSelectedTool('wall')} color="emerald" />
              <SymbolButton active={selectedTool === 'room'} icon={<Square />} label="Room" onClick={() => setSelectedTool('room')} color="indigo" />
              <SymbolButton active={selectedTool === 'pillar'} icon={<PillarIcon />} label="Pillar" onClick={() => setSelectedTool('pillar')} color="slate" />
              <SymbolButton active={selectedTool === 'beam'} icon={<RectangleHorizontal className="w-4 h-4" />} label="Beam" onClick={() => setSelectedTool('beam')} color="cyan" />
              <SymbolButton active={selectedTool === 'area-marker'} icon={<Maximize2 className="w-4 h-4" />} label="রুম এরিয়া" onClick={() => setSelectedTool('area-marker')} color="sky" />
              
              <div className="w-full h-px bg-slate-800 my-1 hidden md:block" />
              <span className="text-[8px] font-black text-slate-500 uppercase text-center hidden md:block">Labels</span>
              
              <SymbolButton active={selectedTool === 'room-label-bed'} icon={<Bed className="w-4 h-4" />} label="Bed" onClick={() => setSelectedTool('room-label-bed')} color="blue" />
              <SymbolButton active={selectedTool === 'room-label-bath'} icon={<Bath className="w-4 h-4" />} label="Bath" onClick={() => setSelectedTool('room-label-bath')} color="teal" />
              <SymbolButton active={selectedTool === 'room-label-kitchen'} icon={<CookingPot className="w-4 h-4" />} label="Kitchen" onClick={() => setSelectedTool('room-label-kitchen')} color="emerald" />
              <SymbolButton active={selectedTool === 'room-label-living'} icon={<Armchair className="w-4 h-4" />} label="Living" onClick={() => setSelectedTool('room-label-living')} color="indigo" />
              <SymbolButton active={selectedTool === 'room-label-dining'} icon={<UtensilsCrossed className="w-4 h-4" />} label="Dining" onClick={() => setSelectedTool('room-label-dining')} color="amber" />
              <SymbolButton active={selectedTool === 'room-label-mandir'} icon={<Magnet className="w-4 h-4" />} label="Mandir" onClick={() => setSelectedTool('room-label-mandir')} color="purple" />
              <SymbolButton active={selectedTool === 'room-label-stair'} icon={<StairIcon className="w-4 h-4" />} label="Stair Room" onClick={() => setSelectedTool('room-label-stair')} color="violet" />
              <SymbolButton active={selectedTool === 'label'} icon={<TypeIcon />} label="Custom" onClick={() => setSelectedTool('label')} color="cyan" />

              <div className="w-full h-px bg-slate-800 my-1 hidden md:block" />
              <span className="text-[8px] font-black text-slate-500 uppercase text-center hidden md:block">Furniture</span>
              <SymbolButton active={selectedTool === 'furniture-bed'} icon={<Bed className="w-4 h-4" />} label="BED" onClick={() => setSelectedTool('furniture-bed')} color="blue" />
              <SymbolButton active={selectedTool === 'furniture-sofa'} icon={<Armchair className="w-4 h-4" />} label="SOFA" onClick={() => setSelectedTool('furniture-sofa')} color="indigo" />
              <SymbolButton active={selectedTool === 'furniture-dining'} icon={<UtensilsCrossed className="w-4 h-4" />} label="DINING" onClick={() => setSelectedTool('furniture-dining')} color="amber" />
              <SymbolButton active={selectedTool === 'furniture-kitchen'} icon={<CookingPot className="w-4 h-4" />} label="KITCHEN" onClick={() => setSelectedTool('furniture-kitchen')} color="emerald" />
              <SymbolButton active={selectedTool === 'furniture-bath'} icon={<Bath className="w-4 h-4" />} label="BATH" onClick={() => setSelectedTool('furniture-bath')} color="teal" />

              <div className="w-full h-px bg-slate-800 my-1 hidden md:block" />
              <SymbolButton active={selectedTool === 'stair-u'} icon={<Rows />} label="Stair 1" onClick={() => setSelectedTool('stair-u')} color="violet" />
              <SymbolButton active={selectedTool === 'stair-dogleg'} icon={<Rows />} label="Stair 2" onClick={() => setSelectedTool('stair-dogleg')} color="purple" />
              
              <div className="w-px h-3 bg-slate-800 mx-0.5 md:hidden" />
              <div className="flex md:flex-col gap-1.5 items-center md:items-stretch">
                <SymbolButton active={selectedTool === 'door-1'} icon={<DoorOpen />} label="D1" onClick={() => setSelectedTool('door-1')} color="teal" />
                <SymbolButton active={selectedTool === 'door-2'} icon={<DoorOpen />} label="D2" onClick={() => setSelectedTool('door-2')} color="teal" />
                <SymbolButton active={selectedTool === 'door-3'} icon={<DoorOpen />} label="D3" onClick={() => setSelectedTool('door-3')} color="teal" />
                <SymbolButton active={selectedTool === 'door-4'} icon={<DoorOpen />} label="D4" onClick={() => setSelectedTool('door-4')} color="teal" />
                <SymbolButton active={selectedTool === 'double-door'} icon={<LayoutGrid />} label="DBL" onClick={() => setSelectedTool('double-door')} color="pink" />
                <SymbolButton active={selectedTool === 'window'} icon={<Wind />} label="WIN" onClick={() => setSelectedTool('window')} color="sky" />
              </div>

              <div className="w-full h-px bg-slate-800 my-1 hidden md:block" />
              <span className="text-[8px] font-black text-slate-500 uppercase text-center hidden md:block">MEP & Plumbing</span>
              <SymbolButton active={selectedTool === 'mep-light'} icon={<Lightbulb className="w-4 h-4" />} label="Light" onClick={() => setSelectedTool('mep-light')} color="amber" />
              <SymbolButton active={selectedTool === 'mep-fan'} icon={<Fan className="w-4 h-4" />} label="Fan" onClick={() => setSelectedTool('mep-fan')} color="amber" />
              <SymbolButton active={selectedTool === 'mep-socket'} icon={<Zap className="w-4 h-4" />} label="Socket" onClick={() => setSelectedTool('mep-socket')} color="blue" />
              <SymbolButton active={selectedTool === 'mep-pipe'} icon={<Droplets className="w-4 h-4" />} label="Pipe" onClick={() => setSelectedTool('mep-pipe')} color="cyan" />
              <SymbolButton active={selectedTool === 'mep-septic'} icon={<Boxes className="w-4 h-4" />} label="Septic" onClick={() => setSelectedTool('mep-septic')} color="emerald" />

              <div className="w-full h-px bg-slate-800 my-1 hidden md:block" />
              <span className="text-[8px] font-black text-slate-500 uppercase text-center hidden md:block">Landscape</span>
              <SymbolButton active={selectedTool === 'landscape-tree'} icon={<Trees className="w-4 h-4" />} label="Tree" onClick={() => setSelectedTool('landscape-tree')} color="emerald" />
              <SymbolButton active={selectedTool === 'landscape-garden'} icon={<Flower2 className="w-4 h-4" />} label="Garden" onClick={() => setSelectedTool('landscape-garden')} color="teal" />
              <SymbolButton active={selectedTool === 'landscape-car'} icon={<Car className="w-4 h-4" />} label="Parking" onClick={() => setSelectedTool('landscape-car')} color="sky" />
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 relative flex flex-col bg-slate-200 overflow-hidden">
          <Ruler orientation="horizontal" />
          <div className="flex-1 flex overflow-hidden relative">
            <Ruler orientation="vertical" />
            <div 
              ref={canvasRef} id="canvas-workspace-inner" 
              className="flex-1 relative bg-white overflow-auto cursor-crosshair" 
              onMouseDown={(e) => handleMouseDown(e, null)} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onTouchStart={(e) => handleMouseDown(e, null)} onTouchMove={handleMouseMove} onTouchEnd={handleMouseUp}
            >
              <div className="absolute" style={{ backgroundImage: `linear-gradient(#f1f5f9 1px, transparent 1px), linear-gradient(90deg, #f1f5f9 1px, transparent 1px)`, backgroundSize: `${safeDisplayZoom * gridConfig.minor}px ${safeDisplayZoom * gridConfig.minor}px`, backgroundPosition: `${CANVAS_OFFSET}px ${CANVAS_OFFSET}px`, width: 20000, height: 20000 }}>
                {renderPillarDistances()}
                {designObjects.map(obj => (
                  <div key={obj.id} data-id={obj.id} onMouseDown={(e) => handleMouseDown(e, obj.id)} onTouchStart={(e) => handleMouseDown(e, obj.id)} className={cn("absolute design-object-container", selectedObjectIds.includes(obj.id) ? "z-30" : "z-10")} style={getObjectStyle(obj)}>
                    {renderObjectContent(obj)}
                    {selectedObjectIds.includes(obj.id) && !obj.isJoined && (
                       <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-8 h-8 bg-white border border-slate-300 rounded-full flex items-center justify-center cursor-alias shadow-sm hover:bg-slate-50 z-[60] rotation-handle" onMouseDown={(e) => { e.stopPropagation(); setInteractionMode('rotating'); }} onTouchStart={(e) => { e.stopPropagation(); setInteractionMode('rotating'); }}><RotateCw className="w-4 h-4 text-blue-500" /></div>
                    )}
                    {showDimensions && !obj.points && (
                      <>
                        <div className="absolute -top-8 left-0 right-0 flex items-center justify-between pointer-events-none z-[50] dimension-label"><div className="w-[1.5px] h-4 bg-slate-500" /><div className="flex-1 h-[1px] bg-slate-400 mx-0.5 relative flex items-center justify-center"><div className="bg-white/95 px-2 py-0.5 rounded-sm border border-slate-400 shadow-sm"><span className="text-[10px] font-black text-slate-900" style={{ fontSize: Math.max(8, 10 * gridConfig.labelScale) + 'px' }}>{formatDimension(obj.w)}</span></div></div><div className="w-[1.5px] h-4 bg-slate-500" /></div>
                        <div className="absolute top-0 bottom-0 -right-10 flex flex-col items-center justify-between pointer-events-none z-[50] dimension-label"><div className="h-[1.5px] w-4 bg-slate-500" /><div className="flex-1 w-[1px] bg-slate-400 my-0.5 relative flex flex-col items-center justify-center"><div className="bg-white/95 px-2 py-0.5 rounded-sm border border-slate-400 shadow-sm rotate-90"><span className="text-[10px] font-black text-slate-900" style={{ fontSize: Math.max(8, 10 * gridConfig.labelScale) + 'px' }}>{formatDimension(obj.h)}</span></div></div><div className="h-[1.5px] w-4 bg-slate-500" /></div>
                      </>
                    )}
                  </div>
                ))}
                {interactionMode === 'drawing' && drawStart && tempDrawEnd && (
                  <div className={cn("absolute border-2 border-dashed", selectedTool === 'beam' ? "bg-blue-500/25 border-blue-600" : "bg-blue-500/20 border-blue-500")} style={{ left: drawStart.x * displayZoom + CANVAS_OFFSET, top: drawStart.y * displayZoom + CANVAS_OFFSET, width: Math.sqrt(Math.pow(tempDrawEnd.x - drawStart.x, 2) + Math.pow(tempDrawEnd.y - drawStart.y, 2)) * displayZoom, height: (selectedTool === 'beam' ? 0.833 : currentWallThickness) * displayZoom, transformOrigin: '0 0', transform: `rotate(${Math.atan2(tempDrawEnd.y - drawStart.y, tempDrawEnd.x - drawStart.x) * (180 / Math.PI)}deg)` }} />
                )}
                {interactionMode === 'drawing-poly' && polyPoints.length > 0 && (
                   <div className="absolute inset-0 pointer-events-none" style={{ left: CANVAS_OFFSET, top: CANVAS_OFFSET }}>
                      <svg width="20000" height="20000" className="overflow-visible">
                        <polyline points={polyPoints.map(p => `${p.x * displayZoom},${p.y * displayZoom}`).join(' ') + (tempDrawEnd ? ` ${tempDrawEnd.x * displayZoom},${tempDrawEnd.y * displayZoom}` : '')} fill="none" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4,4" />
                        {polyPoints.map((p, i) => <circle key={i} cx={p.x * displayZoom} cy={p.y * displayZoom} r={4} fill={i === 0 ? "#ef4444" : "#3b82f6"} stroke="white" strokeWidth={1} />)}
                        {polyPoints.map((p, i) => {
                          if (i === 0) return null;
                          const prev = polyPoints[i - 1];
                          const dist = Math.sqrt(Math.pow(p.x - prev.x, 2) + Math.pow(p.y - prev.y, 2));
                          const mx = (prev.x + p.x) / 2 * displayZoom;
                          const my = (prev.y + p.y) / 2 * displayZoom;
                          const label = formatDimension(dist);
                          return (
                            <g key={`seg-lbl-${i}`}>
                              <rect x={mx - 24} y={my - 10} width={48} height={18} rx={3} fill="white" stroke="#3b82f6" strokeWidth={1} opacity={0.93} />
                              <text x={mx} y={my + 4} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#1e40af" fontFamily="monospace">{label}</text>
                            </g>
                          );
                        })}
                        {tempDrawEnd && polyPoints.length > 0 && (() => {
                          const last = polyPoints[polyPoints.length - 1];
                          const dist = Math.sqrt(Math.pow(tempDrawEnd.x - last.x, 2) + Math.pow(tempDrawEnd.y - last.y, 2));
                          const mx = (last.x + tempDrawEnd.x) / 2 * displayZoom;
                          const my = (last.y + tempDrawEnd.y) / 2 * displayZoom;
                          const label = formatDimension(dist);
                          return (
                            <g key="live-seg">
                              <rect x={mx - 24} y={my - 10} width={48} height={18} rx={3} fill="#eff6ff" stroke="#93c5fd" strokeWidth={1} opacity={0.92} />
                              <text x={mx} y={my + 4} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#2563eb" fontFamily="monospace">{label}</text>
                            </g>
                          );
                        })()}
                      </svg>
                   </div>
                )}
                {interactionMode === 'selecting' && selectionBox && (
                  <div className="absolute border-2 border-blue-500 bg-blue-500/10 z-[70]" style={{ left: Math.min(selectionBox.x1, selectionBox.x2) * displayZoom + CANVAS_OFFSET, top: Math.min(selectionBox.y1, selectionBox.y2) * displayZoom + CANVAS_OFFSET, width: Math.abs(selectionBox.x2 - selectionBox.x1) * displayZoom, height: Math.abs(selectionBox.y2 - selectionBox.y1) * displayZoom }} />
                )}
                {activeSnapGuides && (
                  <>
                    {activeSnapGuides.x !== undefined && <div className="absolute pointer-none z-[80] border-l-2 border-dashed border-cyan-400 opacity-90 shadow-sm" style={{ left: activeSnapGuides.x * displayZoom + CANVAS_OFFSET, top: 0, bottom: 0, height: 20000 }}><div className="bg-cyan-500 text-white text-[8px] font-mono px-1 rounded absolute top-2 left-1">X: {activeSnapGuides.x.toFixed(1)}'</div></div>}
                    {activeSnapGuides.y !== undefined && <div className="absolute pointer-none z-[80] border-t-2 border-dashed border-cyan-400 opacity-90 shadow-sm" style={{ top: activeSnapGuides.y * displayZoom + CANVAS_OFFSET, left: 0, right: 0, width: 20000 }}><div className="bg-cyan-500 text-white text-[8px] font-mono px-1 rounded absolute left-2 top-1">Y: {activeSnapGuides.y.toFixed(1)}'</div></div>}
                  </>
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
          <div className="h-10 bg-slate-900 border-t border-slate-800 flex items-center px-4 justify-between shrink-0 z-40 text-white text-[11px]">
            <div className="flex items-center gap-2 md:gap-4">
              <ZoomOut className="w-3.5 h-3.5 text-slate-400 cursor-pointer" onClick={() => setZoom(z => Math.max(5, z - 1))} />
              <Slider value={[zoom]} max={250} min={0} step={1} className="w-20 md:w-32" onValueChange={(val) => setZoom(val[0])} />
              <ZoomIn className="w-3.5 h-3.5 text-slate-400 cursor-pointer" onClick={() => setZoom(z => Math.min(250, z + 1))} />
              <div className="flex items-center gap-1 ml-1 md:ml-2"><Input type="number" value={zoom === 0 ? "" : zoom} onChange={(e) => { const val = parseInt(e.target.value); setZoom(isNaN(val) ? 0 : Math.min(250, val)); }} onBlur={() => { if (zoom < 5) setZoom(5); }} className="h-5 w-12 text-[10px] md:text-[11px] font-black text-center border-slate-700 bg-slate-800 text-white p-0" /><span className="text-[8px] font-black text-slate-400 uppercase">%</span></div>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              <div className="flex items-center gap-1 md:gap-2"><span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase">Pillar Line</span><Checkbox checked={showPillarDistances} onCheckedChange={(val) => setShowPillarDistances(!!val)} className="scale-75 border-slate-600 data-[state=checked]:bg-blue-600" /></div>
              <div className="flex items-center gap-1 md:gap-2"><span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase">Dimensions</span><Checkbox checked={showDimensions} onCheckedChange={(val) => setShowDimensions(!!val)} className="scale-75 border-slate-600 data-[state=checked]:bg-blue-600" /></div>
              <div className="flex items-center bg-slate-800 p-0.5 rounded border border-slate-700"><button type="button" onClick={() => setUnitSystem('imperial')} className={cn("px-1.5 py-0.5 rounded text-[8px] md:text-[9px] font-black transition-colors", unitSystem === 'imperial' ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white")} title="ফুট-ইঞ্চি মোড">ft-in</button><button type="button" onClick={() => setUnitSystem('metric')} className={cn("px-1.5 py-0.5 rounded text-[8px] md:text-[9px] font-black transition-colors", unitSystem === 'metric' ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white")} title="মিটার-সেমি মোড">m-cm</button></div>
            </div>
          </div>
          <div className="h-10 w-full bg-slate-900 border-t border-slate-800 flex items-center shrink-0 z-40 relative group/bbar overflow-hidden">
            <Button variant="secondary" size="icon" className="absolute left-0 h-full w-6 z-50 rounded-none border-r border-slate-700 opacity-100 bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center shadow-md p-0" onClick={() => scrollBottomBar('left')}><ChevronLeft className="w-3 h-3 text-white" /></Button>
            <div ref={bottomBarRef} className="flex-1 h-full overflow-x-auto overflow-y-hidden select-none" style={{ scrollbarWidth: 'none' }}>
              <div className="flex items-center px-8 gap-4 min-w-max h-full text-[11px]">
                {firstSelectedObject ? (
                  <div className="flex items-center gap-4 flex-nowrap py-0">
                    <div className="flex items-center gap-1 pr-2 border-r border-slate-800"><Switch checked={firstSelectedObject.isJoined} onCheckedChange={(val) => updateObject(firstSelectedObject.id, { isJoined: val }, true)} className="scale-50" /><span className="text-[8px] font-black text-slate-400 uppercase">সংযুক্ত</span></div>
                    <div className="flex items-center gap-2 flex-nowrap">
                      {firstSelectedObject.subType === 'beam' ? (
                        <>
                          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-950/60 border border-blue-500/40 text-blue-400 font-black text-[9px] uppercase">
                            <RectangleHorizontal className="w-3 h-3" /> {firstSelectedObject.label || 'BEAM'}
                          </div>
                          <PropField label="X" value={localPropX} onChange={setLocalPropX} onBlur={() => updateObject(firstSelectedObject.id, { x: parseDimensionInput(localPropX) }, true)} disabled={firstSelectedObject.isJoined} />
                          <PropField label="Y" value={localPropY} onChange={setLocalPropY} onBlur={() => updateObject(firstSelectedObject.id, { y: parseDimensionInput(localPropY) }, true)} disabled={firstSelectedObject.isJoined} />
                          <PropField label="L" value={localPropW} onChange={setLocalPropW} onBlur={() => updateObject(firstSelectedObject.id, { w: parseDimensionInput(localPropW) }, true)} disabled={firstSelectedObject.isJoined} />
                          <PropField label="W" value={localPropH} onChange={setLocalPropH} onBlur={() => updateObject(firstSelectedObject.id, { h: parseDimensionInput(localPropH) }, true)} disabled={firstSelectedObject.isJoined} />
                          <PropField label="H" value={localPropDepth} onChange={setLocalPropDepth} onBlur={() => updateObject(firstSelectedObject.id, { depth: parseFloat(localPropDepth) || 12 }, true)} disabled={firstSelectedObject.isJoined} />
                          <PropField label="কোণ" value={localPropRot} onChange={setLocalPropRot} onBlur={() => updateObject(firstSelectedObject.id, { rotation: parseInt(localPropRot) || 0 }, true)} />
                        </>
                      ) : (
                        <>
                          {(firstSelectedObject.subType === 'pillar' || firstSelectedObject.type === 'pillar') && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-black text-[9px] uppercase">
                              <PillarIcon className="w-3 h-3" /> {firstSelectedObject.label || 'C1'}
                            </div>
                          )}
                          <PropField label="X" value={localPropX} onChange={setLocalPropX} onBlur={() => updateObject(firstSelectedObject.id, { x: parseDimensionInput(localPropX) }, true)} disabled={firstSelectedObject.isJoined} />
                          <PropField label="Y" value={localPropY} onChange={setLocalPropY} onBlur={() => updateObject(firstSelectedObject.id, { y: parseDimensionInput(localPropY) }, true)} disabled={firstSelectedObject.isJoined} />
                          <PropField label="W" value={localPropW} onChange={setLocalPropW} onBlur={() => updateObject(firstSelectedObject.id, { w: parseDimensionInput(localPropW) }, true)} disabled={firstSelectedObject.isJoined} />
                          <PropField label="H" value={localPropH} onChange={setLocalPropH} onBlur={() => updateObject(firstSelectedObject.id, { h: parseDimensionInput(localPropH) }, true)} disabled={firstSelectedObject.isJoined} />
                          <PropField label="কোণ" value={localPropRot} onChange={setLocalPropRot} onBlur={() => updateObject(firstSelectedObject.id, { rotation: parseInt(localPropRot) || 0 }, true)} />
                        </>
                      )}
                      {firstSelectedObject.type === 'stair' && (<PropField label="ধাপ" value={localPropSteps} onChange={setLocalPropSteps} onBlur={() => updateObject(firstSelectedObject.id, { stepCount: parseInt(localPropSteps) || 10 }, true)} />)}
                      {firstSelectedObject.type === 'text' && (
                        <>
                          <div className="flex flex-col gap-0.5 min-w-[100px]"><span className="text-[7px] font-black text-slate-400 uppercase tracking-tight w-full">লেখা/মাপ</span><Input className="h-8 w-full text-[10px] font-black border-slate-700 bg-slate-800 text-white shadow-sm px-1 py-0 flex items-center leading-none" value={localPropText} onChange={e => setLocalPropText(e.target.value)} onBlur={() => updateObject(firstSelectedObject.id, { textContent: localPropText }, true)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></div>
                          <PropField label="সাইজ" value={localPropFontSize} onChange={setLocalPropFontSize} onBlur={() => updateObject(firstSelectedObject.id, { fontSize: parseInt(localPropFontSize) || 14 }, true)} />
                          <Button variant={firstSelectedObject.isBold ? "default" : "outline"} size="icon" className="h-5 w-5 ml-0.5 border-slate-700 bg-slate-800 text-white p-0" onClick={() => updateObject(firstSelectedObject.id, { isBold: !firstSelectedObject.isBold }, true)}><BoldIcon className="w-2.5 h-2.5" /></Button>
                        </>
                      )}
                      <div className="flex items-center gap-0.5 border-l border-slate-800 pl-1 flex-nowrap"><Button variant="outline" size="icon" className="h-5 w-5 border-slate-700 bg-slate-800 text-white p-0" title="Front" onClick={bringToFront}><ArrowUpToLine className="w-2.5 h-2.5 text-blue-400" /></Button><Button variant="outline" size="icon" className="h-5 w-5 border-slate-700 bg-slate-800 text-white p-0" title="Back" onClick={sendToBack}><ArrowUpToLine className="w-2.5 h-2.5 text-blue-400" style={{ transform: 'rotate(180deg)' }} /></Button></div>
                    </div>
                    <div className="flex items-center gap-0.5 border-l border-slate-800 pl-2 flex-nowrap">{COLORS.map(c => <div key={c} onClick={() => updateObject(firstSelectedObject.id, { color: c, fillColor: c === '#ffffff' ? '#ffffff' : c }, true)} className={cn("w-3 h-3 rounded-full cursor-pointer border shadow-sm transition-transform hover:scale-110 shrink-0", firstSelectedObject.color === c ? "ring-1 ring-red-600" : "border-slate-700")} style={{ backgroundColor: c }} />)}</div>
                  </div>
                ) : selectedTool === 'beam' ? (
                  <div className="flex items-center gap-3 flex-nowrap py-0">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-950/60 border border-blue-500/40 text-blue-400 font-black text-[10px] uppercase">
                      <RectangleHorizontal className="w-3.5 h-3.5" /> বিম সাইজ সেটিং:
                    </div>
                    <div className="flex items-center gap-2 flex-nowrap">
                      <PropField 
                        label="L" 
                        value={formatDimension(currentBeamLength, unitSystem)} 
                        onChange={v => setCurrentBeamLength(parseDimensionInput(v) || 10)} 
                        onBlur={() => {}} 
                      />
                      <PropField 
                        label="W" 
                        value={formatDimension(currentBeamWidth, unitSystem)} 
                        onChange={v => setCurrentBeamWidth(parseDimensionInput(v) || 0.833)} 
                        onBlur={() => {}} 
                      />
                      <PropField 
                        label="H" 
                        value={currentBeamDepth.toString()} 
                        onChange={v => setCurrentBeamDepth(parseFloat(v) || 12)} 
                        onBlur={() => {}} 
                      />
                    </div>
                  </div>
                ) : <div className="w-full flex items-center justify-center text-slate-500 italic text-[8px] uppercase tracking-widest font-black">Select Object to View Properties</div>}
              </div>
            </div>
            <Button variant="secondary" size="icon" className="absolute right-0 h-full w-6 z-50 rounded-none border-l border-slate-700 opacity-100 bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center shadow-md p-0" onClick={() => scrollBottomBar('right')}><ChevronRight className="w-3 h-3 text-white" /></Button>
          </div>
        </div>
      </div>

      <Dialog open={isOpenDialogOpen} onOpenChange={setIsOpenDialogOpen}>
        <DialogContent className="max-w-md bg-white p-0 overflow-hidden rounded-xl border shadow-2xl">
          <DialogHeader className="p-6 bg-slate-50 border-b"><DialogTitle className="flex items-center gap-2 text-slate-800"><FolderOpen className="w-5 h-5 text-amber-500" />Saved Designs</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-[60vh] p-4">
            <div className="grid gap-2">
              {savedDesigns.length > 0 ? (
                savedDesigns.map((design) => (
                  <div key={design.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-blue-50 hover:border-blue-200 cursor-pointer transition-all group">
                    <div onClick={() => loadDesign(design.id)} className="flex flex-col gap-0.5 flex-1"><span className="font-bold text-sm text-slate-700 group-hover:text-blue-600">{design.name}</span><span className="text-[10px] text-slate-400">{design.updatedAt ? new Date(design.updatedAt.seconds * 1000).toLocaleString('bn-BD') : "তারিখ অজানা"}</span></div>
                    <div className="flex items-center gap-1"><Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500" onClick={() => loadDesign(design.id)}><Search className="w-4 h-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); deleteProjectFromDb(design.id, design.name); }}><Trash2 className="w-4 h-4" /></Button></div>
                  </div>
                ))
              ) : (<div className="p-8 text-center text-slate-400 italic">No saved designs</div>)}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={isExportDialogOpen} onOpenChange={(open) => { setIsExportDialogOpen(open); if (open) { fetchSavedDesigns(); setExportSettings(prev => ({ ...prev, targetProjectId: currentDesignId })); } }}>
        <DialogContent className="max-w-md bg-white rounded-xl border shadow-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Download className="w-5 h-5 text-blue-500" /> Export Design</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2"><Label className="font-black text-slate-700 uppercase text-[10px]">Select Project to Export</Label><Select value={exportSettings.targetProjectId} onValueChange={(v) => setExportSettings({...exportSettings, targetProjectId: v})}><SelectTrigger className="font-black h-12"><SelectValue placeholder="Select a project" /></SelectTrigger><SelectContent><SelectItem value={currentDesignId} className="font-black">{projectName} (Current)</SelectItem>{savedDesigns.filter(d => d.id !== currentDesignId).map(d => <SelectItem key={d.id} value={d.id} className="font-black">{d.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label className="font-black text-slate-700 uppercase text-[10px]">Export Format</Label><Select value={exportSettings.format} onValueChange={(v: any) => setExportSettings({...exportSettings, format: v})}><SelectTrigger className="font-black h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="png" className="font-black">Image (PNG)</SelectItem><SelectItem value="pdf" className="font-black">Document (PDF - A4)</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label className="font-black text-slate-700 uppercase text-[10px]">Select Area</Label><Select value={exportSettings.area} onValueChange={(v: any) => setExportSettings({...exportSettings, area: v})}><SelectTrigger className="font-black h-12"><SelectValue placeholder="Select Area" /></SelectTrigger><SelectContent><SelectItem value="all" className="font-black">Full Workspace</SelectItem><SelectItem value="custom" className="font-black">Custom Area Range</SelectItem></SelectContent></Select></div>
            {exportSettings.area === 'custom' && (
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-slate-400">Length From (ft)</Label><Input type="number" value={exportSettings.xStart} onChange={e => setExportSettings({...exportSettings, xStart: parseFloat(e.target.value) || 0})} className="font-black" /></div>
                <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-slate-400">Length To (ft)</Label><Input type="number" value={exportSettings.xEnd} onChange={e => setExportSettings({...exportSettings, xEnd: parseFloat(e.target.value) || 0})} className="font-black" /></div>
                <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-slate-400">Width From (ft)</Label><Input type="number" value={exportSettings.yStart} onChange={e => setExportSettings({...exportSettings, yStart: parseFloat(e.target.value) || 0})} className="font-black" /></div>
                <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-slate-400">Width To (ft)</Label><Input type="number" value={exportSettings.yEnd} onChange={e => setExportSettings({...exportSettings, yEnd: parseFloat(e.target.value) || 0})} className="font-black" /></div>
              </div>
            )}
            <div className="flex items-center gap-6 py-2 border-t pt-4"><div className="flex items-center gap-2"><Checkbox id="exp-dim" checked={exportSettings.showDimensions} onCheckedChange={(v) => setExportSettings({...exportSettings, showDimensions: !!v})} /><Label htmlFor="exp-dim" className="text-[10px] font-black uppercase cursor-pointer">Show Dimensions</Label></div><div className="flex items-center gap-2"><Checkbox id="exp-pill" checked={exportSettings.showPillars} onCheckedChange={(v) => setExportSettings({...exportSettings, showPillars: !!v})} /><Label htmlFor="exp-pill" className="text-[10px] font-black uppercase cursor-pointer">Pillar Lines</Label></div></div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2"><Button onClick={() => handleExport('download')} className="flex-1 bg-blue-600 hover:bg-blue-700 font-black gap-2 h-11">{exportSettings.format === 'png' ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}ডাউনলোড {exportSettings.format.toUpperCase()}</Button><Button onClick={() => handleExport('cloud')} disabled={isCloudUploading} variant="outline" className="flex-1 border-cyan-500/60 text-cyan-600 hover:bg-cyan-50 font-black gap-2 h-11">{isCloudUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4 text-cyan-500" />}ক্লাউডে সেভ করুন</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <CloudGalleryDialog open={isCloudGalleryOpen} onOpenChange={setIsCloudGalleryOpen} />
      <ThreeDViewDialog open={is3DViewOpen} onOpenChange={setIs3DViewOpen} designObjects={designObjects} projectName={projectName} />
      <Dialog open={isEstimationDialogOpen} onOpenChange={isEstimationDialogOpen ? setIsEstimationDialogOpen : undefined}><DialogContent className="max-w-[92vw] lg:max-w-5xl w-full h-[95vh] p-0 overflow-hidden rounded-xl border shadow-2xl bg-white [&>button]:hidden"><EstimationView designObjects={designObjects} onBack={() => setIsEstimationDialogOpen(false)} onSave={saveToFirestore} foundations={foundations} setFoundations={setFoundations} columns={columns} setColumns={setColumns} beams={beams} setBeams={setBeams} slabs={slabs} setSlabs={setSlabs} stairs={stairs} setStairs={setStairs} brickworks={brickworks} setBrickworks={setBrickworks} plasters={plasters} setPlasters={setPlasters} floorTiles={floorTiles} setFloorTiles={setFloorTiles} wallTiles={wallTiles} setWallTiles={setWallTiles} septicTanks={septicTanks} setSepticTanks={setSepticTanks} soakWells={soakWells} setSoakWells={setSoakWells} prices={prices} setPrices={setPrices} unitSystem={unitSystem} onOpenMarketSync={() => setIsMarketSyncOpen(true)} onOpenAdvancedPdfReport={(total, grandTotal) => { setPdfReportPayload({ total, grandTotalCost: grandTotal }); setIsAdvancedPdfReportOpen(true); }} /></DialogContent></Dialog>
      <MarketPriceSyncDialog open={isMarketSyncOpen} onOpenChange={setIsMarketSyncOpen} currentPrices={prices} onApplyPrices={(newPrices) => setPrices(newPrices)} />
      <AdvancedPdfReportDialog open={isAdvancedPdfReportOpen} onOpenChange={setIsAdvancedPdfReportOpen} projectName={projectName} total={pdfReportPayload?.total || { cement: 0, sand: 0, stone: 0, chips: 0, rod: 0, bricks: 0, floorTiles: 0, wallTiles: 0, labor: 0, doors: 0, windows: 0 }} prices={prices} grandTotalCost={pdfReportPayload?.grandTotalCost || 0} unitSystem={unitSystem} foundationsCount={foundations.length} columnsCount={columns.length} />
      <BnbcStructuralAuditDialog open={isBnbcAuditOpen} onOpenChange={setIsBnbcAuditOpen} designObjects={designObjects} projectName={projectName} />
      <DailySiteManagementDialog open={isSiteLedgerOpen} onOpenChange={setIsSiteLedgerOpen} projectName={projectName} currentDesignId={currentDesignId} grandTotalEstimatedCost={pdfReportPayload?.grandTotalCost || 0} materialsLedger={materialsLedger} setMaterialsLedger={setMaterialsLedger} laborLedger={laborLedger} setLaborLedger={setLaborLedger} onIntegratedSave={saveToFirestore} />
      
      {/* 5 Specialized Architectural & Engineering CAD Modules */}
      <StructuralDetailingDialog open={isStructuralDetailingOpen} onOpenChange={setIsStructuralDetailingOpen} designObjects={designObjects} projectName={projectName} onSave={saveToFirestore} />
      <SectionGeneratorDialog open={isSectionCutOpen} onOpenChange={setIsSectionCutOpen} designObjects={designObjects} projectName={projectName} />
      <SitePlanSetbackDialog open={isSitePlanSetbackOpen} onOpenChange={setIsSitePlanSetbackOpen} designObjects={designObjects} projectName={projectName} />
      <MepStudioDialog open={isMepStudioOpen} onOpenChange={setIsMepStudioOpen} designObjects={designObjects} projectName={projectName} />
      <InteriorLandscapeDialog open={isInteriorLandscapeOpen} onOpenChange={setIsInteriorLandscapeOpen} designObjects={designObjects} projectName={projectName} />
    </div>
  );
}

function EstimationView({ designObjects, onBack, onSave, foundations, setFoundations, columns, setColumns, beams, setBeams, slabs, setSlabs, stairs, setStairs, brickworks, setBrickworks, plasters, setPlasters, floorTiles, setFloorTiles, wallTiles, setWallTiles, septicTanks, setSepticTanks, soakWells, setSoakWells, prices, setPrices, unitSystem = 'imperial', onOpenMarketSync, onOpenAdvancedPdfReport }: { designObjects: DesignObject[], onBack: () => void, onSave: () => void, foundations: any[], setFoundations: (v: any[]) => void, columns: any[], setColumns: (v: any[]) => void, beams: any[], setBeams: (v: any[]) => void, slabs: any[], setSlabs: (v: any[]) => void, stairs: any[], setStairs: (v: any[]) => void, brickworks: any[], setBrickworks: (v: any[]) => void, plasters: any[], setPlasters: (v: any[]) => void, floorTiles: any[], setFloorTiles: (v: any[]) => void, wallTiles: any[], setWallTiles: (v: any[]) => void, septicTanks: any[], setSepticTanks: (v: any[]) => void, soakWells: any[], setSoakWells: (v: any[]) => void, prices: any, setPrices: (v: any) => void, unitSystem?: 'imperial' | 'metric', onOpenMarketSync?: () => void, onOpenAdvancedPdfReport?: (total: any, grandTotalCost: number) => void }) {
  const [activeTab, setActiveTab] = useState("foundation");
  const [advice, setAdvice] = useState<string | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [buildingStoreys, setBuildingStoreys] = useState(3);
  const [floorHeightFt, setFloorHeightFt] = useState(10);
  const [wallHeightFt, setWallHeightFt] = useState(9);
  const [tabStoreys, setTabStoreys] = useState<Record<string,number>>({ foundation: 1, column: 3, beam: 3, slab: 3, brickwork: 3, plaster: 3, stair: 1, floorTiles: 3, wallTiles: 3 });

  const _polyArea = (pts: {x:number,y:number}[]) => { let a = 0; for (let i = 0; i < pts.length; i++) { const j = (i+1)%pts.length; a += pts[i].x*pts[j].y - pts[j].x*pts[i].y; } return Math.abs(a/2); };
  const _polyPerim = (pts: {x:number,y:number}[]) => { let p = 0; for (let i = 0; i < pts.length; i++) { const j = (i+1)%pts.length; p += Math.sqrt(Math.pow(pts[j].x-pts[i].x,2)+Math.pow(pts[j].y-pts[i].y,2)); } return p; };

  const detectedAreaMarkers = designObjects.filter(o => o.subType === 'area-marker');
  const totalDetectedArea = Math.round(detectedAreaMarkers.reduce((acc,m) => acc + (m.points ? _polyArea(m.points) : m.w*m.h), 0));
  const totalDetectedPerimeter = Math.round(detectedAreaMarkers.reduce((acc,m) => acc + (m.points ? _polyPerim(m.points) : 2*(m.w+m.h)), 0));

  const _getAutoParams = (s: number, sqrtA: number) => {
    const baySize = 15;
    const nbX = Math.max(1, Math.ceil(sqrtA/baySize)); const nbY = Math.max(1, Math.ceil(sqrtA/baySize));
    const numCols = (nbX+1)*(nbY+1);
    const colSz = s<=2?10:s<=4?12:s<=5?15:18;
    const bmH = s<=2?12:s<=4?14:16; const bmW = s<=4?10:12;
    const slabTk = s<=2?4:s<=4?5:5.5; const mRods = s<=2?4:s<=4?6:8;
    const ftSz = s<=2?4:s<=4?5:s<=5?6:7; const ftTk = s<=2?15:s<=4?18:s<=5?21:24;
    const totalBmLen = (nbX*baySize + nbY*baySize)*s;
    const slabSide = Math.round(sqrtA*10)/10;
    return { nbX, nbY, numCols, colSz, bmH, bmW, slabTk, mRods, ftSz, ftTk, totalBmLen, slabSide, baySize };
  };

  const autoGenerateAll = () => {
    const s = buildingStoreys; const flH = floorHeightFt; const wlH = wallHeightFt;
    const sqrtA = totalDetectedArea > 0 ? Math.sqrt(totalDetectedArea) : 20;
    const perim = totalDetectedPerimeter > 0 ? totalDetectedPerimeter : Math.round(4 * sqrtA);
    const gid = () => Math.random().toString(36).substr(2, 9);
    const p = _getAutoParams(s, sqrtA);

    // --- Read real pillars from canvas ---
    const canvasPillars = designObjects.filter(o => o.subType === 'pillar');
    const pillarGroups = new Map<string, any[]>();
    canvasPillars.forEach(pl => {
      const wIn = Math.max(10, Math.round(pl.w * 12)); const hIn = Math.max(10, Math.round(pl.h * 12));
      const key = `${wIn}x${hIn}`;
      if (!pillarGroups.has(key)) pillarGroups.set(key, []);
      pillarGroups.get(key)!.push(pl);
    });
    const pillarXs = [...new Set(canvasPillars.map(pl => Math.round(pl.x * 10) / 10))].sort((a, b) => a - b);
    const pillarYs = [...new Set(canvasPillars.map(pl => Math.round(pl.y * 10) / 10))].sort((a, b) => a - b);
    const xSpans = pillarXs.length > 1 ? pillarXs.slice(1).map((x, i) => Math.round((x - pillarXs[i]) * 10) / 10) : [];
    const ySpans = pillarYs.length > 1 ? pillarYs.slice(1).map((y, i) => Math.round((y - pillarYs[i]) * 10) / 10) : [];

    // FOUNDATION
    if (canvasPillars.length > 0) {
      const footItems = Array.from(pillarGroups.entries()).map(([key, pls]) => {
        const [wIn, hIn] = key.split('x').map(Number);
        const ftSz = Math.max(3, Math.ceil((Math.max(wIn, hIn) / 12 + (s <= 2 ? 2 : s <= 4 ? 2.5 : 3)) * 4) / 4);
        const ftTk = s <= 2 ? 15 : s <= 4 ? 18 : s <= 5 ? 21 : 24;
        const rodN = Math.ceil(ftSz * 12 / 6) + 1;
        return { id: gid(), count: pls.length, len: ftSz, wid: ftSz, thick: ftTk, rodLong: rodN, rodWidth: rodN, rodFactor: 0.48, aggregateType: 'stone' };
      });
      setFoundations(footItems);
    } else {
      setFoundations([{ id: gid(), count: p.numCols, len: p.ftSz, wid: p.ftSz, thick: p.ftTk, rodLong: Math.max(5, p.nbX + 2), rodWidth: Math.max(5, p.nbY + 2), rodFactor: 0.48, aggregateType: 'stone' }]);
    }

    // COLUMN — separate item per unique pillar size group
    if (canvasPillars.length > 0) {
      const colItems = Array.from(pillarGroups.entries()).map(([key, pls]) => {
        const [wIn, hIn] = key.split('x').map(Number);
        const mRods = s <= 2 ? 4 : s <= 4 ? 6 : 8;
        return { id: gid(), count: pls.length, len: wIn, wid: hIn, height: s * flH, rods: mRods, rodFactor: 0.48, ringRodFactor: 0.12, ringGap: 6, aggregateType: 'stone' };
      });
      setColumns(colItems);
    } else {
      setColumns([{ id: gid(), count: p.numCols, len: p.colSz, wid: p.colSz, height: s * flH, rods: p.mRods, rodFactor: 0.48, ringRodFactor: 0.12, ringGap: 6, aggregateType: 'stone' }]);
    }

    // BEAM — separate items per unique span direction
    const bmH = p.bmH; const bmW = p.bmW; const mRods = p.mRods;
    if (xSpans.length > 0 || ySpans.length > 0) {
      const beamItems: any[] = [];
      const uniqueXSpans = [...new Set(xSpans)];
      uniqueXSpans.forEach(span => {
        const cnt = xSpans.filter(x => x === span).length;
        beamItems.push({ id: gid(), len: Math.round(span * cnt * (pillarYs.length || 1) * s), height: bmH, wid: bmW, rods: mRods, rodFactor: 0.48, ringRodFactor: 0.12, ringGap: 6, aggregateType: 'stone' });
      });
      const uniqueYSpans = [...new Set(ySpans)];
      uniqueYSpans.forEach(span => {
        const cnt = ySpans.filter(y => y === span).length;
        beamItems.push({ id: gid(), len: Math.round(span * cnt * (pillarXs.length || 1) * s), height: bmH, wid: bmW, rods: mRods, rodFactor: 0.48, ringRodFactor: 0.12, ringGap: 6, aggregateType: 'stone' });
      });
      setBeams(beamItems.filter(b => b.len > 0).length > 0 ? beamItems.filter(b => b.len > 0) : [{ id: gid(), len: p.totalBmLen, height: bmH, wid: bmW, rods: mRods, rodFactor: 0.48, ringRodFactor: 0.12, ringGap: 6, aggregateType: 'stone' }]);
    } else {
      setBeams([{ id: gid(), len: p.totalBmLen, height: bmH, wid: bmW, rods: mRods, rodFactor: 0.48, ringRodFactor: 0.12, ringGap: 6, aggregateType: 'stone' }]);
    }

    // SLAB — one per area-marker per floor
    const slabTk = p.slabTk;
    if (detectedAreaMarkers.length > 0) {
      const slabItems: any[] = [];
      detectedAreaMarkers.forEach(m => {
        const area = m.points ? _polyArea(m.points) : m.w * m.h;
        const side = Math.round(Math.sqrt(area) * 10) / 10;
        for (let fl = 0; fl < s; fl++) slabItems.push({ id: gid(), len: side, wid: side, thick: slabTk, rodGap: 6, rodFactor: 0.30, aggregateType: 'stone' });
      });
      setSlabs(slabItems);
    } else {
      setSlabs(Array.from({ length: s }, () => ({ id: gid(), len: p.slabSide, wid: p.slabSide, thick: slabTk, rodGap: 6, rodFactor: 0.30, aggregateType: 'stone' })));
    }

    // STAIR — one stair block with s-1 flights (one per floor connection)
    const stairWid = 3.5; const stepsPerFlight = Math.round(flH * 12 / 7);
    setStairs([{ id: gid(), count: Math.max(1, s - 1), wLen: Math.round(stepsPerFlight * 10 / 12 * 10) / 10, wid: stairWid, thick: 5, steps: stepsPerFlight, riser: 7, tread: 10, lLen: stairWid + 0.5, lWid: stairWid, mainFactor: 0.30, distFactor: 0.19, mainGap: 5, distGap: 6, aggregateType: 'stone' }]);

    // BRICKWORK — per area-marker per floor
    if (detectedAreaMarkers.length > 0) {
      const bwItems: any[] = [];
      detectedAreaMarkers.forEach(m => {
        const pm = m.points ? Math.round(_polyPerim(m.points)) : Math.round(2 * (m.w + m.h));
        for (let fl = 0; fl < s; fl++) bwItems.push({ id: gid(), len: pm, height: wlH, thick: 5 });
      });
      setBrickworks(bwItems);
    } else {
      setBrickworks(Array.from({ length: s }, () => ({ id: gid(), len: perim, height: wlH, thick: 5 })));
    }

    // PLASTER — per area-marker per floor (2 sides)
    if (detectedAreaMarkers.length > 0) {
      const plItems: any[] = [];
      detectedAreaMarkers.forEach(m => {
        const pm = m.points ? Math.round(_polyPerim(m.points)) : Math.round(2 * (m.w + m.h));
        for (let fl = 0; fl < s; fl++) plItems.push({ id: gid(), len: pm, height: wlH, thick: 0.5, sides: 2 });
      });
      setPlasters(plItems);
    } else {
      setPlasters(Array.from({ length: s }, () => ({ id: gid(), len: perim, height: wlH, thick: 0.5, sides: 2 })));
    }

    // FLOOR TILES — per area-marker per floor
    if (totalDetectedArea > 0) {
      const ftItems: any[] = [];
      detectedAreaMarkers.forEach(m => {
        const area = m.points ? _polyArea(m.points) : m.w * m.h;
        const side = Math.round(Math.sqrt(area) * 10) / 10;
        for (let fl = 0; fl < s; fl++) ftItems.push({ id: gid(), len: side, wid: side, tLen: 24, tWid: 24, wastage: 10 });
      });
      setFloorTiles(ftItems);
    }

    // WALL TILES — bathroom estimate (~10% of floor area) per floor
    const bathArea = Math.max(25, Math.round(totalDetectedArea * 0.1));
    const bathSide = Math.round(Math.sqrt(bathArea) * 10) / 10;
    setWallTiles(Array.from({ length: s }, () => ({ id: gid(), len: 2 * (bathSide + bathSide), height: Math.min(7, wlH), tLen: 12, tWid: 12, wastage: 15 })));

    // SEPTIC TANK — 1 per building
    const sepLen = Math.max(3, Math.round(s * 0.8 + 2)); const sepWid = Math.max(2, Math.round(s * 0.5 + 1.5));
    setSepticTanks([{ id: gid(), count: 1, len: sepLen, wid: sepWid, depth: 5, aggregateType: 'stone' }]);

    // SOAK WELL — 1 per building
    setSoakWells([{ id: gid(), count: 1, dia: 3, depth: Math.max(8, s * 2) }]);

    setTabStoreys({ foundation: 1, column: s, beam: s, slab: s, brickwork: s, plaster: s, stair: Math.max(1, s - 1), floorTiles: s, wallTiles: s });
  };

  const autoGenerateTab = (type: string, ts: number) => {
    const s = buildingStoreys; const flH = floorHeightFt; const wlH = wallHeightFt;
    const sqrtA = totalDetectedArea > 0 ? Math.sqrt(totalDetectedArea) : 20;
    const perim = totalDetectedPerimeter > 0 ? totalDetectedPerimeter : Math.round(4 * sqrtA);
    const p = _getAutoParams(s, sqrtA);
    const gid = () => Math.random().toString(36).substr(2, 9);
    const canvasPillars = designObjects.filter(o => o.subType === 'pillar');
    const pillarGroups = new Map<string, any[]>();
    canvasPillars.forEach(pl => { const wIn = Math.max(10, Math.round(pl.w * 12)); const hIn = Math.max(10, Math.round(pl.h * 12)); const key = `${wIn}x${hIn}`; if (!pillarGroups.has(key)) pillarGroups.set(key, []); pillarGroups.get(key)!.push(pl); });
    const pillarXs = [...new Set(canvasPillars.map(pl => Math.round(pl.x * 10) / 10))].sort((a, b) => a - b);
    const pillarYs = [...new Set(canvasPillars.map(pl => Math.round(pl.y * 10) / 10))].sort((a, b) => a - b);
    const xSpans = pillarXs.length > 1 ? pillarXs.slice(1).map((x, i) => Math.round((x - pillarXs[i]) * 10) / 10) : [];
    const ySpans = pillarYs.length > 1 ? pillarYs.slice(1).map((y, i) => Math.round((y - pillarYs[i]) * 10) / 10) : [];

    if (type === 'foundation') {
      if (canvasPillars.length > 0) { setFoundations(Array.from(pillarGroups.entries()).map(([key, pls]) => { const [wIn, hIn] = key.split('x').map(Number); const ftSz = Math.max(3, Math.ceil((Math.max(wIn, hIn) / 12 + (s <= 2 ? 2 : s <= 4 ? 2.5 : 3)) * 4) / 4); const ftTk = s <= 2 ? 15 : s <= 4 ? 18 : 21; const rN = Math.ceil(ftSz * 12 / 6) + 1; return { id: gid(), count: pls.length, len: ftSz, wid: ftSz, thick: ftTk, rodLong: rN, rodWidth: rN, rodFactor: 0.48, aggregateType: 'stone' }; })); }
      else setFoundations([{ id: gid(), count: p.numCols, len: p.ftSz, wid: p.ftSz, thick: p.ftTk, rodLong: Math.max(5, p.nbX + 2), rodWidth: Math.max(5, p.nbY + 2), rodFactor: 0.48, aggregateType: 'stone' }]);
    }
    if (type === 'column') {
      if (canvasPillars.length > 0) { setColumns(Array.from(pillarGroups.entries()).map(([key, pls]) => { const [wIn, hIn] = key.split('x').map(Number); return { id: gid(), count: pls.length, len: wIn, wid: hIn, height: ts * flH, rods: p.mRods, rodFactor: 0.48, ringRodFactor: 0.12, ringGap: 6, aggregateType: 'stone' }; })); }
      else setColumns([{ id: gid(), count: p.numCols, len: p.colSz, wid: p.colSz, height: ts * flH, rods: p.mRods, rodFactor: 0.48, ringRodFactor: 0.12, ringGap: 6, aggregateType: 'stone' }]);
    }
    if (type === 'beam') {
      if (xSpans.length > 0 || ySpans.length > 0) {
        const beamItems: any[] = [];
        [...new Set(xSpans)].forEach(span => { const cnt = xSpans.filter(x => x === span).length; beamItems.push({ id: gid(), len: Math.round(span * cnt * (pillarYs.length || 1) * ts), height: p.bmH, wid: p.bmW, rods: p.mRods, rodFactor: 0.48, ringRodFactor: 0.12, ringGap: 6, aggregateType: 'stone' }); });
        [...new Set(ySpans)].forEach(span => { const cnt = ySpans.filter(y => y === span).length; beamItems.push({ id: gid(), len: Math.round(span * cnt * (pillarXs.length || 1) * ts), height: p.bmH, wid: p.bmW, rods: p.mRods, rodFactor: 0.48, ringRodFactor: 0.12, ringGap: 6, aggregateType: 'stone' }); });
        setBeams(beamItems.filter(b => b.len > 0));
      } else setBeams([{ id: gid(), len: (p.nbX * p.baySize + p.nbY * p.baySize) * ts, height: p.bmH, wid: p.bmW, rods: p.mRods, rodFactor: 0.48, ringRodFactor: 0.12, ringGap: 6, aggregateType: 'stone' }]);
    }
    if (type === 'slab') {
      if (detectedAreaMarkers.length > 0) { const items: any[] = []; detectedAreaMarkers.forEach(m => { const side = Math.round(Math.sqrt(m.points ? _polyArea(m.points) : m.w * m.h) * 10) / 10; for (let fl = 0; fl < ts; fl++) items.push({ id: gid(), len: side, wid: side, thick: p.slabTk, rodGap: 6, rodFactor: 0.30, aggregateType: 'stone' }); }); setSlabs(items); }
      else setSlabs(Array.from({ length: ts }, () => ({ id: gid(), len: p.slabSide, wid: p.slabSide, thick: p.slabTk, rodGap: 6, rodFactor: 0.30, aggregateType: 'stone' })));
    }
    if (type === 'stair') { const stepsF = Math.round(flH * 12 / 7); const stWid = 3.5; setStairs([{ id: gid(), count: Math.max(1, ts - 1), wLen: Math.round(stepsF * 10 / 12 * 10) / 10, wid: stWid, thick: 5, steps: stepsF, riser: 7, tread: 10, lLen: stWid + 0.5, lWid: stWid, mainFactor: 0.30, distFactor: 0.19, mainGap: 5, distGap: 6, aggregateType: 'stone' }]); }
    if (type === 'brickwork') {
      if (detectedAreaMarkers.length > 0) { const items: any[] = []; detectedAreaMarkers.forEach(m => { const pm = m.points ? Math.round(_polyPerim(m.points)) : Math.round(2 * (m.w + m.h)); for (let fl = 0; fl < ts; fl++) items.push({ id: gid(), len: pm, height: wlH, thick: 5 }); }); setBrickworks(items); }
      else setBrickworks(Array.from({ length: ts }, () => ({ id: gid(), len: perim, height: wlH, thick: 5 })));
    }
    if (type === 'plaster') {
      if (detectedAreaMarkers.length > 0) { const items: any[] = []; detectedAreaMarkers.forEach(m => { const pm = m.points ? Math.round(_polyPerim(m.points)) : Math.round(2 * (m.w + m.h)); for (let fl = 0; fl < ts; fl++) items.push({ id: gid(), len: pm, height: wlH, thick: 0.5, sides: 2 }); }); setPlasters(items); }
      else setPlasters(Array.from({ length: ts }, () => ({ id: gid(), len: perim, height: wlH, thick: 0.5, sides: 2 })));
    }
    if (type === 'floorTiles' && totalDetectedArea > 0) { const items: any[] = []; detectedAreaMarkers.forEach(m => { const side = Math.round(Math.sqrt(m.points ? _polyArea(m.points) : m.w * m.h) * 10) / 10; for (let fl = 0; fl < ts; fl++) items.push({ id: gid(), len: side, wid: side, tLen: 24, tWid: 24, wastage: 10 }); }); setFloorTiles(items); }
    if (type === 'wallTiles') { const bathArea = Math.max(25, Math.round(totalDetectedArea * 0.1)); const bathSide = Math.round(Math.sqrt(bathArea) * 10) / 10; setWallTiles(Array.from({ length: ts }, () => ({ id: gid(), len: 2 * (bathSide + bathSide), height: Math.min(7, wlH), tLen: 12, tWid: 12, wastage: 15 }))); }
    if (type === 'septicTank') { const sepLen = Math.max(3, Math.round(s * 0.8 + 2)); const sepWid = Math.max(2, Math.round(s * 0.5 + 1.5)); setSepticTanks([{ id: gid(), count: ts, len: sepLen, wid: sepWid, depth: 5, aggregateType: 'stone' }]); }
    if (type === 'soakWell') setSoakWells([{ id: gid(), count: ts, dia: 3, depth: Math.max(8, s * 2) }]);
    setTabStoreys(prev => ({ ...prev, [type]: ts }));
  };


  const renderTabAutoHeader = (type: string) => (
    <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg border border-blue-100 mb-2 flex-wrap gap-2">
      <span className="text-[10px] font-black text-blue-700 flex items-center gap-1.5">
        <Calculator className="w-3 h-3" />
        {tabStoreys[type] || buildingStoreys} তলার হিসাব
        {totalDetectedArea > 0 && <span className="text-emerald-600 ml-1 font-black">| ক্যানভাস: {totalDetectedArea} Sq.ft ({detectedAreaMarkers.length}টি এরিয়া)</span>}
      </span>
      <div className="flex items-center gap-1.5">
        <Select value={String(tabStoreys[type] || buildingStoreys)} onValueChange={v => setTabStoreys(prev => ({...prev, [type]: parseInt(v)}))}>
          <SelectTrigger className="h-6 w-20 text-[10px] font-black border-blue-300 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1,2,3,4,5,6,7,8,9,10].map(n => <SelectItem key={n} value={String(n)} className="text-xs font-black">{n} তলা</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="h-6 text-[10px] font-black gap-1 border-blue-400 text-blue-700 hover:bg-blue-50 px-2" onClick={() => autoGenerateTab(type, tabStoreys[type] || buildingStoreys)}>
          <Plus className="w-2.5 h-2.5" /> অটো সেট
        </Button>
      </div>
    </div>
  );

  const addItem = (type: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    if (type === 'foundation') setFoundations([...foundations, { id, count: 0, len: 0, wid: 0, thick: 0, rodLong: 0, rodWidth: 0, rodFactor: 0.48, aggregateType: 'stone' }]);
    if (type === 'column') setColumns([...columns, { id, count: 0, len: 0, wid: 0, height: 0, rods: 0, rodFactor: 0.48, ringRodFactor: 0.12, ringGap: 6, aggregateType: 'stone' }]);
    if (type === 'beam') setBeams([...beams, { id, len: 0, height: 0, wid: 0, rods: 0, rodFactor: 0.48, ringRodFactor: 0.12, ringGap: 6, aggregateType: 'stone' }]);
    if (type === 'slab') setSlabs([...slabs, { id, len: 0, wid: 0, thick: 0, rodGap: 5, rodFactor: 0.30, aggregateType: 'stone' }]);
    if (type === 'stair') setStairs([...stairs, { id, count: 0, wLen: 0, wid: 0, thick: 5, steps: 10, riser: 6, tread: 10, lLen: 0, lWid: 0, mainFactor: 0.30, distFactor: 0.19, mainGap: 5, distGap: 6, aggregateType: 'stone' }]);
    if (type === 'brickwork') setBrickworks([...brickworks, { id, len: 0, height: 0, thick: 5 }]);
    if (type === 'plaster') setPlasters([...plasters, { id, len: 0, height: 0, thick: 0.5, sides: 1 }]);
    if (type === 'floorTiles') setFloorTiles([...floorTiles, { id, len: 0, wid: 0, tLen: 0, tWid: 0, wastage: 10 }]);
    if (type === 'wallTiles') setWallTiles([...wallTiles, { id, len: 0, height: 0, tLen: 0, tWid: 0, wastage: 10 }]);
    if (type === 'septicTank') setSepticTanks([...septicTanks, { id, count: 0, len: 0, wid: 0, depth: 0, aggregateType: 'stone' }]);
    if (type === 'soakWell') setSoakWells([...soakWells, { id, count: 0, dia: 0, depth: 0 }]);
  };
  const removeItem = (type: string, id: string) => {
    if (type === 'foundation') setFoundations(foundations.filter(f => f.id !== id));
    if (type === 'column') setColumns(columns.filter(f => f.id !== id));
    if (type === 'beam') setBeams(beams.filter(f => f.id !== id));
    if (type === 'slab') setSlabs(slabs.filter(s => s.id !== id));
    if (type === 'stair') setStairs(stairs.filter(f => f.id !== id));
    if (type === 'brickwork') setBrickworks(brickworks.filter(f => f.id !== id));
    if (type === 'plaster') setPlasters(plasters.filter(p => p.id !== id));
    if (type === 'floorTiles') setFloorTiles(floorTiles.filter(f => f.id !== id));
    if (type === 'wallTiles') setWallTiles(wallTiles.filter(f => f.id !== id));
    if (type === 'septicTank') setSepticTanks(septicTanks.filter(f => f.id !== id));
    if (type === 'soakWell') setSoakWells(soakWells.filter(s => s.id !== id));
  };
  const updateItem = (type: string, id: string, field: string, val: any) => {
    const textFields = ['aggregateType']; const value = textFields.includes(field) ? val : (parseFloat(val) || 0);
    if (type === 'foundation') setFoundations(foundations.map(f => f.id === id ? { ...f, [field]: value } : f));
    if (type === 'column') setColumns(columns.map(c => c.id === id ? { ...c, [field]: value } : c));
    if (type === 'beam') setBeams(beams.map(b => b.id === id ? { ...b, [field]: value } : b));
    if (type === 'slab') setSlabs(slabs.map(s => s.id === id ? { ...s, [field]: value } : s));
    if (type === 'stair') setStairs(stairs.map(s => s.id === id ? { ...s, [field]: value } : s));
    if (type === 'brickwork') setBrickworks(brickworks.map(b => b.id === id ? { ...b, [field]: value } : b));
    if (type === 'plaster') setPlasters(plasters.map(p => p.id === id ? { ...p, [field]: value } : p));
    if (type === 'floorTiles') setFloorTiles(floorTiles.map(f => f.id === id ? { ...f, [field]: value } : f));
    if (type === 'wallTiles') setWallTiles(wallTiles.map(f => f.id === id ? { ...f, [field]: value } : f));
    if (type === 'septicTank') setSepticTanks(septicTanks.map(f => f.id === id ? { ...f, [field]: value } : f));
    if (type === 'soakWell') setSoakWells(soakWells.map(s => s.id === id ? { ...s, [field]: value } : s));
  };
  const calcAll = () => {
    const total = { cement: 0, sand: 0, stone: 0, chips: 0, rod: 0, bricks: 0, floorTiles: 0, wallTiles: 0, labor: 0, doors: 0, windows: 0 };
    const sectionTotals: any = {};
    const processSection = (items: any[], type: string) => {
      let res = { cement: 0, sand: 0, stone: 0, chips: 0, rod: 0, bricks: 0, floorTiles: 0, wallTiles: 0 };
      items.forEach(item => {
        let vol = 0; let rodWeight = 0;
        if (type === 'foundation') { vol = item.count * item.len * item.wid * (item.thick / 12); rodWeight = (item.rodLong * item.wid + item.rodWidth * item.len) * item.count * item.rodFactor; }
        else if (type === 'column') { vol = item.count * (item.len/12) * (item.wid/12) * item.height; const mainRodLen = item.rods * item.height * item.count; const ringsCount = (item.height * 12) / item.ringGap; const ringLen = 2 * (item.len + item.wid) / 12; rodWeight = (mainRodLen * item.rodFactor) + (ringsCount * ringLen * item.count * item.ringRodFactor); }
        else if (type === 'beam') { vol = item.len * (item.wid/12) * (item.height/12); const mainRodLen = item.rods * item.len; const ringsCount = (item.len * 12) / item.ringGap; const ringLen = 2 * (item.height + item.wid) / 12; rodWeight = (mainRodLen * item.rodFactor) + (ringsCount * ringLen * item.ringRodFactor); }
        else if (type === 'slab') { vol = item.len * item.wid * (item.thick/12); const gapFt = item.rodGap / 12; const rodsLen = (item.len / gapFt * item.wid) + (item.wid / gapFt * item.len); rodWeight = rodsLen * item.rodFactor; }
        else if (type === 'stair') { const flightVol = (item.wLen * item.wid * (item.thick / 12)); const stepsVol = (0.5 * (item.riser / 12) * (item.tread / 12) * item.wid) * item.steps; const landingVol = (item.lLen * item.lWid * (item.thick / 12)); vol = (flightVol + stepsVol + landingVol) * item.count; const mainRods = (item.wid / (item.mainGap/12)) * item.wLen; const distRods = (item.wLen / (item.distGap/12)) * item.wid; rodWeight = (mainRods * item.mainFactor + distRods * item.distFactor) * item.count; }
        else if (type === 'septicTank') { const wallPerimeter = 2 * (item.len + item.wid); const brickVol = wallPerimeter * item.depth * (10/12); res.bricks += Math.ceil(brickVol * 10 * item.count); vol = (item.len * item.wid * (3/12) + item.len * item.wid * (4/12)) * item.count; rodWeight = (item.len * item.wid * 0.5) * item.count; }
        if (vol > 0) { const dry = vol * 1.54; const aggr = (dry / 5.5) * 3; res.cement += (dry / 5.5) / 1.25; res.sand += (dry / 5.5) * 1.5; if (item.aggregateType === 'chips') res.chips += aggr; else res.stone += aggr; }
        res.rod += rodWeight;
      });
      return res;
    };
    sectionTotals.foundation = processSection(foundations, 'foundation');
    sectionTotals.column = processSection(columns, 'column');
    sectionTotals.beam = processSection(beams, 'beam');
    sectionTotals.slab = processSection(slabs, 'slab');
    sectionTotals.stair = processSection(stairs, 'stair');
    sectionTotals.septicTank = processSection(septicTanks, 'septicTank');
    let brRes = { cement: 0, sand: 0, bricks: 0 }; brickworks.forEach(b => { const count = Math.ceil(b.len * b.height * (b.thick === 5 ? 5 : 10)); brRes.bricks += count; const vol = (b.len * b.height * (b.thick / 12)); const dry = vol * 0.35; brRes.cement += (dry / 5) / 1.25; brRes.sand += (dry / 5) * 4; });
    sectionTotals.brickwork = brRes;
    let pRes = { cement: 0, sand: 0 }; plasters.forEach(p => { const area = p.len * p.height; const vol = (area * (p.thick / 12)) * p.sides; const dry = vol * 1.54; pRes.cement += (dry / 5) / 1.25; pRes.sand += (dry / 5) * 4; });
    sectionTotals.plaster = pRes;
    let ftRes = { floorTiles: 0, cement: 0, sand: 0 }; floorTiles.forEach(f => { const area = f.len * f.wid; if (area > 0 && f.tLen > 0 && f.tWid > 0) { ftRes.floorTiles += Math.ceil((area / ((f.tLen/12)*(f.tWid/12))) * (1 + f.wastage/100)); const dry = area * (1/12) * 1.54; ftRes.cement += (dry / 5) / 1.25; ftRes.sand += (dry / 5) * 4; } });
    sectionTotals.floorTiles = ftRes;
    let wtRes = { wallTiles: 0, cement: 0, sand: 0 }; wallTiles.forEach(f => { const area = f.len * f.height; if (area > 0 && f.tLen > 0 && f.tWid > 0) { wtRes.wallTiles += Math.ceil((area / ((f.tLen/12)*(f.tWid/12))) * (1 + f.wastage/100)); const dry = area * (0.5/12) * 1.54; wtRes.cement += (dry / 5) / 1.25; wtRes.sand += (dry / 5) * 4; } });
    sectionTotals.wallTiles = wtRes;
    let swRes = { bricks: 0, cement: 0, sand: 0 }; soakWells.forEach(s => { const brickVol = (Math.PI * s.dia) * s.depth * (5/12); swRes.bricks += Math.ceil(brickVol * 5 * s.count); const dry = brickVol * 0.35 * s.count; swRes.cement += (dry / 5) / 1.25; swRes.sand += (dry / 5) * 4; });
    sectionTotals.soakWell = swRes;
    Object.values(sectionTotals).forEach((res: any) => { total.cement += res.cement || 0; total.sand += res.sand || 0; total.stone += res.stone || 0; total.chips += res.chips || 0; total.rod += res.rod || 0; total.bricks += res.bricks || 0; total.floorTiles += (res.floorTiles || 0); total.wallTiles += (res.wallTiles || 0); });
    total.labor = slabs.reduce((acc, s) => acc + (s.len * s.wid), 0);
    total.doors = designObjects.filter(o => o.type === 'opening' && o.subType.includes('door')).length;
    total.windows = designObjects.filter(o => o.type === 'opening' && o.subType === 'window').length;
    return { total, sectionTotals };
  };
  const { total, sectionTotals } = calcAll();
  const currentRes = sectionTotals[activeTab as keyof typeof sectionTotals] || { cement: 0, sand: 0, stone: 0, chips: 0, rod: 0, bricks: 0, floorTiles: 0, wallTiles: 0 };
  const grandTotalCost = useMemo(() => {
    return ( Math.ceil(total.cement) * prices.cement + Math.ceil(total.sand) * prices.sand + Math.ceil(total.stone) * prices.stone + Math.ceil(total.chips) * prices.chips + Math.ceil(total.rod) * prices.rod + Math.ceil(total.bricks) * prices.bricks + Math.ceil(total.floorTiles) * prices.floorTiles + Math.ceil(total.wallTiles) * prices.wallTiles + Math.ceil(total.labor) * prices.labor + total.doors * prices.doors + total.windows * prices.windows + prices.electric + prices.fittings + prices.paint + prices.others );
  }, [total, prices]);
  const getAdvice = async () => {
    setLoadingAdvice(true);
    const result = await getConstructionAdvice({ baseCount: foundations[0].count, baseLengthFt: foundations[0].len, baseWidthFt: foundations[0].wid, baseThicknessIn: foundations[0].thick, columnCount: columns[0].count, columnLengthIn: columns[0].len, columnWidthIn: columns[0].wid, columnHeightFt: columns[0].height, columnRodCount: columns[0].rods, beamHeightIn: beams[0].height, beamWidthIn: beams[0].wid, beamLengthFt: beams[0].len, beamRodCount: beams[0].rods, slabLengthFt: slabs[0].len, slabWidthFt: slabs[0].wid, slabThicknessIn: slabs[0].thick, slabRodGapIn: slabs[0].rodGap, baseRodLongitudinalCount: foundations[0].rodLong, baseRodWidthCount: foundations[0].rodWidth, ringGapIn: columns[0].ringGap || 6, mainRodFactor: 0.48, ringRodFactor: 0.12 } as any);
    if (result && 'advice' in result) setAdvice(result.advice);
    setLoadingAdvice(false);
  };
  return (
    <div className="flex-col h-full w-full bg-slate-50 overflow-hidden flex">
      <div className="h-14 bg-white/80 backdrop-blur-md border-b flex items-center px-4 justify-between shadow-sm shrink-0 z-30">
        <div className="flex items-center gap-3"><Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9"><ArrowLeft className="w-5 h-5" /></Button><DialogTitle className="text-sm md:text-lg font-black text-slate-700 flex items-center gap-2"><Calculator className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" /> <span className="font-bold">Estimation Calculator</span></DialogTitle></div>
        <div className="flex items-center gap-1.5 md:gap-2">{onOpenMarketSync && <Button variant="outline" size="sm" onClick={onOpenMarketSync} className="h-9 md:h-11 text-[10px] md:text-xs font-black gap-1.5 border-emerald-500 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 shadow-sm" title="স্থানীয় বাজার দর সিঙ্ক করুন"><TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> <span className="hidden sm:inline">বাজার দর সিঙ্ক</span><span className="sm:hidden">মার্কেট</span></Button>}{onOpenAdvancedPdfReport && <Button onClick={() => onOpenAdvancedPdfReport(total, grandTotalCost)} className="bg-slate-900 hover:bg-slate-800 text-white gap-1.5 h-9 md:h-11 text-[10px] md:text-xs font-black shadow-sm" title="কাজের সময়সীমা ও লেবার শিডিউলসহ পূর্ণাঙ্গ PDF রিপোর্ট"><FileText className="w-3.5 h-3.5 text-emerald-400" /> <span className="hidden sm:inline">পূর্ণাঙ্গ রিপোর্ট (PDF)</span><span className="sm:hidden">রিপোর্ট</span></Button>}<Button variant="outline" size="sm" className="h-9 md:h-11 text-[10px] md:text-xs hover:bg-slate-100 font-black gap-1.5 border-slate-300" onClick={onSave}><Save className="w-3.5 h-3.5 text-green-600"/> SAVE</Button><Button onClick={getAdvice} disabled={loadingAdvice} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-9 md:h-11 text-[10px] md:text-xs font-black">{loadingAdvice ? <Loader2 className="animate-spin w-3 h-3" /> : <Send className="w-3 h-3" />} AI Advice </Button></div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-4 md:p-6 pb-24">
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-emerald-50 border border-blue-200 rounded-xl p-3 md:p-4 mb-4 shadow-sm">
            <div className="flex flex-wrap items-end gap-3 justify-between">
              <div className="flex items-center gap-2 shrink-0">
                <Layers className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-black text-slate-700 uppercase tracking-tight">বিল্ডিং কনফিগ</span>
                {totalDetectedArea > 0 && (
                  <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-200">
                    ক্যানভাস: {totalDetectedArea} Sq.ft ({detectedAreaMarkers.length}টি এরিয়া)
                  </span>
                )}
                {totalDetectedArea === 0 && (
                  <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-200">
                    ক্যানভাসে রুম এরিয়া মার্ক করুন
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-0.5">
                  <Label className="text-[9px] font-black uppercase text-slate-500">মোট তলা</Label>
                  <Select value={String(buildingStoreys)} onValueChange={v => setBuildingStoreys(parseInt(v))}>
                    <SelectTrigger className="h-8 w-28 text-xs font-black border-blue-300 bg-white shadow-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['একতলা','দোতলা','তিনতলা','চারতলা','পাঁচতলা','ছয়তলা','সাততলা','আটতলা','নয়তলা','দশতলা'].map((t,i) => (
                        <SelectItem key={i+1} value={String(i+1)} className="text-xs font-black">{t} (G+{i})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[9px] font-black uppercase text-slate-500">তলার উচ্চতা (ft)</Label>
                  <Input type="number" value={floorHeightFt} onChange={e => setFloorHeightFt(parseFloat(e.target.value)||10)} className="h-8 w-20 text-xs font-black border-blue-300 shadow-sm" />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[9px] font-black uppercase text-slate-500">দেয়ালের উচ্চতা (ft)</Label>
                  <Input type="number" value={wallHeightFt} onChange={e => setWallHeightFt(parseFloat(e.target.value)||9)} className="h-8 w-20 text-xs font-black border-blue-300 shadow-sm" />
                </div>
                <Button onClick={autoGenerateAll} className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black gap-1.5 px-3 shadow-sm">
                  <Calculator className="w-3.5 h-3.5" /> সব অটো হিসাব জেনারেট করুন
                </Button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="bg-white p-4 md:p-6 rounded-xl border shadow-sm">
                <TabsList className="flex h-auto p-1 mb-6 bg-slate-100 overflow-x-auto no-scrollbar gap-1 justify-start">
                  <TabsTrigger value="foundation" className="text-[10px] md:text-xs px-3 py-2 shrink-0 font-black">Foundation</TabsTrigger><TabsTrigger value="column" className="text-[10px] md:text-xs px-3 py-2 shrink-0 font-black">Column</TabsTrigger><TabsTrigger value="beam" className="text-[10px] md:text-xs px-3 py-2 shrink-0 font-black">Beam</TabsTrigger><TabsTrigger value="slab" className="text-[10px] md:text-xs px-3 py-2 shrink-0 font-black">Roof</TabsTrigger><TabsTrigger value="stair" className="text-[10px] md:text-xs px-3 py-2 shrink-0 font-black">Stair</TabsTrigger><TabsTrigger value="brickwork" className="text-[10px] md:text-xs px-3 py-2 shrink-0 font-black">Brickwork</TabsTrigger><TabsTrigger value="plaster" className="text-[10px] md:text-xs px-3 py-2 shrink-0 font-black">Plaster</TabsTrigger><TabsTrigger value="floorTiles" className="text-[10px] md:text-xs px-3 py-2 shrink-0 font-black">Floor Tiles</TabsTrigger><TabsTrigger value="wallTiles" className="text-[10px] md:text-xs px-3 py-2 shrink-0 font-black">Wall Tiles</TabsTrigger><TabsTrigger value="septicTank" className="text-[10px] md:text-xs px-3 py-2 shrink-0 font-black">Septic Tank</TabsTrigger><TabsTrigger value="soakWell" className="text-[10px] md:text-xs px-3 py-2 shrink-0 font-black">Soak Well</TabsTrigger><TabsTrigger value="total" className="text-[10px] md:text-xs px-3 py-2 shrink-0 bg-emerald-100 text-emerald-700 font-black">Total Materials</TabsTrigger>
                </TabsList>
                <TabsContent value="foundation" className="space-y-6 m-0">
                  {renderTabAutoHeader('foundation')}
                  {foundations.map((f, idx) => (
                    <div key={f.id} className="p-4 border rounded-lg bg-slate-50 relative space-y-4">
                      <div className="flex justify-between items-center"><h4 className="font-black text-xs text-slate-500">Base #{idx+1}</h4>{foundations.length > 1 && <Button variant="ghost" size="icon" onClick={() => removeItem('foundation', f.id)} className="h-6 w-6 text-red-500"><X className="w-4 h-4" /></Button>}</div>
                      <div className="grid grid-cols-2 gap-4"><InputField label="Base Count" value={f.count} onChange={v => updateItem('foundation', f.id, 'count', v)} /><InputField label="Length (ft)" value={f.len} onChange={v => updateItem('foundation', f.id, 'len', v)} /><InputField label="Width (ft)" value={f.wid} onChange={v => updateItem('foundation', f.id, 'wid', v)} /><InputField label="Thickness (in)" value={f.thick} onChange={v => updateItem('foundation', f.id, 'thick', v)} /><InputField label="Longitudinal Rods (count)" value={f.rodLong} onChange={v => updateItem('foundation', f.id, 'rodLong', v)} /><InputField label="Width-wise Rods (count)" value={f.rodWidth} onChange={v => updateItem('foundation', f.id, 'rodWidth', v)} /><div className="col-span-1 space-y-2"><Label className="text-xs font-black text-slate-600 uppercase">Main Rod size</Label><Select value={f.rodFactor.toString()} onValueChange={v => updateItem('foundation', f.id, 'rodFactor', v)}><SelectTrigger className="h-10 bg-white border-slate-400 text-sm font-black shadow-sm"><SelectValue /></SelectTrigger><SelectContent>{ROD_OPTIONS.map(opt => <SelectItem key={opt.factor} value={opt.factor.toString()}>{opt.label}</SelectItem>)}</SelectContent></Select></div><div className="col-span-1 space-y-2"><Label className="text-xs font-black text-slate-600 uppercase">Stone/Khoya</Label><Select value={f.aggregateType} onValueChange={v => updateItem('foundation', f.id, 'aggregateType', v)}><SelectTrigger className="h-10 bg-white border-slate-400 text-sm font-black shadow-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="stone">Stone</SelectItem><SelectItem value="chips">Khoya</SelectItem></SelectContent></Select></div></div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addItem('foundation')} className="w-full h-12 gap-2 text-xs font-black border-dashed border-slate-400 uppercase"><Plus className="w-3 h-3" /> Add new base </Button><SectionResult res={currentRes} />
                </TabsContent>
                <TabsContent value="column" className="space-y-6 m-0">
                  {renderTabAutoHeader('column')}
                  {columns.map((c, idx) => (
                    <div key={c.id} className="p-4 border rounded-lg bg-slate-50 relative space-y-4">
                      <div className="flex justify-between items-center"><h4 className="font-black text-xs text-slate-500">Column #{idx+1}</h4>{columns.length > 1 && <Button variant="ghost" size="icon" onClick={() => removeItem('column', c.id)} className="h-6 w-6 text-red-500"><X className="w-4 h-4" /></Button>}</div>
                      <div className="grid grid-cols-2 gap-4"><InputField label="Column Count" value={c.count} onChange={v => updateItem('column', c.id, 'count', v)} /><InputField label="Length (in)" value={c.len} onChange={v => updateItem('column', c.id, 'len', v)} /><InputField label="Width (in)" value={c.wid} onChange={v => updateItem('column', c.id, 'wid', v)} /><InputField label="Height (ft)" value={c.height} onChange={v => updateItem('column', c.id, 'height', v)} /><InputField label="Main Rods (count)" value={c.rods} onChange={v => updateItem('column', c.id, 'rods', v)} /><InputField label="Ring Gap (in)" value={c.ringGap} onChange={v => updateItem('column', c.id, 'ringGap', v)} /><div className="col-span-1 space-y-2"><Label className="text-xs font-black text-slate-600 uppercase">Main Rod size</Label><Select value={c.rodFactor.toString()} onValueChange={v => updateItem('column', c.id, 'rodFactor', v)}><SelectTrigger className="h-10 bg-white border-slate-400 text-sm font-black shadow-sm"><SelectValue /></SelectTrigger><SelectContent>{ROD_OPTIONS.map(opt => <SelectItem key={opt.factor} value={opt.factor.toString()}>{opt.label}</SelectItem>)}</SelectContent></Select></div><div className="col-span-1 space-y-2"><Label className="text-xs font-black text-slate-600 uppercase">Ring Rod size</Label><Select value={c.ringRodFactor.toString()} onValueChange={v => updateItem('column', c.id, 'ringRodFactor', v)}><SelectTrigger className="h-10 bg-white border-slate-400 text-sm font-black shadow-sm"><SelectValue /></SelectTrigger><SelectContent>{ROD_OPTIONS.slice(0, 3).map(opt => <SelectItem key={opt.factor} value={opt.factor.toString()}>{opt.label}</SelectItem>)}</SelectContent></Select></div><div className="col-span-2 space-y-2"><Label className="text-xs font-black text-slate-600 uppercase">Stone/Khoya</Label><Select value={c.aggregateType} onValueChange={v => updateItem('column', c.id, 'aggregateType', v)}><SelectTrigger className="h-10 bg-white border-slate-400 text-sm font-black shadow-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="stone">Stone</SelectItem><SelectItem value="chips">Khoya</SelectItem></SelectContent></Select></div></div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addItem('column')} className="w-full h-12 gap-2 text-xs font-black border-dashed border-slate-400 uppercase"><Plus className="w-3 h-3" /> Add new column </Button><SectionResult res={currentRes} />
                </TabsContent>
                <TabsContent value="beam" className="space-y-6 m-0">
                  {renderTabAutoHeader('beam')}
                  {beams.map((b, idx) => (
                    <div key={b.id} className="p-4 border rounded-lg bg-slate-50 relative space-y-4">
                      <div className="flex justify-between items-center"><h4 className="font-black text-xs text-slate-500">Beam #{idx+1}</h4>{beams.length > 1 && <Button variant="ghost" size="icon" onClick={() => removeItem('beam', b.id)} className="h-6 w-6 text-red-500"><X className="w-4 h-4" /></Button>}</div>
                      <div className="grid grid-cols-2 gap-4"><InputField label="Length (ft)" value={b.len} onChange={v => updateItem('beam', b.id, 'len', v)} /><InputField label="Width (in)" value={b.wid} onChange={v => updateItem('beam', b.id, 'wid', v)} /><InputField label="Height (in)" value={b.height} onChange={v => updateItem('beam', b.id, 'height', v)} /><InputField label="Main Rods (count)" value={b.rods} onChange={v => updateItem('beam', b.id, 'rods', v)} /><InputField label="Ring Gap (in)" value={b.ringGap} onChange={v => updateItem('beam', b.id, 'ringGap', v)} /><div className="col-span-1 space-y-2"><Label className="text-xs font-black text-slate-600 uppercase">Main Rod size</Label><Select value={b.rodFactor.toString()} onValueChange={v => updateItem('beam', b.id, 'rodFactor', v)}><SelectTrigger className="h-10 bg-white border-slate-400 text-sm font-black shadow-sm"><SelectValue /></SelectTrigger><SelectContent>{ROD_OPTIONS.map(opt => <SelectItem key={opt.factor} value={opt.factor.toString()}>{opt.label}</SelectItem>)}</SelectContent></Select></div><div className="col-span-1 space-y-2"><Label className="text-xs font-black text-slate-600 uppercase">Ring Rod size</Label><Select value={b.ringRodFactor.toString()} onValueChange={v => updateItem('beam', b.id, 'ringRodFactor', v)}><SelectTrigger className="h-10 bg-white border-slate-400 text-sm font-black shadow-sm"><SelectValue /></SelectTrigger><SelectContent>{ROD_OPTIONS.slice(0, 3).map(opt => <SelectItem key={opt.factor} value={opt.factor.toString()}>{opt.label}</SelectItem>)}</SelectContent></Select></div><div className="col-span-1 space-y-2"><Label className="text-xs font-black text-slate-600 uppercase">Stone/Khoya</Label><Select value={b.aggregateType} onValueChange={v => updateItem('beam', b.id, 'aggregateType', v)}><SelectTrigger className="h-10 bg-white border-slate-400 text-sm font-black shadow-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="stone">Stone</SelectItem><SelectItem value="chips">Khoya</SelectItem></SelectContent></Select></div></div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addItem('beam')} className="w-full h-12 gap-2 text-xs font-black border-dashed border-slate-400 uppercase"><Plus className="w-3 h-3" /> Add new beam </Button><SectionResult res={currentRes} />
                </TabsContent>
                <TabsContent value="slab" className="space-y-6 m-0">
                  {renderTabAutoHeader('slab')}
                  {slabs.map((s, idx) => (
                    <div key={s.id} className="p-4 border rounded-lg bg-slate-50 relative space-y-4">
                      <div className="flex justify-between items-center"><h4 className="font-black text-xs text-slate-500">Roof #{idx+1}</h4>{slabs.length > 1 && <Button variant="ghost" size="icon" onClick={() => removeItem('slab', s.id)} className="h-6 w-6 text-red-500"><X className="w-4 h-4" /></Button>}</div>
                      <div className="grid grid-cols-2 gap-4"><InputField label="Length (ft)" value={s.len} onChange={v => updateItem('slab', s.id, 'len', v)} /><InputField label="Width (ft)" value={s.wid} onChange={v => updateItem('slab', s.id, 'wid', v)} /><InputField label="Thickness (in)" value={s.thick} onChange={v => updateItem('slab', s.id, 'thick', v)} /><InputField label="Rod Gap (in)" value={s.rodGap} onChange={v => updateItem('slab', s.id, 'rodGap', v)} /><div className="col-span-1 space-y-2"><Label className="text-xs font-black text-slate-600 uppercase">Main Rod size</Label><Select value={s.rodFactor.toString()} onValueChange={v => updateItem('slab', s.id, 'rodFactor', v)}><SelectTrigger className="h-10 bg-white border-slate-400 text-sm font-black shadow-sm"><SelectValue /></SelectTrigger><SelectContent>{ROD_OPTIONS.slice(0, 4).map(opt => <SelectItem key={opt.factor} value={opt.factor.toString()}>{opt.label}</SelectItem>)}</SelectContent></Select></div><div className="col-span-1 space-y-2"><Label className="text-xs font-black text-slate-600 uppercase">Stone/Khoya</Label><Select value={s.aggregateType} onValueChange={v => updateItem('slab', s.id, 'aggregateType', v)}><SelectTrigger className="h-10 bg-white border-slate-400 text-sm font-black shadow-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="stone">Stone</SelectItem><SelectItem value="chips">Khoya</SelectItem></SelectContent></Select></div></div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addItem('slab')} className="w-full h-12 gap-2 text-xs font-black border-dashed border-slate-400 uppercase"><Plus className="w-3 h-3" /> Add new roof </Button><SectionResult res={currentRes} />
                </TabsContent>
                <TabsContent value="stair" className="space-y-6 m-0">
                  {renderTabAutoHeader('stair')}
                  {stairs.map((s, idx) => (
                    <div key={s.id} className="p-4 border rounded-lg bg-slate-50 relative space-y-4">
                      <div className="flex justify-between items-center"><h4 className="font-black text-xs text-slate-500">Stair #{idx+1}</h4>{stairs.length > 1 && <Button variant="ghost" size="icon" onClick={() => removeItem('stair', s.id)} className="h-6 w-6 text-red-500"><X className="w-4 h-4" /></Button>}</div>
                      <div className="grid grid-cols-2 gap-4"><InputField label="Stair Count" value={s.count} onChange={v => updateItem('stair', s.id, 'count', v)} /><InputField label="Flight Length (ft)" value={s.wLen} onChange={v => updateItem('stair', s.id, 'wLen', v)} /><InputField label="Width (ft)" value={s.wid} onChange={v => updateItem('stair', s.id, 'wid', v)} /><InputField label="Waist Slab Thickness (in)" value={s.thick} onChange={v => updateItem('stair', s.id, 'thick', v)} /><InputField label="Steps Count" value={s.steps} onChange={v => updateItem('stair', s.id, 'steps', v)} /><InputField label="Riser (in)" value={s.riser} onChange={v => updateItem('stair', s.id, 'riser', v)} /><InputField label="Tread (in)" value={s.tread} onChange={v => updateItem('stair', s.id, 'tread', v)} /><InputField label="Landing Length (ft)" value={s.lLen} onChange={v => updateItem('stair', s.id, 'lLen', v)} /><InputField label="Landing Width (ft)" value={s.lWid} onChange={v => updateItem('stair', s.id, 'lWid', v)} /><InputField label="Main Rod Gap (in)" value={s.mainGap} onChange={v => updateItem('stair', s.id, 'mainGap', v)} /><InputField label="Dist. Rod Gap (in)" value={s.distGap} onChange={v => updateItem('stair', s.id, 'distGap', v)} /><div className="col-span-1 space-y-2"><Label className="text-xs font-black text-slate-600 uppercase">Main Rod size</Label><Select value={s.mainFactor.toString()} onValueChange={v => updateItem('stair', s.id, 'mainFactor', v)}><SelectTrigger className="h-10 bg-white border-slate-400 text-sm font-black shadow-sm"><SelectValue /></SelectTrigger><SelectContent>{ROD_OPTIONS.slice(0, 4).map(opt => <SelectItem key={opt.factor} value={opt.factor.toString()}>{opt.label}</SelectItem>)}</SelectContent></Select></div><div className="col-span-1 space-y-2"><Label className="text-xs font-black text-slate-600 uppercase">Dist. Rod size</Label><Select value={s.distFactor.toString()} onValueChange={v => updateItem('stair', s.id, 'distFactor', v)}><SelectTrigger className="h-10 bg-white border-slate-400 text-sm font-black shadow-sm"><SelectValue /></SelectTrigger><SelectContent>{ROD_OPTIONS.slice(0, 4).map(opt => <SelectItem key={opt.factor} value={opt.factor.toString()}>{opt.label}</SelectItem>)}</SelectContent></Select></div><div className="col-span-2 space-y-2"><Label className="text-xs font-black text-slate-600 uppercase">Stone/Khoya</Label><Select value={s.aggregateType} onValueChange={v => updateItem('stair', s.id, 'aggregateType', v)}><SelectTrigger className="h-10 bg-white border-slate-400 text-sm font-black shadow-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="stone">Stone</SelectItem><SelectItem value="chips">Khoya</SelectItem></SelectContent></Select></div></div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addItem('stair')} className="w-full h-12 gap-2 text-xs font-black border-dashed border-slate-400 uppercase"><Plus className="w-3 h-3" /> Add new stair </Button><SectionResult res={currentRes} />
                </TabsContent>
                <TabsContent value="brickwork" className="space-y-6 m-0">
                  {renderTabAutoHeader('brickwork')}
                  {brickworks.map((b, idx) => (
                    <div key={b.id} className="p-4 border rounded-lg bg-slate-50 relative space-y-4">
                      <div className="flex justify-between items-center"><h4 className="font-black text-xs text-slate-500">Brickwork #{idx+1}</h4>{brickworks.length > 1 && <Button variant="ghost" size="icon" onClick={() => removeItem('brickwork', b.id)} className="h-6 w-6 text-red-500"><X className="w-4 h-4" /></Button>}</div>
                      <div className="grid grid-cols-2 gap-4"><InputField label="Length (ft)" value={b.len} onChange={v => updateItem('brickwork', b.id, 'len', v)} /><InputField label="Height (ft)" value={b.height} onChange={v => updateItem('brickwork', b.id, 'height', v)} /><div className="col-span-1 space-y-2"><Label className="text-xs font-black text-slate-600 uppercase">Thickness (in)</Label><Select value={b.thick.toString()} onValueChange={v => updateItem('brickwork', b.id, 'thick', v)}><SelectTrigger className="h-10 bg-white border-slate-400 text-sm font-black shadow-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="5">5 in</SelectItem><SelectItem value="10">10 in</SelectItem></SelectContent></Select></div></div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addItem('brickwork')} className="w-full h-12 gap-2 text-xs font-black border-dashed border-slate-400 uppercase"><Plus className="w-3 h-3" /> Add new brickwork </Button><SectionResult res={currentRes} />
                </TabsContent>
                <TabsContent value="plaster" className="space-y-6 m-0">
                  {renderTabAutoHeader('plaster')}
                  {plasters.map((p, idx) => (
                    <div key={p.id} className="p-4 border rounded-lg bg-slate-50 relative space-y-4">
                      <div className="flex justify-between items-center"><h4 className="font-black text-xs text-slate-500">Plaster #{idx+1}</h4>{plasters.length > 1 && <Button variant="ghost" size="icon" onClick={() => removeItem('plaster', p.id)} className="h-6 w-6 text-red-500"><X className="w-4 h-4" /></Button>}</div>
                      <div className="grid grid-cols-2 gap-4"><InputField label="Length (ft)" value={p.len} onChange={v => updateItem('plaster', p.id, 'len', v)} /><InputField label="Height (ft)" value={p.height} onChange={v => updateItem('plaster', p.id, 'height', v)} /><InputField label="Thickness (in)" value={p.thick} onChange={v => updateItem('plaster', p.id, 'thick', v)} /><div className="col-span-1 space-y-2"><Label className="text-xs font-black text-slate-600 uppercase">Sides?</Label><Select value={p.sides.toString()} onValueChange={v => updateItem('plaster', p.id, 'sides', v)}><SelectTrigger className="h-10 bg-white border-slate-400 text-sm font-black shadow-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">One side</SelectItem><SelectItem value="2">Both sides</SelectItem></SelectContent></Select></div></div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addItem('plaster')} className="w-full h-12 gap-2 text-xs font-black border-dashed border-slate-400 uppercase"><Plus className="w-3 h-3" /> Add new plaster </Button><SectionResult res={currentRes} />
                </TabsContent>
                <TabsContent value="floorTiles" className="space-y-6 m-0">
                  {renderTabAutoHeader('floorTiles')}
                  {floorTiles.map((f, idx) => (
                    <div key={f.id} className="p-4 border rounded-lg bg-slate-50 relative space-y-4">
                      <div className="flex justify-between items-center"><h4 className="font-black text-xs text-slate-500">Floor Tiles #{idx+1}</h4>{floorTiles.length > 1 && <Button variant="ghost" size="icon" onClick={() => removeItem('floorTiles', f.id)} className="h-6 w-6 text-red-500"><X className="w-4 h-4" /></Button>}</div>
                      <div className="grid grid-cols-2 gap-4"><InputField label="Room Length (ft)" value={f.len} onChange={v => updateItem('floorTiles', f.id, 'len', v)} /><InputField label="Room Width (ft)" value={f.wid} onChange={v => updateItem('floorTiles', f.id, 'wid', v)} /><InputField label="Tiles Length (in)" value={f.tLen} onChange={v => updateItem('floorTiles', f.id, 'tLen', v)} /><InputField label="Tiles Width (in)" value={f.tWid} onChange={v => updateItem('floorTiles', f.id, 'tWid', v)} /><InputField label="Wastage (%)" value={f.wastage} onChange={v => updateItem('floorTiles', f.id, 'wastage', v)} /></div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addItem('floorTiles')} className="w-full h-12 gap-2 text-xs font-black border-dashed border-slate-400 uppercase"><Plus className="w-3 h-3" /> Add new floor tiles </Button><SectionResult res={currentRes} />
                </TabsContent>
                <TabsContent value="wallTiles" className="space-y-6 m-0">
                  {renderTabAutoHeader('wallTiles')}
                  {wallTiles.map((f, idx) => (
                    <div key={f.id} className="p-4 border rounded-lg bg-slate-50 relative space-y-4">
                      <div className="flex justify-between items-center"><h4 className="font-black text-xs text-slate-500">Wall Tiles #{idx+1}</h4>{wallTiles.length > 1 && <Button variant="ghost" size="icon" onClick={() => removeItem('wallTiles', f.id)} className="h-6 w-6 text-red-500"><X className="w-4 h-4" /></Button>}</div>
                      <div className="grid grid-cols-2 gap-4"><InputField label="Wall Length (ft)" value={f.len} onChange={v => updateItem('wallTiles', f.id, 'len', v)} /><InputField label="Wall Height (ft)" value={f.height} onChange={v => updateItem('wallTiles', f.id, 'height', v)} /><InputField label="Tiles Length (in)" value={f.tLen} onChange={v => updateItem('wallTiles', f.id, 'tLen', v)} /><InputField label="Tiles Width (in)" value={f.tWid} onChange={v => updateItem('wallTiles', f.id, 'tWid', v)} /><InputField label="Wastage (%)" value={f.wastage} onChange={v => updateItem('wallTiles', f.id, 'wastage', v)} /></div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addItem('wallTiles')} className="w-full h-12 gap-2 text-xs font-black border-dashed border-slate-400 uppercase"><Plus className="w-3 h-3" /> Add new wall tiles </Button><SectionResult res={currentRes} />
                </TabsContent>
                <TabsContent value="septicTank" className="space-y-6 m-0">
                  {renderTabAutoHeader('septicTank')}
                  {septicTanks.map((s, idx) => (
                    <div key={s.id} className="p-4 border rounded-lg bg-slate-50 relative space-y-4">
                      <div className="flex justify-between items-center"><h4 className="font-black text-xs text-slate-500">Septic Tank #{idx+1}</h4>{septicTanks.length > 1 && <Button variant="ghost" size="icon" onClick={() => removeItem('septicTank', s.id)} className="h-6 w-6 text-red-500"><X className="w-4 h-4" /></Button>}</div>
                      <div className="grid grid-cols-2 gap-4"><InputField label="Count" value={s.count} onChange={v => updateItem('septicTank', s.id, 'count', v)} /><InputField label="Length (ft)" value={s.len} onChange={v => updateItem('septicTank', s.id, 'len', v)} /><InputField label="Width (ft)" value={s.wid} onChange={v => updateItem('septicTank', s.id, 'wid', v)} /><InputField label="Depth (ft)" value={s.depth} onChange={v => updateItem('septicTank', s.id, 'depth', v)} /><div className="col-span-2 space-y-2"><Label className="text-xs font-black text-slate-600 uppercase">Stone/Khoya</Label><Select value={s.aggregateType} onValueChange={v => updateItem('septicTank', s.id, 'aggregateType', v)}><SelectTrigger className="h-10 bg-white border-slate-400 text-sm font-black shadow-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="stone">Stone</SelectItem><SelectItem value="chips">Khoya</SelectItem></SelectContent></Select></div></div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addItem('septicTank')} className="w-full h-12 gap-2 text-xs font-black border-dashed border-slate-400 uppercase"><Plus className="w-3 h-3" /> Add new tank </Button><SectionResult res={currentRes} />
                </TabsContent>
                <TabsContent value="soakWell" className="space-y-6 m-0">
                  {renderTabAutoHeader('soakWell')}
                  {soakWells.map((s, idx) => (
                    <div key={s.id} className="p-4 border rounded-lg bg-slate-50 relative space-y-4">
                      <div className="flex justify-between items-center"><h4 className="font-black text-xs text-slate-500">Soak Well #{idx+1}</h4>{soakWells.length > 1 && <Button variant="ghost" size="icon" onClick={() => removeItem('soakWell', s.id)} className="h-6 w-6 text-red-500"><X className="w-4 h-4" /></Button>}</div>
                      <div className="grid grid-cols-2 gap-4"><InputField label="Count" value={s.count} onChange={v => updateItem('soakWell', s.id, 'count', v)} /><InputField label="Diameter (ft)" value={s.dia} onChange={v => updateItem('soakWell', s.id, 'dia', v)} /><InputField label="Depth (ft)" value={s.depth} onChange={v => updateItem('soakWell', s.id, 'depth', v)} /></div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addItem('soakWell')} className="w-full h-12 gap-2 text-xs font-black border-dashed border-slate-400 uppercase"><Plus className="w-3 h-3" /> Add new soak well </Button><SectionResult res={currentRes} />
                </TabsContent>
                <TabsContent value="total" className="space-y-4 m-0">
                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 space-y-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-emerald-100 pb-2 gap-2"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-emerald-800 flex items-center gap-2 text-sm uppercase"><Boxes className="w-5 h-5" /> Summary </h3>{onOpenMarketSync && <Button variant="outline" size="sm" onClick={onOpenMarketSync} className="h-7 text-[10px] font-black gap-1 border-emerald-300 bg-white hover:bg-emerald-100 text-emerald-800"><TrendingUp className="w-3 h-3 text-emerald-600" /> বাজার দর সিঙ্ক</Button>}{onOpenAdvancedPdfReport && <Button size="sm" onClick={() => onOpenAdvancedPdfReport(total, grandTotalCost)} className="h-7 text-[10px] font-black gap-1 bg-slate-900 hover:bg-slate-800 text-white shadow-sm"><FileText className="w-3 h-3 text-emerald-400" /> PDF রিপোর্ট</Button>}</div><div className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg shadow-md text-right w-full md:w-auto"><span className="text-[8px] uppercase font-black opacity-80 block">Grand Total:</span><span className="text-sm font-black">৳ {grandTotalCost.toLocaleString('bn-BD')}</span></div></div>
                    <div className="space-y-3">
                      <CostRow label="Cement" value={total.cement} unit="bag" price={prices.cement} onPriceChange={(v) => setPrices({...prices, cement: v})} /><CostRow label="Sand" value={total.sand} unit="CFT" price={prices.sand} onPriceChange={(v) => setPrices({...prices, sand: v})} /><CostRow label="Stone" value={total.stone} unit="CFT" price={prices.stone} onPriceChange={(v) => setPrices({...prices, stone: v})} /><CostRow label="Khoya" value={total.chips} unit="CFT" price={prices.chips} onPriceChange={(v) => setPrices({...prices, chips: v})} /><CostRow label="Rod" value={total.rod} unit="KG" price={prices.rod} onPriceChange={(v) => setPrices({...prices, rod: v})} /><CostRow label="Bricks" value={total.bricks} unit="pcs" price={prices.bricks} onPriceChange={(v) => setPrices({...prices, bricks: v})} /><CostRow label="Floor Tiles" value={total.floorTiles} unit="pcs" price={prices.floorTiles} onPriceChange={(v) => setPrices({...prices, floorTiles: v})} /><CostRow label="Wall Tiles" value={total.wallTiles} unit="pcs" price={prices.wallTiles} onPriceChange={(v) => setPrices({...prices, wallTiles: v})} /><CostRow label="Labor Cost" value={total.labor} unit="Sqft" price={prices.labor} onPriceChange={(v) => setPrices({...prices, labor: v})} /><CostRow label="Doors" value={total.doors} unit="pcs" price={prices.doors} onPriceChange={(v) => setPrices({...prices, doors: v})} /><CostRow label="Windows" value={total.windows} unit="pcs" price={prices.windows} onPriceChange={(v) => setPrices({...prices, windows: v})} />
                      <div className="pt-2 mt-4 border-t border-emerald-200 space-y-3">
                        <h4 className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-1 flex items-center gap-1"><Plus className="w-3 h-3" /> Other Expenses</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="space-y-1"><Label className="text-[9px] font-black text-slate-700 uppercase">Electric</Label><Input type="number" value={prices.electric === 0 ? "" : prices.electric} onChange={e => setPrices({...prices, electric: parseFloat(e.target.value) || 0})} className="h-10 text-xs font-black border-emerald-200 bg-white shadow-sm" placeholder="0" /></div><div className="space-y-1"><Label className="text-[9px] font-black text-slate-700 uppercase">Fittings</Label><Input type="number" value={prices.fittings === 0 ? "" : prices.fittings} onChange={e => setPrices({...prices, fittings: parseFloat(e.target.value) || 0})} className="h-10 text-xs font-black border-emerald-200 bg-white shadow-sm" placeholder="0" /></div><div className="space-y-1"><Label className="text-[9px] font-black text-slate-700 uppercase">Paint</Label><Input type="number" value={prices.paint === 0 ? "" : prices.paint} onChange={e => setPrices({...prices, paint: parseFloat(e.target.value) || 0})} className="h-10 text-xs font-black border-emerald-200 bg-white shadow-sm" placeholder="0" /></div><div className="space-y-1"><Label className="text-[9px] font-black text-slate-700 uppercase">Others</Label><Input type="number" value={prices.others === 0 ? "" : prices.others} onChange={e => setPrices({...prices, others: parseFloat(e.target.value) || 0})} className="h-10 text-xs font-black border-emerald-200 bg-white shadow-sm" placeholder="0" /></div></div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
              {advice && (<div className="bg-white p-4 rounded-xl border shadow-sm"><h3 className="text-xs font-black text-emerald-700 mb-2 flex items-center gap-1 uppercase">⭐ AI Advice</h3><div className="text-[10px] md:text-xs leading-relaxed whitespace-pre-wrap text-slate-600">{advice}</div></div>)}
            </div>
            <div className="space-y-4">
              <div className="bg-slate-800 text-white p-3 rounded-xl shadow-lg sticky top-6 space-y-2">
                <h3 className="text-[11px] font-black border-b border-white/20 pb-1 flex items-center justify-between uppercase"><span className="flex items-center gap-1.5"><Calculator className="w-3.5 h-3.5 text-emerald-400" /> Summary</span>{unitSystem === 'metric' && <span className="text-[8px] text-slate-400 font-bold">Metric (m/cm)</span>}</h3>
                <div className="space-y-1.5"><div className="flex justify-between text-[8px] uppercase"><span className="opacity-70 font-black">Cement:</span><span className="font-black">{Math.ceil(total.cement)} bags</span></div><div className="flex justify-between text-[8px] uppercase"><span className="opacity-70 font-black">Sand:</span><span className="font-black">{Math.ceil(total.sand)} CFT</span></div><div className="flex justify-between text-[8px] uppercase"><span className="opacity-70 font-black">Rod:</span><span className="font-black">{Math.ceil(total.rod)} KG</span></div><div className="flex justify-between text-[8px] uppercase"><span className="opacity-70 font-black">Bricks:</span><span className="font-black">{total.bricks} pcs</span></div><div className="mt-1.5 pt-1.5 border-t border-white/20 flex flex-col gap-0.5"><span className="text-[8px] font-black text-emerald-400 uppercase">Total Cost:</span><span className="text-xs font-black text-emerald-400">৳ {grandTotalCost.toLocaleString('bn-BD')}</span></div></div>
                {onOpenAdvancedPdfReport && <Button onClick={() => onOpenAdvancedPdfReport(total, grandTotalCost)} className="w-full h-8 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 mt-2"><FileText className="w-3.5 h-3.5" /> পূর্ণাঙ্গ PDF রিপোর্ট</Button>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InputField({ label, value, onChange }: { label: string, value: number, onChange: (v: string) => void }) {
  return (<div className="space-y-1"><Label className="text-[9px] font-black text-slate-600 uppercase tracking-tight">{label}</Label><Input type="number" value={value === 0 ? "" : value} onChange={e => onChange(e.target.value)} placeholder="0" className="h-9 bg-white border-slate-400 text-xs font-black shadow-sm" /></div>);
}

function SectionResult({ res }: { res: any }) {
  const hasValues = (res.cement || 0) > 0 || (res.rod || 0) > 0 || (res.bricks || 0) > 0 || (res.floorTiles || 0) > 0 || (res.wallTiles || 0) > 0;
  if (!hasValues) return <div className="p-3 bg-slate-50 border border-dashed border-slate-400 rounded-lg text-center text-[8px] text-slate-400 uppercase font-black tracking-widest"> No inputs </div>;
  return (
    <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 space-y-2">
      <h4 className="text-[8px] font-black text-blue-700 uppercase tracking-widest"> Result </h4>
      <div className="grid grid-cols-2 gap-1.5">
        {(res.cement || 0) > 0 && <ResultRow label="Cement" value={res.cement} unit="bag" small />}
        {(res.sand || 0) > 0 && <ResultRow label="Sand" value={res.sand} unit="CFT" small />}
        {(res.stone || 0) > 0 && <ResultRow label="Stone" value={res.stone} unit="CFT" small />}
        {(res.chips || 0) > 0 && <ResultRow label="Khoya" value={res.chips} unit="CFT" small />}
        {(res.rod || 0) > 0 && <ResultRow label="Rod" value={res.rod} unit="KG" small />}
        {(res.bricks || 0) > 0 && <ResultRow label="Bricks" value={res.bricks} unit="pcs" small />}
        {(res.floorTiles || 0) > 0 && <ResultRow label="Floor Tiles" value={res.floorTiles} unit="pcs" small />}
        {(res.wallTiles || 0) > 0 && <ResultRow label="Wall Tiles" value={res.wallTiles} unit="pcs" small />}
      </div>
    </div>
  );
}

function ResultRow({ label, value, unit, small, dark }: { label: string, value: number, unit: string, small?: boolean, dark?: boolean }) {
  return (<div className={cn("flex justify-between architecture-box rounded-lg border shadow-sm", small ? "p-1.5 bg-white" : "p-2 bg-white/10", dark ? "bg-white border-emerald-100" : "border-slate-100")}><span className={cn("font-black uppercase", small ? "text-[8px]" : "text-[10px]", dark ? "text-emerald-900" : "text-slate-700")}>{label}</span><span className={cn("font-black", small ? "text-[9px]" : "text-[12px]", dark ? "text-emerald-700" : "text-slate-900")}>{Math.ceil(value)} {unit}</span></div>);
}

function CostRow({ label, value, unit, price, onPriceChange }: { label: string, value: number, unit: string, price: number, onPriceChange: (v: number) => void }) {
  const qty = Math.ceil(value); const subTotal = qty * price;
  return (<div className="flex flex-col gap-1.5 p-2 bg-white border border-emerald-100 rounded-xl shadow-sm hover:border-emerald-300 transition-colors"><div className="flex justify-between items-start"><div className="flex flex-col"><span className="text-[9px] font-black text-slate-700 uppercase leading-none">{label}</span><span className="text-[7.5px] font-black text-slate-400 uppercase mt-0.5">{qty} {unit}</span></div><div className="text-right flex flex-col items-end"><span className="text-[6.5px] uppercase font-black text-slate-400 tracking-tight">Sub-total</span><span className="text-11px font-black text-emerald-600">৳ {subTotal.toLocaleString('bn-BD')}</span></div></div><div className="flex items-center gap-1.5"><Label className="text-[7.5px] font-black text-slate-400 uppercase shrink-0">Rate (৳)</Label><Input type="number" value={price === 0 ? "" : price} onChange={(e) => onPriceChange(parseFloat(e.target.value) || 0)} className="h-7 w-full text-[10px] font-black text-emerald-700 bg-white border-emerald-200 shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="0" /></div></div>);
}

function RibbonButton({ icon, label, onClick, active, color, className }: { icon: React.ReactNode, label: string, onClick: () => void, active?: boolean, color?: string, className?: string }) {
  const colorClasses = { blue: "bg-blue-600 hover:bg-blue-700 text-white", amber: "bg-amber-600 hover:bg-amber-700 text-white", emerald: "bg-emerald-600 hover:bg-emerald-700 text-white", indigo: "bg-indigo-600 hover:bg-indigo-700 text-white", teal: "bg-teal-600 hover:bg-teal-700 text-white", default: "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700", destructive: "bg-slate-800 text-red-400 border border-slate-700 hover:bg-red-950/30" };
  return (<Button variant="ghost" className={cn("flex flex-col items-center justify-center px-1.5 py-1 rounded-md font-bold h-8 md:h-11 min-w-[40px] md:min-w-[48px] shrink-0 active:scale-[0.97] transition-transform", color ? colorClasses[color as keyof typeof colorClasses] : colorClasses.default, active ? "ring-2 ring-red-600 ring-offset-1 ring-offset-slate-900 bg-slate-700" : "", className)} onClick={onClick}><div className="shrink-0 text-white mb-0.5 pointer-events-none">{React.cloneElement(icon as React.ReactElement<any>, { className: "w-3.5 md:w-4 h-3.5 md:h-4" })}</div><span className="text-[9px] uppercase font-black leading-none tracking-tight text-white antialiased pointer-events-none">{label}</span></Button>);
}

function SymbolButton({ icon, label, onClick, active, color }: { icon: React.ReactNode, label: string, onClick: () => void, active?: boolean, color?: string }) {
  const colorMap = { blue: "bg-blue-500 border-blue-700 shadow-[0_2px_0_0_#1d4ed8]", amber: "bg-amber-500 border-amber-700 shadow-[0_2px_0_0_#b45309]", emerald: "bg-emerald-500 border-emerald-700 shadow-[0_2px_0_0_#059669]", indigo: "bg-indigo-500 border-indigo-700 shadow-[0_2px_0_0_#4338ca]", slate: "bg-slate-700 border-slate-900 shadow-[0_2px_0_0_#0f172a]", violet: "bg-violet-500 border-violet-700 shadow-[0_2px_0_0_#6d28d9]", purple: "bg-purple-500 border-violet-700 shadow-[0_2px_0_0_#7e22ce]", cyan: "bg-cyan-500 border-cyan-700 shadow-[0_2px_0_0_#0891b2]", teal: "bg-teal-500 border-teal-700 shadow-[0_2px_0_0_#0f766e]", pink: "bg-pink-500 border-pink-700 shadow-[0_2px_0_0_#be185d]", sky: "bg-sky-500 border-sky-700 shadow-[0_2px_0_0_#0369a1]" };
  const baseColor = color ? colorMap[color as keyof typeof colorMap] : "bg-slate-800 border-slate-700 shadow-[0_1px_0_0_rgba(0,0,0,0.3)]";
  return (<div onClick={onClick} className={cn("flex flex-col items-center justify-center p-0.5 rounded-md cursor-pointer border transition-all active:translate-y-[1px] active:shadow-none h-12 md:h-[54px] w-[86px] md:w-[94px] mx-auto overflow-visible", baseColor, active ? "ring-2 ring-red-600 ring-offset-1 scale-95 translate-y-[1px] shadow-none" : "")}><div className="shrink-0 text-white">{React.cloneElement(icon as React.ReactElement<any>, { className: "w-3.5 md:w-4 h-3.5 md:h-4" })}</div><span className="text-[11px] md:text-[12px] font-black uppercase whitespace-nowrap text-white mt-0.5 leading-none">{label}</span></div>);
}

function PropField({ label, value, onChange, onBlur, disabled }: { label: string, value: string, onChange: (v: string) => void, onBlur: () => void, disabled?: boolean }) {
  return (<div className="flex flex-col gap-0.5"><span className="text-[8px] font-black text-slate-400 uppercase tracking-tight min-w-[20px]">{label}</span><Input className="h-8 w-12 md:w-16 text-[11px] font-black text-center border-slate-700 bg-slate-800 text-white shadow-sm px-1 py-0 flex items-center justify-center leading-none" value={value} onChange={e => onChange(e.target.value)} disabled={disabled} onBlur={onBlur} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></div>);
}

