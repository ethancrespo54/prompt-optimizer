# Prompt Optimizer - Permissions Explanation

This document explains in detail the permissions requested by the Prompt Optimizer Chrome extension and what they are used for, to help you understand why we need these permissions and how they are used to provide the service.

## Single Purpose Description

**The main purpose of Prompt Optimizer is to optimize users' AI prompts so that they get more accurate, higher-quality AI responses.**

All permissions requested by this extension directly serve this single core purpose:
- The **storage permission** is used to save the user's API keys and settings so that the user can connect to AI services
- The **API domain access permissions** are used to send prompt optimization requests directly from the user's browser to the corresponding AI service providers
- The **tabs permission** is used to open the settings interface in a tab, providing a better user experience

These permissions are essential for implementing the main functionality of the extension. Without them, the extension cannot perform its core function. At the same time, we strictly follow the principle of least privilege: we only request the permissions necessary to complete the core task and do not collect any data unrelated to this core function.

## Requested Permissions

### Storage Permission (`storage`)

**Purpose:**
- Securely store API keys locally
- Save your extension settings and preferences
- Store prompt optimization history (if this feature is enabled)

**Important notes:**
- All data is stored only on your local device
- Nothing is uploaded to any server
- You can clear this data at any time through the extension settings

### Tabs Permission (`tabs`)

**Purpose:**
- Allows the extension to present all core features in a tab, including prompt optimization, model management, and other user interaction interfaces
- Provides a more spacious and flexible user experience, with all features running in a standalone tab

**Important notes:**
- The extension opens in a tab and presents all feature interfaces when the user takes an action
- It does not monitor your tabs in the background
- It does not record your browsing history or collect tab data
- It is only used to provide a better user interface experience, and all core features are completed in the tab

## Host Permissions (`host_permissions`)

### 1. OpenAI API (`https://api.openai.com/*`)

**Purpose:**
- Allows the extension to send requests directly from your browser to OpenAI's API
- Used to optimize prompts with OpenAI models (such as GPT-3.5 and GPT-4)

### 2. Google Gemini API (`https://generativelanguage.googleapis.com/*`)

**Purpose:**
- Allows the extension to send requests directly from your browser to Google's Gemini API
- Used to optimize prompts with Google Gemini models

### 3. DeepSeek API (`https://api.deepseek.com/*`)

**Purpose:**
- Allows the extension to send requests directly from your browser to DeepSeek's API
- Used to optimize prompts with DeepSeek models

### 4. SiliconFlow API (`https://api.siliconflow.cn/*`)

**Purpose:**
- Allows the extension to send requests directly from your browser to SiliconFlow's API
- Used to optimize prompts with SiliconFlow models

**Important notes:**
- All API requests are sent directly from your browser
- They use the API keys you provide yourself
- They do not pass through our servers or any intermediary servers
- Your prompt content is sent to the corresponding AI service provider and is subject to its privacy policy

## About Custom APIs

Although the extension only pre-declares the API domain permissions for OpenAI, Google Gemini, and DeepSeek in its manifest, you can still use a custom API. This is because:

1. **How the Content Security Policy works**: The Content Security Policy of Chrome extensions allows the extension to connect, at runtime, to domains that the user has explicitly authorized, even if those domains are not pre-declared in the manifest.

2. **How to use a custom API**:
   - In the extension's "Model Management" interface, click "Add Custom Model"
   - Fill in the information of the custom API, including the API URL, model name, and API key
   - After saving, you can use this custom API

3. **Authorization on first connection**:
   - When you first try to use a custom API, Chrome shows a permission request dialog
   - You need to explicitly authorize the extension to connect to this custom domain
   - After authorization, the extension can communicate with that custom API

4. **Security considerations**:
   - This approach ensures the extension can only connect to domains you have explicitly authorized
   - All connections are still made directly from your browser and do not pass through our servers
   - You can revoke these authorizations at any time in Chrome's extension permission settings

5. **Applicable scenarios**:
   - Using an AI service inside your company
   - Connecting to other API services compatible with the OpenAI format
   - Using a self-hosted open-source model API
   - Connecting to any API endpoint that conforms to the OpenAI-compatible format

This design preserves the flexibility of the extension, allowing you to connect to any API service you need, while also maintaining the security model of Chrome extensions, ensuring that all connections are explicitly authorized by you.

## Why Is Access to Specific API Domains Needed?

Chrome's security mechanism requires extensions to explicitly declare the external domains they need to access. This is an important security feature, known as the "Content Security Policy", which restricts extensions to communicating only with pre-declared domains and prevents malicious extensions from sending data to unauthorized servers.

### Why we need permissions for these specific domains:

1. **A prerequisite for direct API calls**:
   - Without these permissions, the browser would block the extension from sending requests to these AI service providers
   - These permissions are key to the "pure client-side application" architecture, enabling the extension to call AI services directly from your browser without going through our servers

2. **A precise principle of least privilege**:
   - We only request access to the necessary API domains (such as OpenAI, Google Gemini, and DeepSeek)
   - We do not request access to other unrelated domains
   - Each requested domain has a clear purpose (providing AI model services)

3. **Transparent data flow**:
   - These permissions make the data flow fully transparent - from your browser directly to the AI service provider
   - No intermediary server or third party takes part in the data transmission

4. **Security considerations**:
   - Using wildcard patterns (such as `https://api.openai.com/*`) allows access to all paths under that domain
   - This is necessary because AI service providers may offer different API endpoints under different paths
   - All communication takes place over secure HTTPS connections

### What if we didn't have these permissions?

If we did not request access to these specific API domains:

1. The extension could not call the AI service providers' APIs directly
2. The prompt optimization feature would not work
3. We would have to adopt a server relay architecture, which would:
   - Reduce data privacy (your data would have to pass through our servers)
   - Increase latency (one more layer of data transmission)
   - Introduce additional security risks

### User Control

Importantly, even after these permissions are granted:

- The extension only sends requests when you actively use the prompt optimization feature
- You can change or delete your API keys in the extension settings at any time to control whether these services can be called
- All API calls use the API keys you provide yourself, so you have full control over costs and usage

## Principle of Least Privilege

We follow the principle of least privilege and only request the permissions necessary for the application's core functionality. This extension only needs:

1. The `storage` permission - for storing your settings and API keys locally
2. Access to specific API domains - for calling AI services directly from your browser

## Permissions We Do Not Request

To protect your privacy, we deliberately do not request the following permissions:

- **Browsing history** (`history`) - We do not access your browsing history
- **Access to all websites** (`<all_urls>` as a permission) - We do not need to access the content of the web pages you browse
- **Active tab** (`activeTab`) - We do not need to access the content of the page you are currently viewing
- **Context menus** (`contextMenus`) - We do not add right-click menu items
- **Background running permission** (`background` as a persistently running background) - Our extension does not run persistently in the background
- **Network request interception** (`webRequest`) - We do not intercept or modify your network requests
- **Cookie access** (`cookies`) - We do not read or modify your cookies

## Pure Client-Side Architecture

Prompt Optimizer uses a pure client-side architecture, which means:

1. All data storage and processing is done in your local browser
2. No proprietary servers collect or process your data
3. API calls are sent directly from your browser to AI service providers
4. Your API keys and settings are stored only on your device

## Permission Usage Transparency

We promise to:

- Only request the permissions necessary to provide the core functionality
- Clearly explain the purpose of each permission
- Not abuse any granted permission
- Keep the code open source to ensure transparency

If you have any questions about our use of permissions, please contact us through GitHub Issues: https://github.com/linshenkx/prompt-optimizer/issues