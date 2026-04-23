"use client";

import React, { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building, Cog, BarChartBig, BrainCircuit, Loader2, Layers, Home } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
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
import { estimatorSchema, type EstimatorValues, brickEstimatorSchema, type BrickEstimatorValues, tileEstimatorSchema, type TileEstimatorValues } from "@/app/lib/schemas";
import { getConstructionAdvice } from "@/app/actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type StructuralResults = {
  cement: number;
  sand: number;
  chips: number;
  mainRodWeight: number;
  ringRodWeight: number;
  totalRodWeight: number;
};

type BrickResults = {
    bricks: number;
    cement: number;
    sand: number;
}

type TileResults = {
    tiles: number;
}

export default function EstimatorClient() {
  const [structuralResults, setStructuralResults] = useState<StructuralResults | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiAdvice, setAiAdvice] = useState("");
  const [isAiLoading, startAiTransition] = useTransition();
  const { toast } = useToast();

  const structuralForm = useForm<EstimatorValues>({
    resolver: zodResolver(estimatorSchema),
    defaultValues: {
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
        baseCount, baseLengthFt, baseWidthFt, baseThicknessIn,
        columnCount, columnLengthIn, columnWidthIn, columnHeightFt,
        beamHeightIn, beamWidthIn, beamLengthFt,
        columnRodCount, beamRodCount, mainRodFactor,
        ringGapIn, ringRodFactor, baseRodLongitudinalCount, baseRodWidthCount
    } = data;

    const baseVol = baseLengthFt * baseWidthFt * (baseThicknessIn / 12) * baseCount;
    const colVol = (columnLengthIn / 12) * (columnWidthIn / 12) * columnHeightFt * columnCount;
    const beamVol = (beamHeightIn / 12) * (beamWidthIn / 12) * beamLengthFt;
    const totalWetVol = baseVol + colVol + beamVol;
    
    const dryVol = totalWetVol * 1.5;
    const ratioSum = 5.5; // 1 + 1.5 + 3

    const cementBags = Math.ceil((dryVol / ratioSum) / 1.25);
    const sandCFT = (dryVol / ratioSum) * 1.5;
    const chipsCFT = (dryVol / ratioSum) * 3;

    const baseRodWeight = ((baseRodLongitudinalCount * baseWidthFt) + (baseRodWidthCount * baseLengthFt)) * mainRodFactor * baseCount;
    const mainRodWeight = ((columnRodCount * columnHeightFt * columnCount) + (beamRodCount * beamLengthFt)) * mainRodFactor + baseRodWeight;

    const ringCountCol = (columnHeightFt * 12) / ringGapIn;
    const ringCountBeam = (beamLengthFt * 12) / ringGapIn;
    const ringLenCol = ((columnLengthIn / 12) + (columnWidthIn / 12)) * 2;
    const ringLenBeam = ((beamHeightIn / 12) + (beamWidthIn / 12)) * 2;
    const ringWeight = ((ringCountCol * ringLenCol * columnCount) + (ringCountBeam * ringLenBeam)) * ringRodFactor;

    setStructuralResults({
      cement: cementBags,
      sand: sandCFT,
      chips: chipsCFT,
      mainRodWeight: mainRodWeight,
      ringRodWeight: ringWeight,
      totalRodWeight: mainRodWeight + ringWeight,
    });
  }

  const handleGetAdvice = () => {
    const values = structuralForm.getValues();
    const validation = estimatorSchema.safeParse(values);
    if (!validation.success) {
      toast({
        variant: "destructive",
        title: "ত্রুটি",
        description: "অনুগ্রহ করে ফর্মের সমস্ত মান সঠিকভাবে পূরণ করুন।",
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
          calculationType: 'wall',
          wallLengthFt: 10,
          wallWidthFt: 10,
          wallHeightFt: 10,
          wallThicknessIn: '5',
          roomCount: 1,
      }
  });
  const calculationType = brickForm.watch('calculationType');

  function calculateBricks(data: BrickEstimatorValues) {
      const { calculationType, wallLengthFt, wallWidthFt, wallHeightFt, wallThicknessIn, roomCount } = data;
      
      const roomMultiplier = calculationType === 'room' && roomCount ? roomCount : 1;
      
      const totalLength = calculationType === 'room' && wallWidthFt 
          ? (wallLengthFt + wallWidthFt) * 2 
          : wallLengthFt;

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
          bricks: Math.ceil(bricks * roomMultiplier),
          cement: Math.ceil(cement * roomMultiplier),
          sand: parseFloat((sand * roomMultiplier).toFixed(1)),
      });
  }
  
  const [tileResults, setTileResults] = useState<TileResults | null>(null);
  const tileForm = useForm<TileEstimatorValues>({
      resolver: zodResolver(tileEstimatorSchema),
      defaultValues: {
          floorLengthFt: 12,
          floorWidthFt: 10,
          tileLengthIn: 12,
          tileWidthIn: 12,
          wastagePercent: 10,
      }
  });

  function calculateTiles(data: TileEstimatorValues) {
      const { floorLengthFt, floorWidthFt, tileLengthIn, tileWidthIn, wastagePercent } = data;
      const floorArea = floorLengthFt * floorWidthFt;
      const tileArea = (tileLengthIn / 12) * (tileWidthIn / 12);
      
      if (tileArea === 0) {
          setTileResults({ tiles: 0 });
          return;
      }

      const tilesNeeded = floorArea / tileArea;
      const totalTiles = Math.ceil(tilesNeeded * (1 + wastagePercent / 100));

      setTileResults({
          tiles: totalTiles
      });
  }

  return (
    <>
    <div className="w-full max-w-6xl">
        <Card className="w-full overflow-hidden shadow-2xl border-border/40">
            <div className="bg-primary p-5 text-primary-foreground text-center">
                <h1 className="text-3xl font-bold">পূর্ণাঙ্গ কনস্ট্রাকশন ক্যালকুলেটর</h1>
                <p className="text-primary-foreground/80 text-sm mt-1">বেস, কলাম, বিম, ইট এবং টাইলস এর সমন্বিত হিসাব</p>
            </div>
            
            <Tabs defaultValue="structural" className="w-full">
                <TabsList className="grid w-full grid-cols-3 rounded-none h-auto">
                    <TabsTrigger value="structural" className="py-3 rounded-none text-base data-[state=active]:shadow-inner data-[state=active]:bg-background/50">
                        <Building className="mr-2 h-5 w-5" />
                        স্ট্রাকচার
                    </TabsTrigger>
                    <TabsTrigger value="brick" className="py-3 rounded-none text-base data-[state=active]:shadow-inner data-[state=active]:bg-background/50">
                        <Layers className="mr-2 h-5 w-5" />
                        ইট গাঁথুনি
                    </TabsTrigger>
                    <TabsTrigger value="tile" className="py-3 rounded-none text-base data-[state=active]:shadow-inner data-[state=active]:bg-background/50">
                        <Home className="mr-2 h-5 w-5" />
                        টাইলস
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
                                            <FormLabel className="font-bold text-muted-foreground">রডের ব্যাস ও রিং</FormLabel>
                                            <FormField control={structuralForm.control} name="mainRodFactor" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs">প্রধান রড</FormLabel>
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
                                                    <FormLabel htmlFor="type_wall" className="font-normal text-base">প্রচীর</FormLabel>
                                                </FormItem>
                                                <FormItem className="flex items-center space-x-2">
                                                    <FormControl><RadioGroupItem value="room" id="type_room" /></FormControl>
                                                    <FormLabel htmlFor="type_room" className="font-normal text-base">রুম</FormLabel>
                                                </FormItem>
                                                </RadioGroup>
                                            </FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )} />
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <FormField control={brickForm.control} name="wallLengthFt" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>{calculationType === 'room' ? 'রুমের দৈর্ঘ্য (ফুট)' : 'প্রাচীরের দৈর্ঘ্য (ফুট)'}</FormLabel>
                                                    <FormControl><Input type="number" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            
                                            {calculationType === 'room' && (
                                                <>
                                                <FormField control={brickForm.control} name="wallWidthFt" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>রুমের প্রস্থ (ফুট)</FormLabel>
                                                        <FormControl><Input type="number" {...field} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                                <FormField control={brickForm.control} name="roomCount" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>রুমের সংখ্যা (টি)</FormLabel>
                                                        <FormControl><Input type="number" {...field} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                                </>
                                            )}
                                            
                                            <FormField control={brickForm.control} name="wallHeightFt" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>{calculationType === 'room' ? 'রুমের উচ্চতা (ফুট)' : 'প্রাচীরের উচ্চতা (ফুট)'}</FormLabel>
                                                    <FormControl><Input type="number" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        </div>

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
                 <TabsContent value="tile" className="p-0">
                    <Form {...tileForm}>
                        <form onSubmit={tileForm.handleSubmit(calculateTiles)} className="p-4 md:p-6">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 space-y-6">
                                     <h2 className="font-bold text-lg text-primary border-b pb-2 flex items-center gap-2">
                                        <Home className="w-5 h-5" />
                                        টাইলসের মাপ (Tile Dimensions)
                                    </h2>
                                    <div className="bg-card p-4 rounded-xl space-y-6 border">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <FormField control={tileForm.control} name="floorLengthFt" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>ফ্লোরের দৈর্ঘ্য (ফুট)</FormLabel>
                                                    <FormControl><Input type="number" placeholder="যেমন: ১২" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <FormField control={tileForm.control} name="floorWidthFt" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>ফ্লোরের প্রস্থ (ফুট)</FormLabel>
                                                    <FormControl><Input type="number" placeholder="যেমন: ১০" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        </div>
                                         <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
