"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function PaperFilterDropdown({
  label,
  value,
  placeholder,
  options,
  onChange,
  zIndexClassName = "z-40",
}: {
  label: string;
  value: string | null;
  placeholder: string;
  options: string[];
  onChange: (value: string | null) => void;
  zIndexClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const visibleOptions = options.filter((option) =>
    option.toLowerCase().includes(search.trim().toLowerCase()),
  );

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!dropdownRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="paper-focus grid h-7 w-full cursor-pointer grid-cols-[155px_minmax(0,1fr)_18px] items-center text-left"
        aria-expanded={open}
      >
        <span className="font-display text-[18px] font-medium leading-[22px]">{label}</span>
        <span
          className={cn(
            "font-display justify-self-end truncate text-[18px] font-medium leading-[22px]",
            value ? "text-[#2F2C29]" : "text-[#b8aca2]",
          )}
        >
          {value ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 justify-self-end transition-transform",
            value ? "text-[#2F2C29]" : "text-[#b8aca2]",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <div
          className={cn(
            "absolute right-0 top-[32px] w-[260px] overflow-hidden rounded-[4px] border border-[#b8aca2] bg-white text-[#2f2c29] shadow-xl",
            zIndexClassName,
          )}
        >
          <div className="border-b border-[#d9d4ce] p-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              autoFocus
              placeholder="Tìm kiếm"
              className="paper-focus h-8 w-full rounded-[4px] border border-[#B8ACA2] bg-white px-2 font-display text-[18px] font-medium leading-[22px] text-[#2f2c29] placeholder:text-[#B8ACA2]"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setSearch("");
              setOpen(false);
            }}
            className="paper-focus flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left font-display text-[18px] font-medium leading-[22px] hover:bg-[#f3f0eb]"
          >
            <span>Tất Cả</span>
          </button>
          <div className="max-h-[190px] overflow-y-auto [scrollbar-width:thin]">
            {visibleOptions.length ? (
              visibleOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setSearch("");
                    setOpen(false);
                  }}
                  className="paper-focus flex w-full cursor-pointer items-center justify-between border-t border-[#d9d4ce] px-3 py-2 text-left font-display text-[18px] font-medium leading-[22px] hover:bg-[#f3f0eb]"
                >
                  <span>{option}</span>
                  {value === option ? (
                    <span className="text-xs text-[#b8aca2]">Đang chọn</span>
                  ) : null}
                </button>
              ))
            ) : (
              <div className="border-t border-[#d9d4ce] px-3 py-2 font-display text-[18px] font-medium leading-[22px] text-[#b8aca2]">
                Không có kết quả
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
