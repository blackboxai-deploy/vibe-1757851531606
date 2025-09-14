import { NextRequest, NextResponse } from 'next/server';

interface DinstarSendRequest {
  recipient: string;
  message: string;
  template_id?: string;
  simPort?: number;
}

interface DinstarConfig {
  baseUrl: string;
  port: number;
  username: string;
  password: string;
  serialNumber: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: DinstarSendRequest = await request.json();
    const { recipient, message, template_id, simPort } = body;

    if (!recipient || !message) {
      return NextResponse.json({
        success: false,
        message: 'Recipient and message are required'
      }, { status: 400 });
    }

    // Try to get Dinstar configuration (in real Laravel app, from database)
    let dinstarConfig: DinstarConfig | null = null;
    
    try {
      // For demo purposes, we'll try to get config from a theoretical storage
      // In Laravel, this would be: SmsConfig::where('is_active', true)->first()
      const configResponse = await fetch(`${request.nextUrl.origin}/api/dinstar/get-config`);
      if (configResponse.ok) {
        const configResult = await configResponse.json();
        if (configResult.success) {
          dinstarConfig = configResult.data;
        }
      }
    } catch (error) {
      console.log('No stored config found, will return demo response');
    }

    // If we have real config, use actual Dinstar API
    if (dinstarConfig) {
      try {
        return await sendViaDinstar(dinstarConfig, recipient, message, simPort || 0, template_id);
       } catch (error: any) {
        console.error('Dinstar API error:', error);
        return NextResponse.json({
          success: false,
          message: `Dinstar API error: ${error.message}`,
          data: createErrorLog(recipient, message, simPort, error.message)
        }, { status: 500 });
      }
    }

    // Fallback to demo response
    const success = Math.random() > 0.2; // 80% success rate for demo
    
    const smsLog = {
      id: `sms_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      direction: 'outbound' as const,
      recipient: recipient,
      message: message,
      provider: 'dinstar',
      provider_message_id: success ? `dinstar_${Date.now()}` : undefined,
      status: success ? 'sent' as const : 'failed' as const,
      error_message: success ? undefined : 'Dinstar gateway not configured - demo mode',
      template_id: template_id,
      message_type: 'original' as const,
      cost: success ? 0.02 : undefined, // Cost in EUR
      currency: 'EUR',
      sim_port: simPort || 0,
      sent_at: success ? new Date().toISOString() : undefined,
      failed_at: success ? undefined : new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return NextResponse.json({
      success: success,
      message: success ? 'SMS sent successfully (demo mode)' : 'SMS sending failed (demo mode)',
      data: smsLog
    }, { status: success ? 200 : 500 });

  } catch (error: any) {
    console.error('SMS send error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error: ' + error.message
    }, { status: 500 });
  }
}

async function sendViaDinstar(
  config: DinstarConfig, 
  recipient: string, 
  message: string, 
  simPort: number, 
  templateId?: string
): Promise<Response> {
  
  const url = `${config.baseUrl}:${config.port}/api/send_sms`;
  
  // Generate session ID for status tracking (same as PHP rand(1000, 9999))
  const userSessionId = Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000;
  
  // Format data EXACTLY according to your working PHP example
  const payload = {
    "text": message,
    "port": [simPort], // Array format as required
    "param": [{
      "number": recipient,
      "user_id": userSessionId, // Session ID for tracking status
      "sn": config.serialNumber
    }]
  };

  console.log('Sending SMS via Dinstar:');
  console.log('URL:', url);
  console.log('Session ID:', userSessionId);
  console.log('SIM Port:', simPort);
  console.log('Payload:', JSON.stringify(payload));

  try {
    // Replicate EXACT curl options from your PHP
    // CURLOPT_HTTPAUTH = CURLAUTH_ANY
    // CURLOPT_HEADER = true
    // CURLOPT_RETURNTRANSFER = true
    // CURLOPT_FOLLOWLOCATION = 1
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', // Exact PHP header
        'Authorization': `Basic ${btoa(`${config.username}:${config.password}`)}`,
        'User-Agent': 'CRM-SMS-Module/1.0'
      },
      body: JSON.stringify(payload),
      redirect: 'follow', // CURLOPT_FOLLOWLOCATION equivalent
      signal: AbortSignal.timeout(30000)
    });

    console.log('Response Status:', response.status);
    console.log('Response Headers:', response.headers.get('content-type'));

    const responseText = await response.text();
    console.log('Response Body:', responseText);

    // Handle HTML responses (errors)
    if (responseText.includes('<html>') || responseText.includes('<title>')) {
      if (responseText.includes('Unauthorized')) {
        throw new Error('Authentication failed - Check credentials');
      }
      throw new Error('Gateway returned HTML error page');
    }

    // Parse JSON response
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}`);
    }

    console.log('Parsed Response:', result);

    // Check for success (error_code 202 = success per your PHP)
    const isSuccess = result.error_code === 202;
    
    const smsLog = {
      id: `sms_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      direction: 'outbound' as const,
      recipient: recipient,
      message: message,
      provider: 'dinstar',
      provider_message_id: result.message_id || `dinstar_${userSessionId}`,
      status: isSuccess ? 'sent' as const : 'failed' as const,
      error_message: isSuccess ? undefined : `Error ${result.error_code}: ${result.error_msg || 'Unknown error'}`,
      template_id: templateId,
      message_type: 'original' as const,
      cost: isSuccess ? 0.02 : undefined,
      currency: 'EUR',
      sim_port: simPort,
      user_session_id: userSessionId, // Store session ID for status tracking
      dinstar_response: result,
      sent_at: isSuccess ? new Date().toISOString() : undefined,
      failed_at: !isSuccess ? new Date().toISOString() : undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return NextResponse.json({
      success: isSuccess,
      message: isSuccess 
        ? `SMS sent successfully! Session ID: ${userSessionId}` 
        : `Dinstar error: ${result.error_code} - ${result.error_msg || 'Unknown error'}`,
      data: smsLog
    }, { status: isSuccess ? 200 : 400 });

  } catch (fetchError: any) {
    console.error('Dinstar API error:', fetchError);
    throw fetchError;
  }
}

function createErrorLog(recipient: string, message: string, simPort?: number, errorMessage?: string) {
  return {
    id: `sms_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    direction: 'outbound' as const,
    recipient: recipient,
    message: message,
    provider: 'dinstar',
    status: 'failed' as const,
    error_message: errorMessage || 'Unknown error',
    message_type: 'original' as const,
    sim_port: simPort || 0,
    failed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}