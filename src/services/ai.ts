import OpenAI from 'openai';
import * as path from 'path';
import * as fs from 'fs';

interface FAQ {
  id: number;
  keywords: string[];
  question: string;
  answer: string;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface PricingStructure {
  [key: string]: {
    bachelor: number;
    '1bedroom': number;
    '2bedroom': number;
    '3bedroom': number;
    '4bedroom': number;
    '5bedroom': number;
    '6bedroom': number;
    '7bedroom': number;
    '8bedroom': number;
  };
}

interface FAQData {
  companyInfo: {
    name: string;
    location: string;
    serviceArea: string[];
  };
  pricing: PricingStructure;
  faqs: FAQ[];
  outOfAreaResponse: string;
}

interface SpecialPolicyRule {
  patterns: RegExp[];
  response: string;
}

/**
 * AI Service for handling FAQ responses with OpenAI GPT-5.1 integration
 */
export class AIService {
  private faqs: FAQ[];
  private companyInfo: FAQData['companyInfo'];
  private pricing: PricingStructure;
  private outOfAreaResponse: string;
  private openai: OpenAI | null = null;
  private specialPolicyRules: SpecialPolicyRule[] = [
    {
      patterns: [/\bdiscount\b/i, /\bcheaper\b/i, /\breduce(?:d)? price\b/i, /\bcan you lower\b/i, /\bnego(?:tiate)?\b/i],
      response: 'Our prices are fixed. We give a 3-month warranty and recommend fumigation once a year.',
    },
    {
      patterns: [/(?:how long|when).*?(?:access|return|go back|enter).*?(?:house|home|room)/i, /after fumigation.*?(?:return|enter|access)/i],
      response: 'We use public health-approved pesticide. Adults can return after 1 hour. Children, especially those under 10, should return after 3 hours.',
    },
    {
      patterns: [/\bclean(?:ing)?\b/i, /\bwash\b.*\b(?:utensils|floor|house)\b/i, /do you offer cleaning/i],
      response: "We don't offer cleaning services. Our fumigation does not dirty the house. However, we recommend that you clean the utensils and the floor only.",
    },
    {
      patterns: [/part of the house/i, /one room/i, /single room/i, /only part/i, /half the house/i, /section of the house/i],
      response: 'We fumigate the whole house for 100% results. When only parts of the house are fumigated, the pests return after 3 days.',
    },
    {
      patterns: [/\bprocess\b/i, /how .*?(?:work|works)/i, /fogging/i, /what do you do during fumigation/i],
      response: 'Fogging technology works by use of high pressure to penetrate all the hiding places of the pests. The fog is warm too, 67 degrees C, to activate the pests from dormant state into active state. This is the latest combination of procedures into one for 100% results in pest control.',
    },
    {
      patterns: [/\bodou?r\b/i, /\bsmell\b/i, /safe.*chemical/i, /harmful/i, /safe for humans/i],
      response: 'It is odourless and not harmful to human beings. The machine used is petrol-driven, so there may be a small puff of petrol smell in the house, which goes away after a few hours.',
    },
    {
      patterns: [/\bgel\b/i, /gel paste/i, /gel treatment/i],
      response: 'We do not use gel paste treatments. We use professional gas fumigation which is significantly more effective and treats the entire premises thoroughly.',
    },
    {
      patterns: [/\bmould?\b/i, /\bmold\b/i, /fungus/i, /fungi/i, /mildew/i],
      response: 'We offer professional mould treatment in two steps: (1) extermination on walls and structural surfaces using broad-spectrum fungicides, and (2) elimination of airborne mycotoxins using controlled fumigation. Includes a 6-month warranty, recommended once or twice per year. We also offer a mould assessment using an advanced air-quality detection device for 24 hours — service fee KSh 2,000.',
    },
    {
      patterns: [/\btermite\b/i, /\bwhite ant\b/i, /\bwhiteant\b/i],
      response: 'Our termite treatment uses a professional termiticide applied to soil and structural areas, providing protection within approximately a 100-metre radius with a warranty of up to 72 months.',
    },
    {
      patterns: [/\bpaybill\b/i, /\bmpesa\b/i, /\bm-pesa\b/i, /\bpay\b/i, /\bpayment\b/i, /\baccount number\b/i, /\bbank\b/i, /\btransfer\b/i, /how.*pay/i, /pay.*how/i],
      response: 'Payments via M-Pesa: Paybill 247247, Account Number 133013 (Sanok National-wide Fumigators LTD). Bank transfer: Equity Bank – Kahawa House Branch, Account Number 1330285698499.',
    },
    {
      patterns: [/\bcomplaint\b/i, /\bescalat\b/i, /\bmanager\b/i, /\bsupervisor\b/i, /\bfeedback\b/i, /\bconcern\b/i, /\bissue\b/i],
      response: 'For any complaints, service concerns, or escalation matters, please send a formal email to info@sanokgroup.org so the issue is documented and handled promptly by our management team.',
    },
    {
      patterns: [/\bquot(?:e|ation)\b/i, /\bquote\b/i, /send.*(?:quote|quotation|price list)/i, /(?:official|formal).*(?:quote|price)/i],
      response: 'Official quotations are prepared and sent to clients before close of business (COB) on the same day. If the request is received late in the day, it will be delivered the following morning.',
    },
    {
      patterns: [/\bthika\b/i, /\bkiambu\b/i, /\blimuru\b/i, /\bkiserian\b/i, /\boutside nairobi\b/i, /\btransport\b/i, /\btravel fee\b/i, /beyond.*(?:30|nairobi)/i],
      response: 'We serve within 60 km of Nairobi. For locations beyond 30 km — such as Thika, Kiambu Town, Limuru, and Kiserian — an additional transport charge of KES 500 applies.',
    },
    {
      patterns: [/asthma/i, /asthmatic/i, /inhaler/i, /\bbaby\b/i, /\bbabies\b/i, /infant/i, /(?:child|children|kids?).*(?:2 year|under 2|below 2)/i, /(?:under|below).*2.*year/i],
      response: 'For households with asthmatic individuals or children below 2 years of age, we recommend staying away from the premises for a minimum of 3 hours after fumigation. Longer ventilation periods are encouraged based on personal health needs.',
    },
    {
      patterns: [/\bcontact\b/i, /\bphone\b/i, /\bcall\b/i, /\bnumber\b/i, /\bwhatsapp number\b/i, /how.*reach/i, /reach.*you/i],
      response: 'You can call or WhatsApp us on 0742 029091. Our customer support is available 24/7.',
    },
    {
      patterns: [/\blocation\b.*\boffice\b/i, /\boffice\b.*\blocation\b/i, /where.*(?:located|find you|office|based)/i, /your.*address/i],
      response: 'We are located at Gateway Mall, Third Floor, Mombasa Road, Nairobi (Next to JKIA).',
    },
    {
      patterns: [/\bimidacloprid\b/i, /\bactellic\b/i, /\bnaphthalene\b/i, /\bpesticide\b/i, /which.*chemical/i, /what.*chemical/i, /what.*pesticide/i],
      response: 'We use public-health-approved pesticides. For bedbugs we use Imidacloprid (eliminates all life stages including eggs). Actellic 300CS is used for cockroaches and bedbugs where necessary. Naphthalene is used as a snake repellent in appropriate situations.',
    },
    {
      patterns: [/multiple pest/i, /more than one pest/i, /two pest/i, /cockroach.*bedbug/i, /bedbug.*cockroach/i, /rat.*cockroach/i, /mosquito.*bedbug/i],
      response: 'When a property is affected by more than one type of pest, the quotation is based on the pest category with the highest treatment cost. This ensures transparent and simplified pricing.',
    },
    {
      patterns: [/\bwarranty\b/i, /\bguarantee\b/i, /how long.*valid/i, /valid.*how long/i, /after.*how long.*work/i, /re.?service/i, /follow.?up/i, /pest.*return/i, /come back.*pest/i],
      response: 'All standard fumigation prices include a 3-month warranty. Fumigation is recommended at least once per year. If a pest issue persists within the warranty period, we arrange a follow-up service Monday–Friday.',
    },
    {
      patterns: [/dirty.*house/i, /house.*dirty/i, /mess.*house/i, /stain/i, /leave.*mess/i, /does.*fumigation.*dirt/i, /will.*it.*dirt/i],
      response: 'Our fumigation does not dirty the house. We recommend cleaning utensils and floors afterward.',
    },
    {
      patterns: [/prepar/i, /before.*(?:fumigate|fumigation|treatment|service)/i, /what.*(?:remove|take out|pack)/i, /(?:remove|take out|pack).*before/i, /\bfridge\b/i, /\brefrigerator\b/i, /food.*fumigation/i, /what.*should.*do.*before/i],
      response: 'Before treatment: only cooked food and ripe fruits need to be stored in the refrigerator. Utensils should be washed after fumigation.',
    }, 
  ];

