import { useState, useRef, useCallback } from "react";
import type {
  ChatMessage,
  ChatStatus,
  SSEEvent,
  MessagePart,
  ToolCallPart,
} from "@/types/chat";

interface UseChatReturn {
  messages: ChatMessage[];
  status: ChatStatus;
  error: Error | null;
  sendMessage: (text: string) => void;
  stop: () => void;
  retry: () => void;
  clearMessages: () => void;
}

let idCounter = 0;
function genId() {
  return `msg-${Date.now()}-${++idCounter}`;
}

/**
 * Serialize ChatMessage[] to the {role, content}[] format expected by the backend.
 * Only text parts are included; tool-call parts are server-side context.
 */
function serializeMessages(msgs: ChatMessage[]): { role: string; content: string }[] {
  return msgs.map((m) => ({
    role: m.role,
    content: m.parts
      .filter((p): p is Extract<MessagePart, { type: "text" }> => p.type === "text")
      .map((p) => p.text)
      .join(""),
  }));
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [error, setError] = useState<Error | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;

  // Throttle: accumulate assistant message updates, flush every 50ms
  const pendingRef = useRef<ChatMessage | null>(null);
  const rafRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPending = useCallback(() => {
    if (pendingRef.current) {
      const msg = pendingRef.current;
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === msg.id);
        if (idx === -1) return [...prev, msg];
        const next = [...prev];
        next[idx] = msg;
        return next;
      });
    }
    rafRef.current = null;
  }, []);

  const scheduleFlush = useCallback(() => {
    if (rafRef.current === null) {
      rafRef.current = setTimeout(flushPending, 50);
    }
  }, [flushPending]);

  const processStream = useCallback(
    async (response: Response, assistantId: string) => {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Mutable assistant message we build up
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        parts: [],
        createdAt: new Date(),
      };

      // Helper: find or create trailing text part
      const getTextPart = () => {
        const last = assistantMsg.parts[assistantMsg.parts.length - 1];
        if (last && last.type === "text") return last;
        const part = { type: "text" as const, text: "" };
        assistantMsg.parts.push(part);
        return part;
      };

      const findToolPart = (toolCallId: string): ToolCallPart | undefined =>
        assistantMsg.parts.find(
          (p): p is ToolCallPart =>
            p.type === "tool-call" && p.toolCallId === toolCallId
        );

      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Split on double-newline SSE frame boundaries
          const frames = buffer.split("\n\n");
          buffer = frames.pop()!; // keep incomplete frame

          for (const frame of frames) {
            const line = frame.trim();
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6);

            if (payload === "[DONE]") {
              // Final flush
              pendingRef.current = { ...assistantMsg, parts: [...assistantMsg.parts] };
              flushPending();
              return;
            }

            let event: SSEEvent;
            try {
              event = JSON.parse(payload) as SSEEvent;
            } catch {
              continue;
            }

            switch (event.type) {
              case "text-delta": {
                setStatus("streaming");
                const textPart = getTextPart();
                textPart.text += event.delta;
                break;
              }

              case "tool-start": {
                assistantMsg.parts.push({
                  type: "tool-call",
                  toolCallId: event.toolCallId,
                  toolName: event.toolName,
                  args: event.args,
                  state: "running",
                });
                break;
              }

              case "tool-end": {
                const toolPart = findToolPart(event.toolCallId);
                if (toolPart) {
                  if (event.error) {
                    toolPart.state = "error";
                    toolPart.error = event.error;
                  } else {
                    toolPart.state = "complete";
                    toolPart.output = event.output;
                  }
                }
                break;
              }

              case "error": {
                setError(new Error(event.message));
                setStatus("error");
                return;
              }

              case "metadata": {
                assistantMsg.id = event.messageId;
                break;
              }

              case "status":
                // Status events are informational; status is already tracked
                break;
            }

            // Schedule throttled UI update
            pendingRef.current = { ...assistantMsg, parts: [...assistantMsg.parts] };
            scheduleFlush();
          }
        }
      } finally {
        // Ensure final state is flushed
        if (rafRef.current) {
          clearTimeout(rafRef.current);
          rafRef.current = null;
        }
        pendingRef.current = { ...assistantMsg, parts: [...assistantMsg.parts] };
        flushPending();
      }
    },
    [flushPending, scheduleFlush]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || status === "streaming" || status === "submitted") return;

      setError(null);

      // Add user message
      const userMsg: ChatMessage = {
        id: genId(),
        role: "user",
        parts: [{ type: "text", text: trimmed }],
        createdAt: new Date(),
      };

      const assistantId = genId();

      setMessages((prev) => [...prev, userMsg]);
      setStatus("submitted");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const allMessages = [...messagesRef.current, userMsg];
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: serializeMessages(allMessages) }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        await processStream(response, assistantId);
        setStatus("ready");
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setStatus("ready");
          return;
        }
        setError(err as Error);
        setStatus("error");
      } finally {
        abortRef.current = null;
      }
    },
    [status, processStream]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("ready");
  }, []);

  const retry = useCallback(() => {
    // Remove last assistant message (if any) and resend last user message
    const msgs = messagesRef.current;
    if (msgs.length === 0) return;

    let lastUserIdx = msgs.length - 1;
    // Walk backward to find the last user message
    while (lastUserIdx >= 0 && msgs[lastUserIdx].role !== "user") {
      lastUserIdx--;
    }
    if (lastUserIdx < 0) return;

    const lastUserText = msgs[lastUserIdx].parts
      .filter((p): p is Extract<MessagePart, { type: "text" }> => p.type === "text")
      .map((p) => p.text)
      .join("");

    // Trim messages back to just before the last user message
    setMessages(msgs.slice(0, lastUserIdx));
    setError(null);

    // Re-send after state update
    setTimeout(() => sendMessage(lastUserText), 0);
  }, [sendMessage]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    setStatus("ready");
  }, []);

  return { messages, status, error, sendMessage, stop, retry, clearMessages };
}
