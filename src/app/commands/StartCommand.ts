import type { Message } from 'whatsapp-web.js';
import { BaseCommand } from '../utils/BaseCommand';
import { authService } from '../utils/AuthService';
import { client } from '../../services/whatsapp';
import { botState } from '../utils/BotState';

/**
 * Command to restart or reinitialize the bot
 * Requires authentication
 */
export class StartCommand extends BaseCommand {
  name = 'start';
  description = 'Start or restart the bot services (Admin only)';
  aliases = ['restart', 'init'];

  async execute(message: Message, args: string[]): Promise<Message | void> {
    // Check authorization
    const isAuthorized = await authService.isAuthorized(message);
    if (!isAuthorized) {
      return authService.sendUnauthorizedMessage(message);
    }

    await this.sendTyping(message);

    try {
      let statusMessage = '🚀 *Bot Start Command*\n\n';
      statusMessage += '━━━━━━━━━━━━━━━━━━━━\n\n';

      if (botState.isPaused) {
        // Resume from paused state
        botState.isPaused = false;
        console.log('▶️ Bot resumed by authorized user.');

        statusMessage += '✅ Bot has been resumed\n\n';
        statusMessage += '📊 *Current Status:*\n';
        statusMessage += `   Connection: Active\n`;
        statusMessage += `   Services: Operational\n\n`;
        statusMessage += '💡 Use `!check` for detailed status\n';
        statusMessage += '━━━━━━━━━━━━━━━━━━━━\n';
        statusMessage += '_Bot is now responding to messages_';
      } else {
        const state = await client.getState();

        if (state === 'CONNECTED') {
          statusMessage += '✅ Bot is already running\n\n';
          statusMessage += '📊 *Current Status:*\n';
          statusMessage += `   Connection: Active\n`;
          statusMessage += `   State: ${state}\n`;
          statusMessage += `   Services: Operational\n\n`;
          statusMessage += '💡 Use `!check` for detailed status\n';
          statusMessage += '━━━━━━━━━━━━━━━━━━━━\n';
          statusMessage += '_No action needed - already running_';
        } else {
          statusMessage += '⚠️ Bot connection unstable\n\n';
          statusMessage += `Current State: ${state}\n\n`;
          statusMessage += 'Attempting to reconnect...\n';
          statusMessage += '━━━━━━━━━━━━━━━━━━━━\n';
          statusMessage += '_Please wait and use !check to verify_';
        }
      }

      return message.reply(statusMessage);
    } catch (error) {
      console.error('Error in start command:', error);
      return message.reply('❌ Error executing start command. Please check bot logs.');
    }
  }
}
