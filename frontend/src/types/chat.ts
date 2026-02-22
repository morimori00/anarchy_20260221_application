// SSE event types (wire format from backend)
export type SSEEvent =
  | { type: "text-delta"; delta: string }
  | { type: "tool-start"; toolCallId: string; toolName: string; args: Record<string, unknown> }
  | { type: "tool-end"; toolCallId: string; output?: Record<string, unknown>; error?: string }
  | { type: "error"; message: string }
  | { type: "status"; status: string; toolName?: string }
  | { type: "metadata"; messageId: string };

// Message parts
export interface TextPart {
  type: "text";
  text: string;
}

export interface ToolCallPart {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  state: "running" | "complete" | "error";
  output?: Record<string, unknown>;
  error?: string;
}

export type MessagePart = TextPart | ToolCallPart;

// Message
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  parts: MessagePart[];
  createdAt: Date;
}

export type ChatStatus = "ready" | "submitted" | "streaming" | "error";
