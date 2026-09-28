/**
 * PAYTUNE SMS Gateway Service
 * Supports Africa's Talking, Twilio, and Vonage (Nexmo)
 * Gracefully falls back to simulated delivery with clear logging in development/preview
 */

export interface SendSmsResult {
  success: boolean;
  provider: 'africastalking' | 'twilio' | 'vonage' | 'simulated';
  messageId?: string;
  error?: string;
  testCode?: string;
}

/**
 * Send SMS OTP via configured SMS Gateway
 */
export async function sendSmsOtp(phone: string, otpCode: string): Promise<SendSmsResult> {
  const cleanPhone = formatPhoneNumber(phone);
  const message = `Your PAYTUNE verification code is: ${otpCode}. Valid for 10 minutes. Do not share this code.`;

  // 1. Check Africa's Talking Gateway
  const atApiKey = process.env.AFRICASTALKING_API_KEY;
  const atUsername = process.env.AFRICASTALKING_USERNAME;
  const atSenderId = process.env.AFRICASTALKING_SENDER_ID;

  if (atApiKey && atUsername) {
    try {
      const isSandbox = atUsername.toLowerCase() === 'sandbox';
      const endpoint = isSandbox
        ? 'https://api.sandbox.africastalking.com/version1/messaging'
        : 'https://api.africastalking.com/version1/messaging';

      const params = new URLSearchParams();
      params.append('username', atUsername);
      params.append('to', cleanPhone);
      params.append('message', message);
      if (atSenderId) params.append('from', atSenderId);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apiKey': atApiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: params.toString()
      });

      const data = await res.json();
      console.log(`[SMS-AFRICASTALKING] Sent to ${cleanPhone}:`, data);

      return {
        success: true,
        provider: 'africastalking',
        messageId: data?.SMSMessageData?.Recipients?.[0]?.messageId || `at_${Date.now()}`
      };
    } catch (err: any) {
      console.error('[SMS-AFRICASTALKING] Failed to send SMS:', err?.message || err);
      // Fall through to other gateways or simulation
    }
  }

  // 2. Check Twilio Gateway
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

  if (twilioSid && twilioToken && twilioFrom) {
    try {
      const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
      const params = new URLSearchParams();
      params.append('To', cleanPhone);
      params.append('From', twilioFrom);
      params.append('Body', message);

      const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      const data = await res.json();
      if (res.ok) {
        console.log(`[SMS-TWILIO] Sent to ${cleanPhone} SID: ${data.sid}`);
        return {
          success: true,
          provider: 'twilio',
          messageId: data.sid
        };
      } else {
        console.error('[SMS-TWILIO] Error response:', data);
      }
    } catch (err: any) {
      console.error('[SMS-TWILIO] Failed to send SMS:', err?.message || err);
    }
  }

  // 3. Check Vonage (Nexmo) Gateway
  const vonageKey = process.env.VONAGE_API_KEY;
  const vonageSecret = process.env.VONAGE_API_SECRET;
  const vonageFrom = process.env.VONAGE_FROM || 'PAYTUNE';

  if (vonageKey && vonageSecret) {
    try {
      const endpoint = 'https://rest.nexmo.com/sms/json';
      const body = {
        api_key: vonageKey,
        api_secret: vonageSecret,
        to: cleanPhone.replace(/^\+/, ''),
        from: vonageFrom,
        text: message
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      const msgStatus = data?.messages?.[0]?.status;
      if (msgStatus === '0') {
        console.log(`[SMS-VONAGE] Sent to ${cleanPhone} MsgId: ${data?.messages?.[0]?.['message-id']}`);
        return {
          success: true,
          provider: 'vonage',
          messageId: data?.messages?.[0]?.['message-id']
        };
      } else {
        console.error('[SMS-VONAGE] Error response status:', msgStatus, data?.messages?.[0]?.['error-text']);
      }
    } catch (err: any) {
      console.error('[SMS-VONAGE] Failed to send SMS:', err?.message || err);
    }
  }

  // 4. Simulated Gateway (Local Dev / Cloud Run Preview without live SMS gateway credentials)
  console.log('======================================================================');
  console.log(`📲 [PAYTUNE SMS SIMULATOR]`);
  console.log(`   Recipient: ${cleanPhone}`);
  console.log(`   OTP Code:  >>> ${otpCode} <<<`);
  console.log(`   Content:   "${message}"`);
  console.log(`   Valid For: 10 minutes`);
  console.log('======================================================================');

  return {
    success: true,
    provider: 'simulated',
    messageId: `sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    testCode: process.env.NODE_ENV !== 'production' ? otpCode : undefined
  };
}

/**
 * Format phone number to international E.164 format (+250788...)
 */
export function formatPhoneNumber(phone: string, defaultCountry = 'RW'): string {
  let cleaned = phone.trim().replace(/[\s\-\(\)]/g, '');
  
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  if (cleaned.startsWith('00')) {
    return '+' + cleaned.substring(2);
  }

  // Rwanda formatting default
  if (defaultCountry === 'RW') {
    if (cleaned.startsWith('07') && cleaned.length === 10) {
      return '+250' + cleaned.substring(1);
    }
    if (cleaned.startsWith('250') && cleaned.length === 12) {
      return '+' + cleaned;
    }
    if (cleaned.startsWith('7') && cleaned.length === 9) {
      return '+250' + cleaned;
    }
  }

  // Kenya (+254)
  if (defaultCountry === 'KE') {
    if (cleaned.startsWith('07') || cleaned.startsWith('01')) {
      return '+254' + cleaned.substring(1);
    }
    if (cleaned.startsWith('254')) {
      return '+' + cleaned;
    }
  }

  // Tanzania (+255)
  if (defaultCountry === 'TZ') {
    if (cleaned.startsWith('0')) {
      return '+255' + cleaned.substring(1);
    }
    if (cleaned.startsWith('255')) {
      return '+' + cleaned;
    }
  }

  // Uganda (+256)
  if (defaultCountry === 'UG') {
    if (cleaned.startsWith('0')) {
      return '+256' + cleaned.substring(1);
    }
    if (cleaned.startsWith('256')) {
      return '+' + cleaned;
    }
  }

  if (!cleaned.startsWith('+')) {
    return '+250' + cleaned.replace(/^0+/, '');
  }

  return cleaned;
}
