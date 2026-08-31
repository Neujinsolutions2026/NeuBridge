import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { NewClientContactForm } from "./NewClientContactForm";

export default async function NewClientContactPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) notFound();

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-lg font-semibold text-gray-900">New Contact for {company.name}</h1>
      <p className="mt-1 text-sm text-gray-500">
        Adds another client login for this company - useful when different projects need different points of
        contact. Share these credentials with the client.
      </p>

      <NewClientContactForm companyId={company.id} />
    </div>
  );
}
