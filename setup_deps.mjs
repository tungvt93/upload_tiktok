import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const rootDir = process.cwd();
const frontendDir = path.join(rootDir, 'frontend');
const backendDir = path.join(rootDir, 'backend');

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function assertRepoLayout() {
  const requiredPaths = [
    path.join(frontendDir, 'package.json'),
    path.join(backendDir, 'package.json'),
  ];

  for (const target of requiredPaths) {
    if (!fs.existsSync(target)) {
      throw new Error(
        `Khong tim thay ${path.relative(rootDir, target)}. Hay chay script nay tai thu muc goc cua repo.`,
      );
    }
  }
}

function getRollupPackage(platform, arch) {
  const packages = {
    darwin: {
      arm64: '@rollup/rollup-darwin-arm64',
      x64: '@rollup/rollup-darwin-x64',
    },
    win32: {
      arm64: '@rollup/rollup-win32-arm64-msvc',
      x64: '@rollup/rollup-win32-x64-msvc',
    },
    linux: {
      arm64: '@rollup/rollup-linux-arm64-gnu',
      x64: '@rollup/rollup-linux-x64-gnu',
    },
  };

  return packages[platform]?.[arch] ?? null;
}

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      env: process.env,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `Lenh that bai: ${command} ${args.join(' ')} (cwd: ${cwd}, exit code: ${code ?? 'unknown'})`,
        ),
      );
    });
  });
}

async function installFrontend(rollupPackage) {
  console.log('\n==> Cai dat frontend dependencies...');
  await runCommand(npmCmd, ['install'], frontendDir);

  console.log(`\n==> Cai them Rollup native package: ${rollupPackage}`);
  await runCommand(npmCmd, ['install', '--no-save', rollupPackage], frontendDir);
}

async function installBackend() {
  console.log('\n==> Cai dat backend dependencies...');
  await runCommand(npmCmd, ['install'], backendDir);

  console.log('\n==> Rebuild better-sqlite3 theo kien truc Node hien tai...');
  await runCommand(npmCmd, ['rebuild', 'better-sqlite3'], backendDir);

  console.log('\n==> Cai dat Playwright Chromium...');
  await runCommand(npxCmd, ['playwright', 'install', 'chromium'], backendDir);
}

function printSummary(platform, arch, rollupPackage) {
  console.log('\n========================================');
  console.log('Hoan tat cai dat dependencies.');
  console.log(`Platform: ${platform}`);
  console.log(`Node arch: ${arch}`);
  console.log(`Rollup package: ${rollupPackage}`);
  console.log('========================================\n');
  console.log('Lenh de chay ung dung:');
  console.log(`1. Backend : cd "${backendDir}" && node server.js`);
  console.log(`2. Frontend: cd "${frontendDir}" && npm run dev`);
}

async function main() {
  assertRepoLayout();

  const platform = process.platform;
  const arch = process.arch;
  const rollupPackage = getRollupPackage(platform, arch);

  console.log('Dang thuc hien setup dependencies...');
  console.log(`Thu muc goc : ${rootDir}`);
  console.log(`Platform    : ${platform}`);
  console.log(`Node arch   : ${arch}`);

  if (!rollupPackage) {
    throw new Error(
      `Chua ho tro tu dong cai Rollup cho platform=${platform}, arch=${arch}.`,
    );
  }

  await installFrontend(rollupPackage);
  await installBackend();
  printSummary(platform, arch, rollupPackage);
}

main().catch((error) => {
  console.error('\nSetup that bai.');
  console.error(error.message);
  process.exit(1);
});
