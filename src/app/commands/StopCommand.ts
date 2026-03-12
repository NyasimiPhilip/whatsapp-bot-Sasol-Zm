import type { Message } from 'whatsapp-web.js';
import { BaseCommand } from '../utils/BaseCommand';
import { authService } from '../utils/AuthService';
import { botState } from '../utils/BotState';

/**
 * Command to gracefully stop the bot
 * Requires authentication
 */
export class StopCommand extends BaseCommand {
  name = 'stop';
  description = 'Gracefully stop the bot (Admin only)';
  aliases = ['shutdown', 'halt'];

  async execute(message: Message, args: string[]): Promise<Message | void> {
    // Check authorization
    const isAuthorized = await authService.isAuthorized(message);
    if (!isAuthorized) {
      return authService.sendUnauthorizedMessage(message);
    }

    await this.sendTyping(message);

    try {
      let confirmMessage = '⏸️ *Bot Paused*\n\n';
      confirmMessage += '━━━━━━━━━━━━━━━━━━━━\n\n';
      confirmMessage += '🛑 The bot will stop responding to messages\n\n';
      confirmMessage += '📊 *Final Status:*\n';
      confirmMessage += `   Uptime: ${Math.floor(process.uptime())}s\n`;
      confirmMessage += `   Time: ${new Date().toLocaleString()}\n\n`;
      confirmMessage += '━━━━━━━━━━━━━━━━━━━━\n';
      confirmMessage += '💡 Send *!start* to resume the bot at any time.';

      await message.reply(confirmMessage);

      // Pause the bot — keep the process and WhatsApp connection alive
      // so that !start can resume it from chat
      console.log('⏸️ Bot paused by authorized user. Process remains alive for !start.');
      botState.isPaused = true;

    } catch (error) {
      console.error('Error in stop command:', error);
      return message.reply('❌ Error executing stop command. Manual intervention may be required.');
    }
  }
}
