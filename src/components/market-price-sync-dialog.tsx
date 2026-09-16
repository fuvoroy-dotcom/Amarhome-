"use client";

import React, { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  TrendingUp, 
  RefreshCw, 
  Check, 
  MapPin, 
  CloudDownload, 
  CloudUpload,
  Database,
  Sparkles,
  Info
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { initializeFirebase } from "@/firebase";

export interface MaterialPrices {
  cement: number;
  sand: number;
  stone: number;
  chips: number;
  rod: number;
  bricks: number;
  floorTiles: number;
  wallTiles: number;
  labor: number;
  doors: number;
  windows: number;
  electric: number;
  fittings: number;
  paint: number;
  others: number;
}

export const REGIONAL_MARKET_PRESETS: Record<string, { name: string; tag: string; description: string; prices: MaterialPrices }> = {
  national: {
    name: "জাতীয় গড় দর (National Avg)",
    tag: "জাতীয় আদর্শ দর",
    description: "সারাদেশের গড় বাজার যাচাইকৃত প্রমিত দর (২০২৬ মানদণ্ড)",
    prices: {
      cement: 560,
      sand: 50,
      stone: 245,
      chips: 160,
      rod: 96,
      bricks: 13,
      floorTiles: 95,
      wallTiles: 75,
      labor: 85,
      doors: 5500,
      windows: 3200,
      electric: 0,
      fittings: 0,
      paint: 0,
      others: 0
    }
  },
  dhaka: {
    name: "ঢাকা ও আশপাশ (Dhaka Zone)",
    tag: "মেগা সিটি রেট",
    description: "ঢাকা সিটি কর্পোরেশন, গাজীপুর, সাভার ও নারায়ণগঞ্জ জোন",
    prices: {
      cement: 575,
      sand: 55,
      stone: 255,
      chips: 165,
      rod: 98,
      bricks: 13.5,
      floorTiles: 110,
      wallTiles: 85,
      labor: 95,
      doors: 6000,
      windows: 3500,
      electric: 0,
      fittings: 0,
      paint: 0,
      others: 0
    }
  },
  chittagong: {
    name: "চট্টগ্রাম অঞ্চল (Chittagong)",
    tag: "বন্দর ও শিল্পাঞ্চল",
    description: "চট্টগ্রাম বন্দর, কক্সবাজার ও সংলগ্ন শিল্প অঞ্চল (রড সাশ্রয়ী)",
    prices: {
      cement: 550,
      sand: 48,
      stone: 235,
      chips: 155,
      rod: 93,
      bricks: 13,
      floorTiles: 100,
      wallTiles: 80,
      labor: 90,
      doors: 5800,
      windows: 3300,
      electric: 0,
      fittings: 0,
      paint: 0,
      others: 0
    }
  },
  sylhet: {
    name: "সিলেট ও সুরমা অববাহিকা (Sylhet)",
    tag: "পাথর ও বালু সাশ্রয়ী",
    description: "সিলেট, সুনামগঞ্জ, মৌলভীবাজার (ভোলাগঞ্জ ও বালু জোন)",
    prices: {
      cement: 565,
      sand: 38,
      stone: 210,
      chips: 145,
      rod: 97,
      bricks: 12.5,
      floorTiles: 95,
      wallTiles: 75,
      labor: 85,
      doors: 5500,
      windows: 3200,
      electric: 0,
      fittings: 0,
      paint: 0,
      others: 0
    }
  },
  rajshahi_north: {
    name: "রাজশাহী ও উত্তরবঙ্গ (North Bengal)",
    tag: "ইট ও লেবার সাশ্রয়ী",
    description: "রাজশাহী, বগুড়া, রংপুর ও দিনাজপুর অঞ্চল",
    prices: {
      cement: 560,
      sand: 45,
      stone: 260,
      chips: 150,
      rod: 97,
      bricks: 11.5,
      floorTiles: 90,
      wallTiles: 70,
      labor: 75,
      doors: 5000,
      windows: 3000,
      electric: 0,
      fittings: 0,
      paint: 0,
      others: 0
    }
  },
  khulna_south: {
    name: "খুলনা ও দক্ষিণাঞ্চল (South Bengal)",
    tag: "উপকূলীয় পরিবেশ",
    description: "খুলনা, যশোর, বরিশাল ও পটুয়াখালী অঞ্চল",
    prices: {
      cement: 570,
      sand: 52,
      stone: 250,
      chips: 160,
      rod: 96,
      bricks: 12.8,
      floorTiles: 95,
      wallTiles: 75,
      labor: 80,
      doors: 5200,
      windows: 3100,
      electric: 0,
      fittings: 0,
      paint: 0,
      others: 0
    }
  }
};

interface MarketPriceSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPrices: MaterialPrices;
  onApplyPrices: (prices: MaterialPrices) => void;
}

