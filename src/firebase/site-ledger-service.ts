import { 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { initializeFirebase } from "./index";

export interface MaterialInflowItem {
  id: string;
  date: string;
  material: string;
  quantity: number;
  unit: string;
  challanNo: string;
  cost: number;
}

export interface LaborAttendanceItem {
  id: string;
  date: string;
  trade: string;
  workerCount: number;
  dailyRate: number;
  totalWage: number;
  supervisor: string;
}

export interface SiteLedgerData {
  materials: MaterialInflowItem[];
  labor: LaborAttendanceItem[];
  projectName: string;
  savedAt?: string;
  updatedAt?: unknown;
}

/**
 * Save site ledger (materials + labor) to Firebase Firestore
 * Collection: site_ledgers / {userId}_{designId}
 */
export async function saveSiteLedger(
  userId: string,
  designId: string,
  data: SiteLedgerData
): Promise<void> {
  const { firestore } = initializeFirebase();
  const docId = `${userId}_${designId}`;
  const ledgerDoc = doc(firestore, "site_ledgers", docId);

  await setDoc(ledgerDoc, {
    ...data,
    userId,
    designId,
    updatedAt: serverTimestamp(),
    savedAt: new Date().toISOString()
  }, { merge: true });
}

/**
 * Load site ledger from Firebase Firestore
 * Returns null if not found
 */
export async function loadSiteLedger(
  userId: string,
  designId: string
): Promise<SiteLedgerData | null> {
  try {
    const { firestore } = initializeFirebase();
    const docId = `${userId}_${designId}`;
    const ledgerDoc = doc(firestore, "site_ledgers", docId);
    const snap = await getDoc(ledgerDoc);

    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      materials: d.materials || [],
      labor: d.labor || [],
      projectName: d.projectName || "",
      savedAt: d.savedAt || ""
    };
  } catch (error) {
    console.error("Firestore load error:", error);
    return null;
  }
}

