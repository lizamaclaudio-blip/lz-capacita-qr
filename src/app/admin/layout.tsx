"use client";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // ✅ /admin queda accesible. La protección real es por passcode (RUT) en endpoints.
  return <>{children}</>;
}