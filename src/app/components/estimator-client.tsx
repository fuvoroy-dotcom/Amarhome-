
"use client";

import React, { useState, useTransition, useRef, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building, Cog, BarChartBig, BrainCircuit, Loader2, Layers, Home, Paintbrush, ClipboardList, Trash2, RectangleHorizontal, Grid, List, ArrowRightLeft, Box, Palette, Eraser, Square, DoorClosed, LayoutGrid, RotateCcw, Download, Plus, Move, Ruler } from "lucide-react";
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
import { estimatorSchema, type EstimatorValues, brickEstimatorSchema, type BrickEstimatorValues, tileEstimatorSchema, type TileEstimatorValues, plasterEstimatorSchema, type PlasterEstimatorValues, fullHouseEstimatorSchema, type FullHouseEstimatorValues, slabEstimatorSchema, type SlabEstimatorValues, AiConstructionAdvisoryInputSchema, stairEstimatorSchema, type StairEstimatorValues } from "@/app/lib/schemas";
import { getConstructionAdvice } from "@/app/actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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

// --- Manual Design Constants ---
const GRID_SIZE = 25;
type CellType = 'empty' | 'wall' | 'window' | 'door' | 'boundary';

export default function EstimatorClient() {
  const [structuralResults, setStructuralResults] = useState<StructuralResults | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiAdvice, setAiAdvice] = useState("");
  const [isAiLoading, startAiTransition] = useTransition();
  const { toast } = useToast();

  // --- Advanced Manual Design State ---
  const [designGrid, setDesignGrid] = useState<CellType[][]>(
    Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill('empty'))
  );
  const [selectedTool, setSelectedTool] = useState<CellType | 'eraser' | 'move'>('wall');
  const [dragStart, setDragStart] = useState<{ r: number, c: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ r: number, c: number } | null>(null);
  const [cellSizeFt, setCellSizeFt] = useState<number>(1); // Scale: 1 cell = X feet
  
  // Design Input in Ft and In
  const [manualInput, setManualInput] = useState({ 
    lengthFt: 10, 
    lengthIn: 0, 
    widthFt: 10, 
    widthIn: 0 
  });
  
  const [toolSizeIn, setToolSizeIn] = useState(30); // Tool size (e.g., window width) in inches

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


  function calculateSlab(data: SlabEstimatorValues) {
    const { slabs, slabThicknessIn, slabRodGapIn, mainRodFactor } = data;
    
    const totalArea = slabs.reduce((acc, slab) => acc + (slab.length * slab.width), 0);
    const slabVol = totalArea * (slabThicknessIn / 12);
    const dryVol = slabVol * 1.5;
    const ratioSum = 5.5; // 1 + 1.5 + 3

    const cementBags = Math.ceil((dryVol / ratioSum) / 1.25);
    const sandCFT = (dryVol / ratioSum) * 1.5;
    const chipsCFT = (dryVol / ratioSum) * 3;
    
    let totalRodLength = 0;
    if (slabRodGapIn > 0) {
        const gapFt = slabRodGapIn / 12;
        slabs.forEach(slab => {
            totalRodLength += ((slab.width / gapFt) * slab.length) + ((slab.length / gapFt) * slab.width);
        });
    }
    const slabRodWeight = totalRodLength * mainRodFactor;

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
    
    const firstSlab = slabValues.slabs && slabValues.slabs.length > 0 ? slabValues.slabs[0] : { length: 0, width: 0 };

    const advisoryInput = {
      ...structuralValues,
      slabLengthFt: firstSlab.length,
      slabWidthFt: firstSlab.width,
      slabThicknessIn: slabValues.slabThicknessIn,
      slabRodGapIn: slabValues.slabRodGapIn,
      mainRodFactor: slabValues.mainRodFactor,
    };

    const validation = AiConstructionAdvisoryInputSchema.safeParse(advisoryInput);

    if (!validation.success) {
      toast({
        variant: "destructive",
        title: "ত্রুটি",
        description: "AI পরামর্শের জন্য সমস্ত মান সঠিকভাবে পূরণ করুন।",
      });
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
    const isFiveInchWall = wallThicknessIn === '5';
    
    const bricksPerSft = isFiveInchWall ? 5 : 10;
    const bricks = area * bricksPerSft;

    const wallVolume = isFiveInchWall ? area * (5/12) : area * (10/12);
    const wetMortarVolume = wallVolume * 0.30; 
    const dryMortarVolume = wetMortarVolume * 1.33; 
    
    const ratioSum = 5; 
    
    const cementVolumeCft = (dryMortarVolume / ratioSum) * 1;
    const cementBags = cementVolumeCft / 1.25; 
    
    const sandCft = (dryMortarVolume / ratioSum) * 4;

    setBrickResults({
        bricks: Math.ceil(bricks),
        cement: Math.ceil(cementBags),
        sand: parseFloat(sandCft.toFixed(1)),
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
          setTileResults({ tiles: 0, cement: 0, sand: 0 });
          return;
      }

      const tilesNeeded = totalArea / tileArea;
      const totalTiles = Math.ceil(tilesNeeded * (1 + wastagePercent / 100));

      const mortarThicknessFt = calculationType === 'floor' ? 1 / 12 : 0.5 / 12;
      const wetVol = totalArea * mortarThicknessFt;
      const dryVol = wetVol * 1.33; 
      const ratioSum = 5; 
      const cementCFT = (dryVol / ratioSum) * 1;
      const cementBags = Math.ceil(cementCFT / 1.25);
      const sandCFT = (dryVol / ratioSum) * 4;

      setTileResults({
          tiles: totalTiles,
          cement: cementBags,
          sand: parseFloat(sandCFT.toFixed(1))
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
      const dryVol = wetVol * 1.33; 
      const ratioSum = 5; 
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

        const foundationVol = totalAreaSqFt * 1.5; 
        const totalColumns = columnCountPerFloor * floorCount;
        const columnVol = (12/12) * (12/12) * floorHeightFt * totalColumns; 
        const beamLengthPerFloor = Math.sqrt(totalAreaSqFt) * 2.5;
        const totalBeamLength = beamLengthPerFloor * floorCount;
        const beamVol = (10/12) * (12/12) * totalBeamLength;
        const totalSlabArea = totalAreaSqFt * floorCount;
        const slabVol = totalSlabArea * (slabThicknessIn / 12);
        
        const totalWetVol = foundationVol + columnVol + beamVol + slabVol;
        const dryVol = totalWetVol * 1.5;
        const ratioSum = 5.5; 

        const structuralCement = (dryVol / ratioSum) / 1.25;
        const structuralSand = (dryVol / ratioSum) * 1.5;
        const structuralChips = (dryVol / ratioSum) * 3;

        const foundationRodLength = (Math.sqrt(totalAreaSqFt) / 0.5) * Math.sqrt(totalAreaSqFt) * 2;
        const foundationRodWeight = foundationRodLength * mainRodFactor;
        const columnRodLength = totalColumns * floorHeightFt * 6;
        const beamRodLength = totalBeamLength * 6;
        const slabRodLength = (totalSlabArea / 0.5) * 2;
        const totalMainRodWeight = (columnRodLength + beamRodLength + slabRodLength) * mainRodFactor + foundationRodWeight;
        const ringCountCol = ringGapIn > 0 ? (floorHeightFt * 12) / ringGapIn : 0;
        const ringLenCol = ((12 / 12) + (12 / 12)) * 2;
        const totalRingWeightCol = ringCountCol * ringLenCol * totalColumns * ringRodFactor;
        const ringCountBeam = ringGapIn > 0 ? (totalBeamLength * 12) / ringGapIn : 0;
        const ringLenBeam = ((10 / 12) + (12 / 12)) * 2;
        const totalRingWeightBeam = ringCountBeam * ringLenBeam * ringRodFactor;
        const totalRingRodWeight = totalRingWeightCol + totalRingWeightBeam;
        const totalRodWeight = totalMainRodWeight + totalRingRodWeight;

        const perimeter = Math.sqrt(totalAreaSqFt) * 4;
        const exteriorWallArea = perimeter * floorHeightFt * floorCount;
        const interiorWallLength = (avgRoomLengthFt * 1.5 + avgRoomWidthFt) * roomCount * floorCount;
        const interiorWallArea = interiorWallLength * floorHeightFt;
        const totalWallArea = exteriorWallArea + interiorWallArea;
        const bricksPerSft = wallThicknessIn === '5' ? 5 : 10;
        const brickCementPer100Sft = wallThicknessIn === '5' ? 0.6 : 1.2;
        const brickSandPer100Sft = wallThicknessIn === '5' ? 3 : 6;
        const totalBricks = totalWallArea * bricksPerSft;
        const masonryCement = (totalWallArea / 100) * brickCementPer100Sft;
        const masonrySand = (totalWallArea / 100) * brickSandPer100Sft;
        
        let plasterArea = 0;
        if (plasterExterior) plasterArea += exteriorWallArea; 
        if (plasterInterior) plasterArea += (exteriorWallArea + interiorWallArea) * 2; 
        const plasterWetVol = plasterArea * (0.5 / 12); 
        const plasterDryVol = plasterWetVol * 1.33;
        const plasterRatioSum = 5; 
        const plasterCement = ((plasterDryVol / plasterRatioSum) * 1) / 1.25;
        const plasterSand = (plasterDryVol / plasterRatioSum) * 4;
        
        let totalTiles = 0;
        if (tileFloors) {
            const floorArea = totalAreaSqFt * floorCount;
            totalTiles += floorArea;
        }
        if (tileBathroomWalls) {
            const bathroomWallArea = 28 * bathroomWallTileHeightFt * bathroomCount * floorCount;
            totalTiles += bathroomWallArea;
        }
        totalTiles = totalTiles * 1.1; 

        setFullHouseResults({
            totalCement: Math.ceil(structuralCement + masonryCement + plasterCement),
            totalSand: parseFloat((structuralSand + masonrySand + plasterSand).toFixed(1)),
            totalChips: parseFloat(structuralChips.toFixed(1)),
            totalRodWeight: parseFloat(totalRodWeight.toFixed(1)),
            totalBricks: Math.ceil(totalBricks),
            totalTiles: Math.ceil(totalTiles),
        });
    }

    const [stairResults, setStairResults] = useState<StairResults | null>(null);
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

    function calculateStair(data: StairEstimatorValues) {
        const {
            flightCount, waistSlabLengthFt, waistSlabWidthFt, waistSlabThicknessIn,
            stepCountPerFlight, riserHeightIn, treadWidthIn, landingLengthFt, landingWidthFt,
            mainRodFactor, distRodFactor, distRodGapIn
        } = data;

        const waistVol = flightCount * waistSlabLengthFt * waistSlabWidthFt * (waistSlabThicknessIn / 12);
        const stepsVol = flightCount * stepCountPerFlight * 0.5 * (riserHeightIn / 12) * (treadWidthIn / 12) * waistSlabWidthFt;
        const landingVol = landingLengthFt * landingWidthFt * (waistSlabThicknessIn / 12);
        const totalWetVol = waistVol + stepsVol + landingVol;
        const dryVol = totalWetVol * 1.5;
        const ratioSum = 5.5; 

        const cementBags = Math.ceil(((dryVol / ratioSum) * 1) / 1.25);
        const sandCFT = (dryVol / ratioSum) * 1.5;
        const chipsCFT = (dryVol / ratioSum) * 3;

        const rodGapFt = distRodGapIn > 0 ? distRodGapIn / 12 : 1;
        const totalFlightLength = waistSlabLengthFt * flightCount;

        const mainRodCount = waistSlabWidthFt / rodGapFt;
        const mainRodTotalLength = mainRodCount * (totalFlightLength + landingLengthFt);
        const mainRodWeight = mainRodTotalLength * mainRodFactor;

        const distRodCount = (totalFlightLength + landingLengthFt) / rodGapFt;
        const distRodTotalLength = distRodCount * waistSlabWidthFt;
        const distRodWeight = distRodTotalLength * distRodFactor;

        const totalRodWeight = mainRodWeight + distRodWeight;

        setStairResults({
            cement: cementBags,
            sand: parseFloat(sandCFT.toFixed(1)),
            chips: parseFloat(chipsCFT.toFixed(1)),
            totalRodWeight: parseFloat(totalRodWeight.toFixed(1)),
        });
    }

    const [cftToBrickInput, setCftToBrickInput] = useState<string>("");
    const [cftToBrickResult, setCftToBrickResult] = useState<number | null>(null);
    const [khowaCftToBrickInput, setKhowaCftToBrickInput] = useState<string>("");
    const [khowaCftToBrickResult, setKhowaCftToBrickResult] = useState<number | null>(null);

    const [rodLengthInput, setRodLengthInput] = useState<string>("");
    const [rodConversionFactor, setRodConversionFactor] = useState<number>(0.48);
    const [rodWeightResult, setRodWeightResult] = useState<number | null>(null);
    
    function calculateCftToBricks() {
        const cft = parseFloat(cftToBrickInput);
        if (!isNaN(cft) && cft > 0) {
            setCftToBrickResult(Math.ceil(cft * 12));
        } else {
            setCftToBrickResult(null);
            toast({ variant: "destructive", title: "অনুগ্রহ করে একটি সঠিক CFT মান লিখুন।" });
        }
    }

    function calculateKhowaToBricks() {
        const cft = parseFloat(khowaCftToBrickInput);
        if (!isNaN(cft) && cft > 0) {
            setKhowaCftToBrickResult(Math.ceil(cft * 11));
        } else {
            setKhowaCftToBrickResult(null);
            toast({ variant: "destructive", title: "অনুগ্রহ করে একটি সঠিক CFT মান লিখুন।" });
        }
    }

    function calculateRodWeight() {
        const length = parseFloat(rodLengthInput);
        if (!isNaN(length) && length > 0) {
            setRodWeightResult(length * rodConversionFactor);
        } else {
            setRodWeightResult(null);
            toast({ variant: "destructive", title: "অনুগ্রহ করে একটি সঠিক দৈর্ঘ্য লিখুন।" });
        }
    }

    // --- Advanced Manual Design Logic (Ft & In Scaling) ---
    const handleCellMouseDown = (r: number, c: number) => {
        if (selectedTool === 'move') return;
        setDragStart({ r, c });
        setDragCurrent({ r, c });
    };

    const handleCellMouseEnter = (r: number, c: number) => {
        if (dragStart) {
            setDragCurrent({ r, c });
        }
    };

    const handleGridMouseUp = () => {
        if (!dragStart || !dragCurrent) {
            setDragStart(null);
            setDragCurrent(null);
            return;
        }

        const newGrid = [...designGrid.map(row => [...row])];
        const minR = Math.min(dragStart.r, dragCurrent.r);
        const maxR = Math.max(dragStart.r, dragCurrent.r);
        const minC = Math.min(dragStart.c, dragCurrent.c);
        const maxC = Math.max(dragStart.c, dragCurrent.c);

        for (let r = minR; r <= maxR; r++) {
            for (let c = minC; c <= maxC; c++) {
                if (selectedTool === 'wall' || selectedTool === 'boundary') {
                    if (r === minR || r === maxR || c === minC || c === maxC) {
                        newGrid[r][c] = selectedTool as CellType;
                    }
                } else if (selectedTool === 'eraser') {
                    newGrid[r][c] = 'empty';
                } else {
                    newGrid[r][c] = selectedTool as CellType;
                }
            }
        }
        setDesignGrid(newGrid);
        setDragStart(null);
        setDragCurrent(null);
    };

    const addManualRoom = () => {
        // Convert input to total feet
        const totalLen = manualInput.lengthFt + (manualInput.lengthIn / 12);
        const totalWid = manualInput.widthFt + (manualInput.widthIn / 12);
        
        // Convert feet to cells based on cellSizeFt
        const cellLen = Math.round(totalLen / cellSizeFt);
        const cellWid = Math.round(totalWid / cellSizeFt);

        const newGrid = [...designGrid.map(row => [...row])];
        const startR = 2;
        const startC = 2;

        if (startR + cellLen >= GRID_SIZE || startC + cellWid >= GRID_SIZE) {
            toast({ variant: "destructive", title: "রুমটি গ্রিডের বাইরে চলে যাচ্ছে!" });
            return;
        }

        for (let r = startR; r <= startR + cellLen; r++) {
            for (let c = startC; c <= startC + cellWid; c++) {
                if (r === startR || r === startR + cellLen || c === startC || c === startC + cellWid) {
                    newGrid[r][c] = 'wall';
                }
            }
        }
        setDesignGrid(newGrid);
        toast({ title: `রুম যোগ করা হয়েছে (${manualInput.lengthFt}'${manualInput.lengthIn}" x ${manualInput.widthFt}'${manualInput.widthIn}")` });
    };

    const resetDesign = () => {
        setDesignGrid(Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill('empty')));
        toast({ title: "ডিজাইন রিসেট করা হয়েছে" });
    };

    const isInsideDragPreview = (r: number, c: number) => {
        if (!dragStart || !dragCurrent) return false;
        const minR = Math.min(dragStart.r, dragCurrent.r);
        const maxR = Math.max(dragStart.r, dragCurrent.r);
        const minC = Math.min(dragStart.c, dragCurrent.c);
        const maxC = Math.max(dragStart.c, dragCurrent.c);
        
        if (selectedTool === 'wall' || selectedTool === 'boundary') {
            return (r === minR || r === maxR || c === minC || c === maxC) && r >= minR && r <= maxR && c >= minC && c <= maxC;
        }
        return r >= minR && r <= maxR && c >= minC && c <= maxC;
    };

    const getDragDimensions = () => {
        if (!dragStart || !dragCurrent) return null;
        const rCount = Math.abs(dragCurrent.r - dragStart.r) + 1;
        const cCount = Math.abs(dragCurrent.c - dragStart.c) + 1;
        
        const totalFtR = rCount * cellSizeFt;
        const totalFtC = cCount * cellSizeFt;
        
        return {
            ftR: Math.floor(totalFtR),
            inR: Math.round((totalFtR % 1) * 12),
            ftC: Math.floor(totalFtC),
            inC: Math.round((totalFtC % 1) * 12)
        };
    };

  return (
    <>
    <div className="w-full max-w-6xl">
        <Card className="w-full overflow-hidden shadow-2xl border-border/40">
            <div className="bg-primary p-5 text-primary-foreground text-center">
                <h1 className="text-3xl font-bold">পূর্ণাঙ্গ কনস্ট্রাকশন ক্যালকুলেটর</h1>
                <p className="text-primary-foreground/80 text-sm mt-1">স্ট্রাকচার, গাঁথুনি, প্লাস্টার ও টাইলসের সমন্বিত হিসাব</p>
            </div>
            
            <Tabs defaultValue="structural" className="w-full">
                <TabsList className="flex w-full flex-wrap rounded-none h-auto bg-muted">
                    <TabsTrigger value="structural" className="flex-1 py-3 rounded-none text-base data-[state=active]:shadow-inner data-[state=active]:bg-background/50">
                        <Building className="mr-2 h-5 w-5" />
                        স্ট্রাকচার
                    </TabsTrigger>
                     <TabsTrigger value="slab" className="flex-1 py-3 rounded-none text-base data-[state=active]:shadow-inner data-[state=active]:bg-background/50">
                        <Grid className="mr-2 h-5 w-5" />
                        ছাদ
                    </TabsTrigger>
                    <TabsTrigger value="stair" className="flex-1 py-3 rounded-none text-base data-[state=active]:shadow-inner data-[state=active]:bg-background/50">
                        <List className="mr-2 h-5 w-5" />
                        সিঁড়ি
                    </TabsTrigger>
                    <TabsTrigger value="brick" className="flex-1 py-3 rounded-none text-base data-[state=active]:shadow-inner data-[state=active]:bg-background/50">
                        <Layers className="mr-2 h-5 w-5" />
                        গাঁথুনি
                    </TabsTrigger>
                    <TabsTrigger value="plaster" className="flex-1 py-3 rounded-none text-base data-[state=active]:shadow-inner data-[state=active]:bg-background/50">
                        <Paintbrush className="mr-2 h-5 w-5" />
                        প্লাস্টার
                    </TabsTrigger>
                    <TabsTrigger value="tile" className="flex-1 py-3 rounded-none text-base data-[state=active]:shadow-inner data-[state=active]:bg-background/50">
                        <RectangleHorizontal className="mr-2 h-5 w-5" />
                        টাইলস
                    </TabsTrigger>
                    <TabsTrigger value="fullHouse" className="flex-1 py-3 rounded-none text-base data-[state=active]:shadow-inner data-[state=active]:bg-background/50">
                        <ClipboardList className="mr-2 h-5 w-5" />
                        পূর্ণাঙ্গ বাড়ি
                    </TabsTrigger>
                    <TabsTrigger value="conversion" className="flex-1 py-3 rounded-none text-base data-[state=active]:shadow-inner data-[state=active]:bg-background/50">
                        <ArrowRightLeft className="mr-2 h-5 w-5" />
                        রূপান্তর
                    </TabsTrigger>
                    <TabsTrigger value="design" className="flex-1 py-3 rounded-none text-base data-[state=active]:shadow-inner data-[state=active]:bg-background/50">
                        <Palette className="mr-2 h-5 w-5" />
                        ডিজাইন
                    </TabsTrigger>
                </TabsList>
                
                {/* --- Design Tab Content --- */}
                <TabsContent value="design" className="p-4 md:p-6" onMouseUp={handleGridMouseUp}>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Tool Palette */}
                        <div className="lg:col-span-4 space-y-6">
                            <h2 className="font-bold text-xl text-primary flex items-center gap-2">
                                <Palette className="w-6 h-6" />
                                ডিজাইন টুলবক্স
                            </h2>
                            <Card className="shadow-lg border-border/40">
                                <CardContent className="pt-6 space-y-6">
                                    {/* Scale Control */}
                                    <div className="space-y-2 pb-4 border-b">
                                        <Label className="text-xs font-bold text-primary flex items-center gap-1">
                                            <Grid className="w-3 h-3"/> গ্রিড স্কেল (ফুট)
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-muted-foreground">১ ঘর = </span>
                                            <Input 
                                                type="number" 
                                                value={cellSizeFt} 
                                                onChange={(e) => setCellSizeFt(parseFloat(e.target.value) || 0.1)} 
                                                step="0.1"
                                                min="0.1" 
                                                className="h-8 w-20" 
                                            />
                                            <span className="text-[10px] text-muted-foreground">ফুট</span>
                                        </div>
                                    </div>

                                    {/* Tool Selection */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <ToolButton label="দেয়াল (Drag)" icon={<Square className="w-5 h-5 fill-slate-800" />} active={selectedTool === 'wall'} onClick={() => setSelectedTool('wall')} />
                                        <ToolButton label="সীমানা" icon={<LayoutGrid className="w-5 h-5 text-green-600" />} active={selectedTool === 'boundary'} onClick={() => setSelectedTool('boundary')} />
                                        <ToolButton label="জানালা" icon={<LayoutGrid className="w-5 h-5 text-blue-500" />} active={selectedTool === 'window'} onClick={() => setSelectedTool('window')} />
                                        <ToolButton label="দরজা" icon={<DoorClosed className="w-5 h-5 text-amber-700" />} active={selectedTool === 'door'} onClick={() => setSelectedTool('door')} />
                                        <ToolButton label="মুছুন" icon={<Eraser className="w-5 h-5 text-red-500" />} active={selectedTool === 'eraser'} onClick={() => setSelectedTool('eraser')} />
                                        <ToolButton label="মুভ" icon={<Move className="w-5 h-5" />} active={selectedTool === 'move'} onClick={() => setSelectedTool('move')} />
                                    </div>

                                    {/* Size Adjuster */}
                                    <div className="space-y-2 pt-4 border-t">
                                        <Label className="text-xs font-bold text-primary flex items-center gap-1">
                                            <Ruler className="w-3 h-3"/> টুল সাইজ (ইঞ্চি)
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            <Input 
                                                type="number" 
                                                value={toolSizeIn} 
                                                onChange={(e) => setToolSizeIn(parseInt(e.target.value) || 1)} 
                                                min="1" 
                                                className="h-8" 
                                            />
                                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">দরজা/জানালা</span>
                                        </div>
                                    </div>

                                    {/* Manual Input Build (Ft & In) */}
                                    <div className="space-y-3 pt-4 border-t bg-muted/20 p-3 rounded-lg">
                                        <Label className="text-xs font-bold text-primary">মাপ লিখে রুম তৈরি করুন</Label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-bold">দৈর্ঘ্য (লম্বা)</span>
                                                <div className="flex gap-1">
                                                    <Input placeholder="Ft" type="number" value={manualInput.lengthFt} onChange={(e) => setManualInput({ ...manualInput, lengthFt: parseInt(e.target.value) || 0 })} className="h-8" />
                                                    <Input placeholder="In" type="number" value={manualInput.lengthIn} onChange={(e) => setManualInput({ ...manualInput, lengthIn: parseInt(e.target.value) || 0 })} className="h-8" />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-bold">প্রস্থ (চওড়া)</span>
                                                <div className="flex gap-1">
                                                    <Input placeholder="Ft" type="number" value={manualInput.widthFt} onChange={(e) => setManualInput({ ...manualInput, widthFt: parseInt(e.target.value) || 0 })} className="h-8" />
                                                    <Input placeholder="In" type="number" value={manualInput.widthIn} onChange={(e) => setManualInput({ ...manualInput, widthIn: parseInt(e.target.value) || 0 })} className="h-8" />
                                                </div>
                                            </div>
                                        </div>
                                        <Button size="sm" className="w-full flex items-center gap-2 bg-primary hover:bg-primary/90 mt-2" onClick={addManualRoom}>
                                            <Plus className="w-4 h-4" />
                                            রুম যোগ করুন
                                        </Button>
                                    </div>

                                    <div className="pt-4 border-t space-y-2">
                                        <Button variant="outline" className="w-full flex items-center gap-2" onClick={resetDesign}>
                                            <RotateCcw className="w-4 h-4" /> রিসেট
                                        </Button>
                                        <Button className="w-full flex items-center gap-2" onClick={() => toast({ title: "ডিজাইন সেভ করা হয়েছে" })}>
                                            <Download className="w-4 h-4" /> সেভ
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Interactive Canvas */}
                        <div className="lg:col-span-8 flex flex-col items-center">
                            <div className="mb-4 text-sm font-bold text-primary flex items-center gap-6 bg-primary/5 px-4 py-2 rounded-full border border-primary/10">
                                <span className="flex items-center gap-1"><Ruler className="w-4 h-4"/> ১ ঘর = {cellSizeFt} ফুট ({Math.round(cellSizeFt * 12)}")</span>
                                {dragStart && dragCurrent && (
                                    <span className="bg-accent/20 text-accent-foreground px-3 py-1 rounded-full animate-pulse flex gap-2">
                                        মাপ: 
                                        <span>{getDragDimensions()?.ftC}'{getDragDimensions()?.inC}"</span>
                                        x
                                        <span>{getDragDimensions()?.ftR}'{getDragDimensions()?.inR}"</span>
                                    </span>
                                )}
                            </div>
                            <div className="bg-card p-4 rounded-2xl shadow-xl border-2 border-border/50 select-none overflow-auto max-w-full">
                                <div 
                                    className="grid gap-0" 
                                    style={{ 
                                        gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
                                        width: 'fit-content',
                                        backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
                                        backgroundSize: '24px 24px'
                                    }}
                                    onMouseLeave={() => { setDragStart(null); setDragCurrent(null); }}
                                >
                                    {designGrid.map((row, rIdx) => 
                                        row.map((cell, cIdx) => {
                                            const isPreview = isInsideDragPreview(rIdx, cIdx);
                                            return (
                                                <div 
                                                    key={`${rIdx}-${cIdx}`}
                                                    onMouseDown={() => handleCellMouseDown(rIdx, cIdx)}
                                                    onMouseEnter={() => handleCellMouseEnter(rIdx, cIdx)}
                                                    className={cn(
                                                        "w-6 h-6 sm:w-8 sm:h-8 border border-muted-foreground/5 cursor-crosshair transition-all duration-75",
                                                        cell === 'wall' && "bg-slate-800 shadow-inner",
                                                        cell === 'boundary' && "bg-green-700/60 border-green-800",
                                                        cell === 'window' && "bg-blue-300/40 border-blue-600 border-2",
                                                        cell === 'door' && "bg-amber-200/50 border-amber-800/40",
                                                        cell === 'empty' && "bg-transparent",
                                                        isPreview && (selectedTool === 'eraser' ? "bg-red-400/50" : "bg-primary/40 border-primary border-2")
                                                    )}
                                                >
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                            <p className="mt-4 text-[10px] text-muted-foreground">* নকশা আঁকার জন্য মাউস দিয়ে ক্লিক করে টেনে আনুন (Click & Drag)</p>
                        </div>
                    </div>
                </TabsContent>

                {/* --- Rest of the tabs remain the same --- */}
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
                                                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                                            <FormLabel className="font-normal">বেস</FormLabel>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={structuralForm.control}
                                                    name="includeColumn"
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                                            <FormLabel className="font-normal">কলাম</FormLabel>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={structuralForm.control}
                                                    name="includeBeam"
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                                            <FormLabel className="font-normal">বিম</FormLabel>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </div>
                                        <div className={cn("space-y-3", !includeBase && "opacity-40 grayscale pointer-events-none")}>
                                            <FormLabel className="font-bold text-muted-foreground">বেস / ভিত্তি</FormLabel>
                                            <div className="grid grid-cols-2 gap-2">
                                                <FormField control={structuralForm.control} name="baseCount" render={({ field }) => (<FormItem><FormLabel className="text-xs">সংখ্যা (টি)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                                                <FormField control={structuralForm.control} name="baseThicknessIn" render={({ field }) => (<FormItem><FormLabel className="text-xs">পুরুত্ব (ইঞ্চি)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <FormField control={structuralForm.control} name="baseLengthFt" render={({ field }) => (<FormItem><FormLabel className="text-xs">লম্বা (ফুট)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                                                <FormField control={structuralForm.control} name="baseWidthFt" render={({ field }) => (<FormItem><FormLabel className="text-xs">চওড়া (ফুট)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                                            </div>
                                        </div>
                                        <div className={cn("space-y-3", !includeColumn && "opacity-40 grayscale pointer-events-none")}>
                                            <FormLabel className="font-bold text-muted-foreground">কলাম</FormLabel>
                                            <div className="grid grid-cols-2 gap-2">
                                                <FormField control={structuralForm.control} name="columnCount" render={({ field }) => (<FormItem><FormLabel className="text-xs">সংখ্যা (টি)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                                                <FormField control={structuralForm.control} name="columnHeightFt" render={({ field }) => (<FormItem><FormLabel className="text-xs">উচ্চতা (ফুট)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <FormField control={structuralForm.control} name="columnLengthIn" render={({ field }) => (<FormItem><FormLabel className="text-xs">দৈর্ঘ্য (ইঞ্চি)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                                                <FormField control={structuralForm.control} name="columnWidthIn" render={({ field }) => (<FormItem><FormLabel className="text-xs">প্রস্থ (ইঞ্চি)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                                            </div>
                                        </div>
                                        <div className={cn("space-y-3", !includeBeam && "opacity-40 grayscale pointer-events-none")}>
                                            <FormLabel className="font-bold text-muted-foreground">বিম</FormLabel>
                                            <FormField control={structuralForm.control} name="beamLengthFt" render={({ field }) => (<FormItem><FormLabel className="text-xs">মোট দৈর্ঘ্য (ফুট)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                                            <div className="grid grid-cols-2 gap-2">
                                                <FormField control={structuralForm.control} name="beamHeightIn" render={({ field }) => (<FormItem><FormLabel className="text-xs">উচ্চতা (ইঞ্চি)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                                                <FormField control={structuralForm.control} name="beamWidthIn" render={({ field }) => (<FormItem><FormLabel className="text-xs">প্রস্থ (ইঞ্চি)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
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
                                                <FormField control={structuralForm.control} name="columnRodCount" render={({ field }) => (<FormItem><FormLabel className="text-xs">কলাম রড</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                                                <FormField control={structuralForm.control} name="beamRodCount" render={({ field }) => (<FormItem><FormLabel className="text-xs">বিম রড</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <FormLabel className="font-bold text-muted-foreground">রডের ব্যাস ও গ্যাপ</FormLabel>
                                            <FormField control={structuralForm.control} name="mainRodFactor" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs">প্রধান রড</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={String(field.value)}>
                                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="0.12">৮ মিলি</SelectItem>
                                                            <SelectItem value="0.19">১০ মিলি</SelectItem>
                                                            <SelectItem value="0.30">১২ মিলি</SelectItem>
                                                            <SelectItem value="0.48">১৬ মিলি</SelectItem>
                                                            <SelectItem value="0.75">২০ মিলি</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )} />
                                        </div>
                                    </div>
                                    <Button type="submit" className="w-full font-bold py-3 text-lg rounded-xl shadow-lg">হিসাব করুন</Button>
                                </div>
                                <div className="space-y-4">
                                    <h2 className="font-bold text-lg text-primary border-b pb-2 flex items-center gap-2">
                                        <BarChartBig className="w-5 h-5" />
                                        ফলাফল (Result)
                                    </h2>
                                    {structuralResults ? <ResultDisplay results={structuralResults} /> : <div className="flex items-center justify-center h-full bg-muted/50 rounded-xl border border-dashed"><p className="text-muted-foreground p-8 text-center">ফলাফল এখানে দেখানো হবে।</p></div>}
                                </div>
                            </div>
                        </form>
                    </Form>
                </TabsContent>

                <TabsContent value="slab">
                    <Form {...slabForm}><form onSubmit={slabForm.handleSubmit(calculateSlab)} className="p-4 md:p-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 space-y-6">
                                <h2 className="font-bold text-lg text-primary border-b pb-2 flex items-center gap-2"><Grid className="w-5 h-5" />ছাদের মাপ ও রড</h2>
                                <div className="bg-card p-4 rounded-xl space-y-6 border">
                                    {slabFields.map((item, index) => (
                                        <div key={item.id} className="flex items-end gap-2 p-2 border rounded-md bg-muted/50">
                                            <FormField control={slabForm.control} name={`slabs.${index}.length`} render={({ field }) => (<FormItem className="flex-1"><FormLabel className="text-xs">দৈর্ঘ্য (ফুট)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                                            <FormField control={slabForm.control} name={`slabs.${index}.width`} render={({ field }) => (<FormItem className="flex-1"><FormLabel className="text-xs">প্রস্থ (ফুট)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                                            <Button type="button" variant="destructive" size="icon" onClick={() => removeSlab(index)} disabled={slabFields.length <= 1}><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    ))}
                                    <Button type="button" variant="outline" onClick={() => appendSlab({ length: 10, width: 10 })} className="w-full">নতুন ছাদের অংশ যোগ করুন</Button>
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={slabForm.control} name="slabThicknessIn" render={({ field }) => (<FormItem><FormLabel>পুরুত্ব (ইঞ্চি)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                                        <FormField control={slabForm.control} name="slabRodGapIn" render={({ field }) => (<FormItem><FormLabel>রডের গ্যাপ (ইঞ্চি)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                                    </div>
                                </div>
                                <Button type="submit" className="w-full py-3 text-lg font-bold">হিসাব করুন</Button>
                            </div>
                            <div className="space-y-4">{slabResults ? <SlabResultDisplay results={slabResults} /> : <div className="h-48 flex items-center justify-center bg-muted/50 rounded-xl border border-dashed">ফলাফল এখানে দেখানো হবে</div>}</div>
                        </div>
                    </form></Form>
                </TabsContent>

                <TabsContent value="stair">
                     <Form {...stairForm}><form onSubmit={stairForm.handleSubmit(calculateStair)} className="p-4 md:p-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="space-y-4">
                                <h2 className="font-bold text-lg text-primary border-b pb-2 flex items-center gap-2"><List className="w-5 h-5" />ফ্লাইট ও ধাপের মাপ</h2>
                                <div className="bg-card p-4 rounded-xl space-y-6 border">
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={stairForm.control} name="flightCount" render={({ field }) => (<FormItem><FormLabel className="text-xs">ফ্লাইটের সংখ্যা</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                                        <FormField control={stairForm.control} name="stepCountPerFlight" render={({ field }) => (<FormItem><FormLabel className="text-xs">ধাপ (প্রতি ফ্লাইটে)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={stairForm.control} name="waistSlabLengthFt" render={({ field }) => (<FormItem><FormLabel className="text-xs">দৈর্ঘ্য (ফুট)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                                        <FormField control={stairForm.control} name="waistSlabWidthFt" render={({ field }) => (<FormItem><FormLabel className="text-xs">প্রস্থ (ফুট)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                                    </div>
                                </div>
                                <Button type="submit" className="w-full font-bold">হিসাব করুন</Button>
                            </div>
                            <div className="space-y-4">{stairResults ? <StairResultDisplay results={stairResults} /> : <div className="h-48 flex items-center justify-center bg-muted/50 rounded-xl border border-dashed">ফলাফল এখানে দেখানো হবে</div>}</div>
                        </div>
                    </form></Form>
                </TabsContent>
                
                <TabsContent value="brick">
                    <Form {...brickForm}><form onSubmit={brickForm.handleSubmit(calculateBricks)} className="p-4 md:p-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 space-y-6">
                                <h2 className="font-bold text-lg text-primary border-b pb-2 flex items-center gap-2"><Layers className="w-5 h-5" />গাঁথুনির মাপ</h2>
                                <div className="bg-card p-4 rounded-xl space-y-6 border">
                                    <FormField control={brickForm.control} name="calculationType" render={({ field }) => (
                                        <FormItem className="space-y-3"><FormLabel>হিসাবের ধরণ</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4"><div className="flex items-center space-x-2"><RadioGroupItem value="wall" id="t1" /><Label htmlFor="t1">একক দেয়াল</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="rooms" id="t2" /><Label htmlFor="t2">একাধিক রুম</Label></div></RadioGroup></FormControl></FormItem>
                                    )} />
                                    {brickCalculationType === 'rooms' && fields.map((item, index) => (
                                        <div key={item.id} className="flex items-end gap-2 p-2 border rounded-md">
                                            <FormField control={brickForm.control} name={`rooms.${index}.length`} render={({ field }) => (<FormItem className="flex-1"><FormLabel className="text-xs">দৈর্ঘ্য (ফুট)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                                            <FormField control={brickForm.control} name={`rooms.${index}.width`} render={({ field }) => (<FormItem className="flex-1"><FormLabel className="text-xs">প্রস্থ (ফুট)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                                            <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    ))}
                                    {brickCalculationType === 'rooms' && <Button type="button" variant="outline" onClick={() => append({ length: 12, width: 10 })} className="w-full">নতুন রুম যোগ করুন</Button>}
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={brickForm.control} name="wallHeightFt" render={({ field }) => (<FormItem><FormLabel>উচ্চতা (ফুট)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                                        <FormField control={brickForm.control} name="wallThicknessIn" render={({ field }) => (<FormItem><FormLabel>পুরুত্ব</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="5">৫ ইঞ্চি</SelectItem><SelectItem value="10">১০ ইঞ্চি</SelectItem></SelectContent></Select></FormItem>)} />
                                    </div>
                                </div>
                                <Button type="submit" className="w-full font-bold">হিসাব করুন</Button>
                            </div>
                            <div className="space-y-4">{brickResults && <ResultBox label="মোট ইট" value={brickResults.bricks} />}</div>
                        </div>
                    </form></Form>
                </TabsContent>

                <TabsContent value="conversion" className="p-4 md:p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <Card className="shadow-lg">
                            <CardHeader><CardTitle className="flex items-center gap-2 text-primary text-base"><Layers className="w-5 h-5"/>CFT থেকে ইট</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <Label>কাজের পরিমাণ (CFT)</Label>
                                <Input type="number" value={cftToBrickInput} onChange={(e) => setCftToBrickInput(e.target.value)} placeholder="১০০" />
                                <Button onClick={calculateCftToBricks} className="w-full">হিসাব করুন</Button>
                                {cftToBrickResult && <div className="p-3 bg-orange-50 border border-orange-200 text-center font-bold">প্রয়োজনীয় ইট: {cftToBrickResult} টি</div>}
                            </CardContent>
                        </Card>
                        <Card className="shadow-lg">
                            <CardHeader><CardTitle className="flex items-center gap-2 text-primary text-base"><Move className="w-5 h-5"/>রডের দৈর্ঘ্য থেকে ওজন</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <Label>মোট দৈর্ঘ্য (ফুট)</Label>
                                <Input type="number" value={rodLengthInput} onChange={(e) => setRodLengthInput(e.target.value)} placeholder="৪০" />
                                <Select onValueChange={(v) => setRodConversionFactor(parseFloat(v))} defaultValue="0.48">
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="0.12">৮ মিলি</SelectItem><SelectItem value="0.19">১০ মিলি</SelectItem><SelectItem value="0.30">১২ মিলি</SelectItem><SelectItem value="0.48">১৬ মিলি</SelectItem></SelectContent>
                                </Select>
                                <Button onClick={calculateRodWeight} className="w-full">হিসাব করুন</Button>
                                {rodWeightResult && <div className="p-3 bg-blue-50 border border-blue-200 text-center font-bold">মোট ওজন: {rodWeightResult.toFixed(2)} কেজি</div>}
                            </CardContent>
                        </Card>
                        <Card className="shadow-lg">
                            <CardHeader><CardTitle className="flex items-center gap-2 text-primary text-base"><Box className="w-5 h-5"/>খোয়া থেকে ইট</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <Label>খোয়ার পরিমাণ (CFT)</Label>
                                <Input type="number" value={khowaCftToBrickInput} onChange={(e) => setKhowaCftToBrickInput(e.target.value)} placeholder="১০০" />
                                <Button onClick={calculateKhowaToBricks} className="w-full">হিসাব করুন</Button>
                                {khowaCftToBrickResult && <div className="p-3 bg-green-50 border border-green-200 text-center font-bold">প্রয়োজনীয় ইট: {khowaCftToBrickResult} টি</div>}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </Card>
    </div>
    </>
  );
}

const ToolButton = ({ label, icon, active, onClick }: { label: string, icon: React.ReactNode, active: boolean, onClick: () => void }) => (
    <Button 
        variant={active ? "default" : "outline"} 
        className={cn("h-16 flex flex-col gap-1 p-2 transition-all", active && "ring-2 ring-primary border-primary")}
        onClick={onClick}
    >
        {icon}
        <span className="text-[10px]">{label}</span>
    </Button>
);

const ResultDisplay = ({ results }: { results: StructuralResults }) => (
  <div className="bg-card p-5 rounded-2xl border-2 shadow-inner">
      <div className="grid grid-cols-1 gap-4">
          <div className="text-center p-3 bg-accent/10 rounded-lg">
              <span className="text-xs text-accent-foreground/70 font-bold uppercase">সিমেন্ট (ব্যাগ)</span>
              <p className="text-4xl font-black text-primary">{results.cement}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
              <ResultBox label="বালু (CFT)" value={results.sand.toFixed(1)} />
              <ResultBox label="খোয়া (CFT)" value={results.chips.toFixed(1)} />
          </div>
          <div className="p-4 bg-orange-400/10 rounded-lg border-l-4 border-orange-500">
              <span className="text-[10px] text-orange-600 font-bold">মোট রড ওজন</span>
              <p className="text-3xl font-black text-slate-800">{results.totalRodWeight.toFixed(1)} কেজি</p>
          </div>
      </div>
  </div>
);

const SlabResultDisplay = ({ results }: { results: SlabResults }) => (
  <Card className="p-4 space-y-3">
    <h3 className="font-bold text-sm text-primary border-b pb-1">ছাদের হিসাব</h3>
    <div className="grid grid-cols-2 gap-2">
        <ResultBox label="সিমেন্ট" value={`${results.cement} ব্যাগ`} />
        <ResultBox label="রড" value={`${results.rodWeight} কেজি`} />
    </div>
  </Card>
);

const StairResultDisplay = ({ results }: { results: StairResults }) => (
    <Card className="p-4 space-y-3">
        <h3 className="font-bold text-sm text-primary border-b pb-1">সিঁড়ির হিসাব</h3>
        <div className="grid grid-cols-2 gap-2">
            <ResultBox label="সিমেন্ট" value={`${results.cement} ব্যাগ`} />
            <ResultBox label="রড" value={`${results.totalRodWeight} কেজি`} />
        </div>
    </Card>
);

const ResultBox = ({ label, value }: { label: string, value: number | string }) => (
    <div className="p-3 bg-muted/50 rounded-lg text-center">
        <span className="text-[10px] text-muted-foreground uppercase font-bold">{label}</span>
        <p className="text-2xl font-bold text-primary">{value}</p>
    </div>
);
