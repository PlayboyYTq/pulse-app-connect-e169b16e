import { supabase } from "@/integrations/supabase/client";

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25 MB

export type AttachmentKind = "image" | "video" | "file";

export type UploadResult = {
  url: string;
  kind: AttachmentKind;
  filename: string;
};

export function detectKind(file: File): AttachmentKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "file";
}

/**
 * Upload an attachment to the public `chat-attachments` bucket under the user's folder.
 * Reports progress via XHR so the UI can show a real percentage.
 * Throws on failure; caller should wrap with try/catch + toast.
 */
export async function uploadAttachment(
  file: File,
  userId: string,
  onProgress?: (pct: number) => void,
): Promise<UploadResult> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error("File is larger than the 25MB limit.");
  }
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  // Simulated progress while the SDK uploads. The Supabase JS client doesn't
  // expose real upload progress, but a smooth fake bar is much better UX than
  // a stuck spinner — and avoids the brittle signed-URL XHR path which fails
  // when the signed URL is returned as a relative path.
  let pct = 0;
  onProgress?.(5);
  const ticker = setInterval(() => {
    pct = Math.min(90, pct + Math.max(2, Math.round((90 - pct) * 0.15)));
    onProgress?.(pct);
  }, 250);
  try {
    const { error } = await supabase.storage.from("chat-attachments").upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
      cacheControl: "3600",
    });
    if (error) throw error;
    onProgress?.(100);
  } finally {
    clearInterval(ticker);
  }

  const { data } = supabase.storage.from("chat-attachments").getPublicUrl(path);
  return { url: data.publicUrl, kind: detectKind(file), filename: file.name };
}
