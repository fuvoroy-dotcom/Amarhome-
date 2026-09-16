"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/firebase/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const { loginWithGoogle, loginWithEmail, signupWithEmail } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setName("");
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await loginWithGoogle();
      toast({ title: "সফল", description: "গুগল দিয়ে সফলভাবে লগইন হয়েছে।" });
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      console.error(err);
      toast({ 
        variant: "destructive", 
        title: "লগইন ব্যর্থ", 
        description: err.message || "গুগল সাইন-ইন করতে সমস্যা হয়েছে।" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ variant: "destructive", title: "তথ্য দিন", description: "ইমেইল এবং পাসওয়ার্ড আবশ্যক।" });
      return;
    }
    setLoading(true);
    try {
      await loginWithEmail(email, password);
      toast({ title: "সফল", description: "লগইন সফল হয়েছে।" });
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      console.error(err);
      let msg = "ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।";
      if (err.code === "auth/user-not-found") msg = "ব্যবহারকারী খুঁজে পাওয়া যায়নি।";
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") msg = "পাসওয়ার্ড সঠিক নয়।";
      toast({ variant: "destructive", title: "লগইন ব্যর্থ", description: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ variant: "destructive", title: "তথ্য দিন", description: "ইমেইল এবং পাসওয়ার্ড আবশ্যক।" });
      return;
    }
    if (password.length < 6) {
      toast({ variant: "destructive", title: "দুর্বল পাসওয়ার্ড", description: "পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।" });
      return;
    }
    setLoading(true);
    try {
      await signupWithEmail(email, password, name);
      toast({ title: "অভিনন্দন!", description: "একাউন্ট সফলভাবে তৈরি হয়েছে।" });
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      console.error(err);
      let msg = "একাউন্ট তৈরি করতে সমস্যা হয়েছে।";
      if (err.code === "auth/email-already-in-use") msg = "এই ইমেইলে আগেই একাউন্ট খোলা হয়েছে।";
      toast({ variant: "destructive", title: "রেজিস্ট্রেশন ব্যর্থ", description: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-slate-900 border-slate-800 text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white text-center">
            {activeTab === "login" ? "অ্যাকাউন্টে লগইন করুন" : "নতুন অ্যাকাউন্ট তৈরি করুন"}
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-center text-xs">
            আপনার ডিজাইন ও হিসাব ক্লাউডে নিরাপদ রাখতে সাইন ইন করুন।
          </DialogDescription>
        </DialogHeader>

        {/* Google One-Click Login */}
        <div className="pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={handleGoogleLogin}
            className="w-full bg-white hover:bg-slate-100 text-slate-900 font-semibold flex items-center justify-center gap-2 h-10 border-none"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Google দিয়ে চালিয়ে যান
          </Button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-900 px-2 text-slate-400 font-medium">অথবা ইমেইল দিয়ে</span>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid grid-cols-2 bg-slate-800 text-slate-400 mb-4">
            <TabsTrigger value="login" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs">
              লগইন
            </TabsTrigger>
            <TabsTrigger value="register" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs">
              রেজিস্ট্রেশন
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleEmailLogin} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-300">ইমেইল</Label>
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-300">পাসওয়ার্ড</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-9 text-xs"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium h-9 text-xs mt-2"
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                লগইন করুন
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form onSubmit={handleEmailSignup} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-300">আপনার নাম</Label>
                <Input
                  type="text"
                  placeholder="আপনার পুরো নাম"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-300">ইমেইল</Label>
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-300">পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-9 text-xs"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium h-9 text-xs mt-2"
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                অ্যাকাউন্ট খুলুন
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
