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

    // Test SMS sending exactly like the working PHP example
    const smsUrl = `${cleanBaseUrl}:${port}/api/send_sms`;
    
    console.log('Testing real Dinstar SMS sending to:', smsUrl);

    try {
      // Create the exact same data structure as PHP
      const smsData = {
        "text": "Connection test from CRM SMS Module",
        "port": [0], // Use port 0 for test
        "param": [{
          "number": "+355694000000", // Test number - won't actually send
          "user_id": Math.floor(Math.random() * 9000) + 1000,
          "sn": serialNumber
        }]
      };

      // Use the same approach as PHP cURL
      const credentials = btoa(`${username}:${password}`);

      const response = await fetch(smsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Authorization': `Basic ${credentials}`,
          'Accept': 'application/json',
          'User-Agent': 'CRM-SMS-Module/1.0',
          // Add cookie header with serial number (noticed in gateway responses)
          'Cookie': `devckie=${serialNumber}`
        },
        body: JSON.stringify(smsData),
        signal: AbortSignal.timeout(15000)
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers.get('content-type'));

      const responseText = await response.text();
      console.log('Response body length:', responseText.length);
      console.log('Response body preview:', responseText.substring(0, 300));

      // Check if it's HTML (error) or JSON (success/api response)
      if (responseText.startsWith('<html>') || responseText.includes('<title>')) {
        // HTML error response
        if (responseText.includes('Unauthorized')) {
          return NextResponse.json({
            success: false,
            message: 'Authentication failed - Check username and password',
            debug: {
              url: smsUrl,
              status: response.status,
              response_type: 'html_error',
              error: 'Unauthorized',
              suggestion: 'Verify username and password are correct'
            }
          }, { status: 401 });
        } else if (responseText.includes('Not Found')) {
          return NextResponse.json({
            success: false,
            message: 'API endpoint not found - Check gateway configuration',
            debug: {
              url: smsUrl,
              status: response.status,
              response_type: 'html_error',
              error: 'Not Found',
              suggestion: 'Verify API endpoint path and gateway version'
            }
          }, { status: 404 });
        } else {
          return NextResponse.json({
            success: false,
            message: 'Gateway returned HTML error',
            debug: {
              url: smsUrl,
              status: response.status,
              response_type: 'html_error',
              body_preview: responseText.substring(0, 200)
            }
          }, { status: 500 });
        }
      }

      // Try to parse as JSON
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        return NextResponse.json({
          success: false,
          message: 'Gateway returned non-JSON response',
          debug: {
            url: smsUrl,
            status: response.status,
            body_preview: responseText.substring(0, 200),
            error: 'Invalid JSON'
          }
        }, { status: 500 });
      }

      // Check for success based on PHP example (error_code 202 = success)
      const isSuccess = result.error_code === 202 || result.error_code === 200;
      
      if (isSuccess) {
        return NextResponse.json({
          success: true,
          message: 'Dinstar connection and authentication successful!',
          data: {
            error_code: result.error_code,
            message_id: result.message_id,
            response: result,
            gateway_working: true
          }
        });
      } else {
        return NextResponse.json({
          success: false,
          message: `Dinstar API error: Code ${result.error_code} - ${result.error_msg || 'Unknown error'}`,
          debug: {
            url: smsUrl,
            error_code: result.error_code,
            error_msg: result.error_msg,
            full_response: result
          }
        }, { status: 400 });
      }

    } catch (fetchError: any) {
      console.error('Fetch error:', fetchError);
      
      if (fetchError.name === 'AbortError') {
        return NextResponse.json({
          success: false,
          message: 'Connection timeout - Gateway not responding',
          debug: {
            url: smsUrl,
            error: 'timeout'
          }
        }, { status: 408 });
      }

      return NextResponse.json({
        success: false,
        message: `Network error: ${fetchError.message}`,
        debug: {
          url: smsUrl,
          error: fetchError.name,
          message: fetchError.message
        }
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Dinstar real test error:', error);
    
    return NextResponse.json({
      success: false,
      message: `Test error: ${error.message}`
    }, { status: 500 });
  }
}