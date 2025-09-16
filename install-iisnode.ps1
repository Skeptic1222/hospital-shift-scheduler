# Install iisnode for IIS
Write-Host "Installing iisnode..." -ForegroundColor Green

# Check if already installed
if (Test-Path "C:\Program Files\iisnode") {
    Write-Host "iisnode is already installed" -ForegroundColor Yellow
    exit 0
}

# Download iisnode
$url = "https://github.com/azure/iisnode/releases/download/v0.2.26/iisnode-full-v0.2.26-x64.msi"
$installer = "$env:TEMP\iisnode.msi"

Write-Host "Downloading iisnode from GitHub..."
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $url -OutFile $installer -UseBasicParsing
    Write-Host "Download complete" -ForegroundColor Green
} catch {
    Write-Host "Failed to download iisnode: $_" -ForegroundColor Red
    exit 1
}

# Install iisnode
Write-Host "Installing iisnode..."
$arguments = "/i `"$installer`" /quiet /norestart"
$process = Start-Process -FilePath "msiexec.exe" -ArgumentList $arguments -Wait -PassThru

if ($process.ExitCode -eq 0) {
    Write-Host "iisnode installed successfully!" -ForegroundColor Green
} else {
    Write-Host "Installation failed with exit code: $($process.ExitCode)" -ForegroundColor Red
    exit 1
}

# Clean up
Remove-Item $installer -Force -ErrorAction SilentlyContinue

Write-Host "Installation complete!" -ForegroundColor Green