  constructor() {
    const faqPath = path.join(__dirname, '..', 'config', 'faq.json');
    const faqData: FAQData = JSON.parse(fs.readFileSync(faqPath, 'utf-8'));
    
    this.faqs = faqData.faqs;
    this.companyInfo = faqData.companyInfo;
    this.pricing = faqData.pricing;
    this.outOfAreaResponse = faqData.outOfAreaResponse;

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  private findMatchingFAQ(message: string): FAQ | null {
    const lowerMessage = message.toLowerCase();
    
    for (const faq of this.faqs) {
      const hasMatch = faq.keywords.some(keyword => 
        lowerMessage.includes(keyword.toLowerCase())
      );
      if (hasMatch) {
        console.log(`✅ FAQ Match found: "${faq.question}" (ID: ${faq.id})`);
        return faq;
      }
    }
    
    console.log('❌ No FAQ match found');
    return null;
  }

  private isOutOfArea(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    const serviceAreaKeywords = this.companyInfo.serviceArea.map(area => area.toLowerCase());
    const outOfAreaCities = ['cape town', 'capetown', 'durban', 'pretoria', 'port elizabeth'];
    
    const hasOutOfAreaCity = outOfAreaCities.some(city => lowerMessage.includes(city));
    const hasServiceArea = serviceAreaKeywords.some(area => lowerMessage.includes(area));
    
    const isOutside = hasOutOfAreaCity && !hasServiceArea;
    if (isOutside) console.log('🌍 Out of area query detected');
    return isOutside;
  }

  getSpecialPolicyResponse(message: string): string | null {
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      return null;
    }

    for (const rule of this.specialPolicyRules) {
      if (rule.patterns.some((pattern) => pattern.test(trimmedMessage))) {
        console.log('📋 Special policy response matched');
        return rule.response;
      }
    }

    return null;
  }

