import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const isPublic = pathname === "/login" || pathname.startsWith("/api/auth");

  if (!isLoggedIn && !isPublic) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }

  const role = req.auth?.user?.role;
  if (isLoggedIn && pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  // Excludes Next.js internals, the uploads route, and any static asset file
  // (images, icons, etc. in /public) - those need to load even for a
  // logged-out visitor (e.g. the logo on the login page itself), not get
  // redirected to /login like a real page would.
  matcher: ["/((?!_next/static|_next/image|uploads|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)"],
};
