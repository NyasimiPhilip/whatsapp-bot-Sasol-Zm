import { commandDispatcher } from '../utils/CommandDispatcher';
import type { Message } from 'whatsapp-web.js';
import { aiService } from '../../services/ai';
import { botState } from '../utils/BotState';
import { client } from '../../services/whatsapp';

// Import authenticated admin commands
import { StartCommand } from './StartCommand';
import { StopCommand } from './StopCommand';
import { CheckCommand } from './CheckCommand';
import { RelinkCommand } from './RelinkCommand';
import { SetAuthCommand } from './SetAuthCommand';

/**
 * Conversation history storage
 * Stores last 10 messages per chat to provide context to AI
 */
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const conversationHistory = new Map<string, ConversationMessage[]>();
const MAX_HISTORY_LENGTH = 10;
const HISTORY_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Get conversation history for a chat
 */
const getConversationHistory = (chatId: string): ConversationMessage[] => {
  const history = conversationHistory.get(chatId) || [];
  
  // Clean up old messages (older than 30 minutes)
  const now = Date.now();
  const recentHistory = history.filter(msg => now - msg.timestamp < HISTORY_EXPIRY_MS);
  
  if (recentHistory.length !== history.length) {
    conversationHistory.set(chatId, recentHistory);
  }
  
  return recentHistory;
};

/**
 * Add message to conversation history
 */
const addToHistory = (chatId: string, role: 'user' | 'assistant', content: string): void => {
  const history = getConversationHistory(chatId);
  
  history.push({
    role,
    content,
    timestamp: Date.now()
  });
  
  // Keep only last MAX_HISTORY_LENGTH messages
  if (history.length > MAX_HISTORY_LENGTH) {
    history.shift();
  }
  
  conversationHistory.set(chatId, history);
};

/**
 * Initializes and registers all available commands
 * Only admin commands requiring authentication are registered
 */
export const initializeCommands = (): void => {
  // Register authenticated admin commands
  commandDispatcher.register(new StartCommand());
  commandDispatcher.register(new StopCommand());
  commandDispatcher.register(new CheckCommand());
  commandDispatcher.register(new RelinkCommand());
  commandDispatcher.register(new SetAuthCommand());

  console.log(
    `✅ ${commandDispatcher.getAllCommands().length} admin commands registered (authentication required)`,
  );
};

// Initialize commands immediately when the module is loaded
initializeCommands();

/**
 * Check if message is a greeting
 */
