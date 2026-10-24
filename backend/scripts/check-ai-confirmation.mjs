import { loadBackendEnvironment } from '../dist/database/database.config.js';
import { AiService } from '../dist/ai/ai.service.js';

loadBackendEnvironment();
// No database access: exactly one generation with synthetic timing only.
const noDatabase = {
  createQueryBuilder() {
    throw new Error('The synthetic live check must not access a database.');
  },
};
const diagnostics = {};
const result = await new AiService(noDatabase).generateConfirmation(
  {
    startsAt: new Date('2030-06-15T08:00:00Z'),
    durationMinutes: 30,
  },
  diagnostics,
);
console.log(`Message source: ${result.confirmationMessageSource}`);
console.log(result.confirmationMessage);
if (result.confirmationMessageSource !== 'ai') {
  console.error(`Fallback category: ${diagnostics.reason ?? 'unknown'}`);
  if (diagnostics.httpStatus)
    console.error(`Provider HTTP status: ${diagnostics.httpStatus}`);
  console.error(
    'Live AI generation was not verified. Configuration, quota, provider availability, timeout, or output validation may have caused fallback. No credentials or provider error details are displayed.',
  );
  process.exitCode = 1;
}
