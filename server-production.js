const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const OpenAI = require('openai');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize services
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// PRODUCTION: Get current domain URL
function getCurrentDomain() {
    // Railway provides RAILWAY_STATIC_URL, fallback to other common env vars
    const domain = process.env.RAILWAY_STATIC_URL || 
                   process.env.VERCEL_URL || 
                   process.env.HEROKU_APP_NAME ? `https://${process.env.HEROKU_APP_NAME}.herokuapp.com` :
                   `http://localhost:${port}`;
    
    return domain.startsWith('http') ? domain : `https://${domain}`;
}

// BULLETPROOF: Error handling wrapper
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// AI Response function
async function getAIResponse(userMessage, isResponse = false) {
    try {
        const systemPrompt = `You are Alex, the professional AI receptionist for NEXUS AI - an advanced AI solutions agency.

NEXUS AI - REAL SERVICES & EXPERTISE:
- AI Strategy & Consulting
- Custom AI Development
- Machine Learning Models  
- Data Intelligence
- Process Automation
- AI Innovation Lab

ACTUAL PRICING PLANS:
- Starter: $299/month - AI booking agent, automated reminders, basic chatbot, email/SMS automation
- Professional: $499/month - Phone answering agent, advanced conversation flows, lead qualification, analytics
- Enterprise: $899/month - Custom workflows, multi-location management, advanced voice customization

SPECIALIZATIONS:
- Beauty & Salons: AI appointment booking, call screening, customer follow-ups
- Dental Practices: Scheduling, patient screening, recall notices  
- Auto Repair: Service booking, customer communication, maintenance reminders

BUSINESS INFORMATION:
- Company: NEXUS AI Agency
- Business Line: +1 (719) 645-7431
- Direct Contact: +1 (719) 761-6814
- Email: hello@nexusai.agency  
- Website: nexusaiagency.dev
- Location: Colorado Springs, CO
- Free Consultation: Available via Calendly

VOICE GUIDELINES:
- Keep responses under 15 words for phone clarity
- Be professional but conversational  
- Focus on value and ROI
- Always offer to connect with specialists
- Qualify leads by asking about their business needs

CALL HANDLING:
- Greet professionally and identify NEXUS AI
- Ask about their specific AI automation needs
- Qualify budget and timeline  
- Offer free consultation booking
- Transfer to specialists when needed
- Capture contact information for follow-up

COMMON RESPONSES:
- Services: "We specialize in custom AI automation that streamlines business operations"
- Pricing: "Our automation packages start at 2,500 monthly with significant ROI"
- Consultation: "I'll connect you with our AI specialist for a free consultation"
- Hours: "We're available Monday through Friday, 9 to 6 Pacific time"
- ROI: "Most clients see cost savings within 90 days"`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ],
            max_tokens: 150,
            temperature: 0.7
        });

        return response.choices[0].message.content.trim();
    } catch (error) {
        console.error('OpenAI API error:', error);
        return "I'm Alex from NEXUS AI. How can I help you with AI automation today?";
    }
}

