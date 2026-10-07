#!/bin/sh

# Config file path
CONFIG_FILE="/usr/share/nginx/html/config.js"

echo "========================================="
echo "Starting to generate the runtime config file..."
echo "Target file: $CONFIG_FILE"
echo "========================================="

# Check whether the target directory exists
TARGET_DIR=$(dirname "$CONFIG_FILE")
if [ ! -d "$TARGET_DIR" ]; then
    echo "ERROR: target directory does not exist: $TARGET_DIR"
    mkdir -p "$TARGET_DIR" || echo "ERROR: unable to create the directory"
fi

# Build the runtime config containing all VITE_* variables (injecting keys both with and without the prefix)
CONFIG_BODY=""
COUNT=0

# Show all VITE_* environment variables for debugging
echo "Scanning VITE_* environment variables..."
env | grep '^VITE_' || echo "No VITE_* variables found"
echo "========================================="

# Iterate over all environment variables starting with VITE_
for var in $(env | grep '^VITE_[A-Za-z0-9_]*=' | cut -d= -f1 | sort); do
  value=$(printenv "$var" 2>/dev/null)
  if [ -n "$value" ]; then
    # Strip the VITE_ prefix to get the unprefixed key name
    no_prefix_key=$(echo "$var" | sed 's/^VITE_//')
    # Simple escaping (backslashes and double quotes)
    escaped_value=$(printf '%s' "$value" | sed 's/\\/\\\\/g; s/"/\\"/g')

    # Append properties: the unprefixed copy and the prefixed copy
    if [ -n "$CONFIG_BODY" ]; then
      CONFIG_BODY="${CONFIG_BODY},
"
    fi
    CONFIG_BODY="${CONFIG_BODY}  ${no_prefix_key}: \"${escaped_value}\",
  ${var}: \"${escaped_value}\""

    COUNT=$((COUNT + 1))
    echo "Found VITE var: $var"
  fi
done

# Generate the config file (readable at runtime in the browser environment)
cat > "$CONFIG_FILE" << EOF
// This file is generated when the container starts, to inject environment variables into the frontend at runtime
// Two copies are provided, with and without the prefix, to suit different reading strategies
window.runtime_config = Object.assign({}, (window.runtime_config || {}), {
${CONFIG_BODY}
});
console.log("Runtime config loaded, injected ${COUNT} VITE_* variables (both key sets)");
EOF

echo "========================================="
echo "Config file generated: $CONFIG_FILE"
echo "Number of VITE_* variables injected: $COUNT"
echo "========================================="

# Verify that the file was generated successfully
if [ -f "$CONFIG_FILE" ]; then
    echo "✅ Config file generated successfully"
    echo "File size: $(wc -c < "$CONFIG_FILE") bytes"
    echo "First 10 lines:"
    head -n 10 "$CONFIG_FILE"
else
    echo "❌ ERROR: Config file generation failed!"
    exit 1
fi

echo "========================================="
