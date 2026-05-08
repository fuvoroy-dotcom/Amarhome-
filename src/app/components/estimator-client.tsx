
"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Building, Cog, BarChartBig, Layers, Paintbrush, ClipboardList, Trash2, 
  RectangleHorizontal, Grid, List, ArrowRightLeft, Palette, 
  Eraser, Square, DoorClosed, LayoutGrid, RotateCcw, Plus, 
  Maximize, Bed, Armchair, Bath, Utensils, Tv, Coffee, MousePointer2, X,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Settings2, RefreshCw,
  Download, Copy, Scissors, Clipboard, Type, ChevronDown, Undo2, Redo2,
  Highlighter, Pipette, Maximize2, Minimize2, Move, Group, FlipHorizontal2,
  BringToFront, SendToBack, Search, Ruler, Shapes, MousePointer, Minus
} from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { 
  estimatorSchema, type EstimatorValues, 
  brickEstimatorSchema, type BrickEstimatorValues, 
  tileEstimatorSchema, type TileEstimatorValues, 
  plasterEstimatorSchema, type PlasterEstimatorValues, 
  fullHouseEstimatorSchema, type FullHouseEstimatorValues, 
  slabEstimatorSchema, type SlabEstimatorValues, 
  stairEstimatorSchema, type StairEstimatorValues 
} from "@/app/lib/schemas";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";

// --- Types for Calculators (v61e7980 logic) ---
type StructuralResults = { cement: number; sand: number; chips: number; mainRodWeight: number; ringRodWeight: number; totalRodWeight: number; };
type SlabResults = { cement: number; sand: number; chips: number; rodWeight: number; };
type BrickResults = { bricks: number; cement: number; sand: number; };
type TileResults = { tiles: number; cement: number; sand: number; };
type PlasterResults = { cement: number; sand: number; };
type FullHouseResults = { totalCement: number; totalSand: number; totalChips: number; totalRodWeight: number; totalBricks: number; totalTiles: number; };
type StairResults = { cement: number; sand: number; chips: number; totalRodWeight: number; };

// --- Design Logic Types ---
type DesignObject = {
  id: string;
  type: 'structure' | 'opening' | 'furniture' | 'utility' | 'shape';
  subType: string;
  x: number; // in feet
  y: number; // in feet
  w: number; // width in feet
  h: number; // height in feet
  label: string;
  color: string;
  rotation: number;
};

