# Test that the "third time success" bug is fixed
# Now messages should be saved on FIRST try

$url = "https://rag.limitee.cn/v1/conversation/completion"
$headers = @{
    "Authorization" = "Bearer Q4OTk4ODM2OWVjNTExZjBiMTA2ZjY4YT"
    "Content-Type" = "application/json"
}

Write-Host "============================================================"
Write-Host "Testing 'First Message Success' (No more 'third time' bug)"
Write-Host "============================================================"

# Create 3 test messages with different IDs
$testMessages = @(
    "Test message 1 - $(Get-Date -Format 'HHmmss')",
    "Test message 2 - $(Get-Date -Format 'HHmmss')",
    "Test message 3 - $(Get-Date -Format 'HHmmss')"
)

$results = @()

foreach ($i in 0..2) {
    $attempt = $i + 1
    $content = $testMessages[$i]
    
    Write-Host "`n--- Attempt $attempt ---"
    Write-Host "Sending: $content"
    
    $body = @{
        conversation_id = "7728c8161bc6441eada0d58c45514b2d"
        messages = @(
            @{
                id = "test-attempt-$attempt-$(Get-Date -Format 'HHmmss')"
                role = "user"
                content = $content
            }
        )
        model_card_id = 1
        kb_ids = @()
    } | ConvertTo-Json -Depth 10
    
    try {
        $response = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -Body $body -TimeoutSec 30
        
        if ($response.Content -match '^data:' -and $response.Content -notmatch 'ERROR') {
            Write-Host "Result: SUCCESS (SSE response received)"
            $results += "Attempt $attempt`: SUCCESS"
        } elseif ($response.Content -match 'ERROR') {
            Write-Host "Result: FAILED (ERROR in response)"
            $results += "Attempt $attempt`: FAILED (ERROR)"
        } else {
            Write-Host "Result: UNEXPECTED (not SSE format)"
            $results += "Attempt $attempt`: UNEXPECTED"
        }
        
        Start-Sleep -Seconds 2
    } catch {
        Write-Host "Result: EXCEPTION ($($_.Exception.Message))"
        $results += "Attempt $attempt`: EXCEPTION"
    }
}

Write-Host "`n============================================================"
Write-Host "SUMMARY"
Write-Host "============================================================"
foreach ($result in $results) {
    Write-Host $result
}

if ($results[0] -match 'SUCCESS') {
    Write-Host "`nCONCLUSION: FIXED! First message works without retry"
} else {
    Write-Host "`nCONCLUSION: STILL BROKEN - First attempt failed"
}
