const API = "https://api.anthropic.com/v1/messages";
const VERSION = "2023-06-01";

export type ClaudeMessage = {
  role: "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | {
            type: "image";
            source: { type: "base64"; media_type: string; data: string };
          }
      >;
};

export type ClaudeOptions = {
  system?: string;
  messages: ClaudeMessage[];
  max_tokens?: number;
  label?: string;
};

export type ClaudeUsage = {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

export type ClaudeResult = {
  text: string;
  usage: ClaudeUsage;
};

// Claude Sonnet 4.6 public pricing (USD per 1M tokens)
const PRICE = {
  "claude-sonnet-4-6": { in: 3, out: 15, cache_write: 3.75, cache_read: 0.3 },
  "claude-opus-4-6": { in: 15, out: 75, cache_write: 18.75, cache_read: 1.5 },
  "claude-haiku-4-5": { in: 1, out: 5, cache_write: 1.25, cache_read: 0.1 },
} as const;

const USD_KRW = 1380;

export function estimateCost(u: ClaudeUsage): { usd: number; krw: number } {
  const p = (PRICE as Record<string, (typeof PRICE)[keyof typeof PRICE]>)[
    u.model
  ];
  if (!p) return { usd: 0, krw: 0 };
  const usd =
    (u.input_tokens * p.in +
      u.output_tokens * p.out +
      (u.cache_creation_input_tokens ?? 0) * p.cache_write +
      (u.cache_read_input_tokens ?? 0) * p.cache_read) /
    1_000_000;
  return { usd, krw: usd * USD_KRW };
}

export async function callClaude(opts: ClaudeOptions): Promise<ClaudeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");

  const started = Date.now();
  const res = await fetch(API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.max_tokens ?? 1024,
      system: opts.system,
      messages: opts.messages,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    content: Array<{ type: string; text?: string }>;
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
  const text = data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");

  const usage: ClaudeUsage = {
    model,
    input_tokens: data.usage?.input_tokens ?? 0,
    output_tokens: data.usage?.output_tokens ?? 0,
    cache_creation_input_tokens: data.usage?.cache_creation_input_tokens,
    cache_read_input_tokens: data.usage?.cache_read_input_tokens,
  };

  const cost = estimateCost(usage);
  const label = opts.label ?? "claude";
  const elapsed = Date.now() - started;
  console.log(
    `[${label}] model=${model} in=${usage.input_tokens} out=${usage.output_tokens}` +
      (usage.cache_read_input_tokens
        ? ` cache_read=${usage.cache_read_input_tokens}`
        : "") +
      ` cost=$${cost.usd.toFixed(5)} (${Math.round(cost.krw)}원) elapsed=${elapsed}ms`,
  );

  return { text, usage };
}

export function extractJson<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in response");
  return JSON.parse(match[0]) as T;
}

// ─────── tool use (agent) ───────

export type ToolDef = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export type ToolExecutor = (input: Record<string, unknown>) => Promise<unknown>;

export type AgentOptions = {
  system?: string;
  tools: ToolDef[];
  executors: Record<string, ToolExecutor>;
  messages: ClaudeMessage[];
  max_tokens?: number;
  label?: string;
  maxSteps?: number;
};

type ToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};

type TextBlock = { type: "text"; text: string };
type AnyBlock = TextBlock | ToolUseBlock | { type: string; [k: string]: unknown };

export async function callClaudeAgent(opts: AgentOptions): Promise<ClaudeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");

  const maxSteps = opts.maxSteps ?? 6;
  const messages: Array<{ role: "user" | "assistant"; content: unknown }> =
    opts.messages.map((m) => ({ role: m.role, content: m.content }));

  const totalUsage: ClaudeUsage = {
    model,
    input_tokens: 0,
    output_tokens: 0,
  };

  for (let step = 0; step < maxSteps; step++) {
    const started = Date.now();
    const res = await fetch(API, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: opts.max_tokens ?? 1024,
        system: opts.system,
        tools: opts.tools,
        messages,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Claude ${res.status}: ${text}`);
    }

    const data = (await res.json()) as {
      content: AnyBlock[];
      stop_reason: string;
      usage?: {
        input_tokens: number;
        output_tokens: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
      };
    };

    totalUsage.input_tokens += data.usage?.input_tokens ?? 0;
    totalUsage.output_tokens += data.usage?.output_tokens ?? 0;

    const label = opts.label ?? "claude";
    const elapsed = Date.now() - started;
    console.log(
      `[${label}.step${step}] in=${data.usage?.input_tokens ?? 0} out=${data.usage?.output_tokens ?? 0} stop=${data.stop_reason} elapsed=${elapsed}ms`,
    );

    if (data.stop_reason !== "tool_use") {
      const text = data.content
        .filter((b): b is TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      const cost = estimateCost(totalUsage);
      console.log(
        `[${label}.total] in=${totalUsage.input_tokens} out=${totalUsage.output_tokens} cost=$${cost.usd.toFixed(5)} (${Math.round(cost.krw)}원)`,
      );
      return { text, usage: totalUsage };
    }

    messages.push({ role: "assistant", content: data.content });

    const toolUses = data.content.filter(
      (b): b is ToolUseBlock => b.type === "tool_use",
    );
    const toolResults = [] as Array<{
      type: "tool_result";
      tool_use_id: string;
      content: string;
    }>;
    for (const tu of toolUses) {
      const exec = opts.executors[tu.name];
      let result: unknown;
      try {
        result = exec
          ? await exec(tu.input)
          : { error: `unknown tool: ${tu.name}` };
        console.log(
          `[${label}.tool:${tu.name}] input=${JSON.stringify(tu.input)}`,
        );
      } catch (e) {
        result = { error: e instanceof Error ? e.message : "tool failed" };
      }
      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify(result),
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  throw new Error("agent max steps reached");
}
