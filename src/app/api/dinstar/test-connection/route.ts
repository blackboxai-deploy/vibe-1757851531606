import { NextRequest, NextResponse } from 'next/server';

interface DinstarConfig {
  baseUrl: string;
  port: number;
  username: string;
  password: string;
  serialNumber: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { baseUrl, port, username, password, serialNumber }: DinstarConfig = body;

    if (!baseUrl || !port || !username || !password || !serialNumber) {
      return NextResponse.json({
        success: false,
        message: 'Missing required configuration parameters'
      }, { status: 400 });
    }

    // Clean up the base URL
    let cleanBaseUrl = baseUrl.trim();
    if (!cleanBaseUrl.startsWith('http://') && !cleanBaseUrl.startsWith('https://')) {
      cleanBaseUrl = `http://${cleanBaseUrl}`;
    }
    cleanBaseUrl = cleanBaseUrl.replace(/\/$/, '');

    const smsUrl = `${cleanBaseUrl}:${port}/api/send_sms`;
    
    console.log('Testing Dinstar with EXACT curl equivalent');
    console.log('URL:', smsUrl);

    try {
      // Generate random user_id as session ID for status tracking
      const userSessionId = Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000;
      
      // Create payload EXACTLY like your PHP example
      const payload = {
        "text": "Connection test", // Test message
        "port": [0], // Test with port 0
        "param": [{
          "number": "+355694000000", // Test number - won't send
          "user_id": userSessionId, // Session ID for tracking
          "sn": serialNumber
        }]
      };

      console.log('Session ID for tracking:', userSessionId);
      console.log('Payload:', JSON.stringify(payload));

      // Replicate EXACT curl behavior from your PHP
      const response = await fetch(smsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(`${username}:${password}`)}`,
          'User-Agent': 'Mozilla/5.0 (compatible; CRM-SMS-Module/1.0)'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      console.log('Response Status:', response.status);
      console.log('Content-Type:', response.headers.get('content-type'));

      const responseText = await response.text();
      console.log('Response Length:', responseText.length);
      console.log('Response Preview:', responseText.substring(0, 500));

      // Handle HTML error responses
      if (responseText.includes('<html>') || responseText.includes('<title>')) {
        if (responseText.includes('Unauthorized')) {
          return NextResponse.json({
            success: false,
            message: 'Authentication failed - Check username and password',
            debug: {
              url: smsUrl,
              status: response.status,
              error_type: 'unauthorized',
              suggestion: 'Verify Dinstar credentials'
            }
          }, { status: 401 });
        }
        
        return NextResponse.json({
          success: false,
          message: 'Gateway returned HTML error page',
          debug: {
            url: smsUrl,
            status: response.status,
            html_preview: responseText.substring(0, 200)
          }
        }, { status: 500 });
      }

      // Parse JSON response
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        return NextResponse.json({
          success: false,
          message: 'Gateway returned invalid JSON',
          debug: {
            url: smsUrl,
            status: response.status,
            body_preview: responseText.substring(0, 200)
          }
        }, { status: 500 });
      }

      // Check for success (error_code 202 = success per your PHP)
      const isSuccess = result.error_code === 202;
      
      if (isSuccess) {
        return NextResponse.json({
          success: true,
          message: `Connection successful! Session ID ${userSessionId} created for status tracking`,
          data: {
            user_session_id: userSessionId, // For future status checks
            error_code: result.error_code,
            message_id: result.message_id,
            response: result,
            status_tracking_available: true,
            gateway_authenticated: true
          }
        });
      } else {
        return NextResponse.json({
          success: false,
          message: `Dinstar API Error: ${result.error_code} - ${result.error_msg || 'Unknown error'}`,
          debug: {
            url: smsUrl,
            user_session_id: userSessionId,
            error_code: result.error_code,
            error_msg: result.error_msg,
            full_response: result
          }
        }, { status: 400 });
      }

    } catch (fetchError: any) {
      console.error('Network error:', fetchError);
      
      if (fetchError.name === 'AbortError') {
        return NextResponse.json({
          success: false,
          message: 'Connection timeout - Gateway not responding'
        }, { status: 408 });
      }

      return NextResponse.json({
        success: false,
        message: `Network error: ${fetchError.message}`
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Test error:', error);
    return NextResponse.json({
      success: false,
      message: `Test error: ${error.message}`
    }, { status: 500 });
  }
}