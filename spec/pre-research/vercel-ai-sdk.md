# Vercel AI SDK 調査レポート

## 概要

Vercel AI SDK（現在は `ai-sdk.dev` でホストされている）は、AIを活用したアプリケーションを構築するためのTypeScriptツールキットである。React、Next.js、Vue、Svelte、Node.jsなど複数のフレームワークに対応しており、LLMとのインタラクションを標準化するAPIを提供する。

SDKは2つの主要ライブラリで構成される：

1. **AI SDK Core** - テキスト生成、構造化オブジェクト生成、ツール呼び出し、エージェント構築のための統一API
2. **AI SDK UI** - チャットインターフェースや生成UIのためのフレームワーク非依存フック

### 対応プロバイダー（24以上）

| プロバイダー | パッケージ名 |
|---|---|
| OpenAI | `@ai-sdk/openai` |
| Anthropic（Claude） | `@ai-sdk/anthropic` |
| Google Generative AI | `@ai-sdk/google` |
| Google Vertex AI | `@ai-sdk/google-vertex` |
| Mistral | `@ai-sdk/mistral` |
| xAI (Grok) | `@ai-sdk/xai` |
| Amazon Bedrock | `@ai-sdk/amazon-bedrock` |
| Azure OpenAI | `@ai-sdk/azure` |
| DeepSeek, Groq, Cohere, Together.ai 他 | 各種パッケージ |

コミュニティプロバイダーとして Ollama、OpenRouter なども利用可能。

---

## インストールとセットアップ

### 基本パッケージのインストール

```bash
# コアパッケージ
npm install ai

# React用UIフック
npm install @ai-sdk/react

# プロバイダー（使用するものを選択）
npm install @ai-sdk/openai
npm install @ai-sdk/anthropic
npm install @ai-sdk/google
```

### 環境変数の設定

