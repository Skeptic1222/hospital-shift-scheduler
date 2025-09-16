# PowerShell script to configure IIS logging for maximum debugging
param(
    [string]$SiteName = "scheduler",
    [string]$LogPath = "C:\inetpub\wwwroot\scheduler\logs\iis"
)

Write-Host "Configuring IIS logging for maximum debugging..." -ForegroundColor Green

# Import IIS module
Import-Module WebAdministration -ErrorAction Stop

# Create log directory if it doesn't exist
if (!(Test-Path $LogPath)) {
    New-Item -ItemType Directory -Path $LogPath -Force
    Write-Host "Created log directory: $LogPath" -ForegroundColor Yellow
}

# Configure site logging
try {
    # Enable all log fields
    Set-ItemProperty "IIS:\Sites\$SiteName" -Name logFile.logFormat -Value "W3C"
    Set-ItemProperty "IIS:\Sites\$SiteName" -Name logFile.directory -Value $LogPath
    Set-ItemProperty "IIS:\Sites\$SiteName" -Name logFile.period -Value "Hourly"

    # Enable all W3C log fields
    $logFields = @(
        "Date", "Time", "ClientIP", "UserName", "SiteName", "ComputerName",
        "ServerIP", "Method", "UriStem", "UriQuery", "HttpStatus", "HttpSubStatus",
        "Win32Status", "BytesSent", "BytesRecv", "TimeTaken", "ServerPort",
        "UserAgent", "Cookie", "Referer", "ProtocolVersion", "Host"
    )

    $logFlags = 0
    foreach ($field in $logFields) {
        $logFlags = $logFlags -bor [Microsoft.IIs.PowerShell.Framework.ConfigurationAttributes.LogExtFileFlags]::$field
    }

    Set-ItemProperty "IIS:\Sites\$SiteName" -Name logFile.logExtFileFlags -Value $logFlags

    Write-Host "Enabled all W3C log fields" -ForegroundColor Green
} catch {
    Write-Host "Error configuring site logging: $_" -ForegroundColor Red
}

# Enable Failed Request Tracing
try {
    # Enable FREB for the site
    Set-ItemProperty "IIS:\Sites\$SiteName" -Name traceFailedRequestsLogging.enabled -Value $true
    Set-ItemProperty "IIS:\Sites\$SiteName" -Name traceFailedRequestsLogging.directory -Value "$LogPath\FailedReqLogFiles"
    Set-ItemProperty "IIS:\Sites\$SiteName" -Name traceFailedRequestsLogging.maxLogFiles -Value 100

    Write-Host "Enabled Failed Request Tracing" -ForegroundColor Green

    # Create FREB rule for all requests
    $ruleName = "AllRequests"
    $rulePath = "IIS:\Sites\$SiteName\traceFailedRequestsLogging\$ruleName"

    if (!(Test-Path $rulePath)) {
        New-Item $rulePath -ItemType "traceFailedRequestsLogging"
    }

    Set-ItemProperty $rulePath -Name path -Value "*"
    Set-ItemProperty $rulePath -Name statusCodes -Value "100-999"
    Set-ItemProperty $rulePath -Name timeTaken -Value "00:00:00"

    Write-Host "Created FREB rule for all requests" -ForegroundColor Green
} catch {
    Write-Host "Error configuring Failed Request Tracing: $_" -ForegroundColor Red
}

# Enable detailed error messages
try {
    Set-WebConfigurationProperty -Filter "system.webServer/httpErrors" -PSPath "IIS:\Sites\$SiteName" -Name errorMode -Value "Detailed"
    Write-Host "Enabled detailed error messages" -ForegroundColor Green
} catch {
    Write-Host "Error enabling detailed errors: $_" -ForegroundColor Red
}

