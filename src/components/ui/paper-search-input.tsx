"use client";

import { useRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const searchIconUrl =
  "https://app.paper.design/file-assets/01KSM5T9Y43029NT8BEGHCV4SA/01KSQ04ASY45R1AJN7Y9CW3XKF.svg";

export function PaperSearchInput({
  className,
  inputClassName,
  textWidthClassName = "w-[327px]",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  inputClassName?: string;
  textWidthClassName?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div
      className={cn(
        "relative h-[31px] w-full cursor-text overflow-visible rounded-[4px] border border-black bg-transparent",
        className,
      )}
      onMouseDown={(event) => {
        if (event.target !== inputRef.current) {
          event.preventDefault();
          inputRef.current?.focus();
        }
      }}
    >
      <input
        {...props}
        ref={inputRef}
        className={cn(
          "absolute left-[11px] top-[5px] h-5 bg-transparent p-0 font-sans text-[16px] font-medium leading-5 text-[#2f2c29] outline-none ring-0 placeholder:text-[#B8ACA2] focus:outline-none focus:ring-0 focus-visible:outline-none",
          textWidthClassName,
          inputClassName,
        )}
      />
      <span
        className="absolute right-[6px] top-1/2 h-5 w-[17px] -translate-y-1/2 cursor-pointer bg-cover bg-center"
        style={{ backgroundImage: `url(${searchIconUrl})` }}
        aria-hidden="true"
      />
    </div>
  );
}
