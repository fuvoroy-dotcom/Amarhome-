"use client";

import React, { useState, useTransition } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building, Cog, BarChartBig, BrainCircuit, Loader2, Layers, Home, Paintbrush, ClipboardList, Trash2, RectangleHorizontal, Grid } from "lucide-react";
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
  FormMessage,
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
import { estimatorSchema, type EstimatorValues, brickEstimatorSchema, type BrickEstimatorValues, tileEstimatorSchema, type TileEstimatorValues, plasterEstimatorSchema, type PlasterEstimatorValues, fullHouseEstimatorSchema, type FullHouseEstimatorValues, slabEstimatorSchema, type SlabEstimatorValues, AiConstructionAdvisoryInputSchema } from "@/app/lib/schemas";
import { getConstructionAdvice } from "@/app/actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";


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


export default function EstimatorClient() {
  const [structuralResults, setStructuralResults] = useState<StructuralResults | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiAdvice, setAiAdvice] = useState("");
  const [isAiLoading, startAiTransition] = useTransition();
  const { toast } = useToast();

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

  function calculateMaterials(data: EstimatorValues) {
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
    const ratioSum = 5.5; // 1 + 1.5 + 3

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
  
  const [slabResults, setSlabResults] = useState<SlabResults | null>(null);
  const slabForm = useForm<SlabEstimatorValues>({
    resolver: zodResolver(slabEstimatorSchema),
    defaultValues: {
        slabLengthFt: 20,
        slabWidthFt: 15,
        slabThicknessIn: 5,
        slabRodGapIn: 6,
        mainRodFactor: 0.48,
    }
  });

  function calculateSlab(data: SlabEstimatorValues) {
    const { slabLengthFt, slabWidthFt, slabThicknessIn, slabRodGapIn, mainRodFactor } = data;
    const slabVol = slabLengthFt * slabWidthFt * (slabThicknessIn / 12);
    const dryVol = slabVol * 1.5;
    const ratioSum = 5.5; // 1 + 1.5 + 3

    const cementBags = Math.ceil((dryVol / ratioSum) / 1.25);
    const sandCFT = (dryVol / ratioSum) * 1.5;
    const chipsCFT = (dryVol / ratioSum) * 3;
    
    const slabRodLength = slabRodGapIn > 0 ? ((slabWidthFt / (slabRodGapIn / 12)) * slabLengthFt + (slabLengthFt / (slabRodGapIn / 12)) * slabWidthFt) : 0;
    const slabRodWeight = slabRodLength * mainRodFactor;

    setSlabResults({
        cement: cementBags,
        sand: parseFloat(sandCFT.toFixed(1)),
        chips: parseFloat(chipsCFT.toFixed(1)),
        rodWeight: parseFloat(slabRodWeight.toFixed(1)),
    });
  }


  const handleGetAdvice = () => {
    const structuralValues = structuralForm.getValues();
    const slabValues = slabForm.getValues();

    const combinedValues = {
        ...structuralValues,
        ...slabValues,
    };
    
    const validation = AiConstructionAdvisoryInputSchema.safeParse(combinedValues);

    if (!validation.success) {
      toast({
        variant: "destructive",
        title: "ত্রুটি",
        description: "AI পরামর্শের জন্য সমস্ত মান সঠিকভাবে পূরণ করুন।",
      });
      console.error(validation.error.flatten().fieldErrors);
      return;
    }

    setAiAdvice("");
    setIsAiModalOpen(true);
    startAiTransition(async () => {
        const response = await getConstructionAdvice(validation.data);
        if('advice' in response) {
            setAiAdvice(response.advice);
        } else {
            setAiAdvice(response.error);
            toast({
              variant: "destructive",
              title: "AI পরামর্শে ত্রুটি",
              description: response.error,
            });
        }
    });
  };

  const [brickResults, setBrickResults] = useState<BrickResults | null>(null);
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
  const { fields, append, remove } = useFieldArray({
    control: brickForm.control,
    name: "rooms"
  });

  function calculateBricks(data: BrickEstimatorValues) {
      const { calculationType, wallLengthFt, wallHeightFt, wallThicknessIn, rooms } = data;
      
      let totalLength = 0;
      if (calculationType === 'wall' && wallLengthFt) {
          totalLength = wallLengthFt;
      } else if (calculationType === 'rooms' && rooms) {
          totalLength = rooms.reduce((acc, room) => acc + (room.length + room.width) * 2, 0);
      }

      const area = totalLength * wallHeightFt;
      let bricks = 0;
      let cement = 0;
      let sand = 0;

      if (wallThicknessIn === '5') {
          bricks = area * 5;
          cement = (area / 100) * 0.6;
          sand = (area / 100) * 3;
      } else { // 10 inch
          bricks = area * 10;
          cement = (area / 100) * 1.2;
          sand = (area / 100) * 6;
      }

      setBrickResults({
          bricks: Math.ceil(bricks),
          cement: Math.ceil(cement),
          sand: parseFloat(sand.toFixed(1)),
      });
  }
  
  const [tileResults, setTileResults] = useState<TileResults | null>(null);
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

  function calculateTiles(data: TileEstimatorValues) {
      const { calculationType, floorLengthFt, floorWidthFt, walls, tileLengthIn, tileWidthIn, wastagePercent } = data;
      
      let totalArea = 0;
      if(calculationType === 'floor' && floorLengthFt && floorWidthFt) {
        totalArea = floorLengthFt * floorWidthFt;
      } else if (calculationType === 'walls' && walls) {
        totalArea = walls.reduce((acc, wall) => acc + (wall.length * wall.height), 0);
      }
      
      const tileArea = (tileLengthIn / 12) * (tileWidthIn / 12);
      
      if (tileArea === 0 || totalArea === 0) {
          setTileResults({ tiles: 0 });
          return;
      }

      const tilesNeeded = totalArea / tileArea;
      const totalTiles = Math.ceil(tilesNeeded * (1 + wastagePercent / 100));

      setTileResults({
          tiles: totalTiles
      });
  }

  const [plasterResults, setPlasterResults] = useState<PlasterResults | null>(null);
  const plasterForm = useForm<PlasterEstimatorValues>({
      resolver: zodResolver(plasterEstimatorSchema),
      defaultValues: {
          wallLengthFt: 12,
          wallHeightFt: 10,
          plasterThicknessIn: 0.5,
          plasterSides: '2',
      }
  });

  function calculatePlaster(data: PlasterEstimatorValues) {
      const { wallLengthFt, wallHeightFt, plasterThicknessIn, plasterSides } = data;
      const area = wallLengthFt * wallHeightFt * parseInt(plasterSides);
      const wetVol = area * (plasterThicknessIn / 12);
      const dryVol = wetVol * 1.33; // Mortar dry volume factor
      const ratioSum = 5; // 1:4 ratio
      const cementCFT = (dryVol / ratioSum) * 1;
      const cementBags = Math.ceil(cementCFT / 1.25);
      const sandCFT = (dryVol / ratioSum) * 4;

      setPlasterResults({
          cement: cementBags,
          sand: parseFloat(sandCFT.toFixed(1)),
      });
  }

  const [fullHouseResults, setFullHouseResults] = useState<FullHouseResults | null>(null);
    const fullHouseForm = useForm<FullHouseEstimatorValues>({
        resolver: zodResolver(fullHouseEstimatorSchema),
        defaultValues: {
            floorCount: 1,
            totalAreaSqFt: 1000,
            roomCount: 3,
            bathroomCount: 2,
            kitchenCount: 1,
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

    function calculateFullHouse(data: FullHouseEstimatorValues) {
        const {
            floorCount, totalAreaSqFt, roomCount, bathroomCount, 
            avgRoomLengthFt, avgRoomWidthFt, floorHeightFt, columnCountPerFloor,
            slabThicknessIn, wallThicknessIn, tileFloors, tileBathroomWalls,
            bathroomWallTileHeightFt, plasterInterior, plasterExterior,
            mainRodFactor, ringRodFactor, ringGapIn
        } = data;

        // --- STRUCTURAL CALCULATION (ASSUMPTIONS) ---
        // Foundation: 1.5ft avg thickness
        const foundationVol = totalAreaSqFt * 1.5; 
        // Columns: 12"x12" avg size
        const totalColumns = columnCountPerFloor * floorCount;
        const columnVol = (12/12) * (12/12) * floorHeightFt * totalColumns; 
        // Beams: length is ~2.5x sqrt of area, 10"x12" avg size
        const beamLengthPerFloor = Math.sqrt(totalAreaSqFt) * 2.5;
        const totalBeamLength = beamLengthPerFloor * floorCount;
        const beamVol = (10/12) * (12/12) * totalBeamLength;
        // Slabs
        const totalSlabArea = totalAreaSqFt * floorCount;
        const slabVol = totalSlabArea * (slabThicknessIn / 12);
        
        const totalWetVol = foundationVol + columnVol + beamVol + slabVol;
        const dryVol = totalWetVol * 1.5;
        const ratioSum = 5.5; // 1:1.5:3

        const structuralCement = (dryVol / ratioSum) / 1.25;
        const structuralSand = (dryVol / ratioSum) * 1.5;
        const structuralChips = (dryVol / ratioSum) * 3;

        // --- ROD CALCULATION (ASSUMPTIONS) ---
        // Foundation: rods @ 6" c/c both ways
        const foundationRodLength = (Math.sqrt(totalAreaSqFt) / 0.5) * Math.sqrt(totalAreaSqFt) * 2;
        const foundationRodWeight = foundationRodLength * mainRodFactor;
        // Columns: 6 rods/column
        const columnRodLength = totalColumns * floorHeightFt * 6;
        // Beams: 6 rods/beam
        const beamRodLength = totalBeamLength * 6;
        // Slabs: rods @ 6" c/c both ways (simplified)
        const slabRodLength = (totalSlabArea / 0.5) * 2;
        const totalMainRodWeight = (columnRodLength + beamRodLength + slabRodLength) * mainRodFactor + foundationRodWeight;
        // Rings: for 12x12 col and 10x12 beam
        const ringCountCol = ringGapIn > 0 ? (floorHeightFt * 12) / ringGapIn : 0;
        const ringLenCol = ((12 / 12) + (12 / 12)) * 2;
        const totalRingWeightCol = ringCountCol * ringLenCol * totalColumns * ringRodFactor;
        const ringCountBeam = ringGapIn > 0 ? (totalBeamLength * 12) / ringGapIn : 0;
        const ringLenBeam = ((10 / 12) + (12 / 12)) * 2;
        const totalRingWeightBeam = ringCountBeam * ringLenBeam * ringRodFactor;
        const totalRingRodWeight = totalRingWeightCol + totalRingWeightBeam;
        const totalRodWeight = totalMainRodWeight + totalRingRodWeight;

        // --- BRICK CALCULATION (ASSUMPTIONS) ---
        const perimeter = Math.sqrt(totalAreaSqFt) * 4;
        const exteriorWallArea = perimeter * floorHeightFt * floorCount;
        // Interior walls: simplified based on room count
        const interiorWallLength = (avgRoomLengthFt * 1.5 + avgRoomWidthFt) * roomCount * floorCount;
        const interiorWallArea = interiorWallLength * floorHeightFt;
        const totalWallArea = exteriorWallArea + interiorWallArea;
        const bricksPerSft = wallThicknessIn === '5' ? 5 : 10;
        const brickCementPer100Sft = wallThicknessIn === '5' ? 0.6 : 1.2;
        const brickSandPer100Sft = wallThicknessIn === '5' ? 3 : 6;
        const totalBricks = totalWallArea * bricksPerSft;
        const masonryCement = (totalWallArea / 100) * brickCementPer100Sft;
        const masonrySand = (totalWallArea / 100) * brickSandPer100Sft;
        
        // --- PLASTER CALCULATION (ASSUMPTIONS) ---
        let plasterArea = 0;
        if (plasterExterior) plasterArea += exteriorWallArea; // Outside
        if (plasterInterior) plasterArea += (exteriorWallArea + interiorWallArea) * 2; // Inside walls both sides
        const plasterWetVol = plasterArea * (0.5 / 12); // 0.5" thickness
        const plasterDryVol = plasterWetVol * 1.33;
        const plasterRatioSum = 5; // 1:4
        const plasterCement = ((plasterDryVol / plasterRatioSum) * 1) / 1.25;
        const plasterSand = (plasterDryVol / plasterRatioSum) * 4;
        
        // --- TILE CALCULATION (ASSUMPTIONS) ---
        let totalTiles = 0;
        // Assume 12"x12" tiles (1 sft)
        if (tileFloors) {
            const floorArea = totalAreaSqFt * floorCount;
            totalTiles += floorArea;
        }
        if (tileBathroomWalls) {
            // Assume avg bathroom perimeter of (8+6)*2 = 28ft
            const bathroomWallArea = 28 * bathroomWallTileHeightFt * bathroomCount * floorCount;
            totalTiles += bathroomWallArea;
        }
        totalTiles = totalTiles * 1.1; // 10% wastage

        setFullHouseResults({
            totalCement: Math.ceil(structuralCement + masonryCement + plasterCement),
            totalSand: parseFloat((structuralSand + masonrySand + plasterSand).toFixed(1)),
            totalChips: parseFloat(structuralChips.toFixed(1)),
            totalRodWeight: parseFloat(totalRodWeight.toFixed(1)),
            totalBricks: Math.ceil(totalBricks),
            totalTiles: Math.ceil(totalTiles),
        });
    }

  return (
    <>
    <div className="w-full max-w-6xl">
        <Card className="w-full overflow-hidden shadow-2xl border-border/40">
            <div className="bg-primary p-5 text-primary-foreground text-center">
                <h1 className="text-3xl font-bold">পূর্ণাঙ্গ কনস্ট্রাকশন ক্যালকুলেটর</h1>
                <p className="text-primary-foreground/80 text-sm mt-1">স্ট্রাকচার, গাঁথুনি, প্লাস্টার ও টাইলসের সমন্বিত হিসাব</p>
            </div>
            
            <Tabs defaultValue="structural" className="w-full">
                <TabsList className="grid w-full grid-cols-6 rounded-none h-auto">
                    <TabsTrigger value="structural" className="py-3 rounded-none text-base data-[state=active]:shadow-inner data-[state=active]:bg-background/50">
                        <Building className="mr-2 h-5 w-5" />
                        স্ট্রাকচার
                    </TabsTrigger>
                     <TabsTrigger value="slab" className="py-3 rounded-none text-base data-[state=active]:shadow-inner data-[state=active]:bg-background/50">
                        <Grid className="mr-2 h-5 w-5" />
                        ছাদ
                    </TabsTrigger>
                    <TabsTrigger value="brick" className="py-3 rounded-none text-base data-[state=active]:shadow-inner data-[state=active]:bg-background/50">
                        <Layers className="mr-2 h-5 w-5" />
                        গাঁথুনি
                    </TabsTrigger>
                    <TabsTrigger value="plaster" className="py-3 rounded-none text-base data-[state=active]:shadow-inner data-[state=active]:bg-background/50">
                        <Paintbrush className="mr-2 h-5 w-5" />
                        প্লাস্টার
                    </TabsTrigger>
                    <TabsTrigger value="tile" className="py-3 rounded-none text-base data-[state=active]:shadow-inner data-[state=active]:bg-background/50">
                        <RectangleHorizontal className="mr-2 h-5 w-5" />
                        টাইলস
                    </TabsTrigger>
                    <TabsTrigger value="fullHouse" className="py-3 rounded-none text-base data-[state=active]:shadow-inner data-[state=active]:bg-background/50">
                        <ClipboardList className="mr-2 h-5 w-5" />
                        পূর্ণাঙ্গ বাড়ি
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="structural" className="p-0">
                    <Form {...structuralForm}>
                        <form onSubmit={structuralForm.handleSubmit(calculateMaterials)} className="p-4 md:p-6">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                
                                <div className="space-y-4">
                                    <h2 className="font-bold text-lg text-primary border-b pb-2 flex items-center gap-2">
                                        <Building className="w-5 h-5" />
                                        কাঠামোর মাপ (Dimensions)
                                    </h2>
                                    <div className="bg-card p-4 rounded-xl space-y-6 border">

                                        <div className="space-y-3">
                                            <FormLabel className="font-bold text-muted-foreground">হিসাবের অংশ নির্বাচন করুন</FormLabel>
                                            <div className="flex flex-wrap gap-x-4 gap-y-2">
                                                <FormField
                                                    control={structuralForm.control}
                                                    name="includeBase"
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                                            <FormControl>
                                                                <Checkbox
                                                                    checked={field.value}
                                                                    onCheckedChange={field.onChange}
                                                                />
                                                            </FormControl>
                                                            <FormLabel className="font-normal">
                                                                বেস / ভিত্তি
                                                            </FormLabel>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={structuralForm.control}
                                                    name="includeColumn"
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                                            <FormControl>
                                                                <Checkbox
                                                                    checked={field.value}
                                                                    onCheckedChange={field.onChange}
                                                                />
                                                            </FormControl>
                                                            <FormLabel className="font-normal">
                                                                কলাম
                                                            </FormLabel>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={structuralForm.control}
                                                    name="includeBeam"
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                                            <FormControl>
                                                                <Checkbox
                                                                    checked={field.value}
                                                                    onCheckedChange={field.onChange}
                                                                />
                                                            </FormControl>
                                                            <FormLabel className="font-normal">
                                                                বিম
                                                            </FormLabel>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-3">
                                            <FormLabel className="font-bold text-muted-foreground">বেস / ভিত্তি</FormLabel>
                                            <div className="grid grid-cols-2 gap-2">
                                                <FormField control={structuralForm.control} name="baseCount" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">বেসের সংখ্যা (টি)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage className="text-xs" /></FormItem>
                                                )} />
                                                 <FormField control={structuralForm.control} name="baseThicknessIn" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">পুরুত্ব (ইঞ্চি)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage className="text-xs" /></FormItem>
                                                )} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <FormField control={structuralForm.control} name="baseLengthFt" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">লম্বা (ফুট)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage className="text-xs" /></FormItem>
                                                )} />
                                                <FormField control={structuralForm.control} name="baseWidthFt" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">চওড়া (ফুট)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage className="text-xs" /></FormItem>
                                                )} />
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-3">
                                            <FormLabel className="font-bold text-muted-foreground">কলাম</FormLabel>
                                             <div className="grid grid-cols-2 gap-2">
                                                <FormField control={structuralForm.control} name="columnCount" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">কলামের সংখ্যা (টি)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage className="text-xs" /></FormItem>
                                                )} />
                                                 <FormField control={structuralForm.control} name="columnHeightFt" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">মোট উচ্চতা (ফুট)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage className="text-xs" /></FormItem>
                                                )} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <FormField control={structuralForm.control} name="columnLengthIn" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">দৈর্ঘ্য (ইঞ্চি)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage className="text-xs" /></FormItem>
                                                )} />
                                                <FormField control={structuralForm.control} name="columnWidthIn" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">প্রস্থ (ইঞ্চি)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage className="text-xs" /></FormItem>
                                                )} />
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <FormLabel className="font-bold text-muted-foreground">বিম</FormLabel>
                                            <FormField control={structuralForm.control} name="beamLengthFt" render={({ field }) => (
                                                <FormItem><FormLabel className="text-xs">মোট দৈর্ঘ্য (ফুট)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage className="text-xs" /></FormItem>
                                            )} />
                                            <div className="grid grid-cols-2 gap-2">
                                                <FormField control={structuralForm.control} name="beamHeightIn" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">উচ্চতা (ইঞ্চি)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage className="text-xs" /></FormItem>
                                                )} />
                                                <FormField control={structuralForm.control} name="beamWidthIn" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">প্রস্থ (ইঞ্চি)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage className="text-xs" /></FormItem>
                                                )} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h2 className="font-bold text-lg text-primary border-b pb-2 flex items-center gap-2">
                                        <Cog className="w-5 h-5" />
                                        রড সেটিংস (Steel)
                                    </h2>
                                    <div className="bg-card p-4 rounded-xl space-y-6 border">
                                        <div className="space-y-3">
                                            <FormLabel className="font-bold text-muted-foreground">রডের সংখ্যা (টি)</FormLabel>
                                            <div className="grid grid-cols-2 gap-2">
                                                <FormField control={structuralForm.control} name="columnRodCount" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">কলাম রড</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage className="text-xs" /></FormItem>
                                                )} />
                                                <FormField control={structuralForm.control} name="beamRodCount" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">বিম রড</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage className="text-xs" /></FormItem>
                                                )} />
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <FormLabel className="font-bold text-muted-foreground">বেসের জালি (রড সংখ্যা)</FormLabel>
                                            <div className="grid grid-cols-2 gap-2">
                                                <FormField control={structuralForm.control} name="baseRodLongitudinalCount" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">লম্বালম্বি রড</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage className="text-xs" /></FormItem>
                                                )} />
                                                <FormField control={structuralForm.control} name="baseRodWidthCount" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">আড়াআড়ি রড</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage className="text-xs" /></FormItem>
                                                )} />
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-3">
                                            <FormLabel className="font-bold text-muted-foreground">রডের ব্যাস ও গ্যাপ</FormLabel>
                                            <FormField control={structuralForm.control} name="mainRodFactor" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs">প্রধান রড (বেস, কলাম, বিম)</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={String(field.value)}>
                                                        <FormControl><SelectTrigger><SelectValue placeholder="প্রধান রড..." /></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="0.48">১৬ মিলি (৫ সুতা)</SelectItem>
                                                            <SelectItem value="0.30">১২ মিলি (৪ সুতা)</SelectItem>
                                                            <SelectItem value="0.75">২০ মিলি (৬ সুতা)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )} />
                                            <div className="grid grid-cols-2 gap-2">
                                                <FormField control={structuralForm.control} name="ringRodFactor" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs">রিং রড</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={String(field.value)}>
                                                            <FormControl><SelectTrigger><SelectValue placeholder="রিং রড..." /></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="0.12">৮ মিলি রিং</SelectItem>
                                                                <SelectItem value="0.19">১০ মিলি রিং</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )} />
                                                <FormField control={structuralForm.control} name="ringGapIn" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">রিং গ্যাপ (ইঞ্চি)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage className="text-xs" /></FormItem>
                                                )} />
                                            </div>
                                        </div>
                                    </div>
                                    <Button type="submit" className="w-full font-bold py-3 text-lg rounded-xl shadow-lg transition-transform active:scale-[0.98]">
                                        হিসাব করুন
                                    </Button>
                                </div>
                                
                                <div className="space-y-4">
                                    <h2 className="font-bold text-lg text-primary border-b pb-2 flex items-center gap-2">
                                        <BarChartBig className="w-5 h-5" />
                                        ফলাফল (Result)
                                    </h2>
                                    {structuralResults ? (
                                        <div className="space-y-4">
                                            <ResultDisplay results={structuralResults} />
                                            <Button onClick={handleGetAdvice} variant="outline" className="w-full font-bold py-3 rounded-xl shadow-lg transition-transform active:scale-[0.98]">
                                                <BrainCircuit className="mr-2 h-5 w-5" />
                                                AI থেকে পরামর্শ নিন
                                            </Button>
                                            <p className="text-[10px] text-muted-foreground text-center">* ১:১.৫:৩ মিক্স রেশিও ধরে হিসেবকৃত।</p>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center h-full bg-muted/50 rounded-xl border border-dashed">
                                            <p className="text-muted-foreground p-8 text-center">ফলাফল এখানে দেখানো হবে।</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </form>
                    </Form>
                </TabsContent>
                <TabsContent value="slab" className="p-0">
                     <Form {...slabForm}>
                        <form onSubmit={slabForm.handleSubmit(calculateSlab)} className="p-4 md:p-6">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 space-y-6">
                                     <h2 className="font-bold text-lg text-primary border-b pb-2 flex items-center gap-2">
                                        <Grid className="w-5 h-5" />
                                        ছাদের মাপ ও রড (Slab Dimensions & Steel)
                                    </h2>
                                    <div className="bg-card p-4 rounded-xl space-y-6 border">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <FormField control={slabForm.control} name="slabLengthFt" render={({ field }) => (
                                                <FormItem><FormLabel>ছাদের দৈর্ঘ্য (ফুট)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                                            )} />
                                            <FormField control={slabForm.control} name="slabWidthFt" render={({ field }) => (
                                                <FormItem><FormLabel>ছাদের প্রস্থ (ফুট)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                                            )} />
                                        </div>
                                        <FormField control={slabForm.control} name="slabThicknessIn" render={({ field }) => (
                                            <FormItem><FormLabel>ছাদের পুরুত্ব (ইঞ্চি)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                             <FormField control={slabForm.control} name="mainRodFactor" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs">প্রধান রড</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={String(field.value)}>
                                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="0.48">১৬ মিলি (৫ সুতা)</SelectItem>
                                                            <SelectItem value="0.30">১২ মিলি (৪ সুতা)</SelectItem>
                                                            <SelectItem value="0.75">২০ মিলি (৬ সুতা)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )} />
                                             <FormField control={slabForm.control} name="slabRodGapIn" render={({ field }) => (
                                                <FormItem><FormLabel>রডের গ্যাপ (ইঞ্চি)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                                            )} />
                                        </div>
                                    </div>
                                    <Button type="submit" className="w-full font-bold py-3 text-lg rounded-xl shadow-lg transition-transform active:scale-[0.98]">
                                        ছাদের হিসাব করুন
                                    </Button>
                                </div>
                                <div className="space-y-4">
                                    <h2 className="font-bold text-lg text-primary border-b pb-2 flex items-center gap-2">
                                        <BarChartBig className="w-5 h-5" />
                                        ফলাফল (Result)
                                    </h2>
                                    {slabResults ? (
                                        <SlabResultDisplay results={slabResults} />
                                    ) : (
                                        <div className="flex items-center justify-center h-full bg-muted/50 rounded-xl border border-dashed">
                                            <p className="text-muted-foreground p-8 text-center">ফলাফল এখানে দেখানো হবে।</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </form>
                    </Form>
                </TabsContent>
                <TabsContent value="brick" className="p-0">
                    <Form {...brickForm}>
                        <form onSubmit={brickForm.handleSubmit(calculateBricks)} className="p-4 md:p-6">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 space-y-6">
                                     <h2 className="font-bold text-lg text-primary border-b pb-2 flex items-center gap-2">
                                        <Layers className="w-5 h-5" />
                                        দেয়ালের মাপ (Wall Dimensions)
                                    </h2>
                                    <div className="bg-card p-4 rounded-xl space-y-6 border">
                                        <FormField control={brickForm.control} name="calculationType" render={({ field }) => (
                                            <FormItem className="space-y-3">
                                            <FormLabel>হিসাবের ধরণ</FormLabel>
                                            <FormControl>
                                                <RadioGroup
                                                onValueChange={field.onChange}
                                                defaultValue={field.value}
                                                className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-6 pt-2"
                                                >
                                                <FormItem className="flex items-center space-x-2">
                                                    <FormControl><RadioGroupItem value="wall" id="type_wall" /></FormControl>
                                                    <FormLabel htmlFor="type_wall" className="font-normal text-base">একক প্রাচীর</FormLabel>
                                                </FormItem>
                                                <FormItem className="flex items-center space-x-2">
                                                    <FormControl><RadioGroupItem value="rooms" id="type_rooms" /></FormControl>
                                                    <FormLabel htmlFor="type_rooms" className="font-normal text-base">একাধিক রুম</FormLabel>
                                                </FormItem>
                                                </RadioGroup>
                                            </FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )} />
                                        
                                        {brickCalculationType === 'wall' && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <FormField control={brickForm.control} name="wallLengthFt" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>প্রাচীরের দৈর্ঘ্য (ফুট)</FormLabel>
                                                        <FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                                <FormField control={brickForm.control} name="wallHeightFt" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>প্রাচীরের উচ্চতা (ফুট)</FormLabel>
                                                        <FormControl><Input type="number" {...field} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                            </div>
                                        )}

                                        {brickCalculationType === 'rooms' && (
                                            <>
                                                <FormField control={brickForm.control} name="wallHeightFt" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>রুমের গড় উচ্চতা (ফুট)</FormLabel>
                                                        <FormControl><Input type="number" {...field} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                                <div className="space-y-3">
                                                    <Label>রুমের মাপ (দৈর্ঘ্য ও প্রস্থ ফুট হিসাবে)</Label>
                                                    {fields.map((item, index) => (
                                                        <div key={item.id} className="flex items-end gap-2 p-2 border rounded-md bg-muted/50">
                                                            <p className="text-sm font-medium text-muted-foreground pt-7">{index + 1}.</p>
                                                            <FormField
                                                                control={brickForm.control}
                                                                name={`rooms.${index}.length`}
                                                                render={({ field }) => (
                                                                    <FormItem className="flex-1">
                                                                        <FormLabel className="text-xs">দৈর্ঘ্য (ফুট)</FormLabel>
                                                                        <FormControl><Input type="number" placeholder="_._" {...field} /></FormControl>
                                                                        <FormMessage className="text-xs" />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                            <FormField
                                                                control={brickForm.control}
                                                                name={`rooms.${index}.width`}
                                                                render={({ field }) => (
                                                                    <FormItem className="flex-1">
                                                                        <FormLabel className="text-xs">প্রস্থ (ফুট)</FormLabel>
                                                                        <FormControl><Input type="number" placeholder="." {...field} /></FormControl>
                                                                        <FormMessage className="text-xs" />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                            <Button
                                                                type="button"
                                                                variant="destructive"
                                                                size="icon"
                                                                onClick={() => remove(index)}
                                                                disabled={fields.length <= 1}
                                                                className="shrink-0"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                     <FormMessage>{brickForm.formState.errors.rooms?.root?.message || brickForm.formState.errors.rooms?.message}</FormMessage>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => append({ length: 12, width: 10 })}
                                                    className="w-full"
                                                >
                                                    নতুন রুম যোগ করুন
                                                </Button>
                                            </>
                                        )}


                                        <FormField control={brickForm.control} name="wallThicknessIn" render={({ field }) => (
                                            <FormItem className="space-y-3">
                                            <FormLabel>দেয়ালের পুরুত্ব (ইঞ্চি)</FormLabel>
                                            <FormControl>
                                                <RadioGroup
                                                onValueChange={field.onChange}
                                                defaultValue={field.value}
                                                className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-6 pt-2"
                                                >
                                                <FormItem className="flex items-center space-x-2">
                                                    <FormControl><RadioGroupItem value="5" id="t5" /></FormControl>
                                                    <FormLabel htmlFor="t5" className="font-normal text-base">৫"</FormLabel>
                                                </FormItem>
                                                <FormItem className="flex items-center space-x-2">
                                                    <FormControl><RadioGroupItem value="10" id="t10" /></FormControl>
                                                    <FormLabel htmlFor="t10" className="font-normal text-base">১০"</FormLabel>
                                                </FormItem>
                                                </RadioGroup>
                                            </FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )} />
                                    </div>
                                    <Button type="submit" className="w-full font-bold py-3 text-lg rounded-xl shadow-lg transition-transform active:scale-[0.98]">
                                        ইটের হিসাব করুন
                                    </Button>
                                </div>
                                <div className="space-y-4">
                                    <h2 className="font-bold text-lg text-primary border-b pb-2 flex items-center gap-2">
                                        <BarChartBig className="w-5 h-5" />
                                        ফলাফল (Result)
                                    </h2>
                                    {brickResults ? (
                                        <div className="space-y-4">
                                            <div className="bg-card p-5 rounded-2xl border-2 shadow-inner">
                                                <div className="grid grid-cols-1 gap-4">
                                                    <div className="text-center p-3 bg-orange-400/10 rounded-lg border border-orange-500/30">
                                                        <span className="text-xs text-orange-600 font-bold uppercase">ইট (সংখ্যা)</span>
                                                        <p className="text-4xl font-black text-slate-800">{brickResults.bricks}</p>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="p-3 bg-muted/50 rounded-lg text-center">
                                                            <span className="text-[10px] text-muted-foreground uppercase font-bold">সিমেন্ট (ব্যাগ)</span>
                                                            <p className="text-xl font-bold text-primary">{brickResults.cement}</p>
                                                        </div>
                                                        <div className="p-3 bg-muted/50 rounded-lg text-center">
                                                            <span className="text-[10px] text-muted-foreground uppercase font-bold">বালু (CFT)</span>
                                                            <p className="text-xl font-bold text-primary">{brickResults.sand}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground text-center">* দেয়ালের ক্ষেত্রফল অনুযায়ী আনুমানিক হিসাব।</p>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center h-full bg-muted/50 rounded-xl border border-dashed">
                                            <p className="text-muted-foreground p-8 text-center">ফলাফল এখানে দেখানো হবে।</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </form>
                    </Form>
                </TabsContent>
                <TabsContent value="plaster" className="p-0">
                    <Form {...plasterForm}>
                        <form onSubmit={plasterForm.handleSubmit(calculatePlaster)} className="p-4 md:p-6">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 space-y-6">
                                     <h2 className="font-bold text-lg text-primary border-b pb-2 flex items-center gap-2">
                                        <Paintbrush className="w-5 h-5" />
                                        প্লাস্টারের মাপ (Plaster Dimensions)
                                    </h2>
                                    <div className="bg-card p-4 rounded-xl space-y-6 border">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <FormField control={plasterForm.control} name="wallLengthFt" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>দেয়ালের দৈর্ঘ্য (ফুট)</FormLabel>
                                                    <FormControl><Input type="number" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <FormField control={plasterForm.control} name="wallHeightFt" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>দেয়ালের উচ্চতা (ফুট)</FormLabel>
                                                    <FormControl><Input type="number" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        </div>
                                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <FormField control={plasterForm.control} name="plasterThicknessIn" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>প্লাস্টারের পুরুত্ব (ইঞ্চি)</FormLabel>
                                                    <FormControl><Input type="number" step="0.25" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <FormField control={plasterForm.control} name="plasterSides" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>দেয়ালের পাশ</FormLabel>
                                                     <Select onValueChange={field.onChange} defaultValue={String(field.value)}>
                                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="1">১ পাশ</SelectItem>
                                                            <SelectItem value="2">২ পাশ</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        </div>
                                    </div>
                                    <Button type="submit" className="w-full font-bold py-3 text-lg rounded-xl shadow-lg transition-transform active:scale-[0.98]">
                                        প্লাস্টারের হিসাব করুন
                                    </Button>
                                </div>
                                <div className="space-y-4">
                                    <h2 className="font-bold text-lg text-primary border-b pb-2 flex items-center gap-2">
                                        <BarChartBig className="w-5 h-5" />
                                        ফলাফল (Result)
                                    </h2>
                                    {plasterResults ? (
                                        <div className="space-y-4">
                                            <div className="bg-card p-5 rounded-2xl border-2 shadow-inner">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="p-3 bg-muted/50 rounded-lg text-center">
                                                        <span className="text-[10px] text-muted-foreground uppercase font-bold">সিমেন্ট (ব্যাগ)</span>
                                                        <p className="text-2xl font-bold text-primary">{plasterResults.cement}</p>
                                                    </div>
                                                    <div className="p-3 bg-muted/50 rounded-lg text-center">
                                                        <span className="text-[10px] text-muted-foreground uppercase font-bold">বালু (CFT)</span>
                                                        <p className="text-2xl font-bold text-primary">{plasterResults.sand}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground text-center">* ১:৪ মিক্স রেশিও ধরে আনুমানিক হিসাব।</p>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center h-full bg-muted/50 rounded-xl border border-dashed">
                                            <p className="text-muted-foreground p-8 text-center">ফলাফল এখানে দেখানো হবে।</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </form>
                    </Form>
                </TabsContent>
                 <TabsContent value="tile" className="p-0">
                    <Form {...tileForm}>
                        <form onSubmit={tileForm.handleSubmit(calculateTiles)} className="p-4 md:p-6">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 space-y-6">
                                     <h2 className="font-bold text-lg text-primary border-b pb-2 flex items-center gap-2">
                                        <RectangleHorizontal className="w-5 h-5" />
                                        টাইলসের মাপ (Tile Dimensions)
                                    </h2>
                                    <div className="bg-card p-4 rounded-xl space-y-6 border">
                                        <FormField control={tileForm.control} name="calculationType" render={({ field }) => (
                                            <FormItem className="space-y-3">
                                            <FormLabel>হিসাবের ধরণ</FormLabel>
                                            <FormControl>
                                                <RadioGroup
                                                onValueChange={field.onChange}
                                                defaultValue={field.value}
                                                className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-6 pt-2"
                                                >
                                                <FormItem className="flex items-center space-x-2">
                                                    <FormControl><RadioGroupItem value="floor" id="type_floor" /></FormControl>
                                                    <FormLabel htmlFor="type_floor" className="font-normal text-base">ফ্লোর</FormLabel>
                                                </FormItem>
                                                <FormItem className="flex items-center space-x-2">
                                                    <FormControl><RadioGroupItem value="walls" id="type_wall_tile" /></FormControl>
                                                    <FormLabel htmlFor="type_wall_tile" className="font-normal text-base">একাধিক দেয়াল</FormLabel>
                                                </FormItem>
                                                </RadioGroup>
                                            </FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )} />
                                        
                                        {tileCalculationType === 'floor' && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <FormField control={tileForm.control} name="floorLengthFt" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>ফ্লোরের দৈর্ঘ্য (ফুট)</FormLabel>
                                                        <FormControl><Input type="number" placeholder="যেমন: ১২" {...field} value={field.value ?? ''} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                                <FormField control={tileForm.control} name="floorWidthFt" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>ফ্লোরের প্রস্থ (ফুট)</FormLabel>
                                                        <FormControl><Input type="number" placeholder="যেমন: ১০" {...field} value={field.value ?? ''}/></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                            </div>
                                        )}

                                        {tileCalculationType === 'walls' && (
                                            <div className="space-y-3">
                                                <Label>দেয়ালের মাপ (দৈর্ঘ্য ও উচ্চতা ফুট হিসাবে)</Label>
                                                {wallFields.map((item, index) => (
                                                    <div key={item.id} className="flex items-end gap-2 p-2 border rounded-md bg-muted/50">
                                                        <p className="text-sm font-medium text-muted-foreground pt-7">{index + 1}.</p>
                                                        <FormField
                                                            control={tileForm.control}
                                                            name={`walls.${index}.length`}
                                                            render={({ field }) => (
                                                                <FormItem className="flex-1">
                                                                    <FormLabel className="text-xs">দৈর্ঘ্য (ফুট)</FormLabel>
                                                                    <FormControl><Input type="number" placeholder="দৈর্ঘ্য" {...field} /></FormControl>
                                                                    <FormMessage className="text-xs" />
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <FormField
                                                            control={tileForm.control}
                                                            name={`walls.${index}.height`}
                                                            render={({ field }) => (
                                                                <FormItem className="flex-1">
                                                                    <FormLabel className="text-xs">উচ্চতা (ফুট)</FormLabel>
                                                                    <FormControl><Input type="number" placeholder="উচ্চতা" {...field} /></FormControl>
                                                                    <FormMessage className="text-xs" />
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="destructive"
                                                            size="icon"
                                                            onClick={() => removeWall(index)}
                                                            disabled={wallFields.length <= 1}
                                                            className="shrink-0"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                                <FormMessage>{tileForm.formState.errors.walls?.root?.message || tileForm.formState.errors.walls?.message}</FormMessage>
                                                 <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => appendWall({ length: 10, height: 10 })}
                                                    className="w-full"
                                                >
                                                    নতুন দেয়াল যোগ করুন
                                                </Button>
                                            </div>
                                        )}
                                        
                                         <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t">
                                            <FormField control={tileForm.control} name="tileLengthIn" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>টাইলসের দৈর্ঘ্য (ইঞ্চি)</FormLabel>
                                                    <FormControl><Input type="number" placeholder="যেমন: ১২" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <FormField control={tileForm.control} name="tileWidthIn" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>টাইলসের প্রস্থ (ইঞ্চি)</FormLabel>
                                                    <FormControl><Input type="number" placeholder="যেমন: ১২" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <FormField control={tileForm.control} name="wastagePercent" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>অপচয় (%)</FormLabel>
                                                    <FormControl><Input type="number" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        </div>
                                    </div>
                                    <Button type="submit" className="w-full font-bold py-3 text-lg rounded-xl shadow-lg transition-transform active:scale-[0.98]">
                                        টাইলসের হিসাব করুন
                                    </Button>
                                </div>
                                <div className="space-y-4">
                                    <h2 className="font-bold text-lg text-primary border-b pb-2 flex items-center gap-2">
                                        <BarChartBig className="w-5 h-5" />
                                        ফলাফল (Result)
                                    </h2>
                                    {tileResults ? (
                                        <div className="space-y-4">
                                            <div className="bg-card p-5 rounded-2xl border-2 shadow-inner">
                                                <div className="text-center p-3 bg-cyan-400/10 rounded-lg border border-cyan-500/30">
                                                    <span className="text-xs text-cyan-600 font-bold uppercase">প্রয়োজনীয় টাইলস (সংখ্যা)</span>
                                                    <p className="text-4xl font-black text-slate-800">{tileResults.tiles}</p>
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground text-center">* অপচয় সহ আনুমানিক হিসাব।</p>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center h-full bg-muted/50 rounded-xl border border-dashed">
                                            <p className="text-muted-foreground p-8 text-center">ফলাফল এখানে দেখানো হবে।</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </form>
                    </Form>
                </TabsContent>
                <TabsContent value="fullHouse" className="p-0">
                    <Form {...fullHouseForm}>
                        <form onSubmit={fullHouseForm.handleSubmit(calculateFullHouse)} className="p-4 md:p-6">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 space-y-6">
                                    <h2 className="font-bold text-lg text-primary border-b pb-2 flex items-center gap-2">
                                        <ClipboardList className="w-5 h-5" />
                                        বাড়ির তথ্য (House Details)
                                    </h2>
                                    <div className="bg-card p-4 rounded-xl space-y-6 border">
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField control={fullHouseForm.control} name="floorCount" render={({ field }) => (
                                                <FormItem><FormLabel>ফ্লোর সংখ্যা</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                                            )} />
                                            <FormField control={fullHouseForm.control} name="totalAreaSqFt" render={({ field }) => (
                                                <FormItem><FormLabel>প্রতি ফ্লোরের ক্ষেত্রফল (বর্গফুট)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                                            )} />
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                             <FormField control={fullHouseForm.control} name="roomCount" render={({ field }) => (
                                                <FormItem><FormLabel>রুম (প্রতি ফ্লোর)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                                            )} />
                                             <FormField control={fullHouseForm.control} name="bathroomCount" render={({ field }) => (
                                                <FormItem><FormLabel>বাথরুম (প্রতি ফ্লোর)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                                            )} />
                                             <FormField control={fullHouseForm.control} name="avgRoomLengthFt" render={({ field }) => (
                                                <FormItem><FormLabel>গড় দৈর্ঘ্য (ফুট)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                                            )} />
                                            <FormField control={fullHouseForm.control} name="avgRoomWidthFt" render={({ field }) => (
                                                <FormItem><FormLabel>গড় প্রস্থ (ফুট)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                                            )} />
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                            <FormField control={fullHouseForm.control} name="floorHeightFt" render={({ field }) => (
                                                <FormItem><FormLabel>ফ্লোরের উচ্চতা (ফুট)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                                            )} />
                                            <FormField control={fullHouseForm.control} name="columnCountPerFloor" render={({ field }) => (
                                                <FormItem><FormLabel>কলাম (প্রতি ফ্লোর)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                                            )} />
                                            <FormField control={fullHouseForm.control} name="slabThicknessIn" render={({ field }) => (
                                                <FormItem><FormLabel>ছাদের পুরুত্ব (ইঞ্চি)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                                            )} />
                                             <FormField control={fullHouseForm.control} name="wallThicknessIn" render={({ field }) => (
                                                <FormItem><FormLabel>দেয়ালের পুরুত্ব</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="5">৫ ইঞ্চি</SelectItem>
                                                            <SelectItem value="10">১০ ইঞ্চি</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )} />
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-center pt-4">
                                            <FormField control={fullHouseForm.control} name="tileFloors" render={({ field }) => (
                                                <FormItem className="flex flex-row items-center space-x-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><Label className="font-normal">ফ্লোর টাইলস</Label></FormItem>
                                            )} />
                                            <FormField control={fullHouseForm.control} name="tileBathroomWalls" render={({ field }) => (
                                                <FormItem className="flex flex-row items-center space-x-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><Label className="font-normal">বাথরুম টাইলস</Label></FormItem>
                                            )} />
                                            <FormField control={fullHouseForm.control} name="plasterInterior" render={({ field }) => (
                                                <FormItem className="flex flex-row items-center space-x-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><Label className="font-normal">ভিতরের প্লাস্টার</Label></FormItem>
                                            )} />
                                            <FormField control={fullHouseForm.control} name="plasterExterior" render={({ field }) => (
                                                <FormItem className="flex flex-row items-center space-x-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><Label className="font-normal">বাইরের প্লাস্টার</Label></FormItem>
                                            )} />
                                        </div>
                                    </div>
                                    <Button type="submit" className="w-full font-bold py-3 text-lg rounded-xl shadow-lg transition-transform active:scale-[0.98]">
                                        পূর্ণাঙ্গ বাড়ির হিসাব করুন
                                    </Button>
                                </div>
                                <div className="space-y-4">
                                     <h2 className="font-bold text-lg text-primary border-b pb-2 flex items-center gap-2">
                                        <BarChartBig className="w-5 h-5" />
                                        ফলাফল (Result)
                                    </h2>
                                    {fullHouseResults ? (
                                       <FullHouseResultDisplay results={fullHouseResults} />
                                    ) : (
                                        <div className="flex items-center justify-center h-full bg-muted/50 rounded-xl border border-dashed">
                                            <p className="text-muted-foreground p-8 text-center">ফলাফল এখানে দেখানো হবে।</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </form>
                    </Form>
                </TabsContent>
            </Tabs>
        </Card>
    </div>
    <Dialog open={isAiModalOpen} onOpenChange={setIsAiModalOpen}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                    <BrainCircuit className="w-6 h-6 text-primary"/>
                    বিশেষজ্ঞ AI পরামর্শ
                </DialogTitle>
                <DialogDescription>
                    আপনার দেওয়া তথ্যের ভিত্তিতে, এখানে কিছু নির্মাণ সংক্রান্ত পরামর্শ দেওয়া হলো।
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[60vh] p-4 border rounded-md">
                {isAiLoading ? (
                    <div className="flex flex-col items-center justify-center h-full">
                        <Loader2 className="w-12 h-12 animate-spin text-primary" />
                        <p className="mt-4 text-muted-foreground">আপনার জন্য পরামর্শ তৈরি করা হচ্ছে...</p>
                    </div>
                ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: aiAdvice.replace(/\n/g, '<br />') }} />
                )}
            </ScrollArea>
        </DialogContent>
    </Dialog>
    </>
  );
}


const ResultDisplay = ({ results }: { results: StructuralResults }) => (
  <div className="bg-card p-5 rounded-2xl border-2 shadow-inner">
      <div className="grid grid-cols-1 gap-4">
          <div className="text-center p-3 bg-accent/10 rounded-lg">
              <span className="text-xs text-accent-foreground/70 font-bold uppercase">সিমেন্ট (ব্যাগ)</span>
              <p className="text-4xl font-black text-primary">{results.cement}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">বালু (CFT)</span>
                  <p className="text-xl font-bold text-primary">{results.sand.toFixed(1)}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">খোয়া (CFT)</span>
                  <p className="text-xl font-bold text-primary">{results.chips.toFixed(1)}</p>
              </div>
          </div>
          <div className="p-4 bg-orange-400/10 rounded-lg border-l-4 border-orange-500">
              <div className="flex justify-between items-end">
                  <div>
                      <span className="text-[10px] text-orange-600 font-bold">মোট রড ওজন</span>
                      <p className="text-3xl font-black text-slate-800">{results.totalRodWeight.toFixed(1)} <span className="text-lg font-medium">কেজি</span></p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                      <p>প্রধান: <span className="font-semibold">{results.mainRodWeight.toFixed(1)}</span></p>
                      <p>রিং: <span className="font-semibold">{results.ringRodWeight.toFixed(1)}</span></p>
                  </div>
              </div>
          </div>
      </div>
  </div>
);

const SlabResultDisplay = ({ results }: { results: SlabResults }) => (
  <div className="bg-card p-5 rounded-2xl border-2 shadow-inner space-y-4">
      <div className="grid grid-cols-2 gap-3">
          <ResultBox label="সিমেন্ট (ব্যাগ)" value={results.cement} />
          <ResultBox label="বালু (CFT)" value={results.sand} />
          <ResultBox label="খোয়া (CFT)" value={results.chips} />
          <ResultBox label="রড (কেজি)" value={results.rodWeight} />
      </div>
      <p className="text-[10px] text-muted-foreground text-center">* ১:১.৫:৩ মিক্স রেশিও ধরে হিসেবকৃত।</p>
  </div>
);

const ResultBox = ({ label, value }: { label: string, value: number | string }) => (
    <div className="p-3 bg-muted/50 rounded-lg text-center">
        <span className="text-[10px] text-muted-foreground uppercase font-bold">{label}</span>
        <p className="text-2xl font-bold text-primary">{value}</p>
    </div>
);

const FullHouseResultDisplay = ({ results }: { results: FullHouseResults }) => (
  <div className="bg-card p-5 rounded-2xl border-2 shadow-inner space-y-4">
      <h3 className="text-xl font-bold text-center text-primary">পূর্ণাঙ্গ বাড়ির আনুমানিক হিসাব</h3>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <ResultBox label="মোট সিমেন্ট (ব্যাগ)" value={results.totalCement} />
          <ResultBox label="মোট বালু (CFT)" value={results.totalSand} />
          <ResultBox label="মোট খোয়া (CFT)" value={results.totalChips} />
          <ResultBox label="মোট রড (কেজি)" value={results.totalRodWeight} />
          <ResultBox label="মোট ইট (সংখ্যা)" value={results.totalBricks} />
          <ResultBox label="মোট টাইলস (সংখ্যা)" value={results.totalTiles} />
      </div>
       <p className="text-[10px] text-muted-foreground text-center">* এটি একটি সাধারণ মানের কাজের জন্য আনুমানিক হিসাব। স্থান ও উপকরণ ভেদে পরিমাণ ও খরচ পরিবর্তিত হতে পারে।</p>
  </div>
);
