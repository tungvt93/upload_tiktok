import { execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetDir = path.join(__dirname, '..', 'test_folder_ps');
fs.mkdirSync(path.join(targetDir, 'cookies'), { recursive: true });
fs.writeFileSync(path.join(targetDir, 'config.json'), '{}');

const zipPath = `${targetDir}.zip`;

try {
    execFileSync('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Compress-Archive -LiteralPath (Get-ChildItem -Path '${targetDir}' -Recurse).FullName -DestinationPath '${zipPath}' -Force`
    ]);
    console.log('Zip created via execFileSync:', fs.existsSync(zipPath));
} catch (e) {
    console.error('execFileSync error:', e.message);
} finally {
    if (fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true, force: true });
    if (fs.existsSync(zipPath)) fs.rmSync(zipPath, { force: true });
}
