export const config = {
  matcher: [
    /*
     * Matches all paths except:
     * - api routes (starting with /api/)
     * - static files (ending with .)
     * - other static assets
     */
    '/((?!api|_next/static|_next/image|favicon.ico|assets/|.*\\.).*)' 
  ],
};

export default function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Access environment variables
  const accessPassword = process.env.ACCESS_PASSWORD;
  
  // If no password is set, allow access directly
  if (!accessPassword) {
    return; // Return nothing, meaning continue processing the request
  }

  // Check the authentication state
  const cookieHeader = request.headers.get('cookie');
  let authenticated = false;
  
  if (cookieHeader) {
    const cookies = cookieHeader.split(';');
    const accessTokenCookie = cookies.find(cookie => 
      cookie.trim().startsWith('vercel_access_token=')
    );
    
    if (accessTokenCookie) {
      const accessToken = accessTokenCookie.split('=')[1];
      authenticated = accessToken === accessPassword;
    }
  }
  
  // If already authenticated, allow access
  if (authenticated) {
    return; // Return nothing, meaning continue processing the request
  }

  // Not authenticated, return the authentication page
  return new Response(generateAuthPage(), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

function generateAuthPage() {
  // Text object
  const text = {
    title: 'Access Verification - Prompt Optimizer',
    heading: 'Prompt Optimizer',
    subtitle: 'This site is password protected',
    passwordLabel: 'Access Password',
    passwordPlaceholder: 'Enter access password',
    submitButton: 'Verify & Access',
    loading: 'Verifying, please wait...',
    footer: 'Secure Access Control | Powered by Vercel',
    errorNetwork: 'Network error, please try again',
  };

  return `
<!DOCTYPE html>
<html lang="${'en'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${text.title}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 0;
        }
        
        .auth-modal {
            background: white;
            padding: 2.5rem;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            width: 100%;
            max-width: 400px;
            text-align: center;
            animation: fadeIn 0.3s ease-out;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .logo {
            font-size: 2rem;
            margin-bottom: 1rem;
            color: #667eea;
        }
        
        h1 {
            font-size: 1.5rem;
            color: #333;
            margin-bottom: 0.5rem;
        }
        
        .subtitle {
            color: #666;
            margin-bottom: 2rem;
            font-size: 0.9rem;
        }
        
        .form-group {
            margin-bottom: 1.5rem;
            text-align: left;
        }
        
        label {
            display: block;
            margin-bottom: 0.5rem;
            color: #333;
            font-weight: 500;
        }
        
        input[type="password"] {
            width: 100%;
            padding: 0.75rem;
            border: 2px solid #e1e5e9;
            border-radius: 6px;
            font-size: 1rem;
            transition: border-color 0.3s;
        }
        
        input[type="password"]:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        .submit-btn {
            width: 100%;
            padding: 0.75rem;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        
        .submit-btn:hover:not(:disabled) {
            background: #5a6fd8;
        }
        
        .submit-btn:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        
        .error-message {
            color: #e74c3c;
            margin-top: 1rem;
            font-size: 0.9rem;
            display: none;
            padding: 0.5rem;
            background: #ffeaea;
            border-radius: 4px;
            border-left: 4px solid #e74c3c;
        }
        
        .loading {
            display: none;
            margin-top: 1rem;
            color: #667eea;
        }
        
        .footer {
            margin-top: 2rem;
            padding-top: 1rem;
            border-top: 1px solid #eee;
            font-size: 0.8rem;
            color: #999;
        }
    </style>
</head>
<body>
    <div class="auth-modal">
        <div class="logo">🚀</div>
        <h1>${text.heading}</h1>
        <p class="subtitle">${text.subtitle}</p>
        
        <form id="authForm">
            <div class="form-group">
                <label for="password">${text.passwordLabel}</label>
                <input 
                    type="password" 
                    id="password" 
                    name="password" 
                    required 
                    placeholder="${text.passwordPlaceholder}"
                    autocomplete="current-password"
                >
            </div>
            
            <button type="submit" class="submit-btn" id="submitBtn">
                <span id="btnText">${text.submitButton}</span>
            </button>
            
            <div class="error-message" id="errorMessage"></div>
            <div class="loading" id="loading">${text.loading}</div>
        </form>
        
        <div class="footer">
            ${text.footer}
        </div>
    </div>

    <script>
        const form = document.getElementById('authForm');
        const submitBtn = document.getElementById('submitBtn');
        const btnText = document.getElementById('btnText');
        const errorMessage = document.getElementById('errorMessage');
        const loading = document.getElementById('loading');
        const passwordInput = document.getElementById('password');
        
        // Language settings
        const errorMessages = {
            network: '${text.errorNetwork}',
            invalidPassword: 'Invalid password, please try again'
        };

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const password = passwordInput.value.trim();
            if (!password) return;

            // Show the loading state
            submitBtn.disabled = true;
            btnText.style.display = 'none';
            loading.style.display = 'block';
            errorMessage.style.display = 'none';

            try {
                console.log('Starting password verification');
                const response = await fetch('/api/auth', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        action: 'verify',
                        password: password
                    })
                });

                const data = await response.json();

                if (data.success) {
                    // Authentication succeeded, refresh the page
                    window.location.reload();
                } else {
                    // Authentication failed
                    console.log('Authentication failed', { message: data.message });
                    errorMessage.textContent = data.message || errorMessages.invalidPassword;
                    errorMessage.style.display = 'block';
                    passwordInput.value = '';
                    passwordInput.focus();
                }
            } catch (error) {
                console.error('Authentication request failed:', error);
                errorMessage.textContent = errorMessages.network;
                errorMessage.style.display = 'block';
            } finally {
                // Restore the button state
                submitBtn.disabled = false;
                btnText.style.display = 'inline';
                loading.style.display = 'none';
            }
        });

        // Focus the password input
        passwordInput.focus();

        // Clear the error message when the user starts typing
        passwordInput.addEventListener('input', () => {
            errorMessage.style.display = 'none';
        });
        
        // Press the ESC key to focus the password input
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                passwordInput.focus();
                errorMessage.style.display = 'none';
            }
        });
    </script>
</body>
</html>`;
} 