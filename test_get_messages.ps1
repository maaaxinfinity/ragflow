$url = "https://rag.limitee.cn/v1/conversation/messages?conversation_id=7728c8161bc6441eada0d58c45514b2d"

$headers = @{
    "Authorization" = "Bearer Q4OTk4ODM2OWVjNTExZjBiMTA2ZjY4YT"
}

Write-Host "Getting messages from conversation..."

try {
    $response = Invoke-WebRequest -Uri $url -Method GET -Headers $headers
    Write-Host "`n✅ Success!"
    Write-Host "Status: $($response.StatusCode)"
    
    $json = $response.Content | ConvertFrom-Json
    Write-Host "`nConversation ID: $($json.data.conversation_id)"
    Write-Host "Message Count: $($json.data.message_count)"
    Write-Host "`nMessages:"
    
    foreach ($msg in $json.data.messages) {
        Write-Host "`n[$($msg.role)] $($msg.content.Substring(0, [Math]::Min(100, $msg.content.Length)))"
        if ($msg.content.Length -gt 100) {
            Write-Host "... (truncated)"
        }
    }
    
    # Check for ERROR messages
    $errorCount = ($json.data.messages | Where-Object { $_.content -match '\*\*ERROR\*\*' }).Count
    if ($errorCount -gt 0) {
        Write-Host "`n⚠️ Found $errorCount ERROR messages (old data)"
    } else {
        Write-Host "`n✅ No ERROR messages found"
    }
    
} catch {
    Write-Host "`n❌ Error: $($_.Exception.Message)"
}
