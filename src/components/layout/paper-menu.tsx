"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type AppView = "home" | "map" | "graph" | "events" | "tours" | "admin";

const menuItems: Array<{
  view: AppView;
  label: string;
  accent: string;
  width: number;
  rounded?: boolean;
  dividerAfter: "star" | "pill" | "block" | "wave";
}> = [
  { view: "map", label: "Xem bản đồ", accent: "#FDDD51", width: 219, dividerAfter: "star" },
  { view: "graph", label: "Mạng lưới văn hóa", accent: "#C2B7AD", width: 310, dividerAfter: "pill" },
  {
    view: "events",
    label: "Sự kiện văn hóa",
    accent: "#EB83D3",
    width: 285,
    rounded: true,
    dividerAfter: "block",
  },
  { view: "tours", label: "Tour trải nghiệm", accent: "#F1EEEB", width: 289, dividerAfter: "wave" },
];

const paperAssets = {
  logo: "/logo.svg",
  stone: "https://app.paper.design/file-assets/01KSM5T9Y43029NT8BEGHCV4SA/0CZNN1PE69PR3R9NE22F843VMZ.png",
  star: "https://app.paper.design/file-assets/01KSM5T9Y43029NT8BEGHCV4SA/6WVPKBE0113BXS9X8YNZC1J4QK.png",
  pill: "https://app.paper.design/file-assets/01KSM5T9Y43029NT8BEGHCV4SA/76VC8ATAGFAJGSW4V80P18EK3S.png",
  block: "https://app.paper.design/file-assets/01KSM5T9Y43029NT8BEGHCV4SA/5CH6786J6NK9ZH8C8P9C81TRG7.png",
  wave: "https://app.paper.design/file-assets/01KSM5T9Y43029NT8BEGHCV4SA/3TBX8BV1PVXJWP5SSR4QQ46N01.png",
};

export function PaperMenu({
  activeView,
  open,
  onToggle,
  onNavigate,
  onHoverReveal,
  compact = false,
}: {
  activeView: AppView;
  open: boolean;
  onToggle: () => void;
  onNavigate: (view: AppView) => void;
  onHoverReveal?: (open: boolean) => void;
  compact?: boolean;
}) {
  const [hoveredView, setHoveredView] = useState<AppView | null>(null);

  return (
    <nav
      className={cn(
        "paper-menu-shell fixed left-[58px] top-[44px] z-40 overflow-visible",
        compact
          ? "paper-menu-compact w-[310px]"
          : "flex h-[calc(100vh-88px)] w-[339px] flex-col items-start justify-between rounded-[12px]",
      )}
      onMouseEnter={() => {
        if (compact) onHoverReveal?.(true);
      }}
      onMouseLeave={() => {
        setHoveredView(null);
        if (compact) onHoverReveal?.(false);
      }}
      aria-label="Điều hướng chính"
    >
      <div className="paper-menu-stack flex w-[310px] flex-col items-center overflow-visible">
        <div className="flex h-[54px] w-[310px] items-center gap-[4px]">
          <button
            type="button"
            onClick={() => onNavigate("home")}
            className="paper-focus h-[54px] w-[54px] flex-shrink-0 cursor-pointer rounded-full bg-cover bg-center"
            style={{ backgroundImage: `url(${paperAssets.logo})` }}
            aria-label="Về Home"
          />
          <Button
            onClick={onToggle}
            variant="dark"
            className="paper-menu-button h-[54px] w-[120px] cursor-pointer rounded-[4px] px-[10px] pb-[10px] font-medium"
          >
            <span className="font-display">Menu</span>
          </Button>
        </div>
        {open ? (
          <>
            <Divider variant="stone" />
            {menuItems.map((item) => {
              const isActive = activeView === item.view;
              const rotation =
                hoveredView === item.view
                  ? item.view === "map" || item.view === "events"
                    ? "rotate(9.31deg)"
                    : "rotate(-9.31deg)"
                  : "rotate(0deg)";

              return (
                <div
                  key={item.view}
                  className="flex flex-col items-center"
                  onMouseEnter={() => setHoveredView(item.view)}
                  onMouseLeave={() => setHoveredView(null)}
                >
                  <button
                    type="button"
                    onClick={() => onNavigate(item.view)}
                    className={cn(
                      "paper-focus paper-menu-label font-display inline-flex h-[56px] origin-center cursor-pointer items-center justify-center px-[10px] text-center font-medium transition-transform duration-150",
                      "whitespace-nowrap",
                      item.rounded ? "rounded-full" : "rounded-[3px]",
                      isActive && "brightness-100",
                    )}
                    style={{
                      backgroundColor: item.accent,
                      width: item.width,
                      transform: rotation,
                    }}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {item.label}
                  </button>
                  <Divider variant={item.dividerAfter} />
                </div>
              );
            })}
          </>
        ) : null}
      </div>
      {!compact ? (
        <section className="paper-menu-slogan flex h-[170px] w-[339px] flex-shrink-0 items-center justify-center p-[10px]">
          <h1 className="font-display w-[337px] whitespace-pre-wrap text-[40px] font-bold leading-none text-[#2f2c29]">
            Nhìn thấy Hà Nội qua một góc nhìn sâu sắc hơn
          </h1>
        </section>
      ) : null}
    </nav>
  );
}

function Divider({
  variant,
}: {
  variant: "stone" | "star" | "pill" | "block" | "wave";
}) {
  const sizes = {
    stone: "h-[43px] w-[63px] p-[10px]",
    star: "h-[43px] w-[60px] p-[10px]",
    pill: "h-[45px] w-[220px] px-[10px] py-[3px]",
    block: "h-[44px] w-[61px] px-[10px] py-[2px]",
    wave: "h-[53px] w-[241px] p-[10px]",
  };
  const inner = {
    stone: "h-[43px] w-[43px]",
    star: "h-[42px] w-[40px]",
    pill: "h-[39px] w-[200px]",
    block: "h-[40px] w-[41px]",
    wave: "h-[40px] w-[221px]",
  };

  return (
    <span className={cn("flex flex-shrink-0 items-center justify-center", sizes[variant])}>
      <span
        className={cn("block bg-cover bg-center", inner[variant])}
        style={{ backgroundImage: `url(${paperAssets[variant]})` }}
      />
    </span>
  );
}
