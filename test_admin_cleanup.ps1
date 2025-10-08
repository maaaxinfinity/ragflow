# Test the admin cleanup API

$baseUrl = "https://rag.limitee.cn"
$headers = @{
    "Authorization" = "Bearer Q4OTk4ODM2OWVjNTExZjBiMTA2ZjY4YT"
    "Content-Type" = "application/json"
}

$tenantId = "c06096ce9e3411f09866eedd5edd0033"

Write-Host "============================================================"
Write-Host "Admin Cleanup API Test"
Write-Host "============================================================"

# Step 1: Clean up all test data
Write-Host "`nStep 1: Cleaning up all conversations..."

$cleanupBody = @{
    tenant_id = $tenantId
    confirm = "yes"
} | ConvertTo-Json

try {
    $cleanupResp = Invoke-WebRequest -Uri "$baseUrl/v1/admin/cleanup/test-reset" -Method POST -Headers $headers -Body $cleanupBody
    $cleanupData = $cleanupResp.Content | ConvertFrom-Json
    
    if ($cleanupData.code -eq 0) {
        Write-Host "SUCCESS - Cleanup completed"
        Write-Host "  Deleted conversations: $($cleanupData.data.deleted_conversations)"
        Write-Host "  Redis cleared: $($cleanupData.data.redis_cleared)"
    } else {
        Write-Host "FAILED - $($cleanupData.message)"
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody"
    }
}

Start-Sleep -Seconds 2

# Step 2: Test with clean state
Write-Host "`nStep 2: Testing completion API with clean state..."

$testConvId = "7728c8161bc6441eada0d58c45514b2d"

$testBody = @{
    conversation_id = $testConvId
    messages = @(
        @{
            id = "clean-test-$(Get-Date -Format 'HHmmss')"
            role = "user"
            content = "Clean test message"
        }
    )
    model_card_id = 1
    kb_ids = @()
} | ConvertTo-Json -Depth 10

try {
    $testResp = Invoke-WebRequest -Uri "$baseUrl/v1/conversation/completion" -Method POST -Headers $headers -Body $testBody -TimeoutSec 30
    
    Write-Host "Status: $($testResp.StatusCode)"
    Write-Host "Content-Type: $($testResp.Headers['Content-Type'])"
    
    if ($testResp.Content -match 'ERROR|list index out of range') {
        Write-Host "`nFAILED - Still contains ERROR:"
        Write-Host $testResp.Content.Substring(0, [Math]::Min(400, $testResp.Content.Length))
    } elseif ($testResp.Content -match '^data:') {
        Write-Host "`nSUCCESS - Clean test works!"
        Write-Host "First 200 chars:"
        Write-Host $testResp.Content.Substring(0, [Math]::Min(200, $testResp.Content.Length))
    } else {
        Write-Host "`nUNEXPECTED response format"
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
}

Write-Host "`n============================================================"
Write-Host "Summary:"
Write-Host "1. All test data cleaned"
Write-Host "2. Test with clean conversation"
Write-Host "3. If still failing => server needs restart"
Write-Host "============================================================"
