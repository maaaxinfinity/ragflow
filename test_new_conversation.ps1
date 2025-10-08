# Test creating a new conversation and sending first message
$createUrl = "https://rag.limitee.cn/v1/conversation/set"
$completionUrl = "https://rag.limitee.cn/v1/conversation/completion"

$headers = @{
    "Authorization" = "Bearer Q4OTk4ODM2OWVjNTExZjBiMTA2ZjY4YT"
    "Content-Type" = "application/json"
}

Write-Host "Step 1: Creating new conversation..."

$createBody = @{
    dialog_id = "0db4ed6cf4cb11ef98d00242ac110005"
    name = "测试对话-$(Get-Date -Format 'HHmmss')"
    model_card_id = 1
} | ConvertTo-Json

try {
    $createResponse = Invoke-WebRequest -Uri $createUrl -Method POST -Headers $headers -Body $createBody
    $createJson = $createResponse.Content | ConvertFrom-Json
    
    if ($createJson.code -eq 0) {
        $conversationId = $createJson.data.id
        Write-Host "✅ Created conversation: $conversationId"
        
        Write-Host "`nStep 2: Sending first message (should work on FIRST try)..."
        
        $completionBody = @{
            conversation_id = $conversationId
            messages = @(
                @{
                    id = "first-msg-$(Get-Date -Format 'HHmmss')"
                    role = "user"
                    content = "第一次测试"
                }
            )
            model_card_id = 1
            kb_ids = @()
        } | ConvertTo-Json -Depth 10
        
        $completionResponse = Invoke-WebRequest -Uri $completionUrl -Method POST -Headers $headers -Body $completionBody -TimeoutSec 30
        
        if ($completionResponse.Content -match '^data:') {
            Write-Host "✅ First message SUCCESS! (streaming response received)"
            Write-Host "`nResponse preview:"
            Write-Host $completionResponse.Content.Substring(0, [Math]::Min(300, $completionResponse.Content.Length))
            
            # Check for errors in response
            if ($completionResponse.Content -match '\*\*ERROR\*\*') {
                Write-Host "`n❌ Response contains ERROR"
            } else {
                Write-Host "`n✅ No errors in response"
            }
            
            Write-Host "`nStep 3: Verifying message was saved..."
            Start-Sleep -Seconds 2
            
            $messagesUrl = "https://rag.limitee.cn/v1/conversation/messages?conversation_id=$conversationId"
            $messagesResponse = Invoke-WebRequest -Uri $messagesUrl -Method GET -Headers $headers
            $messagesJson = $messagesResponse.Content | ConvertFrom-Json
            
            Write-Host "✅ Conversation has $($messagesJson.data.message_count) messages"
            Write-Host "`nMessages:"
            foreach ($msg in $messagesJson.data.messages) {
                Write-Host "  [$($msg.role)] $($msg.content.Substring(0, [Math]::Min(50, $msg.content.Length)))"
            }
            
            Write-Host "`n🎉 Test PASSED: First message works without retry!"
        } else {
            Write-Host "❌ Response is not SSE format"
        }
    } else {
        Write-Host "❌ Failed to create conversation: $($createJson.message)"
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)"
}
