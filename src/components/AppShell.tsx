import { ReactNode } from "react";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-[420px]">
        <div className="rounded-[28px] border border-white/15 bg-white/10 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="px-6 pt-6 pb-4">{children}</div>
        </div>
        <div className="mt-4 text-center text-xs text-white/70">
          Prevención QR · demo
        </div>
      </div>
    </div>
  );
}