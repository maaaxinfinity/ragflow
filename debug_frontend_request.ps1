# Simulate exact frontend request to debug the issue

$url = "https://rag.limitee.cn/v1/conversation/completion"
$headers = @{
    "Authorization" = "Bearer Q4OTk4ODM2OWVjNTExZjBiMTA2ZjY4YT"
    "Content-Type" = "application/json"
}

Write-Host "============================================================"
Write-Host "Simulating Frontend Request"
Write-Host "============================================================"

# Test 1: Empty derivedMessages (new conversation)
Write-Host "`nTest 1: Empty derivedMessages (should work)"
$body1 = @{
    conversation_id = "7728c8161bc6441eada0d58c45514b2d"
    messages = @(
        @{
            id = "test-1"
            role = "user"
            content = "Test 1"
        }
    )
    model_card_id = 1
    kb_ids = @()
} | ConvertTo-Json -Depth 10

try {
    $response1 = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -Body $body1 -TimeoutSec 10
    if ($response1.Content -match 'ERROR') {
        Write-Host "FAILED - Contains ERROR"
        Write-Host $response1.Content.Substring(0, [Math]::Min(300, $response1.Content.Length))
    } else {
        Write-Host "SUCCESS - SSE response"
    }
} catch {
    Write-Host "EXCEPTION: $($_.Exception.Message)"
}

Start-Sleep -Seconds 3

# Test 2: With existing messages (continuing conversation)  
Write-Host "`nTest 2: With previous messages (should work)"
$body2 = @{
    conversation_id = "7728c8161bc6441eada0d58c45514b2d"
    messages = @(
        @{
            id = "prev-1"
            role = "user"
            content = "Previous question"
        },
        @{
            id = "prev-1"
            role = "assistant"
            content = "Previous answer"
        },
        @{
            id = "test-2"
            role = "user"
            content = "Test 2"
        }
    )
    model_card_id = 1
    kb_ids = @()
} | ConvertTo-Json -Depth 10

try {
    $response2 = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -Body $body2 -TimeoutSec 10
    if ($response2.Content -match 'ERROR') {
        Write-Host "FAILED - Contains ERROR"
        Write-Host $response2.Content.Substring(0, [Math]::Min(300, $response2.Content.Length))
    } else {
        Write-Host "SUCCESS - SSE response"
    }
} catch {
    Write-Host "EXCEPTION: $($_.Exception.Message)"
}

Start-Sleep -Seconds 3

# Test 3: Only assistant message (should fail - this might be the bug!)
Write-Host "`nTest 3: Only assistant message (expected to fail)"
$body3 = @{
    conversation_id = "7728c8161bc6441eada0d58c45514b2d"
    messages = @(
        @{
            id = "test-3"
            role = "assistant"
            content = "Assistant only"
        }
    )
    model_card_id = 1
    kb_ids = @()
} | ConvertTo-Json -Depth 10

try {
    $response3 = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -Body $body3 -TimeoutSec 10
    if ($response3.Content -match 'ERROR|list index out of range') {
        Write-Host "FAILED AS EXPECTED - Contains ERROR"
        Write-Host $response3.Content
    } else {
        Write-Host "UNEXPECTED SUCCESS"
    }
} catch {
    Write-Host "EXCEPTION: $($_.Exception.Message)"
}

Start-Sleep -Seconds 3

# Test 4: Empty messages array (should fail)
Write-Host "`nTest 4: Empty messages array (expected to fail)"
$body4 = @{
    conversation_id = "7728c8161bc6441eada0d58c45514b2d"
    messages = @()
    model_card_id = 1
    kb_ids = @()
} | ConvertTo-Json -Depth 10

try {
    $response4 = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -Body $body4 -TimeoutSec 10
    if ($response4.Content -match 'ERROR') {
        Write-Host "FAILED AS EXPECTED - Contains ERROR"
        Write-Host $response4.Content
    } else {
        Write-Host "UNEXPECTED SUCCESS"
    }
} catch {
    Write-Host "EXCEPTION: $($_.Exception.Message)"
}

Write-Host "`n============================================================"
Write-Host "Analysis:"
Write-Host "- If Test 3 or 4 shows the same error as frontend"
Write-Host "  => Frontend is sending wrong messages array"
Write-Host "- If all tests pass => Different issue"  
Write-Host "============================================================"
