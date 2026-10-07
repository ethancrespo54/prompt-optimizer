export default function handler(req, res) {
  // Set the CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const accessPassword = process.env.ACCESS_PASSWORD;
  
  // If no password is set, return success directly
  if (!accessPassword) {
    return res.status(200).json({ 
      success: true, 
      message: 'No password protection configured' 
    });
  }

  if (req.method === 'POST') {
    const { password, action } = req.body;
    
    if (action === 'verify') {
      if (password === accessPassword) {
        // Set a Cookie to remember the user's authentication state
        const maxAge = 60 * 60 * 24 * 7; // 7 days
        res.setHeader('Set-Cookie', [
          `vercel_access_token=${accessPassword}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Strict${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
        ]);
        
        return res.status(200).json({ 
          success: true, 
          message: 'Authentication successful' 
        });
      } else {
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid password' 
        });
      }
    }
  }

  if (req.method === 'GET') {
    const { action } = req.query;
    
    if (action === 'logout') {
      // Clear the Cookie
      res.setHeader('Set-Cookie', [
        'vercel_access_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict'
      ]);
      
      return res.status(200).json({ 
        success: true, 
        message: 'Logged out successfully' 
      });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
} 