```bash
# .env.local
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### TypeScript設定

AI SDKはTypeScriptネイティブであり、Zodスキーマによる型安全なツール定義をサポートする。

```bash
npm install zod
```

---

## 基本的な使い方

### サーバーサイド（テキスト生成）

```typescript
import { generateText, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

// 非ストリーミング
const { text } = await generateText({
  model: openai('gpt-4o'),
  prompt: 'What is the weather in San Francisco?',
});

// ストリーミング
const result = streamText({
  model: openai('gpt-4o'),
  prompt: 'Write a story about a robot.',
});
```

### クライアントサイド（React チャットUI）

```typescript
import { useChat } from '@ai-sdk/react';

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat',
  });

  return (
    <div>
      {messages.map((msg) => (
        <div key={msg.id}>
          {msg.role === 'user' ? 'User: ' : 'AI: '}
          {msg.parts.map((part, i) => {
            if (part.type === 'text') return <span key={i}>{part.text}</span>;
            return null;
          })}
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

---

## useChat フック

`useChat` はチャットボットUIを構築するための中心的なフックであり、メッセージ管理、ストリーミング、ツール呼び出し、エラー処理を自動的に行う。

### インポート

```typescript
import { useChat } from '@ai-sdk/react';
```

### 主要パラメータ

| パラメータ | 型 | 説明 |
|---|---|---|
| `id` | `string` | チャットの一意識別子（省略時は自動生成） |
| `messages` | `UIMessage[]` | 初期メッセージ配列 |
| `transport` | `ChatTransport` | トランスポート設定（APIエンドポイント等） |
| `onToolCall` | `function` | ツール呼び出し時のコールバック |
| `onFinish` | `function` | レスポンス完了時のコールバック |
| `onError` | `function` | エラー発生時のコールバック |
| `sendAutomaticallyWhen` | `function` | 自動送信条件 |
| `experimental_throttle` | `number` | UI更新のスロットリング（ミリ秒） |

### 戻り値

| プロパティ | 型 | 説明 |
|---|---|---|
| `messages` | `UIMessage[]` | 現在のメッセージ配列 |
| `status` | `'ready' \| 'submitted' \| 'streaming' \| 'error'` | 現在のステータス |
| `error` | `Error \| undefined` | エラーオブジェクト |
| `sendMessage()` | `function` | メッセージ送信 |
| `regenerate()` | `function` | 最後のアシスタントメッセージを再生成 |
| `stop()` | `function` | 現在のストリームを中断 |
| `addToolOutput()` | `function` | ツール実行結果を提供 |
| `setMessages()` | `function` | メッセージを直接更新（API呼び出しなし） |

### トランスポート設定

```typescript
const { messages, sendMessage, status } = useChat({
  transport: new DefaultChatTransport({
    api: '/api/chat',          // エンドポイントURL
    headers: {                  // カスタムヘッダー
      Authorization: 'Bearer token',
    },
    body: {                     // 追加ボディデータ
      customKey: 'value',
    },
    credentials: 'include',     // Cookie送信
  }),
});
```

### メッセージのパーツ構造

メッセージは `parts` プロパティを持ち、複数のコンテンツタイプを含むことができる：

```typescript
message.parts.map((part, index) => {
  switch (part.type) {
    case 'text':
      return <span key={index}>{part.text}</span>;
    case 'file':
      return <img key={index} src={part.url} />;
    case 'reasoning':
      return <pre key={index}>{part.text}</pre>;
    case 'tool-invocation':
      return <ToolUI key={index} part={part} />;
  }
});
```

### ステータス管理

```typescript
const { status, stop } = useChat({ /* ... */ });

// ローディング表示
{(status === 'submitted' || status === 'streaming') && (
  <div>AI is thinking...</div>
)}

// 停止ボタン
<button
  onClick={() => stop()}
  disabled={!(status === 'streaming' || status === 'submitted')}
>
  Stop
</button>

// 送信ボタンの無効化
<button type="submit" disabled={status !== 'ready'}>
  Send
</button>
```

### パフォーマンス最適化

高速ストリーミング時のUI更新頻度を制御する：

```typescript
const { messages } = useChat({
  experimental_throttle: 50, // 50msごとにバッチ更新
});
```

---

## ストリーミング

AI SDKは2種類のストリーミングプロトコルをサポートする。

### テキストストリーム

プレーンテキストのチャンクを逐次追加する単純な方式。テキストのみの場合に使用。

```typescript
// フロントエンド
const { messages } = useChat({
  transport: new TextStreamChatTransport({
    api: '/api/chat',
  }),
});
```

**制限事項**: テキストストリームではツール呼び出しなどの構造化データをストリーミングできない。

### データストリーム（SSE）

Server-Sent Events (SSE) ベースの構造化ストリーミング。ツール呼び出し、推論トークン、メタデータなどの複雑なデータをサポートする。

#### ストリームパーツの種類

| パーツタイプ | 目的 |
|---|---|
| `message-start` | メッセージの初期化 |
| `text-start/delta/end` | テキストブロックのストリーミング |
| `reasoning-start/delta/end` | 推論コンテンツ |
| `tool-input-start/delta/available` | ツール実行の準備 |
| `tool-output-available` | ツール実行結果 |
| `start-step/finish-step` | LLM呼び出しの境界 |
| `file` | ファイル参照 |
| `source-url/source-document` | ソース参照 |
| `data-*` | カスタム構造化データ |
| `error` | エラーメッセージ |
| `finish` | メッセージ完了 |

#### サーバーサイド実装（Next.js）

```typescript
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = streamText({
    model: openai('gpt-4o'),
    messages,
  });
  return result.toUIMessageStreamResponse();
}
```

#### カスタムバックエンドの要件

カスタムバックエンドからデータストリームを提供する場合、以下のヘッダーが必須：

```
x-vercel-ai-ui-message-stream: v1
```

ストリームの終端は `data: [DONE]` で示す。

---

## ツール呼び出し

ツールはLLMに外部機能（API呼び出し、コード実行、データベースクエリなど）へのアクセスを提供する仕組みである。

### ツールの定義

```typescript
import { tool } from 'ai';
import { z } from 'zod';

const weatherTool = tool({
  description: 'Get the weather in a location',
  inputSchema: z.object({
    location: z.string().describe('The location to get the weather for'),
  }),
  execute: async ({ location }) => ({
    location,
    temperature: 72 + Math.floor(Math.random() * 21) - 10,
  }),
});
```

### ツールの3つのカテゴリ

1. **サーバーサイドツール** - `execute` メソッドでサーバー上で自動実行
2. **クライアントサイドツール** - `onToolCall` コールバックでクライアントで実行
3. **インタラクティブツール** - ユーザー確認後に実行（`needsApproval: true`）

### サーバーサイドツールの使用

```typescript
import { streamText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const result = streamText({
  model: openai('gpt-4o'),
  tools: {
    weather: tool({
      description: 'Get the weather in a location',
      inputSchema: z.object({
        location: z.string(),
      }),
      execute: async ({ location }) => ({
        location,
        temperature: 72,
      }),
    }),
  },
  prompt: 'What is the weather in San Francisco?',
});
```

### マルチステップツール呼び出し

`stopWhen` を使用して、エージェント的なループを実現する：

```typescript
import { generateText, tool, stepCountIs } from 'ai';

const { text, steps } = await generateText({
  model: openai('gpt-4o'),
  tools: {
    weather: tool({ /* ... */ }),
    calculator: tool({ /* ... */ }),
  },
  stopWhen: stepCountIs(5), // 最大5ステップ
  prompt: 'What is the weather in SF and convert the temp to Celsius?',
});

// 全ステップのツール呼び出しを取得
const allToolCalls = steps.flatMap(step => step.toolCalls);
```

### ツール呼び出しの選択モード

```typescript
const result = await generateText({
  model: openai('gpt-4o'),
  tools: { /* ... */ },
  toolChoice: 'auto',                          // モデルが判断（デフォルト）
  // toolChoice: 'required',                   // ツール使用を強制
  // toolChoice: 'none',                       // ツール無効
  // toolChoice: { type: 'tool', toolName: 'weather' }, // 特定ツールを強制
});
```

### ツール実行中の中間結果（プレリミナリー結果）

```typescript
const weatherTool = tool({
  description: 'Get weather',
  inputSchema: z.object({ location: z.string() }),
  async *execute({ location }) {
    yield { status: 'loading', text: `Getting weather for ${location}...` };
    const data = await fetchWeather(location);
    yield { status: 'success', temperature: data.temp };
  },
});
```

### クライアントサイドツールの処理

```typescript
const { messages, addToolOutput } = useChat({
  onToolCall: async ({ toolCall }) => {
    if (toolCall.toolName === 'getLocation') {
      const result = await getUserLocation();
      addToolOutput({
        tool: 'getLocation',
        toolCallId: toolCall.toolCallId,
        output: result,
      });
    }
  },
});
```

### ツール承認フロー

```typescript
const sensitiveAction = tool({
  description: 'Perform sensitive action',
  inputSchema: z.object({ amount: z.number() }),
  needsApproval: async ({ amount }) => amount > 1000,
  execute: async ({ amount }) => {
    // 承認後に実行される
    return { success: true };
  },
});
```

### UIでのツール呼び出し表示

ツール呼び出しは assistant メッセージの `parts` として表示される。各ツールパーツは以下の状態を経由する：

- `input-streaming` - ツール入力が生成中
- `input-available` - 入力が完成
- `output-available` - 実行結果を受信
- `output-error` - 実行失敗
- `approval-requested` - ユーザー確認待ち

```tsx
{message.parts.map((part, index) => {
  if (part.type === 'tool-invocation') {
    const { toolName, state, input, output } = part.toolInvocation;

    return (
      <div key={index} className="tool-invocation">
        <div className="tool-name">{toolName}</div>

        {/* 入力の表示 */}
        {(state === 'input-available' || state === 'output-available') && (
          <pre className="tool-input">
            {JSON.stringify(input, null, 2)}
          </pre>
        )}

        {/* ローディング */}
        {state === 'input-streaming' && (
          <div className="loading">Executing...</div>
        )}

        {/* 結果の表示 */}
        {state === 'output-available' && (
          <pre className="tool-output">
            {JSON.stringify(output, null, 2)}
          </pre>
        )}

        {/* エラー */}
        {state === 'output-error' && (
          <div className="error">Tool execution failed</div>
        )}
      </div>
    );
  }
})}
```

### マルチステップの自動送信

ツール結果が揃ったら自動的に会話を続行する：

```typescript
import { useChat, lastAssistantMessageIsCompleteWithToolCalls } from '@ai-sdk/react';

const { messages } = useChat({
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
});
```

### 型安全性

```typescript
import { InferUITool, InferUITools } from '@ai-sdk/react';

type MyToolCall = InferUITool<typeof myToolSet>;
type MyToolResult = InferUITools<typeof myToolSet>;
```

---

## UIコンポーネント

### 利用可能なフック

| フック | 目的 | パッケージ |
|---|---|---|
| `useChat` | チャットインターフェース | `@ai-sdk/react` |
| `useCompletion` | テキスト補完 | `@ai-sdk/react` |
| `useObject` | ストリーミングJSONオブジェクト | `@ai-sdk/react` |

### 対応フレームワーク

| フレームワーク | パッケージ |
|---|---|
| React | `@ai-sdk/react` |
| Vue.js | `@ai-sdk/vue` |
| Svelte | `@ai-sdk/svelte` |
| Angular | `@ai-sdk/angular` |
| SolidJS | コミュニティ提供 |

### ChatGPTスタイルのチャットUI実装パターン

```tsx
import { useChat } from '@ai-sdk/react';

function ChatUI() {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    status,
    stop,
    error,
    regenerate,
  } = useChat({
    api: '/api/chat',
    experimental_throttle: 50,
  });

  return (
    <div className="chat-container">
      {/* メッセージ一覧 */}
      <div className="messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            <div className="avatar">
              {message.role === 'user' ? 'You' : 'AI'}
            </div>
            <div className="content">
              {message.parts.map((part, i) => {
                switch (part.type) {
                  case 'text':
                    return <p key={i}>{part.text}</p>;
                  case 'reasoning':
                    return (
                      <details key={i} className="reasoning">
                        <summary>Thinking...</summary>
                        <pre>{part.text}</pre>
                      </details>
                    );
                  case 'tool-invocation':
                    return <ToolDisplay key={i} part={part} />;
                  case 'file':
                    return <img key={i} src={part.url} alt="Generated" />;
                  default:
                    return null;
                }
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ステータス表示 */}
      {status === 'streaming' && (
        <button onClick={() => stop()}>Stop generating</button>
      )}

      {/* エラー表示 */}
      {error && (
        <div className="error">
          <p>Error: {error.message}</p>
          <button onClick={() => regenerate()}>Retry</button>
        </div>
      )}

      {/* 入力フォーム */}
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Type a message..."
          disabled={status !== 'ready'}
        />
        <button type="submit" disabled={status !== 'ready'}>
          Send
        </button>
      </form>
    </div>
  );
}
```

### ファイル添付（マルチモーダル）

```typescript
const { messages, sendMessage } = useChat();

// FileListを使用
sendMessage({
  text: 'What is in this image?',
  files: fileInputRef.current?.files,
});
```

---

## バックエンドとの統合

### Next.js（標準パターン）

```typescript
// app/api/chat/route.ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { convertToModelMessages } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
```

### FastAPIバックエンドとの統合

AI SDKのフロントエンドは、データストリームプロトコル（SSE）に準拠していればどのバックエンドとも連携可能である。PythonのFastAPIバックエンドと連携するための方法は複数ある。

#### 方法1: `fastapi-ai-sdk` ライブラリ（推奨）

```bash
pip install fastapi-ai-sdk
```

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi_ai_sdk import AIStreamBuilder, ai_endpoint

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/chat")
@ai_endpoint()
async def chat(request: dict):
    messages = request.get("messages", [])
    user_message = messages[-1]["content"] if messages else ""

    builder = AIStreamBuilder()

    # テキスト応答
    builder.text("Here is my response...")

    # ツール呼び出し結果を含める
    builder.tool_call(
        "execute_python",
        input_data={"code": "print('hello')"},
        output_data={"stdout": "hello", "stderr": ""}
    )

    builder.text("The code executed successfully.")

    return builder
```

フロントエンド側：

```typescript
import { useChat } from '@ai-sdk/react';

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: 'http://localhost:8000/api/chat',
  });

  return (/* UI */);
}
```

#### 方法2: `ai-datastream` ライブラリ（LangGraph連携向け）

```bash
pip install ai-datastream
```

```python
from fastapi import FastAPI
from ai_datastream.api.fastapi import (
    AiChatDataStreamAsyncResponse,
    FastApiDataStreamRequest,
)
from ai_datastream.agent.langgraph import LanggraphStreamer
from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI

app = FastAPI()

@app.post("/api/chat")
async def chat(request: FastApiDataStreamRequest):
    model = ChatOpenAI(model="gpt-4o")
    tools = [...]
    agent = create_react_agent(model, tools)
    streamer = LanggraphStreamer(agent)
    return AiChatDataStreamAsyncResponse(
        streamer,
        "You are a helpful assistant.",
        request.messages,
    )
```

#### 方法3: 手動SSE実装

データストリームプロトコルを直接実装することも可能。旧形式（文字プレフィックス方式）の例：

```python
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
import json

app = FastAPI()

@app.post("/api/chat")
async def chat(request: Request):
    body = await request.json()
    messages = body.get("messages", [])

    async def generate():
        # メッセージ開始
        yield f'f:{json.dumps({"messageId": "msg-123"})}\n'

        # テキストストリーミング
        for chunk in ["Hello", ", ", "world", "!"]:
            yield f'0:"{chunk}"\n'

        # ツール呼び出し
        yield f'9:{json.dumps({"toolCallId": "tool-1", "name": "execute_python", "args": {"code": "print(42)"}})}\n'

        # ツール結果
        yield f'a:{json.dumps({"toolCallId": "tool-1", "result": {"stdout": "42", "stderr": ""}})}\n'

        # 完了
        yield f'e:{json.dumps({"finishReason": "stop", "usage": {"promptTokens": 10, "completionTokens": 20}})}\n'

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "x-vercel-ai-ui-message-stream": "v1",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )
```

新形式（SSE `data:` プレフィックス方式、v1プロトコル）の場合は以下のフォーマットに従う：

```python
async def generate():
    yield f'data: {json.dumps({"type": "start", "messageId": "msg-123"})}\n\n'
    yield f'data: {json.dumps({"type": "text-start", "textId": "t-1"})}\n\n'
    yield f'data: {json.dumps({"type": "text-delta", "textId": "t-1", "delta": "Hello!"})}\n\n'
    yield f'data: {json.dumps({"type": "text-end", "textId": "t-1"})}\n\n'

    # ツール呼び出し
    yield f'data: {json.dumps({"type": "tool-input-start", "toolCallId": "tc-1", "toolName": "execute_python"})}\n\n'
    yield f'data: {json.dumps({"type": "tool-input-available", "toolCallId": "tc-1", "input": {"code": "print(42)"}})}\n\n'
    yield f'data: {json.dumps({"type": "tool-output-available", "toolCallId": "tc-1", "output": {"stdout": "42"}})}\n\n'

    yield f'data: {json.dumps({"type": "finish"})}\n\n'
    yield 'data: [DONE]\n\n'
