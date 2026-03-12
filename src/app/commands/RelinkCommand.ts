import { resolve } from 'path';
import * as QRCode from 'qrcode';
import type { Message } from 'whatsapp-web.js';
import { BaseCommand } from '../utils/BaseCommand';
import { authService } from '../utils/AuthService';
import { client } from '../../services/whatsapp';

/**
 * Command to unlink the current WhatsApp session and relink with a new number.
 * The new QR code is saved to qr.png in the project root and printed to the terminal.
 * Requires authentication.
 */
export class RelinkCommand extends BaseCommand {
  name = 'relink';
  description = 'Unlink current WhatsApp number and generate a new QR code (Admin only)';
  aliases = ['reconnect', 'newqr'];

  async execute(message: Message, _args: string[]): Promise<Message | void> {
    const isAuthorized = await authService.isAuthorized(message);
    if (!isAuthorized) return authService.sendUnauthorizedMessage(message);

    await this.sendTyping(message);

    await message.reply(
      '🔄 *Relink Initiated*\n\n' +
      '━━━━━━━━━━━━━━━━━━━━\n\n' +
      '⏳ Logging out the current session...\n\n' +
      '📸 A QR code will be saved to *qr.png* in the bot folder\n' +
      '   and printed in the terminal.\n\n' +
      '━━━━━━━━━━━━━━━━━━━━\n' +
      '_Scan with your new WhatsApp number, then use !setauth +number_'
    );

    // Register QR handler BEFORE logout so it is ready for the next QR event
    const onQR = async (qr: string) => {
      try {
        const qrPath = resolve(process.cwd(), 'qr.png');
        await QRCode.toFile(qrPath, qr, { width: 400, margin: 2 });
        console.log(`\n📸 QR code saved → ${qrPath}`);
        console.log('📱 Open qr.png and scan with your new WhatsApp number\n');
      } catch (err) {
        console.error('❌ Failed to save QR image:', err);
      }
    };

    client.once('qr', onQR);

    try {
      console.log('🔓 Logging out and clearing session...');
      await client.logout();
      console.log('✅ Session cleared — reinitializing for QR scan...');
      await client.initialize();
    } catch (err) {
      console.error('❌ Relink error:', err);
      // Make sure we don't leave a dangling listener
      client.removeListener('qr', onQR);
    }
  }
}
