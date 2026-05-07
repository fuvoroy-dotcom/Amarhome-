
"use client";

import React, { useState, useRef, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Building, Cog, BarChartBig, Layers, Paintbrush, ClipboardList, Trash2, 
  RectangleHorizontal, Grid, List, ArrowRightLeft, Palette, 
  Eraser, Square, DoorClosed, LayoutGrid, RotateCcw, Plus, 
  Maximize, Bed, Armchair, Bath, Utensils, Tv, Coffee, MousePointer2, X,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Settings2, RefreshCw
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

// --- Types for Calculators (v61e7980 logic - strictly preserved) ---
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
  type: 'structure' | 'opening' | 'furniture' | 'utility';
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

  // --- Conversion States ---
  const [cftToBrickInput, setCftToBrickInput] = useState<string>("");
  const [cftToBrickResult, setCftToBrickResult] = useState<number | null>(null);
  const [rodLengthInput, setRodLengthInput] = useState<string>("");
  const [rodConversionFactor, setRodConversionFactor] = useState<number>(0.48);
  const [rodWeightResult, setRodWeightResult] = useState<number | null>(null);

  // --- Design State ---
  const [designObjects, setDesignObjects] = useState<DesignObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [interactionMode, setInteractionMode] = useState<'none' | 'dragging' | 'resizing' | 'rotating'>('none');
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(30); // 1ft = 30px
  const [snapPoint, setSnapPoint] = useState<{x: number, y: number} | null>(null);
  
  const selectedObject = designObjects.find(obj => obj.id === selectedObjectId);

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
    let w = 8, h = 8;
    if (subType === 'wall') { w = 10; h = 0.5; }
    else if (type === 'opening') { w = 3; h = 0.5; }
    else if (type === 'furniture') { w = 4; h = 6; }
    
    const newObj: DesignObject = {
      id: Math.random().toString(36).substr(2, 9),
      type, subType, x: 10, y: 10, w, h,
      label, color: type === 'structure' ? '#ffffff' : type === 'opening' ? '#64748b' : '#e2e8f0', rotation: 0
    };
    setDesignObjects([...designObjects, newObj]);
    setSelectedObjectId(newObj.id);
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
      let nextX = currentX - dragOffset.x;
      let nextY = currentY - dragOffset.y;
      
      // Professional Magnetic Snap Logic
      const snapThreshold = 0.8; 
      let activeSnap: {x: number, y: number} | null = null;

      // Corners of moving object
      const corners = [
        { x: nextX, y: nextY }, // TL
        { x: nextX + currentObj.w, y: nextY }, // TR
        { x: nextX, y: nextY + currentObj.h }, // BL
        { x: nextX + currentObj.w, y: nextY + currentObj.h } // BR
      ];

      designObjects.forEach(other => {
        if (other.id === selectedObjectId) return;
        
        // Corners of static objects
        const otherCorners = [
          { x: other.x, y: other.y }, // TL
          { x: other.x + other.w, y: other.y }, // TR
          { x: other.x, y: other.y + other.h }, // BL
          { x: other.x + other.w, y: other.y + other.h } // BR
        ];

        // Check each corner against all corners of other objects
        corners.forEach((cc, ci) => {
          otherCorners.forEach(oc => {
            const dist = Math.sqrt(Math.pow(cc.x - oc.x, 2) + Math.pow(cc.y - oc.y, 2));
            if (dist < snapThreshold) {
              if (ci === 0) { nextX = oc.x; nextY = oc.y; }
              else if (ci === 1) { nextX = oc.x - currentObj.w; nextY = oc.y; }
              else if (ci === 2) { nextX = oc.x; nextY = oc.y - currentObj.h; }
              else if (ci === 3) { nextX = oc.x - currentObj.w; nextY = oc.y - currentObj.h; }
              activeSnap = { x: oc.x, y: oc.y };
            }
          });
        });

        // Edge Aligment Snapping
        if (!activeSnap) {
          if (Math.abs(nextX - other.x) < snapThreshold) nextX = other.x;
          if (Math.abs(nextX + currentObj.w - (other.x + other.w)) < snapThreshold) nextX = other.x + other.w - currentObj.w;
          if (Math.abs(nextY - other.y) < snapThreshold) nextY = other.y;
          if (Math.abs(nextY + currentObj.h - (other.y + other.h)) < snapThreshold) nextY = other.y + other.h - currentObj.h;
        }
      });

      if (!activeSnap) {
        // Precise Grid Snap when not magnetically snapped
        nextX = Math.round(nextX * 2) / 2;
        nextY = Math.round(nextY * 2) / 2;
      }

      setSnapPoint(activeSnap);
      setDesignObjects(objs => objs.map(o => o.id === selectedObjectId ? { ...o, x: Math.max(0, nextX), y: Math.max(0, nextY) } : o));
    } else if (interactionMode === 'resizing') {
      const nextW = Math.max(0.2, Math.round((currentX - currentObj.x) * 2) / 2);
      const nextH = Math.max(0.2, Math.round((currentY - currentObj.y) * 2) / 2);
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
    setDesignObjects(objs => objs.map(o => o.id === id ? { ...o, x: o.x + dx, y: o.y + dy } : o));
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto p-0 md:p-2 bg-slate-50 min-h-screen">
      <Card className="shadow-2xl border-none overflow-hidden rounded-xl bg-white">
        <div className="bg-[#0f172a] p-3 text-white text-center">
          <h1 className="text-xl font-bold flex items-center justify-center gap-2">
             <Building className="w-5 h-5 text-blue-400" /> আমার বাড়ি এস্টিমেটর ও স্মার্ট-ডিজাইন
          </h1>
        </div>

        <Tabs defaultValue="structural" className="w-full">
          <TabsList className="grid grid-cols-3 md:grid-cols-9 h-auto bg-slate-100 rounded-none border-b sticky top-0 z-50">
            <TabsTrigger value="structural" className="py-2 text-[11px]">স্ট্রাকচার</TabsTrigger>
            <TabsTrigger value="slab" className="py-2 text-[11px]">ছাদ</TabsTrigger>
            <TabsTrigger value="stair" className="py-2 text-[11px]">সিঁড়ি</TabsTrigger>
            <TabsTrigger value="brick" className="py-2 text-[11px]">গাঁথুনি</TabsTrigger>
            <TabsTrigger value="plaster" className="py-2 text-[11px]">প্লাস্টার</TabsTrigger>
            <TabsTrigger value="tile" className="py-2 text-[11px]">টাইলস</TabsTrigger>
            <TabsTrigger value="fullHouse" className="py-2 text-[11px]">পূর্ণ বাড়ি</TabsTrigger>
            <TabsTrigger value="conversion" className="py-2 text-[11px]">রূপান্তর</TabsTrigger>
            <TabsTrigger value="design" className="py-2 text-[11px] bg-blue-600 text-white data-[state=active]:bg-blue-700 font-bold">ডিজাইন টুল</TabsTrigger>
          </TabsList>

          {/* --- Calculator Tabs (v61e7980 logic - strictly preserved) --- */}
          <TabsContent value="structural" className="p-6">
            <Form {...structuralForm}>
              <form onSubmit={structuralForm.handleSubmit(calculateStructural)} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <div className="flex gap-4 p-3 bg-slate-50 rounded-lg border">
                    <FormField control={structuralForm.control} name="includeBase" render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>বেস</FormLabel></FormItem>)} />
                    <FormField control={structuralForm.control} name="includeColumn" render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>কলাম</FormLabel></FormItem>)} />
                    <FormField control={structuralForm.control} name="includeBeam" render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>বিম</FormLabel></FormItem>)} />
                  </div>
                  {includeBase && (
                    <div className="p-4 border rounded-xl space-y-3 bg-white">
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
                  {includeColumn && (
                    <div className="p-4 border rounded-xl space-y-3 bg-white">
                      <p className="text-xs font-bold text-slate-500 uppercase">কলাম</p>
                      <div className="grid grid-cols-2 gap-2">
                        <FormField control={structuralForm.control} name="columnCount" render={({ field }) => (<FormItem><FormLabel className="text-[10px]">সংখ্যা</FormLabel><Input type="number" {...field} /></FormItem>)} />
                        <FormField control={structuralForm.control} name="columnHeightFt" render={({ field }) => (<FormItem><FormLabel className="text-[10px]">উচ্চতা (ফুট)</FormLabel><Input type="number" {...field} /></FormItem>)} />
                      </div>
                    </div>
                  )}
                  <Button type="submit" className="w-full">হিসাব করুন</Button>
                </div>
                <div>
                  {structuralResults && (
                    <div className="bg-blue-50 p-6 rounded-2xl border-2 border-blue-200 space-y-4">
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

          <TabsContent value="slab" className="p-6">
            <Form {...slabForm}><form onSubmit={slabForm.handleSubmit(calculateSlab)} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                {slabFields.map((field, index) => (
                  <div key={field.id} className="flex gap-2 items-end bg-white p-4 border rounded-xl">
                    <FormField control={slabForm.control} name={`slabs.${index}.length`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>দৈর্ঘ্য (ফুট)</FormLabel><Input type="number" {...field}/></FormItem>)}/>
                    <FormField control={slabForm.control} name={`slabs.${index}.width`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>প্রস্থ (ফুট)</FormLabel><Input type="number" {...field}/></FormItem>)}/>
                    <Button type="button" variant="ghost" onClick={() => removeSlab(index)}><Trash2 className="w-4 h-4"/></Button>
                  </div>
                ))}
                <Button type="button" variant="outline" className="w-full" onClick={() => appendSlab({ length: 10, width: 10 })}>+ অংশ যোগ করুন</Button>
                <Button type="submit" className="w-full">হিসাব করুন</Button>
              </div>
              <div>{slabResults && <div className="bg-blue-50 p-6 rounded-xl space-y-4"><ResultItem label="সিমেন্ট" value={slabResults.cement} unit="ব্যাগ" /><ResultItem label="বালু" value={slabResults.sand} unit="CFT" /><ResultItem label="মোট রড" value={slabResults.rodWeight} unit="কেজি" highlight /></div>}</div>
            </form></Form>
          </TabsContent>

          <TabsContent value="stair" className="p-6">
             <Form {...stairForm}><form onSubmit={stairForm.handleSubmit(calculateStair)} className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-4"><FormField control={stairForm.control} name="flightCount" render={({field})=>(<FormItem><FormLabel>ফ্লাইট সংখ্যা</FormLabel><Input type="number" {...field}/></FormItem>)}/><Button type="submit" className="w-full">হিসাব করুন</Button></div>
               <div>{stairResults && <div className="p-6 bg-blue-50 rounded-xl"><ResultItem label="সিমেন্ট" value={stairResults.cement} unit="ব্যাগ"/><ResultItem label="রড" value={stairResults.totalRodWeight} unit="কেজি" highlight/></div>}</div>
             </form></Form>
          </TabsContent>

          <TabsContent value="brick" className="p-6">
            <Form {...brickForm}><form onSubmit={brickForm.handleSubmit(calculateBricks)} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 border rounded-xl space-y-4">
                  <FormField control={brickForm.control} name="calculationType" render={({ field }) => (<FormItem><FormLabel>হিসাবের ধরন</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="wall">দেয়াল ভিত্তিক</SelectItem><SelectItem value="rooms">রুম ভিত্তিক</SelectItem></SelectContent></Select></FormItem>)} />
                  <FormField control={brickForm.control} name="wallHeightFt" render={({ field }) => (<FormItem><FormLabel>দেয়ালের উচ্চতা (ফুট)</FormLabel><Input type="number" {...field} /></FormItem>)} />
                  <FormField control={brickForm.control} name="wallThicknessIn" render={({ field }) => (<FormItem><FormLabel>পুরুত্ব (ইঞ্চি)</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="5">৫ ইঞ্চি</SelectItem><SelectItem value="10">১০ ইঞ্চি</SelectItem></SelectContent></Select></FormItem>)} />
                </div>
                <Button type="submit" className="w-full">হিসাব করুন</Button>
              </div>
              <div>{brickResults && <div className="p-6 bg-blue-50 rounded-xl space-y-4"><ResultItem label="ইট" value={brickResults.bricks} unit="টি" highlight/><ResultItem label="সিমেন্ট" value={brickResults.cement} unit="ব্যাগ"/><ResultItem label="বালু" value={brickResults.sand} unit="CFT"/></div>}</div>
            </form></Form>
          </TabsContent>

          <TabsContent value="fullHouse" className="p-6">
             <Form {...fullHouseForm}><form onSubmit={fullHouseForm.handleSubmit(calculateFullHouse)} className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-4">
                 <FormField control={fullHouseForm.control} name="totalAreaSqFt" render={({field})=>(<FormItem><FormLabel>মোট এরিয়া (বর্গফুট)</FormLabel><Input type="number" {...field}/></FormItem>)}/>
                 <FormField control={fullHouseForm.control} name="floorCount" render={({field})=>(<FormItem><FormLabel>ফ্লোর সংখ্যা</FormLabel><Input type="number" {...field}/></FormItem>)}/>
                 <Button type="submit" className="w-full">হিসাব করুন</Button>
               </div>
               <div>{fullHouseResults && <div className="p-6 bg-blue-50 rounded-xl space-y-4"><ResultItem label="মোট সিমেন্ট" value={fullHouseResults.totalCement} unit="ব্যাগ"/><ResultItem label="মোট ইট" value={fullHouseResults.totalBricks} unit="টি" highlight/><ResultItem label="মোট রড" value={fullHouseResults.totalRodWeight} unit="কেজি" highlight/></div>}</div>
             </form></Form>
          </TabsContent>

          <TabsContent value="conversion" className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6 space-y-4">
                <h3 className="font-bold flex items-center gap-2"><Layers className="w-4 h-4"/> CFT থেকে ইট</h3>
                <Input type="number" placeholder="CFT এর মান" value={cftToBrickInput} onChange={(e)=>setCftToBrickInput(e.target.value)}/>
                <Button className="w-full" onClick={()=>setCftToBrickResult(Math.ceil(parseFloat(cftToBrickInput)*12))}>হিসাব করুন</Button>
                {cftToBrickResult && <div className="p-3 bg-blue-50 border rounded-lg text-center font-bold">{cftToBrickResult} টি ইট</div>}
              </Card>
              <Card className="p-6 space-y-4">
                <h3 className="font-bold flex items-center gap-2"><Cog className="w-4 h-4"/> রড ওজন</h3>
                <Input type="number" placeholder="রডের দৈর্ঘ্য (ফুট)" value={rodLengthInput} onChange={(e)=>setRodLengthInput(e.target.value)}/>
                <Select onValueChange={(v)=>setRodConversionFactor(parseFloat(v))}>
                  <SelectTrigger><SelectValue placeholder="রডের সাইজ" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.12">8 mm</SelectItem><SelectItem value="0.19">10 mm</SelectItem><SelectItem value="0.30">12 mm</SelectItem><SelectItem value="0.48">16 mm</SelectItem><SelectItem value="0.75">20 mm</SelectItem>
                  </SelectContent>
                </Select>
                <Button className="w-full" onClick={()=>setRodWeightResult(parseFloat(rodLengthInput)*rodConversionFactor)}>হিসাব করুন</Button>
                {rodWeightResult && <div className="p-3 bg-blue-50 border rounded-lg text-center font-bold">{rodWeightResult.toFixed(2)} কেজি</div>}
              </Card>
            </div>
          </TabsContent>

          {/* --- Professional SmartDraw Design Workspace --- */}
          <TabsContent value="design" className="p-0 m-0 bg-[#f1f5f9] relative h-[calc(100vh-200px)] min-h-[650px] overflow-hidden">
            <div className="flex h-full w-full">
              {/* Library Sidebar */}
              <div className="w-64 bg-white border-r flex flex-col z-20 shadow-xl shrink-0">
                <div className="p-4 border-b bg-slate-50 flex items-center gap-2 font-bold text-sm">
                  <LayoutGrid className="w-4 h-4 text-blue-600"/> লাইব্রেরি
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-6">
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">কাঠামো</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <LibItem icon={<Square />} label="রুম" onClick={() => addObject('structure', 'room', 'রুম')} />
                        <LibItem icon={<Maximize />} label="দেয়াল" onClick={() => addObject('structure', 'wall', 'দেয়াল')} />
                        <LibItem icon={<DoorClosed />} label="দরজা" onClick={() => addObject('opening', 'door', 'দরজা')} />
                        <LibItem icon={<Grid />} label="জানালা" onClick={() => addObject('opening', 'window', 'জানালা')} />
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">আসবাবপত্র</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <LibItem icon={<Bed />} label="বিছানা" onClick={() => addObject('furniture', 'bed', 'বিছানা')} />
                        <LibItem icon={<Armchair />} label="সোফা" onClick={() => addObject('furniture', 'sofa', 'সোফা')} />
                        <LibItem icon={<Utensils />} label="কিচেন" onClick={() => addObject('furniture', 'kitchen', 'কিচেন')} />
                        <LibItem icon={<Bath />} label="বাথরুম" onClick={() => addObject('furniture', 'bath', 'বাথরুম')} />
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </div>

              {/* Main Workspace with Rulers & Grid */}
              <div className="flex-1 relative flex flex-col overflow-hidden bg-[#e2e8f0]">
                {/* Horizontal Ruler */}
                <div className="h-8 bg-white border-b flex items-end relative overflow-hidden z-10 select-none">
                  <div className="flex absolute left-8 h-full items-end" style={{ width: 5000 }}>
                    {Array.from({ length: 150 }).map((_, i) => (
                      <div key={i} className="border-l border-slate-300 h-2 flex flex-col justify-end text-[8px] text-slate-400 font-mono" style={{ width: zoom, minWidth: zoom }}>
                        <span className="pl-1 pb-1">{i}ft</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-1 overflow-hidden relative">
                  {/* Vertical Ruler */}
                  <div className="w-8 bg-white border-r flex flex-col items-end relative overflow-hidden z-10 select-none">
                    <div className="flex flex-col absolute top-0 w-full items-end" style={{ height: 5000 }}>
                      {Array.from({ length: 150 }).map((_, i) => (
                        <div key={i} className="border-t border-slate-300 w-2 flex items-center justify-end text-[8px] text-slate-400 font-mono" style={{ height: zoom, minHeight: zoom }}>
                          <span className="pr-1 rotate-90">{i}ft</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Scrollable Canvas Workspace */}
                  <div 
                    id="canvas-workspace"
                    className="flex-1 relative bg-[#e2e8f0] overflow-auto cursor-crosshair focus:outline-none"
                    onMouseMove={handleMouseMove}
                    onMouseUp={() => { setInteractionMode('none'); setSnapPoint(null); }}
                    onClick={() => { if (interactionMode === 'none') setSelectedObjectId(null); }}
                  >
                    {/* Magnetic Snap Point Indicator */}
                    {snapPoint && (
                      <div 
                        className="absolute w-6 h-6 bg-blue-500 rounded-full z-50 animate-pulse border-2 border-white shadow-lg pointer-events-none"
                        style={{ left: snapPoint.x * zoom - 12, top: snapPoint.y * zoom - 12 }}
                      />
                    )}

                    <div 
                      className="absolute inset-0"
                      style={{ 
                        backgroundImage: `linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)`,
                        backgroundSize: `${zoom}px ${zoom}px`,
                        width: 5000, height: 5000
                      }}
                    >
                      {designObjects.map(obj => (
                        <div
                          key={obj.id}
                          onMouseDown={(e) => handleMouseDown(e, obj.id, 'dragging')}
                          onClick={(e) => e.stopPropagation()} 
                          className={cn(
                            "absolute flex items-center justify-center border-2 transition-all cursor-move select-none",
                            selectedObjectId === obj.id 
                              ? "border-blue-600 ring-4 ring-blue-600/20 z-30 bg-white/50 shadow-2xl scale-[1.01]" 
                              : "border-slate-400 z-10 bg-white/90"
                          )}
                          style={{
                            left: obj.x * zoom,
                            top: obj.y * zoom,
                            width: obj.w * zoom,
                            height: obj.h * zoom,
                            transform: `rotate(${obj.rotation}deg)`,
                          }}
                        >
                          <div className="flex flex-col items-center justify-center p-1 text-center pointer-events-none overflow-hidden">
                            <span className="text-[10px] font-bold text-slate-800 truncate w-full">{obj.label}</span>
                            <span className="text-[8px] font-mono text-slate-500">{obj.w}' × {obj.h}'</span>
                          </div>
                          
                          {/* Professional Resize & Rotate UI */}
                          {selectedObjectId === obj.id && (
                            <>
                              {/* Rotate Handle */}
                              <div 
                                className="absolute -top-12 left-1/2 -translate-x-1/2 w-8 h-8 bg-blue-600 rounded-full border-2 border-white shadow-xl flex items-center justify-center cursor-pointer hover:bg-blue-700 z-40"
                                onMouseDown={(e) => handleMouseDown(e, obj.id, 'rotating')}
                              >
                                <RefreshCw className="w-4 h-4 text-white" />
                              </div>
                              <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-blue-600" />

                              {/* Resizing Handles */}
                              <div 
                                className="absolute -bottom-2 -right-2 w-6 h-6 bg-blue-600 rounded-sm cursor-se-resize z-40 border-2 border-white shadow-lg"
                                onMouseDown={(e) => handleMouseDown(e, obj.id, 'resizing')}
                              />
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                    {/* Fixed Bottom Horizontal Scrollbar placeholder for usability */}
                    <div className="sticky bottom-0 left-0 w-full h-4 bg-slate-200/50 backdrop-blur-sm z-40 pointer-events-none" />
                  </div>
                </div>

                {/* Bottom Zoom Controls */}
                <div className="absolute bottom-6 left-12 z-30 flex gap-2">
                  <div className="bg-white p-1 rounded-lg shadow-xl border flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.min(150, z + 5))}><Plus className="w-4 h-4"/></Button>
                    <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.max(10, z - 5))}><RotateCcw className="w-4 h-4 rotate-180"/></Button>
                  </div>
                  <Button variant="destructive" size="sm" onClick={() => { if(confirm('সব ডিলিট করবেন?')) setDesignObjects([])}}><Eraser className="w-4 h-4 mr-2"/> ক্যানভাস পরিষ্কার</Button>
                </div>
              </div>

              {/* FIXED PROPERTY SIDEBAR (RIGHT) */}
              <div className="w-72 bg-white border-l flex flex-col z-20 shadow-2xl shrink-0">
                <div className="p-4 border-b bg-slate-50 flex items-center gap-2 font-bold text-sm">
                  <Settings2 className="w-4 h-4 text-blue-600"/> এডিট প্যানেল
                </div>
                <ScrollArea className="flex-1">
                  {selectedObject ? (
                    <div className="p-4 space-y-6">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">{selectedObject.label} এডিট</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedObjectId(null)}><X className="w-3 h-3"/></Button>
                        </div>
                        <Separator />
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] text-slate-500 uppercase font-bold">দৈর্ঘ্য (ফুট)</Label>
                            <Input type="number" step="0.5" value={selectedObject.w} onChange={(e) => updateObject(selectedObject.id, { w: parseFloat(e.target.value) || 0.5 })} className="h-9 font-mono border-blue-100 focus:border-blue-500" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] text-slate-500 uppercase font-bold">প্রস্থ (ফুট)</Label>
                            <Input type="number" step="0.5" value={selectedObject.h} onChange={(e) => updateObject(selectedObject.id, { h: parseFloat(e.target.value) || 0.5 })} className="h-9 font-mono border-blue-100 focus:border-blue-500" />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <Label className="text-[10px] text-slate-500 uppercase font-bold">রোটেশন (ডিগ্রি)</Label>
                            <Input type="number" value={selectedObject.rotation} onChange={(e) => updateObject(selectedObject.id, { rotation: parseInt(e.target.value) || 0 })} className="h-9 w-20 text-center font-mono border-blue-100 focus:border-blue-500" />
                          </div>
                          <Slider value={[selectedObject.rotation]} max={360} step={1} onValueChange={(val) => updateObject(selectedObject.id, { rotation: val[0] })} />
                        </div>

                        <div className="space-y-4 pt-4">
                          <Label className="text-[10px] text-slate-400 uppercase font-bold text-center block tracking-widest">অবস্থান পরিবর্তন</Label>
                          <div className="grid grid-cols-3 gap-2 w-36 mx-auto">
                            <div />
                            <Button size="icon" variant="outline" className="h-10 w-10 hover:bg-blue-600 hover:text-white transition-colors" onClick={() => nudgeObject(selectedObject.id, 0, -0.5)}><ArrowUp className="w-4 h-4"/></Button>
                            <div />
                            <Button size="icon" variant="outline" className="h-10 w-10 hover:bg-blue-600 hover:text-white transition-colors" onClick={() => nudgeObject(selectedObject.id, -0.5, 0)}><ArrowLeft className="w-4 h-4"/></Button>
                            <Button size="icon" variant="outline" className="h-10 w-10 hover:bg-blue-600 hover:text-white transition-colors" onClick={() => nudgeObject(selectedObject.id, 0, 0.5)}><ArrowDown className="w-4 h-4"/></Button>
                            <Button size="icon" variant="outline" className="h-10 w-10 hover:bg-blue-600 hover:text-white transition-colors" onClick={() => nudgeObject(selectedObject.id, 0.5, 0)}><ArrowRight className="w-4 h-4"/></Button>
                          </div>
                        </div>

                        <Separator />
                        <Button variant="destructive" className="w-full text-xs font-bold py-5" onClick={() => deleteObject(selectedObject.id)}><Trash2 className="w-4 h-4 mr-2"/> অবজেক্ট ডিলিট</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="h-96 flex flex-col items-center justify-center p-8 text-center text-slate-300">
                      <MousePointer2 className="w-16 h-16 mb-6 opacity-10 animate-bounce" />
                      <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">একটি অবজেক্ট সিলেক্ট করুন <br/> এডিট করার জন্য</p>
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

function LibItem({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <Button 
      variant="outline" 
      className="flex flex-col h-16 w-full gap-1 p-2 hover:bg-blue-50 hover:border-blue-400 group transition-all" 
      onClick={onClick}
    >
      <div className="text-slate-400 group-hover:text-blue-600 scale-90">
        {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5" })}
      </div>
      <span className="text-[10px] font-bold text-slate-600">{label}</span>
    </Button>
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
