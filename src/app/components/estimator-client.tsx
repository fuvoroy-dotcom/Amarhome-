"use client";

import React, { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building, Cog, BarChartBig, BrainCircuit, Loader2 } from "lucide-react";
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
import { estimatorSchema, type EstimatorValues } from "@/app/lib/schemas";
import { getConstructionAdvice } from "@/app/actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

type Results = {
  cement: number;
  sand: number;
  chips: number;
  mainRodWeight: number;
  ringRodWeight: number;
  totalRodWeight: number;
};

export default function EstimatorClient() {
  const [results, setResults] = useState<Results | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiAdvice, setAiAdvice] = useState("");
  const [isAiLoading, startAiTransition] = useTransition();
  const { toast } = useToast();


  const form = useForm<EstimatorValues>({
    resolver: zodResolver(estimatorSchema),
    defaultValues: {
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
        baseLengthFt, baseWidthFt, baseThicknessIn,
        columnCount, columnLengthIn, columnWidthIn, columnHeightFt,
        beamHeightIn, beamWidthIn, beamLengthFt,
        columnRodCount, beamRodCount, mainRodFactor,
        ringGapIn, ringRodFactor, baseRodLongitudinalCount, baseRodWidthCount
    } = data;

    const baseVol = baseLengthFt * baseWidthFt * (baseThicknessIn / 12);
    const colVol = (columnLengthIn / 12) * (columnWidthIn / 12) * columnHeightFt * columnCount;
    const beamVol = (beamHeightIn / 12) * (beamWidthIn / 12) * beamLengthFt;
    const totalWetVol = baseVol + colVol + beamVol;
    
    const dryVol = totalWetVol * 1.5;
    const ratioSum = 5.5; // 1 + 1.5 + 3

    const cementBags = Math.ceil((dryVol / ratioSum) / 1.25);
    const sandCFT = (dryVol / ratioSum) * 1.5;
    const chipsCFT = (dryVol / ratioSum) * 3;

    const baseRodWeight = ((baseRodLongitudinalCount * baseWidthFt) + (baseRodWidthCount * baseLengthFt)) * mainRodFactor;
    const mainRodWeight = ((columnRodCount * columnHeightFt * columnCount) + (beamRodCount * beamLengthFt)) * mainRodFactor + baseRodWeight;

    const ringCountCol = (columnHeightFt * 12) / ringGapIn;
    const ringCountBeam = (beamLengthFt * 12) / ringGapIn;
    const ringLenCol = ((columnLengthIn / 12) + (columnWidthIn / 12)) * 2;
    const ringLenBeam = ((beamHeightIn / 12) + (beamWidthIn / 12)) * 2;
    const ringWeight = ((ringCountCol * ringLenCol * columnCount) + (ringCountBeam * ringLenBeam)) * ringRodFactor;

    setResults({
      cement: cementBags,
      sand: sandCFT,
      chips: chipsCFT,
      mainRodWeight: mainRodWeight,
      ringRodWeight: ringWeight,
      totalRodWeight: mainRodWeight + ringWeight,
    });
  }

  const handleGetAdvice = () => {
    const values = form.getValues();
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

  return (
    <>
    <div className="w-full max-w-6xl">
        <Card className="w-full overflow-hidden shadow-2xl border-border/40">
            <div className="bg-primary p-5 text-primary-foreground text-center">
                <h1 className="text-3xl font-bold">পূর্ণাঙ্গ কনস্ট্রাকশন ক্যালকুলেটর</h1>
                <p className="text-primary-foreground/80 text-sm mt-1">বেস, কলাম ও বিমের সমন্বিত ও আলাদা হিসাব</p>
            </div>
            
            <Form {...form}>
                <form onSubmit={form.handleSubmit(calculateMaterials)} className="p-4 md:p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* Dimensions Column */}
                        <div className="space-y-4">
                            <h2 className="font-bold text-lg text-primary border-b pb-2 flex items-center gap-2">
                                <Building className="w-5 h-5" />
                                কাঠামোর মাপ (Dimensions)
                            </h2>
                            <div className="bg-card p-4 rounded-xl space-y-6 border">
                                <DimensionInputGroup form={form} title="বেসের মাপ (ফুট/ইঞ্চি)" fields={[
                                    {name: "baseLengthFt", placeholder: "লম্বা (ফুট)"},
                                    {name: "baseWidthFt", placeholder: "চওড়া (ফুট)"},
                                    {name: "baseThicknessIn", placeholder: "পুরুত্ব (ইঞ্চি)"},
                                ]} gridCols={3} />
                                <div>
                                    <p className="text-xs font-bold text-muted-foreground uppercase mb-2">কলাম</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        <FormField
                                            control={form.control}
                                            name="columnCount"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Input type="number" placeholder="সংখ্যা (টি)" {...field} className="text-sm" />
                                                    </FormControl>
                                                    <FormMessage className="text-xs" />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="columnLengthIn"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Input type="number" placeholder="দৈর্ঘ্য (ইঞ্চি)" {...field} className="text-sm" />
                                                    </FormControl>
                                                    <FormMessage className="text-xs" />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="columnWidthIn"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Input type="number" placeholder="প্রস্থ (ইঞ্চি)" {...field} className="text-sm" />
                                                    </FormControl>
                                                    <FormMessage className="text-xs" />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <FormField
                                        control={form.control}
                                        name="columnHeightFt"
                                        render={({ field }) => (
                                            <FormItem className="mt-2">
                                                <FormControl>
                                                    <Input type="number" placeholder="মোট উচ্চতা (ফুট)" {...field} className="w-full text-sm" />
                                                </FormControl>
                                                <FormMessage className="text-xs" />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <DimensionInputGroup form={form} title="বিমের মাপ (ইঞ্চি/ফুট)" fields={[
                                    {name: "beamHeightIn", placeholder: "উচ্চতা (ইঞ্চি)"},
                                    {name: "beamWidthIn", placeholder: "প্রস্থ (ইঞ্চি)"},
                                ]} gridCols={2} singleField={{name: "beamLengthFt", placeholder: "মোট দৈর্ঘ্য (ফুট)"}} />
                            </div>
                        </div>

                        {/* Steel Settings Column */}
                        <div className="space-y-4">
                            <h2 className="font-bold text-lg text-primary border-b pb-2 flex items-center gap-2">
                                <Cog className="w-5 h-5" />
                                রড সেটিংস (Steel)
                            </h2>
                            <div className="bg-card p-4 rounded-xl space-y-6 border">
                                <SteelInputGroup form={form} />
                            </div>
                            <Button type="submit" className="w-full font-bold py-3 text-lg rounded-xl shadow-lg transition-transform active:scale-[0.98]">
                                হিসাব করুন
                            </Button>
                        </div>
                        
                        {/* Results Column */}
                        <div className="space-y-4">
                            <h2 className="font-bold text-lg text-primary border-b pb-2 flex items-center gap-2">
                                <BarChartBig className="w-5 h-5" />
                                ফলাফল (Result)
                            </h2>
                            {results ? (
                                <div className="space-y-4">
                                    <ResultDisplay results={results} />
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

// Helper components for form structure

const DimensionInputGroup = ({form, title, fields, gridCols, singleField}: any) => (
    <div>
        <p className="text-xs font-bold text-muted-foreground uppercase mb-2">{title}</p>
        <div className={`grid grid-cols-${gridCols} gap-2`}>
            {fields.map((field: any) => (
                <FormField
                    key={field.name}
                    control={form.control}
                    name={field.name}
                    render={({ field: formField }) => (
                        <FormItem>
                            <FormControl>
                                <Input type="number" placeholder={field.placeholder} {...formField} className="text-sm" />
                            </FormControl>
                            <FormMessage className="text-xs" />
                        </FormItem>
                    )}
                />
            ))}
        </div>
        {singleField && (
            <FormField
                control={form.control}
                name={singleField.name}
                render={({ field }) => (
                    <FormItem className="mt-2">
                        <FormControl>
                            <Input type="number" placeholder={singleField.placeholder} {...field} className="w-full text-sm" />
                        </FormControl>
                        <FormMessage className="text-xs" />
                    </FormItem>
                )}
            />
        )}
    </div>
);

const SteelInputGroup = ({form}: any) => (
    <>
        <div>
            <FormLabel className="block text-xs font-bold text-muted-foreground uppercase mb-2">কলাম ও বিম রড (টি)</FormLabel>
            <div className="grid grid-cols-2 gap-2">
                <FormField control={form.control} name="columnRodCount" render={({ field }) => (
                    <FormItem><FormControl><Input type="number" placeholder="কলাম রড" {...field} className="text-sm" /></FormControl><FormMessage className="text-xs" /></FormItem>
                )} />
                <FormField control={form.control} name="beamRodCount" render={({ field }) => (
                    <FormItem><FormControl><Input type="number" placeholder="বিম রড" {...field} className="text-sm" /></FormControl><FormMessage className="text-xs" /></FormItem>
                )} />
            </div>
        </div>

        <div>
            <FormLabel className="block text-xs font-bold text-muted-foreground uppercase mb-2">রডের ব্যাস ও রিং</FormLabel>
            <FormField control={form.control} name="mainRodFactor" render={({ field }) => (
                <FormItem>
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
            <div className="grid grid-cols-2 gap-2 mt-2">
                <FormField control={form.control} name="ringGapIn" render={({ field }) => (
                    <FormItem><FormControl><Input type="number" placeholder="রিং গ্যাপ (ইঞ্চি)" {...field} className="text-sm" /></FormControl><FormMessage className="text-xs" /></FormItem>
                )} />
                <FormField control={form.control} name="ringRodFactor" render={({ field }) => (
                    <FormItem>
                        <Select onValueChange={field.onChange} defaultValue={String(field.value)}>
                            <FormControl><SelectTrigger><SelectValue placeholder="রিং রড..." /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="0.12">৮ মিলি রিং</SelectItem>
                                <SelectItem value="0.19">১০ মিলি রিং</SelectItem>
                            </SelectContent>
                        </Select>
                    </FormItem>
                )} />
            </div>
        </div>

        <div>
            <FormLabel className="block text-xs font-bold text-muted-foreground uppercase mb-2">বেসের জালি (রড সংখ্যা)</FormLabel>
            <div className="grid grid-cols-2 gap-2">
                 <FormField control={form.control} name="baseRodLongitudinalCount" render={({ field }) => (
                    <FormItem><FormControl><Input type="number" placeholder="লম্বালম্বি রড" {...field} className="text-sm" /></FormControl><FormMessage className="text-xs" /></FormItem>
                )} />
                <FormField control={form.control} name="baseRodWidthCount" render={({ field }) => (
                    <FormItem><FormControl><Input type="number" placeholder="আড়াআড়ি রড" {...field} className="text-sm" /></FormControl><FormMessage className="text-xs" /></FormItem>
                )} />
            </div>
        </div>
    </>
);


const ResultDisplay = ({ results }: { results: Results }) => (
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