  async getSimpleResponse(message: string): Promise<string | null> {
    console.log('🔍 Trying simple response (FAQ matching)...');

    if (!message.trim()) {
      console.log('⚠️ Empty message - no simple response available');
      return null;
    }

    const specialPolicyResponse = this.getSpecialPolicyResponse(message);
    if (specialPolicyResponse) {
      console.log('✅ Returning exact special policy response');
      return specialPolicyResponse;
    }
    
    if (this.isOutOfArea(message)) {
      console.log('📍 Returning out of area response');
      return this.outOfAreaResponse;
    }

    const matchedFaq = this.findMatchingFAQ(message);
    if (matchedFaq) {
      console.log('✅ Returning FAQ answer');
      return matchedFaq.answer;
    }
    
    console.log('⚠️ No simple response available');
    return null;
  }

  async getAIResponse(message: string, conversationHistory: ConversationMessage[] = []): Promise<string | null> {
    console.log('🤖 Attempting AI response...');

    if (!message.trim()) {
      console.log('⚠️ Empty message - skipping AI response');
      return null;
    }

    const specialPolicyResponse = this.getSpecialPolicyResponse(message);
    if (specialPolicyResponse) {
      console.log('✅ Returning exact special policy response without AI call');
      return specialPolicyResponse;
    }
    
    if (!this.openai) {
      console.warn('⚠️ OpenAI API key not configured. Falling back to simple responses.');
      return this.getSimpleResponse(message);
    }

    try {
      console.log('📡 Calling OpenAI GPT-5.1 API...');
      
      const faqContext = this.faqs
        .map(faq => `Q: ${faq.question}\nA: ${faq.answer}`)
        .join('\n\n');

      const pricingContext = `
PRICING STRUCTURE (in Kenya Shillings - KSH):

Mosquito Fumigation:
- Bedsitter/Single Room: KSH ${this.pricing.mosquito.bachelor}
- 1-Bedroom: KSH ${this.pricing.mosquito['1bedroom']}
- 2-Bedroom: KSH ${this.pricing.mosquito['2bedroom']}
- 3-Bedroom: KSH ${this.pricing.mosquito['3bedroom']}
- 4-Bedroom: KSH ${this.pricing.mosquito['4bedroom']}
- 5-Bedroom: KSH ${this.pricing.mosquito['5bedroom']}
- 6-Bedroom: KSH ${this.pricing.mosquito['6bedroom']}
- 7-Bedroom: KSH ${this.pricing.mosquito['7bedroom']}
- 8-Bedroom: KSH ${this.pricing.mosquito['8bedroom']}

Rat Extermination:
- Bedsitter/Single Room: KSH ${this.pricing.rat.bachelor}
- 1-Bedroom: KSH ${this.pricing.rat['1bedroom']}
- 2-Bedroom: KSH ${this.pricing.rat['2bedroom']}
- 3-Bedroom: KSH ${this.pricing.rat['3bedroom']}
- 4-Bedroom: KSH ${this.pricing.rat['4bedroom']}
- 5-Bedroom: KSH ${this.pricing.rat['5bedroom']}
- 6-Bedroom: KSH ${this.pricing.rat['6bedroom']}
- 7-Bedroom: KSH ${this.pricing.rat['7bedroom']}
- 8-Bedroom: KSH ${this.pricing.rat['8bedroom']}

Bedbug Fumigation:
- Bedsitter/Single Room: KSH ${this.pricing.bedbug.bachelor}
- 1-Bedroom: KSH ${this.pricing.bedbug['1bedroom']}
- 2-Bedroom: KSH ${this.pricing.bedbug['2bedroom']}
- 3-Bedroom: KSH ${this.pricing.bedbug['3bedroom']}
- 4-Bedroom: KSH ${this.pricing.bedbug['4bedroom']}
- 5-Bedroom: KSH ${this.pricing.bedbug['5bedroom']}
- 6-Bedroom: KSH ${this.pricing.bedbug['6bedroom']}
- 7-Bedroom: KSH ${this.pricing.bedbug['7bedroom']}
- 8-Bedroom: KSH ${this.pricing.bedbug['8bedroom']}

Cockroach Fumigation:
- Bedsitter/Single Room: KSH ${this.pricing.cockroach.bachelor}
- 1-Bedroom: KSH ${this.pricing.cockroach['1bedroom']}
- 2-Bedroom: KSH ${this.pricing.cockroach['2bedroom']}
- 3-Bedroom: KSH ${this.pricing.cockroach['3bedroom']}
- 4-Bedroom: KSH ${this.pricing.cockroach['4bedroom']}
- 5-Bedroom: KSH ${this.pricing.cockroach['5bedroom']}
- 6-Bedroom: KSH ${this.pricing.cockroach['6bedroom']}
- 7-Bedroom: KSH ${this.pricing.cockroach['7bedroom']}
- 8-Bedroom: KSH ${this.pricing.cockroach['8bedroom']}`;

      const systemPrompt = `You are Jay Karanja, the social media manager of ${this.companyInfo.name}, a professional fumigation company.

IDENTITY RULE: If anyone asks who you are, your name, your role, whether you are AI, a bot, an LLM, or a virtual assistant — always say you are Jay Karanja,the social media manager of Sanok Nationwide Fumigators. Never mention being an AI, LLM, bot, or virtual assistant under any circumstances.

--- COMPANY PROFILE ---
Name: Sanok National-wide Fumigators LTD
Location: Gateway Mall, Third Floor, Mombasa Road, Nairobi (Next to JKIA)
Service Area: Nairobi Metropolitan and surrounding regions within 60 km
Availability: 24/7 Customer Support
Contact: Call or WhatsApp 0742 029091
Email (complaints only): info@sanokgroup.org

--- PESTS WE CONTROL ---
Cockroaches, bedbugs, mosquitoes, rodents/rats, mould, fleas, termites, snakes, and other common pests.

--- PRICING (Kenya Shillings) ---
${pricingContext}

--- FAQ KNOWLEDGE BASE ---
${faqContext}

--- SERVICE POLICIES ---

General:
- We use professional gas fumigation that treats the ENTIRE house. It is not possible to isolate individual rooms.
- All standard fumigation prices include a 3-month warranty. Fumigation is recommended at least once per year.
- Our fumigation does not dirty the house. We recommend cleaning utensils and floors afterward.
- We do not offer cleaning services.
- Before treatment: only cooked food and ripe fruits need to be stored in the refrigerator.
- Adults may return after 1 hour. Children under 10 should return after 3 hours.
- Asthmatic individuals or children below 2 years should stay away for a minimum of 3 hours; longer ventilation encouraged.

Fogging Technology:
- High-pressure fog penetrates all hidden pest locations. Fog temperature reaches ~67°C, activating pests from dormant states for 100% elimination.

Pesticides Used:
- Imidacloprid for bedbugs (eliminates all life stages including eggs).
- Actellic 300CS for cockroaches and bedbugs where necessary.
- Naphthalene as snake repellent.
- All pesticides are public-health-approved and safe when applied by our trained professionals.

Gel Paste:
- We do NOT use gel paste treatments. We use professional gas fumigation which is significantly more effective.

Mould Treatment:
- Two-step process: (1) exterminate mould on walls/surfaces using broad-spectrum fungicides; (2) eliminate airborne mycotoxins using controlled fumigation.
- Includes a 6-month warranty. Recommended once or twice per year.
- Professional mould assessment available: advanced air-quality detection device installed for 24 hours. Fee: KSh 2,000.

Termite Treatment:
- Professional termiticide applied to soil and structural areas.
- Protection radius: ~100 metres. Warranty: up to 72 months.

Rodent Control:
- Professional gas fumigation combined with rodenticide treatments.
- Rodent pellets may be applied strategically, providing protection for up to 1 year.

Multiple Pests:
- When a property has more than one pest type, the quotation is based on the highest-cost pest category.

Service Area & Transport:
- We serve within 60 km of Nairobi.
- For locations beyond 30 km (e.g. Thika, Kiambu Town, Limuru, Kiserian) an additional transport charge of KES 500 applies.
- Outside of the 60 km radius: ${this.outOfAreaResponse}

Warranty & Re-service:
- If a pest issue persists within the warranty period, a follow-up service is arranged Monday–Friday.

--- PAYMENTS ---
M-Pesa Paybill: 247247 | Account Number: 133013 | Name: Sanok National-wide Fumigators LTD
Bank Transfer: Equity Bank – Kahawa House Branch | Account: 1330285698499

--- QUOTATIONS ---
Official quotations are sent before COB on the same day. Late requests receive the quotation the following morning.

--- COMPLAINTS & ESCALATION ---
For complaints or escalation, customers should email info@sanokgroup.org for documented, prompt handling.

--- BOOKING WORKFLOW ---
Your primary goal is to guide customers to book:
1. Identify PEST TYPE (mosquito, rat/rodent, bedbug, cockroach, termite, mould, flea, snake, etc.)
2. Identify HOUSE SIZE (bedsitter/bachelor, 1–8 bedrooms) or property type for commercial
3. Provide the EXACT PRICE for that combination only
4. Ask: "Would you like to book our services?"
5. If YES/SURE/OKAY: "Great! Please share your location (address or location pin) and your preferred day and time."
6. Once location and time provided: "Perfect! We've noted your booking for [pest] treatment at [address] on [day/time]. Thank you for choosing Sanok Nationwide Fumigators!"

--- CONVERSATION RULES ---
1. Treat any follow-up message as an answer to your previous question.
2. When price is asked but pest or house size is missing, ask for only the missing piece.
3. Once you have both pest type and house size, give ONLY the specific price — never the full list unless explicitly asked.
4. Be conversational, friendly, professional, and concise.
5. Keep responses under 3 sentences unless providing important details.
6. Use emojis sparingly.
7. For messages completely unrelated to pest control/fumigation, politely redirect: "I'm here to help with fumigation services. How can I assist you today?"
8. Always maintain momentum toward booking.
9. If the message matches a special policy topic, give only that policy response — do not append extra sentences or a booking prompt.`;

      // Build messages array for chat completions
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
      ];

      // Add conversation history
      if (conversationHistory.length > 0) {
        console.log(`📚 Including ${conversationHistory.length} previous messages in context`);
        for (const msg of conversationHistory) {
          messages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content,
          });
        }
      }

