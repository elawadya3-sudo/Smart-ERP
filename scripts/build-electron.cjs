const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Building Vite web application...');
execSync('pnpm build', { 
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_BUILD: 'true' }
});

console.log('Packaging desktop application for Windows...');
// Output to a temp folder outside the workspace to avoid IDE file-watcher locks (EPERM)
const tempOutputDir = 'C:\\Users\\abdmu\\AppData\\Local\\Temp\\nezam-pos-build';
execSync(`npx electron-builder --win -c.directories.output="${tempOutputDir}"`, { stdio: 'inherit' });

console.log('Copying Windows portable installer to public directory...');
const publicInstallersDir = path.join(__dirname, '../public/installers');
if (!fs.existsSync(publicInstallersDir)) {
  fs.mkdirSync(publicInstallersDir, { recursive: true });
}

const sourceFile = path.join(tempOutputDir, 'nezam-pos-windows.exe');
const destFilePublic = path.join(publicInstallersDir, 'nezam-pos-windows.exe');
const distInstallersDir = path.join(__dirname, '../dist/installers');

try {
  fs.copyFileSync(sourceFile, destFilePublic);
  console.log('Installer copied to public/installers/nezam-pos-windows.exe');
  
  if (fs.existsSync(path.join(__dirname, '../dist'))) {
    if (!fs.existsSync(distInstallersDir)) {
      fs.mkdirSync(distInstallersDir, { recursive: true });
    }
    const destFileDist = path.join(distInstallersDir, 'nezam-pos-windows.exe');
    fs.copyFileSync(sourceFile, destFileDist);
    console.log('Installer also copied to dist/installers/nezam-pos-windows.exe');
  }
  
  console.log('Build completed successfully!');
} catch (err) {
  console.error('Failed to copy installer:', err.message);
  process.exit(1);
}
