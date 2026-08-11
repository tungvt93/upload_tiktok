$app = New-Object -ComObject Shell.Application
$folder = $app.BrowseForFolder(0, 'Select Avatar Image File (Or Folder containing image)', 16384)
if ($folder) {
    $folder.Self.Path
}
