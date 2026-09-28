import { MockLanguageModelV4 } from 'ai/test';

type MockSettings = NonNullable<ConstructorParameters<typeof MockLanguageModelV4>[0]>;
type Generate = Extract<NonNullable<MockSettings['doGenerate']>, (...args: never[]) => unknown>;
export type ModelCall = Parameters<Generate>[0];
export type Reply = (call: ModelCall, index: number) => unknown;

export const COST_PER_CALL = 0.0002;

export function promptText(call: ModelCall): { system: string; user: string } {
  let system = '';
  let user = '';
  for (const message of call.prompt) {
    if (message.role === 'system') system += message.content;
    if (message.role === 'user') {
      for (const part of message.content) if (part.type === 'text') user += part.text;
    }
  }
  return { system, user };
}

export function schemaOf(call: ModelCall): Record<string, unknown> {
  const format = call.responseFormat;
  if (format?.type !== 'json' || !format.schema) throw new Error('the call asked for no JSON schema');
  return format.schema as Record<string, unknown>;
}

export function optionLines(call: ModelCall): { id: string; text: string }[] {
  const lines = promptText(call).user.split('\n');
  return lines.flatMap((line) => {
    const match = /^- (\d+): (.*)$/.exec(line);
    return match ? [{ id: match[1] as string, text: match[2] as string }] : [];
  });
}

export function choose(call: ModelCall, pick: (text: string) => boolean, reason = 'It looks best.'): { reason: string; choice: string } {
  const option = optionLines(call).find((line) => pick(line.text));
  if (!option) throw new Error(`no option matches in:\n${optionLines(call).map((line) => line.text).join('\n')}`);
  return { reason, choice: option.id };
}

export function mockModel(reply: Reply, modelId = 'test/model'): MockLanguageModelV4 {
  let calls = 0;
  return new MockLanguageModelV4({
    provider: 'test',
    modelId,
    doGenerate: async (call) => {
      const answer: unknown = await reply(call, calls++);
      if (answer instanceof Error) throw answer;
      return {
        content: [{ type: 'text', text: typeof answer === 'string' ? answer : JSON.stringify(answer) }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 1200, noCache: 1200, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 30, text: 30, reasoning: 0 },
        },
        providerMetadata: { openrouter: { usage: { cost: COST_PER_CALL } } },
        warnings: [],
      };
    },
  });
}

export function hangingModel(): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    provider: 'test',
    modelId: 'test/slow',
    doGenerate: (call) =>
      new Promise((_, reject) => {
        const signal = call.abortSignal;
        const stop = (): void => reject(signal?.reason ?? new Error('aborted'));
        if (signal?.aborted) stop();
        else signal?.addEventListener('abort', stop, { once: true });
      }),
  });
}
