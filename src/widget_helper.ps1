param([long]$Hwnd, [switch]$Restore)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class DW {
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr i, int x, int y, int w, int ht, uint f);
    [DllImport("user32.dll")] public static extern int  GetWindowLong(IntPtr h, int n);
    [DllImport("user32.dll")] public static extern int  SetWindowLong(IntPtr h, int n, int v);
    [DllImport("user32.dll")] public static extern int  GetSystemMetrics(int n);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
}
"@ -ErrorAction SilentlyContinue

$h  = [IntPtr]::new($Hwnd)
$sw = [DW]::GetSystemMetrics(0)
$sh = [DW]::GetSystemMetrics(1)

if ($Restore) {
    # WS_EX_NOACTIVATE(0x08000000) 제거
    $es = [DW]::GetWindowLong($h, -20)
    [DW]::SetWindowLong($h, -20, $es -band (-bnot 0x08000000)) | Out-Null
    [DW]::ShowWindow($h, 5) | Out-Null
} else {
    # WS_EX_NOACTIVATE 추가 (포커스 안 뺏음)
    $es = [DW]::GetWindowLong($h, -20)
    [DW]::SetWindowLong($h, -20, $es -bor 0x08000000) | Out-Null
    # HWND_BOTTOM(1) 으로 맨 뒤 배치, 전체화면 크기
    # SWP_NOACTIVATE(0x0010)
    [DW]::SetWindowPos($h, [IntPtr]::new(1), 0, 0, $sw, $sh, 0x0010) | Out-Null
}
