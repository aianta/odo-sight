# The purpose of this script is to quickly zip up the addon files and produce an XPI firefox addon file

# Usage: compress_to_xpi.ps1 <path to files to compress> <path where the final XPI should be placed>

# Note: you may have to enable the execution of powershell scripts on your PC for this to work
# https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_execution_policies?view=powershell-7.4


# https://stackoverflow.com/questions/41081488/how-do-i-exclude-a-folder-in-compress-archive

# target path
$path = $args[0]
$target_destination_for_xpi = $args[1]

# construct archive path
$destination = Join-Path $path "odo-sight.zip"
$local_xpi_path = Join-Path $path "odo-sight.xpi"

# If the zip or xpi files already exist delete them
if([System.IO.file]::Exists($destination)){
    Remove-Item -Path $destination
}

if([System.IO.file]::Exists($local_xpi_path)){
    Remove-Item -Path $local_xpi_path
}

# exclusion rules. Can use wild cards (*)
$exclude = @("node_modules", ".vscode", ".git", ".gitignore")

# get files to compress using exclusion filter
$files = Get-ChildItem -Path $path -Exclude $exclude

# compress 
Compress-Archive -Path $files -DestinationPath $destination -CompressionLevel Optimal -Force

Rename-Item -Path $destination -NewName "odo-sight.xpi"

Move-Item -Path $local_xpi_path -Destination $target_destination_for_xpi -Force