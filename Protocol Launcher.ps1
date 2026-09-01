$launcher = Join-Path $PSScriptRoot 'Start Markdown PDF Studio.bat'
if (-not (Test-Path -LiteralPath $launcher)) {
    exit 1
}

Start-Process -FilePath $env:ComSpec -ArgumentList @('/d', '/c', ('"{0}"' -f $launcher)) -WindowStyle Hidden
