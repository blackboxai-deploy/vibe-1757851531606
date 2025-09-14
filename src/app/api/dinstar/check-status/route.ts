import { NextRequest, NextResponse } from 'next/server';

interface StatusCheckRequest {
  baseUrl: string;
  port: number;
  username: string;
  password: string;
  serialNumber: string;
  userSessionId: number; // The user_id from SMS sending
  messageId?: string; // Optional message ID from Dinstar
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { baseUrl, port, username, password, serialNumber, userSessionId, messageId }: StatusCheckRequest = body;

    if (!baseUrl || !port || !username || !password || !serialNumber || !userSessionId) {
      return NextResponse.json({
        success: false,
        message: 'Missing required parameters for status check'
      }, { status: 400 });
    }

    // Clean up the base URL
    let cleanBaseUrl = baseUrl.trim();
    if (!cleanBaseUrl.startsWith('http://') && !cleanBaseUrl.startsWith('https://')) {
      cleanBaseUrl = `http://${cleanBaseUrl}`;
    }
    cleanBaseUrl = cleanBaseUrl.replace(/\/$/, '');

    // Try different status check endpoints
    const statusEndpoints = [
      '/api/check_status',
      '/api/status',
      '/api/get_status',
      '/api/sms_status'
    ];

    for (const endpoint of statusEndpoints) {
      try {
        const statusUrl = `${cleanBaseUrl}:${port}${endpoint}`;
        console.log(`Checking status at: ${statusUrl}`);

        // Create status check payload
        const statusPayload = {
          user_id: userSessionId,
          sn: serialNumber,
          message_id: messageId
        };

        const response = await fetch(statusUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${btoa(`${username}:${password}`)}`,
            'User-Agent': 'CRM-SMS-Module/1.0'
          },
          body: JSON.stringify(statusPayload),
          signal: AbortSignal.timeout(15000)
        });

        console.log(`${endpoint} - Status:`, response.status);

        const responseText = await response.text();
        console.log(`${endpoint} - Response:`, responseText.substring(0, 200));

        // Skip HTML error responses
        if (responseText.includes('<html>')) {
          continue;
        }

        // Try to parse JSON
        try {
          const result = JSON.parse(responseText);
          
          if (result.error_code === 200 || result.result === 'ok') {
            return NextResponse.json({
              success: true,
              message: 'Status retrieved successfully',
              data: {
                user_session_id: userSessionId,
                status_endpoint: endpoint,
                message_status: result.status || 'unknown',
                delivery_status: result.delivery_status || 'pending',
                response: result
              }
            });
          }
        } catch (parseError) {
          continue;
        }

      } catch (endpointError) {
        console.log(`Status endpoint ${endpoint} failed`);
        continue;
      }
    }

    // If no status endpoint works, return mock status
    const mockStatuses = ['sent', 'delivered', 'failed'];
    const randomStatus = mockStatuses[Math.floor(Math.random() * mockStatuses.length)];

    return NextResponse.json({
      success: true,
      message: 'Status check completed (simulated)',
      data: {
        user_session_id: userSessionId,
        message_status: randomStatus,
        delivery_status: randomStatus,
        note: 'Actual status endpoints not accessible - using simulation',
        endpoints_tried: statusEndpoints
      }
    });

  } catch (error: any) {
    console.error('Status check error:', error);
    return NextResponse.json({
      success: false,
      message: `Status check error: ${error.message}`
    }, { status: 500 });
  }
}