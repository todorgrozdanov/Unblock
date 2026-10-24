import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GoogleGenAI } from '@google/genai';
import { Repository } from 'typeorm';
import { Booking } from '../database/entities/booking.entity.js';

export interface ConfirmationMessage {
  confirmationMessage: string;
  confirmationMessageSource: 'ai' | 'fallback';
}
interface SessionDetails {
  startsAt: Date;
  durationMinutes: number;
}

// Optional local-check diagnostics; never included in an HTTP response.
export interface AiDiagnostics {
  reason?:
    | 'missing-configuration'
    | 'capacity'
    | 'timeout'
    | 'provider-error'
    | 'invalid-output';
  httpStatus?: number;
}

export function fallbackConfirmation(): ConfirmationMessage {
  return {
    confirmationMessage:
      'Welcome to Unblock! Your consultation is confirmed. Please bring one concrete example of a repetitive task to explore together.',
    confirmationMessageSource: 'fallback',
  };
}

// Only these two sentences are generated. The factual session sentence is built
// locally, so the model cannot change the booked date, time, or duration.
function validSentence(value: unknown, maxLength: number): value is string {
  return (
    typeof value === 'string' &&
    value.length <= maxLength &&
    /^[^.!?\n\r<>\[\]{}*`]+[.!]$/.test(value) &&
    !/[\d@]|https?:|www\./i.test(value) &&
    !/\b(email|e-mail|mail|sent|send|link|meeting|guarantee\w*|promise\w*|will|definit\w*|complete\w*|finish\w*|scheduled?|confirm\w*|book\w*|done|built|created)\b/i.test(
      value,
    )
  );
}

@Injectable()
export class AiService {
  private active = 0;
  private minuteStarted = 0;
  private callsThisMinute = 0;

  constructor(
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
  ) {}

  async generateForBooking(bookingId: string): Promise<ConfirmationMessage> {
    let session: SessionDetails | undefined;
    try {
      // Select timing only: do not even load attendee fields for this endpoint.
      session = await this.bookings
        .createQueryBuilder('booking')
        .innerJoin('booking.slot', 'slot')
        .select('slot.startsAt', 'startsAt')
        .addSelect('slot.durationMinutes', 'durationMinutes')
        .where('booking.id = :bookingId', { bookingId })
        .getRawOne<SessionDetails>();
    } catch {
      throw new InternalServerErrorException('Unable to load booking session');
    }
    if (!session) throw new NotFoundException('Booking not found');
    return this.generateConfirmation(session);
  }

  async generateConfirmation(
    session: SessionDetails,
    diagnostics?: AiDiagnostics,
  ): Promise<ConfirmationMessage> {
    const fallback = (reason: AiDiagnostics['reason']) => {
      if (diagnostics) diagnostics.reason = reason;
      return fallbackConfirmation();
    };
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    const model = process.env.GEMINI_MODEL?.trim();
    if (!apiKey || !model) return fallback('missing-configuration');
    if (Date.now() - this.minuteStarted >= 60_000) {
      this.minuteStarted = Date.now();
      this.callsThisMinute = 0;
    }
    // Global cap supplements the per-IP guards; hitting it never fails a booking.
    if (this.active >= 2 || this.callsThisMinute >= 10)
      return fallback('capacity');
    this.active++;
    this.callsThisMinute++;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failure: AiDiagnostics['reason'] = 'provider-error';
    try {
      const timezone = 'Europe/Skopje';
      const date = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(session.startsAt);
      const time = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZoneName: 'shortOffset',
      }).format(session.startsAt);
      // Build a fresh object explicitly; never serialize a Booking or Slot entity.
      const context = {
        date,
        time,
        durationMinutes: session.durationMinutes,
        timezone,
      };
      const client = new GoogleGenAI({ apiKey, vertexai: false });
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('AI deadline'));
        }, 10_000);
      });
      const response = await Promise.race([
        client.models.generateContent({
          model,
          contents: JSON.stringify(context),
          config: {
            systemInstruction:
              'Write a friendly English welcome and preparation note for an Unblock automation consultation that has already been booked. Return JSON with exactly welcome and preparation. Each value must be one short plain-text sentence. welcome must start with Welcome, and preparation must start with Please bring one concrete example of a repetitive task. Do not include dates, times, numbers, attendee information, HTML, Markdown, URLs, scheduling claims, email claims, meeting links, or promises about completing work. The application adds the factual confirmation sentence separately.',
            responseMimeType: 'application/json',
            responseJsonSchema: {
              type: 'object',
              properties: {
                welcome: { type: 'string' },
                preparation: { type: 'string' },
              },
              required: ['welcome', 'preparation'],
              additionalProperties: false,
            },
            maxOutputTokens: 256,
            abortSignal: controller.signal,
            // The SDK also sends this as X-Server-Timeout. Google requires at
            // least 10 seconds. The independent deadline also bounds our wait.
            httpOptions: { timeout: 10_000, retryOptions: { attempts: 1 } },
          },
        }),
        timeout,
      ]);
      failure = 'invalid-output';
      if (response.candidates?.[0]?.finishReason !== 'STOP' || !response.text)
        return fallback('invalid-output');
      const output: unknown = JSON.parse(response.text);
      if (!output || typeof output !== 'object' || Array.isArray(output))
        return fallback('invalid-output');
      const words = output as Record<string, unknown>;
      if (
        Object.keys(words).length !== 2 ||
        !validSentence(words.welcome, 100) ||
        !/^Welcome\b/.test(words.welcome) ||
        !validSentence(words.preparation, 180) ||
        !/^Please bring one concrete example of a repetitive task\b/.test(
          words.preparation,
        )
      )
        return fallback('invalid-output');
      return {
        confirmationMessage: `${words.welcome} Your ${session.durationMinutes}-minute consultation is confirmed for ${date} at ${time} (${timezone}). ${words.preparation}`,
        confirmationMessageSource: 'ai',
      };
    } catch (error) {
      // Never log provider errors: they may contain request or authentication data.
      if (
        diagnostics &&
        error &&
        typeof error === 'object' &&
        'status' in error &&
        typeof error.status === 'number' &&
        Number.isInteger(error.status) &&
        error.status >= 100 &&
        error.status <= 599
      )
        diagnostics.httpStatus = error.status;
      return fallback(controller.signal.aborted ? 'timeout' : failure);
    } finally {
      if (timer) clearTimeout(timer);
      controller.abort();
      this.active--;
    }
  }
}