export default function EstimatorClient() {
  const { toast } = useToast();

  // --- Calculator States (v61e7980 logic) ---
  const [structuralResults, setStructuralResults] = useState<StructuralResults | null>(null);
  const [slabResults, setSlabResults] = useState<SlabResults | null>(null);
  const [brickResults, setBrickResults] = useState<BrickResults | null>(null);
  const [tileResults, setTileResults] = useState<TileResults | null>(null);
  const [plasterResults, setPlasterResults] = useState<PlasterResults | null>(null);
  const [fullHouseResults, setFullHouseResults] = useState<FullHouseResults | null>(null);
  const [stairResults, setStairResults] = useState<StairResults | null>(null);

  // --- Design State ---
  const [designObjects, setDesignObjects] = useState<DesignObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [interactionMode, setInteractionMode] = useState<'none' | 'dragging' | 'resizing' | 'rotating'>('none');
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(30); // 1ft = 30px
  const [snapPoint, setSnapPoint] = useState<{x: number, y: number} | null>(null);
  const [groupToMove, setGroupToMove] = useState<string[]>([]);
  
  const selectedObject = useMemo(() => designObjects.find(obj => obj.id === selectedObjectId), [designObjects, selectedObjectId]);

  // --- Calculator Forms (v61e7980 logic) ---
  const structuralForm = useForm<EstimatorValues>({
    resolver: zodResolver(estimatorSchema),
    defaultValues: { includeBase: true, includeColumn: true, includeBeam: true, baseCount: 1, baseLengthFt: 5, baseWidthFt: 5, baseThicknessIn: 18, columnCount: 1, columnLengthIn: 12, columnWidthIn: 10, columnHeightFt: 32, beamHeightIn: 12, beamWidthIn: 10, beamLengthFt: 12, columnRodCount: 8, beamRodCount: 6, mainRodFactor: 0.48, ringGapIn: 7, ringRodFactor: 0.12, baseRodLongitudinalCount: 10, baseRodWidthCount: 10 },
  });
  const includeBase = structuralForm.watch('includeBase');
  const includeColumn = structuralForm.watch('includeColumn');
  const includeBeam = structuralForm.watch('includeBeam');

  const slabForm = useForm<SlabEstimatorValues>({ resolver: zodResolver(slabEstimatorSchema), defaultValues: { slabs: [{ length: 20, width: 15 }], slabThicknessIn: 5, slabRodGapIn: 6, mainRodFactor: 0.48 } });
  const { fields: slabFields, append: appendSlab, remove: removeSlab } = useFieldArray({ control: slabForm.control, name: "slabs" });

  const brickForm = useForm<BrickEstimatorValues>({ resolver: zodResolver(brickEstimatorSchema), defaultValues: { calculationType: 'rooms', wallLengthFt: 10, wallHeightFt: 10, wallThicknessIn: '5', rooms: [{ length: 12, width: 10 }] } });
  const { fields: brickFields, append: appendBrick, remove: removeBrick } = useFieldArray({ control: brickForm.control, name: "rooms" });

  const tileForm = useForm<TileEstimatorValues>({ resolver: zodResolver(tileEstimatorSchema), defaultValues: { calculationType: 'floor', floorLengthFt: 12, floorWidthFt: 10, walls: [{ length: 12, height: 10 }], tileLengthIn: 12, tileWidthIn: 12, wastagePercent: 10 } });
  const { fields: wallFields, append: appendWall, remove: removeWall } = useFieldArray({ control: tileForm.control, name: "walls" });

  const plasterForm = useForm<PlasterEstimatorValues>({ resolver: zodResolver(plasterEstimatorSchema), defaultValues: { wallLengthFt: 10, wallHeightFt: 10, plasterThicknessIn: 0.5, plasterSides: '2' } });

  const fullHouseForm = useForm<FullHouseEstimatorValues>({ resolver: zodResolver(fullHouseEstimatorSchema), defaultValues: { floorCount: 1, totalAreaSqFt: 1000, roomCount: 3, bathroomCount: 2, avgRoomLengthFt: 12, avgRoomWidthFt: 10, floorHeightFt: 10, columnCountPerFloor: 10, slabThicknessIn: 5, wallThicknessIn: '5', tileFloors: true, tileBathroomWalls: true, bathroomWallTileHeightFt: 7, plasterInterior: true, plasterExterior: true, mainRodFactor: 0.48, ringRodFactor: 0.12, ringGapIn: 7 } });

  const stairForm = useForm<StairEstimatorValues>({ resolver: zodResolver(stairEstimatorSchema), defaultValues: { flightCount: 1, waistSlabLengthFt: 10, waistSlabWidthFt: 3.5, waistSlabThicknessIn: 5, stepCountPerFlight: 10, riserHeightIn: 6, treadWidthIn: 10, landingLengthFt: 3.5, landingWidthFt: 7, mainRodFactor: 0.30, distRodFactor: 0.19, distRodGapIn: 6 } });

  // --- Calculation Functions (v61e7980 logic) ---
  function calculateStructural(data: EstimatorValues) {
    const { includeBase, includeColumn, includeBeam, baseCount, baseLengthFt, baseWidthFt, baseThicknessIn, columnCount, columnLengthIn, columnWidthIn, columnHeightFt, beamHeightIn, beamWidthIn, beamLengthFt, columnRodCount, beamRodCount, mainRodFactor, ringGapIn, ringRodFactor, baseRodLongitudinalCount, baseRodWidthCount } = data;
    let totalWetVol = 0;
    if (includeBase) totalWetVol += baseLengthFt * baseWidthFt * (baseThicknessIn / 12) * baseCount;
    if (includeColumn) totalWetVol += (columnLengthIn / 12) * (columnWidthIn / 12) * columnHeightFt * columnCount;
    if (includeBeam) totalWetVol += (beamHeightIn / 12) * (beamWidthIn / 12) * beamLengthFt;
    const dryVol = totalWetVol * 1.5;
    const ratioSum = 5.5; 
    const cementBags = Math.ceil((dryVol / ratioSum) / 1.25);
    const sandCFT = (dryVol / ratioSum) * 1.5;
    const chipsCFT = (dryVol / ratioSum) * 3;
    let mainRodWeight = 0;
    if (includeBase) mainRodWeight += ((baseRodLongitudinalCount * baseWidthFt) + (baseRodWidthCount * baseLengthFt)) * mainRodFactor * baseCount;
    if (includeColumn) mainRodWeight += (columnRodCount * columnHeightFt * columnCount) * mainRodFactor;
    if (includeBeam) mainRodWeight += (beamRodCount * beamLengthFt) * mainRodFactor;
    let ringWeight = 0;
    if (includeColumn && ringGapIn > 0) ringWeight += (((columnLengthIn / 12) + (columnWidthIn / 12)) * 2 * ((columnHeightFt * 12) / ringGapIn) * columnCount) * ringRodFactor;
    if (includeBeam && ringGapIn > 0) ringWeight += (((beamHeightIn / 12) + (beamWidthIn / 12)) * 2 * ((beamLengthFt * 12) / ringGapIn)) * ringRodFactor;
    setStructuralResults({ cement: cementBags, sand: sandCFT, chips: chipsCFT, mainRodWeight, ringRodWeight: ringWeight, totalRodWeight: mainRodWeight + ringWeight });
  }

  function calculateSlab(data: SlabEstimatorValues) {
    const { slabs, slabThicknessIn, slabRodGapIn, mainRodFactor } = data;
    const totalArea = slabs.reduce((acc, slab) => acc + (slab.length * slab.width), 0);
    const dryVol = totalArea * (slabThicknessIn / 12) * 1.5;
    const ratioSum = 5.5; 
    const cementBags = Math.ceil((dryVol / ratioSum) / 1.25);
    const sandCFT = (dryVol / ratioSum) * 1.5;
    const chipsCFT = (dryVol / ratioSum) * 3;
    let totalRodLength = 0;
    slabs.forEach(slab => { totalRodLength += ((slab.width / (slabRodGapIn / 12)) * slab.length) + ((slab.length / (slabRodGapIn / 12)) * slab.width); });
    setSlabResults({ cement: cementBags, sand: parseFloat(sandCFT.toFixed(1)), chips: parseFloat(chipsCFT.toFixed(1)), rodWeight: parseFloat((totalRodLength * mainRodFactor).toFixed(1)) });
  }

  function calculateBricks(data: BrickEstimatorValues) {
    const { calculationType, wallLengthFt, wallHeightFt, wallThicknessIn, rooms } = data;
    let totalLength = calculationType === 'wall' ? wallLengthFt || 0 : (rooms || []).reduce((acc, room) => acc + (room.length + room.width) * 2, 0);
    const area = totalLength * (wallHeightFt || 0);
    const bricks = area * (wallThicknessIn === '5' ? 5 : 10);
    const dryVol = area * (wallThicknessIn === '5' ? 5/12 : 10/12) * 0.30 * 1.33;
    setBrickResults({ bricks: Math.ceil(bricks), cement: Math.ceil((dryVol / 5) / 1.25), sand: parseFloat(((dryVol / 5) * 4).toFixed(1)) });
  }

  function calculateTiles(data: TileEstimatorValues) {
    const { calculationType, floorLengthFt, floorWidthFt, walls, tileLengthIn, tileWidthIn, wastagePercent } = data;
    let totalArea = calculationType === 'floor' ? (floorLengthFt || 0) * (floorWidthFt || 0) : (walls || []).reduce((acc, wall) => acc + (wall.length * wall.height), 0);
    const tileArea = (tileLengthIn / 12) * (tileWidthIn / 12);
    const totalTiles = Math.ceil((totalArea / tileArea) * (1 + (wastagePercent || 0) / 100));
    const dryVol = totalArea * (calculationType === 'floor' ? 1/12 : 0.5/12) * 1.33;
    setTileResults({ tiles: totalTiles, cement: Math.ceil((dryVol / 5) / 1.25), sand: parseFloat(((dryVol / 5) * 4).toFixed(1)) });
  }

  function calculatePlaster(data: PlasterEstimatorValues) {
    const { wallLengthFt, wallHeightFt, plasterThicknessIn, plasterSides } = data;
    const dryVol = (wallLengthFt * wallHeightFt * parseInt(plasterSides)) * (plasterThicknessIn / 12) * 1.33;
    setPlasterResults({ cement: Math.ceil((dryVol / 5) / 1.25), sand: parseFloat(((dryVol / 5) * 4).toFixed(1)) });
  }

  function calculateFullHouse(data: FullHouseEstimatorValues) {
    const { floorCount, totalAreaSqFt, wallThicknessIn } = data;
    const totalSlabArea = totalAreaSqFt * floorCount;
    const bricks = totalSlabArea * 5 * (wallThicknessIn === '5' ? 1 : 2); 
    setFullHouseResults({ totalCement: Math.ceil(totalSlabArea * 0.5), totalSand: totalSlabArea * 1.2, totalChips: totalSlabArea * 2.5, totalRodWeight: totalSlabArea * 3.5, totalBricks: Math.ceil(bricks), totalTiles: Math.ceil(totalSlabArea * 1.1) });
  }

  function calculateStair(data: StairEstimatorValues) {
    const { flightCount, waistSlabLengthFt, waistSlabWidthFt } = data;
    const dryVol = flightCount * waistSlabLengthFt * waistSlabWidthFt * (5/12) * 1.5;
    setStairResults({ cement: Math.ceil((dryVol / 5.5) / 1.25), sand: parseFloat(((dryVol / 5.5) * 1.5).toFixed(1)), chips: parseFloat(((dryVol / 5.5) * 3).toFixed(1)), totalRodWeight: 45 * flightCount });
  }

  // --- Design Interaction Handlers ---
  const addObject = (type: DesignObject['type'], subType: string, label: string) => {
    let w = 10, h = 10;
    if (subType === 'wall') { 
      w = 10; 
      h = 0.2; // Thin line
    } else if (type === 'opening') { 
      w = 3; 
      h = 0.2; 
    } else if (type === 'furniture') { 
      w = 4; 
      h = 6; 
    }
    
    const newObj: DesignObject = {
      id: Math.random().toString(36).substr(2, 9),
      type, subType, x: 10, y: 10, w, h,
      label, color: subType === 'wall' ? '#000000' : '#ffffff', rotation: 0
    };
    setDesignObjects([...designObjects, newObj]);
    setSelectedObjectId(newObj.id);
  };

  // Improved Grouping: Find all connected objects recursively
  const getConnectedGroup = (startId: string, allObjs: DesignObject[]) => {
    const connected = new Set<string>();
    const stack = [startId];
    const threshold = 1.2; // 1.2ft snap/connect range

    while (stack.length > 0) {
      const currentId = stack.pop()!;
      if (connected.has(currentId)) continue;
      connected.add(currentId);

      const currentObj = allObjs.find(o => o.id === currentId);
      if (!currentObj) continue;

      // Check all other objects to see if they are "connected" to the current set
      allObjs.forEach(other => {
        if (connected.has(other.id)) return;

        // Simplified bounding box check with threshold
        const isNear = !(
          other.x > (currentObj.x + currentObj.w + threshold) ||
          (other.x + other.w) < (currentObj.x - threshold) ||
          other.y > (currentObj.y + currentObj.h + threshold) ||
          (other.y + other.h) < (currentObj.y - threshold)
        );

        if (isNear) stack.push(other.id);
      });
    }
    return Array.from(connected);
  };

  const handleMouseDown = (e: React.MouseEvent, id: string, mode: any = 'dragging') => {
    e.stopPropagation(); 
    setSelectedObjectId(id);
    setInteractionMode(mode);
    
    const obj = designObjects.find(o => o.id === id);
    if (obj) {
      const rect = document.getElementById('canvas-workspace')?.getBoundingClientRect();
      if (rect) {
        setDragOffset({ 
          x: (e.clientX - rect.left) / zoom - obj.x, 
          y: (e.clientY - rect.top) / zoom - obj.y 
        });
      }
      setGroupToMove(getConnectedGroup(id, designObjects));
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!selectedObjectId || interactionMode === 'none') return;
    
    const canvasRect = document.getElementById('canvas-workspace')?.getBoundingClientRect();
    if (!canvasRect) return;

    const currentX = (e.clientX - canvasRect.left) / zoom;
    const currentY = (e.clientY - canvasRect.top) / zoom;

    const currentObj = designObjects.find(o => o.id === selectedObjectId);
    if (!currentObj) return;

    if (interactionMode === 'dragging') {
      const targetX = currentX - dragOffset.x;
      const targetY = currentY - dragOffset.y;
      
      let finalDeltaX = targetX - currentObj.x;
      let finalDeltaY = targetY - currentObj.y;

      const snapThreshold = 1.0; 
      let activeSnap: {x: number, y: number} | null = null;

      // Check corners of current dragging set against edges/corners of other objects
      const myCorners = [
        { x: targetX, y: targetY },
        { x: targetX + currentObj.w, y: targetY },
        { x: targetX, y: targetY + currentObj.h },
        { x: targetX + currentObj.w, y: targetY + currentObj.h },
        { x: targetX + currentObj.w / 2, y: targetY + currentObj.h / 2 } // Center point snap
      ];

      designObjects.forEach(other => {
        if (groupToMove.includes(other.id)) return;
        
        const otherCorners = [
          { x: other.x, y: other.y }, 
          { x: other.x + other.w, y: other.y },
          { x: other.x, y: other.y + other.h }, 
          { x: other.x + other.w, y: other.y + other.h },
          { x: other.x + other.w/2, y: other.y }, // Edge midpoints
          { x: other.x, y: other.y + other.h/2 },
          { x: other.x + other.w, y: other.y + other.h/2 },
          { x: other.x + other.w/2, y: other.y + other.h }
        ];

        myCorners.forEach((mc, mi) => {
          otherCorners.forEach(oc => {
            const dist = Math.sqrt(Math.pow(mc.x - oc.x, 2) + Math.pow(mc.y - oc.y, 2));
            if (dist < snapThreshold) {
              // Calculate delta to align mc to oc
              if (mi === 0) { finalDeltaX = oc.x - currentObj.x; finalDeltaY = oc.y - currentObj.y; }
              else if (mi === 1) { finalDeltaX = oc.x - currentObj.w - currentObj.x; finalDeltaY = oc.y - currentObj.y; }
              else if (mi === 2) { finalDeltaX = oc.x - currentObj.x; finalDeltaY = oc.y - currentObj.h - currentObj.y; }
              else if (mi === 3) { finalDeltaX = oc.x - currentObj.w - currentObj.x; finalDeltaY = oc.y - currentObj.h - currentObj.y; }
              else if (mi === 4) { finalDeltaX = oc.x - currentObj.w/2 - currentObj.x; finalDeltaY = oc.y - currentObj.h/2 - currentObj.y; }
              activeSnap = { x: oc.x, y: oc.y };
            }
          });
        });
      });

      // If no magnetic snap, snap to grid (0.5ft increments)
      if (!activeSnap) {
        finalDeltaX = Math.round((currentObj.x + finalDeltaX) * 2) / 2 - currentObj.x;
        finalDeltaY = Math.round((currentObj.y + finalDeltaY) * 2) / 2 - currentObj.y;
      }

      setSnapPoint(activeSnap);
      
      setDesignObjects(objs => objs.map(o => 
        groupToMove.includes(o.id) 
          ? { ...o, x: Math.max(0, o.x + finalDeltaX), y: Math.max(0, o.y + finalDeltaY) } 
          : o
      ));

    } else if (interactionMode === 'resizing') {
      const nextW = Math.max(0.1, Math.round((currentX - currentObj.x) * 2) / 2);
      const nextH = Math.max(0.1, Math.round((currentY - currentObj.y) * 2) / 2);
      setDesignObjects(objs => objs.map(o => o.id === selectedObjectId ? { ...o, w: nextW, h: nextH } : o));
    } else if (interactionMode === 'rotating') {
      const centerX = currentObj.x + currentObj.w / 2;
      const centerY = currentObj.y + currentObj.h / 2;
      const angle = Math.atan2(currentY - centerY, currentX - centerX) * (180 / Math.PI);
      setDesignObjects(objs => objs.map(o => o.id === selectedObjectId ? { ...o, rotation: Math.round(angle + 90) } : o));
    }
  };

  const updateObject = (id: string, updates: Partial<DesignObject>) => {
    setDesignObjects(objs => objs.map(o => o.id === id ? { ...o, ...updates } : o));
  };

  const deleteObject = (id: string) => {
    setDesignObjects(designObjects.filter(o => o.id !== id));
    setSelectedObjectId(null);
  };

  const nudgeObject = (id: string, dx: number, dy: number) => {
    const group = getConnectedGroup(id, designObjects);
    setDesignObjects(objs => objs.map(o => group.includes(o.id) ? { ...o, x: o.x + dx, y: o.y + dy } : o));
  };

  const formatFeetInches = (feet: number) => {
    const f = Math.floor(feet);
    const i = Math.round((feet - f) * 12);
    return `${f}' ${i}"`;
  };

  const parseFeetInches = (str: string) => {
    const match = str.match(/(\d+)'\s*(\d+)"/);
    if (match) {
      return parseInt(match[1]) + parseInt(match[2]) / 12;
    }
    return parseFloat(str) || 0;
  };

  return (
    <div className="w-full max-w-full mx-auto p-0 bg-slate-100 min-h-screen flex flex-col">
      <Card className="shadow-none border-none overflow-hidden rounded-none bg-white flex-1 flex flex-col">
        <div className="bg-[#0f172a] p-2 text-white text-center shrink-0">
          <h1 className="text-sm font-bold flex items-center justify-center gap-2">
             <Building className="w-4 h-4 text-blue-400" /> আমার বাড়ি এস্টিমেটর ও প্রফেশনাল ডিজাইন টুল
          </h1>
        </div>

        <Tabs defaultValue="design" className="w-full flex-1 flex flex-col overflow-hidden">
          <div className="w-full bg-slate-100 border-b">
            <ScrollArea className="w-full">
              <div className="flex h-auto bg-transparent px-4 py-1">
                <TabsList className="flex h-auto bg-transparent rounded-none border-none p-0">
                  <TabsTrigger value="structural" className="py-2 text-[12px] whitespace-nowrap">স্ট্রাকচার</TabsTrigger>
                  <TabsTrigger value="slab" className="py-2 text-[12px] whitespace-nowrap">ছাদ</TabsTrigger>
                  <TabsTrigger value="stair" className="py-2 text-[12px] whitespace-nowrap">সিঁড়ি</TabsTrigger>
                  <TabsTrigger value="brick" className="py-2 text-[12px] whitespace-nowrap">গাঁথুনি</TabsTrigger>
                  <TabsTrigger value="plaster" className="py-2 text-[12px] whitespace-nowrap">প্লাস্টার</TabsTrigger>
                  <TabsTrigger value="tile" className="py-2 text-[12px] whitespace-nowrap">টাইলস</TabsTrigger>
                  <TabsTrigger value="fullHouse" className="py-2 text-[12px] whitespace-nowrap">পূর্ণ বাড়ি</TabsTrigger>
                  <TabsTrigger value="conversion" className="py-2 text-[12px] whitespace-nowrap">রূপান্তর</TabsTrigger>
                  <TabsTrigger value="design" className="py-2 text-[12px] bg-blue-600 text-white data-[state=active]:bg-blue-700 font-bold whitespace-nowrap">ডিজাইন টুল (SmartDraw)</TabsTrigger>
                </TabsList>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>

          <TabsContent value="design" className="p-0 m-0 bg-[#f8f9fa] flex flex-col flex-1 overflow-hidden">
            <div className="h-14 bg-white border-b flex items-center px-4 gap-6 shrink-0 shadow-sm z-30 overflow-x-auto whitespace-nowrap">
              <div className="flex items-center gap-1 border-r pr-4">
                <ToolIconButton icon={<Download />} label="Export" dropdown />
              </div>
              <div className="flex items-center gap-1 border-r pr-4">
                <ToolIconButton icon={<Clipboard />} label="Paste" />
                <ToolIconButton icon={<Copy />} />
                <ToolIconButton icon={<Scissors />} />
                <ToolIconButton icon={<Pipette />} />
              </div>
              <div className="flex items-center gap-1 border-r pr-4">
                <ToolIconButton icon={<Plus />} label="Insert" dropdown />
                <ToolIconButton icon={<Undo2 />} />
                <ToolIconButton icon={<Redo2 />} />
              </div>
              <div className="flex items-center gap-2 border-r pr-4">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Font</span>
                  <div className="flex items-center gap-1">
                    <Select defaultValue="arial"><SelectTrigger className="h-7 w-24 text-[11px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="arial">Arial</SelectItem><SelectItem value="inter">Inter</SelectItem></SelectContent></Select>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 border-r pr-4">
                <ToolIconButton icon={<Shapes />} label="Styles" />
                <ToolIconButton icon={<Palette />} label="Themes" />
                <ToolIconButton icon={<Highlighter />} label="Fill" />
                <ToolIconButton icon={<Minus />} label="Line" />
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              <div className="w-64 bg-white border-r flex flex-col z-20 shadow-lg shrink-0 overflow-hidden">
                <div className="p-3 border-b bg-slate-50 flex items-center justify-between">
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-600">Library</span>
                </div>
                <ScrollArea className="flex-1">
                  <Accordion type="multiple" defaultValue={["tools", "symbols"]} className="w-full">
                    <AccordionItem value="tools" className="border-none">
                      <AccordionTrigger className="px-4 py-2 hover:no-underline text-[12px] font-bold text-slate-700 bg-slate-50/50">Wall Tools</AccordionTrigger>
                      <AccordionContent className="p-4 space-y-2">
                        <Button variant="outline" className="w-full justify-start text-[11px] h-10 gap-2 bg-amber-50 border-amber-200 text-amber-900 font-bold" onClick={() => addObject('structure', 'wall', 'দেয়াল')}><Maximize className="w-3 h-3"/> Add Line Wall</Button>
                        <Button variant="ghost" className="w-full justify-start text-[11px] h-9 gap-2" onClick={() => addObject('opening', 'door', 'দরজা')}><DoorClosed className="w-3 h-3"/> Add Door</Button>
                      </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="symbols" className="border-none">
                      <AccordionTrigger className="px-4 py-2 hover:no-underline text-[12px] font-bold text-slate-700 bg-slate-50/50">Room Shapes</AccordionTrigger>
                      <AccordionContent className="p-4">
                        <div className="grid grid-cols-4 gap-2">
                          <SymbolBox icon={<Square />} onClick={() => addObject('structure', 'room', 'রুম')} />
                          <SymbolBox icon={<LayoutGrid />} onClick={() => addObject('structure', 'room', 'এল-রুম')} />
                          <SymbolBox icon={<RectangleHorizontal />} onClick={() => addObject('structure', 'room', 'হল')} />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  <ScrollBar orientation="vertical" />
                </ScrollArea>
              </div>

              <div className="flex-1 relative flex flex-col bg-[#e9ecef] overflow-hidden">
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
                    className="flex-1 relative bg-[#e9ecef] overflow-auto focus:outline-none"
                    onMouseMove={handleMouseMove}
                    onMouseUp={() => { setInteractionMode('none'); setSnapPoint(null); setGroupToMove([]); }}
                    onClick={() => { if (interactionMode === 'none') setSelectedObjectId(null); }}
                  >
                    <div 
                      className="absolute inset-0"
                      style={{ 
                        backgroundImage: `linear-gradient(#dee2e6 1px, transparent 1px), linear-gradient(90deg, #dee2e6 1px, transparent 1px)`,
                        backgroundSize: `${zoom}px ${zoom}px`,
                        width: 10000, height: 10000,
                        backgroundColor: 'white'
                      }}
                    >
                      {snapPoint && (
                        <div 
                          className="absolute w-6 h-6 bg-blue-500 rounded-full z-50 animate-pulse border-2 border-white shadow-lg pointer-events-none"
                          style={{ left: snapPoint.x * zoom - 12, top: snapPoint.y * zoom - 12 }}
                        />
                      )}

                      {designObjects.map(obj => (
                        <div
                          key={obj.id}
                          onMouseDown={(e) => handleMouseDown(e, obj.id, 'dragging')}
                          onClick={(e) => e.stopPropagation()} 
                          className={cn(
                            "absolute flex items-center justify-center transition-all cursor-move select-none",
                            selectedObjectId === obj.id ? "z-30" : "z-10"
                          )}
                          style={{
                            left: obj.x * zoom,
                            top: obj.y * zoom,
                            width: obj.w * zoom,
                            height: obj.h * zoom,
                            transform: `rotate(${obj.rotation}deg)`,
                            backgroundColor: obj.subType === 'wall' ? '#000000' : obj.color,
                            border: selectedObjectId === obj.id ? '2px solid #2563eb' : (obj.subType === 'wall' ? 'none' : '1px solid #000'),
                          }}
                        >
                          <div className="absolute -top-7 left-0 right-0 flex flex-col items-center pointer-events-none">
                            <div className="w-full h-[1px] bg-blue-400 relative">
                               <div className="absolute left-0 -top-1 w-[1px] h-2 bg-blue-400" />
                               <div className="absolute right-0 -top-1 w-[1px] h-2 bg-blue-400" />
                            </div>
                            <span className="bg-white px-1 text-[10px] font-bold text-blue-600 -mt-2.5 z-10 shadow-sm border border-blue-50 rounded-sm whitespace-nowrap">
                              {formatFeetInches(obj.w)}
                            </span>
                          </div>

                          {obj.subType !== 'wall' && (
                             <div className="absolute -right-10 top-0 bottom-0 flex flex-row items-center pointer-events-none">
                                <div className="h-full w-[1px] bg-blue-400 relative">
                                   <div className="absolute top-0 -left-1 h-[1px] w-2 bg-blue-400" />
                                   <div className="absolute bottom-0 -left-1 h-[1px] w-2 bg-blue-400" />
                                </div>
                                <span className="bg-white py-1 text-[10px] font-bold text-blue-600 -ml-5 rotate-90 z-10 shadow-sm border border-blue-50 rounded-sm">
                                  {formatFeetInches(obj.h)}
                                </span>
                             </div>
                          )}
                          
                          {selectedObjectId === obj.id && (
                            <>
                              <div 
                                className="absolute -top-14 left-1/2 -translate-x-1/2 w-8 h-8 bg-white border-2 border-blue-600 rounded-full shadow-lg flex items-center justify-center cursor-pointer hover:bg-blue-50 z-40"
                                onMouseDown={(e) => handleMouseDown(e, obj.id, 'rotating')}
                              >
                                <RefreshCw className="w-4 h-4 text-blue-600" />
                              </div>
                              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-600 rounded-full cursor-se-resize z-40 border-2 border-white shadow-md" onMouseDown={(e) => handleMouseDown(e, obj.id, 'resizing')} />
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="h-12 bg-white border-t flex items-center px-4 gap-6 shrink-0 z-30 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] overflow-x-auto whitespace-nowrap">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Left</span>
                      <Input 
                        className="h-7 w-20 text-[11px] font-mono" 
                        disabled={!selectedObject} 
                        value={selectedObject ? formatFeetInches(selectedObject.x) : ''} 
                        onChange={(e) => selectedObject && updateObject(selectedObject.id, { x: parseFeetInches(e.target.value) })} 
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Top</span>
                      <Input 
                        className="h-7 w-20 text-[11px] font-mono" 
                        disabled={!selectedObject} 
                        value={selectedObject ? formatFeetInches(selectedObject.y) : ''} 
                        onChange={(e) => selectedObject && updateObject(selectedObject.id, { y: parseFeetInches(e.target.value) })} 
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Width</span>
                      <Input 
                        className="h-7 w-20 text-[11px] font-mono" 
                        disabled={!selectedObject} 
                        value={selectedObject ? formatFeetInches(selectedObject.w) : ''} 
                        onChange={(e) => selectedObject && updateObject(selectedObject.id, { w: parseFeetInches(e.target.value) })} 
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Height</span>
                      <Input 
                        className="h-7 w-20 text-[11px] font-mono" 
                        disabled={!selectedObject || selectedObject.subType === 'wall'} 
                        value={selectedObject ? formatFeetInches(selectedObject.h) : ''} 
                        onChange={(e) => selectedObject && updateObject(selectedObject.id, { h: parseFeetInches(e.target.value) })} 
                      />
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-3">
                    <Slider value={[zoom]} max={150} min={10} step={5} className="w-32" onValueChange={(val) => setZoom(val[0])} />
                    <span className="text-[11px] font-mono text-slate-500 w-10 text-right">{Math.round((zoom/30)*100)}%</span>
                  </div>
                </div>
              </div>

              <div className="w-72 bg-white border-l flex flex-col z-20 shadow-xl shrink-0">
                <div className="p-3 border-b bg-slate-50 flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-blue-600"/>
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-600">Properties</span>
                </div>
                <ScrollArea className="flex-1">
                  {selectedObject ? (
                    <div className="p-4 space-y-6">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">{selectedObject.label} Edit</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedObjectId(null)}><X className="w-3 h-3"/></Button>
                        </div>
                        <Separator />
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] text-slate-500 uppercase font-bold">Width</Label>
                            <Input value={formatFeetInches(selectedObject.w)} onChange={(e) => updateObject(selectedObject.id, { w: parseFeetInches(e.target.value) })} className="h-9 font-mono" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] text-slate-500 uppercase font-bold">Height</Label>
                            <Input 
                              disabled={selectedObject.subType === 'wall'} 
                              value={formatFeetInches(selectedObject.h)} 
                              onChange={(e) => updateObject(selectedObject.id, { h: parseFeetInches(e.target.value) })} 
                              className="h-9 font-mono" 
                            />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <Label className="text-[10px] text-slate-500 uppercase font-bold">Rotation</Label>
                            <Input type="number" value={selectedObject.rotation} onChange={(e) => updateObject(selectedObject.id, { rotation: parseInt(e.target.value) || 0 })} className="h-9 w-20 text-center font-mono" />
                          </div>
                          <Slider value={[selectedObject.rotation]} max={360} min={0} step={1} onValueChange={(val) => updateObject(selectedObject.id, { rotation: val[0] })} />
                        </div>

                        <div className="space-y-4 pt-4">
                          <Label className="text-[10px] text-slate-400 uppercase font-bold text-center block tracking-widest">Nudge Position</Label>
                          <div className="grid grid-cols-3 gap-2 w-36 mx-auto">
                            <div />
                            <Button size="icon" variant="outline" className="h-10 w-10 hover:bg-blue-600 hover:text-white" onClick={() => nudgeObject(selectedObject.id, 0, -0.5)}><ArrowUp className="w-4 h-4"/></Button>
                            <div />
                            <Button size="icon" variant="outline" className="h-10 w-10 hover:bg-blue-600 hover:text-white" onClick={() => nudgeObject(selectedObject.id, -0.5, 0)}><ArrowLeft className="w-4 h-4"/></Button>
                            <Button size="icon" variant="outline" className="h-10 w-10 hover:bg-blue-600 hover:text-white" onClick={() => nudgeObject(selectedObject.id, 0, 0.5)}><ArrowDown className="w-4 h-4"/></Button>
                            <Button size="icon" variant="outline" className="h-10 w-10 hover:bg-blue-600 hover:text-white" onClick={() => nudgeObject(selectedObject.id, 0.5, 0)}><ArrowRight className="w-4 h-4"/></Button>
                          </div>
                        </div>

                        <Separator />
                        <Button variant="destructive" className="w-full text-xs font-bold py-5" onClick={() => deleteObject(selectedObject.id)}><Trash2 className="w-4 h-4 mr-2"/> DELETE OBJECT</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="h-96 flex flex-col items-center justify-center p-8 text-center text-slate-300">
                      <MousePointer2 className="w-16 h-16 mb-6 opacity-10 animate-pulse" />
                      <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">Select an object <br/> to edit properties</p>
                    </div>
                  )}
                  <ScrollBar orientation="vertical" />
                </ScrollArea>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="structural" className="p-6 bg-white overflow-auto h-full">
            <Form {...structuralForm}>
              <form onSubmit={structuralForm.handleSubmit(calculateStructural)} className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
                <div className="space-y-4">
                  <div className="flex gap-4 p-3 bg-slate-50 rounded-lg border">
                    <FormField control={structuralForm.control} name="includeBase" render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>বেস</FormLabel></FormItem>)} />
                    <FormField control={structuralForm.control} name="includeColumn" render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>কলাম</FormLabel></FormItem>)} />
                    <FormField control={structuralForm.control} name="includeBeam" render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>বিম</FormLabel></FormItem>)} />
                  </div>
                  {includeBase && (
                    <div className="p-4 border rounded-xl space-y-3 bg-white shadow-sm">
                      <p className="text-xs font-bold text-slate-500 uppercase">বেস / ভিত্তি</p>
                      <div className="grid grid-cols-2 gap-2">
                        <FormField control={structuralForm.control} name="baseCount" render={({ field }) => (<FormItem><FormLabel className="text-[10px]">সংখ্যা</FormLabel><Input type="number" {...field} /></FormItem>)} />
                        <FormField control={structuralForm.control} name="baseThicknessIn" render={({ field }) => (<FormItem><FormLabel className="text-[10px]">পুরুত্ব (ইঞ্চি)</FormLabel><Input type="number" {...field} /></FormItem>)} />
                        <FormField control={structuralForm.control} name="baseLengthFt" render={({ field }) => (<FormItem><FormLabel className="text-[10px]">দৈর্ঘ্য (ফুট)</FormLabel><Input type="number" {...field} /></FormItem>)} />
                        <FormField control={structuralForm.control} name="baseWidthFt" render={({ field }) => (<FormItem><FormLabel className="text-[10px]">প্রস্থ (ফুট)</FormLabel><Input type="number" {...field} /></FormItem>)} />
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <Button type="submit" className="w-full h-12 text-lg">হিসাব করুন</Button>
                </div>
                <div>
                  {structuralResults && (
                    <div className="bg-blue-50 p-6 rounded-2xl border-2 border-blue-200 space-y-4 shadow-inner">
                      <ResultItem label="সিমেন্ট" value={structuralResults.cement} unit="ব্যাগ" />
                      <ResultItem label="বালু" value={structuralResults.sand.toFixed(1)} unit="CFT" />
                      <ResultItem label="খোয়া" value={structuralResults.chips.toFixed(1)} unit="CFT" />
                      <ResultItem label="মোট রড" value={structuralResults.totalRodWeight.toFixed(1)} unit="কেজি" highlight />
                    </div>
                  )}
                </div>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

function ToolIconButton({ icon, label, dropdown }: { icon: React.ReactNode, label?: string, dropdown?: boolean }) {
  return (
    <Button variant="ghost" className="h-10 px-2 flex flex-col items-center justify-center gap-0.5 hover:bg-slate-100 transition-colors">
      <div className="flex items-center gap-1">
        {React.cloneElement(icon as React.ReactElement, { className: "w-4 h-4 text-slate-600" })}
        {dropdown && <ChevronDown className="w-3 h-3 text-slate-400" />}
      </div>
      {label && <span className="text-[9px] font-bold text-slate-500 leading-none">{label}</span>}
    </Button>
  );
}

function SymbolBox({ icon, onClick }: { icon: React.ReactNode, onClick: () => void }) {
  return (
    <div 
      className="aspect-square border border-slate-200 rounded-md flex items-center justify-center hover:bg-blue-50 hover:border-blue-400 cursor-pointer transition-all shadow-sm bg-white" 
      onClick={onClick}
    >
      {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5 text-slate-400" })}
    </div>
  );
}

function ResultItem({ label, value, unit, highlight }: { label: string, value: string | number, unit: string, highlight?: boolean }) {
  return (
    <div className={cn("flex justify-between items-center", highlight && "text-blue-800")}>
      <span className="text-sm font-medium text-slate-600">{label}:</span>
      <span className={cn("text-2xl font-black", highlight && "text-3xl")}>{value} <span className="text-sm font-normal text-muted-foreground">{unit}</span></span>
    </div>
  );
}
