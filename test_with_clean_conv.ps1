# Create a completely new conversation to test with clean state

$createUrl = "https://rag.limitee.cn/v1/conversation/set"
$completionUrl = "https://rag.limitee.cn/v1/conversation/completion"

$headers = @{
    "Authorization" = "Bearer Q4OTk4ODM2OWVjNTExZjBiMTA2ZjY4YT"
    "Content-Type" = "application/json"
}

Write-Host "Creating a brand new conversation for clean testing..."

# Use the same dialog_id that we know exists
$createBody = @{
    dialog_id = "0db4ed6cf4cb11ef98d00242ac110005"
    name = "CleanTest-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    is_new = $true
    message = @(
        @{
            role = "assistant"
            content = ""
        }
    )
} | ConvertTo-Json -Depth 10

try {
    Write-Host "Creating conversation..."
    $createResp = Invoke-WebRequest -Uri $createUrl -Method POST -Headers $headers -Body $createBody
    $createData = $createResp.Content | ConvertFrom-Json
    
    if ($createData.code -eq 0) {
        $newConvId = $createData.data.id
        Write-Host "Created new conversation: $newConvId"
        
        Write-Host "`nSending first message to clean conversation..."
        
        $testBody = @{
            conversation_id = $newConvId
            messages = @(
                @{
                    id = "clean-test-1"
                    role = "user"
                    content = "Hello clean test"
                }
            )
            model_card_id = 1
            kb_ids = @()
        } | ConvertTo-Json -Depth 10
        
        $testResp = Invoke-WebRequest -Uri $completionUrl -Method POST -Headers $headers -Body $testBody -TimeoutSec 30
        
        Write-Host "`nResult:"
        Write-Host "Status: $($testResp.StatusCode)"
        Write-Host "Content-Type: $($testResp.Headers['Content-Type'])"
        
        if ($testResp.Content -match 'ERROR|list index out of range') {
            Write-Host "`n❌ STILL FAILING - Code not deployed!"
            Write-Host $testResp.Content.Substring(0, [Math]::Min(300, $testResp.Content.Length))
        } elseif ($testResp.Content -match '^data:') {
            Write-Host "`n✅ SUCCESS - Fix is working!"
            Write-Host "Clean conversation works correctly"
        } else {
            Write-Host "`n⚠️ UNEXPECTED response format"
        }
    } else {
        Write-Host "Failed to create conversation: $($createData.message)"
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}
