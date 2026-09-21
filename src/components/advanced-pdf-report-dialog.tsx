"use client";

import React, { useState, useRef } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, 
  Download, 
  Calendar, 
  Users, 
  Boxes, 
  DollarSign, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  Printer, 
  Loader2,
  HardHat,
  Hammer
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MaterialPrices } from "./market-price-sync-dialog";

interface AdvancedPdfReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  total: {
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
  };
  prices: MaterialPrices;
  grandTotalCost: number;
  unitSystem: 'imperial' | 'metric';
  foundationsCount?: number;
  columnsCount?: number;
}

export function AdvancedPdfReportDialog({
  open,
  onOpenChange,
  projectName,
  total,
  prices,
  grandTotalCost,
  unitSystem,
  foundationsCount = 1,
  columnsCount = 1
}: AdvancedPdfReportDialogProps) {
  const { toast } = useToast();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Calculations for scale and timeline
  const slabAreaSqft = Math.max(total.labor || 0, 100);
  const slabAreaSqm = Math.round((slabAreaSqft * 0.092903) * 100) / 100;

  // Realistic dynamic timeline calculation based on floor area
  const scaleMultiplier = Math.max(1, slabAreaSqft / 1000);
  const totalEstimatedDays = Math.round(100 + scaleMultiplier * 35);

  const timelinePhases = [
    {
      id: 1,
      title: "Site Preparation & Layout (Leveling & Marking)",
      startDay: 1,
      endDay: Math.round(7 * scaleMultiplier),
      progress: "Phase 1",
      status: "Preliminary",
      description: "Land leveling, boundary setting, layout drawing marking and earthwork preparation."
    },
    {
      id: 2,
      title: "Base & Footing Casting (Excavation & RCC)",
      startDay: Math.round(8 * scaleMultiplier),
      endDay: Math.round(20 * scaleMultiplier),
      progress: "Phase 2",
      status: "Foundation",
      description: "Footing soil excavation, CC casting, rebar binding and column base RCC casting."
    },
    {
      id: 3,
      title: "Short Column & Plinth Beam",
      startDay: Math.round(21 * scaleMultiplier),
      endDay: Math.round(34 * scaleMultiplier),
      progress: "Phase 3",
      status: "Sub-Structure",
      description: "Short column casting below grade, sand filling & compaction, grade beam shuttering & casting."
    },
    {
      id: 4,
      title: "Main Column Raising & Curing",
      startDay: Math.round(35 * scaleMultiplier),
      endDay: Math.round(48 * scaleMultiplier),
      progress: "Phase 4",
      status: "Super-Structure",
      description: "Column rebar binding up to roof level, ring placement, formwork & concrete casting, 28-day curing."
    },
    {
      id: 5,
      title: "Roof Centering, Shuttering & Rebar Binding",
      startDay: Math.round(49 * scaleMultiplier),
      endDay: Math.round(62 * scaleMultiplier),
      progress: "Phase 5",
      status: "Roof Preparation",
      description: "Steel prop & sheet centering, beam & slab main/distribution bar placement, fan hook & pipe setting."
    },
    {
      id: 6,
      title: "Slab RCC Casting & Curing (21 Days)",
      startDay: Math.round(63 * scaleMultiplier),
      endDay: Math.round(85 * scaleMultiplier),
      progress: "Phase 6",
      status: "Slab Casting",
      description: "Concrete mix 1:1.5:3 with vibrator for slab casting, continuous 21-day water curing mandatory."
    },
    {
      id: 7,
      title: "Brickwork & Plastering",
      startDay: Math.round(86 * scaleMultiplier),
      endDay: Math.round(112 * scaleMultiplier),
      progress: "Phase 7",
      status: "Brickwork & Plaster",
      description: "5\" and 10\" brick wall construction, lintel beam casting, internal and external wall plastering."
    },
    {
      id: 8,
      title: "Tiles, Sanitary, Electric & Painting (Finishing)",
      startDay: Math.round(113 * scaleMultiplier),
      endDay: totalEstimatedDays,
      progress: "Phase 8",
      status: "Finishing",
      description: "Floor & wall tile installation, door-window fitting, sanitary ware, wiring & two-coat paint finishing."
    }
  ];

  // Dynamic Labor Schedule calculation based on sqft
  const masonDays = Math.ceil((slabAreaSqft * 0.08) * scaleMultiplier);
  const rodBinderDays = Math.ceil((slabAreaSqft * 0.06) * scaleMultiplier);
  const shutteringDays = Math.ceil((slabAreaSqft * 0.07) * scaleMultiplier);
  const helperDays = Math.ceil((slabAreaSqft * 0.16) * scaleMultiplier);
  const finishingDays = Math.ceil((slabAreaSqft * 0.05) * scaleMultiplier);
  const totalManDays = masonDays + rodBinderDays + shutteringDays + helperDays + finishingDays;

  const laborSchedule = [
    {
      role: "Head Mason (Rajmistri)",
      headcount: Math.max(1, Math.round(scaleMultiplier)),
      manDays: Math.ceil(masonDays * 0.3),
      avgDailyRate: 1100,
      scope: "Layout, column & beam level checking, casting supervision and quality control."
    },
    {
      role: "Brick & Concrete Mason",
      headcount: Math.max(2, Math.round(3 * scaleMultiplier)),
      manDays: Math.ceil(masonDays * 0.7),
      avgDailyRate: 900,
      scope: "Brick masonry, wall & roof plastering, floor dressing and concrete casting."
    },
    {
      role: "Steel Fixer / Rebar Binder",
      headcount: Math.max(2, Math.round(3 * scaleMultiplier)),
      manDays: rodBinderDays,
      avgDailyRate: 950,
      scope: "Rebar cutting, bending, column stirrup binding, footing & slab mesh binding."
    },
    {
      role: "Shuttering & Centering Carpenter",
      headcount: Math.max(2, Math.round(3 * scaleMultiplier)),
      manDays: shutteringDays,
      avgDailyRate: 950,
      scope: "Steel sheet or timber centering, beam & column box formwork and slab support."
    },
    {
      role: "General Helpers / Labour",
      headcount: Math.max(4, Math.round(6 * scaleMultiplier)),
      manDays: helperDays,
      avgDailyRate: 650,
      scope: "Earthwork, brick carrying, mortar & concrete mixing, water curing."
    },
    {
      role: "Tiles & Painting Crew",
      headcount: Math.max(2, Math.round(2 * scaleMultiplier)),
      manDays: finishingDays,
      avgDailyRate: 900,
      scope: "Floor & bathroom tile setting, putty and paint finishing."
    }
  ];

  const materialRows = [
    { name: "Steel Rebar (Rod)", qty: `${Math.ceil(total.rod)}`, unit: "KG", rate: prices.rod, total: Math.ceil(total.rod) * prices.rod },
    { name: "Cement", qty: `${Math.ceil(total.cement)}`, unit: "Bags (50kg)", rate: prices.cement, total: Math.ceil(total.cement) * prices.cement },
    { name: "Bricks", qty: `${total.bricks}`, unit: "Pcs", rate: prices.bricks, total: total.bricks * prices.bricks },
    { name: "Sand", qty: `${Math.ceil(total.sand)}`, unit: "CFT", rate: prices.sand, total: Math.ceil(total.sand) * prices.sand },
    { name: "Stone Aggregate", qty: `${Math.ceil(total.stone)}`, unit: "CFT", rate: prices.stone, total: Math.ceil(total.stone) * prices.stone },
    { name: "Brick Chips (Khoya)", qty: `${Math.ceil(total.chips)}`, unit: "CFT", rate: prices.chips, total: Math.ceil(total.chips) * prices.chips },
    { name: "Floor Tiles", qty: `${Math.ceil(total.floorTiles)}`, unit: "Pcs", rate: prices.floorTiles, total: Math.ceil(total.floorTiles) * prices.floorTiles },
    { name: "Wall Tiles", qty: `${Math.ceil(total.wallTiles)}`, unit: "Pcs", rate: prices.wallTiles, total: Math.ceil(total.wallTiles) * prices.wallTiles },
    { name: "Labor Cost", qty: `${Math.ceil(total.labor)}`, unit: "Sq.ft", rate: prices.labor, total: Math.ceil(total.labor) * prices.labor },
    { name: "Doors", qty: `${total.doors}`, unit: "Sets", rate: prices.doors, total: total.doors * prices.doors },
    { name: "Windows", qty: `${total.windows}`, unit: "Sets", rate: prices.windows, total: total.windows * prices.windows },
    { name: "Electric Wiring (Lump)", qty: "1", unit: "Lot", rate: prices.electric, total: prices.electric },
    { name: "Plumbing & Fittings (Lump)", qty: "1", unit: "Lot", rate: prices.fittings, total: prices.fittings },
    { name: "Paint & Painting (Lump)", qty: "1", unit: "Lot", rate: prices.paint, total: prices.paint },
    { name: "Miscellaneous (Others)", qty: "1", unit: "Lot", rate: prices.others, total: prices.others },
  ].filter(r => r.total > 0 || parseFloat(r.qty) > 0);

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;

      // Header Brand Function
      const addReportHeader = (title: string, subTitle: string, pageNum: number) => {
        pdf.setFillColor(15, 23, 42); // slate-900
        pdf.rect(0, 0, pageWidth, 28, "F");

        pdf.setTextColor(255, 255, 255);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(16);
        pdf.text("AMAR HOME - CIVIL ENGINEERING REPORT", margin, 12);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(148, 163, 184); // slate-400
        const safeName = projectName.replace(/[^\x00-\x7F]/g, '?');
        pdf.text(`Project: ${safeName} | Area: ${slabAreaSqft} Sq.ft (${slabAreaSqm} Sq.m)`, margin, 19);
        pdf.text(`Generated: ${new Date().toLocaleDateString("en-GB")}`, pageWidth - margin, 19, { align: "right" });

        // Accent line
        pdf.setFillColor(16, 185, 129); // emerald-500
        pdf.rect(0, 28, pageWidth, 2, "F");

        // Page Title Banner
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.setTextColor(30, 41, 59); // slate-800
        pdf.text(title, margin, 38);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor(100, 116, 139);
        pdf.text(subTitle, margin, 43);

        // Footer
        pdf.setFontSize(8);
        pdf.setTextColor(148, 163, 184);
        pdf.text(`Page ${pageNum} of 2 | Amar Home Construction Intelligence Platform`, margin, pageHeight - 8);
        pdf.text("Standard Mix Ratio: 1:1.5:3 (M20 Grade RCC)", pageWidth - margin, pageHeight - 8, { align: "right" });
      };

      // PAGE 1: Executive Summary & Material Matrix
      addReportHeader("1. MATERIAL ESTIMATE & BUDGET BREAKDOWN", "Complete structural bill of quantities and local market valuation", 1);

      let yPos = 50;

      // Metric Summary Cards
      const cardWidth = (contentWidth - 6) / 3;
      // Card 1: Total Cost
      pdf.setFillColor(240, 253, 244); // emerald-50
      pdf.setDrawColor(167, 243, 208);
      pdf.roundedRect(margin, yPos, cardWidth, 18, 2, 2, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(5, 150, 105);
      pdf.text("ESTIMATED GRAND TOTAL", margin + 3, yPos + 6);
      pdf.setFontSize(12);
      pdf.text(`BDT ${grandTotalCost.toLocaleString("en-US")}`, margin + 3, yPos + 14);

      // Card 2: Slab Built-up Area
      pdf.setFillColor(248, 250, 252);
      pdf.setDrawColor(226, 232, 240);
      pdf.roundedRect(margin + cardWidth + 3, yPos, cardWidth, 18, 2, 2, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(71, 85, 105);
      pdf.text("TOTAL SLAB AREA", margin + cardWidth + 6, yPos + 6);
      pdf.setFontSize(11);
      pdf.text(`${slabAreaSqft} Sq.ft / ${slabAreaSqm} m2`, margin + cardWidth + 6, yPos + 14);

      // Card 3: Timeline & Labor
      pdf.setFillColor(239, 246, 255);
      pdf.setDrawColor(191, 219, 254);
      pdf.roundedRect(margin + (cardWidth + 3) * 2, yPos, cardWidth, 18, 2, 2, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(37, 99, 235);
      pdf.text("TIMELINE & WORKFORCE", margin + (cardWidth + 3) * 2 + 3, yPos + 6);
      pdf.setFontSize(11);
      pdf.text(`~${totalEstimatedDays} Days | ${totalManDays} Man-days`, margin + (cardWidth + 3) * 2 + 3, yPos + 14);

      yPos += 24;

      // Materials Table Header
      pdf.setFillColor(30, 41, 59);
      pdf.rect(margin, yPos, contentWidth, 7, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(255, 255, 255);
      pdf.text("Material Description", margin + 3, yPos + 4.8);
      pdf.text("Quantity", margin + 70, yPos + 4.8);
      pdf.text("Unit", margin + 105, yPos + 4.8);
      pdf.text("Unit Rate (BDT)", margin + 135, yPos + 4.8);
      pdf.text("Total Cost (BDT)", pageWidth - margin - 3, yPos + 4.8, { align: "right" });

      yPos += 7;

      // Materials Table Rows
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      materialRows.forEach((row, idx) => {
        if (idx % 2 === 0) {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(margin, yPos, contentWidth, 6, "F");
        }
        pdf.setTextColor(30, 41, 59);
        pdf.text(row.name, margin + 3, yPos + 4.2);
        pdf.text(row.qty, margin + 70, yPos + 4.2);
        pdf.text(row.unit, margin + 105, yPos + 4.2);
        pdf.text(`Tk ${row.rate}`, margin + 135, yPos + 4.2);
        pdf.setFont("helvetica", "bold");
        pdf.text(`Tk ${row.total.toLocaleString("en-US")}`, pageWidth - margin - 3, yPos + 4.2, { align: "right" });
        pdf.setFont("helvetica", "normal");

        pdf.setDrawColor(226, 232, 240);
        pdf.line(margin, yPos + 6, pageWidth - margin, yPos + 6);
        yPos += 6;
      });

      // Total Row
      pdf.setFillColor(241, 245, 249);
      pdf.rect(margin, yPos, contentWidth, 7, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(15, 23, 42);
      pdf.text("TOTAL ESTIMATED BUDGET:", margin + 3, yPos + 5);
      pdf.setTextColor(5, 150, 105);
      pdf.text(`BDT ${grandTotalCost.toLocaleString("en-US")}`, pageWidth - margin - 3, yPos + 5, { align: "right" });

      // Technical Note
      yPos += 14;
      pdf.setFillColor(254, 252, 232); // amber-50
      pdf.setDrawColor(254, 240, 138);
      pdf.roundedRect(margin, yPos, contentWidth, 14, 2, 2, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(161, 98, 7);
      pdf.text("STRUCTURAL ENGINEERING SPECIFICATION NOTE:", margin + 3, yPos + 5);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(113, 63, 18);
      pdf.text("1. Dry volume safety factor 1.54 applied for concrete mix; 0.35 factor for brick masonry mortar.", margin + 3, yPos + 9);
      pdf.text("2. Steel grade assumed 500W (60-Grade/72.5-Grade). Minimum 21 days continuous water curing mandatory for roof slab.", margin + 3, yPos + 12);

      // PAGE 2: Construction Timeline & Labor Schedule
      pdf.addPage();
      addReportHeader("2. CONSTRUCTION TIMELINE & LABOR SCHEDULE", "Step-by-step milestone tracking, resource allocation and safety norms", 2);

      yPos = 50;

      // Section A: Construction Timeline
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(15, 23, 42);
      pdf.text("A. Construction Timeline & Critical Milestones", margin, yPos);
      yPos += 5;

      // Timeline Table Header
      pdf.setFillColor(30, 41, 59);
      pdf.rect(margin, yPos, contentWidth, 6.5, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(255, 255, 255);
      pdf.text("Phase / Milestone", margin + 3, yPos + 4.5);
      pdf.text("Start - End Day", margin + 70, yPos + 4.5);
      pdf.text("Duration", margin + 110, yPos + 4.5);
      pdf.text("Scope of Work", margin + 130, yPos + 4.5);
      yPos += 6.5;

      timelinePhases.forEach((phase, idx) => {
        if (idx % 2 === 0) {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(margin, yPos, contentWidth, 6, "F");
        }
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.5);
        pdf.setTextColor(30, 41, 59);
        pdf.text(phase.title.substring(0, 32), margin + 3, yPos + 4.2);

        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(71, 85, 105);
        pdf.text(`Day ${phase.startDay} - Day ${phase.endDay}`, margin + 70, yPos + 4.2);
        pdf.text(`${phase.endDay - phase.startDay + 1} Days`, margin + 110, yPos + 4.2);
        pdf.text(phase.description.substring(0, 40) + "...", margin + 130, yPos + 4.2);

        pdf.setDrawColor(226, 232, 240);
        pdf.line(margin, yPos + 6, pageWidth - margin, yPos + 6);
        yPos += 6;
      });

      yPos += 8;

      // Section B: Detailed Labor Schedule
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(15, 23, 42);
      pdf.text("B. Detailed Labor Allocation & Trade Schedule", margin, yPos);
      yPos += 5;

      // Labor Table Header
      pdf.setFillColor(30, 41, 59);
      pdf.rect(margin, yPos, contentWidth, 6.5, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(255, 255, 255);
      pdf.text("Trade Role / Designation", margin + 3, yPos + 4.5);
      pdf.text("Crew Size", margin + 70, yPos + 4.5);
      pdf.text("Estimated Man-Days", margin + 105, yPos + 4.5);
      pdf.text("Avg Rate", margin + 145, yPos + 4.5);
      pdf.text("Total Labor Est.", pageWidth - margin - 3, yPos + 4.5, { align: "right" });
      yPos += 6.5;

      laborSchedule.forEach((lab, idx) => {
        if (idx % 2 === 0) {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(margin, yPos, contentWidth, 6, "F");
        }
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.5);
        pdf.setTextColor(30, 41, 59);
        pdf.text(lab.role.substring(0, 32), margin + 3, yPos + 4.2);

        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(71, 85, 105);
        pdf.text(`${lab.headcount} Persons`, margin + 70, yPos + 4.2);
        pdf.text(`${lab.manDays} Man-days`, margin + 105, yPos + 4.2);
        pdf.text(`Tk ${lab.avgDailyRate}/day`, margin + 145, yPos + 4.2);

        const rowTotal = lab.manDays * lab.avgDailyRate;
        pdf.setFont("helvetica", "bold");
        pdf.text(`Tk ${rowTotal.toLocaleString("en-US")}`, pageWidth - margin - 3, yPos + 4.2, { align: "right" });
        pdf.setFont("helvetica", "normal");

        pdf.setDrawColor(226, 232, 240);
        pdf.line(margin, yPos + 6, pageWidth - margin, yPos + 6);
        yPos += 6;
      });

      // Total Man-days Row
      pdf.setFillColor(241, 245, 249);
      pdf.rect(margin, yPos, contentWidth, 6.5, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(15, 23, 42);
      pdf.text("TOTAL ESTIMATED WORKFORCE MAN-DAYS:", margin + 3, yPos + 4.8);
      pdf.setTextColor(37, 99, 235);
      pdf.text(`${totalManDays} Man-days across all phases`, pageWidth - margin - 3, yPos + 4.8, { align: "right" });

      yPos += 12;

      // On-site Safety Box
      pdf.setFillColor(240, 253, 250); // teal-50
      pdf.setDrawColor(153, 246, 228);
      pdf.roundedRect(margin, yPos, contentWidth, 14, 2, 2, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(13, 148, 136);
      pdf.text("SITE SAFETY & BNBC COMPLIANCE GUIDELINES:", margin + 3, yPos + 5);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(19, 78, 74);
      pdf.text("- Compulsory safety helmets, boots, and safety harness during slab casting and external scaffolding.", margin + 3, yPos + 9);
      pdf.text("- Adequate clear spacing of rebar rings and proper cover blocks (0.75\" for slab, 1.5\" for column/beam) must be verified.", margin + 3, yPos + 12);

      // Save PDF
      const sanitizedName = projectName.replace(/[^a-zA-Z0-9_\u0980-\u09FF-]/g, "_") || "construction_report";
      pdf.save(`${sanitizedName}_full_report.pdf`);

      toast({
        title: "পূর্ণাঙ্গ PDF রিপোর্ট তৈরি হয়েছে",
        description: "কাজের সময়সীমা ও বিস্তারিত লেবার শিডিউলসহ রিপোর্টটি ডাউনলোড সম্পন্ন হয়েছে।"
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "PDF তৈরিতে সমস্যা",
        description: err.message || "পিডিএফ ফাইল তৈরি করতে ব্যর্থ হয়েছে।"
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-white rounded-2xl border shadow-2xl p-0 overflow-hidden flex flex-col max-h-[92vh]">
        <DialogHeader className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
                <FileText className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <DialogTitle className="text-lg md:text-xl font-black text-white flex items-center gap-2">
                  এডভান্সড কনস্ট্রাকশন রিপোর্ট ও শিডিউল (Advanced Report)
                </DialogTitle>
                <DialogDescription className="text-slate-300 text-xs mt-0.5">
                  ম্যাটেরিয়াল খরচ, কাজের সময়সীমা (Timeline) এবং বিস্তারিত লেবার শিডিউলসহ পূর্ণাঙ্গ রূপরেখা
                </DialogDescription>
              </div>
            </div>
            <Button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 text-xs shadow-lg h-9 px-4"
            >
              {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isGeneratingPdf ? "তৈরি হচ্ছে..." : "PDF ডাউনলোড করুন"}
            </Button>
          </div>
        </DialogHeader>

        {/* Quick Highlights Bar */}
        <div className="bg-slate-100 border-b px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">প্রজেক্ট নাম:</span>
              <span className="font-bold text-slate-800">{projectName}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">ছাদের ক্ষেত্রফল:</span>
              <span className="font-bold text-slate-800">
                {slabAreaSqft} Sq.ft ({slabAreaSqm} m²)
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">আনুমানিক সময়কাল:</span>
              <span className="font-bold text-blue-700 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> ~{totalEstimatedDays} দিন
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">মোট মানবদিবস (Labor):</span>
              <span className="font-bold text-purple-700 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> {totalManDays} Man-days
              </span>
            </div>
          </div>
          <div className="bg-emerald-600 text-white px-3 py-1 rounded-lg font-black text-sm">
            মোট বাজেট: ৳ {grandTotalCost.toLocaleString('bn-BD')}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-3 bg-white border-b shrink-0">
            <TabsList className="bg-slate-100 p-1 gap-1">
              <TabsTrigger value="overview" className="text-xs font-bold gap-1.5 data-[state=active]:bg-white">
                <Boxes className="w-3.5 h-3.5" /> উপাদান ও বাজেট
              </TabsTrigger>
              <TabsTrigger value="timeline" className="text-xs font-bold gap-1.5 data-[state=active]:bg-white">
                <Calendar className="w-3.5 h-3.5 text-blue-600" /> কাজের সময়সীমা (Timeline)
              </TabsTrigger>
              <TabsTrigger value="labor" className="text-xs font-bold gap-1.5 data-[state=active]:bg-white">
                <HardHat className="w-3.5 h-3.5 text-amber-600" /> লেবার শিডিউল (Labor Schedule)
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {/* TAB 1: OVERVIEW & MATERIALS */}
            <TabsContent value="overview" className="m-0 space-y-4">
              <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="bg-slate-900 text-white px-4 py-2.5 flex justify-between items-center text-xs font-bold">
                  <span>উপাদান তালিকা (Bill of Quantities)</span>
                  <span>দর ও মোট হিসাব</span>
                </div>
                <div className="divide-y divide-slate-100 text-xs">
                  {materialRows.map((row, i) => (
                    <div key={i} className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-slate-400 font-mono text-[10px]">{i + 1}.</span>
                        <span className="font-bold text-slate-800">{row.name}</span>
                      </div>
                      <div className="flex items-center gap-8 text-right">
                        <div className="w-28 text-slate-600">
                          <span className="font-bold text-slate-900">{row.qty}</span> {row.unit}
                        </div>
                        <div className="w-24 text-slate-500">
                          {row.rate > 0 ? `৳ ${row.rate}` : "-"}
                        </div>
                        <div className="w-32 font-bold text-slate-900">
                          ৳ {row.total.toLocaleString('bn-BD')}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="px-4 py-3 bg-emerald-50 flex justify-between items-center text-xs font-bold text-emerald-900">
                    <span>সর্বমোট প্রাক্কলিত বাজেট (Grand Total)</span>
                    <span className="text-base text-emerald-700 font-black">
                      ৳ {grandTotalCost.toLocaleString('bn-BD')}
                    </span>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: CONSTRUCTION TIMELINE */}
            <TabsContent value="timeline" className="m-0 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-center gap-3 text-xs text-blue-900">
                <Clock className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                  <strong>প্রকৌশল সময়সীমা বিশ্লেষণ:</strong> আপনার প্রজেক্টের ছাদের মাপ ও কাঠামোর ওপর ভিত্তি করে আনুমানিক <strong>{totalEstimatedDays} দিনের</strong> একটি বাস্তবমুখী পর্যায়ক্রমিক সময়রেখা তৈরি করা হয়েছে।
                </div>
              </div>

              <div className="space-y-3">
                {timelinePhases.map(phase => {
                  const phaseDays = phase.endDay - phase.startDay + 1;
                  const startPct = ((phase.startDay - 1) / totalEstimatedDays) * 100;
                  const widthPct = Math.max(8, (phaseDays / totalEstimatedDays) * 100);

                  return (
                    <div key={phase.id} className="border rounded-xl p-4 bg-white shadow-sm space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="bg-slate-900 text-white text-[10px] font-black px-2 py-0.5 rounded">
                            {phase.progress}
                          </span>
                          <h4 className="font-bold text-slate-800 text-xs md:text-sm">
                            {phase.title}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-500 font-medium">
                            দিন {phase.startDay} – {phase.endDay} ({phaseDays} দিন)
                          </span>
                          <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px]">
                            {phase.status}
                          </span>
                        </div>
                      </div>

                      {/* Visual Gantt Bar */}
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden relative">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full"
                          style={{
                            marginLeft: `${startPct}%`,
                            width: `${widthPct}%`
                          }}
                        />
                      </div>

                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {phase.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* TAB 3: DETAILED LABOR SCHEDULE */}
            <TabsContent value="labor" className="m-0 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center gap-3 text-xs text-amber-900">
                <Users className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <strong>লেবার বণ্টন ও টিম সুপারভিশন:</strong> মোট আনুমানিক <strong>{totalManDays} মানবদিবস</strong> প্রয়োজন হবে। বিভিন্ন ক্যাটাগরির কারিগরদের কাজের সুনির্দিষ্ট বণ্টন নিচে দেয়া হলো।
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {laborSchedule.map((lab, i) => (
                  <div key={i} className="border rounded-xl p-4 bg-white shadow-sm space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">{lab.role}</h4>
                        <span className="text-[10px] text-slate-500 font-medium">
                          টিম সাইজ: {lab.headcount} জন | মোট: {lab.manDays} দিন
                        </span>
                      </div>
                      <span className="bg-slate-100 text-slate-700 font-bold text-[10px] px-2 py-1 rounded">
                        গড় ৳{lab.avgDailyRate}/দিন
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg">
                      {lab.scope}
                    </p>
                    <div className="text-right text-[11px] font-bold text-emerald-700">
                      আনুমানিক মজুরি: ৳ {(lab.manDays * lab.avgDailyRate).toLocaleString('bn-BD')}
                    </div>
                  </div>
                ))}
              </div>

              {/* Safety & Standards Card */}
              <div className="bg-slate-900 text-white rounded-xl p-4 space-y-2">
                <h4 className="font-bold text-xs flex items-center gap-2 text-emerald-400">
                  <ShieldCheck className="w-4 h-4" /> সাইট সেফটি ও ইঞ্জিনিয়ারিং স্ট্যান্ডার্ড
                </h4>
                <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
                  <li>ছাদ ঢালাই ও সেন্টারিং খোলার আগে কিউরিং বাধ্যতামূলক (কমপক্ষে ২১ দিন)।</li>
                  <li>রডের ক্লিয়ার কভার ব্লক নিশ্চিত করতে হবে (ছাদে ৩/৪ ইঞ্চি, কলাম ও বিমে ১.৫ ইঞ্চি)।</li>
                  <li>শ্রমিকদের হেলমেট, বুট ও সেফটি বেল্ট পরিধান নিশ্চিত করা আবশ্যক।</li>
                </ul>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="p-4 bg-slate-50 border-t flex flex-row items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 italic">
            * BNBC ও গণপূর্ত শিডিউল অফ রেটসের প্রমিত মানের ভিত্তিতে হিসাবকৃত
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs font-bold"
            >
              বন্ধ করুন
            </Button>
            <Button
              size="sm"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5 px-4 shadow-md"
            >
              {isGeneratingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              PDF এক্সপোর্ট
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
