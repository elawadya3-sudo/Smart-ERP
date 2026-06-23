const fs = require('fs');
const path = require('path');

const publicInstallersDir = path.join(__dirname, '../public/installers');
const distInstallersDir = path.join(__dirname, '../dist/installers');

if (fs.existsSync(publicInstallersDir)) {
  if (!fs.existsSync(path.join(__dirname, '../dist'))) {
    console.log('Dist directory does not exist. Skipping installers copy.');
    process.exit(0);
  }

  if (!fs.existsSync(distInstallersDir)) {
    fs.mkdirSync(distInstallersDir, { recursive: true });
  }

  const files = fs.readdirSync(publicInstallersDir);
  for (const file of files) {
    const src = path.join(publicInstallersDir, file);
    const dest = path.join(distInstallersDir, file);
    
    try {
      console.log(`Copying ${file} to dist/installers...`);
      fs.copyFileSync(src, dest);
      console.log(`Successfully copied ${file} to dist/installers.`);
    } catch (err) {
      console.error(`Failed to copy ${file}:`, err.message);
    }
  }
} else {
  console.log('No public/installers directory found.');
}
