#!/bin/sh

# Check whether the ACCESS_PASSWORD environment variable is set
if [ -n "$ACCESS_PASSWORD" ]; then
    # Check whether the password is an empty string
    if [ "$ACCESS_PASSWORD" = "" ]; then
        echo "Warning: an empty password is set, which is insecure. Basic auth is not enabled"
        # Create an empty auth config (disable authentication)
        cat > /etc/nginx/conf.d/auth.conf << EOF
# Basic auth is not enabled - the password is empty
auth_basic off;
EOF
        exit 0
    fi

    echo "Enabling Basic auth..."
    
    # Create the auth file directory
    mkdir -p /etc/nginx/auth
    
    # Determine the username (use the default "admin" if ACCESS_USERNAME is not set)
    USERNAME=${ACCESS_USERNAME:-admin}
    
    # Generate the htpasswd file - use printf to avoid special-character problems
    printf '%s' "$ACCESS_PASSWORD" | htpasswd -i -c /etc/nginx/auth/.htpasswd "$USERNAME"
    
    # Simplify permission management in the container environment - make sure the auth file is readable by everyone
    chmod -R a+r /etc/nginx/auth
    
    # Create the config with authentication enabled
    cat > /etc/nginx/conf.d/auth.conf << EOF
# This file is generated automatically by the generate-auth.sh script
auth_basic "Please enter your credentials";
auth_basic_user_file /etc/nginx/auth/.htpasswd;
EOF
    
    echo "Basic auth configured, username: $USERNAME"
else
    echo "ACCESS_PASSWORD environment variable is not set, Basic auth is not enabled"
    
    # Create an empty auth config (disable authentication)
    cat > /etc/nginx/conf.d/auth.conf << EOF
# Basic auth is not enabled
auth_basic off;
EOF
fi 