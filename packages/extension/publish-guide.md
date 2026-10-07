# Chrome Extension Publishing Guide

This document provides detailed steps for publishing Prompt Optimizer to the Chrome Web Store.

## Preparation

### 1. Developer Account Registration

Before uploading an extension, you need to register a Chrome Web Store developer account:

1. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Sign in with a Google account
3. Pay the one-time $5.00 USD developer registration fee
4. Complete the developer profile setup

### 2. Prepare the Extension Package

1. Make sure the build is complete:
   ```bash
   pnpm build:ext
   ```

2. Package the extension:
   - Find the built extension directory (usually in `packages/extension/dist`)
   - Package the entire directory as a ZIP file
   - Make sure the root of the ZIP file directly contains manifest.json

### 3. Prepare the Listing Materials

According to the checklist in the `chrome.md` file, make sure all required materials are ready:

- Icons in all sizes
- At least 1 screenshot (1280x800 or 640x400 pixels)
- Promotional image (optional, 1400x560 pixels)
- Detailed description text
- Privacy policy page

## Upload Process

1. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Click the "Add new item" button
3. Upload the extension package in ZIP format
4. Fill in the store listing details:
   - Language: Select English
   - Description: Copy the detailed description from `chrome.md`
   - Category: Select "Productivity" and "Writing Tools"
   - Upload the icons, screenshots, and promotional images
   - Fill in the privacy policy link (you can use a privacy policy page hosted on GitHub Pages or Vercel)
5. Before submitting for review, check that everything is complete

## Review Process

The Chrome Web Store review usually takes from a few days to two weeks, so please be patient.

### Common Review Issues and Solutions

1. **Permission issues**:
   - Make sure manifest.json only requests the necessary permissions
   - Clearly explain the purpose of each permission in the description

2. **Privacy policy issues**:
   - Make sure the privacy policy is complete and thorough
   - Clearly explain how user data is handled

3. **Feature description issues**:
   - Make sure the description is accurate and does not exaggerate features
   - All screenshots must truthfully reflect the extension's features

4. **Security issues**:
   - Make sure there is no malicious code
   - Avoid using insecure APIs

## Post-Publication Maintenance

### Version Updates

1. Increase the version number in manifest.json
2. Rebuild the extension
3. Package the new version
4. Upload the new version in the developer dashboard
5. Fill in the release notes
6. Submit for review

### Handling User Feedback

1. Regularly check user reviews and feedback
2. Reply to user questions promptly
3. Improve the extension based on feedback
4. Update the FAQ

## Promotion Strategy

1. **Social media promotion**:
   - Share in tech communities (such as Juejin, Zhihu, V2EX, etc.)
   - Create a short demo video
   - Write usage tutorials and case studies

2. **SEO optimization**:
   - Optimize the keywords in the Chrome Web Store description
   - Create a dedicated landing page
   - Write related blog posts

3. **User incentives**:
   - Encourage satisfied users to leave reviews
   - Provide a feedback reward mechanism
   - Build a user community

## Financial Management

1. Set up a Google merchant account (if applicable)
2. Set up tax information
3. Set up payment methods
4. Learn about the in-app purchase policy (if applicable)

## Resource Links

- [Chrome Developer Documentation](https://developer.chrome.com/docs/webstore/)
- [Chrome Web Store Policies](https://developer.chrome.com/docs/webstore/program-policies/)
- [Chrome Extension Best Practices](https://developer.chrome.com/docs/extensions/mv3/best_practices/)
- [Google Merchant Support](https://support.google.com/chrome_webstore/)