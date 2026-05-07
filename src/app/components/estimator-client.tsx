"use client";

import React, { useState, useRef, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Building, Cog, BarChartBig, Layers, Paintbrush, ClipboardList, Trash2, 
  RectangleHorizontal, Grid, List, ArrowRightLeft, Palette, 
  Eraser, Square, DoorClosed, LayoutGrid, RotateCcw, Plus, 
  Maximize, Bed, Armchair, Bath, Utensils, Tv, Coffee, MousePointer2, X,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";

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

  // --- Calculator States ---
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
  const [khowaCftToBrickInput, setKhowaCftToBrickInput] = useState<string>("");
  const [khowaCftToBrickResult, setKhowaCftToBrickResult] = useState<number | null>(null);
  const [rodLengthInput, setRodLengthInput] = useState<string>("");
  const [rodConversionFactor, setRodConversionFactor] = useState<number>(0.48);
  const [rodWeightResult, setRodWeightResult] = useState<number | null>(null);

  // --- Design State ---
  const [designObjects, setDesignObjects] = useState<DesignObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [interactionMode, setInteractionMode] = useState<'none' | 'dragging' | 'resizing'>('none');
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

  // --- Calculator Logic (v61e7980 logic) ---
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
      type, subType, x: 5, y: 5, w, h,
      label, color: type === 'structure' ? '#ffffff' : type === 'opening' ? '#64748b' : '#e2e8f0', rotation: 0
    };
    setDesignObjects([...designObjects, newObj]);
    setSelectedObjectId(newObj.id);
  };

  const handleMouseDown = (e: React.MouseEvent, id: string, mode: 'dragging' | 'resizing' = 'dragging') => {
    e.stopPropagation(); 
    setSelectedObjectId(id);
    setInteractionMode(mode);
    const obj = designObjects.find(o => o.id === id);
    if (obj) {
      const rect = document.getElementById('canvas-workspace')?.getBoundingClientRect();
      if (rect) {
        setDragOffset({ x: (e.clientX - rect.left) / zoom - obj.x, y: (e.clientY - rect.top) / zoom - obj.y });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!selectedObjectId || interactionMode === 'none') return;
    
    const canvasRect = document.getElementById('canvas-workspace')?.getBoundingClientRect();
    if (!canvasRect) return;

    const currentX = (e.clientX - canvasRect.left) / zoom;
    const currentY = (e.clientY - canvasRect.top) / zoom;

    if (interactionMode === 'dragging') {
      const newX = Math.round((currentX - dragOffset.x) * 2) / 2;
      const newY = Math.round((currentY - dragOffset.y) * 2) / 2;
      
      // Joint detection for ALL corners
      let activeSnap: {x: number, y: number} | null = null;
      const snapThreshold = 0.7; // feet
      const currentObj = designObjects.find(o=>o.id===selectedObjectId);
      if (!currentObj) return;

      const currentCorners = [
        {x: newX, y: newY},
        {x: newX + currentObj.w, y: newY},
        {x: newX, y: newY + currentObj.h},
        {x: newX + currentObj.w, y: newY + currentObj.h}
      ];

      designObjects.forEach(other => {
        if (other.id === selectedObjectId) return;
        const otherCorners = [
          {x: other.x, y: other.y},
          {x: other.x + other.w, y: other.y},
          {x: other.x, y: other.y + other.h},
          {x: other.x + other.w, y: other.y + other.h}
        ];

        currentCorners.forEach(c => {
          otherCorners.forEach(oc => {
            const dist = Math.sqrt(Math.pow(c.x - oc.x, 2) + Math.pow(c.y - oc.y, 2));
            if (dist < snapThreshold) {
              activeSnap = { x: oc.x, y: oc.y };
            }
          });
        });
      });

      setSnapPoint(activeSnap);
      setDesignObjects(objs => objs.map(o => o.id === selectedObjectId ? { ...o, x: Math.max(0, newX), y: Math.max(0, newY) } : o));
    } else if (interactionMode === 'resizing') {
      const obj = designObjects.find(o => o.id === selectedObjectId);
      if (!obj) return;
      const newW = Math.round((currentX - obj.x) * 2) / 2;
      const newH = Math.round((currentY - obj.y) * 2) / 2;
      setDesignObjects(objs => objs.map(o => o.id === selectedObjectId ? { ...o, w: Math.max(0.5, newW), h: Math.max(0.5, newH) } : o));
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
    <div className="w-full max-w-[1500px] mx-auto p-2 md:p-4">
      <Card className="shadow-2xl border-none overflow-hidden rounded-xl">
        <div className="bg-[#0f172a] p-4 text-white text-center">
          <h1 className="text-2xl font-bold">আমার বাড়ি এস্টিমেটর ও ডিজাইন</h1>
        </div>

        <Tabs defaultValue="structural" className="w-full">
          <TabsList className="grid grid-cols-3 md:grid-cols-9 h-auto bg-slate-100 rounded-none border-b">
            <TabsTrigger value="structural" className="py-3 text-xs">স্ট্রাকচার</TabsTrigger>
            <TabsTrigger value="slab" className="py-3 text-xs">ছাদ</TabsTrigger>
            <TabsTrigger value="stair" className="py-3 text-xs">সিঁড়ি</TabsTrigger>
            <TabsTrigger value="brick" className="py-3 text-xs">গাঁথুনি</TabsTrigger>
            <TabsTrigger value="plaster" className="py-3 text-xs">প্লাস্টার</TabsTrigger>
            <TabsTrigger value="tile" className="py-3 text-xs">টাইলস</TabsTrigger>
            <TabsTrigger value="fullHouse" className="py-3 text-xs">পুরো বাড়ি</TabsTrigger>
            <TabsTrigger value="conversion" className="py-3 text-xs">রূপান্তর</TabsTrigger>
            <TabsTrigger value="design" className="py-3 text-xs bg-blue-600 text-white data-[state=active]:bg-blue-700">ডিজাইন</TabsTrigger>
          </TabsList>

          {/* --- Calculator Tabs (v61e7980 logic) --- */}
          <TabsContent value="structural" className="p-6 focus:outline-none">
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
              <div className="space-y-4"><FormField control={brickForm.control} name="wallHeightFt" render={({field})=>(<FormItem><FormLabel>উচ্চতা (ফুট)</FormLabel><Input type="number" {...field}/></FormItem>)}/><Button type="submit" className="w-full">হিসাব করুন</Button></div>
              <div>{brickResults && <div className="p-6 bg-blue-50 rounded-xl"><ResultItem label="ইট" value={brickResults.bricks} unit="টি" highlight/><ResultItem label="বালু" value={brickResults.sand} unit="CFT"/></div>}</div>
            </form></Form>
          </TabsContent>

          <TabsContent value="plaster" className="p-6">
            <Form {...plasterForm}><form onSubmit={plasterForm.handleSubmit(calculatePlaster)} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4"><FormField control={plasterForm.control} name="wallLengthFt" render={({field})=>(<FormItem><FormLabel>দৈর্ঘ্য</FormLabel><Input type="number" {...field}/></FormItem>)}/><Button type="submit" className="w-full">হিসাব করুন</Button></div>
              <div>{plasterResults && <div className="p-6 bg-blue-50 rounded-xl"><ResultItem label="সিমেন্ট" value={plasterResults.cement} unit="ব্যাগ"/><ResultItem label="বালু" value={plasterResults.sand} unit="CFT"/></div>}</div>
            </form></Form>
          </TabsContent>

          <TabsContent value="tile" className="p-6">
            <Form {...tileForm}><form onSubmit={tileForm.handleSubmit(calculateTiles)} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4"><FormField control={tileForm.control} name="floorLengthFt" render={({field})=>(<FormItem><FormLabel>দৈর্ঘ্য</FormLabel><Input type="number" {...field}/></FormItem>)}/><Button type="submit" className="w-full">হিসাব করুন</Button></div>
              <div>{tileResults && <div className="p-6 bg-blue-50 rounded-xl"><ResultItem label="টাইলস" value={tileResults.tiles} unit="টি" highlight/></div>}</div>
            </form></Form>
          </TabsContent>

          <TabsContent value="fullHouse" className="p-6">
             <Form {...fullHouseForm}><form onSubmit={fullHouseForm.handleSubmit(calculateFullHouse)} className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-4"><FormField control={fullHouseForm.control} name="totalAreaSqFt" render={({field})=>(<FormItem><FormLabel>মোট এরিয়া (বর্গফুট)</FormLabel><Input type="number" {...field}/></FormItem>)}/><Button type="submit" className="w-full">হিসাব করুন</Button></div>
               <div>{fullHouseResults && <div className="p-6 bg-blue-50 rounded-xl"><ResultItem label="মোট সিমেন্ট" value={fullHouseResults.totalCement} unit="ব্যাগ"/><ResultItem label="মোট ইট" value={fullHouseResults.totalBricks} unit="টি" highlight/></div>}</div>
             </form></Form>
          </TabsContent>

          <TabsContent value="conversion" className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-4 space-y-2"><Label>CFT থেকে ইট (গাঁথুনি)</Label><Input type="number" value={cftToBrickInput} onChange={(e)=>setCftToBrickInput(e.target.value)}/><Button onClick={()=>setCftToBrickResult(Math.ceil(parseFloat(cftToBrickInput)*12))}>হিসাব করুন</Button>{cftToBrickResult && <p className="font-bold">{cftToBrickResult} টি ইট</p>}</Card>
              <Card className="p-4 space-y-2"><Label>রড ওজন</Label><Input type="number" value={rodLengthInput} onChange={(e)=>setRodLengthInput(e.target.value)}/><Button onClick={()=>setRodWeightResult(parseFloat(rodLengthInput)*rodConversionFactor)}>হিসাব করুন</Button>{rodWeightResult && <p className="font-bold">{rodWeightResult.toFixed(2)} কেজি</p>}</Card>
            </div>
          </TabsContent>

          {/* --- Professional SmartDraw-style Design Workspace --- */}
          <TabsContent value="design" className="p-0 m-0 bg-[#f1f5f9] relative overflow-hidden h-[750px] border-t focus:outline-none">
            <div className="flex h-full">
              {/* Sidebar: Library */}
              <div className="w-72 bg-white border-r flex flex-col z-20 shadow-xl overflow-hidden">
                <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
                  <span className="font-bold text-sm flex items-center gap-2"><LayoutGrid className="w-4 h-4 text-blue-600"/> লাইব্রেরি</span>
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
                        <LibItem icon={<Coffee />} label="টেবিল" onClick={() => addObject('furniture', 'table', 'টেবিল')} />
                        <LibItem icon={<Tv />} label="টিভি" onClick={() => addObject('furniture', 'tv', 'টিভি')} />
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">কিচেন ও বাথ</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <LibItem icon={<Utensils />} label="কিচেন" onClick={() => addObject('utility', 'kitchen', 'কিচেন')} />
                        <LibItem icon={<Bath />} label="টয়লেট" onClick={() => addObject('utility', 'toilet', 'টয়লেট')} />
                      </div>
                    </div>
                  </div>
                </ScrollArea>
                
                <div className="p-4 bg-slate-100 text-slate-500 border-t">
                    <p className="text-[10px] leading-relaxed text-center">অবজেক্ট সিলেক্ট করলে পাশে <br/> এডিট প্যানেল আসবে</p>
                </div>
              </div>

              {/* Workspace with Rulers */}
              <div className="flex-1 relative flex flex-col overflow-hidden bg-slate-200">
                {/* Horizontal Ruler */}
                <div className="h-8 bg-white border-b flex items-end relative overflow-hidden z-10 select-none">
                  <div className="flex absolute left-8 h-full items-end">
                    {Array.from({ length: 100 }).map((_, i) => (
                      <div key={i} className="border-l border-slate-300 h-2 flex flex-col justify-end text-[8px] text-slate-400 font-mono" style={{ width: zoom, minWidth: zoom }}>
                        <span className="pl-1 pb-1">{i}ft</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-1 overflow-hidden relative">
                  {/* Vertical Ruler */}
                  <div className="w-8 bg-white border-r flex flex-col items-end relative overflow-hidden z-10 select-none">
                    <div className="flex flex-col absolute top-0 w-full items-end">
                      {Array.from({ length: 100 }).map((_, i) => (
                        <div key={i} className="border-t border-slate-300 w-2 flex items-center justify-end text-[8px] text-slate-400 font-mono" style={{ height: zoom, minHeight: zoom }}>
                          <span className="pr-1 rotate-90">{i}ft</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Main Canvas Workspace */}
                  <div 
                    id="canvas-workspace"
                    className="flex-1 relative bg-slate-200 overflow-auto cursor-crosshair scrollbar-hide"
                    onMouseMove={handleMouseMove}
                    onMouseUp={() => {
                      setInteractionMode('none');
                      setSnapPoint(null);
                    }}
                    onClick={() => {
                      if (interactionMode === 'none') setSelectedObjectId(null);
                    }}
                  >
                    <div className="fixed bottom-10 right-10 z-30 flex flex-col gap-2">
                      <div className="bg-white/90 backdrop-blur-md p-2 rounded-xl shadow-2xl border border-slate-200 flex flex-col gap-2">
                        <Button variant="secondary" size="icon" className="h-10 w-10 hover:bg-blue-50" onClick={() => setZoom(z => Math.min(100, z + 5))}><Plus className="w-5 h-5"/></Button>
                        <Separator />
                        <Button variant="secondary" size="icon" className="h-10 w-10 hover:bg-blue-50" onClick={() => setZoom(z => Math.max(10, z - 5))}><RotateCcw className="w-5 h-5 rotate-180"/></Button>
                      </div>
                      <Button variant="destructive" size="icon" className="h-12 w-12 shadow-2xl rounded-full" onClick={() => { if(confirm('আপনি কি সব ডিলিট করতে চান?')) setDesignObjects([])}}><Eraser className="w-6 h-6"/></Button>
                    </div>

                    {snapPoint && (
                      <div 
                        className="absolute w-4 h-4 bg-blue-500 rounded-full z-50 animate-pulse border-2 border-white shadow-lg pointer-events-none"
                        style={{ left: snapPoint.x * zoom - 8, top: snapPoint.y * zoom - 8 }}
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
                          onMouseDown={(e) => handleMouseDown(e, obj.id)}
                          onClick={(e) => e.stopPropagation()} 
                          className={cn(
                            "absolute flex items-center justify-center border-2 transition-all cursor-move select-none",
                            selectedObjectId === obj.id 
                              ? "border-blue-600 ring-4 ring-blue-600/20 z-30 shadow-2xl bg-white/40" 
                              : "border-slate-400 z-10 bg-white/80"
                          )}
                          style={{
                            left: obj.x * zoom,
                            top: obj.y * zoom,
                            width: obj.w * zoom,
                            height: obj.h * zoom,
                            transform: `rotate(${obj.rotation}deg)`,
                          }}
                        >
                          <div className="flex flex-col items-center justify-center p-2 text-center pointer-events-none">
                            <span className="text-[11px] font-bold text-slate-800">{obj.label}</span>
                            <span className="text-[9px] font-mono text-slate-500 mt-0.5">{obj.w}' × {obj.h}'</span>
                          </div>
                          
                          {selectedObjectId === obj.id && (
                            <div 
                              className="absolute -bottom-2 -right-2 w-5 h-5 bg-blue-600 rounded-full cursor-se-resize z-40 shadow-lg border-2 border-white flex items-center justify-center"
                              onMouseDown={(e) => handleMouseDown(e, obj.id, 'resizing')}
                            >
                              <div className="w-1.5 h-1.5 bg-white rounded-full" />
                            </div>
                          )}

                          {selectedObjectId === obj.id && (
                             <div 
                                className="absolute bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 p-4 w-60 z-50 flex flex-col gap-3 pointer-events-auto"
                                style={{ 
                                    left: `calc(100% + 20px)`, 
                                    top: 0,
                                    transform: `rotate(${-obj.rotation}deg)`, 
                                    transition: 'none'
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                             >
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-blue-400 uppercase">এডিট: {obj.label}</span>
                                    <Button variant="ghost" size="icon" className="h-5 w-5 text-slate-400 hover:text-white" onClick={() => setSelectedObjectId(null)}><X className="w-3 h-3"/></Button>
                                </div>
                                <Separator className="bg-slate-700"/>
                                
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-[9px] text-slate-400">দৈর্ঘ্য (ফুট)</Label>
                                        <Input type="number" step="0.5" value={obj.w} onChange={(e) => updateObject(obj.id, { w: parseFloat(e.target.value) || 0.5 })} className="h-7 bg-slate-800 border-slate-700 text-[10px] text-white" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[9px] text-slate-400">প্রস্থ (ফুট)</Label>
                                        <Input type="number" step="0.5" value={obj.h} onChange={(e) => updateObject(obj.id, { h: parseFloat(e.target.value) || 0.5 })} className="h-7 bg-slate-800 border-slate-700 text-[10px] text-white" />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-[9px] text-slate-400">৩৬০° রোটেশন</Label>
                                        <Input type="number" value={obj.rotation} onChange={(e) => updateObject(obj.id, { rotation: parseInt(e.target.value) || 0 })} className="h-6 w-12 bg-slate-800 border-slate-700 text-[9px] text-blue-400 text-center" />
                                    </div>
                                    <Slider value={[obj.rotation]} max={360} step={1} onValueChange={(val) => updateObject(obj.id, { rotation: val[0] })} className="py-1" />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">অবস্থান পরিবর্তন</Label>
                                    <div className="grid grid-cols-3 gap-1 w-32 mx-auto">
                                        <div />
                                        <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => nudgeObject(obj.id, 0, -0.5)}><ArrowUp className="w-4 h-4"/></Button>
                                        <div />
                                        <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => nudgeObject(obj.id, -0.5, 0)}><ArrowLeft className="w-4 h-4"/></Button>
                                        <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => nudgeObject(obj.id, 0, 0.5)}><ArrowDown className="w-4 h-4"/></Button>
                                        <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => nudgeObject(obj.id, 0.5, 0)}><ArrowRight className="w-4 h-4"/></Button>
                                    </div>
                                </div>

                                <Button variant="destructive" size="sm" className="h-7 text-[10px] mt-1" onClick={() => deleteObject(obj.id)}><Trash2 className="w-3 h-3 mr-1"/> ডিলিট</Button>
                             </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
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
      className="flex flex-col h-20 w-full gap-2 p-2 hover:bg-blue-50 hover:border-blue-400 transition-all group border-slate-200 bg-white shadow-sm" 
      onClick={onClick}
    >
      <div className="text-slate-400 group-hover:text-blue-600 transition-colors">
        {React.cloneElement(icon as React.ReactElement, { className: "w-6 h-6" })}
      </div>
      <span className="text-[10px] font-bold text-slate-600 group-hover:text-blue-700">{label}</span>
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
