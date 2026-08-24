import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getStore } from "@netlify/blobs";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
// Local disk only survives on a server with a persistent filesystem (dev,
// or a VPS) - Netlify Functions don't keep one between requests. Netlify
// sets NETLIFY=true in every one of its build/runtime environments, and
// getStore() auto-detects credentials there with no extra config - so this
// same code works in both environments without a separate prod/dev path.
const useBlobStore = process.env.NETLIFY === "true";

function attachmentsStore() {
  return getStore({ name: "attachments", consistency: "strong" });
}

export async function saveUploadedFile(file: File): Promise<{ filePath: string; fileName: string }> {
  const ext = path.extname(file.name);
  const storedName = `${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  if (useBlobStore) {
    await attachmentsStore().set(storedName, new Blob([buffer]));
    return { filePath: storedName, fileName: file.name };
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, storedName), buffer);
  return { filePath: storedName, fileName: file.name };
}

export async function readStoredFile(filePath: string): Promise<Buffer> {
  if (useBlobStore) {
    const data = await attachmentsStore().get(filePath, { type: "arrayBuffer" });
    if (!data) throw new Error(`Stored file not found: ${filePath}`);
    return Buffer.from(data);
  }

  const safeName = path.basename(filePath);
  return readFile(path.join(UPLOAD_DIR, safeName));
}
