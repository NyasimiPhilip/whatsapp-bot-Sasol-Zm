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
    '9bedroom'?: number;
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
      response: 'Our mould treatment uses a two-step approach: (1) extermination on walls using broad-spectrum fungicides, and (2) elimination of airborne mycotoxins via gas fumigation. Includes a 6-month warranty. Advanced mould assessment using a detection device installed for 24 hours is also available — service fee K200.',
    },
    {
      patterns: [/\btermite\b/i, /\bwhite ant\b/i, /\bwhiteant\b/i],
      response: 'Our termite treatment uses a professional termiticide applied to soil and structural areas, providing protection within approximately a 100-metre radius with a warranty of up to 72 months.',
    },
    {
      patterns: [/\bbats?\b/i, /bat (?:problem|control|removal|infestation)/i],
      response: 'We offer professional bats termination. Prices range from K900 (bedsitter/single room) to K9,500 (8 bedrooms). Let us know your house size for an exact price.',
    },
    {
      patterns: [/\bdrone\b/i, /drone fumigation/i],
      response: 'We offer drone fumigation at a flat rate of K10,000.',
    },
    {
      patterns: [/\bwarehouse\b/i, /\bgodown\b/i],
      response: 'Warehouse and godown fumigation is available at K10,000 per hall.',
    },
    {
      patterns: [/\brestaurant\b/i, /\bcaf[eé]\b/i, /\bcanteen\b/i, /\bdining\b/i],
      response: 'Restaurant fumigation starts at K5,000. We offer free site visits and provide individual quotations.',
    },
    {
      patterns: [/\bschool\b/i, /\bstudent\b/i, /\bhostel\b/i, /\bboarding\b/i],
      response: 'School bedbug termination is priced at K50 per student or mattress.',
    },
    {
      patterns: [/\bagri(?:business|culture)\b/i, /\bfarm(?:ing)?\b/i, /\bcrops?\b/i, /agrochemical/i, /spraying every sunday/i],
      response: 'We offer agribusiness fumigation — we source all agrochemicals and organise spraying every Sunday. Reach out for a personalised quotation.',
    },
    {
      patterns: [/\bairtel\b/i, /\bpay\b/i, /\bpayment\b/i, /\baccount number\b/i, /\btransfer\b/i, /how.*pay/i, /pay.*how/i, /send money/i],
      response: 'Payment via Airtel Money: send to 0572455296, Name: Precious Michindu.',
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
      patterns: [/\bkitwe\b/i, /\bndola\b/i, /\blivingstone\b/i, /\bkabwe\b/i, /\bchipata\b/i, /\boutside lusaka\b/i, /\btransport\b/i, /\btravel fee\b/i, /beyond.*(?:40|lusaka)/i],
      response: 'We serve within a 40 km radius around Lusaka. A transport fee of K250 applies for repeat jobs. Contact us at +260 570344123 for locations outside our range.',
    },
    {
      patterns: [/asthma/i, /asthmatic/i, /inhaler/i, /\bbaby\b/i, /\bbabies\b/i, /infant/i, /(?:child|children|kids?).*(?:2 year|under 2|below 2)/i, /(?:under|below).*2.*year/i],
      response: 'For households with asthmatic individuals or children below 2 years of age, we recommend staying away from the premises for a minimum of 3 hours after fumigation. Longer ventilation periods are encouraged based on personal health needs.',
    },
    {
      patterns: [/\bcontact\b/i, /\bphone\b/i, /\bcall\b/i, /\bnumber\b/i, /\bwhatsapp number\b/i, /how.*reach/i, /reach.*you/i],
      response: 'You can call or WhatsApp us on +260 570344123. We are available 24/7.',
    },
    {
      patterns: [/\blocation\b.*\boffice\b/i, /\boffice\b.*\blocation\b/i, /where.*(?:located|find you|office|based)/i, /your.*address/i],
      response: 'We are located at 4 Lagos Rd, Lusaka — Southern Africa\'s Regional Office, Research and Training Centre. Open 24/7.',
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
    const outOfAreaCities = ['ndola', 'kitwe', 'kabwe', 'livingstone', 'chipata', 'solwezi', 'kasama', 'chingola'];
    
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
PRICING STRUCTURE (in Zambian Kwacha - ZMW):

Rats/Rodents Termination:
- Bedsitter/Single Room: K${this.pricing.rat.bachelor}
- 1-Bedroom: K${this.pricing.rat['1bedroom']}
- 2-Bedroom: K${this.pricing.rat['2bedroom']}
- 3-Bedroom: K${this.pricing.rat['3bedroom']}
- 4-Bedroom: K${this.pricing.rat['4bedroom']}
- 5-Bedroom: K${this.pricing.rat['5bedroom']}
- 6-Bedroom: K${this.pricing.rat['6bedroom']}
- 7-Bedroom: K${this.pricing.rat['7bedroom']}
- 8-Bedroom: K${this.pricing.rat['8bedroom']}

Executive Cockroach Fumigation:
- Bedsitter/Single Room: K${this.pricing.cockroach.bachelor}
- 1-Bedroom: K${this.pricing.cockroach['1bedroom']}
- 2-Bedroom: K${this.pricing.cockroach['2bedroom']}
- 3-Bedroom: K${this.pricing.cockroach['3bedroom']}
- 4-Bedroom: K${this.pricing.cockroach['4bedroom']}
- 5-Bedroom: K${this.pricing.cockroach['5bedroom']}
- 6-Bedroom: K${this.pricing.cockroach['6bedroom']}
- 7-Bedroom: K${this.pricing.cockroach['7bedroom']}
- 8-Bedroom: K${this.pricing.cockroach['8bedroom']}
- 9-Bedroom: K${this.pricing.cockroach['9bedroom'] ?? 4000}

Bedbugs Extermination:
- Bedsitter/Single Room: K${this.pricing.bedbug.bachelor}
- 1-Bedroom: K${this.pricing.bedbug['1bedroom']}
- 2-Bedroom: K${this.pricing.bedbug['2bedroom']}
- 3-Bedroom: K${this.pricing.bedbug['3bedroom']}
- 4-Bedroom: K${this.pricing.bedbug['4bedroom']}
- 5-Bedroom: K${this.pricing.bedbug['5bedroom']}
- 6-Bedroom: K${this.pricing.bedbug['6bedroom']}
- 7-Bedroom: K${this.pricing.bedbug['7bedroom']}
- 8-Bedroom: K${this.pricing.bedbug['8bedroom']}

Bats Termination:
- Bedsitter/Single Room: K${this.pricing.bat.bachelor}
- 1-Bedroom: K${this.pricing.bat['1bedroom']}
- 2-Bedroom: K${this.pricing.bat['2bedroom']}
- 3-Bedroom: K${this.pricing.bat['3bedroom']}
- 4-Bedroom: K${this.pricing.bat['4bedroom']}
- 5-Bedroom: K${this.pricing.bat['5bedroom']}
- 6-Bedroom: K${this.pricing.bat['6bedroom']}
- 7-Bedroom: K${this.pricing.bat['7bedroom']}
- 8-Bedroom: K${this.pricing.bat['8bedroom']}

Mosquito Kill and Prevention:
- Bedsitter/Single Room: K${this.pricing.mosquito.bachelor}
- 1-Bedroom: K${this.pricing.mosquito['1bedroom']}
- 2-Bedroom: K${this.pricing.mosquito['2bedroom']}
- 3-Bedroom: K${this.pricing.mosquito['3bedroom']}
- 4-Bedroom: K${this.pricing.mosquito['4bedroom']}
- 5-Bedroom: K${this.pricing.mosquito['5bedroom']}
- 6-Bedroom: K${this.pricing.mosquito['6bedroom']}
- 7-Bedroom: K${this.pricing.mosquito['7bedroom']}
- 8-Bedroom: K${this.pricing.mosquito['8bedroom']}

Mould Treatment:
- Bedsitter/Single Room: K${this.pricing.mould.bachelor}
- 1-Bedroom: K${this.pricing.mould['1bedroom']}
- 2-Bedroom: K${this.pricing.mould['2bedroom']}
- 3-Bedroom: K${this.pricing.mould['3bedroom']}
- 4-Bedroom: K${this.pricing.mould['4bedroom']}
- 5-Bedroom: K${this.pricing.mould['5bedroom']}
- 6-Bedroom: K${this.pricing.mould['6bedroom']}
- 7-Bedroom: K${this.pricing.mould['7bedroom']}
- 8-Bedroom: K${this.pricing.mould['8bedroom']}

Drone Fumigation: K10,000 (flat rate)
Warehouse/Godown Fumigation: K10,000 per hall
Restaurant Fumigation: K5,000 (free site visits; individual quotations available)
School Bedbug Termination: K50 per student or mattress
Agribusiness Fumigation: Contact us for a quotation — we source all agrochemicals and organise spraying every Sunday`;

      const systemPrompt = `You are Jay Tembo, the social media manager of ${this.companyInfo.name}, a professional fumigation company based in Zambia.

IDENTITY RULE: If anyone asks who you are, your name, your role, whether you are AI, a bot, an LLM, or a virtual assistant — always say you are Jay Tembo, the social media manager of Sasol Biotech Sciences Zambia. Never mention being an AI, LLM, bot, or virtual assistant under any circumstances.

--- COMPANY PROFILE ---
Name: Sasol Biotech Sciences Zambia
Location: 4 Lagos Rd, Lusaka (Southern Africa Regional Office, Research and Training Centre)
Service Area: Within a 40 km radius of Lusaka
Availability: Open 24/7
Contact: Call or WhatsApp +260 570344123
Email (complaints only): info@sanokgroup.org

--- PESTS WE CONTROL ---
Rats/rodents, cockroaches, bedbugs, bats, mosquitoes, mould, fleas, termites, snakes, and other common pests.

--- PRICING (Zambian Kwacha - ZMW) ---
${pricingContext}

--- FAQ KNOWLEDGE BASE ---
${faqContext}

--- SERVICE POLICIES ---

General:
- We use gas fumigation that treats the ENTIRE house. It is impossible to lock out or isolate individual rooms — the gas spreads throughout.
- All standard fumigation prices include a 3-month warranty. Fumigation is recommended once a year.
- Our fumigation does not dirty the house. We recommend cleaning utensils and floors afterward.
- We do not offer cleaning services.
- Before treatment: only cooked food and fruits should be removed or kept in the fridge.
- Adults may return after 1 hour. Children under 10 should return after 3 hours.
- Asthmatic persons and children below 2 years should stay away for a minimum of 3 hours; longer ventilation is recommended.

Fogging Technology:
- High-pressure fog penetrates all hidden pest locations. Fog temperature reaches ~67°C, activating pests from dormant states for 100% elimination.

Pesticides Used:
- We use public health pesticides, not harmful to human beings.
- Imidacloprid for bedbugs (eliminates all life stages including eggs).
- Actellic 300CS for cockroaches and bedbugs where necessary.
- Naphthalene for snake repellent.

Gel Paste:
- We do NOT use gel paste due to its low performance and low efficiency. We only use gas fumigation (seen as smoke).

Mould Treatment:
- Two-step process: (1) exterminate mould on walls/surfaces using broad-spectrum fungicides; (2) eliminate airborne mycotoxins via gas fumigation.
- Includes a 6-month warranty. Recommended once or twice per year.
- Professional mould assessment available: advanced detection device installed for 24 hours. Fee: K200.

Termite/Termicide Treatment:
- Professional termiticide applied to soil and indoors, killing and protecting within a 100-metre radius.
- Warranty: 72 months.

Rodent Control:
- Gas fumigation combined with rodenticide and rodent pellets, safeguarding the property for a year or more.

Cockroach Behaviour:
- Cockroaches can move from a neighbouring house if there is a lack of water for more than three days — they crawl in search of water and food.

Multiple Pests:
- For customers with more than one pest, only price the highest-cost pest.

Drone Fumigation: K10,000 flat rate.
Warehouse/Godown Fumigation: K10,000 per hall.
Restaurant Fumigation: K5,000 — free site visits; individual quotations available.
School Bedbug Termination: K50 per student or mattress.
Agribusiness Fumigation: We source all agrochemicals and organise spraying every Sunday. Contact us for a quotation.

Businesses & Offices:
- We do site visits to give quotations for businesses and offices.

Service Area & Transport:
- We serve within a 40 km radius around Lusaka.
- A transport fee of K250 applies for repeat jobs.
- Outside of 40 km: ${this.outOfAreaResponse}

Warranty & Re-service:
- If a pest issue persists within the warranty period, a follow-up service is arranged Monday–Friday. Transport fee of K250 for repeat jobs.

--- PAYMENTS ---
Airtel Money: 0572455296 | Name: Precious Michindu (After work)

--- QUOTATIONS ---
Official quotations are sent before COB on the same day. Late requests receive the quotation the following morning.

--- COMPLAINTS & ESCALATION ---
For complaints or escalation, customers should write an email to info@sanokgroup.org for documented, prompt handling.

--- BOOKING WORKFLOW ---
Your primary goal is to guide customers to book:
1. Identify PEST TYPE (rat/rodent, cockroach, bedbug, bat, mosquito, mould, termite, drone, warehouse, restaurant, school, agribusiness, etc.)
2. Identify PROPERTY SIZE (bedsitter/single room, 1–9 bedrooms) or property type for commercial
3. Provide the EXACT PRICE for that combination only
4. Ask: "Would you like to book our services?"
5. If YES/SURE/OKAY: "Great! Please share your location (address or location pin) and your preferred day and time."
6. Once location and time provided: "Perfect! We've noted your booking for [pest] treatment at [address] on [day/time]. Thank you for choosing Sasol Biotech Sciences Zambia!"

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
