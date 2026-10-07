# Technical Implementation Details

## 🔧 Architecture Design

### Overall Architecture
```
Frontend app → nginx (80) → Node Proxy (3001) → external LLM API
```

### Design Philosophy
Based on the assumption of a **trusted Docker environment**, with a **simplicity-first** design principle:
- Focus on functionality rather than complex security protection
- Avoid the complexity of nginx dynamic proxying
- Zero-dependency implementation for better maintainability

### Architecture Advantages
- ✅ Avoids the DNS resolution problems of nginx dynamic proxying
- ✅ Simple configuration, easy to maintain
- ✅ Suitable for the trusted environment of Docker containers
- ✅ Clear responsibilities: nginx handles forwarding and Node.js handles the proxy logic

## 🐛 Problem Diagnosis and Resolution

### Core Technical Challenges

#### 1. Complexity of nginx Dynamic Proxying
**Problem**: nginx dynamic proxying requires complex DNS resolution and variable handling
**Solution**: Use the simplified architecture of nginx local forwarding + a Node.js proxy
```nginx
location /api/proxy {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
}
```

#### 2. Streaming Response Passthrough
**Problem**: SSE streaming responses must be passed through in real time and cannot be buffered
**Solution**:
- nginx configuration: `proxy_buffering off` and `X-Accel-Buffering no`
- Node.js implementation: use `Readable.fromWeb()` to handle streams correctly

#### 3. Duplicate CORS Headers
**Problem**: Setting CORS headers in both nginx and Node.js causes duplicates
**Solution**: Handle CORS uniformly in Node.js and do not set it in nginx

#### 4. Timeout Strategy Optimization
**Problem**: LLM streaming requests may take a long time, so a uniform timeout is unreasonable
**Solution**: A differentiated timeout strategy
- Streaming requests: 5-minute timeout
- Regular requests: 2-minute timeout
- Configurable via environment variables

## 📝 Implementation Steps

### Phase 1: Basic Proxy Functionality
1. **Create the Node.js proxy service**
   - Zero-dependency implementation using only built-in modules
   - Supports all HTTP methods
   - Basic error handling

2. **Configure nginx forwarding**
   - Add the `/api/proxy` and `/api/stream` paths
   - Forward locally to 127.0.0.1:3001
   - Basic CORS configuration

3. **Docker integration**
   - Modify supervisord.conf to add the node-proxy process
   - Environment variable configuration support

### Phase 2: Streaming Proxy and UI Integration
1. **Streaming response optimization**
   - Optimize the nginx streaming configuration
   - Node.js uses `Readable.fromWeb()` to handle streams
   - Streaming timeout strategy

2. **Frontend UI integration**
   - Environment detection logic
   - Add a Docker proxy option to ModelManager.vue
   - Internationalized text support

3. **Data persistence**
   - Add useDockerProxy to the ModelConfig interface
   - Configuration save and load logic

### Phase 3: Error Handling and Experience Optimization
1. **Enhanced error handling**
   - Smart error classification: timeout 504, connection error 502, format error 400
   - User-friendly error messages
   - Request tracing system

2. **LLM service integration**
   - Add Docker proxy support to the OpenAI service
   - Add Docker proxy support to the Gemini service
   - Complete the type definitions

3. **End-to-end verification**
   - Functional tests: basic proxying, error handling, streaming responses
   - Performance tests: response time, memory usage, concurrency handling
   - Integration tests: frontend UI, LLM services, build system

## 🔍 Debugging Process

### Debugging Tool Combination
- **Nginx access_log**: dedicated log for /api/*
- **Node Proxy logs**: detailed request handling logs
- **Browser network panel**: check the frontend request status

### Key Debugging Points
1. **CORS issues**: ensure only Node.js sets the CORS headers
2. **Streaming responses**: check the nginx buffering configuration and Node.js stream handling
3. **Timeout handling**: verify the timeout strategy for each request type
4. **Error classification**: ensure error codes and messages are correct

## 🧪 Test Verification

### Functional Test Cases
```javascript
// Basic proxy test
GET /api/proxy?url=https://httpbin.org/get
Expected: 200 status code, correct JSON response

// Error handling test
GET /api/proxy?url=https://nonexistent-domain.com
Expected: 502 status code, friendly error message

// Streaming response test
GET /api/stream?url=https://httpbin.org/stream/5
Expected: real-time streaming data with no buffering delay
```

### Performance Test Metrics
- **Response time**: 6-7 seconds (normal latency of httpbin.org)
- **Memory usage**: stable, no memory leaks
- **Concurrency handling**: supports multiple simultaneous requests
- **Resource cleanup**: timers are cleaned up correctly

### Integration Test Verification
- **Frontend UI**: proxy options are displayed and saved correctly
- **LLM services**: the Docker proxy configuration is passed correctly
- **Build system**: the Core and UI packages build successfully
- **Type checking**: TypeScript checks pass

## 🔧 Core Code Implementation

### Core Logic of the Node.js Proxy Service
```javascript
// Zero-dependency implementation using only built-in modules
const http = require('http');
const { Readable } = require('stream');

// Streaming response handling
if (upstreamRes.headers['content-type']?.includes('text/event-stream')) {
    const stream = Readable.fromWeb(upstreamRes.body);
    stream.pipe(res);
}

// Smart error handling
const handleError = (error, res, requestId) => {
    if (error.code === 'ENOTFOUND') {
        return sendError(res, 502, 'DNS resolution failed', requestId);
    }
    if (error.code === 'ECONNREFUSED') {
        return sendError(res, 502, 'Connection refused', requestId);
    }
    return sendError(res, 500, 'Internal server error', requestId);
};
```

### Core Part of the nginx Configuration
```nginx
# Basic proxy configuration
location /api/proxy {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
}

# Streaming response configuration
location /api/stream {
    proxy_pass http://127.0.0.1:3001;
    proxy_buffering off;
    proxy_request_buffering off;
    add_header X-Accel-Buffering no always;
}
```

### Frontend Environment Detection
```typescript
export const checkDockerApiAvailability = async (): Promise<boolean> => {
    try {
        const response = await fetch('/api/docker-status');
        return response.ok;
    } catch {
        return false;
    }
};
```

## 📊 Performance Optimization

### Key Optimization Points
1. **Streaming passthrough**: nginx turns off buffering and Node.js uses `Readable.fromWeb()`
2. **Timeout strategy**: differentiated timeouts, 5 minutes for streaming and 2 minutes for regular requests
3. **Error handling**: fail fast to avoid long waits
4. **Resource cleanup**: clean up timers and connections promptly

### Monitoring Metrics
- **Request tracing**: unique request IDs
- **Performance logs**: response time, status code, error rate
- **Resource usage**: memory, CPU, connection count

## 🔒 Security Considerations

### Current Security Measures
- **Trusted environment assumption**: based on the trusted environment of Docker containers
- **Basic CORS configuration**: allows cross-origin access
- **Error message filtering**: avoids leaking sensitive information

### Optional Security Enhancements
- **URL allowlist**: restrict the target domains that can be accessed
- **Rate limiting**: prevent abuse
- **Request size limits**: prevent large-file attacks

## 🎯 Technical Highlights

1. **Zero-dependency implementation**: improves security and maintainability
2. **Concise architecture**: avoids complex nginx dynamic proxy configuration
3. **Streaming passthrough**: correctly handles SSE streaming responses
4. **Smart error handling**: user-friendly error classification and messages
5. **Complete integration**: full support in the frontend UI, LLM services and type definitions

This implementation provides a complete, reliable and easy-to-maintain API proxy solution for Docker deployment environments.
