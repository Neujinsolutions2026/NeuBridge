import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { put, get } from "@vercel/blob";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
// Local disk only survives on a server with a persistent filesystem (dev,
// or a VPS) - on Vercel's serverless functions it's wiped between requests.
// Vercel Blob is used automatically once a Blob store is connected (which
// injects this token) so this same code works in both environments without
// a separate prod/dev code path to keep in sync. The store is private, so
// reads go through the SDK's authenticated get() rather than a bare URL -
// this matches the download route being the one authenticated place these
// files are ever read from.
const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

export async function saveUploadedFile(file: File): Promise<{ filePath: string; fileName: string }> {
  const ext = path.extname(file.name);
  const storedName = `${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  if (useBlob) {
    await put(storedName, buffer, { access: "private", addRandomSuffix: false });
    return { filePath: storedName, fileName: file.name };
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, storedName), buffer);
  return { filePath: storedName, fileName: file.name };
}

export async function readStoredFile(filePath: string): Promise<Buffer> {
  if (useBlob) {
    const result = await get(filePath, { access: "private" });
    if (!result) throw new Error(`Stored file not found: ${filePath}`);
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  }

  const safeName = path.basename(filePath);
  return readFile(path.join(UPLOAD_DIR, safeName));
}
