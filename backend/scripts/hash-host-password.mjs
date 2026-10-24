import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { hashHostPassword } from '../dist/host-auth/password.js';

if (!process.stdin.isTTY) {
  console.error(
    'Run this command directly in your local interactive terminal.',
  );
  process.exit(1);
}

async function hiddenQuestion(prompt) {
  process.stdout.write(prompt);
  const hiddenOutput = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  const reader = createInterface({
    input: process.stdin,
    output: hiddenOutput,
    terminal: true,
  });
  reader.on('SIGINT', () => {
    reader.close();
    process.stdout.write('\n');
    process.exit(130);
  });
  return new Promise((resolve) =>
    reader.question('', (answer) => {
      reader.close();
      process.stdout.write('\n');
      resolve(answer);
    }),
  );
}

const password = await hiddenQuestion(
  'Choose a host password (input hidden): ',
);
const confirmation = await hiddenQuestion(
  'Repeat the password (input hidden): ',
);
if (
  password !== confirmation ||
  password.length < 12 ||
  password.length > 256
) {
  console.error('Passwords must match and contain 12–256 characters.');
  process.exit(1);
}
console.log(
  'Copy this line only into backend/.env (not .env.example or chat):',
);
console.log(`HOST_PASSWORD_HASH='${await hashHostPassword(password)}'`);
