import { useRef, useEffect, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { EmptyState } from "@/components/chat/empty-state";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ChatInput } from "@/components/chat/chat-input";
import { StreamingIndicator } from "@/components/chat/streaming-indicator";

export default function Chatbot() {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    setInput,
    status,
    stop,
  } = useChat({
    api: "/api/chat",
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isStreaming = status === "streaming" || status === "submitted";

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const handleSuggestionClick = useCallback(
    (text: string) => {
      setInput(text);
      setTimeout(() => {
        const form = document.getElementById(
          "chat-form"
        ) as HTMLFormElement | null;
        form?.requestSubmit();
      }, 0);
    },
    [setInput]
  );

  // Determine active tool for the streaming indicator
  const lastMessage = messages[messages.length - 1];
  const activeToolName =
    isStreaming && lastMessage?.role === "assistant"
      ? (
          lastMessage.toolInvocations?.find(
            (t: { state: string }) =>
              t.state !== "result" && t.state !== "output-available"
          ) as { toolName?: string } | undefined
        )?.toolName
      : undefined;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-6">
        {messages.length === 0 ? (
          <EmptyState onSuggestionClick={handleSuggestionClick} />
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                role={message.role as "user" | "assistant"}
                content={message.content}
                toolInvocations={
                  message.toolInvocations as unknown as Array<{
                    toolCallId: string;
                    toolName: string;
                    args: Record<string, unknown>;
                    state: string;
                    result?: Record<string, unknown>;
                  }>
                }
              />
            ))}

            {/* Streaming indicator */}
            {status === "submitted" && (
              <StreamingIndicator toolName={activeToolName} />
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <ChatInput
        input={input}
        isStreaming={isStreaming}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        onStop={stop}
      />
    </div>
  );
}