# Configure application pool debugging
$appPoolName = (Get-ItemProperty "IIS:\Sites\$SiteName" -Name applicationPool).Value
if ($appPoolName) {
    try {
        # Enable 32-bit applications (sometimes helps with debugging)
        Set-ItemProperty "IIS:\AppPools\$appPoolName" -Name enable32BitAppOnWin64 -Value $false

        # Set process identity logging
        Set-ItemProperty "IIS:\AppPools\$appPoolName" -Name processIdentity.logonType -Value "LogonBatch"

        # Enable process orphaning for debugging crashes
        Set-ItemProperty "IIS:\AppPools\$appPoolName" -Name failure.orphanWorkerProcess -Value $true

        # Set rapid fail protection to allow more failures during debugging
        Set-ItemProperty "IIS:\AppPools\$appPoolName" -Name failure.rapidFailProtection -Value $false

        Write-Host "Configured application pool for debugging: $appPoolName" -ForegroundColor Green
    } catch {
        Write-Host "Error configuring app pool: $_" -ForegroundColor Red
    }
}

# Configure Node.js debugging (iisnode)
$webConfigPath = "C:\inetpub\wwwroot\scheduler\web.config"
if (Test-Path $webConfigPath) {
    try {
        # Add iisnode debugging configuration
        $webConfig = [xml](Get-Content $webConfigPath)

        # Find or create iisnode element
        $iisnode = $webConfig.configuration.'system.webServer'.iisnode
        if (!$iisnode) {
            $iisnode = $webConfig.CreateElement("iisnode")
            $webConfig.configuration.'system.webServer'.AppendChild($iisnode)
        }

        # Set debugging attributes
        $iisnode.SetAttribute("loggingEnabled", "true")
        $iisnode.SetAttribute("logDirectory", "$LogPath\iisnode")
        $iisnode.SetAttribute("debuggingEnabled", "true")
        $iisnode.SetAttribute("debuggerPortRange", "5058-6058")
        $iisnode.SetAttribute("debuggerPathSegment", "debug")
        $iisnode.SetAttribute("devErrorsEnabled", "true")
        $iisnode.SetAttribute("nodeProcessCountPerApplication", "1")
        $iisnode.SetAttribute("maxLogFileSizeInKB", "1024")
        $iisnode.SetAttribute("maxTotalLogFileSizeInKB", "10240")
        $iisnode.SetAttribute("maxLogFiles", "20")

        $webConfig.Save($webConfigPath)
        Write-Host "Configured iisnode for debugging" -ForegroundColor Green
    } catch {
        Write-Host "Error configuring iisnode: $_" -ForegroundColor Red
    }
}

# Create ETW tracing session for IIS
try {
    $sessionName = "IISDebugTrace"

    # Stop existing session if it exists
    logman stop $sessionName -ets 2>$null

    # Create new ETW session
    logman create trace $sessionName -ow -o "$LogPath\iis_etw.etl" -p "IIS: WWW Server" 0xFFFFFFFF 0xff -ets
    logman update trace $sessionName -p "Microsoft-Windows-IIS" 0xFFFFFFFF 0xff -ets
    logman update trace $sessionName -p "Microsoft-Windows-IIS-Configuration" 0xFFFFFFFF 0xff -ets
    logman update trace $sessionName -p "Microsoft-Windows-IIS-IisNodeRequestTracing" 0xFFFFFFFF 0xff -ets

    Write-Host "Created ETW tracing session: $sessionName" -ForegroundColor Green
    Write-Host "ETW trace file: $LogPath\iis_etw.etl" -ForegroundColor Yellow
} catch {
    Write-Host "Error creating ETW session: $_" -ForegroundColor Red
}

# Restart IIS to apply changes
Write-Host "`nRestarting IIS to apply changes..." -ForegroundColor Yellow
iisreset /restart

Write-Host "`n=== IIS Logging Configuration Complete ===" -ForegroundColor Green
Write-Host "Log locations:" -ForegroundColor Cyan
Write-Host "  - IIS Logs: $LogPath" -ForegroundColor White
Write-Host "  - Failed Requests: $LogPath\FailedReqLogFiles" -ForegroundColor White
Write-Host "  - iisnode Logs: $LogPath\iisnode" -ForegroundColor White
Write-Host "  - ETW Trace: $LogPath\iis_etw.etl" -ForegroundColor White
Write-Host "`nTo stop ETW tracing: logman stop IISDebugTrace -ets" -ForegroundColor Yellow
Write-Host "To view ETW trace: wpa $LogPath\iis_etw.etl" -ForegroundColor Yellow