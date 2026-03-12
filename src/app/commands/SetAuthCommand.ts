import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import type { Message } from 'whatsapp-web.js';
import { BaseCommand } from '../utils/BaseCommand';
import { authService } from '../utils/AuthService';

/**
 * Command to update the authorized admin phone number at runtime.
 * Updates both the .env file on disk and the in-memory AuthService — no restart needed.
 * Requires authentication (current authorized number must run this command).
 *
 * Usage:
 *   !setauth +27638980888         — replace all authorized numbers with this one
 *   !setauth add +27638980888     — add an additional authorized number
 *   !setauth remove +27638980888  — remove a specific authorized number
 */
export class SetAuthCommand extends BaseCommand {
  name = 'setauth';
  description = 'Update authorized admin number(s) at runtime (Admin only)';
  aliases = ['addauth', 'auth'];

  private static readonly PHONE_RE = /^\+\d{7,15}$/;

  async execute(message: Message, args: string[]): Promise<Message | void> {
    const isAuthorized = await authService.isAuthorized(message);
    if (!isAuthorized) return authService.sendUnauthorizedMessage(message);

    await this.sendTyping(message);

    if (args.length === 0) {
      return message.reply(
        '❓ *Usage*\n\n' +
        '`!setauth +27123456789`           — set as the only admin\n' +
        '`!setauth add +27123456789`       — add an extra admin\n' +
        '`!setauth remove +27123456789`    — remove an admin\n\n' +
        '_Always include country code with + prefix_'
      );
    }

    const subcommand = args[0].toLowerCase();

    // !setauth add +number  /  !setauth remove +number
    if (subcommand === 'add' || subcommand === 'remove') {
      const number = args[1]?.trim();
      if (!number || !SetAuthCommand.PHONE_RE.test(number)) {
        return message.reply('❌ Invalid number. Use format: `+27123456789`');
      }

      const current = (process.env.AUTHORIZED_NUMBERS || '')
        .split(',')
        .map(n => n.trim())
        .filter(n => n.length > 0);

      let updated: string[];
      if (subcommand === 'add') {
        if (current.includes(number)) {
          return message.reply(`ℹ️ ${number} is already authorized.`);
        }
        updated = [...current, number];
      } else {
        updated = current.filter(n => n !== number);
        if (updated.length === 0) {
          return message.reply('❌ Cannot remove the last authorized number — the bot would be permanently locked out.');
        }
      }

      this.persistAndReload(updated);
      const verb = subcommand === 'add' ? 'added' : 'removed';
      return message.reply(
        `✅ *Number ${verb}*\n\n` +
        `📱 \`${number}\`\n\n` +
        `_Authorized count: ${updated.length}_`
      );
    }

    // !setauth +number  — replace all
    const number = args[0].trim();
    if (!SetAuthCommand.PHONE_RE.test(number)) {
      return message.reply('❌ Invalid number. Use format: `+27123456789`');
    }

    this.persistAndReload([number]);
    return message.reply(
      '✅ *Authorized number updated*\n\n' +
      `📱 \`${number}\` is now the only admin\n\n` +
      '_Changes are live — no restart needed_'
    );
  }

  /** Write new numbers to .env and reload AuthService in-memory */
  private persistAndReload(numbers: string[]): void {
    const envPath = resolve(process.cwd(), '.env');
    let envContent = readFileSync(envPath, 'utf-8');
    const value = numbers.join(',');

    if (/^AUTHORIZED_NUMBERS=.*$/m.test(envContent)) {
      envContent = envContent.replace(/^AUTHORIZED_NUMBERS=.*$/m, `AUTHORIZED_NUMBERS=${value}`);
    } else {
      envContent = envContent.trimEnd() + `\nAUTHORIZED_NUMBERS=${value}\n`;
    }

    writeFileSync(envPath, envContent, 'utf-8');
    process.env.AUTHORIZED_NUMBERS = value;
    authService.reloadFromEnv();
  }
}
