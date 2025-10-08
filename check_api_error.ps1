$url = "https://rag.limitee.cn/v1/conversation/completion"
$headers = @{
    "Authorization" = "Bearer Q4OTk4ODM2OWVjNTExZjBiMTA2ZjY4YT"
    "Content-Type" = "application/json"
}
$body = @{
    conversation_id = "7728c8161bc6441eada0d58c45514b2d"
    messages = @(
        @{
            id = "check-$(Get-Date -Format 'HHmmss')"
            role = "user"
            content = "当前测试"
        }
    )
    model_card_id = 1
    kb_ids = @()
} | ConvertTo-Json -Depth 10

Write-Host "Testing current API state..."
Write-Host "Request body: $body"
Write-Host "`n"

try {
    $response = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -Body $body -TimeoutSec 10
    
    Write-Host "Success! Status: $($response.StatusCode)"
    Write-Host "Content-Type: $($response.Headers['Content-Type'])"
    
    $content = $response.Content
    if ($content -match 'ERROR') {
        Write-Host "`nERROR found in response:"
        Write-Host $content
    } elseif ($content -match '^data:') {
        Write-Host "`nStreaming response (SSE):"
        Write-Host $content.Substring(0, [Math]::Min(300, $content.Length))
    } else {
        Write-Host "`nUnexpected response format:"
        Write-Host $content
    }
} catch {
    Write-Host "Request failed: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $errorBody = $reader.ReadToEnd()
            Write-Host "`nError response body:"
            Write-Host $errorBody
        } catch {
            Write-Host "Could not read error response"
        }
    }
}
