# LLM API Fixtures

This directory contains pre-recorded LLM API responses used for testing.

## Directory Structure

```
fixtures/
├── llm/                     # LLM service responses
│   ├── openai/             # OpenAI API fixtures
│   ├── gemini/             # Gemini API fixtures
│   └── deepseek/           # DeepSeek API fixtures
├── prompt/                 # Prompt optimization service fixtures
└── image/                  # Image generation service fixtures
```

## Fixture Format

Each fixture file is in JSON format and contains:

```json
{
  "request": {
    "provider": "openai",
    "model": "gpt-4",
    "messages": [...],
    "stream": true
  },
  "response": {
    "type": "streaming",
    "chunks": [
      { "content": "Dear", "timestamp": 0 },
      { "content": " Manager Zhang", "timestamp": 50 }
    ],
    "finalResult": {
      "content": "Dear Manager Zhang: ...",
      "usage": { "prompt_tokens": 10, "completion_tokens": 50 }
    }
  },
  "metadata": {
    "recordedAt": "2026-01-09T10:30:00Z",
    "scenarioName": "optimize-basic-system",
    "duration": 1500
  }
}
```

## Recording New Fixtures

### Method 1: Automatic recording (recommended)

```bash
# VCR automatically detects missing fixtures
# If a fixture does not exist, it automatically calls the real API and saves the result
pnpm test
```

### Method 2: Force re-recording

```bash
# Re-record all fixtures
VCR_MODE=record pnpm test

# Re-record a specific test
VCR_MODE=record pnpm test -- prompt-optimization
```

### Method 3: Disable VCR (always use the real API)

```bash
# Warning: this will incur API costs
VCR_MODE=off pnpm test
# or
ENABLE_REAL_LLM=true pnpm test
```

## Updating Existing Fixtures

If the API response format changes, you can update a single fixture:

```bash
# Delete the old fixture
rm packages/core/tests/fixtures/llm/openai/optimize-basic-system.json

# Re-run the test (records automatically)
pnpm test
```

## Version Control

✅ **Should be committed**:
- Typical responses from production
- Edge cases and error scenarios
- Parameter differences between models

❌ **Should not be committed**:
- Sensitive data (API keys, users' personal information)
- Temporary debugging fixtures
- Large fixtures over 10MB

## Best Practices

1. **Use real data**: Fixtures should be based on real API responses, not handwritten
2. **Versioned management**: Create a new version directory (v2/, v3/) for major API changes
3. **Review regularly**: Check every quarter that the fixtures still match the current API
4. **Document**: Describe the scenario's purpose in the file name or in comments

## Troubleshooting

### Fixture Not Taking Effect

Check:
1. Whether the file path is correct (scenarioName matches)
2. Whether the JSON format is valid
3. Whether VCR_MODE is 'replay' or 'auto'

### Real API Needed

Set the environment variables:
```bash
export VITE_OPENAI_API_KEY=sk-...
export VITE_DEEPSEEK_API_KEY=sk-...
```

Then run:
```bash
VCR_MODE=record pnpm test
```
