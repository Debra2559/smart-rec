import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Lovable AI Gateway provider（Chat Completions 路径，仅用于非 OpenAI 模型，
 * 例如转写用的 google/gemini-3.5-transcribe 走 /v1/audio/transcriptions，不经此处）。
 */
export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable-ai-gateway",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}

/** 网关把 run-id 放在响应头，这里透传以便追踪。 */
export function getLovableAiGatewayRunId(request: Request): string | undefined {
  return request.headers.get("X-Lovable-AIG-Run-ID") ?? undefined;
}

export function createLovableAiGatewayRunIdFetch(_initialRunId?: string) {
  return {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),
    get runId() {
      return _initialRunId;
    },
  };
}

export function getLovableAiGatewayResponseHeaders(
  _runId?: string,
  extra: Record<string, string> = {},
): HeadersInit {
  return { ...extra };
}

export function withLovableAiGatewayRunIdHeader<T>(response: T, _fetch: { runId?: string }): T {
  return response;
}
