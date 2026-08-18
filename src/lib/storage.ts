import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function saveUploadedFile(file: File): Promise<{ filePath: string; fileName: string }> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(file.name);
  const storedName = `${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, storedName), buffer);
  return { filePath: storedName, fileName: file.name };
}

export async function readStoredFile(filePath: string): Promise<Buffer> {
  const safeName = path.basename(filePath);
  return readFile(path.join(UPLOAD_DIR, safeName));
}
