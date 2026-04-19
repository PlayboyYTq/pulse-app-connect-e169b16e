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
 * Throws on failure; caller should wrap with try/catch + toast.
 */
export async function uploadAttachment(file: File, userId: string): Promise<UploadResult> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error("File is larger than the 25MB limit.");
  }
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("chat-attachments").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("chat-attachments").getPublicUrl(path);
  return { url: data.publicUrl, kind: detectKind(file), filename: file.name };
}
