$url = "https://rag.limitee.cn/v1/conversation/completion"
$headers = @{
    "Authorization" = "Bearer Q4OTk4ODM2OWVjNTExZjBiMTA2ZjY4YT"
    "Content-Type" = "application/json"
}

$body = @{
    conversation_id = "7728c8161bc6441eada0d58c45514b2d"
    messages = @(
        @{
            id = "error-check-$(Get-Date -Format 'HHmmss')"
            role = "user"
            content = "Show me the error"
        }
    )
    model_card_id = 1
    kb_ids = @()
} | ConvertTo-Json -Depth 10

Write-Host "Sending request to see error details..."

try {
    $response = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -Body $body -TimeoutSec 10
    Write-Host "`nStatus: $($response.StatusCode)"
    Write-Host "Content-Type: $($response.Headers['Content-Type'])"
    Write-Host "`nFull Response:"
    Write-Host $response.Content
} catch {
    Write-Host "`nException: $($_.Exception.Message)"
}
