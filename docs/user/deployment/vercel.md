## Vercel Deployment Guide

### Deployment Method Comparison

| Method | Pros | Cons |
|---------|------|------|
| One-click deploy | Quick and easy, no extra setup | Cannot automatically sync updates from the source project |
| Fork then import | Can track source project updates, easier to maintain | The first deployment requires manually fixing the root directory setting to enable the Vercel proxy feature |

### Recommended: Fork the Project and Import into Vercel (Recommended)

This method lets you track project updates, making it easy to sync the latest features and bug fixes later.

1. **Fork the project to your own GitHub**
   - Visit the [prompt-optimizer project](https://github.com/linshenkx/prompt-optimizer)
   - Click the "Fork" button in the top right corner
   - After forking, you will have a copy of this project under your own GitHub account

2. **Import the project into Vercel**
   - Log in to the [Vercel platform](https://vercel.com/)
   - Click "Add New..." → "Project"
   - In the "Import Git Repository" section, find the project you forked and click "Import"
   - Configure the project (**Note**: you can set a root directory here, but it has no effect for multi-module projects, so you still need to fix it manually later)
   - Click "Deploy" to start the deployment

   ![Import the project into Vercel](../images/vercel/import.png)

3. **Fix the root directory setting (strongly recommended)**
   - When deploying through import, the project's `vercel.json` file already contains the relevant fixes so basic functionality works
   - But to enable the **Vercel proxy feature** (the key feature for solving cross-origin issues), you need to fix the root directory manually:
   
   a. After the project has been deployed, go to the project settings
   
   b. Click "Build and Deployment" in the left menu
   
   c. In the "Root Directory" section, **clear** the contents of the input box
   
   d. Click "Save" to save the settings
   
   ![Clear the root directory setting](../images/vercel/setting.png)

4. **Configure environment variables (optional)**
   - After deployment, go to the project settings
   - Click "Environment Variables"
   - Add the API keys you need (for example `VITE_OPENAI_API_KEY`)
   - To enable access restriction:
     - Add an environment variable named `ACCESS_PASSWORD`
     - Set a secure password as its value
   - Save the environment variable settings

5. **Redeploy the project**
   - After saving the settings, you need to manually trigger a redeployment for the fixes and environment variables to take effect
   - Click "Deployments" in the top navigation bar
   - On the right side of the latest deployment record, click the "..." button
   - Select the "Redeploy" option to trigger a redeployment
   
   ![Redeploy the project](../images/vercel/redeploy.png)

6. **Sync upstream updates**
   - Open your forked project on GitHub
   - If there are updates, it will show "This branch is X commits behind linshenkx:main"
   - Click the "Sync fork" button to sync the latest changes
   - Vercel will automatically detect the code change and redeploy

### Alternative: One-Click Deploy to Vercel

If you only need a quick deployment and do not care about later updates, you can use the one-click deployment:

1. Click the button below to deploy directly to Vercel
   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Flinshenkx%2Fprompt-optimizer)

2. Follow Vercel's guide to complete the deployment process
   
   **Advantage:** With one-click deployment, Vercel automatically identifies the root directory correctly, so no manual fix is needed, and all features (including the Vercel proxy) work normally.

### About the Vercel Proxy Feature

When deployed on Vercel, Prompt Optimizer supports using an Edge Runtime proxy to solve cross-origin issues.

1. **Confirm the proxy feature is available**
   - With one-click deployment: the proxy feature should work directly
   - With import deployment: complete the "Fix the root directory setting" and "Redeploy the project" steps above
   - Open "Model Management" in the app
   - Select the target model -> "Edit"; you should now see the "Use Vercel Proxy" option
   - If you do not see this option, the Vercel Function was not deployed correctly; please check the root directory setting

2. **Enable the proxy feature**
   - Check the "Use Vercel Proxy" option
   - Save the configuration

3. **How the proxy works**
   - Request flow: Browser → Vercel Edge Runtime → model provider
   - It solves the cross-origin restriction when the browser accesses APIs directly
   - The proxy feature is implemented with a Vercel Function and depends on the `/api` path

4. **Notes**
   - Some model providers may restrict requests coming from Vercel
   - If you run into restrictions, we recommend using a self-hosted API relay service

### Password-Protected Access

After the `ACCESS_PASSWORD` environment variable is configured, your site will have password protection enabled:
- A password verification page is shown when accessing the site
- After entering the correct password you can access the app
- The system sets a cookie to remember the user, so the password does not need to be re-entered for a period of time

### FAQ

1. **Blank page or errors after deployment**
   - Check whether the environment variables are configured correctly
   - Check the Vercel deployment logs to find the cause of the error

2. **Cannot connect to the model API**
   - Confirm the API key is configured correctly
   - Try enabling the Vercel proxy feature
   - Check whether the model provider restricts Vercel requests

3. **The "Use Vercel Proxy" option is not displayed**
   - With import deployment: check that you have cleared the root directory setting and redeployed
   - Check the deployment logs for Function-related error messages

4. **How do I update an already deployed project?**
   - If you forked then imported: sync the fork and wait for the automatic deployment
   - If you used one-click deployment: you need to redeploy the new version (it cannot automatically track source project updates)

5. **How do I add a custom domain?**
   - Select "Domains" in the Vercel project settings
   - Add and verify your domain
   - Configure the DNS records following the instructions
