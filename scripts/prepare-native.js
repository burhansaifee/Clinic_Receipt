import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const targetPlatform = process.argv[2] || 'mac';
const targetDir = path.join(rootDir, 'node_modules', 'better-sqlite3', 'build', 'Release');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

let sourceFile;
if (targetPlatform === 'win' || targetPlatform === 'windows' || targetPlatform === 'win32') {
  sourceFile = path.join(rootDir, 'build', 'bin', 'win32-x64', 'better_sqlite3.node');
  console.log('📦 Preparing native better-sqlite3 for Windows (x64 PE32+)...');
} else {
  sourceFile = path.join(rootDir, 'build', 'bin', 'darwin-arm64', 'better_sqlite3.node');
  console.log('📦 Preparing native better-sqlite3 for macOS (Apple Silicon arm64)...');
}

if (!fs.existsSync(sourceFile)) {
  console.error(`❌ Source native binary not found: ${sourceFile}`);
  process.exit(1);
}

const destFile = path.join(targetDir, 'better_sqlite3.node');
fs.copyFileSync(sourceFile, destFile);

const testExtFile = path.join(targetDir, 'test_extension.node');
if (fs.existsSync(testExtFile) && (targetPlatform === 'win' || targetPlatform === 'windows')) {
  try {
    fs.unlinkSync(testExtFile);
  } catch (e) {
    // ignore
  }
}

console.log(`✅ Successfully placed native better-sqlite3 binary for ${targetPlatform}!`);
