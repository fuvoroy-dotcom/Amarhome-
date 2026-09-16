import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  where, 
  serverTimestamp 
} from "firebase/firestore";
import { initializeFirebase } from "./index";

export interface SnapshotItem {
  id: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  timeCreated?: string;
  fullPath: string;
  format?: "png" | "pdf";
  storageProvider: "cloud_firestore";
}

/**
 * Compress and optimize canvas snapshot to fit easily within cloud database limits
 */
async function compressSnapshotImage(dataUrl: string, maxWidth = 1000, quality = 0.8): Promise<string> {
  if (typeof window === "undefined") return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > maxWidth) {
        h = Math.round((h * maxWidth) / w);
        w = maxWidth;
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Save snapshot image directly to Firebase Cloud Database (Instant, Reliable, No Freezing)
 */
export async function uploadDesignSnapshot(
  userId: string, 
  designId: string, 
  dataUrl: string, 
  fileName?: string
): Promise<{ downloadUrl: string; path: string; provider: "cloud_firestore" }> {
  const { firestore } = initializeFirebase();
  const timestamp = Date.now();
  const name = fileName || `snapshot_${timestamp}.png`;
  const docId = `snap_${timestamp}_${Math.random().toString(36).substr(2, 6)}`;

  // Optimize image
  const optimizedImage = await compressSnapshotImage(dataUrl);

  const snapshotDoc = doc(firestore, "user_snapshots", docId);
  await setDoc(snapshotDoc, {
    id: docId,
    userId,
    designId,
    name,
    url: optimizedImage,
    thumbnailUrl: optimizedImage,
    format: "png",
    provider: "cloud_firestore",
    createdAt: serverTimestamp(),
    timestamp
  });

  return { 
    downloadUrl: optimizedImage, 
    path: `user_snapshots/${docId}`, 
    provider: "cloud_firestore" 
  };
}

/**
 * Save export PDF or document blob to Firebase Cloud
 */
export async function uploadExportBlob(
  userId: string, 
  designId: string, 
  blob: Blob, 
  fileName: string,
  previewThumbnail?: string
): Promise<{ downloadUrl: string; path: string; provider: "cloud_firestore" }> {
  const { firestore } = initializeFirebase();
  const timestamp = Date.now();
  const docId = `export_${timestamp}_${Math.random().toString(36).substr(2, 6)}`;

  // Convert blob to base64 dataUrl
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const snapshotDoc = doc(firestore, "user_snapshots", docId);
  await setDoc(snapshotDoc, {
    id: docId,
    userId,
    designId,
    name: fileName,
    url: dataUrl,
    thumbnailUrl: previewThumbnail || "",
    format: "pdf",
    provider: "cloud_firestore",
    createdAt: serverTimestamp(),
    timestamp
  });

  return { 
    downloadUrl: dataUrl, 
    path: `user_snapshots/${docId}`, 
    provider: "cloud_firestore" 
  };
}

/**
 * List all saved snapshots for a user
 */
export async function listUserSnapshots(userId: string): Promise<SnapshotItem[]> {
  try {
    const { firestore } = initializeFirebase();
    const snapshotsCol = collection(firestore, "user_snapshots");
    
    const q = query(snapshotsCol, where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    
    const items: SnapshotItem[] = querySnapshot.docs.map((docSnap) => {
      const d = docSnap.data();
      let timeStr = "";
      if (d.createdAt?.toDate) {
        timeStr = d.createdAt.toDate().toISOString();
      } else if (d.timestamp) {
        timeStr = new Date(d.timestamp).toISOString();
      }
      return {
        id: docSnap.id,
        name: d.name || "স্ন্যাপশট",
        url: d.url || "",
        thumbnailUrl: d.thumbnailUrl || d.url || "",
        timeCreated: timeStr,
        fullPath: docSnap.id,
        format: (d.format as "png" | "pdf") || (d.name?.endsWith(".pdf") ? "pdf" : "png"),
        storageProvider: "cloud_firestore"
      };
    });

    return items.sort((a, b) => (b.timeCreated || "").localeCompare(a.timeCreated || ""));
  } catch (error) {
    console.error("Error listing user snapshots from cloud:", error);
    return [];
  }
}

/**
 * Delete a snapshot from Cloud
 */
export async function deleteStorageFile(item: SnapshotItem): Promise<void> {
  const { firestore } = initializeFirebase();
  if (item.id) {
    await deleteDoc(doc(firestore, "user_snapshots", item.id));
  }
}
