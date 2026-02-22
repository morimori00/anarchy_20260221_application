import { useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { useChat } from "@ai-sdk/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles, ArrowUp, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUGGESTIONS = [
  "Which buildings have the highest anomaly scores for electricity?",
  "Compare energy usage of Building 311 vs Building 356",
  "What if temperature was 10F higher on Sept 15?",
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyState({ onSuggestionClick }: { onSuggestionClick: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="rounded-full bg-primary/10 p-4 mb-6">
        <Sparkles className="size-8 text-primary" />
      </div>
      <h2 className="text-2xl font-semibold mb-2">Energy Analysis Assistant</h2>
      <p className="text-muted-foreground max-w-md mb-8">
        Ask questions about energy consumption, anomaly detection, weather impacts, and building
        performance across the campus.
      </p>
      <div className="flex flex-col gap-3 w-full max-w-lg">
        {SUGGESTIONS.map((text) => (
          <button
            key={text}
            onClick={() => onSuggestionClick(text)}
            className="text-left rounded-xl border px-4 py-3 text-sm hover:bg-muted transition-colors"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToolInvocationBlock({ invocation }: { invocation: Record<string, unknown> }) {
  const toolName = invocation.toolName as string | undefined;
  const args = invocation.args as Record<string, unknown> | undefined;
  const result = invocation.result as Record<string, unknown> | undefined;

  if (toolName === "execute_python") {
    const code = (args?.code as string) ?? "";
    const output = (result?.output as string) ?? (result?.result as string) ?? null;
    return (
      <div className="my-3 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Python Code</p>
        <pre className="bg-zinc-900 text-zinc-50 font-mono text-sm p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
          {code}
        </pre>
        {output && (
          <>
            <p className="text-xs font-medium text-muted-foreground">Output</p>
            <pre className="bg-zinc-900 text-zinc-50 font-mono text-sm p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
              {output}
            </pre>
          </>
        )}
      </div>
    );
  }

  if (toolName === "run_prediction") {
    return (
      <Card className="my-3">
        <CardHeader>
          <CardTitle className="text-sm">Prediction Result</CardTitle>
        </CardHeader>
        <CardContent>
          {result ? (
            <pre className="text-xs font-mono whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">Running prediction...</p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Generic tool invocation fallback
  return (
    <Card className="my-3">
      <CardHeader>
        <CardTitle className="text-sm">{toolName ?? "Tool"}</CardTitle>
      </CardHeader>
      <CardContent>
        {result ? (
          <pre className="text-xs font-mono whitespace-pre-wrap">
            {JSON.stringify(result, null, 2)}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground">Processing...</p>
        )}
      </CardContent>
    </Card>
  );
}

function StreamingIndicator() {
  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <div className="flex gap-1">
        <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
        <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
        <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
      </div>
      <span className="text-sm text-muted-foreground">Thinking...</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isStreaming = status === "streaming" || status === "submitted";

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "40px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const handleSuggestionClick = useCallback(
    (text: string) => {
      setInput(text);
      // Submit on next tick so the input state updates
      setTimeout(() => {
        const form = document.getElementById("chat-form") as HTMLFormElement | null;
        form?.requestSubmit();
      }, 0);
    },
    [setInput],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const form = document.getElementById("chat-form") as HTMLFormElement | null;
      form?.requestSubmit();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-6">
        {messages.length === 0 ? (
          <EmptyState onSuggestionClick={handleSuggestionClick} />
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((message) => {
              const isUser = message.role === "user";

              return (
                <div
                  key={message.id}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-3 text-sm ${
                      isUser
                        ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm"
                        : "bg-muted rounded-2xl rounded-bl-sm"
                    }`}
                  >
                    {/* Text content */}
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&_pre]:bg-zinc-900 [&_pre]:text-zinc-50 [&_pre]:rounded-lg [&_pre]:p-4 [&_code]:text-sm">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    )}

                    {/* Tool invocations */}
                    {message.toolInvocations &&
                      message.toolInvocations.map((invocation, idx) => (
                        <ToolInvocationBlock
                          key={idx}
                          invocation={invocation as unknown as Record<string, unknown>}
                        />
                      ))}
                  </div>
                </div>
              );
            })}

            {/* Streaming indicator */}
            {status === "submitted" && <StreamingIndicator />}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t p-4">
        <form
          id="chat-form"
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto flex items-end gap-2"
        >
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask about energy data..."
              rows={1}
              className="w-full resize-none rounded-xl border bg-background px-4 py-3 pr-12 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] placeholder:text-muted-foreground"
              style={{ minHeight: "40px", maxHeight: "160px" }}
            />
          </div>

          {isStreaming ? (
            <Button
              type="button"
              size="icon"
              variant="destructive"
              onClick={stop}
              className="rounded-full shrink-0"
            >
              <Square className="size-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim()}
              className="rounded-full shrink-0"
            >
              <ArrowUp className="size-4" />
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
