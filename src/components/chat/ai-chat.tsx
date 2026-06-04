"use client";

import { useState, useTransition } from "react";
import { Send, X } from "lucide-react";
import type { ExplorerData } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const suggestions = [
  "Gợi ý một tour quanh Hồ Gươm",
  "Đền Bà Kiệu liên quan đến điểm nào?",
  "Sự kiện nào đang nổi bật?",
];

const aiLauncherAsset =
  "/ai-launcher.svg";

export function AiChat({
  data,
  onHighlight,
}: {
  data: ExplorerData;
  onHighlight: (nodeIds: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(message = input) {
    if (!message.trim()) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
    };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            message,
            context: JSON.stringify({
              nodes: data.nodes.map(({ id, title, summary }) => ({
                id,
                title,
                summary,
              })),
              tours: data.tours.map(({ id, title, description }) => ({
                id,
                title,
                description,
              })),
            }),
          }),
        });

        if (!response.ok) throw new Error("Không gọi được chatbot");

        const result = (await response.json()) as {
          content: string;
          metadata?: { graphHighlightIds?: string[] };
        };

        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: result.content,
          },
        ]);
        onHighlight(result.metadata?.graphHighlightIds ?? []);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Chat lỗi");
      }
    });
  }

  return (
    <div className="fixed bottom-[41px] left-8 z-50">
      {open ? (
        <section className="mb-4 w-[380px] rounded-[8px] border border-[#2f2c29] bg-white shadow-2xl">
          <header className="flex items-center justify-between border-b border-[#d9d4ce] px-4 py-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                AI văn hóa
              </p>
              <h2 className="font-display text-2xl font-bold">Hỏi Hà Nội</h2>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setOpen(false)}
              aria-label="Đóng chat"
            >
              <X className="h-5 w-5" />
            </Button>
          </header>
          <div className="max-h-[420px] min-h-[260px] space-y-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Hỏi về địa danh, quan hệ văn hóa, sự kiện hoặc tour demo.
                </p>
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => submit(suggestion)}
                    className="paper-focus block w-full rounded-md border border-[#d9d4ce] px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "rounded-[8px] px-3 py-2 text-sm",
                    message.role === "user"
                      ? "ml-8 bg-[#2f2c29] text-white"
                      : "mr-8 bg-[#f3f0eb] text-[#2f2c29]",
                  )}
                >
                  {message.content}
                </div>
              ))
            )}
            {isPending ? (
              <div className="mr-8 rounded-[8px] bg-[#f3f0eb] px-3 py-2 text-sm">
                Đang trả lời...
              </div>
            ) : null}
            {error ? (
              <div className="rounded-md border border-destructive px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}
          </div>
          <form
            className="flex gap-2 border-t border-[#d9d4ce] p-3"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Hỏi về Hà Nội..."
              aria-label="Nội dung chat"
            />
            <Button type="submit" size="icon" aria-label="Gửi">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </section>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="paper-focus group relative h-16 w-16 cursor-pointer bg-contain bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${aiLauncherAsset})` }}
        aria-label="Mở AI chat"
      >
        <span className="pointer-events-none absolute bottom-full left-0 mb-2 hidden whitespace-nowrap rounded-[4px] border border-[#2f2c29] bg-white px-3 py-2 font-display text-[16px] font-medium leading-5 text-[#2f2c29] shadow-lg group-hover:block">
          Gọi &quot;Thần Nón AI&quot;
        </span>
      </button>
    </div>
  );
}
