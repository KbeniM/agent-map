# Forwards one hook payload from stdin to the rancher bridge, then answers "{}" so the harness continues.
# Usage: rancher-hook.cmd <adapter> [event]
param(
  [Parameter(Mandatory = $true, Position = 0)][string]$Adapter,
  [Parameter(Position = 1)][string]$Event
)
$base = if ($env:RANCHER_URL) { $env:RANCHER_URL } else { "http://127.0.0.1:4000" }
$query = if ($Event) { "?event=$Event" } else { "" }
$uri = "$base/v1/hooks/$Adapter$query"
$body = [Console]::In.ReadToEnd()
$headers = @{}
if ($env:RANCHER_TOKEN) { $headers["Authorization"] = "Bearer $($env:RANCHER_TOKEN)" }
try {
  Invoke-RestMethod -Method Post -Uri $uri -ContentType "application/json" -Headers $headers -Body $body -TimeoutSec 2 | Out-Null
} catch {}
Write-Output "{}"
exit 0
