import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "paper-focus h-10 w-full rounded-md border border-input bg-white px-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "paper-focus min-h-24 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
