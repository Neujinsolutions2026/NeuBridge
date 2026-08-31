import { Session } from "next-auth";

export function isAdmin(session: Session | null) {
  return session?.user.role === "ADMIN";
}

export function isInternal(session: Session | null) {
  return session?.user.role === "INTERNAL";
}

// Staff = anyone who works for the org (Admin or Internal team member), as
// opposed to a Client. Does not by itself imply access to every project —
// see canAccessProject below.
export function isStaff(session: Session | null) {
  return isAdmin(session) || isInternal(session);
}

export function isClient(session: Session | null) {
  return session?.user.role === "CLIENT";
}

type ProjectAccessInput = {
  companyId: string;
  members?: { userId: string }[];
};

// Admin: access to every project. Internal: only projects they're assigned
// to as a team member. Client: only projects belonging to their company.
export function canAccessProject(session: Session | null, project: ProjectAccessInput) {
  if (!session) return false;
  if (isAdmin(session)) return true;
  if (isInternal(session)) return (project.members ?? []).some((m) => m.userId === session.user.id);
  return session.user.role === "CLIENT" && session.user.companyId === project.companyId;
}
