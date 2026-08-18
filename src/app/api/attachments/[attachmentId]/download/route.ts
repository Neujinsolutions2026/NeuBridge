import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/authz";
import { readStoredFile } from "@/lib/storage";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ attachmentId: string }> }) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { attachmentId } = await params;

  const attachment = await prisma.messageAttachment.findUnique({
    where: { id: attachmentId },
    include: {
      message: {
        include: { project: { include: { members: { select: { userId: true } } } } },
      },
    },
  });
  if (!attachment) return new NextResponse("Not found", { status: 404 });

  if (!canAccessProject(session, attachment.message.project)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const buffer = await readStoredFile(attachment.filePath);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${attachment.fileName}"`,
    },
  });
}