      // Add current user message
      messages.push({ role: 'user', content: message });

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-5.1',
        messages,
        temperature: 0.7,
        max_completion_tokens: 350,
      });

      const text = completion.choices[0]?.message?.content;

      if (text) {
        console.log(`✅ GPT-5.1 generated response (${text.length} chars)`);
        return text.trim();
      } else {
        console.log('⚠️ GPT-5.1 returned empty response');
        return null;
      }
    } catch (error: any) {
      const errorMsg = error.status 
        ? `Status ${error.status}: ${error.message}`
        : error.message || 'Unknown error';
      console.error('❌ Error calling OpenAI API:', errorMsg);
      console.log('🔄 Falling back to simple response');
      return this.getSimpleResponse(message);
    }
  }

  async getResponse(message: string, useAI: boolean = true, conversationHistory: ConversationMessage[] = []): Promise<string | null> {
    console.log(`\n🔍 Getting response for: "${message}"`);
    console.log(`   Use AI: ${useAI}, API Key configured: ${!!this.openai}`);

    if (!message.trim()) {
      console.log('   Strategy: No Response (empty message)');
      return null;
    }

    const specialPolicyResponse = this.getSpecialPolicyResponse(message);
    if (specialPolicyResponse) {
      console.log('   Strategy: Exact Special Policy Response');
      return specialPolicyResponse;
    }
    
    if (useAI && this.openai) {
      console.log('   Strategy: AI Response');
      return this.getAIResponse(message, conversationHistory);
    }
    
    console.log('   Strategy: Simple Response (FAQ matching only)');
    return this.getSimpleResponse(message);
  }

  isQuestion(message: string): boolean {
    const questionIndicators = ['?', 'what', 'where', 'when', 'how', 'do you', 'can you', 'are there', 'any'];
    const lowerMessage = message.toLowerCase();
    
    const isQuestionResult = questionIndicators.some(indicator => lowerMessage.includes(indicator));
    if (isQuestionResult) {
      const matchedIndicators = questionIndicators.filter(indicator => lowerMessage.includes(indicator));
      console.log(`   Question indicators found: ${matchedIndicators.join(', ')}`);
    }
    
    return isQuestionResult;
  }
}

export const aiService = new AIService();
