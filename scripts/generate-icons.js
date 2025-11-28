/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Script to generate PWA icons from SVG
 * 
 * Run: npm install sharp && node scripts/generate-icons.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconDir = path.join(__dirname, '..', 'public', 'icons');
const svgPath = path.join(iconDir, 'icon.svg');

async function generateIcons() {
  // Ensure icons directory exists
  if (!fs.existsSync(iconDir)) {
    fs.mkdirSync(iconDir, { recursive: true });
  }

  // Read SVG file
  const svgBuffer = fs.readFileSync(svgPath);

  console.log('Generating PWA icons...');

  for (const size of sizes) {
    const outputPath = path.join(iconDir, `icon-${size}x${size}.png`);
    
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    
    console.log(`✓ Generated: icon-${size}x${size}.png`);
  }

  // Generate shortcut icons
  const shortcutSizes = [96];
  for (const size of shortcutSizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(iconDir, `shortcut-tasbih.png`));
    
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(iconDir, `shortcut-istighfar.png`));
  }

  console.log('\n✅ All icons generated successfully!');
  console.log('\nGenerated icons:');
  sizes.forEach(size => {
    console.log(`  - /icons/icon-${size}x${size}.png`);
  });
}

generateIcons().catch(console.error);
