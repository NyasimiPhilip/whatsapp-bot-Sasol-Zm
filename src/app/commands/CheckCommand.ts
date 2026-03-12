import type { Message } from 'whatsapp-web.js';
import { BaseCommand } from '../utils/BaseCommand';
import { authService } from '../utils/AuthService';
import { client } from '../../services/whatsapp';

/**
 * Command to check bot status and system information
 * Requires authentication
 */
export class CheckCommand extends BaseCommand {
  name = 'check';
  description = 'Check bot status and system information (Admin only)';
  aliases = ['status', 'info'];

  async execute(message: Message, args: string[]): Promise<Message | void> {
    // Check authorization
    const isAuthorized = await authService.isAuthorized(message);
    if (!isAuthorized) {
      return authService.sendUnauthorizedMessage(message);
    }

    await this.sendTyping(message);

    try {
      const info = client.info;
      
      // Calculate uptime
      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = Math.floor(uptime % 60);

      // Memory usage
      const memUsage = process.memoryUsage();
      const memUsedMB = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
      const memTotalMB = (memUsage.heapTotal / 1024 / 1024).toFixed(2);

      let statusMessage = '🤖 *Bot Status Report*\n\n';
      statusMessage += '━━━━━━━━━━━━━━━━━━━━\n\n';
      
      statusMessage += '📱 *WhatsApp Connection*\n';
      statusMessage += `   Status: ✅ Connected\n`;
      statusMessage += `   Phone: ${info.wid.user}\n`;
      statusMessage += `   Platform: ${info.platform}\n\n`;
      
      statusMessage += '⏱️ *System Information*\n';
      statusMessage += `   Uptime: ${hours}h ${minutes}m ${seconds}s\n`;
      statusMessage += `   Memory: ${memUsedMB}MB / ${memTotalMB}MB\n`;
      statusMessage += `   Node: ${process.version}\n\n`;
      
      statusMessage += '🔐 *Security*\n';
      statusMessage += `   Auth Mode: Enabled\n`;
      statusMessage += `   Authorized Users: ${authService.getAuthorizedNumbers().length}\n\n`;
      
      statusMessage += '━━━━━━━━━━━━━━━━━━━━\n';
      statusMessage += `_Last checked: ${new Date().toLocaleString()}_`;

      return message.reply(statusMessage);
    } catch (error) {
      console.error('Error in check command:', error);
      return message.reply('❌ Error retrieving bot status. Please try again.');
    }
  }
}
