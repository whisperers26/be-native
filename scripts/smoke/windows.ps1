<#
.SYNOPSIS
    Window helpers for the real-app smoke test (scripts/smoke.ts). Windows only.

.DESCRIPTION
    -Action list     JSON array of top-level windows owned by processes named "pot":
                     handle, title, visible, processPath.
    -Action capture  Brings the window (-Handle) to the front and saves its on-screen pixels to -Path (PNG).
    -Action close    Posts WM_CLOSE to the window (-Handle).
    -Action text     JSON array of the text UI Automation exposes inside the window (-Handle):
                     values of edit boxes and documents, names of text elements.
    -Action fixture  Writes a PNG to -Path with -Text drawn in black on white (an OCR input).
#>
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('list', 'capture', 'close', 'text', 'fixture')]
    [string]$Action,
    [long]$Handle = 0,
    [string]$Path = '',
    [string]$Text = ''
)
$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class SmokeWin32 {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
    [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int maxCount);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr hWnd, int attribute, out RECT rect, int size);
}
'@

# Physical pixels everywhere, so window rectangles match what CopyFromScreen captures.
[void][SmokeWin32]::SetProcessDPIAware()

function Get-PotWindows {
    $pots = @{}
    foreach ($process in Get-Process -Name pot -ErrorAction SilentlyContinue) {
        $pots[[uint32]$process.Id] = $process.Path
    }
    $windows = New-Object System.Collections.ArrayList
    $callback = [SmokeWin32+EnumWindowsProc] {
        param($hWnd, $lParam)
        $processId = [uint32]0
        [void][SmokeWin32]::GetWindowThreadProcessId($hWnd, [ref]$processId)
        if ($pots.ContainsKey($processId)) {
            $title = New-Object System.Text.StringBuilder ([SmokeWin32]::GetWindowTextLength($hWnd) + 1)
            [void][SmokeWin32]::GetWindowText($hWnd, $title, $title.Capacity)
            [void]$windows.Add([pscustomobject]@{
                    handle      = $hWnd.ToInt64()
                    title       = $title.ToString()
                    visible     = [SmokeWin32]::IsWindowVisible($hWnd)
                    processPath = $pots[$processId]
                })
        }
        return $true
    }
    [void][SmokeWin32]::EnumWindows($callback, [IntPtr]::Zero)
    return $windows.ToArray()
}

function Save-WindowImage([IntPtr]$hWnd, [string]$file) {
    Add-Type -AssemblyName System.Drawing
    [void][SmokeWin32]::SetForegroundWindow($hWnd)
    Start-Sleep -Milliseconds 400
    $rect = New-Object SmokeWin32+RECT
    # DWMWA_EXTENDED_FRAME_BOUNDS (9) leaves out the invisible resize border.
    if ([SmokeWin32]::DwmGetWindowAttribute($hWnd, 9, [ref]$rect, [Runtime.InteropServices.Marshal]::SizeOf($rect)) -ne 0) {
        [void][SmokeWin32]::GetWindowRect($hWnd, [ref]$rect)
    }
    $width = $rect.Right - $rect.Left
    $height = $rect.Bottom - $rect.Top
    if ($width -le 0 -or $height -le 0) { throw "window $($hWnd.ToInt64()) has no area" }
    $bitmap = New-Object System.Drawing.Bitmap $width, $height
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size)
    $bitmap.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $bitmap.Dispose()
}

function Get-WindowText([IntPtr]$hWnd) {
    Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
    $root = [System.Windows.Automation.AutomationElement]::FromHandle($hWnd)
    $wanted = @(
        [System.Windows.Automation.ControlType]::Edit,
        [System.Windows.Automation.ControlType]::Document,
        [System.Windows.Automation.ControlType]::Text
    )
    $values = New-Object System.Collections.ArrayList
    # WebView2 builds its accessibility tree on first request; give it a few tries.
    for ($attempt = 0; $attempt -lt 10 -and $values.Count -eq 0; $attempt++) {
        if ($attempt -gt 0) { Start-Sleep -Milliseconds 500 }
        $elements = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
        foreach ($element in $elements) {
            if ($wanted -notcontains $element.Current.ControlType) { continue }
            $pattern = $null
            if ($element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$pattern)) {
                if ($pattern.Current.Value) { [void]$values.Add($pattern.Current.Value) }
            } elseif ($element.Current.Name) {
                [void]$values.Add($element.Current.Name)
            }
        }
    }
    return $values.ToArray()
}

function Write-TextImage([string]$file, [string]$content) {
    Add-Type -AssemblyName System.Drawing
    $bitmap = New-Object System.Drawing.Bitmap 1000, 260
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([System.Drawing.Color]::White)
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $font = New-Object System.Drawing.Font('Arial', 72)
    $graphics.DrawString($content, $font, [System.Drawing.Brushes]::Black, 40, 60)
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $file) | Out-Null
    $bitmap.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $bitmap.Dispose()
}

switch ($Action) {
    'list' { ConvertTo-Json -InputObject @(Get-PotWindows) -Compress }
    'capture' { Save-WindowImage ([IntPtr]$Handle) $Path; '{"ok":true}' }
    'close' { [void][SmokeWin32]::PostMessage([IntPtr]$Handle, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero); '{"ok":true}' }
    'text' { ConvertTo-Json -InputObject @(Get-WindowText ([IntPtr]$Handle)) -Compress }
    'fixture' { Write-TextImage $Path $Text; '{"ok":true}' }
}
