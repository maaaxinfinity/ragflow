# Check what's the exact error from the API

$url = "https://rag.limitee.cn/v1/admin/cleanup/test-reset"
$headers = @{
    "Authorization" = "Bearer Q4OTk4ODM2OWVjNTExZjBiMTA2ZjY4YT"
    "Content-Type" = "application/json"
}

$body = @{
    tenant_id = "c06096ce9e3411f09866eedd5edd0033"
    confirm = "yes"
} | ConvertTo-Json

Write-Host "Sending request to admin API..."
Write-Host "URL: $url"
Write-Host "Body: $body"
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -Body $body
    Write-Host "Success!"
    Write-Host "Status: $($response.StatusCode)"
    Write-Host "Response: $($response.Content)"
} catch {
    Write-Host "Error occurred:"
    Write-Host "Message: $($_.Exception.Message)"
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__)"
    
    # Try to read response body
    try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody"
    } catch {
        Write-Host "Could not read response body"
    }
}
