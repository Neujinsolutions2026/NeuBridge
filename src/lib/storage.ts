import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { put } from "@vercel/blob";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
// Local disk only survives on a server with a persistent filesystem (dev,
// or a VPS) - on Vercel's serverless functions it's wiped between requests.
// Vercel Blob is used automatically once a Blob store is connected (which
// injects this token) so this same code works in both environments without
// a separate prod/dev code path to keep in sync.
const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

export async function saveUploadedFile(file: File): Promise<{ filePath: string; fileName: string }> {
  const ext = path.extname(file.name);
  const storedName = `${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  if (useBlob) {
    const blob = await put(storedName, buffer, { access: "public", addRandomSuffix: false });
    return { filePath: blob.url, fileName: file.name };
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, storedName), buffer);
  return { filePath: storedName, fileName: file.name };
}

// filePath is either a Blob URL (production) or a local filename (dev) -
// the download route stays the single, authenticated place either kind of
// file is ever read from, so callers don't need to know which storage is
// backing it.
export async function readStoredFile(filePath: string): Promise<Buffer> {
  if (/^https?:\/\//.test(filePath)) {
    const res = await fetch(filePath);
    if (!res.ok) throw new Error(`Failed to fetch stored file: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  const safeName = path.basename(filePath);
  return readFile(path.join(UPLOAD_DIR, safeName));
}
