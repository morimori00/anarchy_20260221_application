import { useCallback } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useChat } from "@/hooks/use-chat";
import { EmptyState } from "@/components/chat/empty-state";
import { ToolInvocationBlock } from "@/components/chat/tool-invocation-block";
import { Shimmer } from "@/components/ai-elements/shimmer";
import type { ChatMessage } from "@/types/chat";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";

function ChatMessageItem({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <Message from={message.role}>
      <MessageContent>
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            if (isUser) {
              return (
                <p key={i} className="whitespace-pre-wrap">
                  {part.text}
                </p>
              );
            }
            return part.text ? (
              <MessageResponse key={i}>{part.text}</MessageResponse>
            ) : null;
          }

          if (part.type === "tool-call") {
            return (
              <ToolInvocationBlock
                key={part.toolCallId}
                toolName={part.toolName}
                state={part.state}
                args={part.args}
                output={part.output}
                error={part.error}
              />
            );
          }

          return null;
        })}
      </MessageContent>
    </Message>
  );
}

export default function Chatbot() {
  const { messages, status, error, sendMessage, stop, retry, clearMessages } =
    useChat();

  const isStreaming = status === "streaming" || status === "submitted";

  const handleSuggestionClick = useCallback(
    (text: string) => {
      if (isStreaming) return;
      sendMessage(text);
    },
    [isStreaming, sendMessage]
  );

  return (
    <div className="flex flex-col items-center justify-between h-[calc(100vh-3.5rem)]">
      <Conversation>
        <ConversationContent className="p-6">
          {messages.length === 0 && !error ? (
            <EmptyState onSuggestionClick={handleSuggestionClick} />
          ) : (
            <div className="w-[700px]">
              {messages.map((message) => (
                <ChatMessageItem key={message.id} message={message} />
              ))}

              {/* Thinking indicator */}
              {status === "submitted" && (
                <Message from="assistant">
                  <MessageContent>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Spinner className="size-4" />
                      <Shimmer duration={1.5}>Thinking...</Shimmer>
                    </div>
                  </MessageContent>
                </Message>
              )}

              {/* Error display */}
              {error && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-2xl rounded-bl-sm">
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                      <AlertCircle className="size-4 shrink-0" />
                      <p>
                        {error.message ||
                          "An error occurred. Please try again."}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => retry()}
                      className="mt-2 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800"
                    >
                      <RefreshCw className="size-3 mr-1" />
                      Retry
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Input area */}
      <div className="border-t p-4">
        <PromptInput
          className="max-w-3xl mx-auto"
          onSubmit={(message) => {
            const text = message.text.trim();
            if (!text) return;
            sendMessage(text);
          }}
        >
          <PromptInputTextarea
            placeholder="Ask about energy data..."
            disabled={isStreaming}
          />
          <PromptInputFooter>
            <div />
            <PromptInputSubmit
              status={status}
              onStop={stop}
              disabled={!isStreaming && status !== "ready"}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
