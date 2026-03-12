import type { Message } from 'whatsapp-web.js';

/**
 * Authentication service for verifying authorized users
 * Checks if message sender is in the list of authorized phone numbers
 */
export class AuthService {
  private authorizedNumbers: Set<string>;

  constructor() {
    // Load authorized numbers from environment variable
    // Format: AUTHORIZED_NUMBERS=+27123456789,+27987654321
    const authNumbersEnv = process.env.AUTHORIZED_NUMBERS || '';
    this.authorizedNumbers = new Set(
      authNumbersEnv
        .split(',')
        .map(num => num.trim())
        .filter(num => num.length > 0)
    );

    console.log(`🔐 Auth Service initialized with ${this.authorizedNumbers.size} authorized number(s)`);
  }

  /**
   * Check if a message sender is authorized
   * @param message - WhatsApp message to check
   * @returns True if sender is authorized, false otherwise
   */
  async isAuthorized(message: Message): Promise<boolean> {
    const contact = await message.getContact();
    const phoneNumber = contact.id._serialized;
    
    // Extract phone number (remove @c.us/@lid suffix if present, normalize + prefix)
    const cleanNumber = phoneNumber.replace(/@(c\.us|lid)$/, '').replace(/^\+/, '');
    
    // Compare against stored numbers, also stripping any leading + for consistency
    const isAuth = [...this.authorizedNumbers].some(
      num => num.replace(/^\+/, '') === cleanNumber
    );
    
    if (!isAuth) {
      console.log(`🚫 Unauthorized access attempt from: ${cleanNumber}`);
    } else {
      console.log(`✅ Authorized user: ${cleanNumber}`);
    }
    
    return isAuth;
  }

  /**
   * Send unauthorized access message
   * @param message - WhatsApp message to reply to
   */
  async sendUnauthorizedMessage(message: Message): Promise<Message> {
    return message.reply('🚫 *Unauthorized Access*\n\nYou do not have permission to use this command.');
  }

  /**
   * Add an authorized number (requires existing authorization)
   * @param phoneNumber - Phone number to add (format: +27123456789)
   */
  addAuthorizedNumber(phoneNumber: string): void {
    this.authorizedNumbers.add(phoneNumber);
    console.log(`✅ Added authorized number: ${phoneNumber}`);
  }

  /**
   * Remove an authorized number
   * @param phoneNumber - Phone number to remove
   */
  removeAuthorizedNumber(phoneNumber: string): void {
    this.authorizedNumbers.delete(phoneNumber);
    console.log(`❌ Removed authorized number: ${phoneNumber}`);
  }

  /**
   * Reload authorized numbers from process.env (call after updating env at runtime)
   */
  reloadFromEnv(): void {
    const authNumbersEnv = process.env.AUTHORIZED_NUMBERS || '';
    this.authorizedNumbers = new Set(
      authNumbersEnv
        .split(',')
        .map(num => num.trim())
        .filter(num => num.length > 0)
    );
    console.log(`🔐 Auth Service reloaded with ${this.authorizedNumbers.size} authorized number(s)`);
  }

  /**
   * Get list of authorized numbers (masked for security)
   */
  getAuthorizedNumbers(): string[] {
    return Array.from(this.authorizedNumbers).map(num => {
      // Mask middle digits for security
      if (num.length > 6) {
        return `${num.substring(0, 4)}****${num.substring(num.length - 3)}`;
      }
      return '****';
    });
  }
}

export const authService = new AuthService();
