# Electron App Icon Update Guide

This document explains how to update the icon files for the Electron app.

## 📁 Current Icon Structure

```
packages/desktop/icons/
├── app-icon.ico     # Windows icon (multi-resolution)
├── app-icon.icns    # macOS icon (Apple standard format)
├── app-icon.png     # Linux fallback icon
├── 16x16.png        # Small icon (tray, toolbar)
├── 32x32.png        # Standard desktop icon
├── 48x48.png        # Large icon view
├── 64x64.png        # High-DPI small icon
├── 128x128.png      # Medium-DPI icon
├── 256x256.png      # High-DPI large icon
├── 512x512.png      # Retina display
└── 1024x1024.png    # Ultra-high-definition display
```

## 🛠️ Tools Used

**electron-icon-builder** - An icon generation tool designed specifically for Electron apps

### Installation
```bash
npm install -g electron-icon-builder
```

## 🔄 Icon Update Process

### Preparation
1. Prepare a new source image (1024x1024 PNG format recommended)
2. Make sure the image is high quality with a transparent background

### Windows
```powershell
# Delete the old icon directory and regenerate
rmdir /s /q packages\desktop\icons
electron-icon-builder --input=images\logo\v2.png --output=packages\desktop --flatten
ren packages\desktop\icons\icon.ico app-icon.ico
ren packages\desktop\icons\icon.icns app-icon.icns
copy images\logo\v2.png packages\desktop\icons\app-icon.png
```

### Linux/macOS
```bash
# Delete the old icon directory and regenerate
rm -rf packages/desktop/icons
electron-icon-builder --input=images/logo/v2.png --output=packages/desktop --flatten
mv packages/desktop/icons/icon.ico packages/desktop/icons/app-icon.ico
mv packages/desktop/icons/icon.icns packages/desktop/icons/app-icon.icns
cp images/logo/v2.png packages/desktop/icons/app-icon.png
```

## 📋 Configuration Notes

### package.json configuration
```json
{
  "build": {
    "win": { "icon": "icons/app-icon.ico" },    // Windows: dedicated ICO file
    "mac": { "icon": "icons/app-icon.icns" },   // macOS: dedicated ICNS file  
    "linux": { "icon": "icons/" }               // Linux: directory mode, selected automatically
  }
}
```

### In-app icon configuration
main.js automatically selects the appropriate icon for the platform:
- Windows: uses app-icon.ico
- macOS: uses app-icon.icns  
- Linux: prefers 512x512.png or 256x256.png

## ⚠️ Notes

### Source file requirements
- **Format**: PNG
- **Size**: 1024x1024 pixels (recommended)
- **Quality**: High-definition, lossless
- **Background**: Transparent

### Tips
- ✅ Use a high-quality source image (1024x1024 PNG)
- ✅ Make sure the background is transparent
- ✅ Deleting and rebuilding is more reliable than copying over

## 🧪 Test Build

After updating the icons, test the build on each platform:

```bash
# Test the Windows build
cd packages/desktop
pnpm run build

# Or test the cross-platform build
pnpm run build:cross-platform
```

## 📝 One-Command Update

Assuming you have a new icon file `images/logo/v2.png`:

### Windows one-command update
```powershell
rmdir /s /q packages\desktop\icons && electron-icon-builder --input=images\logo\v2.png --output=packages\desktop --flatten && ren packages\desktop\icons\icon.ico app-icon.ico && ren packages\desktop\icons\icon.icns app-icon.icns && copy images\logo\v2.png packages\desktop\icons\app-icon.png
```

### Linux/macOS one-command update
```bash
rm -rf packages/desktop/icons && electron-icon-builder --input=images/logo/v2.png --output=packages/desktop --flatten && mv packages/desktop/icons/icon.ico packages/desktop/icons/app-icon.ico && mv packages/desktop/icons/icon.icns packages/desktop/icons/app-icon.icns && cp images/logo/v2.png packages/desktop/icons/app-icon.png
```

---

**Last updated**: 2026-03-01  
**Generated with**: electron-icon-builder  
**Current source file**: images/logo/1024-1024.svg (a PNG with the same name is kept as a bitmap reference)  
**SVG to PNG (rounded-corner transparent mask, recommended as the unified cross-platform input)**:

```bash
magick images/logo/1024-1024.svg -alpha set -colorspace sRGB -strip -resize 1024x1024! images/logo/_tmp-icon-square.png
magick images/logo/_tmp-icon-square.png \
  \( -size 1024x1024 xc:none -fill white -draw "roundrectangle 0,0 1024,1024 224,224" \) \
  -alpha off -compose CopyOpacity -composite images/logo/1024-1024.png
rm -f images/logo/_tmp-icon-square.png
```

For the macOS Dock icon, rounded corners are recommended (so that a square black-background icon doesn't look jarring in the Dock):

```bash
# Generate a temporary rounded-corner PNG, then use electron-icon-builder to produce the icns
magick images/logo/1024-1024.png \
  \( -size 1024x1024 xc:none -fill white -draw "roundrectangle 0,0 1024,1024 224,224" \) \
  -alpha off -compose CopyOpacity -composite images/logo/_mac-icon-src.png

electron-icon-builder --input=images/logo/_mac-icon-src.png --output=images/logo/_icon-build-mac-tmp --flatten
cp images/logo/_icon-build-mac-tmp/icons/icon.icns packages/desktop/icons/app-icon.icns
rm -rf images/logo/_icon-build-mac-tmp images/logo/_mac-icon-src.png
```
