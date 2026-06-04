export type ChatRequest = {
  message: string;
  context?: string;
};

export type ChatResponse = {
  content: string;
  metadata: {
    linkedNodeIds: string[];
    mapPlaceIds: string[];
    graphHighlightIds: string[];
  };
};

const responseSchemaDescription = `Return only compact JSON:
{
  "content": "Vietnamese answer under 120 words",
  "metadata": {
    "linkedNodeIds": ["known node ids"],
    "mapPlaceIds": ["known node ids with coordinates"],
    "graphHighlightIds": ["known node ids"]
  }
}`;

export async function askGemini({
  message,
  context,
}: ChatRequest): Promise<ChatResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  if (!apiKey) {
    return {
      content:
        "Mình đang chạy ở chế độ demo. Bạn có thể hỏi về Hồ Gươm, Đền Bà Kiệu, tour Phá Đảo Hà Nội hoặc sự kiện Múa Rối Nước Bờ Hồ.",
      metadata: {
        linkedNodeIds: ["node-ho-guom", "node-den-ba-kieu"],
        mapPlaceIds: ["node-ho-guom"],
        graphHighlightIds: ["node-ho-guom", "node-den-ba-kieu"],
      },
    };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        generationConfig: {
          responseMimeType: "application/json",
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Bạn là chatbot văn hóa Hà Nội. Chỉ dùng context được cung cấp; nếu thiếu dữ liệu thì nói ngắn gọn là chưa có dữ liệu. ${responseSchemaDescription}\n\nContext:\n${context ?? ""}\n\nCâu hỏi: ${message}`,
              },
            ],
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Gemini request failed");
  }

  const json = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const rawText =
    json.candidates?.[0]?.content?.parts?.map((part) => part.text).join("\n") ?? "";
  const parsed = parseGeminiJson(rawText);

  return {
    content: parsed.content || rawText || "Mình chưa có câu trả lời phù hợp.",
    metadata: parsed.metadata,
  };
}

function parseGeminiJson(text: string): ChatResponse {
  try {
    const parsed = JSON.parse(text) as Partial<ChatResponse>;
    return {
      content: typeof parsed.content === "string" ? parsed.content : "",
      metadata: {
        linkedNodeIds: readStringArray(parsed.metadata?.linkedNodeIds),
        mapPlaceIds: readStringArray(parsed.metadata?.mapPlaceIds),
        graphHighlightIds: readStringArray(parsed.metadata?.graphHighlightIds),
      },
    };
  } catch {
    return {
      content: text,
      metadata: {
        linkedNodeIds: [],
        mapPlaceIds: [],
        graphHighlightIds: [],
      },
    };
  }
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
