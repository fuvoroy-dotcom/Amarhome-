
"use client";

import React, { useState, useEffect, useCallback } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ClipboardList, 
  Truck, 
  Users, 
  DollarSign, 
  Share2, 
  Copy, 
  Check, 
  Plus, 
  Trash2, 
  Calendar,
  Save,
  Cloud,
  ExternalLink,
  QrCode,
  Smartphone
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/firebase/auth-context";

interface MaterialInflowItem {
  id: string;
  date: string;
  material: string;
  quantity: number;
  unit: string;
  challanNo: string;
  cost: number;
}

interface LaborAttendanceItem {
  id: string;
  date: string;
  trade: string;
  workerCount: number;
  dailyRate: number;
  totalWage: number;
  supervisor: string;
}

interface DailySiteManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  currentDesignId: string;
  grandTotalEstimatedCost: number;
  materialsLedger: MaterialInflowItem[];
  setMaterialsLedger: React.Dispatch<React.SetStateAction<MaterialInflowItem[]>>;
  laborLedger: LaborAttendanceItem[];
  setLaborLedger: React.Dispatch<React.SetStateAction<LaborAttendanceItem[]>>;
  onIntegratedSave: () => void;
}

export function DailySiteManagementDialog({
  open,
  onOpenChange,
  projectName,
  currentDesignId,
  grandTotalEstimatedCost,
  materialsLedger,
  setMaterialsLedger,
  laborLedger,
  setLaborLedger,
  onIntegratedSave
}: DailySiteManagementDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("materials");
  const [copiedLink, setCopiedLink] = useState(false);

  // New Material Form State
  const [newMatDate, setNewMatDate] = useState(new Date().toISOString().split("T")[0]);
  const [newMatName, setNewMatName] = useState("সিমেন্ট (Cement)");
  const [newMatQty, setNewMatQty] = useState("");
  const [newMatUnit, setNewMatUnit] = useState("বস্তা");
  const [newMatChallan, setNewMatChallan] = useState("");
  const [newMatCost, setNewMatCost] = useState("");

  // New Labor Form State
  const [newLabDate, setNewLabDate] = useState(new Date().toISOString().split("T")[0]);
  const [newLabTrade, setNewLabTrade] = useState("সাধারণ রাজমিস্ত্রি");
  const [newLabCount, setNewLabCount] = useState("");
  const [newLabRate, setNewLabRate] = useState("900");
  const [newLabSupervisor, setNewLabSupervisor] = useState("");

  // Share link generation
  const shareableUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/?viewId=${currentDesignId}&readOnly=true`
    : `https://amarhome.app/?viewId=${currentDesignId}&readOnly=true`;

  // Calculate totals
  const totalMaterialSpent = materialsLedger.reduce((sum, item) => sum + item.cost, 0);
  const totalLaborSpent = laborLedger.reduce((sum, item) => sum + item.totalWage, 0);
  const totalActualSpent = totalMaterialSpent + totalLaborSpent;


  const handleAddMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(newMatQty) || 0;
    const cost = parseFloat(newMatCost) || 0;
    if (qty <= 0 || cost <= 0) {
      toast({ variant: "destructive", title: "সঠিক তথ্য দিন", description: "পরিমাণ ও খরচের টাকার পরিমাণ পূরণ করুন।" });
      return;
    }

    const newItem: MaterialInflowItem = {
      id: "m-" + Date.now(),
      date: newMatDate,
      material: newMatName,
      quantity: qty,
      unit: newMatUnit,
      challanNo: newMatChallan || `CH-${Math.floor(1000 + Math.random() * 9000)}`,
      cost
    };

    setMaterialsLedger(prev => [newItem, ...prev]);
    setNewMatQty("");
    setNewMatCost("");
    setNewMatChallan("");
    toast({ title: "চালান যুক্ত হয়েছে", description: "ম্যাটেরিয়াল চালান সফলভাবে খতিয়ানে যোগ করা হয়েছে।" });
  };

  const handleAddLabor = (e: React.FormEvent) => {
    e.preventDefault();
    const count = parseInt(newLabCount) || 0;
    const rate = parseFloat(newLabRate) || 0;
    if (count <= 0 || rate <= 0) {
      toast({ variant: "destructive", title: "সঠিক তথ্য দিন", description: "শ্রমিক সংখ্যা ও দৈনিক রেট পূরণ করুন।" });
      return;
    }

    const newItem: LaborAttendanceItem = {
      id: "l-" + Date.now(),
      date: newLabDate,
      trade: newLabTrade,
      workerCount: count,
      dailyRate: rate,
      totalWage: count * rate,
      supervisor: newLabSupervisor || "প্রধান ওস্তাদ"
    };

    setLaborLedger(prev => [newItem, ...prev]);
    setNewLabCount("");
    toast({ title: "লেবার হাজিরা যুক্ত হয়েছে", description: "দৈনিক শ্রমিকের মজুরি সফলভাবে যোগ করা হয়েছে।" });
  };

  const handleDeleteMaterial = (id: string) => {
    setMaterialsLedger(prev => prev.filter(item => item.id !== id));
  };

  const handleDeleteLabor = (id: string) => {
    setLaborLedger(prev => prev.filter(item => item.id !== id));
  };

  const handleCopyShareLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareableUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
      toast({
        title: "শেয়ার লিংক কপি হয়েছে",
        description: "ক্লায়েন্ট বা বাড়িওয়ালাকে পাঠানোর জন্য লিংকটি ক্লিপবোর্ডে কপি করা হয়েছে।"
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-white rounded-2xl border shadow-2xl p-0 overflow-hidden flex flex-col max-h-[92vh]">
        <DialogHeader className="p-5 bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-teal-500/20 border border-teal-500/30">
                <ClipboardList className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <DialogTitle className="text-base md:text-lg font-black text-white flex items-center gap-2">
                  দৈনিক সাইট ম্যানেজমেন্ট ও খতিয়ান (Daily Site Ledger)
                </DialogTitle>
                <DialogDescription className="text-slate-300 text-xs mt-0.5">
                  সাইটের ম্যাটেরিয়াল চালান, শ্রমিকদের দৈনিক হাজিরা ট্র্যাকিং এবং ক্লায়েন্ট ভিউয়ার লিংক
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-300 block">মোট বাস্তব ব্যয়:</span>
                <span className="text-xs font-black text-emerald-400">৳ {totalActualSpent.toLocaleString('bn-BD')}</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-5 pt-3 bg-slate-50 border-b shrink-0">
            <TabsList className="bg-slate-200/80 p-1 gap-1">
              <TabsTrigger value="materials" className="text-xs font-bold gap-1.5 data-[state=active]:bg-white">
                <Truck className="w-3.5 h-3.5 text-blue-600" /> ম্যাটেরিয়াল চালান ও স্টক
              </TabsTrigger>
              <TabsTrigger value="labor" className="text-xs font-bold gap-1.5 data-[state=active]:bg-white">
                <Users className="w-3.5 h-3.5 text-amber-600" /> শ্রমিক হাজিরা ও মজুরি
              </TabsTrigger>
              <TabsTrigger value="share" className="text-xs font-bold gap-1.5 data-[state=active]:bg-white">
                <Share2 className="w-3.5 h-3.5 text-emerald-600" /> ক্লায়েন্ট ভিউয়ার লিংক
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* TAB 1: MATERIALS LEDGER */}
            <TabsContent value="materials" className="m-0 space-y-4">
              {/* New Material Form */}
              <form onSubmit={handleAddMaterial} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-blue-600" /> নতুন চালান এন্ট্রি করুন
                  </span>
                  <span className="text-[10px] text-slate-400">তারিখ: {newMatDate}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="space-y-1 col-span-2 sm:col-span-1">
                    <Label className="text-[10px] font-bold text-slate-600 uppercase">উপাদান নাম</Label>
                    <Input 
                      value={newMatName} 
                      onChange={e => setNewMatName(e.target.value)} 
                      placeholder="যেমন: রড / সিমেন্ট"
                      className="h-8 text-xs font-bold bg-white" 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-600 uppercase">পরিমাণ ও একক</Label>
                    <div className="flex gap-1">
                      <Input 
                        type="number" 
                        value={newMatQty} 
                        onChange={e => setNewMatQty(e.target.value)} 
                        placeholder="পরিমাণ" 
                        className="h-8 text-xs font-bold bg-white w-2/3" 
                      />
                      <Input 
                        value={newMatUnit} 
                        onChange={e => setNewMatUnit(e.target.value)} 
                        placeholder="ব্যাগ/কেজি" 
                        className="h-8 text-xs font-bold bg-white w-1/3" 
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-600 uppercase">চালান নম্বর</Label>
                    <Input 
                      value={newMatChallan} 
                      onChange={e => setNewMatChallan(e.target.value)} 
                      placeholder="CH-101" 
                      className="h-8 text-xs font-bold bg-white" 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-600 uppercase">মোট টাকা (৳)</Label>
                    <div className="flex gap-1.5">
                      <Input 
                        type="number" 
                        value={newMatCost} 
                        onChange={e => setNewMatCost(e.target.value)} 
                        placeholder="টাকা" 
                        className="h-8 text-xs font-bold bg-white" 
                      />
                      <Button type="submit" size="sm" className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3">
                        যোগ
                      </Button>
                    </div>
                  </div>
                </div>
              </form>

              {/* Material Ledger Table */}
              <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="bg-slate-900 text-white px-4 py-2.5 flex justify-between items-center text-xs font-bold">
                  <span>সাইট চালান রেকর্ড ({materialsLedger.length} টি)</span>
                  <span>মোট ম্যাটেরিয়াল ব্যয়: ৳ {totalMaterialSpent.toLocaleString('bn-BD')}</span>
                </div>
                <div className="divide-y divide-slate-100 text-xs max-h-60 overflow-y-auto">
                  {materialsLedger.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 italic">এখনও কোনো চালান যুক্ত করা হয়নি।</div>
                  ) : (
                    materialsLedger.map((item) => (
                      <div key={item.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-800 flex items-center gap-2">
                            <span>{item.material}</span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">
                              {item.challanNo}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400">তারিখ: {item.date}</span>
                        </div>
                        <div className="flex items-center gap-6 text-right">
                          <div className="font-bold text-slate-700">
                            {item.quantity} {item.unit}
                          </div>
                          <div className="font-bold text-emerald-700 w-24">
                            ৳ {item.cost.toLocaleString('bn-BD')}
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDeleteMaterial(item.id)}
                            className="h-7 w-7 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: LABOR ATTENDANCE */}
            <TabsContent value="labor" className="m-0 space-y-4">
              {/* New Labor Form */}
              <form onSubmit={handleAddLabor} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-amber-600" /> নতুন দৈনিক হাজিরা এন্ট্রি
                  </span>
                  <span className="text-[10px] text-slate-400">তারিখ: {newLabDate}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-600 uppercase">কাজের ধরন / ট্রেড</Label>
                    <Input 
                      value={newLabTrade} 
                      onChange={e => setNewLabTrade(e.target.value)} 
                      placeholder="যেমন: রড মিস্ত্রি" 
                      className="h-8 text-xs font-bold bg-white" 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-600 uppercase">শ্রমিক সংখ্যা</Label>
                    <Input 
                      type="number" 
                      value={newLabCount} 
                      onChange={e => setNewLabCount(e.target.value)} 
                      placeholder="জন" 
                      className="h-8 text-xs font-bold bg-white" 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-600 uppercase">দৈনিক রেট (৳/জন)</Label>
                    <Input 
                      type="number" 
                      value={newLabRate} 
                      onChange={e => setNewLabRate(e.target.value)} 
                      placeholder="রেট" 
                      className="h-8 text-xs font-bold bg-white" 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-600 uppercase">সুপারভাইজার</Label>
                    <div className="flex gap-1.5">
                      <Input 
                        value={newLabSupervisor} 
                        onChange={e => setNewLabSupervisor(e.target.value)} 
                        placeholder="ওস্তাদ নাম" 
                        className="h-8 text-xs font-bold bg-white" 
                      />
                      <Button type="submit" size="sm" className="h-8 bg-amber-600 hover:bg-amber-700 text-white text-xs px-3">
                        যোগ
                      </Button>
                    </div>
                  </div>
                </div>
              </form>

              {/* Labor Ledger Table */}
              <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="bg-slate-900 text-white px-4 py-2.5 flex justify-between items-center text-xs font-bold">
                  <span>দৈনিক লেবার মজুরি রেকর্ড</span>
                  <span>মোট লেবার পরিশোধ: ৳ {totalLaborSpent.toLocaleString('bn-BD')}</span>
                </div>
                <div className="divide-y divide-slate-100 text-xs max-h-60 overflow-y-auto">
                  {laborLedger.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 italic">এখনও কোনো হাজিরার তথ্য যুক্ত করা হয়নি।</div>
                  ) : (
                    laborLedger.map((item) => (
                      <div key={item.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-800 flex items-center gap-2">
                            <span>{item.trade}</span>
                            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-semibold">
                              {item.workerCount} জন
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400">তারিখ: {item.date} | তদারকি: {item.supervisor}</span>
                        </div>
                        <div className="flex items-center gap-6 text-right">
                          <div className="text-slate-600 font-medium">
                            ৳ {item.dailyRate}/জন
                          </div>
                          <div className="font-bold text-emerald-700 w-24">
                            ৳ {item.totalWage.toLocaleString('bn-BD')}
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDeleteLabor(item.id)}
                            className="h-7 w-7 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: CLIENT SHARE LINK */}
            <TabsContent value="share" className="m-0 space-y-4">
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2.5">
                  <Smartphone className="w-5 h-5 text-emerald-600" />
                  <div>
                    <h4 className="font-bold text-xs text-emerald-950">ক্লায়েন্ট / বাড়িওয়ালা শেয়ার লিংক</h4>
                    <p className="text-[11px] text-emerald-800">
                      এই সুরক্ষিত লিংকের মাধ্যমে আপনার ক্লায়েন্ট স্মার্টফোন বা ল্যাপটপে সরাসরি ৩ডি মডেল ও ফ্লোরপ্ল্যান দেখতে পাবেন।
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Input 
                    readOnly 
                    value={shareableUrl} 
                    className="h-9 text-xs font-mono bg-white border-emerald-300 select-all" 
                  />
                  <Button 
                    onClick={handleCopyShareLink}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 h-9 shrink-0 px-4"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedLink ? "কপি হয়েছে" : "লিংক কপি করুন"}
                  </Button>
                </div>
              </div>

              {/* Feature Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="border rounded-xl p-3.5 bg-white space-y-1.5">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600" /> কোনো অ্যাপ ইন্সটল করতে হবে না
                  </span>
                  <p className="text-[11px] text-slate-500">
                    লিংকে ক্লিক করলেই যেকোনো সাধারণ মোবাইল ব্রাউজারে রিয়েল-টাইম ৩ডি বাড়ি ঘুরে দেখা যাবে।
                  </p>
                </div>

                <div className="border rounded-xl p-3.5 bg-white space-y-1.5">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600" /> রিড-অনলি মোড (নিরাপদ)
                  </span>
                  <p className="text-[11px] text-slate-500">
                    ক্লায়েন্ট শুধু দেখতে পারবেন, মূল ড্রয়িং বা হিসাব পরিবর্তনের কোনো সুযোগ থাকবে না।
                  </p>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="p-4 bg-slate-50 border-t flex flex-row items-center justify-between shrink-0 gap-2">
          <div className="space-y-0.5">
            <span className="text-[11px] text-slate-500 block">
              প্রজেক্ট: <strong>{projectName}</strong>
              {user ? (
                <span className="text-emerald-500 ml-2 font-semibold">• ☁️ ক্লাউড সেভ সক্রিয়</span>
              ) : (
                <span className="text-amber-500 ml-2">• লগইন করলে ক্লাউডে সেভ হবে</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={onIntegratedSave}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 gap-1.5 shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              সেভ করুন
            </Button>
            <Button
              size="sm"
              onClick={() => onOpenChange(false)}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4"
            >
              বন্ধ করুন
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

