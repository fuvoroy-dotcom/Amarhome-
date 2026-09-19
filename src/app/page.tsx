"use client";

import EstimatorClient from "@/app/components/estimator-client";
import { useAuth } from "@/firebase/auth-context";
import { AuthDialog } from "@/components/auth-dialog";
import { useState } from "react";
import { Loader2, Layout, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";

/**
 * @fileOverview Root page component with authentication logic.
 * Handles the redirect/view-switch between landing page and drawing workspace.
 */
export default function Home() {
  const { user, loading } = useAuth();
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const logo = PlaceHolderImages.find(img => img.id === 'app-logo');

  // Loading state with a clean professional spinner
  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-white gap-4">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        <span className="text-slate-400 font-bold animate-pulse uppercase tracking-widest text-[10px]">সিস্টেম লোড হচ্ছে...</span>
      </div>
    );
  }

  // Unauthenticated view (Acting as the Login Page)
  if (!user) {
    return (
      <main className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-md w-full space-y-10 text-center z-10">
          <div className="space-y-6">
            <div className="mx-auto w-24 h-24 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-full flex items-center justify-center shadow-2xl shadow-blue-500/20 transform rotate-6 hover:rotate-0 transition-all duration-500 border border-white/10 overflow-hidden">
              {logo ? (
                <Image 
                  src={logo.imageUrl} 
                  alt={logo.description} 
                  width={96} 
                  height={96} 
                  className="object-cover w-full h-full"
                  data-ai-hint={logo.imageHint}
                />
              ) : (
                <div className="w-12 h-12 bg-white/20 rounded-lg animate-pulse" />
              )}
            </div>
            <div className="space-y-2">
              <h1 className="text-5xl font-black text-white tracking-tighter">আমার বাড়ি</h1>
              <p className="text-slate-400 text-base font-medium">প্রফেশনাল আর্কিটেকচারাল ডিজাইন ও নির্মাণ হিসাবের ডিজিটাল প্ল্যাটফর্ম।</p>
            </div>
          </div>

          <div className="bg-slate-900/60 p-8 rounded-[2.5rem] border border-slate-800 backdrop-blur-xl shadow-2xl space-y-8">
            <div className="grid grid-cols-2 gap-4 text-left">
              <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 group hover:border-blue-500/50 transition-colors">
                <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center mb-3">
                  <Layout className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="text-sm font-bold text-white">২ডি ড্রয়িং</h3>
                <p className="text-[10px] text-slate-500 mt-1">নিখুঁত ফ্লোরপ্ল্যান ও মাপজোক।</p>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 group hover:border-amber-500/50 transition-colors">
                <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center mb-3">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="text-sm font-bold text-white">৩ডি ভিউ</h3>
                <p className="text-[10px] text-slate-500 mt-1">বাস্তবসম্মত ৩ডি মডেল ও ওয়াকথ্রু।</p>
              </div>
            </div>

            <div className="space-y-4">
              <Button
                onClick={() => setIsAuthOpen(true)}
                className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white text-xl font-black rounded-2xl shadow-xl shadow-blue-900/20 flex items-center justify-center gap-3 transition-all active:scale-95"
              >
                শুরু করুন
                <ArrowRight className="w-6 h-6" />
              </Button>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">ডিজাইন ও হিসাব সেভ রাখতে লগইন প্রয়োজন</p>
            </div>
          </div>

          <div className="pt-4">
            <p className="text-slate-600 text-[10px] font-bold">© ২০২৫ আমার বাড়ি • সলিড স্ট্রাকচার ও নিখুঁত পরিকল্পনা</p>
          </div>
        </div>

        <AuthDialog open={isAuthOpen} onOpenChange={setIsAuthOpen} />
      </main>
    );
  }

  // Authenticated view (The drawing workspace)
  return (
    <main className="bg-slate-950 min-h-screen w-full">
      <EstimatorClient />
    </main>
  );
}
