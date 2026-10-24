import { vi } from 'vitest';

// Loaded for every automated suite: real keys in a developer environment can
// never cause an accidental provider request from these tests.
const geminiMock = vi.hoisted(() => ({
  generateContent: vi.fn(),
  clientOptions: vi.fn(),
}));

export { geminiMock };

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: geminiMock.generateContent };
    constructor(options: unknown) {
      geminiMock.clientOptions(options);
    }
  },
}));
