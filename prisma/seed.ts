import { PrismaClient, Role, ProjectStatus, TaskStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@neubridge.com" },
    update: {},
    create: {
      name: "Neujin Solutions Admin",
      email: "admin@neubridge.com",
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const pm = await prisma.user.upsert({
    where: { email: "pm@neubridge.com" },
    update: {},
    create: {
      name: "Neujin Solutions Team",
      email: "pm@neubridge.com",
      passwordHash,
      role: Role.INTERNAL,
    },
  });

  // A second Internal user assigned to only one project, to demonstrate
  // that Internal accounts only see/work on projects they're assigned to.
  const jane = await prisma.user.upsert({
    where: { email: "jane@neubridge.com" },
    update: {},
    create: {
      name: "Jane Doe",
      email: "jane@neubridge.com",
      passwordHash,
      role: Role.INTERNAL,
    },
  });

  const company = await prisma.company.upsert({
    where: { id: "acme-medical" },
    update: {},
    create: {
      id: "acme-medical",
      name: "Acme Medical Ltd.",
    },
  });

  const client = await prisma.user.upsert({
    where: { email: "john.smith@acmemedical.com" },
    update: {},
    create: {
      name: "John Smith",
      email: "john.smith@acmemedical.com",
      passwordHash,
      role: Role.CLIENT,
      companyId: company.id,
    },
  });

  const projectsData = [
    {
      code: "NS-2026-014",
      name: "EU MDR Technical Documentation",
      description: "Preparation of Technical Documentation as per EU MDR requirements.",
      status: ProjectStatus.IN_PROGRESS,
      progress: 65,
      startDate: new Date("2026-02-01"),
      dueDate: new Date("2026-09-15"),
    },
    {
      code: "NS-2026-013",
      name: "ISO 13485 QMS Implementation",
      description: "Implementation of a Quality Management System per ISO 13485.",
      status: ProjectStatus.IN_PROGRESS,
      progress: 40,
      startDate: new Date("2026-03-01"),
      dueDate: new Date("2026-08-30"),
    },
    {
      code: "NS-2026-010",
      name: "IVDR Technical File Review",
      description: "Review of technical file for IVDR compliance.",
      status: ProjectStatus.IN_PROGRESS,
      progress: 30,
      startDate: new Date("2026-04-01"),
      dueDate: new Date("2026-10-10"),
    },
    {
      code: "NS-2026-007",
      name: "US FDA 510(k) Submission",
      description: "Preparation and submission of FDA 510(k) application.",
      status: ProjectStatus.COMPLETED,
      progress: 100,
      startDate: new Date("2026-01-01"),
      dueDate: new Date("2026-07-05"),
    },
    {
      code: "NS-2026-003",
      name: "Clinical Evaluation Support",
      description: "Support for clinical evaluation report preparation.",
      status: ProjectStatus.ON_HOLD,
      progress: 15,
      startDate: new Date("2026-01-15"),
      dueDate: new Date("2026-09-25"),
    },
  ];

  for (const p of projectsData) {
    // code is no longer unique, so upsert-by-code isn't available - find the
    // seeded project by code instead (fine here since seed data uses
    // distinct codes), and create it if this is the first run.
    const existingProject = await prisma.project.findFirst({ where: { code: p.code } });
    const project =
      existingProject ??
      (await prisma.project.create({
        data: {
          ...p,
          companyId: company.id,
        },
      }));

    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId: pm.id } },
      update: {},
      create: { projectId: project.id, userId: pm.id },
    });

    if (p.code === "NS-2026-014") {
      await prisma.projectMember.upsert({
        where: { projectId_userId: { projectId: project.id, userId: jane.id } },
        update: {},
        create: { projectId: project.id, userId: jane.id },
      });
    }

    const alreadySeeded = (await prisma.task.count({ where: { projectId: project.id } })) > 0;

    if (p.code === "NS-2026-014" && !alreadySeeded) {
      await prisma.projectUpdate.create({
        data: {
          projectId: project.id,
          completed: "Reviewed and updated Clinical Evaluation Report.\nLiterature search report updated.",
          inProgress: "Finalizing CER draft.\nInternal quality review.",
          nextSteps: "Submit CER draft for client review.\nAddress client comments.",
          risks: "Delay in receiving PMS data may impact timeline.\nAwaiting client input.",
          createdById: pm.id,
        },
      });

      await prisma.task.createMany({
        data: [
          { projectId: project.id, name: "Finalize CER draft", status: TaskStatus.IN_PROGRESS, assigneeId: pm.id },
          { projectId: project.id, name: "Internal quality review", status: TaskStatus.TODO, assigneeId: pm.id },
          { projectId: project.id, name: "Literature search report", status: TaskStatus.DONE, assigneeId: pm.id },
        ],
      });

      await prisma.project.update({
        where: { id: project.id },
        data: { documentUploadLink: "https://workdrive.zoho.com/folder/example-upload-link" },
      });

      await prisma.document.createMany({
        data: [
          { projectId: project.id, name: "Clinical Evaluation Report Draft.pdf", status: "RECEIVED", addedById: pm.id },
          { projectId: project.id, name: "Updated PMS Data", status: "PENDING", addedById: pm.id },
        ],
      });

      await prisma.message.create({
        data: {
          projectId: project.id,
          senderId: pm.id,
          body: "Dear John, please find attached the updated Clinical Evaluation Report draft for your review.",
        },
      });
    }
  }

  console.log("Seed complete.");
  console.log(`Admin login:  ${admin.email} / password123 (sees/manages everything)`);
  console.log(`Internal login: ${pm.email} / password123 (assigned to all 5 demo projects)`);
  console.log(`Internal login: ${jane.email} / password123 (assigned to NS-2026-014 only)`);
  console.log(`Client login: ${client.email} / password123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
