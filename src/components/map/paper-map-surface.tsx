"use client";

import { Home } from "lucide-react";
import { cn } from "@/lib/utils";

export function PaperMapSurface({
  className,
  dense = false,
}: {
  className?: string;
  dense?: boolean;
}) {
  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-[#edf0dd]", className)}>
      <div className="absolute inset-0 opacity-80 [background-image:url('https://tile.openstreetmap.org/15/26018/14425.png')] [background-size:560px_560px]" />
      <div className="absolute inset-0 bg-[#fff5df]/40" />
      <div className="absolute left-[-8%] top-[11%] h-[76%] w-[35%] rounded-[48%] bg-[#bcefff]/80 blur-[1px]" />
      <div className="absolute right-[-2%] top-[-7%] h-[118%] w-[25%] rotate-[8deg] bg-[#aee8ff]/75" />
      <div className="absolute left-[7%] top-[14%] h-[82%] w-[94%] border-l-[4px] border-t-[4px] border-[#7397e8]/70 [clip-path:polygon(0_0,26%_4%,35%_30%,51%_25%,68%_55%,88%_48%,100%_100%,0_100%)]" />
      <div className="absolute left-[15%] top-[63%] font-sans text-[28px] font-bold leading-tight text-[#3a9c67] opacity-80">
        Công Viên Bách<br />Thảo Hà Nội
      </div>
      <div className="absolute left-[61%] top-[36%] font-sans text-[28px] font-bold leading-tight text-[#2f84da] opacity-80">
        TTHH du lịch<br />dịch vụ và<br />thương mại TSC
      </div>
      <div className="absolute bottom-[3%] left-0 font-sans text-[44px] font-bold text-[#777] opacity-70">
        Ba Đình
      </div>
      <div
        className={cn(
          "absolute rounded-full border-[10px] border-white bg-[#126dff] shadow-xl shadow-blue-600/30",
          dense ? "left-[58%] top-[43%] h-[42px] w-[42px]" : "left-[57%] top-[38%] h-[55px] w-[55px]",
        )}
      />
      <div
        className={cn(
          "absolute grid place-items-center rounded-full bg-white text-[#2f2c29] shadow-xl",
          dense ? "left-[63%] top-[31%] h-[42px] w-[42px]" : "left-[61%] top-[28%] h-[58px] w-[58px]",
        )}
      >
        <Home className={cn(dense ? "h-6 w-6" : "h-8 w-8")} strokeWidth={2.5} />
      </div>
    </div>
  );
}
