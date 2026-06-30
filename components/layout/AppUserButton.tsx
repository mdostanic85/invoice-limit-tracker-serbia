"use client";

import { UserButton } from "@clerk/nextjs";

export function AppUserButton() {
  return (
    <div className="app-topbar-user">
      <UserButton />
    </div>
  );
}
