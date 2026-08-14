import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Downly bootstrap', () => {
  it('defines the localized Downly product name', () => {
    const messagesPath = resolve(
      process.cwd(),
      'public/_locales/en/messages.json',
    );
    const messages = JSON.parse(readFileSync(messagesPath, 'utf8')) as {
      extensionName: { message: string };
    };

    expect(messages.extensionName.message).toBe('Downly');
  });
});
