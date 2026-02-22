import { useRef, useEffect, useCallback, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/chat/empty-state";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ChatInput } from "@/components/chat/chat-input";
import { StreamingIndicator } from "@/components/chat/streaming-indicator";

const transport = new DefaultChatTransport({ api: "/api/chat" });

export default function Chatbot() {
  const { messages, sendMessage, regenerate, status, stop, error } = useChat({
    transport,
    experimental_throttle: 50,
  });

  const [input, setInput] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const isStreaming = status === "streaming" || status === "submitted";

  // Pause auto-scroll when user scrolls up; resume at bottom
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    setAutoScroll(atBottom);
  }, []);

  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, status, autoScroll]);

  // Send handler
  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    sendMessage({ text: trimmed });
    setInput("");
  }, [input, isStreaming, sendMessage]);

  const handleSuggestionClick = useCallback(
    (text: string) => {
      if (isStreaming) return;
      sendMessage({ text });
    },
    [isStreaming, sendMessage]
  );

  // Detect active tool for streaming indicator
  const lastMessage = messages[messages.length - 1];
  let activeToolName: string | undefined;
  if (isStreaming && lastMessage?.role === "assistant") {
    for (const part of lastMessage.parts) {
      if (
        part.type === "dynamic-tool" &&
        part.state !== "output-available" &&
        part.state !== "output-error"
      ) {
        activeToolName = part.toolName;
        break;
      }
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-6"
        onScroll={handleScroll}
      >
        {messages.length === 0 && !error ? (
          <EmptyState onSuggestionClick={handleSuggestionClick} />
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {/* Streaming indicator */}
            {(status === "submitted" ||
              (status === "streaming" && activeToolName)) && (
              <StreamingIndicator toolName={activeToolName} />
            )}

            {/* Error display */}
            {error && (
              <div className="flex justify-start">
                <div className="max-w-[80%] px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-2xl rounded-bl-sm">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                    <AlertCircle className="size-4 shrink-0" />
                    <p>
                      {error.message || "An error occurred. Please try again."}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => regenerate()}
                    className="mt-2 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800"
                  >
                    <RefreshCw className="size-3 mr-1" />
                    Retry
                  </Button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <ChatInput
        input={input}
        isStreaming={isStreaming}
        onInputChange={setInput}
        onSubmit={handleSubmit}
        onStop={stop}
      />
    </div>
  );
}
