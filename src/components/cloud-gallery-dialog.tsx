"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { listUserSnapshots, SnapshotItem, deleteStorageFile } from "@/firebase/storage-service";
import { useAuth } from "@/firebase/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, Trash2, ExternalLink, Image as ImageIcon, LogIn, Cloud } from "lucide-react";
import { AuthDialog } from "./auth-dialog";

interface CloudGalleryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CloudGalleryDialog({ open, onOpenChange }: CloudGalleryDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  const fetchSnapshots = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const items = await listUserSnapshots(user.uid);
      setSnapshots(items);
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "ত্রুটি", description: "স্ন্যাপশট লোড করা যায়নি।" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      if (user) {
        fetchSnapshots();
      } else {
        setSnapshots([]);
        setLoading(false);
      }
    }
  }, [open, user]);

  const handleDelete = async (item: SnapshotItem) => {
    if (!confirm(`আপনি কি "${item.name}" মুছে ফেলতে চান?`)) return;
    setDeletingId(item.id);
    try {
      await deleteStorageFile(item);
      setSnapshots(prev => prev.filter(s => s.id !== item.id));
      toast({ title: "সফল", description: "স্ন্যাপশট ডিলিট করা হয়েছে।" });
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "ত্রুটি", description: "ডিলিট করতে সমস্যা হয়েছে।" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[720px] bg-slate-900 border-slate-800 text-slate-100 max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-cyan-400" />
                <span>আমার ক্লাউড স্ন্যাপশট</span>
              </div>
              {user && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={fetchSnapshots} 
                  disabled={loading}
                  className="h-7 text-xs text-slate-400 hover:text-white"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "রিফ্রেশ"}
                </Button>
              )}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              {user 
                ? `ব্যবহারকারী: ${user.displayName || user.email} হিসেবে সংরক্ষিত ক্লাউড স্ন্যাপশটসমূহ।`
                : "আপনার অ্যাকাউন্টে সংরক্ষিত ইমেজ দেখতে লগইন করুন।"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden py-2 min-h-[250px] flex flex-col justify-center">
            {!user ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                  <LogIn className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-sm font-bold text-white">লগইন প্রয়োজন</h3>
                <p className="text-xs text-slate-400 max-w-sm">
                  আপনার ক্লাউড ডিজাইন এবং স্ন্যাপশটগুলো অ্যাক্সেস করতে অনুগ্রহ করে গুগল বা ইমেইল দিয়ে লগইন করুন।
                </p>
                <Button 
                  size="sm" 
                  onClick={() => setAuthDialogOpen(true)} 
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs mt-1"
                >
                  <LogIn className="w-3.5 h-3.5 mr-1.5" />
                  এখনই লগইন করুন
                </Button>
              </div>
            ) : loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                <span className="text-xs font-medium">ক্লাউড থেকে স্ন্যাপশট লোড হচ্ছে...</span>
              </div>
            ) : snapshots.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-500 gap-2 text-center">
                <ImageIcon className="w-10 h-10 stroke-1 text-slate-600" />
                <p className="text-sm font-medium text-slate-300">এখনও কোনো স্ন্যাপশট ক্লাউডে সেভ করা হয়নি।</p>
                <p className="text-xs text-slate-500 max-w-xs">
                  টপ বারের &quot;As Image&quot; বাটনে ক্লিক করে &quot;ক্লাউডে সেভ করুন&quot; চাপলে এখানে জমা হবে।
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[55vh] pr-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {snapshots.map((item) => (
                    <div 
                      key={item.id}
                      className="group relative bg-slate-800/80 border border-slate-700/60 rounded-lg p-2.5 flex flex-col justify-between hover:border-cyan-500/50 transition-all shadow-md"
                    >
                      <div className="relative aspect-video w-full bg-slate-950 rounded overflow-hidden mb-2 border border-slate-700/30 flex items-center justify-center">
                        {item.thumbnailUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img 
                            src={item.thumbnailUrl} 
                            alt={item.name} 
                            className="object-contain w-full h-full group-hover:scale-105 transition-transform duration-200" 
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-500 gap-1">
                            <ImageIcon className="w-8 h-8 text-slate-600" />
                            <span className="text-[10px] uppercase font-bold text-slate-400">{item.format || "FILE"}</span>
                          </div>
                        )}
                        {item.format === 'pdf' && (
                          <span className="absolute top-1.5 right-1.5 bg-red-600/90 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow">
                            PDF
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-white truncate" title={item.name}>
                          {item.name}
                        </p>
                        {item.timeCreated && (
                          <p className="text-[10px] text-slate-400">
                            {new Date(item.timeCreated).toLocaleDateString()} {new Date(item.timeCreated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-end gap-1.5 mt-2.5 pt-2 border-t border-slate-700/50">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-cyan-400 hover:text-cyan-300 hover:bg-slate-700"
                          asChild
                        >
                          <a href={item.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3.5 h-3.5 mr-1" />
                            দেখুন
                          </a>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-blue-400 hover:text-blue-300 hover:bg-slate-700"
                          asChild
                        >
                          <a href={item.url} download={item.name.endsWith('.pdf') ? item.name : (item.format === 'pdf' ? `${item.name}.pdf` : `${item.name}.png`)}>
                            <Download className="w-3.5 h-3.5 mr-1" />
                            ডাউনলোড
                          </a>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={deletingId === item.id}
                          onClick={() => handleDelete(item)}
                          className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-slate-700"
                        >
                          {deletingId === item.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </>
  );
}
