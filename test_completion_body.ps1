$url = "https://rag.limitee.cn/v1/conversation/completion"

$headers = @{
    "Authorization" = "Bearer Q4OTk4ODM2OWVjNTExZjBiMTA2ZjY4YT"
    "Content-Type" = "application/json"
}

$body = @{
    conversation_id = "7728c8161bc6441eada0d58c45514b2d"
    messages = @(
        @{
            id = "test-123"
            role = "user"
            content = "你好"
        }
    )
    model_card_id = 1
    kb_ids = @()
} | ConvertTo-Json -Depth 10

Write-Host "Sending request..."
Write-Host "Body: $body"

try {
    $response = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -Body $body -TimeoutSec 5
    Write-Host "`nStatus: $($response.StatusCode)"
    Write-Host "Content-Type: $($response.Headers['Content-Type'])"
    Write-Host "Content-Length: $($response.Headers['Content-Length'])"
    Write-Host "`nResponse Body:"
    Write-Host $response.Content
} catch {
    Write-Host "Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody"
    }
}