```

---

## 今回の実装に必要な機能

### ChatGPTスタイルのチャットUI

`useChat` フックを使用して、以下の機能を持つチャットUIを構築する：

- メッセージの送受信とリアルタイムストリーミング表示
- ローディング状態の表示（`status === 'streaming'`）
- 応答の中断機能（`stop()`）
- エラーハンドリングとリトライ（`error`, `regenerate()`）
- マークダウンレンダリング（別途 `react-markdown` 等を導入）

```tsx
import { useChat } from '@ai-sdk/react';

function EnergyAnalysisChat() {
  const {
    messages, input, handleInputChange, handleSubmit,
    status, stop, error, regenerate, addToolOutput,
  } = useChat({
    api: 'http://localhost:8000/api/chat',
    experimental_throttle: 50,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall: async ({ toolCall }) => {
      // クライアントサイドツール処理（必要な場合）
    },
  });

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>
      {status === 'streaming' && (
        <button onClick={stop}>Stop</button>
      )}
      <ChatInput
        input={input}
        onChange={handleInputChange}
        onSubmit={handleSubmit}
        disabled={status !== 'ready'}
      />
    </div>
  );
}
```

### Python実行ツール（コードと結果の表示）

ユーザーの質問に応じてPythonコードを生成・実行し、その結果をチャットUI内に表示する。

#### サーバーサイドツール定義（Next.jsの場合）

```typescript
const executePython = tool({
  description: 'Execute Python code for data analysis',
  inputSchema: z.object({
    code: z.string().describe('Python code to execute'),
    description: z.string().describe('What this code does'),
  }),
  execute: async ({ code, description }) => {
    // FastAPIのコード実行エンドポイントを呼び出す
    const response = await fetch('http://localhost:8000/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const result = await response.json();
    return {
      code,
      description,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exit_code,
    };
  },
});
```

#### FastAPIバックエンド側で直接ツール実行する場合

FastAPIバックエンドがLLMのツール呼び出しを処理し、Python実行も行う構成が推奨される。これにより、フロントエンド（Next.js）はUI表示に専念し、バックエンド（FastAPI）がLLM呼び出しとツール実行を一元管理できる。

```python
# FastAPI側でのツール実行とストリーミング
@app.post("/api/chat")
@ai_endpoint()
async def chat(request: dict):
    messages = request.get("messages", [])
    builder = AIStreamBuilder()

    # LLMがPython実行を要求した場合
    code = "import pandas as pd\ndf = pd.read_csv('energy_data.csv')\nprint(df.describe())"
    result = execute_python_safely(code)

    builder.tool_call(
        "execute_python",
        input_data={"code": code, "description": "Analyze energy data"},
        output_data={
            "stdout": result["stdout"],
            "stderr": result["stderr"],
            "exit_code": result["exit_code"],
        },
    )

    builder.text("The analysis shows the following energy consumption patterns...")
    return builder
```

#### UIでのコードと結果の表示コンポーネント

```tsx
function ToolDisplay({ part }: { part: ToolInvocationPart }) {
  const { toolName, state, input, output } = part.toolInvocation;

  if (toolName === 'execute_python') {
    return (
      <div className="code-execution">
        {/* コード表示 */}
        {input?.code && (
          <div className="code-block">
            <div className="code-header">
              <span>Python</span>
              <span>{input.description}</span>
            </div>
            <pre><code>{input.code}</code></pre>
          </div>
        )}

        {/* 実行中 */}
        {(state === 'input-streaming' || state === 'input-available') &&
         state !== 'output-available' && (
          <div className="executing">
            <span className="spinner" /> Running...
          </div>
        )}

        {/* 実行結果 */}
        {state === 'output-available' && output && (
          <div className="output-block">
            <div className="output-header">Output</div>
            {output.stdout && (
              <pre className="stdout">{output.stdout}</pre>
            )}
            {output.stderr && (
              <pre className="stderr">{output.stderr}</pre>
            )}
          </div>
        )}

        {/* エラー */}
        {state === 'output-error' && (
          <div className="error">Execution failed</div>
        )}
      </div>
    );
  }

  // 汎用ツール表示
  return (
    <div className="tool-generic">
      <strong>{toolName}</strong>
      {state === 'output-available' && (
        <pre>{JSON.stringify(output, null, 2)}</pre>
      )}
    </div>
  );
}
```

### ML予測モデル実行ツール

エネルギー消費の予測モデル（LSTM、TFT、Transformer等）を実行し、結果を返すツール。

#### ツール定義

```typescript
const runMLPrediction = tool({
  description: 'Run ML prediction model for building energy consumption',
  inputSchema: z.object({
    buildingId: z.string().describe('Building ID (simsCode)'),
    modelType: z.enum(['lstm', 'tft', 'transformer']).describe('Model type'),
    startDate: z.string().describe('Prediction start date (YYYY-MM-DD)'),
    endDate: z.string().describe('Prediction end date (YYYY-MM-DD)'),
  }),
  execute: async ({ buildingId, modelType, startDate, endDate }) => {
    const response = await fetch('http://localhost:8000/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buildingId, modelType, startDate, endDate }),
    });
    return await response.json();
    // { predictions: [...], residuals: [...], anomalyScore: 0.85, plotUrl: "..." }
  },
});
```

#### UIでのML結果表示

```tsx
function MLResultDisplay({ output }: { output: MLPredictionResult }) {
  return (
    <div className="ml-result">
      <h4>Prediction Results: Building {output.buildingId}</h4>

      {/* メトリクス */}
      <div className="metrics">
        <div>Model: {output.modelType}</div>
        <div>Anomaly Score: {output.anomalyScore.toFixed(3)}</div>
        <div>RMSE: {output.rmse?.toFixed(2)}</div>
      </div>

      {/* 予測 vs 実績のグラフ */}
      {output.plotUrl && (
        <img src={output.plotUrl} alt="Prediction vs Actual" />
      )}

      {/* 残差サマリー */}
      {output.residualSummary && (
        <table>
          <thead>
            <tr><th>Metric</th><th>Value</th></tr>
          </thead>
          <tbody>
            <tr><td>Mean Residual</td><td>{output.residualSummary.mean}</td></tr>
            <tr><td>Max Residual</td><td>{output.residualSummary.max}</td></tr>
            <tr><td>Std Dev</td><td>{output.residualSummary.std}</td></tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
```

### FastAPIバックエンドとの連携アーキテクチャ

推奨アーキテクチャ：

```
[React Frontend]  <--useChat/SSE-->  [FastAPI Backend]  <---->  [LLM API]
     |                                      |
     |                                      |---> Python Execution Engine
     |                                      |---> ML Model Service
     |                                      |---> Data Access Layer
     v
  Vercel AI SDK                        fastapi-ai-sdk
  (@ai-sdk/react)                      or ai-datastream
```

**ポイント：**

1. **フロントエンド（React + TypeScript）**
   - `@ai-sdk/react` の `useChat` フックを使用
   - ツール呼び出しの結果をメッセージパーツとして表示
   - `api` パラメータでFastAPIのエンドポイントを指定

2. **バックエンド（FastAPI + Python）**
   - `fastapi-ai-sdk` または `ai-datastream` を使用してSSEストリーミングを実装
   - LLM APIの呼び出しとツール実行を一元管理
   - Python実行環境（サンドボックス化推奨）とMLモデルの推論を提供
   - データストリームプロトコル（`x-vercel-ai-ui-message-stream: v1`）に準拠

3. **CORS設定**
   ```python
   from fastapi.middleware.cors import CORSMiddleware

   app.add_middleware(
       CORSMiddleware,
       allow_origins=["http://localhost:3000"],
       allow_credentials=True,
       allow_methods=["*"],
       allow_headers=["*"],
   )
   ```

4. **主要エンドポイント**
   - `POST /api/chat` - チャットメッセージの処理（SSEストリーミング）
   - `POST /api/execute` - Python コード実行
   - `POST /api/predict` - MLモデル推論
   - `GET /api/buildings` - ビルデータの取得
   - `GET /api/rankings` - ビルランキングの取得

---

## 参考リソース

- [AI SDK ドキュメント](https://ai-sdk.dev/docs) - 公式ドキュメント
- [AI SDK UI: Stream Protocol](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol) - ストリームプロトコル仕様
- [fastapi-ai-sdk](https://github.com/doganarif/fastapi-ai-sdk) - FastAPI用ヘルパーライブラリ
- [py-ai-datastream](https://github.com/elementary-data/py-ai-datastream) - Pythonデータストリーム実装
- [Vercel AI SDK Python Streaming Template](https://vercel.com/templates/next.js/ai-sdk-python-streaming) - 公式テンプレート
- [AI SDK LLMs.txt](https://ai-sdk.dev/llms.txt) - 機械可読ドキュメント