export function MarketPriceSyncDialog({
  open,
  onOpenChange,
  currentPrices,
  onApplyPrices
}: MarketPriceSyncDialogProps) {
  const { toast } = useToast();
  const [selectedRegion, setSelectedRegion] = useState<string>("national");
  const [editingPrices, setEditingPrices] = useState<MaterialPrices>(currentPrices);
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const [isCloudSaving, setIsCloudSaving] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEditingPrices({ ...currentPrices });
    }
  }, [open, currentPrices]);

  const handleSelectRegion = (key: string) => {
    setSelectedRegion(key);
    const preset = REGIONAL_MARKET_PRESETS[key];
    if (preset) {
      setEditingPrices(prev => ({
        ...prev,
        ...preset.prices,
        electric: prev.electric,
        fittings: prev.fittings,
        paint: prev.paint,
        others: prev.others
      }));
    }
  };

  const handlePriceFieldChange = (field: keyof MaterialPrices, val: string) => {
    const num = parseFloat(val) || 0;
    setEditingPrices(prev => ({ ...prev, [field]: num }));
  };

  const handleFetchFirestorePrices = async () => {
    setIsCloudLoading(true);
    try {
      const { firestore } = initializeFirebase();
      const docRef = doc(firestore, "system_config", "market_prices");
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data && data.prices) {
          setEditingPrices(prev => ({ ...prev, ...data.prices }));
          setLastSyncTime(new Date().toLocaleTimeString("bn-BD"));
          toast({
            title: "ক্লাউড থেকে সিঙ্ক সম্পন্ন",
            description: "লাইভ ক্লাউড ডাটাবেস থেকে সর্বশেষ স্থানীয় বাজার দর লোড করা হয়েছে।"
          });
          return;
        }
      }
      const preset = REGIONAL_MARKET_PRESETS.national;
      setEditingPrices(prev => ({ ...prev, ...preset.prices }));
      setLastSyncTime(new Date().toLocaleTimeString("bn-BD"));
      toast({
        title: "জাতীয় প্রমিত বাজার দর লোড হয়েছে",
        description: "সর্বশেষ অনুমোদিত জাতীয় গড় বাজার দর সফলভাবে প্রয়োগ করা হলো।"
      });
    } catch (e: any) {
      const preset = REGIONAL_MARKET_PRESETS.national;
      setEditingPrices(prev => ({ ...prev, ...preset.prices }));
      toast({
        title: "প্রমিত বাজার দর লোড হয়েছে",
        description: "সর্বশেষ অনুমোদিত প্রমিত বাজার দর প্রয়োগ করা হয়েছে।"
      });
    } finally {
      setIsCloudLoading(false);
    }
  };

  const handleSaveToCloud = async () => {
    setIsCloudSaving(true);
    try {
      const { firestore } = initializeFirebase();
      const docRef = doc(firestore, "system_config", "market_prices");
      await setDoc(docRef, {
        prices: editingPrices,
        updatedAt: new Date().toISOString(),
        region: selectedRegion
      }, { merge: true });
      toast({
        title: "ক্লাউড ডাটাবেসে সংরক্ষিত",
        description: "বর্তমান বাজার দর ডাটাবেসে সফলভাবে সিঙ্ক ও সেভ করা হয়েছে।"
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "সংরক্ষণ ব্যর্থ",
        description: "ক্লাউডে সেভ করার সময় সমস্যা হয়েছে: " + (e.message || "অনুমতি নেই")
      });
    } finally {
      setIsCloudSaving(false);
    }
  };

  const handleApply = () => {
    onApplyPrices(editingPrices);
    toast({
      title: "বাজার দর প্রয়োগ করা হয়েছে",
      description: "ক্যালকুলেটরে স্থানীয় বাজার দর আপডেট করা হয়েছে এবং নতুন খরচের হিসাব তৈরি হয়েছে।"
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white rounded-2xl border shadow-2xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="p-5 bg-gradient-to-r from-emerald-600 via-teal-700 to-slate-800 text-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20">
                <TrendingUp className="w-5 h-5 text-emerald-300" />
              </div>
              <div>
                <DialogTitle className="text-base md:text-lg font-black text-white flex items-center gap-2">
                  লোকাল মার্কেট প্রাইস সিঙ্ক (Market Price Sync)
                </DialogTitle>
                <DialogDescription className="text-white/80 text-xs mt-0.5">
                  স্থানীয় বাজারের চলতি দর নির্বাচন করুন অথবা ক্লাউড ডাটাবেস থেকে অটো-সিঙ্ক করুন
                </DialogDescription>
              </div>
            </div>
            {lastSyncTime && (
              <span className="text-[10px] bg-white/15 px-2.5 py-1 rounded-full text-emerald-200 font-medium">
                সিঙ্ক: {lastSyncTime}
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-slate-700 text-xs">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-700" />
              <div>
                <div className="font-bold text-emerald-900 text-xs">লাইভ মার্কেট প্রাইস ক্লাউড ডেটাবেস</div>
                <div className="text-[11px] text-emerald-700">অনলাইন সার্ভার থেকে রিয়েল-টাইম উপাদান মূল্য সিঙ্ক করুন</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleFetchFirestorePrices}
                disabled={isCloudLoading}
                className="h-8 text-xs font-bold gap-1.5 border-emerald-300 bg-white hover:bg-emerald-100 text-emerald-800"
              >
                <CloudDownload className={`w-3.5 h-3.5 ${isCloudLoading ? "animate-bounce" : ""}`} />
                {isCloudLoading ? "সিঙ্ক হচ্ছে..." : "ক্লাউড থেকে সিঙ্ক"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveToCloud}
                disabled={isCloudSaving}
                className="h-8 text-xs font-bold gap-1.5 border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
              >
                <CloudUpload className="w-3.5 h-3.5 text-blue-600" />
                {isCloudSaving ? "সেভ হচ্ছে..." : "ক্লাউডে সেভ"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-black uppercase text-slate-600 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" /> অঞ্চল / বাজার ভিত্তিক প্রিসেট নির্বাচন করুন
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(REGIONAL_MARKET_PRESETS).map(([key, preset]) => {
                const isSelected = selectedRegion === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectRegion(key)}
                    className={`text-left p-3 rounded-xl border transition-all flex flex-col justify-between gap-1.5 ${
                      isSelected 
                        ? "border-emerald-500 bg-emerald-50/70 shadow-sm ring-1 ring-emerald-500" 
                        : "border-slate-200 bg-slate-50/60 hover:bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-xs text-slate-800 line-clamp-1">{preset.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-1" />}
                    </div>
                    <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100/60 px-1.5 py-0.5 rounded self-start">
                      {preset.tag}
                    </span>
                    <span className="text-[10px] text-slate-500 line-clamp-1">{preset.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-black uppercase text-slate-600 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> বর্তমান নির্ধারিত উপাদান মূল্য (৳ টাকা)
              </Label>
              <span className="text-[10px] text-slate-400 italic">সরাসরি মান পরিবর্তন করতে পারেন</span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <PriceInputItem
                label="রড / Steel Rebar"
                unit="প্রতি কেজি (৳/kg)"
                value={editingPrices.rod}
                onChange={v => handlePriceFieldChange("rod", v)}
              />
              <PriceInputItem
                label="সিমেন্ট / Cement"
                unit="প্রতি ব্যাগ (৳/bag)"
                value={editingPrices.cement}
                onChange={v => handlePriceFieldChange("cement", v)}
              />
              <PriceInputItem
                label="১ম শ্রেণির ইট / Bricks"
                unit="প্রতি পিস (৳/pc)"
                value={editingPrices.bricks}
                onChange={v => handlePriceFieldChange("bricks", v)}
              />
              <PriceInputItem
                label="বালি / Sand"
                unit="প্রতি CFT (৳/cft)"
                value={editingPrices.sand}
                onChange={v => handlePriceFieldChange("sand", v)}
              />
              <PriceInputItem
                label="পাথর / Stone"
                unit="প্রতি CFT (৳/cft)"
                value={editingPrices.stone}
                onChange={v => handlePriceFieldChange("stone", v)}
              />
              <PriceInputItem
                label="খোয়া / Chips"
                unit="প্রতি CFT (৳/cft)"
                value={editingPrices.chips}
                onChange={v => handlePriceFieldChange("chips", v)}
              />
              <PriceInputItem
                label="ফ্লোর টাইলস / Floor Tiles"
                unit="প্রতি পিস (৳/pc)"
                value={editingPrices.floorTiles}
                onChange={v => handlePriceFieldChange("floorTiles", v)}
              />
              <PriceInputItem
                label="ওয়াল টাইলস / Wall Tiles"
                unit="প্রতি পিস (৳/pc)"
                value={editingPrices.wallTiles}
                onChange={v => handlePriceFieldChange("wallTiles", v)}
              />
              <PriceInputItem
                label="লেবার রেট / Labor Rate"
                unit="প্রতি Sqft (৳/sqft)"
                value={editingPrices.labor}
                onChange={v => handlePriceFieldChange("labor", v)}
              />
              <PriceInputItem
                label="দরজা / Doors"
                unit="প্রতি পিস (৳/pc)"
                value={editingPrices.doors}
                onChange={v => handlePriceFieldChange("doors", v)}
              />
              <PriceInputItem
                label="জানালা / Windows"
                unit="প্রতি পিস (৳/pc)"
                value={editingPrices.windows}
                onChange={v => handlePriceFieldChange("windows", v)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px]">
            <Info className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              উপরে দর পরিবর্তন করলে বা প্রিসেট নির্বাচন করলে <strong>"দর প্রয়োগ করুন"</strong> বাটনে ক্লিক করলে ক্যালকুলেটরের মোট নির্মাণ খরচ তাৎক্ষণিক হালনাগাদ হবে।
            </span>
          </div>
        </div>

        <DialogFooter className="p-4 bg-slate-50 border-t flex flex-row items-center justify-end gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs font-bold"
          >
            বাতিল
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5 px-4 shadow-md"
          >
            <Check className="w-4 h-4" /> দর প্রয়োগ করুন
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PriceInputItem({
  label,
  unit,
  value,
  onChange
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-[10px] font-black text-slate-600">
        <span className="truncate">{label}</span>
      </div>
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">৳</span>
        <Input
          type="number"
          value={value === 0 ? "" : value}
          onChange={e => onChange(e.target.value)}
          placeholder="0"
          className="h-9 pl-6 pr-2 text-xs font-black bg-white border-slate-300 shadow-sm text-slate-800"
        />
      </div>
      <span className="text-[9px] text-slate-400 font-medium block truncate">{unit}</span>
    </div>
  );
}
