import type { UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ToolInvocationBlock } from "./tool-invocation-block";

interface MessageBubbleProps {
  message: UIMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] px-4 py-3 text-sm ${
          isUser
            ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm"
            : "bg-muted rounded-2xl rounded-bl-sm"
        }`}
      >
        {message.parts.map((part, i) => {
          // Text parts
          if (part.type === "text") {
            if (isUser) {
              return (
                <p key={i} className="whitespace-pre-wrap">
                  {part.text}
                </p>
              );
            }
            return (
              part.text && (
                <div
                  key={i}
                  className="prose prose-sm dark:prose-invert max-w-none [&_pre]:bg-zinc-900 [&_pre]:text-zinc-50 [&_pre]:rounded-lg [&_pre]:p-4 [&_code]:text-sm"
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {part.text}
                  </ReactMarkdown>
                </div>
              )
            );
          }

          // Dynamic tool invocations (untyped tools)
          if (part.type === "dynamic-tool") {
            return (
              <ToolInvocationBlock
                key={part.toolCallId}
                toolName={part.toolName}
                state={part.state}
                input={part.state !== "input-streaming" ? part.input : undefined}
                output={part.state === "output-available" ? part.output : undefined}
                errorText={part.state === "output-error" ? part.errorText : undefined}
              />
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
