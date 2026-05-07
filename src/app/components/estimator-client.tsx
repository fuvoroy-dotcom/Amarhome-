
"use client";

import React, { useState, useTransition, useRef, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Building, Cog, BarChartBig, Layers, Paintbrush, ClipboardList, Trash2, 
  RectangleHorizontal, Grid, List, ArrowRightLeft, Box, Palette, 
  Eraser, Square, DoorClosed, LayoutGrid, RotateCcw, Download, Plus, Move, 
  Ruler, Maximize, Type, Monitor, Bed, Armchair, Bath, Utensils, Tv, Refrigerator,
  Coffee, Lamp, Laptop
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// --- Types for Calculators ---
type StructuralResults = {
  cement: number;
  sand: number;
  chips: number;
  mainRodWeight: number;
  ringRodWeight: number;
  totalRodWeight: number;
};

type SlabResults = {
    cement: number;
    sand: number;
    chips: number;
    rodWeight: number;
}

type BrickResults = {
    bricks: number;
    cement: number;
    sand: number;
}

type TileResults = {
    tiles: number;
    cement: number;
    sand: number;
}

type PlasterResults = {
    cement: number;
    sand: number;
}

type FullHouseResults = {
    totalCement: number;
    totalSand: number;
    totalChips: number;
    totalRodWeight: number;
    totalBricks: number;
    totalTiles: number;
};

type StairResults = {
    cement: number;
    sand: number;
    chips: number;
    totalRodWeight: number;
};

// --- Professional Design Types ---
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
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(20); // 1ft = 20px
  
  const selectedObject = designObjects.find(obj => obj.id === selectedObjectId);

  // --- Forms ---
  const structuralForm = useForm<EstimatorValues>({
    resolver: zodResolver(estimatorSchema),
    defaultValues: {
      includeBase: true,
      includeColumn: true,
      includeBeam: true,
      baseCount: 1,
      baseLengthFt: 5,
      baseWidthFt: 5,
      baseThicknessIn: 18,
      columnCount: 1,
      columnLengthIn: 12,
      columnWidthIn: 10,
      columnHeightFt: 32,
      beamHeightIn: 12,
      beamWidthIn: 10,
      beamLengthFt: 12,
      columnRodCount: 8,
      beamRodCount: 6,
      mainRodFactor: 0.48,
      ringGapIn: 7,
      ringRodFactor: 0.12,
      baseRodLongitudinalCount: 10,
      baseRodWidthCount: 10,
    },
  });

  const includeBase = structuralForm.watch('includeBase');
  const includeColumn = structuralForm.watch('includeColumn');
  const includeBeam = structuralForm.watch('includeBeam');

  const slabForm = useForm<SlabEstimatorValues>({
    resolver: zodResolver(slabEstimatorSchema),
    defaultValues: {
        slabs: [{ length: 20, width: 15 }],
        slabThicknessIn: 5,
        slabRodGapIn: 6,
        mainRodFactor: 0.48,
    }
  });

  const { fields: slabFields, append: appendSlab, remove: removeSlab } = useFieldArray({
    control: slabForm.control,
    name: "slabs"
  });

  const brickForm = useForm<BrickEstimatorValues>({
      resolver: zodResolver(brickEstimatorSchema),
      defaultValues: {
          calculationType: 'rooms',
          wallLengthFt: 10,
          wallHeightFt: 10,
          wallThicknessIn: '5',
          rooms: [{ length: 12, width: 10 }],
      }
  });
  const brickCalculationType = brickForm.watch('calculationType');
  const { fields: brickFields, append: appendBrick, remove: removeBrick } = useFieldArray({ 
    control: brickForm.control, 
    name: "rooms" 
  });

  const tileForm = useForm<TileEstimatorValues>({
      resolver: zodResolver(tileEstimatorSchema),
      defaultValues: {
          calculationType: 'floor',
          floorLengthFt: 12,
          floorWidthFt: 10,
          walls: [{ length: 12, height: 10 }],
          tileLengthIn: 12,
          tileWidthIn: 12,
          wastagePercent: 10,
      }
  });
  const tileCalculationType = tileForm.watch('calculationType');
  const { fields: wallFields, append: appendWall, remove: removeWall } = useFieldArray({ 
    control: tileForm.control, 
    name: "walls" 
  });

  const plasterForm = useForm<PlasterEstimatorValues>({
      resolver: zodResolver(plasterEstimatorSchema),
      defaultValues: {
          wallLengthFt: 12,
          wallHeightFt: 10,
          plasterThicknessIn: 0.5,
          plasterSides: '2',
      }
  });

  const fullHouseForm = useForm<FullHouseEstimatorValues>({
      resolver: zodResolver(fullHouseEstimatorSchema),
      defaultValues: {
          floorCount: 1,
          totalAreaSqFt: 1000,
          roomCount: 3,
          bathroomCount: 2,
          avgRoomLengthFt: 12,
          avgRoomWidthFt: 10,
          floorHeightFt: 10,
          columnCountPerFloor: 10,
          slabThicknessIn: 5,
          wallThicknessIn: '5',
          tileFloors: true,
          tileBathroomWalls: true,
          bathroomWallTileHeightFt: 7,
          plasterInterior: true,
          plasterExterior: true,
          mainRodFactor: 0.48,
          ringRodFactor: 0.12,
          ringGapIn: 7,
      }
  });

  const stairForm = useForm<StairEstimatorValues>({
      resolver: zodResolver(stairEstimatorSchema),
      defaultValues: {
          flightCount: 1,
          waistSlabLengthFt: 10,
          waistSlabWidthFt: 3.5,
          waistSlabThicknessIn: 5,
          stepCountPerFlight: 10,
          riserHeightIn: 6,
          treadWidthIn: 10,
          landingLengthFt: 3.5,
          landingWidthFt: 7,
          mainRodFactor: 0.30,
          distRodFactor: 0.19,
          distRodGapIn: 6,
      }
  });

  // --- Calculation Handlers ---
  function calculateStructural(data: EstimatorValues) {
    const { 
        includeBase, includeColumn, includeBeam,
        baseCount, baseLengthFt, baseWidthFt, baseThicknessIn,
        columnCount, columnLengthIn, columnWidthIn, columnHeightFt,
        beamHeightIn, beamWidthIn, beamLengthFt,
        columnRodCount, beamRodCount, mainRodFactor,
        ringGapIn, ringRodFactor, baseRodLongitudinalCount, baseRodWidthCount
    } = data;

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
    if (includeColumn && ringGapIn > 0) {
        const ringCountCol = (columnHeightFt * 12) / ringGapIn;
        const ringLenCol = ((columnLengthIn / 12) + (columnWidthIn / 12)) * 2;
        ringWeight += (ringCountCol * ringLenCol * columnCount) * ringRodFactor;
    }
    if (includeBeam && ringGapIn > 0) {
        const ringCountBeam = (beamLengthFt * 12) / ringGapIn;
        const ringLenBeam = ((beamHeightIn / 12) + (beamWidthIn / 12)) * 2;
        ringWeight += (ringCountBeam * ringLenBeam) * ringRodFactor;
    }

    setStructuralResults({
      cement: cementBags,
      sand: sandCFT,
      chips: chipsCFT,
      mainRodWeight: mainRodWeight,
      ringRodWeight: ringWeight,
      totalRodWeight: mainRodWeight + ringWeight,
    });
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
    if (slabRodGapIn > 0) {
        slabs.forEach(slab => {
            totalRodLength += ((slab.width / (slabRodGapIn / 12)) * slab.length) + ((slab.length / (slabRodGapIn / 12)) * slab.width);
        });
    }
    setSlabResults({
        cement: cementBags,
        sand: parseFloat(sandCFT.toFixed(1)),
        chips: parseFloat(chipsCFT.toFixed(1)),
        rodWeight: parseFloat((totalRodLength * mainRodFactor).toFixed(1)),
    });
  }

  function calculateBricks(data: BrickEstimatorValues) {
    const { calculationType, wallLengthFt, wallHeightFt, wallThicknessIn, rooms } = data;
    let totalLength = calculationType === 'wall' ? wallLengthFt || 0 : (rooms || []).reduce((acc, room) => acc + (room.length + room.width) * 2, 0);
    const area = totalLength * wallHeightFt;
    const is5In = wallThicknessIn === '5';
    const bricks = area * (is5In ? 5 : 10);
    const dryVol = area * (is5In ? 5/12 : 10/12) * 0.30 * 1.33;
    setBrickResults({
        bricks: Math.ceil(bricks),
        cement: Math.ceil((dryVol / 5) / 1.25),
        sand: parseFloat(((dryVol / 5) * 4).toFixed(1)),
    });
  }

  function calculateTiles(data: TileEstimatorValues) {
      const { calculationType, floorLengthFt, floorWidthFt, walls, tileLengthIn, tileWidthIn, wastagePercent } = data;
      let totalArea = calculationType === 'floor' ? (floorLengthFt || 0) * (floorWidthFt || 0) : (walls || []).reduce((acc, wall) => acc + (wall.length * wall.height), 0);
      const tileArea = (tileLengthIn / 12) * (tileWidthIn / 12);
      if (tileArea === 0) return;
      const totalTiles = Math.ceil((totalArea / tileArea) * (1 + wastagePercent / 100));
      const dryVol = totalArea * (calculationType === 'floor' ? 1/12 : 0.5/12) * 1.33;
      setTileResults({
          tiles: totalTiles,
          cement: Math.ceil((dryVol / 5) / 1.25),
          sand: parseFloat(((dryVol / 5) * 4).toFixed(1))
      });
  }

  function calculatePlaster(data: PlasterEstimatorValues) {
      const { wallLengthFt, wallHeightFt, plasterThicknessIn, plasterSides } = data;
      const dryVol = (wallLengthFt * wallHeightFt * parseInt(plasterSides)) * (plasterThicknessIn / 12) * 1.33;
      setPlasterResults({
          cement: Math.ceil((dryVol / 5) / 1.25),
          sand: parseFloat(((dryVol / 5) * 4).toFixed(1)),
      });
  }

  function calculateFullHouse(data: FullHouseEstimatorValues) {
      const { floorCount, totalAreaSqFt, wallThicknessIn } = data;
      const totalSlabArea = totalAreaSqFt * floorCount;
      const bricks = totalSlabArea * 5 * (wallThicknessIn === '5' ? 1 : 2); 
      setFullHouseResults({
          totalCement: Math.ceil(totalSlabArea * 0.5), 
          totalSand: totalSlabArea * 1.2,
          totalChips: totalSlabArea * 2.5,
          totalRodWeight: totalSlabArea * 3.5,
          totalBricks: Math.ceil(bricks),
          totalTiles: Math.ceil(totalSlabArea * 1.1),
      });
  }

  function calculateStair(data: StairEstimatorValues) {
      const { flightCount, waistSlabLengthFt, waistSlabWidthFt } = data;
      const dryVol = flightCount * waistSlabLengthFt * waistSlabWidthFt * 0.5 * 1.5;
      setStairResults({
          cement: Math.ceil((dryVol / 5.5) / 1.25),
          sand: parseFloat(((dryVol / 5.5) * 1.5).toFixed(1)),
          chips: parseFloat(((dryVol / 5.5) * 3).toFixed(1)),
          totalRodWeight: 45 * flightCount,
      });
  }

  // --- Professional Design Logic ---
  const addObject = (type: DesignObject['type'], subType: string, label: string) => {
    const newObj: DesignObject = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      subType,
      x: 5, 
      y: 5,
      w: type === 'structure' ? 12 : type === 'opening' ? 3 : 4,
      h: type === 'structure' ? 10 : type === 'opening' ? 0.5 : 3,
      label: label,
      color: type === 'structure' ? '#f1f5f9' : type === 'opening' ? '#334155' : '#94a3b8',
      rotation: 0
    };
    setDesignObjects([...designObjects, newObj]);
    setSelectedObjectId(newObj.id);
  };

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedObjectId(id);
    setIsDragging(true);
    const obj = designObjects.find(o => o.id === id);
    if (obj) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setDragOffset({
        x: (e.clientX - rect.left) / zoom,
        y: (e.clientY - rect.top) / zoom
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectedObjectId) return;
    const canvasRect = (e.currentTarget as HTMLElement).parentElement?.getBoundingClientRect();
    if (!canvasRect) return;
    
    const newX = (e.clientX - canvasRect.left) / zoom - dragOffset.x;
    const newY = (e.clientY - canvasRect.top) / zoom - dragOffset.y;

    // Snap to grid
    const snappedX = Math.round(newX);
    const snappedY = Math.round(newY);

    setDesignObjects(objs => objs.map(o => 
      o.id === selectedObjectId ? { ...o, x: Math.max(0, snappedX), y: Math.max(0, snappedY) } : o
    ));
  };

  const updateObject = (id: string, updates: Partial<DesignObject>) => {
    setDesignObjects(objs => objs.map(o => o.id === id ? { ...o, ...updates } : o));
  };

  const deleteObject = (id: string) => {
    setDesignObjects(designObjects.filter(o => o.id !== id));
    setSelectedObjectId(null);
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-8">
      <Card className="shadow-2xl border-none overflow-hidden">
        <div className="bg-primary p-6 text-primary-foreground text-center">
          <h1 className="text-4xl font-black mb-2">আমার বাড়ি এস্টিমেটর</h1>
          <p className="opacity-80 text-lg">নির্মাণ সামগ্রীর নির্ভুল হিসাব এবং প্রফেশনাল ডিজাইন টুল</p>
        </div>

        <Tabs defaultValue="structural" className="w-full">
          <TabsList className="flex flex-wrap h-auto bg-muted/50 rounded-none border-b">
            <TabsTrigger value="structural" className="flex-1 py-4"><Building className="mr-2 h-4 w-4" />স্ট্রাকচার</TabsTrigger>
            <TabsTrigger value="slab" className="flex-1 py-4"><Grid className="mr-2 h-4 w-4" />ছাদ</TabsTrigger>
            <TabsTrigger value="stair" className="flex-1 py-4"><List className="mr-2 h-4 w-4" />সিঁড়ি</TabsTrigger>
            <TabsTrigger value="brick" className="flex-1 py-4"><Layers className="mr-2 h-4 w-4" />গাঁথুনি</TabsTrigger>
            <TabsTrigger value="plaster" className="flex-1 py-4"><Paintbrush className="mr-2 h-4 w-4" />প্লাস্টার</TabsTrigger>
            <TabsTrigger value="tile" className="flex-1 py-4"><RectangleHorizontal className="mr-2 h-4 w-4" />টাইলস</TabsTrigger>
            <TabsTrigger value="fullHouse" className="flex-1 py-4"><ClipboardList className="mr-2 h-4 w-4" />পূর্ণাঙ্গ বাড়ি</TabsTrigger>
            <TabsTrigger value="conversion" className="flex-1 py-4"><ArrowRightLeft className="mr-2 h-4 w-4" />রূপান্তর</TabsTrigger>
            <TabsTrigger value="design" className="flex-1 py-4 bg-accent/10 text-accent font-bold"><Palette className="mr-2 h-4 w-4" />ডিজাইন (SmartDraw)</TabsTrigger>
          </TabsList>

          {/* --- Structural Tab --- */}
          <TabsContent value="structural" className="p-6">
            <Form {...structuralForm}>
              <form onSubmit={structuralForm.handleSubmit(calculateStructural)} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="space-y-6">
                  <h2 className="font-bold text-xl text-primary border-b pb-2 flex items-center gap-2"><Building className="w-5 h-5"/>কাঠামোর মাপ</h2>
                  <div className="bg-card p-4 rounded-xl border space-y-4">
                    <div className="flex flex-wrap gap-4 mb-4">
                      <FormField control={structuralForm.control} name="includeBase" render={({ field }) => (
                        <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="text-sm">বেস</FormLabel></FormItem>
                      )} />
                      <FormField control={structuralForm.control} name="includeColumn" render={({ field }) => (
                        <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="text-sm">কলাম</FormLabel></FormItem>
                      )} />
                      <FormField control={structuralForm.control} name="includeBeam" render={({ field }) => (
                        <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="text-sm">বিম</FormLabel></FormItem>
                      )} />
                    </div>
                    {includeBase && (
                      <div className="space-y-4 animate-in fade-in">
                        <Label className="text-sm font-bold text-muted-foreground">বেস / ভিত্তি</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <FormField control={structuralForm.control} name="baseCount" render={({ field }) => (<FormItem><FormLabel className="text-[10px]">সংখ্যা</FormLabel><Input type="number" {...field} /></FormItem>)} />
                          <FormField control={structuralForm.control} name="baseThicknessIn" render={({ field }) => (<FormItem><FormLabel className="text-[10px]">পুরুত্ব (ইঞ্চি)</FormLabel><Input type="number" {...field} /></FormItem>)} />
                        </div>
                      </div>
                    )}
                    {includeColumn && (
                      <div className="space-y-4 animate-in fade-in">
                        <Label className="text-sm font-bold text-muted-foreground">কলাম</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <FormField control={structuralForm.control} name="columnCount" render={({ field }) => (<FormItem><FormLabel className="text-[10px]">সংখ্যা</FormLabel><Input type="number" {...field} /></FormItem>)} />
                          <FormField control={structuralForm.control} name="columnHeightFt" render={({ field }) => (<FormItem><FormLabel className="text-[10px]">উচ্চতা (ফুট)</FormLabel><Input type="number" {...field} /></FormItem>)} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <h2 className="font-bold text-xl text-primary border-b pb-2 flex items-center gap-2"><Cog className="w-5 h-5"/>রড সেটিংস</h2>
                  <div className="bg-card p-4 rounded-xl border space-y-4">
                    <FormField control={structuralForm.control} name="mainRodFactor" render={({ field }) => (
                      <FormItem>
                        <FormLabel>প্রধান রড</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={String(field.value)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0.12">৮ মিলি</SelectItem>
                            <SelectItem value="0.19">১০ মিলি</SelectItem>
                            <SelectItem value="0.30">১২ মিলি</SelectItem>
                            <SelectItem value="0.48">১৬ মিলি</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <Button type="submit" className="w-full py-6 text-lg font-bold">হিসাব করুন</Button>
                  </div>
                </div>

                <div className="space-y-6">
                  <h2 className="font-bold text-xl text-primary border-b pb-2 flex items-center gap-2"><BarChartBig className="w-5 h-5"/>ফলাফল</h2>
                  {structuralResults ? (
                    <div className="bg-primary/5 p-6 rounded-2xl border-2 border-primary/20 space-y-4">
                      <ResultItem label="সিমেন্ট" value={structuralResults.cement} unit="ব্যাগ" />
                      <ResultItem label="বালু" value={structuralResults.sand.toFixed(1)} unit="CFT" />
                      <ResultItem label="খোয়া" value={structuralResults.chips.toFixed(1)} unit="CFT" />
                      <div className="pt-4 border-t">
                        <ResultItem label="মোট রড" value={structuralResults.totalRodWeight.toFixed(1)} unit="কেজি" highlight />
                      </div>
                    </div>
                  ) : (
                    <div className="h-40 border-2 border-dashed rounded-2xl flex items-center justify-center text-muted-foreground">হিসাব করুন বাটনে ক্লিক করুন</div>
                  )}
                </div>
              </form>
            </Form>
          </TabsContent>

          {/* --- Slab Tab --- */}
          <TabsContent value="slab" className="p-6">
              <Form {...slabForm}><form onSubmit={slabForm.handleSubmit(calculateSlab)} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                      {slabFields.map((field, index) => (
                          <div key={field.id} className="flex gap-2 items-end bg-card p-3 border rounded-lg">
                              <FormField control={slabForm.control} name={`slabs.${index}.length`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>দৈর্ঘ্য (ফুট)</FormLabel><Input type="number" {...field}/></FormItem>)}/>
                              <FormField control={slabForm.control} name={`slabs.${index}.width`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>প্রস্থ (ফুট)</FormLabel><Input type="number" {...field}/></FormItem>)}/>
                              <Button type="button" variant="destructive" size="icon" onClick={() => removeSlab(index)}><Trash2 className="w-4 h-4"/></Button>
                          </div>
                      ))}
                      <Button type="button" variant="outline" className="w-full" onClick={() => appendSlab({ length: 10, width: 10 })}><Plus className="w-4 h-4 mr-2"/>অংশ যোগ করুন</Button>
                      <Button type="submit" className="w-full">হিসাব করুন</Button>
                  </div>
                  <div>
                    {slabResults && (
                        <div className="bg-primary/5 p-6 rounded-2xl border-2 border-primary/20 space-y-4">
                            <ResultItem label="সিমেন্ট" value={slabResults.cement} unit="ব্যাগ" />
                            <ResultItem label="রড" value={slabResults.rodWeight} unit="কেজি" highlight />
                        </div>
                    )}
                  </div>
              </form></Form>
          </TabsContent>

          {/* --- Stair Tab --- */}
          <TabsContent value="stair" className="p-6">
              <Form {...stairForm}><form onSubmit={stairForm.handleSubmit(calculateStair)} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4 bg-card p-4 border rounded-xl">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={stairForm.control} name="flightCount" render={({ field }) => (<FormItem><FormLabel>ফ্লাইট সংখ্যা</FormLabel><Input type="number" {...field}/></FormItem>)}/>
                        <FormField control={stairForm.control} name="waistSlabLengthFt" render={({ field }) => (<FormItem><FormLabel>দৈর্ঘ্য (ফুট)</FormLabel><Input type="number" {...field}/></FormItem>)}/>
                      </div>
                      <Button type="submit" className="w-full">হিসাব করুন</Button>
                  </div>
                  <div>{stairResults && <ResultItem label="সিমেন্ট" value={stairResults.cement} unit="ব্যাগ" highlight />}</div>
              </form></Form>
          </TabsContent>

          {/* --- Brick Tab --- */}
          <TabsContent value="brick" className="p-6">
              <Form {...brickForm}><form onSubmit={brickForm.handleSubmit(calculateBricks)} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                      {brickFields.map((room, idx) => (
                          <div key={room.id} className="flex gap-2 bg-card p-3 border rounded-lg">
                              <FormField control={brickForm.control} name={`rooms.${idx}.length`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>দৈর্ঘ্য</FormLabel><Input type="number" {...field}/></FormItem>)}/>
                              <FormField control={brickForm.control} name={`rooms.${idx}.width`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>প্রস্থ</FormLabel><Input type="number" {...field}/></FormItem>)}/>
                          </div>
                      ))}
                      <Button type="submit" className="w-full">হিসাব করুন</Button>
                  </div>
                  <div>{brickResults && <ResultItem label="মোট ইট" value={brickResults.bricks} unit="টি" highlight />}</div>
              </form></Form>
          </TabsContent>

          {/* --- Plaster Tab --- */}
          <TabsContent value="plaster" className="p-6">
              <Form {...plasterForm}><form onSubmit={plasterForm.handleSubmit(calculatePlaster)} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4 bg-card p-4 border rounded-xl">
                      <FormField control={plasterForm.control} name="wallLengthFt" render={({ field }) => (<FormItem><FormLabel>দেয়ালের দৈর্ঘ্য (ফুট)</FormLabel><Input type="number" {...field}/></FormItem>)}/>
                      <FormField control={plasterForm.control} name="wallHeightFt" render={({ field }) => (<FormItem><FormLabel>দেয়ালের উচ্চতা (ফুট)</FormLabel><Input type="number" {...field}/></FormItem>)}/>
                      <Button type="submit" className="w-full">হিসাব করুন</Button>
                  </div>
                  <div>{plasterResults && <ResultItem label="সিমেন্ট" value={plasterResults.cement} unit="ব্যাগ" highlight />}</div>
              </form></Form>
          </TabsContent>

          {/* --- Tile Tab --- */}
          <TabsContent value="tile" className="p-6">
              <Form {...tileForm}><form onSubmit={tileForm.handleSubmit(calculateTiles)} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4 bg-card p-4 border rounded-xl">
                      <FormField control={tileForm.control} name="floorLengthFt" render={({ field }) => (<FormItem><FormLabel>দৈর্ঘ্য (ফুট)</FormLabel><Input type="number" {...field}/></FormItem>)}/>
                      <FormField control={tileForm.control} name="floorWidthFt" render={({ field }) => (<FormItem><FormLabel>প্রস্থ (ফুট)</FormLabel><Input type="number" {...field}/></FormItem>)}/>
                      <Button type="submit" className="w-full">হিসাব করুন</Button>
                  </div>
                  <div>{tileResults && <ResultItem label="মোট টাইলস" value={tileResults.tiles} unit="টি" highlight />}</div>
              </form></Form>
          </TabsContent>

          {/* --- Full House Tab --- */}
          <TabsContent value="fullHouse" className="p-6">
              <Form {...fullHouseForm}><form onSubmit={fullHouseForm.handleSubmit(calculateFullHouse)} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4 bg-card p-4 border rounded-xl">
                      <FormField control={fullHouseForm.control} name="totalAreaSqFt" render={({ field }) => (<FormItem><FormLabel>মোট এরিয়া (বর্গফুট)</FormLabel><Input type="number" {...field}/></FormItem>)}/>
                      <FormField control={fullHouseForm.control} name="floorCount" render={({ field }) => (<FormItem><FormLabel>ফ্লোর সংখ্যা</FormLabel><Input type="number" {...field}/></FormItem>)}/>
                      <Button type="submit" className="w-full">হিসাব করুন</Button>
                  </div>
                  <div>{fullHouseResults && <ResultItem label="সিমেন্ট" value={fullHouseResults.totalCement} unit="ব্যাগ" highlight />}</div>
              </form></Form>
          </TabsContent>

          {/* --- Conversion Tab --- */}
          <TabsContent value="conversion" className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="p-6 space-y-4">
                      <Label>CFT থেকে ইট (গাঁথুনি)</Label>
                      <Input type="number" value={cftToBrickInput} onChange={(e) => setCftToBrickInput(e.target.value)} placeholder="১০০" />
                      <Button className="w-full" onClick={() => setCftToBrickResult(Math.ceil(parseFloat(cftToBrickInput) * 12))}>হিসাব করুন</Button>
                      {cftToBrickResult && <div className="p-3 bg-primary/10 rounded font-bold text-center">{cftToBrickResult} টি ইট</div>}
                  </Card>
                  <Card className="p-6 space-y-4">
                      <Label>CFT থেকে ইট (খোয়া)</Label>
                      <Input type="number" value={khowaCftToBrickInput} onChange={(e) => setKhowaCftToBrickInput(e.target.value)} placeholder="১০০" />
                      <Button className="w-full" onClick={() => setKhowaCftToBrickResult(Math.ceil(parseFloat(khowaCftToBrickInput) * 11))}>হিসাব করুন</Button>
                      {khowaCftToBrickResult && <div className="p-3 bg-primary/10 rounded font-bold text-center">{khowaCftToBrickResult} টি ইট</div>}
                  </Card>
                  <Card className="p-6 space-y-4">
                      <Label>রডের দৈর্ঘ্য থেকে ওজন</Label>
                      <Input type="number" value={rodLengthInput} onChange={(e) => setRodLengthInput(e.target.value)} placeholder="৪০" />
                      <Button className="w-full" onClick={() => setRodWeightResult(parseFloat(rodLengthInput) * rodConversionFactor)}>হিসাব করুন</Button>
                      {rodWeightResult && <div className="p-3 bg-primary/10 rounded font-bold text-center">{rodWeightResult.toFixed(2)} কেজি</div>}
                  </Card>
              </div>
          </TabsContent>

          {/* --- SmartDraw Professional Design Tab --- */}
          <TabsContent value="design" className="p-0 m-0 bg-slate-50 border-t">
            <div className="flex flex-col lg:flex-row h-[750px]">
              {/* Library Sidebar (SmartDraw Style) */}
              <div className="w-full lg:w-80 bg-white border-r overflow-hidden flex flex-col">
                <div className="p-4 bg-muted/30 border-b">
                  <h3 className="font-bold flex items-center gap-2"><LayoutGrid className="w-4 h-4"/>সিম্বল লাইব্রেরি</h3>
                </div>
                
                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-6">
                    {/* Structure Section */}
                    <div>
                      <h4 className="text-[11px] uppercase font-bold text-muted-foreground mb-3 tracking-wider">কাঠামো</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <LibraryButton icon={<Square />} label="রুম (Room)" onClick={() => addObject('structure', 'room', 'রুম')} />
                        <LibraryButton icon={<Maximize />} label="দেয়াল (Wall)" onClick={() => addObject('structure', 'wall', 'দেয়াল')} />
                        <LibraryButton icon={<DoorClosed />} label="দরজা (Door)" onClick={() => addObject('opening', 'door', 'দরজা')} />
                        <LibraryButton icon={<Grid />} label="জানালা (Window)" onClick={() => addObject('opening', 'window', 'জানালা')} />
                      </div>
                    </div>

                    <Separator />

                    {/* Bedroom Section */}
                    <div>
                      <h4 className="text-[11px] uppercase font-bold text-muted-foreground mb-3 tracking-wider">বেডরুম</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <LibraryButton icon={<Bed />} label="বিছানা" onClick={() => addObject('furniture', 'bed', 'বিছানা')} />
                        <LibraryButton icon={<Lamp />} label="ল্যাম্প" onClick={() => addObject('furniture', 'lamp', 'ল্যাম্প')} />
                        <LibraryButton icon={<Box />} label="আলমারি" onClick={() => addObject('furniture', 'closet', 'আলমারি')} />
                      </div>
                    </div>

                    <Separator />

                    {/* Living Room Section */}
                    <div>
                      <h4 className="text-[11px] uppercase font-bold text-muted-foreground mb-3 tracking-wider">লিভিং রুম</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <LibraryButton icon={<Armchair />} label="সোফা" onClick={() => addObject('furniture', 'sofa', 'সোফা')} />
                        <LibraryButton icon={<Tv />} label="টিভি" onClick={() => addObject('furniture', 'tv', 'টিভি')} />
                        <LibraryButton icon={<Coffee />} label="টেবিল" onClick={() => addObject('furniture', 'table', 'টেবিল')} />
                        <LibraryButton icon={<Monitor />} label="ডেস্ক" onClick={() => addObject('furniture', 'desk', 'ডেস্ক')} />
                      </div>
                    </div>

                    <Separator />

                    {/* Kitchen & Bath Section */}
                    <div>
                      <h4 className="text-[11px] uppercase font-bold text-muted-foreground mb-3 tracking-wider">কিচেন ও বাথ</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <LibraryButton icon={<Bath />} label="টয়লেট" onClick={() => addObject('utility', 'toilet', 'টয়লেট')} />
                        <LibraryButton icon={<Utensils />} label="কিচেন" onClick={() => addObject('utility', 'kitchen', 'কিচেন')} />
                        <LibraryButton icon={<Refrigerator />} label="ফ্রিজ" onClick={() => addObject('utility', 'fridge', 'ফ্রিজ')} />
                      </div>
                    </div>
                  </div>
                </ScrollArea>

                {/* Properties Panel (SmartDraw Style) */}
                {selectedObject && (
                  <div className="p-4 bg-slate-100 border-t animate-in slide-in-from-bottom">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-xs font-bold text-primary flex items-center gap-1"><Cog className="w-3 h-3"/> অবজেক্ট প্রোপার্টিজ</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:bg-red-50" onClick={() => deleteObject(selectedObject.id)}>
                        <Trash2 className="w-4 h-4"/>
                      </Button>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-[10px]">লেবেল</Label>
                        <Input 
                          value={selectedObject.label} 
                          onChange={(e) => updateObject(selectedObject.id, { label: e.target.value })} 
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px]">দৈর্ঘ্য (ফুট)</Label>
                          <Input 
                            type="number" 
                            value={selectedObject.w} 
                            onChange={(e) => updateObject(selectedObject.id, { w: parseFloat(e.target.value) || 0 })} 
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px]">প্রস্থ (ফুট)</Label>
                          <Input 
                            type="number" 
                            value={selectedObject.h} 
                            onChange={(e) => updateObject(selectedObject.id, { h: parseFloat(e.target.value) || 0 })} 
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 text-[10px]" onClick={() => updateObject(selectedObject.id, { rotation: (selectedObject.rotation + 90) % 360 })}>
                          <RotateCcw className="w-3 h-3 mr-1"/> ঘুরাই
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Canvas Area (Professional Grid) */}
              <div className="flex-1 relative overflow-hidden bg-slate-200" 
                   onMouseMove={handleMouseMove} 
                   onMouseUp={() => setIsDragging(false)}
                   onMouseLeave={() => setIsDragging(false)}>
                
                {/* Floating Toolbar */}
                <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                  <div className="bg-white/80 backdrop-blur-sm p-1 rounded-lg shadow-lg border flex flex-col gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.min(50, z + 5))}><Plus className="w-4 h-4"/></Button>
                    <div className="h-px bg-slate-200 mx-1"/>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.max(10, z - 5))}><RotateCcw className="w-4 h-4 rotate-180"/></Button>
                  </div>
                  <Button variant="secondary" size="icon" className="h-10 w-10 shadow-lg" onClick={() => setDesignObjects([])} title="সব মুছুন"><Eraser className="w-5 h-5"/></Button>
                </div>

                <div className="absolute top-4 right-4 z-10 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                  স্কেল: ১ ঘর = ১ ফুট
                </div>

                {/* The Grid Workspace */}
                <div 
                  className="absolute inset-0 transition-all duration-75"
                  style={{ 
                    backgroundImage: `linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)`,
                    backgroundSize: `${zoom}px ${zoom}px`,
                    backgroundPosition: '0 0'
                  }}
                  onClick={() => setSelectedObjectId(null)}
                >
                  {designObjects.map(obj => (
                    <div
                      key={obj.id}
                      onMouseDown={(e) => handleMouseDown(e, obj.id)}
                      className={cn(
                        "absolute flex items-center justify-center border-2 transition-all cursor-move select-none",
                        selectedObjectId === obj.id ? "border-primary ring-4 ring-primary/20 z-20 shadow-xl" : "border-slate-400 z-10 shadow-sm",
                        obj.type === 'opening' ? "border-slate-800" : ""
                      )}
                      style={{
                        left: obj.x * zoom,
                        top: obj.y * zoom,
                        width: obj.w * zoom,
                        height: obj.h * zoom,
                        backgroundColor: obj.color,
                        transform: `rotate(${obj.rotation}deg)`,
                        borderRadius: obj.type === 'furniture' || obj.type === 'utility' ? '8px' : '0'
                      }}
                    >
                      <div className="flex flex-col items-center justify-center p-1 text-center">
                        <span className="text-[10px] font-bold text-slate-700 leading-tight">{obj.label}</span>
                        <span className="text-[8px] font-medium opacity-60">{obj.w}' × {obj.h}'</span>
                      </div>
                      
                      {/* Dimension Labels (Feet/Inches Indicator) */}
                      {selectedObjectId === obj.id && (
                        <>
                          <div className="absolute -top-6 left-0 right-0 flex items-center justify-center gap-1 text-[10px] font-black text-primary bg-white/90 px-1 rounded border border-primary/20">
                            <Ruler className="w-2 h-2"/> {obj.w} ফুট
                          </div>
                          <div className="absolute -right-14 top-0 bottom-0 flex items-center justify-center gap-1 text-[10px] font-black text-primary bg-white/90 px-1 rounded border border-primary/20 rotate-90">
                            <Ruler className="w-2 h-2"/> {obj.h} ফুট
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

// --- Library Item Component ---
function LibraryButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <Button 
      variant="outline" 
      className="flex flex-col h-20 w-full gap-2 p-2 hover:bg-primary/5 hover:border-primary transition-all group border-slate-200" 
      onClick={onClick}
    >
      <div className="text-slate-500 group-hover:text-primary transition-colors">
        {React.cloneElement(icon as React.ReactElement, { className: "w-6 h-6" })}
      </div>
      <span className="text-[10px] font-bold text-slate-600 group-hover:text-primary">{label}</span>
    </Button>
  );
}

// --- Helper Component for Result Display ---
function ResultItem({ label, value, unit, highlight }: { label: string, value: string | number, unit: string, highlight?: boolean }) {
  return (
    <div className={cn("flex justify-between items-center", highlight && "text-primary")}>
      <span className="text-sm font-medium">{label}:</span>
      <span className={cn("text-2xl font-black", highlight && "text-3xl")}>{value} <span className="text-sm font-normal text-muted-foreground">{unit}</span></span>
    </div>
  );
}
