"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { 
  Dialog, 
  DialogContent,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  RotateCcw, 
  Maximize2, 
  Minimize2, 
  Sun, 
  Moon, 
  Layers, 
  Box, 
  Tag, 
  X,
  Sparkles,
  Camera,
  Footprints,
  Sunset,
  SunMedium,
  Compass,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight
} from "lucide-react";

export type DesignObject = {
  id: string;
  type: 'structure' | 'opening' | 'shape' | 'text' | 'pillar' | 'table' | 'stair' | 'furniture' | 'mep' | 'landscape';
  subType: string;
  x: number; y: number; w: number; h: number;
  label: string; 
  color: string; 
  fillColor: string; 
  strokeWidth: number;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  rotation: number;
  textContent?: string;
  fontSize?: number;
  isBold?: boolean;
  isJoined?: boolean; 
  stepCount?: number;
};

interface ThreeDViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  designObjects: DesignObject[];
  setDesignObjects?: React.Dispatch<React.SetStateAction<DesignObject[]>>; 
  projectName?: string;
  onSave?: () => void;
}

export function ThreeDViewDialog({
  open,
  onOpenChange,
  designObjects,
  setDesignObjects,
  projectName = "প্রজেক্ট",
  onSave
}: ThreeDViewDialogProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const furnitureGroupRef = useRef<THREE.Group | null>(null);
  const labelsGroupRef = useRef<THREE.Group | null>(null);
  const wallsGroupRef = useRef<THREE.Group | null>(null);
  const lightsGroupRef = useRef<THREE.Group | null>(null);

  const [showFurniture, setShowFurniture] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [lightingMode, setLightingMode] = useState<'day' | 'sunset' | 'night'>('day');
  const [floorTextureType, setFloorTextureType] = useState<'marble' | 'wood'>('marble');
  const [isWalkthrough, setIsWalkthrough] = useState(false);
  const [wallHeightMode, setWallHeightMode] = useState<'full' | 'half'>('full');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [currentView, setCurrentView] = useState<'iso' | 'top' | 'front' | 'side'>('iso');

  // Direct 3D Studio CAD States
  const [isStudioMode, setIsStudioMode] = useState(true);
  const [active3DTool, setActive3DTool] = useState<string>('select');
  const [wallDrawStart, setWallDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [hoverCoords, setHoverCoords] = useState<{ x: number; y: number } | null>(null);
  const [selected3DId, setSelected3DId] = useState<string | null>(null);
  const [studioToast, setStudioToast] = useState<string | null>(null);
  const [furnitureMenuOpen, setFurnitureMenuOpen] = useState(false);
  const [studioHistory, setStudioHistory] = useState<DesignObject[][]>([designObjects]);
  const [historyIdx, setHistoryIdx] = useState(0);

  const active3DToolRef = useRef(active3DTool);
  active3DToolRef.current = active3DTool;
  const wallDrawStartRef = useRef(wallDrawStart);
  wallDrawStartRef.current = wallDrawStart;
  const isStudioModeRef = useRef(isStudioMode);
  isStudioModeRef.current = isStudioMode;
  const selected3DIdRef = useRef(selected3DId);
  selected3DIdRef.current = selected3DId;
  const designObjectsRef = useRef(designObjects);
  designObjectsRef.current = designObjects;

  const showStudioToast = useCallback((msg: string) => {
    setStudioToast(msg);
    setTimeout(() => setStudioToast(null), 3500);
  }, []);

  const saveToStudioHistory = useCallback((newObjs: DesignObject[]) => {
    if (!setDesignObjects) return;
    setDesignObjects(newObjs);
    setStudioHistory(prev => [...prev.slice(0, historyIdx + 1), newObjs]);
    setHistoryIdx(prev => prev + 1);
  }, [setDesignObjects, historyIdx]);

  const undoStudio = useCallback(() => {
    if (historyIdx > 0 && setDesignObjects) {
      const prevObjs = studioHistory[historyIdx - 1];
      setHistoryIdx(historyIdx - 1);
      setDesignObjects(prevObjs);
      showStudioToast("পূর্বাবস্থায় ফেরানো হয়েছে (Undo)");
    }
  }, [historyIdx, studioHistory, setDesignObjects, showStudioToast]);

  const redoStudio = useCallback(() => {
    if (historyIdx < studioHistory.length - 1 && setDesignObjects) {
      const nextObjs = studioHistory[historyIdx + 1];
      setHistoryIdx(historyIdx + 1);
      setDesignObjects(nextObjs);
      showStudioToast("পুনরায় সম্পন্ন হয়েছে (Redo)");
    }
  }, [historyIdx, studioHistory, setDesignObjects, showStudioToast]);
  const boundsRef = useRef<{ bWidth: number; bDepth: number; centerX: number; centerZ: number }>({ bWidth: 30, bDepth: 30, centerX: 15, centerZ: 15 });
  const walkStateRef = useRef({
    keys: { forward: false, backward: false, left: false, right: false },
    yaw: 0,
    pitch: -0.06,
    isMouseDown: false,
    prevMouseX: 0,
    prevMouseY: 0,
    bobTimer: 0,
    vx: 0,
    vz: 0,
  });

  const createMarbleTexture = useCallback(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Polished Italian white/cream marble base
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 512, 512);

    // Marble veins
    ctx.lineWidth = 2.5;
    const veins = [
      { color: 'rgba(148, 163, 184, 0.45)', pts: [[0, 80], [120, 160], [260, 140], [380, 290], [512, 350]] },
      { color: 'rgba(100, 116, 139, 0.35)', pts: [[60, 0], [180, 130], [320, 240], [450, 420], [512, 490]] },
      { color: 'rgba(180, 150, 110, 0.30)', pts: [[220, 0], [280, 180], [380, 270], [420, 512]] },
      { color: 'rgba(148, 163, 184, 0.25)', pts: [[0, 360], [110, 380], [230, 460], [350, 512]] },
    ];

    veins.forEach(v => {
      ctx.strokeStyle = v.color;
      ctx.beginPath();
      ctx.moveTo(v.pts[0][0], v.pts[0][1]);
      for (let i = 1; i < v.pts.length; i++) {
        const xc = (v.pts[i - 1][0] + v.pts[i][0]) / 2;
        const yc = (v.pts[i - 1][1] + v.pts[i][1]) / 2;
        ctx.quadraticCurveTo(v.pts[i - 1][0], v.pts[i - 1][1], xc, yc);
      }
      ctx.stroke();
    });

    // Subtle 2x2 luxury slab borders
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, 0, 256, 256);
    ctx.strokeRect(256, 0, 256, 256);
    ctx.strokeRect(0, 256, 256, 256);
    ctx.strokeRect(256, 256, 256, 256);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3.5, 3.5);
    return texture;
  }, []);

  const createParquetTexture = useCallback(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#d4b387';
    ctx.fillRect(0, 0, 512, 512);

    const plankCount = 10;
    const plankW = 512 / plankCount;
    for (let i = 0; i < plankCount; i++) {
      const x = i * plankW;
      const shade = Math.sin(i * 2.3) * 12;
      ctx.fillStyle = `rgb(${210 + shade}, ${177 + shade}, ${134 + shade})`;
      ctx.fillRect(x, 0, plankW, 512);

      ctx.fillStyle = 'rgba(110, 75, 35, 0.08)';
      for (let g = 0; g < 8; g++) {
        const gx = x + (g / 8) * plankW;
        ctx.fillRect(gx + Math.sin(g) * 2, 0, 1.2, 512);
      }

      ctx.fillStyle = 'rgba(75, 48, 20, 0.35)';
      ctx.fillRect(x, 0, 1.5, 512);

      const offset = (i % 3) * 85;
      for (let y = offset; y < 512; y += 170) {
        ctx.fillRect(x, y, plankW, 1.5);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2.5, 2.5);
    return texture;
  }, []);

  const createTileTexture = useCallback(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#dae5ec';
    ctx.fillRect(0, 0, 256, 256);

    const tileSize = 64;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    for (let x = 0; x <= 256; x += tileSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 256);
      ctx.stroke();
    }
    for (let y = 0; y <= 256; y += tileSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    for (let x = 0; x < 256; x += tileSize) {
      for (let y = 0; y < 256; y += tileSize) {
        ctx.fillRect(x + 4, y + 4, tileSize - 8, tileSize - 8);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3);
    return texture;
  }, []);

  const createGravelTexture = useCallback(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#e2dacb';
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 3500; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const r = Math.random() * 1.5;
      const c = Math.floor(190 + Math.random() * 45);
      ctx.fillStyle = `rgb(${c}, ${c - 8}, ${c - 20})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 8);
    return texture;
  }, []);

  const createTextBadge = useCallback((text: string, subText?: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 200;
    const ctx = canvas.getContext('2d')!;

    const x = 20, y = 20, w = 472, h = 160, r = 24;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 36px "Segoe UI", Inter, sans-serif';
    
    if (subText) {
      ctx.fillText(text, 256, 80);
      ctx.fillStyle = '#475569';
      ctx.font = '600 28px "Segoe UI", Inter, sans-serif';
      ctx.fillText(subText, 256, 128);
    } else {
      ctx.fillText(text, 256, 100);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(4.5, 1.8, 1);
    return sprite;
  }, []);

  const createDoubleBed = (w: number, d: number, theme: 'blue' | 'emerald' | 'crimson' = 'blue') => {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6e3c19, roughness: 0.55 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.35 });

    const blanketColors = {
      blue: 0x1d4ed8,     // Rich royal blue
      emerald: 0x059669,  // Rich emerald green
      crimson: 0xbe123c   // Rich ruby crimson
    };
    const accentColors = {
      blue: 0xf59e0b,     // Gold pillow accent
      emerald: 0xfacc15,  // Yellow accent
      crimson: 0x38bdf8   // Sky accent
    };

    const blanketMat = new THREE.MeshStandardMaterial({ color: blanketColors[theme] || 0x1d4ed8, roughness: 0.7 });
    const accentCushionMat = new THREE.MeshStandardMaterial({ color: accentColors[theme] || 0xf59e0b, roughness: 0.5 });
    const pillowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2b2, emissive: 0xffe082, emissiveIntensity: lightingMode !== 'day' ? 0.9 : 0.25 });

    // Bed frame
    const frameGeo = new THREE.BoxGeometry(w, 0.6, d);
    const frame = new THREE.Mesh(frameGeo, woodMat);
    frame.position.y = 0.3;
    frame.castShadow = true; frame.receiveShadow = true;
    group.add(frame);

    // Padded Headboard
    const headGeo = new THREE.BoxGeometry(w + 0.2, 2.8, 0.35);
    const head = new THREE.Mesh(headGeo, woodMat);
    head.position.set(0, 1.4, -d / 2 + 0.17);
    head.castShadow = true; head.receiveShadow = true;

    const headCushion = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 2.2, 0.15), blanketMat);
    headCushion.position.set(0, 1.5, -d / 2 + 0.35);
    group.add(head, headCushion);

    // Thick Mattress
    const matGeo = new THREE.BoxGeometry(w * 0.94, 0.85, d * 0.92);
    const mattress = new THREE.Mesh(matGeo, whiteMat);
    mattress.position.set(0, 1.1, 0.05);
    mattress.castShadow = true; mattress.receiveShadow = true;
    group.add(mattress);

    // Pillows & Colorful Accent Cushions
    const pGeo = new THREE.BoxGeometry(w * 0.36, 0.32, d * 0.2);
    const p1 = new THREE.Mesh(pGeo, pillowMat);
    p1.position.set(-w * 0.24, 1.3, -d * 0.28);
    const p2 = new THREE.Mesh(pGeo, pillowMat);
    p2.position.set(w * 0.24, 1.3, -d * 0.28);

    const cGeo = new THREE.BoxGeometry(w * 0.26, 0.26, d * 0.14);
    const c1 = new THREE.Mesh(cGeo, accentCushionMat);
    c1.position.set(-w * 0.24, 1.45, -d * 0.2);
    const c2 = new THREE.Mesh(cGeo, accentCushionMat);
    c2.position.set(w * 0.24, 1.45, -d * 0.2);
    group.add(p1, p2, c1, c2);

    // Folded Duvet & Accent Runner
    const blkGeo = new THREE.BoxGeometry(w * 0.93, 0.38, d * 0.55);
    const blanket = new THREE.Mesh(blkGeo, blanketMat);
    blanket.position.set(0, 1.25, d * 0.15);
    blanket.castShadow = true; blanket.receiveShadow = true;

    const runner = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, 0.04, d * 0.18), accentCushionMat);
    runner.position.set(0, 1.45, d * 0.25);
    group.add(blanket, runner);

    // Side tables with glowing lamps
    const sideGeo = new THREE.BoxGeometry(1.3, 1.2, 1.3);
    const s1 = new THREE.Mesh(sideGeo, woodMat);
    s1.position.set(-w / 2 - 0.75, 0.6, -d / 2 + 0.65);
    s1.castShadow = true;
    const s2 = new THREE.Mesh(sideGeo, woodMat);
    s2.position.set(w / 2 + 0.75, 0.6, -d / 2 + 0.65);
    s2.castShadow = true;

    const lampGeo = new THREE.CylinderGeometry(0.32, 0.45, 0.8, 16);
    const l1 = new THREE.Mesh(lampGeo, lampMat);
    l1.position.set(-w / 2 - 0.75, 1.6, -d / 2 + 0.65);
    const l2 = new THREE.Mesh(lampGeo, lampMat);
    l2.position.set(w / 2 + 0.75, 1.6, -d / 2 + 0.65);
    group.add(s1, s2, l1, l2);

    return group;
  };

  const createStudyDesk = () => {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8d5b35, roughness: 0.5 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8 });

    const topGeo = new THREE.BoxGeometry(3.5, 0.15, 1.8);
    const top = new THREE.Mesh(topGeo, woodMat);
    top.position.y = 2.2;
    top.castShadow = true;
    group.add(top);

    const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.2);
    [-1.6, 1.6].forEach(lx => {
      [-0.7, 0.7].forEach(lz => {
        const leg = new THREE.Mesh(legGeo, metalMat);
        leg.position.set(lx, 1.1, lz);
        leg.castShadow = true;
        group.add(leg);
      });
    });

    const lapBase = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.6), metalMat);
    lapBase.position.set(0, 2.3, 0);
    const lapScreen = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.04), new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x60a5fa, emissiveIntensity: 0.3 }));
    lapScreen.position.set(0, 2.55, -0.25);
    lapScreen.rotation.x = 0.2;
    group.add(lapBase, lapScreen);

    const chairBase = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 1.2), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
    chairBase.position.set(0, 1.4, 1.2);
    const chairBack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.15), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
    chairBack.position.set(0, 2.0, 1.7);
    group.add(chairBase, chairBack);

    return group;
  };

  const createLivingSofaSet = (w: number, d: number) => {
    const group = new THREE.Group();
    const fabricMat = new THREE.MeshStandardMaterial({ color: 0xd6cfc4, roughness: 0.9 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a341b, roughness: 0.6 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x88bbcc, transparent: true, opacity: 0.6, roughness: 0.1 });
    const rugMat = new THREE.MeshStandardMaterial({ color: 0xb5a995, roughness: 1.0 });

    const rug = new THREE.Mesh(new THREE.BoxGeometry(Math.min(w * 0.7, 10), 0.02, Math.min(d * 0.6, 8)), rugMat);
    rug.position.y = 0.01;
    rug.receiveShadow = true;
    group.add(rug);

    const sofa = new THREE.Group();
    const sBase = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.8, 2.6), fabricMat);
    sBase.position.y = 0.5;
    sBase.castShadow = true;
    const sBack = new THREE.Mesh(new THREE.BoxGeometry(6.5, 1.6, 0.7), fabricMat);
    sBack.position.set(0, 1.4, -1.0);
    sBack.castShadow = true;
    const arm1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 2.6), fabricMat);
    arm1.position.set(-3.0, 0.9, 0);
    const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 2.6), fabricMat);
    arm2.position.set(3.0, 0.9, 0);
    // Colorful Throw Pillows (Teal, Amber, Crimson)
    const throwColors = [0x0d9488, 0xf59e0b, 0xe11d48];
    [-2.0, 0, 2.0].forEach((tx, idx) => {
      const tp = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.35), new THREE.MeshStandardMaterial({ color: throwColors[idx], roughness: 0.6 }));
      tp.rotation.x = 0.2;
      tp.position.set(tx, 1.3, -0.6);
      sofa.add(tp);
    });

    sofa.position.set(0, 0, -Math.min(d * 0.2, 3));
    group.add(sofa);

    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.15, 2.0), woodMat);
    tableTop.position.set(0, 1.1, 0.6);
    tableTop.castShadow = true;
    const tableGlass = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.05, 1.8), glassMat);
    tableGlass.position.set(0, 1.2, 0.6);
    group.add(tableTop, tableGlass);

    const tvUnit = new THREE.Mesh(new THREE.BoxGeometry(6.0, 1.0, 1.2), woodMat);
    tvUnit.position.set(0, 0.5, Math.min(d * 0.35, 5));
    tvUnit.castShadow = true;
    const tvScreen = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.8, 0.1), new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x0369a1, emissiveIntensity: 0.35, roughness: 0.1 }));
    tvScreen.position.set(0, 2.7, Math.min(d * 0.35, 5));
    tvScreen.castShadow = true;
    group.add(tvUnit, tvScreen);

    const plant = createPottedPlant();
    plant.position.set(-Math.min(w * 0.35, 4.5), 0, -Math.min(d * 0.25, 3.5));
    group.add(plant);

    return group;
  };

  const createDiningSet = () => {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6e3c19, roughness: 0.6 });

    const table = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.2, 2.8), woodMat);
    table.position.y = 2.4;
    table.castShadow = true;
    [-2.0, 2.0].forEach(tx => {
      [-1.2, 1.2].forEach(tz => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.4), woodMat);
        leg.position.set(tx, 1.2, tz);
        leg.castShadow = true;
        group.add(leg);
      });
    });
    group.add(table);

    const chairOffsets = [
      { x: -1.2, z: -1.8, rot: 0 },
      { x: 1.2, z: -1.8, rot: 0 },
      { x: -1.2, z: 1.8, rot: Math.PI },
      { x: 1.2, z: 1.8, rot: Math.PI },
    ];
    chairOffsets.forEach(co => {
      const chair = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 1.2), woodMat);
      seat.position.y = 1.4;
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.1), woodMat);
      back.position.set(0, 2.0, -0.55);
      chair.add(seat, back);
      chair.position.set(co.x, 0, co.z);
      chair.rotation.y = co.rot;
      group.add(chair);
    });

    return group;
  };

  const createKitchenUnit = (w: number, d: number) => {
    const group = new THREE.Group();
    const cabinetMat = new THREE.MeshStandardMaterial({ color: 0xdad6cd, roughness: 0.5 });
    const graniteMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.3 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 });

    const kw = Math.min(w * 0.8, 8);
    const counter1 = new THREE.Mesh(new THREE.BoxGeometry(kw, 2.4, 1.8), cabinetMat);
    counter1.position.set(0, 1.2, -Math.min(d * 0.3, 3));
    counter1.castShadow = true;
    const top1 = new THREE.Mesh(new THREE.BoxGeometry(kw + 0.1, 0.2, 1.9), graniteMat);
    top1.position.set(0, 2.45, -Math.min(d * 0.3, 3));
    top1.castShadow = true;
    group.add(counter1, top1);

    const stove = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 1.3), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    stove.position.set(-kw * 0.2, 2.58, -Math.min(d * 0.3, 3));
    group.add(stove);

    const sink = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 1.2), steelMat);
    sink.position.set(kw * 0.2, 2.56, -Math.min(d * 0.3, 3));
    const faucet = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 8, 16, Math.PI), steelMat);
    faucet.rotation.z = Math.PI / 2;
    faucet.position.set(kw * 0.2, 2.8, -Math.min(d * 0.3, 3) - 0.4);
    group.add(sink, faucet);

    const fridge = new THREE.Mesh(new THREE.BoxGeometry(2.2, 5.5, 2.2), steelMat);
    fridge.position.set(kw * 0.4, 2.75, 0.5);
    fridge.castShadow = true;
    group.add(fridge);

    return group;
  };

  const createBathroomUnit = () => {
    const group = new THREE.Group();
    const ceramicMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xa8c5da, transparent: true, opacity: 0.4, roughness: 0.1 });

    const commodeBase = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.8), ceramicMat);
    commodeBase.position.set(-1.2, 0.6, -1.0);
    commodeBase.castShadow = true;
    const commodeTank = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 0.8), ceramicMat);
    commodeTank.position.set(-1.2, 1.6, -1.6);
    commodeTank.castShadow = true;
    group.add(commodeBase, commodeTank);

    const basin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.3), ceramicMat);
    basin.position.set(1.2, 2.4, -1.4);
    basin.castShadow = true;
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 0.05), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.0, metalness: 0.9 }));
    mirror.position.set(1.2, 3.8, -1.9);
    group.add(basin, mirror);

    const showerScreen = new THREE.Mesh(new THREE.BoxGeometry(0.08, 6.0, 2.5), glassMat);
    showerScreen.position.set(0, 3.0, 0.8);
    group.add(showerScreen);

    return group;
  };

  const createMandirAltar = () => {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xa06528, roughness: 0.4 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.2, metalness: 0.8 });

    const base = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.0, 2.0), woodMat);
    base.position.y = 1.0;
    base.castShadow = true;
    group.add(base);

    [-1.6, 1.6].forEach(px => {
      [-0.8, 0.8].forEach(pz => {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.2), woodMat);
        pillar.position.set(px, 3.6, pz);
        group.add(pillar);
      });
    });

    const canopy = new THREE.Mesh(new THREE.ConeGeometry(2.0, 1.5, 4), goldMat);
    canopy.position.set(0, 5.8, 0);
    canopy.rotation.y = Math.PI / 4;
    group.add(canopy);

    return group;
  };

  // 7b. Realistic RCC Structural Beam
  const createRCCBeam = (w: number, depth: number, wallH: number, beamDepthInches: number = 12, label: string = "B1") => {
    const group = new THREE.Group();
    const beamMat = new THREE.MeshStandardMaterial({ 
      color: 0x475569, // Structural concrete dark slate
      roughness: 0.7, 
      metalness: 0.1 
    });
    const bHeight = (beamDepthInches || 12) / 12;
    const bW = Math.max(w, 0.833);
    const bD = Math.max(depth, 0.833);
    const beamMesh = new THREE.Mesh(new THREE.BoxGeometry(bW, bHeight, bD), beamMat);
    beamMesh.position.set(bW / 2, wallH - bHeight / 2, bD / 2);
    beamMesh.castShadow = true;
    beamMesh.receiveShadow = true;
    group.add(beamMesh);
    return group;
  };

  // 8. Bold Red Architectural Pillar (পিলারের কালার লাল)
  const createRedPillar = (w: number, depth: number, wallH: number) => {
    const group = new THREE.Group();
    const pW = Math.max(w, 1.25);
    const pD = Math.max(depth, 1.25);

    // Vibrant Architectural Crimson Red
    const pillarRedMat = new THREE.MeshStandardMaterial({ 
      color: 0xdc2626, 
      roughness: 0.35, 
      metalness: 0.15 
    });
    // Dark granite plinth base
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
    // Top crown cap (Bold crimson red with dark edge so top view is vividly RED)
    const capMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.3, metalness: 0.2 });
    const topAccentMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.25 });

    // Base plinth
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(pW + 0.15, 0.3, pD + 0.15), baseMat);
    plinth.position.set(pW / 2, 0.15, pD / 2);
    plinth.castShadow = true; plinth.receiveShadow = true;

    // Main vibrant red shaft
    const shaftH = wallH;
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(pW, shaftH, pD), pillarRedMat);
    shaft.position.set(pW / 2, shaftH / 2 + 0.15, pD / 2);
    shaft.castShadow = true; shaft.receiveShadow = true;

    // Capital / Top crown cap (Red so top view shows prominent red pillar!)
    const cap = new THREE.Mesh(new THREE.BoxGeometry(pW + 0.12, 0.2, pD + 0.12), capMat);
    cap.position.set(pW / 2, shaftH + 0.2, pD / 2);
    cap.castShadow = true;

    const topAccent = new THREE.Mesh(new THREE.BoxGeometry(pW * 0.82, 0.06, pD * 0.82), topAccentMat);
    topAccent.position.set(pW / 2, shaftH + 0.32, pD / 2);
    topAccent.castShadow = true;

    group.add(plinth, shaft, cap, topAccent);
    return group;
  };

  // 9. Ultra-Realistic 3D Architectural Door Assembly
  const createRealisticDoor = (w: number, wallH: number, depth: number, subType: string) => {
    const group = new THREE.Group();
    const dHeight = Math.min(wallH - 0.5, 6.8);
    const frameThick = 0.22;
    const woodFrameMat = new THREE.MeshStandardMaterial({ color: 0x5a2d0c, roughness: 0.45 });
    const woodDoorMat = new THREE.MeshStandardMaterial({ color: 0x7c3f12, roughness: 0.4 });
    const panelBevelMat = new THREE.MeshStandardMaterial({ color: 0x69340e, roughness: 0.35 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9, roughness: 0.15 });

    // Outer Frame Casing (Left, Right, Top)
    const jambL = new THREE.Mesh(new THREE.BoxGeometry(frameThick, dHeight, depth * 1.15), woodFrameMat);
    jambL.position.set(frameThick / 2, dHeight / 2, depth / 2);
    jambL.castShadow = true;

    const jambR = new THREE.Mesh(new THREE.BoxGeometry(frameThick, dHeight, depth * 1.15), woodFrameMat);
    jambR.position.set(w - frameThick / 2, dHeight / 2, depth / 2);
    jambR.castShadow = true;

    const header = new THREE.Mesh(new THREE.BoxGeometry(w, frameThick, depth * 1.15), woodFrameMat);
    header.position.set(w / 2, dHeight - frameThick / 2, depth / 2);
    header.castShadow = true;

    // Threshold / Floor sill (dark stone threshold plate)
    const threshold = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, depth * 1.4), new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 }));
    threshold.position.set(w / 2, 0.04, depth / 2);
    group.add(jambL, jambR, header, threshold);

    if (subType === 'double-door') {
      const leafW = (w - frameThick * 2) / 2;
      [-1, 1].forEach((dir, idx) => {
        const leafHinge = new THREE.Group();
        leafHinge.position.set(idx === 0 ? frameThick : w - frameThick, 0, depth / 2);
        leafHinge.rotation.y = idx === 0 ? Math.PI * 0.35 : -Math.PI * 0.35;

        const leaf = new THREE.Mesh(new THREE.BoxGeometry(leafW, dHeight - 0.25, 0.14), woodDoorMat);
        leaf.position.set(idx === 0 ? leafW / 2 : -leafW / 2, (dHeight - 0.25) / 2, 0);
        leaf.castShadow = true;

        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45), brassMat);
        handle.rotation.x = Math.PI / 2;
        handle.position.set(idx === 0 ? leafW * 0.85 : -leafW * 0.85, 3.2, 0.15);
        leafHinge.add(leaf, handle);
        group.add(leafHinge);
      });
    } else if (subType === 'sliding-door') {
      const trackMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.2 });
      const glassDoorMat = new THREE.MeshStandardMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.4, roughness: 0.05, metalness: 0.3 });
      
      const topTrack = new THREE.Mesh(new THREE.BoxGeometry(w, 0.15, depth * 0.8), trackMat);
      topTrack.position.set(w / 2, dHeight - 0.08, depth / 2);

      const panelW = w * 0.52;
      const p1 = new THREE.Mesh(new THREE.BoxGeometry(panelW, dHeight - 0.3, 0.08), glassDoorMat);
      p1.position.set(panelW / 2, (dHeight - 0.3) / 2, depth / 2 - 0.08);

      const p2 = new THREE.Mesh(new THREE.BoxGeometry(panelW, dHeight - 0.3, 0.08), glassDoorMat);
      p2.position.set(w - panelW / 2, (dHeight - 0.3) / 2, depth / 2 + 0.08);

      const h1 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8), trackMat);
      h1.position.set(panelW * 0.9, 3.0, depth / 2 - 0.15);
      const h2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8), trackMat);
      h2.position.set(w - panelW * 0.9, 3.0, depth / 2 + 0.15);

      group.add(topTrack, p1, p2, h1, h2);
    } else {
      // Classic 4-Panel Molded Wooden Door swung open at 65°
      const doorLeafW = (w - frameThick * 2) * 0.98;
      const leafH = dHeight - 0.25;

      const doorHinge = new THREE.Group();
      doorHinge.position.set(frameThick, 0, depth / 2);
      doorHinge.rotation.y = Math.PI * 0.36; // 65 degrees swung open

      const doorLeaf = new THREE.Mesh(new THREE.BoxGeometry(doorLeafW, leafH, 0.15), woodDoorMat);
      doorLeaf.position.set(doorLeafW / 2, leafH / 2, 0);
      doorLeaf.castShadow = true;
      doorHinge.add(doorLeaf);

      const pW = doorLeafW * 0.36;
      const pH_top = leafH * 0.36;
      const pH_bot = leafH * 0.28;

      const panelPositions = [
        { x: doorLeafW * 0.28, y: leafH * 0.72, h: pH_top },
        { x: doorLeafW * 0.72, y: leafH * 0.72, h: pH_top },
        { x: doorLeafW * 0.28, y: leafH * 0.30, h: pH_bot },
        { x: doorLeafW * 0.72, y: leafH * 0.30, h: pH_bot },
      ];

      panelPositions.forEach(pp => {
        const panF = new THREE.Mesh(new THREE.BoxGeometry(pW, pp.h, 0.05), panelBevelMat);
        panF.position.set(pp.x, pp.y, 0.09);
        const panB = new THREE.Mesh(new THREE.BoxGeometry(pW, pp.h, 0.05), panelBevelMat);
        panB.position.set(pp.x, pp.y, -0.09);
        doorHinge.add(panF, panB);
      });

      const escutcheon = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.04), brassMat);
      escutcheon.position.set(doorLeafW * 0.88, 3.2, 0.1);
      const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35), brassMat);
      lever.rotation.z = Math.PI / 2;
      lever.position.set(doorLeafW * 0.88 - 0.12, 3.28, 0.14);
      doorHinge.add(escutcheon, lever);

      [0.8, dHeight - 1.0].forEach(hy => {
        const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2), brassMat);
        hinge.position.set(0.04, hy, 0);
        doorHinge.add(hinge);
      });

      group.add(doorHinge);

      // Architectural 2D-Style Door Swing Arc on floor (clearly visible in top-down view!)
      const arcRadius = doorLeafW;
      const arcGeo = new THREE.RingGeometry(Math.max(0.1, arcRadius - 0.06), arcRadius, 32, 1, 0, Math.PI * 0.36);
      const arcMat = new THREE.MeshBasicMaterial({ color: 0xd97706, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
      const swingArc = new THREE.Mesh(arcGeo, arcMat);
      swingArc.rotation.x = -Math.PI / 2;
      swingArc.position.set(frameThick, 0.04, depth / 2);
      group.add(swingArc);
    }

    return group;
  };

  // 10. Ultra-Realistic 3D Architectural Window Assembly
  const createRealisticWindow = (w: number, wallH: number, depth: number) => {
    const group = new THREE.Group();
    const sillH = 2.4;
    const winH = Math.min(wallH - sillH - 0.5, 4.3);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.85 });
    const woodFrameMat = new THREE.MeshStandardMaterial({ color: 0x5a2d0c, roughness: 0.45 });
    const sillStoneMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const glassMat = new THREE.MeshStandardMaterial({ 
      color: 0x7dd3fc, 
      emissive: 0x38bdf8,
      emissiveIntensity: 0.28,
      transparent: true, 
      opacity: 0.6, 
      roughness: 0.05, 
      metalness: 0.2 
    });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.2 });

    const wallBelow = new THREE.Mesh(new THREE.BoxGeometry(w, sillH, depth), wallMat);
    wallBelow.position.set(w / 2, sillH / 2, depth / 2);
    wallBelow.castShadow = true; wallBelow.receiveShadow = true;

    // Projected Stone Sill Ledge (Interior & Exterior)
    const sillLedge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.16, depth * 1.5), sillStoneMat);
    sillLedge.position.set(w / 2, sillH + 0.08, depth / 2);
    sillLedge.castShadow = true; sillLedge.receiveShadow = true;

    // Top Sunshade / Chajja (classic architectural weather shade)
    const chajja = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.12, depth * 1.5), sillStoneMat);
    chajja.position.set(w / 2, sillH + winH + 0.1, depth / 2 - depth * 0.25);
    chajja.castShadow = true;

    const frameThick = 0.18;
    const fTop = new THREE.Mesh(new THREE.BoxGeometry(w, frameThick, depth * 1.1), woodFrameMat);
    fTop.position.set(w / 2, sillH + winH - frameThick / 2, depth / 2);
    fTop.castShadow = true;

    const fLeft = new THREE.Mesh(new THREE.BoxGeometry(frameThick, winH, depth * 1.1), woodFrameMat);
    fLeft.position.set(frameThick / 2, sillH + winH / 2, depth / 2);
    fLeft.castShadow = true;

    const fRight = new THREE.Mesh(new THREE.BoxGeometry(frameThick, winH, depth * 1.1), woodFrameMat);
    fRight.position.set(w - frameThick / 2, sillH + winH / 2, depth / 2);
    fRight.castShadow = true;

    const mullionV = new THREE.Mesh(new THREE.BoxGeometry(0.12, winH, depth * 0.95), woodFrameMat);
    mullionV.position.set(w / 2, sillH + winH / 2, depth / 2);
    mullionV.castShadow = true;

    const transomH = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, depth * 0.95), woodFrameMat);
    transomH.position.set(w / 2, sillH + winH / 2, depth / 2);
    transomH.castShadow = true;

    const glass = new THREE.Mesh(new THREE.BoxGeometry(w - frameThick * 2, winH - frameThick * 2, 0.08), glassMat);
    glass.position.set(w / 2, sillH + winH / 2, depth / 2);

    const lock = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2), brassMat);
    lock.position.set(w / 2, sillH + winH / 2, depth / 2 + 0.08);

    group.add(wallBelow, sillLedge, chajja, fTop, fLeft, fRight, mullionV, transomH, glass, lock);
    return group;
  };

  // 11. Ultra-Realistic 3D Architectural Staircase
  const createRealisticStaircase = (w: number, depth: number, wallH: number, stepCount: number, subType: string) => {
    const group = new THREE.Group();
    const steps = Math.max(8, stepCount || 14);
    const treadWoodMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.35 });
    const riserWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.8 });
    const stringerMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.4 });
    const steelRailMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.15 });
    const handrailMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.35 });

    const flightW = w * 0.45;
    const riserH = wallH / steps;
    const halfSteps = Math.floor(steps / 2);
    const treadD = (depth * 0.75) / halfSteps;

    for (let i = 0; i < halfSteps; i++) {
      const stepY = i * riserH;
      const stepZ = depth - (i + 1) * treadD;

      const riser = new THREE.Mesh(new THREE.BoxGeometry(flightW, riserH, 0.08), riserWhiteMat);
      riser.position.set(flightW / 2, stepY + riserH / 2, stepZ + treadD);
      riser.castShadow = true; riser.receiveShadow = true;

      const tread = new THREE.Mesh(new THREE.BoxGeometry(flightW + 0.1, 0.14, treadD + 0.12), treadWoodMat);
      tread.position.set(flightW / 2, stepY + riserH, stepZ + treadD / 2);
      tread.castShadow = true; tread.receiveShadow = true;

      const baluster = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.8), steelRailMat);
      baluster.position.set(flightW - 0.08, stepY + riserH + 1.4, stepZ + treadD / 2);
      baluster.castShadow = true;

      group.add(riser, tread, baluster);
    }

    const landingH = halfSteps * riserH;
    const landingD = depth * 0.28;
    const landing = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, landingD), treadWoodMat);
    landing.position.set(w / 2, landingH, landingD / 2);
    landing.castShadow = true; landing.receiveShadow = true;

    const landingRiser = new THREE.Mesh(new THREE.BoxGeometry(w, landingH, 0.1), riserWhiteMat);
    landingRiser.position.set(w / 2, landingH / 2, landingD);
    group.add(landing, landingRiser);

    [
      { x: flightW, y: 1.6, z: depth - treadD },
      { x: flightW, y: landingH + 1.6, z: landingD },
      { x: w - flightW, y: landingH + 1.6, z: landingD },
    ].forEach(np => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, 0.2), handrailMat);
      post.position.set(np.x, np.y, np.z);
      post.castShadow = true;
      group.add(post);
    });

    const railGeo = new THREE.CylinderGeometry(0.08, 0.08, depth * 0.85);
    const handrail1 = new THREE.Mesh(railGeo, handrailMat);
    handrail1.position.set(flightW - 0.08, landingH / 2 + 2.8, depth / 2);
    handrail1.rotation.x = -Math.atan2(landingH, depth * 0.75);
    handrail1.castShadow = true;
    group.add(handrail1);

    return group;
  };

  // 12. Potted Green Indoor Plant
  const createPottedPlant = () => {
    const group = new THREE.Group();
    const potMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.4 });

    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.45, 1.2, 16), potMat);
    pot.position.y = 0.6;
    pot.castShadow = true;
    group.add(pot);

    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), leafMat);
      leaf.scale.set(0.4, 1.2, 0.8);
      leaf.rotation.set(0.4, (i * Math.PI * 2) / 5, 0.5);
      leaf.position.set(Math.sin((i * Math.PI * 2) / 5) * 0.3, 1.6, Math.cos((i * Math.PI * 2) / 5) * 0.3);
      group.add(leaf);
    }
    return group;
  };

  useEffect(() => {
    if (!open || !mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth || 1000;
    const height = container.clientHeight || 700;

    const scene = new THREE.Scene();
    const bgColor = lightingMode === 'night' 
      ? 0x050814 
      : (lightingMode === 'sunset' ? 0x2e1d2c : 0xf1f5f9);
    scene.background = new THREE.Color(bgColor);
    sceneRef.current = scene;

    const initialFov = isWalkthrough ? 90 : 42;
    const initialNear = isWalkthrough ? 0.08 : 0.5;
    const camera = new THREE.PerspectiveCamera(initialFov, width / height, initialNear, 1000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = lightingMode === 'night' ? 0.9 : (lightingMode === 'sunset' ? 1.15 : 1.2);
    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 5;
    controls.maxDistance = 250;
    controlsRef.current = controls;

    const lightsGroup = new THREE.Group();
    lightsGroupRef.current = lightsGroup;
    scene.add(lightsGroup);

    // Calculate tight bounding box from all structural and valid objects
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;

    const structuralObjects = designObjects.filter(obj => 
      (obj.w > 0.1 || obj.h > 0.1) && 
      (obj.subType === 'wall' || obj.subType === 'pillar' || obj.type === 'structure' || 
       obj.type === 'pillar' || obj.subType.startsWith('door') || obj.subType === 'window' || 
       obj.subType.startsWith('stair') || obj.subType === 'room' || obj.type === 'shape' ||
       obj.type === 'opening')
    );

    const targetList = structuralObjects.length > 0 
      ? structuralObjects 
      : designObjects.filter(obj => obj.w > 0.1 || obj.h > 0.1);

    const allXs: number[] = [];
    const allZs: number[] = [];

    targetList.forEach(obj => {
      const rotRad = -(obj.rotation * Math.PI / 180);
      const cos = Math.cos(rotRad);
      const sin = Math.sin(rotRad);
      const w = obj.w || 1;
      const h = obj.h || 1;

      // 4 rotated corners in 3D world space (X, Z)
      const corners = [
        { lx: 0, lz: 0 },
        { lx: w, lz: 0 },
        { lx: w, lz: h },
        { lx: 0, lz: h },
      ];

      corners.forEach(c => {
        const wx = obj.x + (c.lx * cos + c.lz * sin);
        const wz = obj.y + (-c.lx * sin + c.lz * cos);
        allXs.push(wx);
        allZs.push(wz);
      });
    });

    if (allXs.length > 0) {
      if (allXs.length >= 8) {
        // Robust IQR outlier filtering to reject stray clicks at (0,0) or far outside the house
        const sortedX = [...allXs].sort((a, b) => a - b);
        const sortedZ = [...allZs].sort((a, b) => a - b);
        const q1X = sortedX[Math.floor(sortedX.length * 0.25)];
        const q3X = sortedX[Math.floor(sortedX.length * 0.75)];
        const iqrX = q3X - q1X;
        const q1Z = sortedZ[Math.floor(sortedZ.length * 0.25)];
        const q3Z = sortedZ[Math.floor(sortedZ.length * 0.75)];
        const iqrZ = q3Z - q1Z;

        const validXs = allXs.filter(x => (iqrX > 3 ? (x >= q1X - 2.5 * iqrX && x <= q3X + 2.5 * iqrX) : true));
        const validZs = allZs.filter(z => (iqrZ > 3 ? (z >= q1Z - 2.5 * iqrZ && z <= q3Z + 2.5 * iqrZ) : true));

        minX = validXs.length > 0 ? Math.min(...validXs) : Math.min(...allXs);
        maxX = validXs.length > 0 ? Math.max(...validXs) : Math.max(...allXs);
        minZ = validZs.length > 0 ? Math.min(...validZs) : Math.min(...allZs);
        maxZ = validZs.length > 0 ? Math.max(...validZs) : Math.max(...allZs);
      } else {
        minX = Math.min(...allXs);
        maxX = Math.max(...allXs);
        minZ = Math.min(...allZs);
        maxZ = Math.max(...allZs);
      }
    }

    if (!isFinite(minX) || !isFinite(minZ)) {
      minX = 0; maxX = 30; minZ = 0; maxZ = 30;
    }

    const bWidth = Math.max(maxX - minX, 10);
    const bDepth = Math.max(maxZ - minZ, 10);
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;

    boundsRef.current = { bWidth, bDepth, centerX, centerZ };

    // Dynamic Atmosphere & Natural Lighting (Day, Sunset, Night)
    const ambientColor = lightingMode === 'night' ? 0x0f172a : (lightingMode === 'sunset' ? 0x4a1d2e : 0xffffff);
    const ambientIntensity = lightingMode === 'night' ? 0.35 : (lightingMode === 'sunset' ? 0.85 : 1.35);
    const ambientLight = new THREE.AmbientLight(ambientColor, ambientIntensity);
    lightsGroup.add(ambientLight);

    const sunColor = lightingMode === 'night' ? 0x38bdf8 : (lightingMode === 'sunset' ? 0xf97316 : 0xfffaed);
    const sunIntensity = lightingMode === 'night' ? 0.25 : (lightingMode === 'sunset' ? 1.6 : 1.5);
    const sunLight = new THREE.DirectionalLight(sunColor, sunIntensity);
    sunLight.position.set(lightingMode === 'sunset' ? 25 : 5, lightingMode === 'sunset' ? 18 : 48, 6);
    sunLight.target.position.set(0, 0, 0);
    scene.add(sunLight.target);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 150;
    const shadowBound = Math.max(bWidth, bDepth) * 0.75 + 6;
    sunLight.shadow.camera.left = -shadowBound;
    sunLight.shadow.camera.right = shadowBound;
    sunLight.shadow.camera.top = shadowBound;
    sunLight.shadow.camera.bottom = -shadowBound;
    sunLight.shadow.bias = -0.0003;
    sunLight.shadow.radius = 1.6;
    lightsGroup.add(sunLight);

    const hemiSky = lightingMode === 'night' ? 0x0f172a : (lightingMode === 'sunset' ? 0x7c2d12 : 0xffffff);
    const hemiGround = lightingMode === 'night' ? 0x020617 : (lightingMode === 'sunset' ? 0x1e1b4b : 0x94a3b8);
    const hemiLight = new THREE.HemisphereLight(hemiSky, hemiGround, 0.65);
    lightsGroup.add(hemiLight);

    const wallHeight = wallHeightMode === 'full' ? 7.5 : 4.2;

    const maxDim = Math.max(bWidth, bDepth, 12);
    const dist = maxDim * 1.25;
    if (!isWalkthrough) {
      controls.enabled = true;
      camera.fov = 42;
      camera.near = 0.5;
      camera.updateProjectionMatrix();
      camera.position.set(dist * 0.72, dist * 0.85, dist * 0.72);
      controls.target.set(0, wallHeight * 0.35, 0);
      controls.update();
    } else {
      // First person eye-level camera inside the house (ground level Y ~ 3.2ft, wide 90° human FOV)
      controls.enabled = false;
      camera.fov = 90;
      camera.near = 0.08;
      camera.updateProjectionMatrix();
      const spawnZ = Math.min(bDepth * 0.2, 3);
      camera.position.set(0, 3.2, spawnZ);
      walkStateRef.current.yaw = Math.PI; // Face forward towards the center of the building (-Z)
      walkStateRef.current.pitch = -0.08; // Look slightly down to clearly see floor and walls
      walkStateRef.current.bobTimer = 0;
      walkStateRef.current.vx = 0;
      walkStateRef.current.vz = 0;
    }

    const buildingGroup = new THREE.Group();
    buildingGroup.position.set(-centerX, 0, -centerZ);
    scene.add(buildingGroup);

    const groundMat = new THREE.MeshStandardMaterial({ 
      map: createGravelTexture(), 
      roughness: 0.95 
    });
    const groundGeo = new THREE.BoxGeometry(bWidth + 14, 0.8, bDepth + 14);
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.set(centerX, -0.45, centerZ);
    ground.receiveShadow = true;
    buildingGroup.add(ground);

    const plinthMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.8 });
    const plinthGeo = new THREE.BoxGeometry(bWidth + 2.0, 0.4, bDepth + 2.0);
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.set(centerX, -0.2, centerZ);
    plinth.receiveShadow = true;
    buildingGroup.add(plinth);

    // Architectural slate plinth curb
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
    const rimThickness = 0.25;
    const rimHeight = 0.45;
    const rimW = bWidth + 2.1;
    const rimD = bDepth + 2.1;

    const rNorth = new THREE.Mesh(new THREE.BoxGeometry(rimW, rimHeight, rimThickness), rimMat);
    rNorth.position.set(centerX, 0.02, centerZ - rimD / 2);
    rNorth.castShadow = true;

    const rSouth = new THREE.Mesh(new THREE.BoxGeometry(rimW, rimHeight, rimThickness), rimMat);
    rSouth.position.set(centerX, 0.02, centerZ + rimD / 2);
    rSouth.castShadow = true;

    const rEast = new THREE.Mesh(new THREE.BoxGeometry(rimThickness, rimHeight, rimD), rimMat);
    rEast.position.set(centerX + rimW / 2, 0.02, centerZ);
    rEast.castShadow = true;

    const rWest = new THREE.Mesh(new THREE.BoxGeometry(rimThickness, rimHeight, rimD), rimMat);
    rWest.position.set(centerX - rimW / 2, 0.02, centerZ);
    rWest.castShadow = true;

    buildingGroup.add(rNorth, rSouth, rEast, rWest);

    const floorTexture = floorTextureType === 'marble' ? createMarbleTexture() : createParquetTexture();
    const floorMat = new THREE.MeshStandardMaterial({ 
      map: floorTexture, 
      roughness: floorTextureType === 'marble' ? 0.25 : 0.55,
      metalness: floorTextureType === 'marble' ? 0.15 : 0.05
    });
    const mainFloor = new THREE.Mesh(new THREE.BoxGeometry(bWidth + 0.6, 0.08, bDepth + 0.6), floorMat);
    mainFloor.position.set(centerX, 0.0, centerZ);
    mainFloor.receiveShadow = true;
    buildingGroup.add(mainFloor);

    const wallsGroup = new THREE.Group();
    wallsGroupRef.current = wallsGroup;
    buildingGroup.add(wallsGroup);

    const furnitureGroup = new THREE.Group();
    furnitureGroupRef.current = furnitureGroup;
    buildingGroup.add(furnitureGroup);

    const labelsGroup = new THREE.Group();
    labelsGroupRef.current = labelsGroup;
    buildingGroup.add(labelsGroup);

    // Day mode wall color: soft architectural light brick (হালকা ইটের রঙ), other views unchanged
    const wallMatColor = lightingMode === 'day' ? 0xd59b82 : 0xf3f4f6;
    const wallCapColor = lightingMode === 'day' ? 0xf4ece6 : 0xffffff;
    const wallMat = new THREE.MeshStandardMaterial({ color: wallMatColor, roughness: 0.82 });
    const wallCapMat = new THREE.MeshStandardMaterial({ color: wallCapColor, roughness: 0.35 });

    const openings = designObjects.filter(o => 
      o.subType.startsWith('door') || 
      o.subType === 'double-door' || 
      o.subType === 'sliding-door' || 
      o.subType === 'window' || 
      o.type === 'opening'
    );

    designObjects.forEach(obj => {
      const objPivot = new THREE.Group();
      objPivot.position.set(obj.x, 0, obj.y);
      objPivot.rotation.y = -(obj.rotation * Math.PI / 180);

      const isWall = obj.subType === 'wall' || (obj.type === 'structure' && obj.subType !== 'pillar');
      const isPillar = obj.subType === 'pillar' || obj.type === 'pillar';
      const isDoor = obj.subType.startsWith('door') || obj.subType === 'double-door' || obj.subType === 'sliding-door';
      const isWindow = obj.subType === 'window';
      const isStair = obj.subType.startsWith('stair') || obj.type === 'stair';
      const isText = obj.type === 'text' || obj.subType === 'label';

      // A. WALLS WITH PRECISE DOOR & WINDOW OPENING CUTOUTS
      if (isWall) {
        const visualThickness = Math.max(obj.h, 0.75);

        // Find all opening cuts (doors and windows) on this wall
        type WallCut = { start: number; end: number; type: 'door' | 'window' };
        const cuts: WallCut[] = [];

        openings.forEach(op => {
          let rotDiff = Math.abs((op.rotation - obj.rotation) % 180);
          if (rotDiff > 90) rotDiff = 180 - rotDiff;
          if (rotDiff > 35) return; // not parallel

          const alphaOp = -(op.rotation * Math.PI / 180);
          const cOx = op.x + (op.w / 2) * Math.cos(alphaOp) + (op.h / 2) * Math.sin(alphaOp);
          const cOz = op.y - (op.w / 2) * Math.sin(alphaOp) + (op.h / 2) * Math.cos(alphaOp);

          const dx = cOx - obj.x;
          const dz = cOz - obj.y;
          const alphaW = -(obj.rotation * Math.PI / 180);
          const localX = dx * Math.cos(alphaW) - dz * Math.sin(alphaW);
          const localZ = dx * Math.sin(alphaW) + dz * Math.cos(alphaW);

          if (Math.abs(localZ - visualThickness / 2) > 1.8) return; // not on this wall

          const halfW = op.w / 2;
          const start = Math.max(0, localX - halfW);
          const end = Math.min(obj.w, localX + halfW);

          if (end - start > 0.4) {
            const isDoorType = op.subType.startsWith('door') || op.subType === 'double-door' || op.subType === 'sliding-door';
            cuts.push({ start, end, type: isDoorType ? 'door' : 'window' });
          }
        });

        cuts.sort((a, b) => a.start - b.start);

        // Render solid segments and opening lintels
        let curX = 0;
        cuts.forEach(cut => {
          // Solid wall segment before opening
          if (cut.start > curX + 0.05) {
            const segW = cut.start - curX;
            const segBox = new THREE.Mesh(new THREE.BoxGeometry(segW, wallHeight, visualThickness), wallMat);
            segBox.position.set(curX + segW / 2, wallHeight / 2, visualThickness / 2);
            segBox.castShadow = true; segBox.receiveShadow = true;

            const segCap = new THREE.Mesh(new THREE.BoxGeometry(segW + 0.04, 0.12, visualThickness + 0.04), wallCapMat);
            segCap.position.set(curX + segW / 2, wallHeight + 0.06, visualThickness / 2);
            segCap.castShadow = true;
            objPivot.add(segBox, segCap);
          }

          // Lintel above opening (doorway/window opening is 100% open below!)
          const opW = cut.end - cut.start;
          const lintelBottom = cut.type === 'door' ? 6.8 : 6.7;
          if (wallHeight > lintelBottom) {
            const lintelH = wallHeight - lintelBottom;
            const lintelBox = new THREE.Mesh(new THREE.BoxGeometry(opW, lintelH, visualThickness), wallMat);
            lintelBox.position.set(cut.start + opW / 2, lintelBottom + lintelH / 2, visualThickness / 2);
            lintelBox.castShadow = true; lintelBox.receiveShadow = true;

            const lintelCap = new THREE.Mesh(new THREE.BoxGeometry(opW + 0.04, 0.12, visualThickness + 0.04), wallCapMat);
            lintelCap.position.set(cut.start + opW / 2, wallHeight + 0.06, visualThickness / 2);
            lintelCap.castShadow = true;
            objPivot.add(lintelBox, lintelCap);
          }

          curX = Math.max(curX, cut.end);
        });

        // Final solid wall segment after last opening
        if (curX < obj.w - 0.05) {
          const segW = obj.w - curX;
          const segBox = new THREE.Mesh(new THREE.BoxGeometry(segW, wallHeight, visualThickness), wallMat);
          segBox.position.set(curX + segW / 2, wallHeight / 2, visualThickness / 2);
          segBox.castShadow = true; segBox.receiveShadow = true;

          const segCap = new THREE.Mesh(new THREE.BoxGeometry(segW + 0.04, 0.12, visualThickness + 0.04), wallCapMat);
          segCap.position.set(curX + segW / 2, wallHeight + 0.06, visualThickness / 2);
          segCap.castShadow = true;
          objPivot.add(segBox, segCap);
        }

        wallsGroup.add(objPivot);
      }
      // B. PILLARS (লাল রঙের বাস্তব রূপ)
      else if (isPillar) {
        const redPillar = createRedPillar(obj.w, obj.h, wallHeight);
        objPivot.add(redPillar);
        wallsGroup.add(objPivot);
      }
      // C. DOORS (বাস্তব কাঠ ও প্যানেল রূপ)
      else if (isDoor) {
        const door = createRealisticDoor(obj.w, wallHeight, obj.h, obj.subType);
        objPivot.add(door);
        wallsGroup.add(objPivot);
      }
      // D. WINDOWS (বাস্তব সানশেড, গ্রিড ও কাচ রূপ)
      else if (isWindow) {
        const win = createRealisticWindow(obj.w, wallHeight, obj.h);
        objPivot.add(win);
        wallsGroup.add(objPivot);
      }
      // E. STAIRS (বাস্তব কাঠের স্টেপ, ব্যালুস্টার ও হ্যান্ডরেইল)
      else if (isStair) {
        const stair = createRealisticStaircase(obj.w, obj.h, wallHeight, obj.stepCount || 14, obj.subType);
        objPivot.add(stair);
        wallsGroup.add(objPivot);
      }

      objPivot.traverse(child => {
        child.userData = { objectId: obj.id, objectData: obj };
      });

      // F. ROOM LABELS & TEXT
      const isActualText = isText || obj.type === 'text' || obj.subType === 'label';
      if (isActualText && (obj.textContent || obj.label)) {
        const textStr = (obj.textContent || obj.label || "").trim();
        const isGenericLabel = ['wall', 'door', 'window', 'pillar', 'stair', 'd1', 'd2', 'd3', 'd4', 'win', 'dbl', 'sld'].includes(textStr.toLowerCase());
        
        if (textStr && !isGenericLabel) {
          const badge = createTextBadge(textStr, `${Math.round(obj.w)}' x ${Math.round(obj.h)}'`);
          badge.position.set(obj.x + obj.w / 2, wallHeight + 1.2, obj.y + obj.h / 2);
          labelsGroup.add(badge);

          const lower = textStr.toLowerCase();
          const rW = Math.max(8, obj.w);
          const rD = Math.max(8, obj.h);
          const cx = obj.x + obj.w / 2;
          const cz = obj.y + obj.h / 2;

          if (lower.includes('bed') || lower.includes('বেড') || lower.includes('শয়ন')) {
            const themes: ('blue' | 'emerald' | 'crimson')[] = ['blue', 'emerald', 'crimson'];
            const chosenTheme = themes[furnitureGroup.children.length % themes.length];
            const bed = createDoubleBed(6.2, 6.8, chosenTheme);
            bed.position.set(cx, 0, cz - 1.0);
            furnitureGroup.add(bed);

            const desk = createStudyDesk();
            desk.position.set(cx + Math.min(rW * 0.28, 4), 0, cz + Math.min(rD * 0.25, 3));
            furnitureGroup.add(desk);

            if (lightingMode !== 'day') {
              const bedLight = new THREE.PointLight(0xffbe76, 1.3, 16);
              bedLight.position.set(cx, 4.5, cz);
              lightsGroup.add(bedLight);
            }
          } 
          else if (lower.includes('dining') || lower.includes('drawing') || lower.includes('living') || lower.includes('ডাইনিং') || lower.includes('ড্রয়িং')) {
            const living = createLivingSofaSet(rW, rD);
            living.position.set(cx, 0, cz);
            furnitureGroup.add(living);

            if (rW > 14 || rD > 14) {
              const dining = createDiningSet();
              dining.position.set(cx - Math.min(rW * 0.28, 4), 0, cz);
              furnitureGroup.add(dining);
            }

            if (lightingMode !== 'day') {
              const warmL = new THREE.PointLight(0xffd180, 1.4, 20);
              warmL.position.set(cx, 5.0, cz);
              lightsGroup.add(warmL);
            }
          } 
          else if (lower.includes('kitchen') || lower.includes('রান্না') || lower.includes('পাক')) {
            const kitchen = createKitchenUnit(rW, rD);
            kitchen.position.set(cx, 0, cz);
            furnitureGroup.add(kitchen);
          } 
          else if (lower.includes('bath') || lower.includes('toilet') || lower.includes('বাথরুম') || lower.includes('টয়লেট') || lower.includes('গোসল')) {
            const bathTileMat = new THREE.MeshStandardMaterial({ map: createTileTexture(), roughness: 0.3 });
            const tileFloor = new THREE.Mesh(new THREE.BoxGeometry(obj.w * 0.95, 0.08, obj.h * 0.95), bathTileMat);
            tileFloor.position.set(cx, 0.04, cz);
            tileFloor.receiveShadow = true;
            buildingGroup.add(tileFloor);

            const bath = createBathroomUnit();
            bath.position.set(cx, 0, cz);
            furnitureGroup.add(bath);
          } 
          else if (lower.includes('mandir') || lower.includes('মন্দির') || lower.includes('prayer') || lower.includes('পূজা') || lower.includes('নামাজ')) {
            const mandir = createMandirAltar();
            mandir.position.set(cx, 0, cz);
            furnitureGroup.add(mandir);

            if (lightingMode !== 'day') {
              const spot = new THREE.PointLight(lightingMode === 'night' ? 0xfef08a : 0xfdba74, lightingMode === 'night' ? 2.5 : 1.8, 16);
              spot.position.set(cx, 6.0, cz);
              spot.castShadow = true;
              spot.shadow.bias = -0.002;
              lightsGroup.add(spot);
            }
          }
        }
      }
    });

    // Walkthrough keyboard & mouse controls
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = walkStateRef.current.keys;
      if (e.code === 'KeyW' || e.code === 'ArrowUp') k.forward = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') k.backward = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') k.left = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') k.right = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = walkStateRef.current.keys;
      if (e.code === 'KeyW' || e.code === 'ArrowUp') k.forward = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') k.backward = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') k.left = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') k.right = false;
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (!isWalkthrough) return;
      walkStateRef.current.isMouseDown = true;
      walkStateRef.current.prevMouseX = e.clientX;
      walkStateRef.current.prevMouseY = e.clientY;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isWalkthrough || !walkStateRef.current.isMouseDown) return;
      const dx = e.clientX - walkStateRef.current.prevMouseX;
      const dy = e.clientY - walkStateRef.current.prevMouseY;
      walkStateRef.current.prevMouseX = e.clientX;
      walkStateRef.current.prevMouseY = e.clientY;

      walkStateRef.current.yaw -= dx * 0.003;
      // Allow looking down to the floor or looking up clearly
      walkStateRef.current.pitch = Math.max(-Math.PI / 2.4, Math.min(Math.PI / 2.4, walkStateRef.current.pitch - dy * 0.003));
    };

    const handleMouseUp = () => {
      walkStateRef.current.isMouseDown = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    const canvasDom = renderer.domElement;
    canvasDom.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      if (isWalkthrough && cameraRef.current) {
        const cam = cameraRef.current;
        const ws = walkStateRef.current;

        const forward = new THREE.Vector3(Math.sin(ws.yaw), 0, -Math.cos(ws.yaw)).normalize();
        const side = new THREE.Vector3(forward.z, 0, -forward.x).normalize();

        let moveX = 0;
        let moveZ = 0;
        const isMoving = ws.keys.forward || ws.keys.backward || ws.keys.left || ws.keys.right;

        if (ws.keys.forward) { moveX += forward.x; moveZ += forward.z; }
        if (ws.keys.backward) { moveX -= forward.x; moveZ -= forward.z; }
        if (ws.keys.left) { moveX += side.x; moveZ += side.z; }
        if (ws.keys.right) { moveX -= side.x; moveZ -= side.z; }

        const moveLen = Math.hypot(moveX, moveZ);
        if (moveLen > 0) {
          moveX /= moveLen;
          moveZ /= moveLen;
        }

        const targetSpeed = 0.22;
        ws.vx = THREE.MathUtils.lerp(ws.vx, moveX * targetSpeed, 0.2);
        ws.vz = THREE.MathUtils.lerp(ws.vz, moveZ * targetSpeed, 0.2);

        cam.position.x += ws.vx;
        cam.position.z += ws.vz;

        // Bounding box clamp: keep user securely on the floor inside the building
        const halfW = Math.max(2, bWidth / 2 - 1.2);
        const halfD = Math.max(2, bDepth / 2 - 1.2);
        cam.position.x = Math.max(-halfW, Math.min(halfW, cam.position.x));
        cam.position.z = Math.max(-halfD, Math.min(halfD, cam.position.z));

        // Subtle step bobbing for realistic walking sensation on floor
        if (isMoving) {
          ws.bobTimer += 0.16;
        } else {
          ws.bobTimer = THREE.MathUtils.lerp(ws.bobTimer, 0, 0.1);
        }
        const bobbing = Math.sin(ws.bobTimer) * 0.04;
        cam.position.y = 3.2 + bobbing;

        const targetLook = cam.position.clone().add(new THREE.Vector3(
          Math.sin(ws.yaw) * Math.cos(ws.pitch),
          Math.sin(ws.pitch),
          -Math.cos(ws.yaw) * Math.cos(ws.pitch)
        ));
        cam.lookAt(targetLook);
      } else if (controlsRef.current) {
        controlsRef.current.update();
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      canvasDom.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      controls.dispose();
      renderer.dispose();
    };
  }, [open, designObjects, lightingMode, floorTextureType, isWalkthrough, wallHeightMode, createMarbleTexture, createParquetTexture, createTileTexture, createGravelTexture, createTextBadge]);

  useEffect(() => {
    if (furnitureGroupRef.current) {
      furnitureGroupRef.current.visible = showFurniture;
    }
  }, [showFurniture]);

  useEffect(() => {
    if (labelsGroupRef.current) {
      labelsGroupRef.current.visible = showLabels;
    }
  }, [showLabels]);

  const setCameraView = (view: 'iso' | 'top' | 'front' | 'side') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    setCurrentView(view);

    const { bWidth, bDepth } = boundsRef.current;
    const maxDim = Math.max(bWidth, bDepth, 12);
    const wallH = wallHeightMode === 'full' ? 7.5 : 4.2;

    if (view === 'iso') {
      const dist = maxDim * 1.25;
      camera.up.set(0, 1, 0);
      camera.position.set(dist * 0.72, dist * 0.85, dist * 0.72);
      controls.target.set(0, wallH * 0.35, 0);
    } else if (view === 'top') {
      const dist = maxDim * 1.2;
      camera.up.set(0, 0, -1);
      camera.position.set(0.001, dist * 1.35, 0.001);
      controls.target.set(0, 0, 0);
    } else if (view === 'front') {
      const dist = maxDim * 1.25;
      camera.up.set(0, 1, 0);
      camera.position.set(0, dist * 0.45, dist * 1.15);
      controls.target.set(0, wallH * 0.4, 0);
    } else if (view === 'side') {
      const dist = maxDim * 1.25;
      camera.up.set(0, 1, 0);
      camera.position.set(dist * 1.15, dist * 0.45, 0);
      controls.target.set(0, wallH * 0.4, 0);
    }
    controls.update();
  };

  const handleDownloadSnapshot = () => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    setIsCapturing(true);

    try {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      const dataUrl = rendererRef.current.domElement.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.download = `${projectName}_3D_View.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("3D snapshot export error:", e);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "p-0 bg-slate-950 border-slate-800 text-white flex flex-col overflow-hidden transition-all duration-300 z-50",
        isFullscreen 
          ? "fixed inset-0 w-screen h-screen max-w-none max-h-none rounded-none" 
          : "w-[96vw] max-w-[1400px] h-[90vh] max-h-[900px] rounded-2xl shadow-2xl border"
      )}>
        <div className="h-14 bg-slate-900/90 border-b border-slate-800 px-4 flex items-center justify-between shrink-0 backdrop-blur-md z-20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-amber-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-sm md:text-base font-black text-white tracking-wide">
                  {projectName} - প্রিমিয়াম ৩ডি ভিউ
                </DialogTitle>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Ultra 3D
                </span>
              </div>
              <DialogDescription className="text-[11px] text-slate-400">
                বাস্তবধর্মী আর্কিটেকচারাল আইসোমেট্রিক কাটঅ্যাওয়ে প্ল্যান
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadSnapshot}
              disabled={isCapturing}
              className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white border-0 font-bold text-xs gap-1.5 shadow-md shadow-emerald-900/30"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{isCapturing ? "সেভ হচ্ছে..." : "3D ছবি ডাউনলোড"}</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-8 w-8 text-slate-300 hover:text-white hover:bg-slate-800"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 text-slate-300 hover:text-white hover:bg-red-500/20 hover:text-red-400"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 relative w-full h-full overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950">
          <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

          <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 shadow-xl backdrop-blur-md">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCameraView('iso')}
              className={cn(
                "h-7 text-xs px-2.5 font-bold transition-all",
                currentView === 'iso' ? "bg-blue-600 text-white shadow-sm hover:bg-blue-500" : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              আইসোমেট্রিক
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCameraView('top')}
              className={cn(
                "h-7 text-xs px-2.5 font-bold transition-all",
                currentView === 'top' ? "bg-blue-600 text-white shadow-sm hover:bg-blue-500" : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              টপ-ডাউন
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCameraView('front')}
              className={cn(
                "h-7 text-xs px-2.5 font-bold transition-all",
                currentView === 'front' ? "bg-blue-600 text-white shadow-sm hover:bg-blue-500" : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              সামনে
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCameraView('side')}
              className={cn(
                "h-7 text-xs px-2.5 font-bold transition-all",
                currentView === 'side' ? "bg-blue-600 text-white shadow-sm hover:bg-blue-500" : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              ডানে
            </Button>
            <div className="w-px h-5 bg-slate-700 mx-0.5" />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCameraView('iso')}
              className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-800"
              title="রিসেট ক্যামেরা"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* ========== Direct 3D Studio CAD Toolbar ========== */}
          {isStudioMode && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-slate-900/95 border border-cyan-500/30 rounded-2xl px-2 py-1.5 shadow-2xl backdrop-blur-md">
              {[
                { key: 'select', label: 'Select', icon: '\u2B1C' },
                { key: 'wall', label: 'Wall', icon: '\u25AC' },
                { key: 'pillar', label: 'Pillar', icon: '\u25A0' },
                { key: 'beam', label: 'Beam', icon: '\u2501' },
                { key: 'room', label: 'Room', icon: '\u25A1' },
                { key: 'door', label: 'Door', icon: '\uD83D\uDEAA' },
                { key: 'window', label: 'Window', icon: '\u25A6' },
                { key: 'stair', label: 'Stair', icon: '\u2261' },
                { key: 'slab', label: 'Slab', icon: '\u25AC\u25AC' },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setActive3DTool(t.key)}
                  title={t.label}
                  className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-bold transition-all ${active3DTool === t.key ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/40' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                >
                  <span className="text-base leading-none">{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
              <div className="w-px h-8 bg-slate-700 mx-1" />
              <button onClick={undoStudio} title="Undo" className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition-all">
                <span className="text-base leading-none">\u21A9</span>
                <span>Undo</span>
              </button>
              <button onClick={redoStudio} title="Redo" className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition-all">
                <span className="text-base leading-none">\u21AA</span>
                <span>Redo</span>
              </button>
              {onSave && (
                <>
                  <div className="w-px h-8 bg-slate-700 mx-1" />
                  <button onClick={onSave} title="Save" className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/20 transition-all">
                    <span className="text-base leading-none">💾</span>
                    <span>Save</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* Studio Toast */}
          {studioToast && (
            <div className="absolute top-32 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 border border-cyan-500/40 text-cyan-300 text-xs font-bold px-4 py-2 rounded-xl shadow-xl backdrop-blur-md animate-pulse">
              {studioToast}
            </div>
          )}


          <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
            <div className="flex flex-col gap-1 bg-slate-900/85 p-1.5 rounded-xl border border-slate-800 shadow-xl backdrop-blur-md">
              {/* Walkthrough Mode Toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsWalkthrough(!isWalkthrough)}
                className={cn(
                  "h-8 text-xs px-2.5 font-bold justify-start gap-2 border transition-all",
                  isWalkthrough 
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-900/40" 
                    : "text-slate-200 border-slate-700 hover:bg-slate-800"
                )}
              >
                <Footprints className="w-4 h-4 text-emerald-400" />
                <span>{isWalkthrough ? "ওয়াকথ্রু মোড (চালু)" : "FPS ওয়াকথ্রু (হাঁটুন)"}</span>
              </Button>

              {/* Floor Texture Toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFloorTextureType(floorTextureType === 'marble' ? 'wood' : 'marble')}
                className="h-7 text-xs px-2.5 font-bold justify-start gap-2 text-slate-200 hover:bg-slate-800"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>মেঝে: {floorTextureType === 'marble' ? "ইতালিয়ান মার্বেল" : "উডেন পারকেট"}</span>
              </Button>

              <div className="w-full h-px bg-slate-800 my-0.5" />

              {/* Lighting Mode Selector (Day, Sunset, Night) */}
              <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-lg border border-slate-800">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLightingMode('day')}
                  className={cn(
                    "h-6 text-[11px] px-2 font-bold flex-1",
                    lightingMode === 'day' ? "bg-amber-500/20 text-amber-300 font-black" : "text-slate-400 hover:text-white"
                  )}
                >
                  <SunMedium className="w-3 h-3 mr-1 text-amber-400" />
                  দিন
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLightingMode('sunset')}
                  className={cn(
                    "h-6 text-[11px] px-2 font-bold flex-1",
                    lightingMode === 'sunset' ? "bg-orange-500/20 text-orange-400 font-black" : "text-slate-400 hover:text-white"
                  )}
                >
                  <Sunset className="w-3 h-3 mr-1 text-orange-400" />
                  গোধূলি
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLightingMode('night')}
                  className={cn(
                    "h-6 text-[11px] px-2 font-bold flex-1",
                    lightingMode === 'night' ? "bg-indigo-500/20 text-indigo-300 font-black" : "text-slate-400 hover:text-white"
                  )}
                >
                  <Moon className="w-3 h-3 mr-1 text-indigo-300" />
                  রাত
                </Button>
              </div>

              <div className="w-full h-px bg-slate-800 my-0.5" />

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFurniture(!showFurniture)}
                className={cn(
                  "h-7 text-xs px-2.5 font-bold justify-start gap-2",
                  showFurniture ? "text-indigo-400 bg-indigo-500/10" : "text-slate-400"
                )}
              >
                <Box className="w-3.5 h-3.5" />
                <span>আসবাবপত্র</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLabels(!showLabels)}
                className={cn(
                  "h-7 text-xs px-2.5 font-bold justify-start gap-2",
                  showLabels ? "text-cyan-400 bg-cyan-500/10" : "text-slate-400"
                )}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>রুমের নাম</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setWallHeightMode(wallHeightMode === 'full' ? 'half' : 'full')}
                className="h-7 text-xs px-2.5 font-bold justify-start gap-2 text-slate-200 hover:bg-slate-800"
              >
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>দেয়াল: {wallHeightMode === 'full' ? "উঁচু (7.5')" : "নিচু (4.2')"}</span>
              </Button>
            </div>
          </div>

          <div className="absolute bottom-6 right-6 z-20 pointer-events-none select-none">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <div className="absolute w-24 h-0.5 bg-slate-800" />
              <div className="absolute h-24 w-0.5 bg-slate-800" />
              <div className="w-3 h-3 rounded-full bg-slate-900 border-2 border-slate-700 z-10" />

              <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-[11px] font-black text-slate-500 tracking-wider">
                পশ্চিম দিক
              </div>
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[11px] font-black text-slate-500 tracking-wider">
                পূর্ব দিক
              </div>
              <div className="absolute top-1/2 -left-3 -translate-y-1/2 -rotate-90 text-[11px] font-black text-slate-500 tracking-wider">
                দক্ষিণ দিক
              </div>
              <div className="absolute top-1/2 -right-3 -translate-y-1/2 rotate-90 text-[11px] font-black text-slate-500 tracking-wider">
                উত্তর দিক
              </div>
            </div>
          </div>

          {/* First-Person Walkthrough Center Reticle / Crosshair */}
          {isWalkthrough && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
              <div className="relative flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white/80 shadow-md ring-1 ring-black/40" />
                <div className="absolute w-6 h-[1.5px] bg-white/40" />
                <div className="absolute h-6 w-[1.5px] bg-white/40" />
              </div>
            </div>
          )}

          <div className="absolute bottom-4 left-4 z-20 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {isWalkthrough ? (
              <>
                <div className="bg-slate-900/95 px-3.5 py-2.5 rounded-xl border border-emerald-500/40 backdrop-blur-md text-xs text-white shadow-xl flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <div>
                    <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                      <Footprints className="w-4 h-4" />
                      <span>মেঝের উপর ওয়াকথ্রু (উচ্চতা ৩.৬ ফুট)</span>
                    </div>
                    <div className="text-[11px] text-slate-300">
                      <span className="font-mono font-bold text-amber-300">W/A/S/D</span> বা কীবোর্ড এরো চেপে হাঁটুন • মাউস টেনে দেখুন
                    </div>
                  </div>
                </div>

                {/* Virtual Touch / Mouse Walking D-pad */}
                <div className="bg-slate-900/95 p-1.5 rounded-xl border border-slate-800 shadow-xl backdrop-blur-md flex items-center gap-1">
                  <div className="grid grid-cols-3 gap-1">
                    <div />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 w-7 p-0 bg-slate-800 hover:bg-emerald-600 text-white border-slate-700 active:scale-95 transition-all"
                      title="সামনে চলুন"
                      onMouseDown={() => { walkStateRef.current.keys.forward = true; }}
                      onMouseUp={() => { walkStateRef.current.keys.forward = false; }}
                      onTouchStart={() => { walkStateRef.current.keys.forward = true; }}
                      onTouchEnd={() => { walkStateRef.current.keys.forward = false; }}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </Button>
                    <div />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 w-7 p-0 bg-slate-800 hover:bg-emerald-600 text-white border-slate-700 active:scale-95 transition-all"
                      title="বামে চলুন"
                      onMouseDown={() => { walkStateRef.current.keys.left = true; }}
                      onMouseUp={() => { walkStateRef.current.keys.left = false; }}
                      onTouchStart={() => { walkStateRef.current.keys.left = true; }}
                      onTouchEnd={() => { walkStateRef.current.keys.left = false; }}
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 w-7 p-0 bg-slate-800 hover:bg-emerald-600 text-white border-slate-700 active:scale-95 transition-all"
                      title="পেছনে চলুন"
                      onMouseDown={() => { walkStateRef.current.keys.backward = true; }}
                      onMouseUp={() => { walkStateRef.current.keys.backward = false; }}
                      onTouchStart={() => { walkStateRef.current.keys.backward = true; }}
                      onTouchEnd={() => { walkStateRef.current.keys.backward = false; }}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 w-7 p-0 bg-slate-800 hover:bg-emerald-600 text-white border-slate-700 active:scale-95 transition-all"
                      title="ডানে চলুন"
                      onMouseDown={() => { walkStateRef.current.keys.right = true; }}
                      onMouseUp={() => { walkStateRef.current.keys.right = false; }}
                      onTouchStart={() => { walkStateRef.current.keys.right = true; }}
                      onTouchEnd={() => { walkStateRef.current.keys.right = false; }}
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800 backdrop-blur-sm text-[11px] text-slate-400 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>মাউস টেনে ঘোরান (Rotate) • স্ক্রল করে জুম (Zoom) • রাইট-ক্লিকে প্যান (Pan)</span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

