$content = Get-Content '.\server_agent\update_service.ps1' -Encoding UTF8
Set-Content -Path '.\server_agent\update_service.ps1' -Value $content -Encoding Unicode