// ElevenLabs TTS function
async function generateSpeech(text) {
    try {
        console.log('Generating speech for:', text);
        
        // PRODUCTION OPTIMIZED: Clean text for business TTS  
        const cleanText = text
            .replace(/\$(\d+)/g, '$1 dollars')  
            .replace(/(\d+)(AM|PM)/gi, '$1 $2')  
            .replace(/(\d+)-(\d+)/g, '$1 to $2')  
            .replace(/&/g, 'and')  
            .replace(/AI/g, 'A I')  
            .replace(/NEXUS/gi, 'Nexus')
            .replace(/ROI/g, 'R O I')
            .replace(/\s+/g, ' ')  
            .trim();

        const response = await axios.post(
            'https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJgB',  // Adam - professional voice
            {
                text: cleanText,
                model_id: "eleven_turbo_v2_5",  // Fastest model
                voice_settings: {
                    stability: 0.5,           // Professional stability
                    similarity_boost: 0.9,   
                    style: 0.2,              // Professional style
                    use_speaker_boost: false 
                }
            },
            {
                headers: {
                    'Accept': 'audio/mpeg',
                    'xi-api-key': process.env.ELEVENLABS_API_KEY,
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer',
                timeout: 6000 // Professional quality > speed
            }
        );

        console.log('Professional speech generated successfully');
        return Buffer.from(response.data);
    } catch (error) {
        console.error('ElevenLabs API error:', error.message);
        return null;
    }
}

// Main voice webhook
app.post('/voice', asyncHandler(async (req, res) => {
    const twiml = new twilio.twiml.VoiceResponse();
    const speechResult = req.body.SpeechResult;
    const callSid = req.body.CallSid;
    const from = req.body.From;
    
    console.log('NEXUS AI Call:', { speechResult, callSid, from, timestamp: new Date().toISOString() });

    if (speechResult && speechResult.trim()) {
        // User spoke - process with professional AI
        const aiResponse = await getAIResponse(speechResult, true);
        
        // ALWAYS USE PREMIUM VOICE: Professional quality for business
        const audioBuffer = await generateSpeech(aiResponse);

        if (audioBuffer && audioBuffer.length > 1000) {
            try {
                const audioPath = `/tmp/nexus_response_${callSid}_${Date.now()}.mp3`;
                fs.writeFileSync(audioPath, audioBuffer);
                
                const domain = getCurrentDomain();
                const publicUrl = `${domain}/audio/${audioPath.split('/').pop()}`;
                twiml.play(publicUrl);
                
                console.log('Playing professional ElevenLabs response');
            } catch (fileError) {
                console.error('Audio file error:', fileError);
                twiml.say({ voice: 'Polly.Matthew' }, aiResponse);
            }
        } else {
            console.log('Using Twilio TTS fallback');
            twiml.say({ voice: 'Polly.Matthew' }, aiResponse);
        }
    } else {
        // PROFESSIONAL GREETING: First impression matters
        const greeting = "Thank you for calling NEXUS A I. This is Alex, your A I assistant. How can I help you with automation today?";
        
        const audioBuffer = await generateSpeech(greeting);
        
        if (audioBuffer && audioBuffer.length > 1000) {
            try {
                const audioPath = `/tmp/nexus_greeting_${callSid}_${Date.now()}.mp3`;
                fs.writeFileSync(audioPath, audioBuffer);
                
                const domain = getCurrentDomain();
                const publicUrl = `${domain}/audio/${audioPath.split('/').pop()}`;
                twiml.play(publicUrl);
                
                console.log('Playing professional ElevenLabs greeting');
            } catch (fileError) {
                console.log('Greeting file error - using Twilio fallback');
                twiml.say({ voice: 'Polly.Matthew' }, greeting);
            }
        } else {
            console.log('Using Twilio TTS for greeting');
            twiml.say({ voice: 'Polly.Matthew' }, greeting);
        }
    }

    // Professional conversation flow
    twiml.gather({
        input: 'speech',
        timeout: 5,          // Professional patience
        speechTimeout: 3,    // Allow longer responses
        action: '/voice',
        method: 'POST'
    });

    res.send(twiml.toString());
}));

// SMS webhook for lead capture
app.post('/sms', asyncHandler(async (req, res) => {
    const twiml = new twilio.twiml.MessagingResponse();
    const incomingMessage = req.body.Body;
    const from = req.body.From;
    
    console.log('NEXUS AI SMS:', { message: incomingMessage, from, timestamp: new Date().toISOString() });
    
    const aiResponse = await getAIResponse(incomingMessage, true);
    
    // Professional SMS response with contact info
    twiml.message(`${aiResponse}

ðŸ“ž Business: (719) 645-7431
ðŸ“ž Direct: (719) 761-6814
ðŸ’¼ Free Consultation: nexusaiagency.dev
ðŸ“§ Email: hello@nexusai.agency

NEXUS AI - Advanced AI Solutions for Your Business`);
    
    res.send(twiml.toString());
}));

// Audio serving endpoint
app.get('/audio/:filename', (req, res) => {
    const filename = req.params.filename;
    const audioPath = `/tmp/${filename}`;
    
    try {
        if (fs.existsSync(audioPath)) {
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minute cache
            res.sendFile(audioPath);
        } else {
            res.status(404).send('Audio file not found');
        }
    } catch (error) {
        console.error('Audio serving error:', error);
        res.status(500).send('Audio serving error');
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    const health = {
        status: 'operational',
        service: 'NEXUS AI Receptionist',
        services: {
            twilio: process.env.TWILIO_ACCOUNT_SID ? 'âœ“' : 'âœ—',
            openai: process.env.OPENAI_API_KEY ? 'âœ“' : 'âœ—',
            elevenlabs: process.env.ELEVENLABS_API_KEY ? 'âœ“' : 'âœ—'
        },
        timestamp: new Date().toISOString(),
        domain: getCurrentDomain()
    };
    res.json(health);
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: "NEXUS AI Agency - Professional AI Receptionist System",
        business_phone: "+1 (719) 645-7431",
        direct_phone: "+1 (719) 761-6814",
        email: "hello@nexusai.agency",
        website: "nexusaiagency.dev",
        services: [
            "AI Strategy & Consulting",
            "Custom AI Development",
            "Machine Learning Models", 
            "Data Intelligence",
            "Process Automation",
            "AI Innovation Lab"
        ],
        pricing: {
            starter: "$299/month",
            professional: "$499/month", 
            enterprise: "$899/month"
        },
        industries: ["Beauty & Salons", "Dental Practices", "Auto Repair"],
        status: "operational"
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        service: 'NEXUS AI Receptionist',
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(port, () => {
    console.log('ðŸš€ NEXUS AI Professional Receptionist System LIVE');
    console.log(`ðŸ“± Running on port ${port}`);
    console.log(`ðŸŒ Domain: ${getCurrentDomain()}`);
    console.log(`ðŸ“ž Business Phone: +1 (719) 645-7431`);
    console.log(`ðŸ“ž Direct Contact: +1 (719) 761-6814`);
    console.log(`ðŸ“‹ Health Check: ${getCurrentDomain()}/health`);
    console.log(`ðŸŽ¯ Webhook: ${getCurrentDomain()}/voice`);
    console.log('ðŸ’¼ PRODUCTION READY - Professional AI Receptionist');
    
    // Log environment
    const env = {
        twilio: process.env.TWILIO_ACCOUNT_SID ? 'Connected' : 'Missing',
        openai: process.env.OPENAI_API_KEY ? 'Connected' : 'Missing', 
        elevenlabs: process.env.ELEVENLABS_API_KEY ? 'Connected' : 'Missing'
    };
    console.log('ðŸ”§ Environment:', env);
});
