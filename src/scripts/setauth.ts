/**
 * CLI script to manage authorized WhatsApp admin numbers directly in .env
 * Use this when there is no authenticated user to run !setauth via WhatsApp.
 *
 * Usage (via npm):
 *   npm run setauth -- add +27123456789
 *   npm run setauth -- remove +27123456789
 *   npm run setauth -- set +27123456789        (replaces ALL numbers with this one)
 *   npm run setauth -- list
 *
 * Usage (direct):
 *   npx ts-node -r dotenv/config src/scripts/setauth.ts add +27123456789
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const PHONE_RE = /^\+\d{7,15}$/;
const ENV_PATH = resolve(process.cwd(), '.env');

function loadEnv(): string {
  if (!existsSync(ENV_PATH)) {
    console.error(`❌ .env file not found at: ${ENV_PATH}`);
    process.exit(1);
  }
  return readFileSync(ENV_PATH, 'utf-8');
}

function getCurrentNumbers(envContent: string): string[] {
  const match = envContent.match(/^AUTHORIZED_NUMBERS=(.*)$/m);
  if (!match) return [];
  return match[1].split(',').map(n => n.trim()).filter(n => n.length > 0);
}

function saveNumbers(envContent: string, numbers: string[]): void {
  const value = numbers.join(',');
  let updated: string;

  if (/^AUTHORIZED_NUMBERS=.*$/m.test(envContent)) {
    updated = envContent.replace(/^AUTHORIZED_NUMBERS=.*$/m, `AUTHORIZED_NUMBERS=${value}`);
  } else {
    updated = envContent.trimEnd() + `\nAUTHORIZED_NUMBERS=${value}\n`;
  }

  writeFileSync(ENV_PATH, updated, 'utf-8');
}

// Parse args — skip "node" and script path
const args = process.argv.slice(2);
// If the first arg looks like a phone number, treat it as shorthand for "add"
// e.g.  npm run setauth +27735286621   →  same as  npm run setauth -- add +27735286621
if (args[0] && PHONE_RE.test(args[0])) {
  args.unshift('add');
}

const subcommand = args[0]?.toLowerCase();

if (!subcommand || subcommand === 'help') {
  console.log(`
📋 setauth CLI — manage authorized admin numbers in .env

Commands:
  add +<number>      Add a number to the authorized list
  remove +<number>   Remove a number from the authorized list
  set +<number>      Replace ALL authorized numbers with this one
  list               Show current authorized numbers
  help               Show this help message

Example:
  npm run setauth -- add +27735286621
`);
  process.exit(0);
}

if (subcommand === 'list') {
  const current = getCurrentNumbers(loadEnv());
  if (current.length === 0) {
    console.log('⚠️  No authorized numbers configured.');
  } else {
    console.log(`✅ Authorized numbers (${current.length}):`);
    current.forEach(n => console.log(`   ${n}`));
  }
  process.exit(0);
}

if (subcommand === 'add' || subcommand === 'remove' || subcommand === 'set') {
  const number = args[1]?.trim();

  if (!number || !PHONE_RE.test(number)) {
    console.error('❌ Invalid or missing phone number. Use international format: +27123456789');
    process.exit(1);
  }

  const envContent = loadEnv();
  const current = getCurrentNumbers(envContent);

  let updated: string[];

  if (subcommand === 'add') {
    if (current.includes(number)) {
      console.log(`ℹ️  ${number} is already authorized. No changes made.`);
      process.exit(0);
    }
    updated = [...current, number];
    saveNumbers(envContent, updated);
    console.log(`✅ Added: ${number}`);
    console.log(`📋 Authorized count: ${updated.length}`);

  } else if (subcommand === 'remove') {
    if (!current.includes(number)) {
      console.log(`ℹ️  ${number} is not in the authorized list. No changes made.`);
      process.exit(0);
    }
    updated = current.filter(n => n !== number);
    if (updated.length === 0) {
      console.error('❌ Cannot remove the last authorized number — the bot would be permanently locked out.');
      process.exit(1);
    }
    saveNumbers(envContent, updated);
    console.log(`✅ Removed: ${number}`);
    console.log(`📋 Authorized count: ${updated.length}`);

  } else {
    // set — replace all
    updated = [number];
    saveNumbers(envContent, updated);
    console.log(`✅ Authorized number set to: ${number} (all previous numbers replaced)`);
  }

  console.log('🔄 Restart the bot for changes to take effect (or use !setauth via WhatsApp if bot is running).');
  process.exit(0);
}

console.error(`❌ Unknown command: "${subcommand}". Run with "help" to see usage.`);
process.exit(1);
