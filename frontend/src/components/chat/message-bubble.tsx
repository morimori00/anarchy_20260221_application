import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ToolInvocationBlock } from "./tool-invocation-block";

interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  state: string;
  result?: Record<string, unknown>;
}

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  toolInvocations?: ToolInvocation[];
}

export function MessageBubble({
  role,
  content,
  toolInvocations,
}: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] px-4 py-3 text-sm ${
          isUser
            ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm"
            : "bg-muted rounded-2xl rounded-bl-sm"
        }`}
      >
        {/* Text content */}
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          content && (
            <div className="prose prose-sm dark:prose-invert max-w-none [&_pre]:bg-zinc-900 [&_pre]:text-zinc-50 [&_pre]:rounded-lg [&_pre]:p-4 [&_code]:text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          )
        )}

        {/* Tool invocations */}
        {toolInvocations?.map((invocation) => (
          <ToolInvocationBlock
            key={invocation.toolCallId}
            invocation={invocation}
          />
        ))}
      </div>
    </div>
  );
}
