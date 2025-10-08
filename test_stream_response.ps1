$url = "https://rag.limitee.cn/v1/conversation/completion"

$headers = @{
    "Authorization" = "Bearer Q4OTk4ODM2OWVjNTExZjBiMTA2ZjY4YT"
    "Content-Type" = "application/json"
}

$body = @{
    conversation_id = "7728c8161bc6441eada0d58c45514b2d"
    messages = @(
        @{
            id = "test-456"
            role = "user"
            content = "测试"
        }
    )
    model_card_id = 1
    kb_ids = @()
} | ConvertTo-Json -Depth 10

Write-Host "Sending request to test streaming..."
Write-Host "Waiting for response (timeout 30s)..."

try {
    $response = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -Body $body -TimeoutSec 30
    Write-Host "`n✅ Success!"
    Write-Host "Status: $($response.StatusCode)"
    Write-Host "Content-Type: $($response.Headers['Content-Type'])"
    Write-Host "Content-Length: $($response.Headers['Content-Length'])"
    Write-Host "`nFirst 500 chars of response:"
    $content = $response.Content
    if ($content.Length -gt 500) {
        Write-Host $content.Substring(0, 500)
        Write-Host "... (truncated)"
    } else {
        Write-Host $content
    }
    
    # Check if it's SSE format
    if ($content -match "^data:") {
        Write-Host "`n✅ Response is in SSE format (streaming works!)"
    } else {
        Write-Host "`n⚠️ Response is NOT in SSE format"
    }
} catch {
    Write-Host "`n❌ Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)"
    }
}
