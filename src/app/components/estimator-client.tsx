
"use client";

import React, { useState, useRef, useEffect } from "react";
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
    let w = 10, h = 0.5;
    if (subType === 'room') { w = 10; h = 10; }
    else if (subType === 'wall') { w = 10; h = 0.05; } // Very thin for a single line wall
    else if (type === 'opening') { w = 3; h = 0.1; }
    else if (type === 'furniture') { w = 4; h = 6; }
    
    const newObj: DesignObject = {
      id: Math.random().toString(36).substr(2, 9),
      type, subType, x: 10, y: 10, w, h,
      label, color: subType === 'wall' ? '#000000' : '#ffffff', rotation: 0
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
      
      const snapThreshold = 0.8; 
      let activeSnap: {x: number, y: number} | null = null;

      const corners = [
        { x: nextX, y: nextY }, // TL
        { x: nextX + currentObj.w, y: nextY }, // TR
        { x: nextX, y: nextY + currentObj.h }, // BL
        { x: nextX + currentObj.w, y: nextY + currentObj.h } // BR
      ];

      designObjects.forEach(other => {
        if (other.id === selectedObjectId) return;
        const otherCorners = [
          { x: other.x, y: other.y }, { x: other.x + other.w, y: other.y },
          { x: other.x, y: other.y + other.h }, { x: other.x + other.w, y: other.y + other.h }
        ];

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
      });

      if (!activeSnap) {
        nextX = Math.round(nextX * 2) / 2;
        nextY = Math.round(nextY * 2) / 2;
      }

      setSnapPoint(activeSnap);
      setDesignObjects(objs => objs.map(o => o.id === selectedObjectId ? { ...o, x: Math.max(0, nextX), y: Math.max(0, nextY) } : o));
    } else if (interactionMode === 'resizing') {
      const nextW = Math.max(0.1, Math.round((currentX - currentObj.x) * 2) / 2);
      const nextH = Math.max(0.05, Math.round((currentY - currentObj.y) * 2) / 2);
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
        {/* Header Ribbon */}
        <div className="bg-[#0f172a] p-2 text-white text-center shrink-0">
          <h1 className="text-sm font-bold flex items-center justify-center gap-2">
             <Building className="w-4 h-4 text-blue-400" /> আমার বাড়ি এস্টিমেটর ও প্রফেশনাল ডিজাইন টুল
          </h1>
        </div>

        <Tabs defaultValue="design" className="w-full flex-1 flex flex-col overflow-hidden">
          <div className="w-full bg-slate-100 border-b overflow-hidden">
            <ScrollArea className="w-full">
              <div className="flex h-auto bg-transparent rounded-none border-none px-4 justify-start min-w-max p-1">
                <TabsList className="flex h-auto bg-transparent rounded-none border-none justify-start p-0">
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

          {/* Calculator Contents (v61e7980 logic) */}
          <TabsContent value="structural" className="p-6 bg-white overflow-auto">
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
                  {includeColumn && (
                    <div className="p-4 border rounded-xl space-y-3 bg-white shadow-sm">
                      <p className="text-xs font-bold text-slate-500 uppercase">কলাম</p>
                      <div className="grid grid-cols-2 gap-2">
                        <FormField control={structuralForm.control} name="columnCount" render={({ field }) => (<FormItem><FormLabel className="text-[10px]">সংখ্যা</FormLabel><Input type="number" {...field} /></FormItem>)} />
                        <FormField control={structuralForm.control} name="columnHeightFt" render={({ field }) => (<FormItem><FormLabel className="text-[10px]">উচ্চতা (ফুট)</FormLabel><Input type="number" {...field} /></FormItem>)} />
                      </div>
                    </div>
                  )}
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

          {/* --- SMARTDRAW DESIGN WORKSPACE --- */}
          <TabsContent value="design" className="p-0 m-0 bg-[#f8f9fa] flex flex-col flex-1 overflow-hidden">
            {/* 1. Top Toolbar (Professional Interface) */}
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
                    <Select defaultValue="10"><SelectTrigger className="h-7 w-14 text-[11px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="8">8</SelectItem><SelectItem value="10">10</SelectItem><SelectItem value="12">12</SelectItem></SelectContent></Select>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 border-r pr-4">
                <ToolIconButton icon={<Shapes />} label="Styles" />
                <ToolIconButton icon={<Palette />} label="Themes" />
                <ToolIconButton icon={<Highlighter />} label="Fill" />
                <ToolIconButton icon={<Minus />} label="Line Style" />
              </div>
              <div className="flex items-center gap-1">
                <ToolIconButton icon={<Group />} label="Group" />
                <ToolIconButton icon={<RotateCcw />} label="Rotate" dropdown />
                <ToolIconButton icon={<BringToFront />} />
                <ToolIconButton icon={<SendToBack />} />
              </div>
            </div>

            {/* Main Editor Layout */}
            <div className="flex-1 flex overflow-hidden">
              {/* 2. Left Sidebar (Tool Accordion) */}
              <div className="w-64 bg-white border-r flex flex-col z-20 shadow-lg shrink-0 overflow-hidden">
                <div className="p-3 border-b bg-slate-50 flex items-center justify-between">
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-600">Tools</span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </div>
                <ScrollArea className="flex-1">
                  <Accordion type="multiple" defaultValue={["tools", "symbols"]} className="w-full">
                    <AccordionItem value="tools" className="border-none">
                      <AccordionTrigger className="px-4 py-2 hover:no-underline text-[12px] font-bold text-slate-700 bg-slate-50/50">Basic Tools</AccordionTrigger>
                      <AccordionContent className="p-4 space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                          <SideToolBtn icon={<MousePointer />} label="Select" active={interactionMode === 'none'} onClick={() => setInteractionMode('none')} />
                          <SideToolBtn icon={<Shapes />} label="Shape" onClick={() => addObject('shape', 'rect', 'আকৃতি')} />
                          <SideToolBtn icon={<Minus />} label="Line" />
                          <SideToolBtn icon={<Type />} label="Text" />
                        </div>
                        <Separator />
                        <div className="space-y-2">
                          <Button variant="outline" className="w-full justify-start text-[11px] h-9 gap-2 bg-amber-50 border-amber-200 text-amber-900 font-bold" onClick={() => addObject('structure', 'wall', 'দেয়াল')}><Maximize className="w-3 h-3"/> Add Wall</Button>
                          <Button variant="ghost" className="w-full justify-start text-[11px] h-8 gap-2" onClick={() => addObject('opening', 'door', 'দরজা')}><DoorClosed className="w-3 h-3"/> Add Wall Opening</Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="symbols" className="border-none">
                      <AccordionTrigger className="px-4 py-2 hover:no-underline text-[12px] font-bold text-slate-700 bg-slate-50/50">Symbols</AccordionTrigger>
                      <AccordionContent className="p-0">
                        <div className="px-4 py-3 flex gap-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                            <Input placeholder="Search symbols..." className="pl-7 h-8 text-[11px]" />
                          </div>
                          <Button size="icon" variant="outline" className="h-8 w-8"><Plus className="w-3 h-3" /></Button>
                        </div>
                        <div className="px-4 pb-4">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-3">Room Outlines</h4>
                          <div className="grid grid-cols-4 gap-2">
                            <SymbolBox icon={<Square />} onClick={() => addObject('structure', 'room', 'রুম')} />
                            <SymbolBox icon={<LayoutGrid />} onClick={() => addObject('structure', 'room', 'এল-রুম')} />
                            <SymbolBox icon={<Shapes />} onClick={() => addObject('structure', 'room', 'টি-রুম')} />
                            <SymbolBox icon={<RectangleHorizontal />} onClick={() => addObject('structure', 'room', 'হল')} />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </ScrollArea>
              </div>

              {/* 3. Central Canvas Area */}
              <div className="flex-1 relative flex flex-col bg-[#e9ecef] overflow-hidden">
                {/* Horizontal Ruler */}
                <div className="h-6 bg-white border-b flex items-end relative overflow-hidden z-10 select-none">
                  <div className="absolute left-6 h-full flex items-end" style={{ width: 10000, marginLeft: 0 }}>
                    {Array.from({ length: 200 }).map((_, i) => (
                      <div key={i} className="border-l border-slate-300 h-2 flex flex-col justify-end text-[8px] text-slate-400 font-mono" style={{ width: zoom, minWidth: zoom }}>
                        <span className="pl-0.5 pb-0.5">{i}ft</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-1 overflow-hidden relative">
                  {/* Vertical Ruler */}
                  <div className="w-6 bg-white border-r flex flex-col items-end relative overflow-hidden z-10 select-none">
                    <div className="absolute top-0 w-full flex flex-col items-end" style={{ height: 10000 }}>
                      {Array.from({ length: 200 }).map((_, i) => (
                        <div key={i} className="border-t border-slate-300 w-2 flex items-center justify-end text-[8px] text-slate-400 font-mono" style={{ height: zoom, minHeight: zoom }}>
                          <span className="pr-0.5 rotate-90">{i}ft</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Canvas Workspace */}
                  <div 
                    id="canvas-workspace"
                    className="flex-1 relative bg-[#e9ecef] overflow-auto focus:outline-none"
                    onMouseMove={handleMouseMove}
                    onMouseUp={() => { setInteractionMode('none'); setSnapPoint(null); }}
                    onClick={() => { if (interactionMode === 'none') setSelectedObjectId(null); }}
                  >
                    {/* Grid Background */}
                    <div 
                      className="absolute inset-0"
                      style={{ 
                        backgroundImage: `linear-gradient(#dee2e6 1px, transparent 1px), linear-gradient(90deg, #dee2e6 1px, transparent 1px)`,
                        backgroundSize: `${zoom}px ${zoom}px`,
                        width: 10000, height: 10000,
                        backgroundColor: 'white'
                      }}
                    >
                      {/* Magnetic Snap Indicator */}
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
                            selectedObjectId === obj.id 
                              ? "z-30 shadow-2xl" 
                              : "z-10"
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
                          {/* Dimension Lines (Professional Look like SmartDraw) */}
                          <div className="absolute -top-8 left-0 right-0 flex flex-col items-center pointer-events-none">
                            <div className="w-full h-[1px] bg-blue-400 relative">
                               <div className="absolute left-0 -top-1 w-[1px] h-2 bg-blue-400" />
                               <div className="absolute right-0 -top-1 w-[1px] h-2 bg-blue-400" />
                            </div>
                            <span className="bg-white px-1 text-[10px] font-mono text-blue-600 -mt-2 z-10">{formatFeetInches(obj.w)}</span>
                          </div>

                          {obj.subType !== 'wall' && (
                             <div className="absolute -right-10 top-0 bottom-0 flex flex-row items-center pointer-events-none">
                                <div className="h-full w-[1px] bg-blue-400 relative">
                                   <div className="absolute top-0 -left-1 h-[1px] w-2 bg-blue-400" />
                                   <div className="absolute bottom-0 -left-1 h-[1px] w-2 bg-blue-400" />
                                </div>
                                <span className="bg-white py-1 text-[10px] font-mono text-blue-600 -ml-5 rotate-90 z-10">{formatFeetInches(obj.h)}</span>
                             </div>
                          )}

                          {obj.subType !== 'wall' && (
                            <div className="flex flex-col items-center justify-center p-1 text-center pointer-events-none overflow-hidden">
                              <span className="text-[10px] font-bold text-slate-800 truncate w-full">{obj.label}</span>
                            </div>
                          )}
                          
                          {/* Resizing & Rotation UI */}
                          {selectedObjectId === obj.id && (
                            <>
                              {/* Rotate Handle */}
                              <div 
                                className="absolute -top-14 left-1/2 -translate-x-1/2 w-8 h-8 bg-white border-2 border-blue-600 rounded-full shadow-lg flex items-center justify-center cursor-pointer hover:bg-blue-50 z-40"
                                onMouseDown={(e) => handleMouseDown(e, obj.id, 'rotating')}
                              >
                                <RefreshCw className="w-4 h-4 text-blue-600" />
                              </div>
                              <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-blue-600" />

                              {/* Corner Resizing Handles */}
                              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-600 rounded-full cursor-se-resize z-40 border-2 border-white shadow-md" onMouseDown={(e) => handleMouseDown(e, obj.id, 'resizing')} />
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4. Bottom Property Bar (Quick Edits) - ACTIVE */}
                <div className="h-12 bg-white border-t flex items-center px-4 gap-6 shrink-0 z-30 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] overflow-x-auto whitespace-nowrap">
                  <div className="flex items-center gap-2 border-r pr-4">
                    <Button variant="ghost" size="sm" className="h-8 text-[11px] gap-2"><Layers className="w-3 h-3"/> Layer-1</Button>
                  </div>
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
                        disabled={!selectedObject}
                        value={selectedObject ? formatFeetInches(selectedObject.h) : ''} 
                        onChange={(e) => selectedObject && updateObject(selectedObject.id, { h: parseFeetInches(e.target.value) })} 
                      />
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setZoom(z => Math.max(10, z - 5))}><Minus className="w-3 h-3"/></Button>
                      <Slider value={[zoom]} max={150} min={10} step={5} className="w-32" onValueChange={(val) => setZoom(val[0])} />
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setZoom(z => Math.min(150, z + 5))}><Plus className="w-3 h-3"/></Button>
                      <span className="text-[11px] font-mono text-slate-500 w-10 text-right">{Math.round((zoom/30)*100)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. Fixed Right Edit Panel (Detailed Controls) */}
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
                            <Label className="text-[10px] text-slate-500 uppercase font-bold">Width (ft)</Label>
                            <Input value={formatFeetInches(selectedObject.w)} onChange={(e) => updateObject(selectedObject.id, { w: parseFeetInches(e.target.value) })} className="h-9 font-mono border-blue-100 focus:border-blue-500 shadow-sm" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] text-slate-500 uppercase font-bold">Height (ft)</Label>
                            <Input value={formatFeetInches(selectedObject.h)} onChange={(e) => updateObject(selectedObject.id, { h: parseFeetInches(e.target.value) })} className="h-9 font-mono border-blue-100 focus:border-blue-500 shadow-sm" />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <Label className="text-[10px] text-slate-500 uppercase font-bold">Rotation (deg)</Label>
                            <Input 
                                type="number" 
                                value={selectedObject.rotation} 
                                onChange={(e) => updateObject(selectedObject.id, { rotation: parseInt(e.target.value) || 0 })} 
                                className="h-9 w-20 text-center font-mono border-blue-100 focus:border-blue-500 shadow-sm" 
                            />
                          </div>
                          <Slider value={[selectedObject.rotation]} max={360} min={0} step={1} onValueChange={(val) => updateObject(selectedObject.id, { rotation: val[0] })} />
                        </div>

                        <div className="space-y-4 pt-4">
                          <Label className="text-[10px] text-slate-400 uppercase font-bold text-center block tracking-widest">Fine Tune Movement</Label>
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
                        <Button variant="destructive" className="w-full text-xs font-bold py-5 shadow-lg" onClick={() => deleteObject(selectedObject.id)}><Trash2 className="w-4 h-4 mr-2"/> DELETE OBJECT</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="h-96 flex flex-col items-center justify-center p-8 text-center text-slate-300">
                      <MousePointer2 className="w-16 h-16 mb-6 opacity-10 animate-pulse" />
                      <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">Select an object <br/> to edit properties</p>
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

// --- Helper UI Components ---

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

function SideToolBtn({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <Button 
      variant={active ? "default" : "outline"} 
      className={cn("flex flex-col h-14 w-full gap-1 p-2 transition-all", active ? "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-300" : "hover:bg-blue-50 hover:border-blue-200")} 
      onClick={onClick}
    >
      {React.cloneElement(icon as React.ReactElement, { className: "w-4 h-4" })}
      <span className="text-[9px] font-bold uppercase tracking-tight">{label}</span>
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