const isGreeting = (text: string): boolean => {
  const greetingPatterns = /^(hi|hello|hey|hola|greetings|good morning|good afternoon|good evening|morning|afternoon|evening|howdy|yo|hii|hiii|heya|sup|what's up|whats up)[\s!?.,]*$/i;
  return greetingPatterns.test(text.trim());
};

const isLocationMessage = (message: Message): boolean => message.type === 'location' && !!message.location;

const getLocationResponse = (message: Message): string => {
  const location = message.location;

  if (!location) {
    return 'Thank you for sharing your location pin. Please also share your preferred day and time for the appointment.';
  }

  const locationParts = [location.name, location.address].filter(Boolean);
  const locationLabel = locationParts.length > 0
    ? locationParts.join(', ')
    : `the pin at coordinates ${location.latitude}, ${location.longitude}`;

  return `Thank you for sharing your location pin. We have noted ${locationLabel}. Please also share your preferred day and time for the appointment.`;
};

/**
 * Detect if an AI response is a booking confirmation.
 * Matches the closing line the AI is instructed to use.
 */
const isBookingConfirmation = (text: string): boolean =>
  /we'?ve noted your booking/i.test(text) ||
  /noted your booking for/i.test(text);

/**
 * Apply the "New Order" label to a chat so it surfaces in the
 * WhatsApp Business label view immediately after a booking is confirmed.
 * The label must already exist in the connected WhatsApp Business account.
 */
const applyNewOrderLabel = async (chatId: string): Promise<void> => {
  try {
    const labels = await client.getLabels();
    const label = labels.find(
      (l) => l.name.toLowerCase().replace(/[^a-z0-9]/g, '') === 'neworder',
    );
    if (!label) {
      console.warn('⚠️  "New Order" label not found in WhatsApp Business — create it in the app first.');
      return;
    }
    await client.addOrRemoveLabels([label.id], [chatId]);
    console.log(`🏷️  Applied "New Order" label to chat ${chatId}`);
  } catch (err) {
    console.error('❌ Failed to apply New Order label:', err);
  }
};

/**
 * Main command handler
 * Processes messages starting with '!' and dispatches to the appropriate command
 * Also handles natural questions without commands
 */
export const CommandHandler = async (message: Message): Promise<void> => {
  // Ignore messages from the bot itself
  if (message.fromMe) {
    return;
  }

  // Ignore WhatsApp Status broadcasts (people's "stories")
  if (message.from === 'status@broadcast') {
    return;
  }

  const chatId = message.from;
  const bodyPreview = message.body
    ? `${message.body.substring(0, 50)}${message.body.length > 50 ? '...' : ''}`
    : `[${message.type}]`;
  console.log(`📥 Received message from ${chatId}: "${bodyPreview}"`);

  // Admin commands (!start, !stop, !check) always work even when paused
  if (message.body.startsWith('!')) {
    const commandText = message.body.slice(1);
    const [commandName, ...args] = commandText.split(' ');
    console.log(`🔧 Command detected: !${commandName}`);
    await commandDispatcher.dispatch(commandName.toLowerCase(), message, args);
    return;
  }

  // If the bot is paused, silently ignore all non-command messages
  if (botState.isPaused) {
    console.log('⏸️ Bot is paused — ignoring non-command message');
    return;
  }

  if (isLocationMessage(message)) {
    console.log('📍 Location pin detected - sending booking follow-up');
    const locationResponse = getLocationResponse(message);
    addToHistory(chatId, 'user', '[Location pin shared]');
    addToHistory(chatId, 'assistant', locationResponse);
    await message.reply(locationResponse);
    return;
  }

  if (!message.body.trim()) {
    console.log('🔇 Empty non-location message - ignoring');
    return;
  }

  // Handle greetings
  if (isGreeting(message.body)) {
    console.log('👋 Greeting detected - sending welcome message');
    const greetingResponse = 'Thank you for contacting Sanok Nationalwide Fumigators. How may we assist you today?';
    await message.reply(greetingResponse);
    
    // Store greeting in history
    addToHistory(chatId, 'user', message.body);
    addToHistory(chatId, 'assistant', greetingResponse);
    return;
  }

  // Handle all other messages with AI (conversational mode)
  try {
    console.log('🤖 Calling AI service for conversational response...');
    
    // Get conversation history for context
    const history = getConversationHistory(chatId);
    console.log(`📚 Using conversation history: ${history.length} messages`);
    
    // Add current user message to history
    addToHistory(chatId, 'user', message.body);
    
    const response = await aiService.getResponse(message.body, true, history);
    
    if (response) {
      console.log(`✅ AI response generated: "${response.substring(0, 50)}${response.length > 50 ? '...' : ''}"`);
      
      // Store AI response in history
      addToHistory(chatId, 'assistant', response);
      
      // Add a small delay to seem more natural
      await new Promise(resolve => setTimeout(resolve, 1000));
      await message.reply(response);

      // Label the chat as a new order when a booking is confirmed
      if (isBookingConfirmation(response)) {
        console.log('🛒 Booking confirmed — applying New Order label...');
        await applyNewOrderLabel(chatId);
      }
    } else {
      console.log('🔇 No response needed - AI decided to stay silent');
    }
  } catch (error) {
    console.error('❌ Error in auto-response:', error);
    // Silently fail - don't respond if there's an error
  }
};
