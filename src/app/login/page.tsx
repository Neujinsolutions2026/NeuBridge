"use client";

import Image from "next/image";
import { useActionState } from "react";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [error, formAction, isPending] = useActionState(loginAction, undefined);

  return (
    <div className="flex flex-1 items-center justify-center bg-gray-100 px-4 py-12">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <Image src="/Neubridge.png" alt="Neubridge" width={220} height={81} className="mx-auto" priority />
          <p className="mt-2 text-sm font-medium text-gray-500 tracking-wide">CLIENT PORTAL</p>
          <p className="mt-1 text-sm text-gray-500">
            Secure. Transparent. Collaborative.
          </p>
        </div>

        <h2 className="mb-4 text-center text-sm font-medium text-gray-700">
          Sign in to your account
        </h2>

        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-medium text-gray-600">
              Email / Username
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="username"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-medium text-gray-600">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" className="rounded border-gray-300" />
              Remember me
            </label>
            <span className="cursor-not-allowed text-gray-400">Forgot Password?</span>
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-md bg-gray-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-60"
          >
            {isPending ? "Signing in…" : "Login"}
          </button>
        </form>

        <p className="mt-8 text-center text-[11px] text-gray-400">
          © 2026 Your Organization. All rights reserved.
        </p>
      </div>
    </div>
  );
}
