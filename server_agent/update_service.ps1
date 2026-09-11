[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13

$API_URL = "https://syntax.su/api/db"
$TOKEN = "KORDA_SERVER_SYNC_SECRET_2026"

$StartTime = (Get-Date).AddMinutes(-10)

try {
    $events = Get-WinEvent -FilterHashtable @{LogName='Security'; ID=4663; StartTime=$StartTime} -ErrorAction Stop
} catch {
    exit
}

$uniqueLogs = @{}

foreach ($logEvent in $events) {
    $account = ""
    $object = ""
    
    if ($logEvent.Properties.Count -gt 6) {
        $account = $logEvent.Properties[1].Value
        $object = $logEvent.Properties[6].Value
    }
    
    if ([string]::IsNullOrWhiteSpace($account) -or [string]::IsNullOrWhiteSpace($object)) { continue }
    if ($account -match 'SYSTEM|NETWORK SERVICE|LOCAL SERVICE|\$') { continue }
    if ($object -match ':Zone\.Identifier|~\$') { continue }
    
    $filename = Split-Path -Path $object -Leaf
    if (-not $filename.Contains(".")) { continue } 
    
    # Физическая проверка: если это папка (даже с точкой в имени), пропускаем
    if (Test-Path -LiteralPath $object -PathType Container) { continue }
    
    $filenameLower = $filename.ToLower()
    if ($filenameLower -match '\.lnk$|\.tmp$|\.ini$|\.bak$') { continue }
    if ($filenameLower -eq 'thumbs.db' -or $filenameLower -eq 'desktop.ini' -or $filenameLower -eq '.ds_store') { continue }
    if ($filenameLower.StartsWith('~$')) { continue }
    
    $ext = [System.IO.Path]::GetExtension($filename).TrimStart('.').ToLower()
    if ($ext -match '^\d+$') { continue } # Игнорируем расширения, состоящие только из цифр (например .000)
    
    $logEntry = @{
        user = $account
        file = $filename
        fullPath = $object
        action = "read"
        time = $logEvent.TimeCreated.ToString("yyyy-MM-dd HH:mm:ss")
        timestamp = [long]([double]::Parse((Get-Date $logEvent.TimeCreated -UFormat %s)) * 1000)
    }
    
    $minuteKey = $logEvent.TimeCreated.ToString("yyyy-MM-dd HH:mm")
    $dedupKey = "$account|$filename|$minuteKey"
    
    if (-not $uniqueLogs.ContainsKey($dedupKey)) {
        $uniqueLogs[$dedupKey] = $logEntry
    }
}

$logs = @($uniqueLogs.Values)

if ($logs.Count -eq 0) {
    exit
}

$payload = @{
    action = "log_server_activity"
    payload = @{
        token = $TOKEN
        logs = $logs
    }
}

$jsonPayload = $payload | ConvertTo-Json -Depth 5 -Compress
$utf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($jsonPayload)
$headers = @{ "Content-Type" = "application/json; charset=utf-8" }

try {
    Invoke-RestMethod -Uri $API_URL -Method Post -Headers $headers -Body $utf8Bytes
} catch {
    # Fail silently
}
