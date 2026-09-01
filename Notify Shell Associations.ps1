Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class MdpdfShellNotify
{
    [DllImport("shell32.dll")]
    public static extern void SHChangeNotify(int eventId, uint flags, IntPtr item1, IntPtr item2);
}
'@

[MdpdfShellNotify]::SHChangeNotify(0x08000000, 0x1000, [IntPtr]::Zero, [IntPtr]::Zero)
Start-Sleep -Seconds 1
