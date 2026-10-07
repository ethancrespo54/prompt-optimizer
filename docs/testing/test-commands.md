# Test Commands Reference

## 📝 Command Overview

### Daily Development (Recommended)

```bash
# Run all tests (unit + E2E) - unified entry point
pnpm test

# Run unit tests only (fast)
pnpm test:unit

# Quick verification (same as test:unit)
pnpm test:fast
```

### E2E 测试

```bash
# Smart E2E run (automatic replay/record)
pnpm test:e2e:smart

# Explicit replay mode
pnpm test:e2e:replay

# Explicit record mode (overwrites existing fixtures)
pnpm test:e2e:record

# Run E2E only, without unit tests
pnpm test:e2e
```

### CI/CD Gates

```bash
# Lightweight gate (unit + critical E2E)
pnpm test:gate

# Full gate (unit + critical E2E)
pnpm test:gate:full
```

## 🔧 Smart Test Logic

### Behavior of `pnpm test`

When `pnpm test` runs, it executes in order:

1. **Unit tests** (`test:unit`)
   - Runs the Vitest unit tests of all packages
   - Quickly verifies core functionality

2. **E2E tests** (`test:e2e:smart`)
   - Automatically checks whether the VCR fixtures are complete
   - **All present**: uses replay mode (fast, no API usage)
   - **Some missing**: automatically switches to record mode (uses the API, creates fixtures)

### Automatic Recording Scenarios

The smart script records automatically in the following cases:

- ✅ First run of E2E tests
- ✅ New test cases added
- ✅ VCR fixtures deleted

**Cases that are not overwritten**:

- ✅ Test code logic changed (fixture exists, replays automatically)
- ✅ UI code changed (fixture exists, replays automatically)
- ✅ Evaluation logic changed (fixture exists, replay fails, manual recording required)

### Forced Overwrite Recording

When the evaluation logic changes, re-recording is required:

```bash
# Option 1: use the explicit record command
pnpm test:e2e:record

# Option 2: delete specific fixtures, then run
rm tests/e2e/fixtures/vcr/analysis-*/evaluation*.json
pnpm test
```

## 📊 Test Coverage

### Unit Tests (~20-30 seconds)
- Core package: business logic, service layer
- UI package: components, utility functions

### E2E Tests (~40-90 seconds)

#### Analysis Tests (10 test cases)
- ✅ Basic-System (2 tests)
- ✅ Basic-User (2 tests)
- ✅ Image-Text2Image (2 tests)
- ✅ Image-Image2Image (2 tests)
- ✅ Pro-Variable (2 tests)

#### Gate Tests (2 test files)
- ✅ Regression tests
- ✅ Route Smoke tests (6 routes)

## ⚡ Performance Comparison

| Command | Scenario | Time | API Calls |
|------|------|------|----------|
| `pnpm test:unit` | Daily development | ~20 sec | None |
| `pnpm test` | Full verification | ~60 sec | Only when missing |
| `pnpm test:e2e:record` | Re-recording | ~90 sec | Yes |
| `pnpm test:e2e:replay` | Offline replay | ~50 sec | No |

## 💡 Best Practices

### Daily Development Workflow
```bash
# 1. Modify code
# 2. Quickly verify with unit tests
pnpm test:unit

# 3. Full verification before committing
pnpm test
```

### Evaluation Logic Change Workflow
```bash
# 1. Modify the evaluation template or logic
# 2. Force re-recording of E2E tests
pnpm test:e2e:record

# 3. Verify all tests pass
pnpm test
```

### New Test Case Workflow
```bash
# 1. Add new test code
# 2. Run tests (missing fixtures are recorded automatically)
pnpm test

# 3. Verify the newly added tests
# The script automatically detects and records new fixtures
```

## 🔍 Troubleshooting

### What to do when tests fail?

**Unit test failure**:
```bash
# Run unit tests separately to see detailed errors
pnpm test:unit
```

**E2E replay failure**:
- Check whether it was caused by an evaluation logic change
- If so, run `pnpm test:e2e:record` to re-record

**E2E recording failure**:
- Check whether API keys are configured in `.env.local`
- Check the network connection
- Review the specific error logs

### Missing Fixtures

The smart script handles this automatically, but if you run into problems:

```bash
# See which fixtures are missing
ls tests/e2e/fixtures/vcr/

# Delete all fixtures and re-record
rm -rf tests/e2e/fixtures/vcr/
pnpm test
```

## 📚 Related Documentation

- [E2E Testing Guide](./e2e-guide.md)
- [VCR Usage Guide](./e2e-vcr-guide.md)
- [Selector Strategy](./e2e-selector-strategy.md)
