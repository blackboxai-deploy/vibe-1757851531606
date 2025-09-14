<?php
// Test script për Dinstar Gateway - exact copy of your working code

function test_dinstar_connection() {
    $gateway_ip = '185.120.181.129';
    $port = '8081';
    $username = 'Gjergji';
    $password = 'Password';
    $serial_number = 'dbd2-0325-0044-0088';

    $url = "http://{$gateway_ip}:{$port}/api/send_sms";
    
    $payload = [
        "text" => "Test connection message",
        "port" => [0], // Test with port 0
        "param" => [[
            "number" => "+355694000000", // Test number
            "user_id" => rand(1000, 9999),
            "sn" => $serial_number
        ]]
    ];

    echo "Testing Dinstar Gateway:\n";
    echo "URL: $url\n";
    echo "Username: $username\n";
    echo "Serial Number: $serial_number\n";
    echo "Payload: " . json_encode($payload, JSON_UNESCAPED_UNICODE) . "\n\n";

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_ANY); // This is key!
    curl_setopt($ch, CURLOPT_HEADER, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-type: application/json']);
    curl_setopt($ch, CURLOPT_USERPWD, "$username:$password");
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
    curl_setopt($ch, CURLOPT_VERBOSE, 1); // Add verbose for debugging
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);

    $curlResponse = curl_exec($ch);
    $responseHeaderSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    
    echo "=== CURL RESPONSE ===\n";
    echo "HTTP Code: $httpCode\n";
    echo "Header Size: $responseHeaderSize\n";
    echo "CURL Error: " . ($curlError ?: 'None') . "\n";
    echo "Full Response Length: " . strlen($curlResponse) . "\n\n";
    
    echo "=== HEADERS ===\n";
    echo substr($curlResponse, 0, $responseHeaderSize) . "\n";
    
    echo "=== BODY ===\n";
    $responseBody = substr($curlResponse, $responseHeaderSize);
    echo $responseBody . "\n\n";
    
    echo "=== PARSED JSON ===\n";
    $decoded = json_decode($responseBody, true);
    if ($decoded) {
        echo "Error Code: " . ($decoded['error_code'] ?? 'null') . "\n";
        echo "Error Message: " . ($decoded['error_msg'] ?? 'null') . "\n";
        echo "Message ID: " . ($decoded['message_id'] ?? 'null') . "\n";
        echo "Success: " . ($decoded['error_code'] == 202 ? 'YES' : 'NO') . "\n";
    } else {
        echo "Failed to parse JSON: " . json_last_error_msg() . "\n";
        echo "Raw body: $responseBody\n";
    }
    
    curl_close($ch);
}

// Run the test
test_dinstar_connection();
?>