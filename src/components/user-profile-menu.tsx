"use client";

import React, { useState } from "react";
import { useAuth } from "@/firebase/auth-context";
import { AuthDialog } from "./auth-dialog";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut, User as UserIcon, Cloud } from "lucide-react";

interface UserProfileMenuProps {
  onOpenCloudGallery?: () => void;
}

export function UserProfileMenu({ onOpenCloudGallery }: UserProfileMenuProps) {
  const { user, loading, logout } = useAuth();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  if (loading) {
    return <div className="w-7 h-7 rounded-full bg-slate-800 animate-pulse shrink-0" />;
  }

  if (!user) {
    return (
      <>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setAuthDialogOpen(true)}
          className="h-7 px-2.5 text-xs bg-blue-600/20 border-blue-500/30 text-blue-400 hover:bg-blue-600 hover:text-white transition-all font-semibold flex items-center gap-1.5"
        >
          <LogIn className="w-3.5 h-3.5" />
          <span>লগইন</span>
        </Button>
        <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
      </>
    );
  }

  const initials = (user.displayName || user.email || "U").substring(0, 2).toUpperCase();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 focus:outline-none ring-1 ring-slate-700 hover:ring-blue-500 rounded-full transition-all">
            <Avatar className="w-7 h-7 border border-slate-700 text-xs">
              {user.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName || "User"} />}
              <AvatarFallback className="bg-blue-600 text-white font-bold text-[10px]">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-slate-900 border-slate-800 text-slate-100">
          <DropdownMenuLabel className="font-normal py-2">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-semibold leading-none text-white">{user.displayName || "ব্যবহারকারী"}</p>
              <p className="text-xs leading-none text-slate-400 truncate">{user.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-slate-800" />
          {onOpenCloudGallery && (
            <DropdownMenuItem 
              onSelect={() => {
                setTimeout(() => {
                  onOpenCloudGallery();
                }, 80);
              }}
              className="hover:bg-slate-800 cursor-pointer text-xs flex items-center gap-2 py-2 text-slate-200"
            >
              <Cloud className="w-4 h-4 text-cyan-400" />
              <span>আমার ক্লাউড স্ন্যাপশট</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem 
            onClick={() => logout()}
            className="text-red-400 hover:bg-slate-800 hover:text-red-300 cursor-pointer text-xs flex items-center gap-2 py-2"
          >
            <LogOut className="w-4 h-4" />
            <span>লগআউট করুন</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </>
  );
}
