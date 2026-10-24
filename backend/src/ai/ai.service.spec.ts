import type { Repository } from 'typeorm';
import type { Booking } from '../database/entities/booking.entity.js';
import { geminiMock } from '../../test/gemini.mock.js';
import { AiService, fallbackConfirmation } from './ai.service.js';

const session = {
  startsAt: new Date('2027-01-15T09:30:00Z'),
  durationMinutes: 30,
};
const words = {
  welcome: 'Welcome to Unblock!',
  preparation:
    'Please bring one concrete example of a repetitive task to explore together.',
};
const response = (text = JSON.stringify(words), finishReason = 'STOP') => ({
  text,
  candidates: [{ finishReason }],
});

describe('Gemini confirmation (SDK mocked, no database)', () => {
  let ai: AiService;
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('GEMINI_API_KEY', 'unit-test-key-not-a-real-credential');
    vi.stubEnv('GEMINI_MODEL', 'gemini-3.5-flash-lite');
    geminiMock.generateContent.mockResolvedValue(response());
    ai = new AiService({} as Repository<Booking>);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('sends only timing, then inserts verified details into three plain-text sentences', async () => {
    const result = await ai.generateConfirmation({
      ...session,
      name: 'PRIVATE NAME',
      email: 'private@example.invalid',
      taskDescription: 'PRIVATE TASK',
      id: 'PRIVATE ID',
    } as typeof session);
    expect(result.confirmationMessageSource).toBe('ai');
    expect(result.confirmationMessage).toBe(
      'Welcome to Unblock! Your 30-minute consultation is confirmed for 15 January 2027 at 10:30 GMT+1 (Europe/Skopje). Please bring one concrete example of a repetitive task to explore together.',
    );
    const call = geminiMock.generateContent.mock.calls[0][0];
    expect(JSON.parse(call.contents)).toEqual({
      date: '15 January 2027',
      time: '10:30 GMT+1',
      durationMinutes: 30,
      timezone: 'Europe/Skopje',
    });
    expect(JSON.stringify(call)).not.toMatch(
      /PRIVATE|private@example|unit-test-key/,
    );
    expect(geminiMock.clientOptions).toHaveBeenCalledWith({
      apiKey: 'unit-test-key-not-a-real-credential',
      vertexai: false,
    });
    expect(call.model).toBe('gemini-3.5-flash-lite');
    expect(call.config.maxOutputTokens).toBe(256);
    expect(call.config.httpOptions).toEqual({
      timeout: 10_000,
      retryOptions: { attempts: 1 },
    });
    expect(call.config.abortSignal.aborted).toBe(true); // finished requests release resources
  });

  it('accepts a welcome describing an automation consultation without a completion promise', async () => {
    geminiMock.generateContent.mockResolvedValue(
      response(
        JSON.stringify({
          welcome: 'Welcome to your Unblock automation consultation.',
          preparation:
            'Please bring one concrete example of a repetitive task to discuss.',
        }),
      ),
    );
    const result = await ai.generateConfirmation(session);
    expect(result.confirmationMessageSource).toBe('ai');
    expect(result.confirmationMessage).toContain(
      'Welcome to your Unblock automation consultation.',
    );
  });

  it.each(['GEMINI_API_KEY', 'GEMINI_MODEL'])(
    'uses fallback without constructing the SDK when %s is missing',
    async (key) => {
      vi.stubEnv(key, '');
      expect(await ai.generateConfirmation(session)).toEqual(
        fallbackConfirmation(),
      );
      expect(geminiMock.clientOptions).not.toHaveBeenCalled();
      expect(geminiMock.generateContent).not.toHaveBeenCalled();
    },
  );

  it('returns fallback on provider rejection without logging its details or retrying', async () => {
    const log = vi.spyOn(console, 'error');
    geminiMock.generateContent.mockRejectedValue(
      new Error('Private provider/authentication details'),
    );
    expect(await ai.generateConfirmation(session)).toEqual(
      fallbackConfirmation(),
    );
    expect(geminiMock.generateContent).toHaveBeenCalledOnce();
    expect(log).not.toHaveBeenCalled();
  });

  it('reports only a safe category and HTTP status to the optional local check', async () => {
    geminiMock.generateContent.mockRejectedValue(
      Object.assign(new Error('PRIVATE KEY AND REQUEST DATA'), { status: 429 }),
    );
    const diagnostics = {};
    const result = await ai.generateConfirmation(session, diagnostics);
    expect(result).toEqual(fallbackConfirmation());
    expect(diagnostics).toEqual({ reason: 'provider-error', httpStatus: 429 });
    expect(JSON.stringify({ result, diagnostics })).not.toContain('PRIVATE');
  });

  it('returns fallback within ten seconds even if the provider never settles', async () => {
    vi.useFakeTimers();
    geminiMock.generateContent.mockImplementation(() => new Promise(() => {}));
    const pending = ai.generateConfirmation(session);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toEqual(fallbackConfirmation());
    expect(
      geminiMock.generateContent.mock.calls[0][0].config.abortSignal.aborted,
    ).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    '',
    '   ',
    'not JSON',
    '{}',
    '[]',
    JSON.stringify({ ...words, welcome: '<b>Welcome!</b>' }),
    JSON.stringify({ ...words, welcome: 'Welcome! An email was sent.' }),
    JSON.stringify({
      ...words,
      preparation:
        'Please bring one concrete example of a repetitive task and we will finish it.',
    }),
    JSON.stringify({
      ...words,
      preparation:
        'Please bring one concrete example of a repetitive task at https://example.com.',
    }),
    JSON.stringify({ ...words, welcome: 'Welcome ' + 'x'.repeat(110) + '!' }),
    JSON.stringify({ ...words, extra: 'unexpected' }),
    JSON.stringify({ welcome: 'Welcome to Unblock!', preparation: 123 }),
  ])('rejects empty, malformed, unsafe or invalid output %#', async (text) => {
    geminiMock.generateContent.mockResolvedValue(response(text));
    expect(await ai.generateConfirmation(session)).toEqual(
      fallbackConfirmation(),
    );
  });

  it.each(['MAX_TOKENS', 'SAFETY'])(
    'does not display truncated or blocked output: %s',
    async (finishReason) => {
      geminiMock.generateContent.mockResolvedValue(
        response(JSON.stringify(words), finishReason),
      );
      expect(await ai.generateConfirmation(session)).toEqual(
        fallbackConfirmation(),
      );
    },
  );

  it('caps concurrent provider calls and clears deadline timers', async () => {
    vi.useFakeTimers();
    geminiMock.generateContent.mockImplementation(() => new Promise(() => {}));
    const first = ai.generateConfirmation(session);
    const second = ai.generateConfirmation(session);
    expect(await ai.generateConfirmation(session)).toEqual(
      fallbackConfirmation(),
    );
    expect(geminiMock.generateContent).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(10_000);
    await Promise.all([first, second]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('caps provider calls per minute across both entry points', async () => {
    vi.useFakeTimers();
    for (let i = 0; i < 10; i++) await ai.generateConfirmation(session);
    expect(await ai.generateConfirmation(session)).toEqual(
      fallbackConfirmation(),
    );
    expect(geminiMock.generateContent).toHaveBeenCalledTimes(10);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(
      (await ai.generateConfirmation(session)).confirmationMessageSource,
    ).toBe('ai');
  });
});
