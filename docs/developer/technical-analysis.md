# Technical Analysis and Problem-Solving Document

> This document consolidates the technical analysis and problem solutions from the project's development

## Table of Contents

1. [IndexedDB Database Issue Analysis](#1-indexeddb-database-issue-analysis)
2. [Image Storage Solution](#2-image-storage-solution)
3. [Mode Terminology Migration Summary](#3-mode-terminology-migration-summary)
4. [Code Review Prompt Evaluation](#4-code-review-prompt-evaluation)

---

## 1. IndexedDB Database Issue Analysis

### 1.1 Why Does Data Accumulate?
# 📊 Why Does IndexedDB Accumulate Endlessly to 2.4 GB?

## 🔍 Root Cause Analysis

### 1. **Auto-save mechanism (saves on every change)**

There are three places in the code that automatically trigger a save:

```typescript
// PromptOptimizerApp.vue:1954-1960
window.addEventListener('pagehide', handlePagehide)          // ① On page unload
document.addEventListener('visibilitychange', handleVisibilityChange)  // ② On tab switch
```

```typescript
// PromptOptimizerApp.vue:1105-1128
watch(
    () => promptTester.testResults,
    (newTestResults) => {
        // Every time the test results change, they are automatically synced to the session store
        (session as any).updateTestResults(stableResults);
    },
    { deep: true }  // ⚠️ Deep watch, any field change triggers it
);
```

**This means:**
- ✅ Every time a test completes → `updateTestResults` is called → `lastActiveAt = Date.now()`
- ✅ Switching tabs → triggers `visibilitychange` → calls `saveAllSessions()`
- ✅ Closing the page → triggers `pagehide` → calls `saveAllSessions()`

### 2. **The entire state is saved (including the huge testResults)**

```typescript
// useBasicSystemSession.ts:211-227
const saveSession = async () => {
    // ❌ Serializes the whole state directly, with no filtering or truncation
    const snapshot = JSON.stringify(state.value)
    await $services.preferenceService.set('session/v1/basic-system', snapshot)
}
```

**state.value contains:**
```typescript
interface BasicSystemSessionState {
  prompt: string
  optimizedPrompt: string
  reasoning: string
  testContent: string
  testResults: TestResults | null  // ⚠️ This can grow without bound!
  // ...other fields
}

interface TestResults {
  originalResult: string       // ⚠️ Could be tens of KB
  originalReasoning: string    // ⚠️ Could be tens of KB
  optimizedResult: string      // ⚠️ Could be tens of KB
  optimizedReasoning: string   // ⚠️ Could be tens of KB
}
```

### 3. **There is no size limit at all**

```typescript
// useBasicSystemSession.ts:128-143
const updateTestResults = (results: TestResults | null) => {
    // ❌ Doesn't check the size of results
    // ❌ Doesn't truncate overly long text
    // ❌ Doesn't limit the number of history entries
    state.value.testResults = results
    state.value.lastActiveAt = Date.now()
}
```

**For comparison: there is no protective code at all:**
- ❌ No `if (size > MAX_SIZE) { truncate() }`
- ❌ No `if (text.length > 50000) { text = text.slice(0, 50000) }`
- ❌ No `cleanupOldResults()`

### 4. **There is no cleanup mechanism**

Searching the entire codebase:
```bash
# Search for cleanup-related code
grep -r "cleanup\|clean\|delete.*test\|remove.*test" packages/ui/src/stores/session
# Result: No matches found ❌
```

**This means:**
- ❌ Test results are never deleted
- ❌ Old data never expires
- ❌ The database only gets bigger

## 📈 Example of the Accumulation Process

Suppose the user's usage scenario is:

### Day 1: Normal usage
```
Test 1: GPT-4 output 5 KB → saved to IndexedDB (5 KB)
Test 2: Claude output 8 KB → saved to IndexedDB (8 KB)
Test 3: Gemini output 6 KB → saved to IndexedDB (6 KB)
Total: 19 KB ✅
```

### Day 2: Continued testing
```
Tests 4-10: 5-10 KB each
Total: 19 KB + 70 KB = 89 KB ✅
```

### Day 30: One month later
```
Tests 1-300: average 7 KB each
Total: 300 * 7 KB = 2.1 MB ⚠️
```

### Day 90: Three months later
```
Tests 1-900: average 7 KB each
Total: 900 * 7 KB = 6.3 MB ⚠️⚠️
```

### But the actual situation is worse!

**If the user tested a very long output:**
```typescript
// The user had GPT-4 write a long article
testResults = {
  originalResult: "A very long article...",      // 100 KB
  originalReasoning: "Detailed reasoning...",   // 50 KB
  optimizedResult: "The optimized long article...", // 120 KB
  optimizedReasoning: "Optimization reasoning...",    // 60 KB
}
// A single test = 330 KB!
```

**If the user frequently switches tabs:**
```
The user opens 10 tabs → each tab has its own session
Each session accumulates test results
10 * 6.3 MB = 63 MB ⚠️⚠️⚠️
```

**If the user uses multi-turn conversations in Pro mode:**
```typescript
// Pro - multi-message mode
messages = [
  { role: 'user', content: '...' },    // Each may be 10-50 KB
  { role: 'assistant', content: '...' },
  // ... 30 messages
]
// A single session = 30 * 30 KB = 900 KB
```

### The final result: a 2.4 GB database

```
6 session stores (basic-system, basic-user, pro-system, pro-user, image-text2image, image-image2image)
× each accumulating 3 months of test results
× no cleanup at all
× saved on every tab switch
= 2.4 GB 💥
```

## 🔧 Why Is There No Protection in the Code?

### 1. **Over-trusting user behavior**
The developers assumed:
- ❌ "Users won't test very long text"
- ❌ "Users won't switch tabs frequently"
- ❌ "Users will clean up their data regularly"

The reality:
- ✅ Users often test GPT-4's long answers (5000+ words)
- ✅ Users open many tabs
- ✅ Users have no idea they need to clean up

### 2. **Missing monitoring and alerting**
There is no code that checks:
- ❌ IndexedDB usage
- ❌ The size of a single session
- ❌ Serialization time (over 1 second indicates the data is too large)
### 3. **Missing automatic cleanup strategy**
Common practice in other applications:
```typescript
// ✅ Example: automatically clean up data older than 7 days
const cleanupOldData = () => {
  const now = Date.now();
  const WEEK = 7 * 24 * 60 * 60 * 1000;

  if (state.value.lastActiveAt && (now - state.value.lastActiveAt) > WEEK) {
    state.value.testResults = null;
    state.value.testContent = '';
  }
}

// ✅ Example: limit the size of a single field
const MAX_RESULT_LENGTH = 50000; // 50 KB
if (results.originalResult.length > MAX_RESULT_LENGTH) {
  results.originalResult = results.originalResult.slice(0, MAX_RESULT_LENGTH) + '...[truncated]';
}

// ✅ Example: database size check
if (estimatedSize > 100 * 1024 * 1024) { // 100 MB
  console.warn('Database is too large, cleanup recommended');
  showCleanupDialog();
}
```

## 📊 Comparison With Your Situation

Your backed-up database:
```
Total size: 2.4 GB
Number of files: 40+ .ldb files
Largest file: 27 MB
```

This indicates:
- ✅ You have used the app for a long time (possibly several months)
- ✅ You tested a lot of text (possibly including GPT-4's long answers)
- ✅ You never manually cleaned up the data
- ✅ The database reached the browser's critical point (crashes on open)

## ✅ Summary

**Three key reasons for the unbounded accumulation:**

1. **Auto-save is very frequent** - It saves on every test and every tab switch
2. **The saved data is very large** - Complete test results with no truncation
3. **It is never cleaned up** - There is no cleanup logic in the code

**Solutions:**
- 🔧 Immediate: delete the database to reset it (a tool has been provided)
- 🛡️ Prevention: implement data size limits and automatic cleanup (next task)

### 1.2 Why Does It Append Instead of Overwrite?
# 🔍 Why Is It Added Rather Than Overwritten? In-Depth Cause Analysis

## Key Finding

Your IndexedDB is indeed using an **overwrite operation** (put), but the underlying storage mechanism causes the data to "accumulate" rather than truly be overwritten.

## 1️⃣ Code level: it really is an overwrite operation

```typescript
// dexieStorageProvider.ts:91-95
async setItem(key: string, value: string): Promise<void> {
  await this.db.storage.put({    // ✅ put() is an overwrite operation
    key,                          // Same primary key
    value,                        // New value
    timestamp: Date.now()
  });
}
```

```typescript
// Database definition: dexieStorageProvider.ts:23-25
this.version(1).stores({
  storage: 'key, value, timestamp'  // ✅ 'key' is the primary key
});
```

**Logically:** Each call to `setItem('session/v1/basic-system', newData)` **should overwrite** the old value of the same key.

## 2️⃣ Underlying storage: LevelDB's LSM-Tree architecture

However! Chrome's IndexedDB uses **LevelDB** underneath, and LevelDB uses an **LSM-Tree (Log-Structured Merge Tree)** architecture.

### How the LSM-Tree works

```
Write flow (Append-Only):
┌─────────────────────────────────────────────────────────────┐
│ 1. Write to the MemTable (memory)                            │
│    - key='session/v1/basic-system'                           │
│    - value='{"prompt":"..."}'  (1 KB)                        │
│    - Does not check whether the same key already exists      │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. MemTable full → flushed to an SSTable file (.ldb)         │
│    - 001445.ldb (contains this write)                        │
│    - Old files are NOT deleted!                              │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Write the same key again                                  │
│    - key='session/v1/basic-system'                           │
│    - value='{"prompt":"...", "testResults": {...}}'  (500 KB)│
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Flushed again to a new SSTable file                       │
│    - 001496.ldb (contains the new value)                     │
│    - 001445.ldb still exists! (contains the old value)       │
└─────────────────────────────────────────────────────────────┘
```

### Why isn't the old data deleted?

**Key point:** The LSM-Tree is an **Append-Only** architecture:
- ❌ It does not modify existing .ldb files in place
- ❌ It does not immediately delete old versions of data
- ✅ Every write creates a new record
- ✅ Old data is cleaned up through **Compaction**

## 3️⃣ Compaction is not executed in time

### Normal case

```
100 writes → 100 versions accumulated → triggers Compaction
                                     ↓
                          Merge multiple .ldb files
                                     ↓
                          Remove duplicate keys, keep only the latest version
                                     ↓
                          Database size drops back
```

### Your case: Compaction is delayed or failing

Possible causes:

1. **Browser crash or abnormal exit**
   - Compaction is a background task
   - If the browser crashes frequently, Compaction cannot finish
   - Old data keeps accumulating

2. **Data write speed > Compaction speed**
   ```
   10 writes per second (very frequent tab switching)
   vs
   Compaction runs once every 10 seconds

   → Accumulation is faster than cleanup
   ```

3. **Data too large causes Compaction to fail**
   ```
   A single .ldb file = 27 MB
   Merging 10 files = 270 MB

   → Compaction needs a lot of memory
   → The browser runs out of memory
   → Compaction fails, old data is retained
   ```

4. **LevelDB's Compaction strategy**
   ```
   Level 0: newly written files (unsorted)
   Level 1-6: compacted files (sorted)

   Compaction trigger conditions:
   - Number of Level 0 files > 4
   - Total size of Level N > threshold

   Your case:
   - 40+ .ldb files → possibly stuck at Level 0
   - Compaction was not triggered or did not complete
   ```

## 4️⃣ Analysis of Your Database State

```bash
$ ls -lhS *.ldb | head -10
-rw-r--r-- 27M 001445.ldb  # 1st large save
-rw-r--r-- 27M 001481.ldb  # 2nd large save
-rw-r--r-- 26M 001534.ldb  # 3rd large save
...
40+ files in total = 2.4 GB
```

**This indicates:**
- ✅ Every save created a new .ldb file
- ✅ The old .ldb files were never cleaned up
- ✅ Compaction **was never executed at all** or **kept failing**

## 5️⃣ Why Don't Other Applications Have This Problem?

### Comparison: a normal Web application

```typescript
// ✅ Other applications typically do this
await db.users.put({ id: 1, name: 'Alice' })  // 1 KB
await db.users.put({ id: 2, name: 'Bob' })    // 1 KB
// ...

// Characteristics:
// - Small data volume (1-10 KB per record)
// - Low write frequency (1-2 per second)
// - Compaction can clean up in time
```

### Your application

```typescript
// ❌ The situation in Prompt Optimizer
await db.storage.put({
  key: 'session/v1/basic-system',
  value: JSON.stringify({
    // ...
    testResults: {
      originalResult: '...very long text...',      // 100 KB
      optimizedResult: '...even longer text...',     // 120 KB
    }
  })
})  // A single write of 500 KB - 2 MB!

// Characteristics:
// - Huge data volume (500 KB - 2 MB each time)
// - High write frequency (written on every tab switch)
// - Compaction can't keep up, accumulating to 2.4 GB
```

## 6️⃣ Root Cause Summary

| Layer | Problem | Impact |
|------|------|------|
| **Application layer** | Saves the complete testResults with no truncation | A single write of 500 KB - 2 MB |
| **Application layer** | Frequent auto-save (on every tab switch) | Write frequency too high |
| **Storage layer** | LevelDB's LSM-Tree uses append-style writes | Every write creates a new record |
| **Storage layer** | Compaction not timely or failing | Old data is never deleted |
| **Result** | **2.4 GB of accumulated data** | **Browser crash** |

## 7️⃣ Chain of Evidence

```
User behavior            IndexedDB logic          LevelDB physical layer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Test 10 times     →    10 put() operations →   10 new records appended to the MemTable
Switch tabs       →    triggers saveSession →  MemTable flushed to 001445.ldb (27 MB)

Test 10 more times →   10 put() operations →   10 new records appended to the MemTable
Switch tabs       →    triggers saveSession →  MemTable flushed to 001481.ldb (27 MB)

                                                ⚠️ 001445.ldb still exists!
                                                ⚠️ Compaction not executed

Repeat for 3 months →  1000 saves          →   40+ .ldb files = 2.4 GB
                                                ⚠️ All old files are retained
                                                ⚠️ Compaction fails completely

Try to open the page → indexedDB.open()    →   LevelDB tries to read all .ldb files
                                                ⚠️ Loads 2.4 GB into memory
                                                💥 Browser crash
```

## 8️⃣ Solutions

### Immediate fix (treats the symptom)
1. Delete the entire IndexedDB database
2. The browser recreates a clean database

### Root fix (treats the cause)
1. **Limit the size of a single write**
   ```typescript
   if (testResults.originalResult.length > 50000) {
     testResults.originalResult = testResults.originalResult.slice(0, 50000) + '...'
   }
   ```

2. **Reduce the write frequency**
   ```typescript
   // Use debounce, saving at most once every 5 seconds
   const debouncedSave = debounce(saveSession, 5000)
   ```

3. **Periodically clean up old data**
   ```typescript
   // Keep only the most recent test results
   state.value.testResults = latestResults
   ```

4. **Store large data separately**
   ```typescript
   // Store testResults separately instead of in the session
   await db.testResults.put({ sessionId, results })
   ```

## 9️⃣ Why Doesn't the Browser Fix This Automatically?

Chrome's LevelDB Compaction depends on:
- ✅ Triggering when the browser **closes normally**
- ✅ Running automatically when the database is **idle**
- ❌ Cannot complete when the browser **crashes**
- ❌ Is delayed when the database is under **sustained high load**

Your situation:
1. The app writes frequently → the database is always busy
2. The browser may crash from the oversized data → Compaction cannot complete
3. A vicious cycle forms → the data only grows and never shrinks

---

## ✅ Summary

**The essence of the problem:**

It is not an issue of "append vs. overwrite", but rather:
1. **Logically an overwrite** (put on the same key)
2. **Physically an append** (LSM-Tree architecture)
3. **The cleanup mechanism fails** (Compaction is not executed)
4. **The data only grows and never shrinks** (2.4 GB accumulated)

**Analogy:**
It is like putting new files (values) into the same filing cabinet (key) every day. Although the name is the same, nobody cleans out the old files, and eventually the cabinet overflows.

### 1.3 Why Does Separate Storage Work?
# 🔍 Why Can Separate Storage Solve the Problem?

## Core Problem: Different Save Frequencies

### Current Pattern (Problem)

```typescript
// ❌ The Session contains the full image
interface SessionState {
  originalPrompt: string
  originalImageResult: {
    images: [{ b64: "2-3 MB of base64..." }]  // Included in the session
  }
}

// Save flow
saveSession() {
  const snapshot = {
    prompt: state.prompt,
    imageResult: state.originalImageResult  // ← Includes a 26 MB image
  }
  await db.put('session', snapshot)  // ← Saves 26 MB every time
}

// Trigger timing
- User generates an image → save
- User switches tabs → save ← includes the image!
- User switches back → save ← includes the image!
- User closes the page → save ← includes the image!
```

**Problem:**
```
Timeline:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

10:00  Generate image 1 (26 MB)
       ↓ saveSession()
       ↓ Write 001.ldb (26 MB)

10:05  Switch tabs
       ↓ saveSession()
       ↓ Write 002.ldb (26 MB) ← Image 1 saved again!

10:10  Switch back
       ↓ saveSession()
       ↓ Write 003.ldb (26 MB) ← Image 1 saved yet again!

10:15  Close the page
       ↓ saveSession()
       ↓ Write 004.ldb (26 MB) ← Image 1 saved yet again!

10:20  Reopen, generate image 2 (26 MB)
       ↓ saveSession()
       ↓ Write 005.ldb (26 MB) ← Image 2

10:25  Switch tabs again
       ↓ saveSession()
       ↓ Write 006.ldb (26 MB) ← Image 2 saved again!

... repeated 42 times ...

Total: 42 files × 26 MB = 1.1 GB ❌
```

---

### Separate Pattern (Solution)

```typescript
// ✅ The Session only stores a reference
interface SessionState {
  originalPrompt: string
  originalImageRef: {
    imageId: "img_123456"  // ← Only stores the ID (20 bytes)
  }
}

// The image is stored separately
interface ImageRecord {
  id: string
  data: {
    images: [{ b64: "2-3 MB of base64..." }]
  }
  createdAt: number
}

// Save flow (separated)
saveSession() {
  const snapshot = {
    prompt: state.prompt,
    imageRef: state.originalImageRef  // ← Only the ID, a few KB
  }
  await db.put('session', snapshot)  // ← Saves only a few KB
}

saveImage(data) {
  const imageRecord = {
    id: `img_${Date.now()}`,
    data: data,  // ← 26 MB
    createdAt: Date.now()
  }
  await db.put('images', imageRecord)  // ← Only called when a new image is generated
}
```

**Solution:**
```
Timeline:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

10:00  Generate image 1 (26 MB)
       ↓ saveImage()  ← Called only once
       ↓ Write images:001.ldb (26 MB)
       ↓ saveSession()
       ↓ Write session:001.ldb (5 KB) ← Only the ID is saved

10:05  Switch tabs
       ↓ saveSession()  ← No saveImage()
       ↓ Write session:002.ldb (5 KB) ← Just the ID again, but tiny!

10:10  Switch back
       ↓ saveSession()
       ↓ Write session:003.ldb (5 KB) ← Tiny!

10:15  Close the page
       ↓ saveSession()
       ↓ Write session:004.ldb (5 KB) ← Tiny!

10:20  Reopen, generate image 2 (26 MB)
       ↓ saveImage()  ← Called only once
       ↓ Write images:002.ldb (26 MB)
       ↓ saveSession()
       ↓ Write session:005.ldb (5 KB)

10:25  Switch tabs again
       ↓ saveSession()
       ↓ Write session:006.ldb (5 KB) ← Tiny!

... repeated 42 times ...

Session saves: 42 files × 5 KB = 210 KB ✅
Image saves: 2 files × 26 MB = 52 MB ✅
Total: 210 KB + 52 MB = 52.2 MB ✅
```

---

## Key Comparison

### Save Frequency

```
Current pattern:
- Session saves: 42
- Each includes the image: 42
- Image data writes: 42

Separate pattern:
- Session saves: 42
- Each includes only an ID: 42
- Image data writes: 2 (only when a new image is generated)
```

### Amount of Data Written

```
Current pattern:
42 × 26 MB = 1,092 MB (1.1 GB) ❌

Separate pattern:
Session: 42 × 5 KB = 210 KB ✅
Images: 2 × 26 MB = 52 MB ✅
Total: 52.2 MB ✅

Reduction: 95%+ 🎉
```

---

## Why Can Compaction Succeed?

### Current Pattern (Fails)

```
Trying to merge 42 session files:
├── 001.ldb (26 MB) ← Contains image 1
├── 002.ldb (26 MB) ← Contains image 1
├── 003.ldb (26 MB) ← Contains image 1
├── ...
└── 042.ldb (26 MB) ← Contains image 2

Needs to read: 42 × 26 MB = 1,092 MB
Needs memory: 3-4x (deduplication, merging) = 3-4 GB
Browser limit: ~100-500 MB
Result: out of memory / timeout → Compaction fails ❌
```

### Separate Pattern (Succeeds)

```
Trying to merge 42 session files:
├── 001.ldb (5 KB) ← Only the ID "img_123"
├── 002.ldb (5 KB) ← Only the ID "img_123"
├── 003.ldb (5 KB) ← Only the ID "img_123"
├── ...
└── 042.ldb (5 KB) ← Only the ID "img_456"

Needs to read: 42 × 5 KB = 210 KB
Needs memory: 3-4x = about 1 MB
Browser limit: ~100-500 MB
Result: completes easily ✅

Compaction:
1. Quickly read all files (210 KB)
2. Merge and deduplicate (all in memory)
3. Write a new file (5 KB)
4. Delete the 42 old files ✅

Final: only 1 latest session file (5 KB)
```

---

## Core Principles

### 1. Different Lifecycles

```
Session: frequent updates, infrequent reads
- Saved on every tab switch
- But the data is small (a few KB)
- Compaction handles it easily

Images: infrequent updates, read on demand
- Saved only when a new image is generated
- The data is large (26 MB)
- But the count is controllable (say 10 images = 260 MB)
```

### 2. Independent Compaction

```
Session Store:
- Small files, high frequency
- Compaction runs all the time
- Always stays clean

Images Store:
- Large files, low frequency
- Compaction runs occasionally
- The total is controllable (260 MB)
```

### 3. Fault Isolation

```
Current pattern:
- Images make the Session files too large
- Session Compaction fails
- The whole database crashes ❌

Separate pattern:
- Session files are small → Compaction works ✅
- Image files are independent → even if Compaction is slow, the Session is unaffected ✅
- Fault isolation ✅
```

---

## Analogy

### Current Pattern

```
It's like: packing all your furniture every time you move
- 1st move: pack all the furniture (26 MB)
- 2nd move: pack all the furniture again (26 MB)
- 3rd move: pack all the furniture again (26 MB)
...
- 42nd move: still packing all the furniture (26 MB)

Result: the moving company collapses ❌
```

### Separate Pattern

```
It's like: packing only the "furniture list" while the furniture sits in a warehouse
- 1st move: pack the list (5 KB) + ship the furniture to the warehouse (26 MB)
- 2nd move: pack the list (5 KB) ← The list is tiny!
- 3rd move: pack the list (5 KB) ← The list is tiny!
...
- 42nd move: pack the list (5 KB) ← The list is tiny!

Result:
- Lists: 42 × 5 KB = 210 KB ✅
- Warehouse: only the furniture from the 2 real moves = 52 MB ✅
```

---

## Summary

### Why Does Separation Solve It?

| Dimension | Current Pattern | Separate Pattern |
|------|----------|----------|
| Session save size | 26 MB | 5 KB |
| Session save count | 42 | 42 |
| Total Session writes | 1,092 MB | 210 KB |
| Image save count | 42 (redundant) | 2 (actual) |
| Total image writes | 1,092 MB | 52 MB |
| Compaction memory requirement | 3-4 GB | 1 MB |
| Compaction result | Fails ❌ | Succeeds ✅ |

### Core Principle

**It is not "separation" itself that solves the problem, but rather:**
1. The Session no longer contains large data → files are small
2. Small files → Compaction can succeed
3. Compaction succeeds → old files are deleted
4. Old files are deleted → the database does not accumulate
5. Images are saved separately → the total is controllable (260 MB vs 1.1 GB)

**The key is reducing the write frequency (42 times → 2 times), not the separation!**

### 1.4 IndexedDB Corruption Analysis
# 🔴 IndexedDB Database Corruption Analysis Report

## Symptoms
- Opening the IndexedDB database crashes the browser
- The application cannot start when there is historical data
- Even a simple `indexedDB.open()` operation triggers a crash

## 🔍 Root Cause Analysis

### 1. **Dangerous serialization operation**

**Problem code** (all session stores):
```typescript
const saveSession = async () => {
  const snapshot = JSON.stringify(state.value)  // ❌ No error handling
  await $services.preferenceService.set('session/v1/basic-system', snapshot)
}
```

**Risk points**:
- If `state.value` contains a circular reference → `JSON.stringify` throws an error → the error is swallowed → incomplete data is written
- If `state.value` contains a huge object (> 100MB) → out of memory → browser crash
- No size limit check
- No circular reference detection

### 2. **Possible concurrent write conflicts**

Although `useSessionManager.ts` has been fixed to save sequentially, still:
- The `beforeunload` event on page unload may trigger `saveAllSessions` multiple times
- If the user refreshes/closes the page quickly, multiple save operations may be triggered at the same time
- IndexedDB transactions may conflict, leading to database corruption

### 3. **testResults may contain huge objects**

**Problem scenario**:
```typescript
// useBasicSystemSession.ts
state.value.testResults = results  // May contain the full output text
```

If the user tested a very long output (such as a long GPT-4 answer):
- A single testResult could be 1-5 MB
- Accumulated over multiple tests it could reach 50-100 MB
- Memory spikes during `JSON.stringify`

### 4. **No data cleanup mechanism**

- Historical test data keeps accumulating
- No upper size limit check
- No periodic cleanup of old data

## 🛠️ Solutions

### Immediate Fixes (High Priority)

1. **Add a safe serialization function**
```typescript
function safeStringify(obj: any, maxSize: number = 10 * 1024 * 1024): string | null {
  try {
    // Detect circular references
    const seen = new WeakSet();
    const jsonString = JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    });

    // Check the size
    if (jsonString.length > maxSize) {
      console.error(`Data too large: ${jsonString.length} bytes (limit: ${maxSize})`);
      return null;
    }

    return jsonString;
  } catch (error) {
    console.error('Serialization failed:', error);
    return null;
  }
}
```

2. **Limit the size of testResults**
```typescript
const updateTestResults = (results: TestResults | null) => {
  if (!results) return;

  // Limit text length
  const MAX_LENGTH = 50000; // 50KB
  if (results.originalResult?.length > MAX_LENGTH) {
    results.originalResult = results.originalResult.slice(0, MAX_LENGTH) + '...[truncated]';
  }
  if (results.optimizedResult?.length > MAX_LENGTH) {
    results.optimizedResult = results.optimizedResult.slice(0, MAX_LENGTH) + '...[truncated]';
  }

  state.value.testResults = results;
}
```

3. **Add validation before saving**
```typescript
const saveSession = async () => {
  const snapshot = safeStringify(state.value);
  if (!snapshot) {
    console.error('[BasicSystemSession] Serialization failed, skipping save');
    return;
  }

  try {
    await $services.preferenceService.set('session/v1/basic-system', snapshot);
  } catch (error) {
    console.error('[BasicSystemSession] Failed to save session:', error);
  }
}
```

4. **Add periodic cleanup**
```typescript
// Clean up test results older than 7 days
const cleanupOldData = () => {
  const now = Date.now();
  const WEEK = 7 * 24 * 60 * 60 * 1000;

  if (state.value.lastActiveAt && (now - state.value.lastActiveAt) > WEEK) {
    state.value.testResults = null;
    state.value.testContent = '';
  }
}
```

### Mid-Term Optimizations

1. **Sharded data storage**
   - Store testResults separately
   - Keep only the most recent N records
   - Use IndexedDB's auto-increment key

2. **Add data compression**
   - Compress data with LZString or a similar library
   - Can reduce storage by 50-80%

3. **Add a database health check**
   - Check the data size on startup
   - If it is too large, prompt the user to clean up
   - Provide a cleanup button

## 📊 Updated Diagnostic Results

### Actual Findings (2026-01-07)

✅ **Confirmed database state:**
- Total database size: **2.4 GB** (should normally be < 100 MB)
- Individual .ldb files: 26-27 MB (40+ files in total)
- The file structure is intact; **it is not corrupted but overloaded with data**

✅ **Root cause confirmed:**

1. **The auto-save mechanism is too frequent**
   - Every test result change → auto-save
   - Every tab switch (visibilitychange) → auto-save
   - Every page close (pagehide) → auto-save

2. **The full state is saved with no filtering**
   ```typescript
   // useBasicSystemSession.ts:219
   const snapshot = JSON.stringify(state.value)  // ❌ Includes all testResults
   ```

3. **No size limits at all**
   - ❌ Doesn't check the size of testResults
   - ❌ Doesn't truncate overly long text
   - ❌ Doesn't limit field length

4. **No cleanup mechanism**
   ```bash
   grep -r "cleanup\|clean" packages/ui/src/stores/session
   # Result: No matches found ❌
   ```

For detailed analysis, see: `docs/workspace/why-data-accumulates.md`

## 📊 Next Steps

1. ✅ Created `find-db.html` - helps the user locate the database files
2. ✅ Created `db-repair.html` - database repair and cleanup tool
3. ✅ Analyzed the root cause of the data accumulation
4. ⏳ The user cleans up the database with the repair tool
5. ⏳ Implement preventive measures (data size limits, automatic cleanup)

## 🔗 Related Files

- `packages/ui/src/stores/session/useBasicSystemSession.ts:211`
- `packages/ui/src/stores/session/useBasicUserSession.ts`
- `packages/ui/src/stores/session/useProVariableSession.ts`
- `packages/ui/src/stores/session/useProMultiMessageSession.ts`
- `packages/ui/src/stores/session/useImageText2ImageSession.ts`
- `packages/ui/src/stores/session/useImageImage2ImageSession.ts`
- `packages/ui/src/stores/session/useSessionManager.ts:324` (saveAllSessions)

### 1.5 Image Storage Solution
# 📋 Image Storage Optimization Plan

## Problem Analysis

Current implementation: the image's base64 (2-3 MB) is stored directly in the session, which causes:
- 26 MB per save
- 42 saves = 1.1 GB
- Compaction fails
- The database crashes

## Recommended Plans

### ✅ Plan 1: Store Images Separately (Recommended)

#### Implementation Idea

```
1. Create a separate images object store
2. The Session only saves the image ID (a string reference)
3. Images and the session are stored separately
4. Periodically clean up old images
```

#### Code Structure

```typescript
// 1. Create ImageStorageService
class ImageStorageService {
  private readonly IMAGE_STORE = 'images'

  // Save an image and return its ID
  async saveImage(imageResult: ImageResult): Promise<string> {
    const db = await this.openDB()
    const id = `img_${Date.now()}_${Math.random().toString(36).slice(2)}`

    await db.put(this.IMAGE_STORE, {
      id,
      data: imageResult,        // Complete image data
      createdAt: Date.now()
    })

    return id
  }

  // Read an image
  async getImage(id: string): Promise<ImageResult | null> {
    const db = await this.openDB()
    const record = await db.get(this.IMAGE_STORE, id)
    return record?.data || null
  }

  // Clean up old images (keep the most recent N)
  async cleanupOldImages(keepCount: number = 10): Promise<void> {
    const db = await this.openDB()
    const tx = db.transaction(this.IMAGE_STORE, 'readwrite')
    const store = tx.objectStore(this.IMAGE_STORE)

    // Get all images, sorted by time
    const allImages = await store.getAll()
    allImages.sort((a, b) => a.createdAt - b.createdAt)

    // Delete the old ones
    const toDelete = allImages.slice(0, -keepCount)
    for (const img of toDelete) {
      await store.delete(img.id)
    }
  }
}

// 2. Modify the ImageResult interface
interface ImageResultRef {
  imageId: string          // Only store the ID
  thumbnail?: string      // Thumbnail (optional, within 10KB)
}

// 3. Modify the Session
interface ImageText2ImageSessionState {
  // ...other fields
  originalImageResult: ImageResultRef | null    // Only stores a reference
  optimizedImageResult: ImageResultRef | null   // Only stores a reference
}

// 4. Flow when saving an image
async function handleImageGenerated(result: ImageResult) {
  // Save to the separate image storage
  const imageId = await imageStorageService.saveImage(result)

  // The Session only saves a reference
  session.updateOriginalImageResult({
    imageId,
    thumbnail: result.images[0].b64?.slice(0, 1000)  // Only save the first 1KB as a preview
  })
}
```

#### Advantages
✅ Session data is small (a few KB)
✅ Images are managed independently and can be cleaned up separately
✅ Does not affect Compaction
✅ An LRU cache strategy can be implemented

#### Disadvantages
⚠️ Requires additional cleanup logic
⚠️ Adds complexity

---

### ✅ Plan 2: Limit the Number of Images + Overwrite Strategy

#### Implementation Idea

```
1. Keep images in the Session, but only the most recent N
2. When the limit is exceeded, delete the oldest
3. The total size is controllable
```

#### Code Implementation

```typescript
class ImageSessionManager {
  private readonly MAX_IMAGES = 3  // Keep at most 3 images
  private readonly MAX_IMAGE_SIZE = 500 * 1024  // Max 500KB per image

  async updateImageResult(
    session: ImageText2ImageSessionState,
    newResult: ImageResult
  ): Promise<void> {
    // 1. Limit the size of a single image
    const limitedResult = this.limitImageSize(newResult)

    // 2. Get the existing image list
    const imageList = session.imageList || []

    // 3. Add the new image
    imageList.push({
      ...limitedResult,
      id: `img_${Date.now()}`,
      createdAt: Date.now()
    })

    // 4. Keep only the most recent N
    const keepCount = Math.min(imageList.length, this.MAX_IMAGES)
    const trimmedList = imageList.slice(-keepCount)

    // 5. Update the session
    session.imageList = trimmedList

    // 6. If needed, clean up old images in IndexedDB
    await this.cleanupOldImages(imageList, trimmedList)
  }

  private limitImageSize(result: ImageResult): ImageResult {
    return {
      ...result,
      images: result.images.map(img => ({
        ...img,
        // If the base64 is too large, truncate or discard it
        b64: img.b64 && img.b64.length > this.MAX_IMAGE_SIZE
          ? undefined
          : img.b64,
        // Prefer the URL
        url: img.url || img.b64  // If there is b64, generate a Blob URL
      }))
    }
  }
}

// Modify the Session interface
interface ImageText2ImageSessionState {
  // No longer a single result, but a list
  imageList: ImageResultItem[]
  currentImageId?: string  // The currently selected image
}
```

#### Advantages
✅ Relatively simple to implement
✅ The total size is controllable (3 × 500KB = 1.5 MB)
✅ No extra object store needed

#### Disadvantages
⚠️ Historical images are lost
⚠️ User experience may be affected

---

### ✅ Plan 3: Save Only the URL, Not the base64

#### Implementation Idea

```
1. Image APIs usually return a URL (such as OpenAI's temporary URL)
2. Save only the URL, not the base64
3. If persistence is needed, let the user download manually
```

#### Code Implementation

```typescript
interface ImageResultItem {
  url?: string           // Prefer the URL
  b64?: string           // ⚠️ base64 is not saved
  mimeType?: string
  expiresAt?: number     // URL expiration time
}

// When saving
async function handleImageGenerated(result: ImageResult) {
  // Save only the URL and discard the base64
  const limitedResult = {
    ...result,
    images: result.images.map(img => ({
      url: img.url,
      mimeType: img.mimeType,
      b64: undefined  // ❌ Do not save base64
    }))
  }

  session.updateOriginalImageResult(limitedResult)
}

// When displaying
function displayImage(imageRef: ImageResultItem) {
  if (imageRef.url) {
    // Use the URL
    return <img src={imageRef.url} />
  } else if (imageRef.b64) {
    // If there is base64 (legacy data compatibility)
    return <img src={imageRef.b64} />
  } else {
    // Neither exists, prompt to regenerate
    return <div>The image has expired, please regenerate it</div>
  }
}
```

#### Advantages
✅ Simplest to implement
✅ Smallest Session data
✅ Completely avoids the large-file problem

#### Disadvantages
❌ URLs expire (OpenAI's URLs become invalid after 1 hour)
❌ The image is lost after the user closes the page
❌ Poor user experience

---

### ✅ Plan 4: File System Access API (Desktop Version Only)

#### Implementation Idea

```
1. Use the File System Access API
2. Let the user choose the save location
3. Save the image directly to the user's disk
4. The Session only saves the file path
```

#### Code Implementation

```typescript
// Only available in Electron/desktop applications
async function saveImageToFile(result: ImageResult) {
  // Ask the user to choose a save location
  const fileHandle = await window.showSaveFilePicker({
    suggestedName: `image-${Date.now()}.png`,
    types: [{
      description: 'PNG Image',
      accept: {'image/png': ['.png']}
    }]
  })

  // Save the image
  const blob = await fetch(result.images[0].url).then(r => r.blob())
  const writable = await fileHandle.createWritable()
  await writable.write(blob)
  await writable.close()

  // The Session only saves the file path
  session.updateOriginalImageResult({
    filePath: fileHandle.name,
    fileType: 'local'
  })
}
```

#### Advantages
✅ Does not use browser storage
✅ Images are saved permanently
✅ No size limit

#### Disadvantages
❌ Only available in browsers that support the File System Access API
❌ Requires manual selection by the user
❌ Not supported in the Web version

---

## 🎯 Recommended Implementation Steps

### Short Term (Immediate Fix)

**Plan 2: Limit the number of images**
- Keep only the most recent 3 images
- Limit each image to 500 KB
- Total size < 1.5 MB
- Simple to implement, takes effect immediately

### Mid Term (Improve Experience)

**Plan 1: Store images separately**
- Create a separate image store
- The Session only saves references
- Implement an LRU cache
- Keep the most recent 10-20 images

### Long Term (Best Experience)

**Plan 1 + Plan 4 combined**
- Web version: store images separately (IndexedDB)
- Desktop version: File System Access API
- Give the user a choice: automatic management / manual save

## 📝 Code Change Checklist

### Files That Must Be Modified

1. `packages/core/src/services/image/types.ts`
   - Add the `ImageResultRef` interface

2. `packages/ui/src/stores/session/useImageText2ImageSession.ts`
   - Modify `ImageText2ImageSessionState`
   - Change it to save only references

3. `packages/ui/src/stores/session/useImageImage2ImageSession.ts`
   - Same as above

4. `packages/core/src/services/storage/` (new)
   - Create `ImageStorageService`

5. `packages/ui/src/components/.../ImageWorkspace.vue`
   - Modify the save/read logic

## 🔧 Implementation Priorities

### P0 (Immediate)
- ✅ Plan 2: Limit the number of images to 3
- ✅ Limit each image to 500 KB

### P1 (This week)
- ✅ Plan 1: Create ImageStorageService
- ✅ Migrate to reference mode

### P2 (Next week)
- ✅ Add cleanup logic
- ✅ Add a user download button
- ✅ Integrate the File System Access API in the desktop version

---

## Summary

| Plan | Complexity | Effect | Recommendation |
|------|--------|------|--------|
| Plan 1: Separate storage | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ Strongly recommended |
| Plan 2: Limit count | ⭐⭐ | ⭐⭐⭐⭐ | ✅ Recommended short term |
| Plan 3: Save URL only | ⭐ | ⭐⭐ | ❌ Not recommended |
| Plan 4: File system | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ Recommended for desktop |

---

## 2. Mode Terminology Migration Summary
# Unified Mode Terminology Migration Summary

## 📋 Migration Overview

This migration aims to unify the mode terminology in the project. It gradually aligns outdated or semantically unclear expressions such as `optimizationMode`, `contextMode`, and `selectedOptimizationMode` with the design of `functionMode` (the first-level function mode) and `subMode` (the second-level sub-mode), and ensures that the sub-mode state of each mode is persisted independently.

Note: This document is kept in `docs/workspace/` as the single entry point for "mode terminology and migration status"; its "to-do/cleanup items" retain only content that is still valid, to avoid misleading readers about past implementation stages.

## 🎯 Unified Design Architecture

### Core Concepts
- **functionMode**: First-level function mode (`basic` | `pro` | `image`)
- **subMode**: Second-level sub-mode, depending on the functionMode
  - Basic mode sub-modes (`system` | `user`)
  - Context mode sub-modes (`system` | `user`)
  - Image mode sub-modes (`text2image` | `image2image`)

### Unified Management Functions
All mode state should use the functions under `packages/ui/src/composables/mode/`:

```typescript
// Function mode management
useFunctionMode(services) // { functionMode, setFunctionMode, ... }

// Sub-mode management (independent persistence)
useBasicSubMode(services)  // Basic mode sub-mode
useProSubMode(services)    // Context mode sub-mode
useImageSubMode(services)  // Image mode sub-mode

// Read-only access (no services needed)
useCurrentMode()           // { functionMode, proSubMode, isBasicMode, ... }
```

## ✅ Current Implementation Status (Landed)

### 1) The main assembly location has converged from Web/Extension App.vue to the UI main component

- `packages/web/src/App.vue` and `packages/extension/src/App.vue` currently only serve as shell components that render the UI main application.
- The real mode state management and assembly has converged into:
  - `packages/ui/src/components/app-layout/PromptOptimizerApp.vue`

### 2) Sub-mode persistence is implemented, and `selectedOptimizationMode` has been changed to a computed (not an independent source of state)

- `PromptOptimizerApp.vue` uses `useFunctionMode` + `useBasicSubMode/useProSubMode/useImageSubMode` to manage state, with independent persistence.
- `selectedOptimizationMode` is no longer an independent `ref`, but a `computed` derived from the subMode (compatible with the legacy interface/props shape).

## ✅ Completed Migrations

### 1. Unified Composable Parameters
- **usePromptOptimizer**: `selectedOptimizationMode` → `optimizationMode`
- **usePromptTester**: `selectedOptimizationMode` → `optimizationMode`
- **useContextManagement**: Added @deprecated markers

### 2. Unified Internal Variable Names
- All `selectedOptimizationMode.value` in `usePromptTester.ts` → `optimizationMode.value`

### 3. Documentation and Comment Updates
- Added @deprecated markers to the migrated parameters
- Updated JSDoc comments to state that the subMode concept is used uniformly
- Retained the necessary compatibility comments in `PromptOptimizerApp.vue` (to reflect the real assembly location)

## 🔍 Areas Still To Be Migrated

### High Priority (Cleanup and Consistency)
1. **Gradually remove "misleading" naming**
   - Although `selectedOptimizationMode` is now a computed, its name still easily gives the impression that it is the "source of state for the optimization mode selected by the user".
   - Suggested direction:
     - Externally, keep the `optimizationMode` props (to avoid wide-reaching breaking changes)
     - Internally, gradually switch to more accurate names (for example `currentOptimizationMode` / `derivedOptimizationMode`), centralized in a single exit point at the UI layer

2. **Converge old names in components/templates**
   - Gradually unify scattered names related to `optimizationMode/contextMode/selectedOptimizationMode` into expressions of "values derived from functionMode/subMode" (a one-time replacement isn't required, but avoid introducing further mixing of old and new)

### Medium Priority
3. **Outdated terminology in type definitions**
   - Check `packages/ui/src/types/components.ts`
   - Check the relevant files under `packages/core/src/types/`

4. **Terminology in test files**
   - Update variable names and assertions in the test cases

### Low Priority
5. **Internationalization files**
   - Check key names in `packages/ui/src/i18n/locales/`
   - Ensure documentation and help text use the unified terminology

## 🚀 Migration Recommendations

### Focus: Clean Up Terminology on the Premise of "Not Breaking Behavior"
1. Limit the "source of state" to `functionMode + each respective subMode` (done)
2. Keep the "external interfaces/props" usable while gradually reducing the spread of old names internally (in progress)
3. Once callers and documentation are consistent, remove the `@deprecated` markers (follow-up cleanup)

## 📝 Migration Checklist

- [x] Update usePromptOptimizer parameters
- [x] Update usePromptTester parameters
- [x] Update the useContextManagement interface
- [x] Unify internal variable names
- [x] Add @deprecated markers
- [x] Converge mode management into PromptOptimizerApp (optimizationMode derived from subMode)
- [ ] Update all Vue template/props naming (converge gradually, avoid introducing further old/new mixing)
- [ ] Update type definitions
- [ ] Update test files
- [ ] Verify functional completeness
- [ ] Update documentation

## 🎯 Expected Benefits

1. **Unified terminology**: Eliminate confusion and improve code readability
2. **Clear architecture**: A clear hierarchy (functionMode → subMode)
3. **State isolation**: The sub-modes of different function modes are persisted independently
4. **Developer experience**: A unified API and clear usage patterns

## 🔗 Related Documents

- [Function Mode Design Document](../archives/126-submode-persistence/README.md)
- [Mode Management API](../../../packages/ui/src/composables/mode/index.ts)
- [Context UI Overhaul and Variable System Refactor (Archived)](../archives/128-context-ui-and-variable-system-refactor/README.md)

---

**Document version**: v1.0
**Created**: 2025-10-31
**Last updated**: 2025-12-19
**Maintainer**: User

---

## 3. Prompt Document
# Role Definition
You are an intelligent prompt optimization engine based on the E4-D methodology, implementing fully automated optimization across the Decompose → Diagnose → Develop → Deliver pipeline.

# Core Parameter Configuration
**Basic parameters**
- Original prompt: {{originalPrompt}}
- Target platform: {{targetPlatform}} (GPT-4/Claude-3/Gemini-Pro/General)
- Optimization mode: {{optimizationMode}} (DETAIL/BASIC/AUTO)

**E4-D specific parameters**
- Decomposition depth: {{decomposeDepth}} (shallow/standard/deep)
- Diagnosis dimensions: {{diagnoseDimensions}} (clarity/completeness/structure)
- Development strategy: {{developStrategy}} (chain of thought/few-shot/multi-perspective/hybrid)
- Delivery standard: {{deliverStandard}} (basic/professional/enterprise)

**Extended parameters**
- Task type: {{taskType}} (creative generation/technical analysis/educational explanation/complex reasoning)
- Output format: {{outputFormat}} (Markdown/JSON/plain text/structured report)
- Language style: {{languageStyle}} (professional/plain/academic/business)
- Iteration limit: {{maxIterations}} (1-5 rounds, default 3 rounds)

# E4-D Automated Optimization Process
**Phase 1: Decompose**
- Semantic deconstruction: Parse the core intent and implicit needs of {{originalPrompt}}
- Element extraction: Identify key entities, operation instructions, and constraints
- Boundary delineation: Determine the analysis granularity according to {{decomposeDepth}}

**Phase 2: Diagnose**
- Multi-dimensional assessment: Perform quantified defect analysis based on {{diagnoseDimensions}}
- Problem localization: Identify vague points, ambiguities, and structural defects
- Priority ranking: Classify and prioritize optimization focus by degree of impact

**Phase 3: Develop**
- Strategy matching: Select the optimal architecture pattern according to {{developStrategy}}
- Template injection: Dynamically bind standardized optimization templates
- Platform adaptation: Inject a compatibility layer for {{targetPlatform}}

**Phase 4: Deliver**
- Quality verification: Check the output against {{deliverStandard}}
- Format standardization: Ensure compliance with the {{outputFormat}} requirements
- Iteration decision: Automatically trigger the next E4-D cycle when the threshold is not met

# Quality Assurance Mechanism
**Automatic evaluation metrics**
- Intent fulfillment rate (≥95%)
- Structural completeness (≥90%)
- Platform compatibility (≥95%)
- Style consistency (≥90%)

**Iterative optimization logic**
- Re-evaluate the quality score after each E4-D round
- Adjust the next round's optimization strategy based on weak areas
- Terminate upon reaching {{qualityThreshold}} or {{maxIterations}}

# Output Deliverables
**The final deliverables include**
- The optimized prompt (marked with the E4-D iteration version)
- E4-D process report (execution details for each phase)
- Quality certification (compliance status for the four dimensions)
- Parameter usage summary (effect analysis of all configured parameters)

---

## 4. Code Review Prompt Evaluation
# Code Review Report: New Prompt Evaluation Types (prompt-only / prompt-iterate)

Date: 2025-12-20  
Branch: `develop`  
Baseline commit: `390545b` (the working tree has uncommitted changes)  

## 1. Scope and Goals

This review covers the current (uncommitted) code changes in the working tree. The core goals are:

- Add two new evaluation types to the "Evaluation" capability:
  - `prompt-only`: evaluate quality based solely on the prompt itself, without depending on test results
  - `prompt-iterate`: evaluate how much the prompt has improved in the context of the "iteration requirement (iterationNote)"
- Add an "Analyze" entry point and a score badge display in the UI, and share the evaluation context via `provide/inject` to reduce passing evaluation props through multiple component layers.

> Note: This report focuses on functional consistency, correctness, and maintainability; it does not include runtime verification (no pnpm commands were executed).

## 1.1 Update Notes (Important)

- Section 4 is the "issue list (with risks)", recording the defects and suggestions found during the review.
- Because code fixes and explanatory additions have been made since, this report adds Section 8, "Fix Status (Update Log)".
- If the "suggestions/risks" in Section 4 conflict with Section 8, treat the "current implementation status" in Section 8 as authoritative, and run regression verification accordingly.

## 2. Change Summary (by Module)

### 2.1 Core: Evaluation Types, Validation, Context Building

- Extended the evaluation type union: `EvaluationType` adds `prompt-only` and `prompt-iterate` (`packages/core/src/services/evaluation/types.ts:14`).
- Added request types:
  - `PromptOnlyEvaluationRequest`: requires `optimizedPrompt`, does not require `testResult` (`packages/core/src/services/evaluation/types.ts:145`)
  - `PromptIterateEvaluationRequest`: requires `optimizedPrompt` + `iterateRequirement` (`packages/core/src/services/evaluation/types.ts:156`)
- `EvaluationService.validateRequest()` adds field validation for the two types above (`packages/core/src/services/evaluation/service.ts:159`).
- `EvaluationService.buildTemplateContext()` injects the template context for the two types above:
  - prompt-only: `optimizedPrompt`
  - prompt-iterate: `optimizedPrompt` + `iterateRequirement` (`packages/core/src/services/evaluation/service.ts:270`).
- Several error messages were changed from Chinese to English (for example validation/parsing errors) (`packages/core/src/services/evaluation/service.ts:160`, `packages/core/src/services/evaluation/service.ts:385`).

### 2.2 Core: Built-in Template Registration

Added built-in evaluation templates (basic/pro × system/user × zh/en × prompt-only/prompt-iterate) and registered them in the default template collection:

- Export aggregation: `packages/core/src/services/template/default-templates/evaluation/index.ts`
- Static template collection: `packages/core/src/services/template/default-templates/index.ts`
- Template examples:
  - `evaluation-basic-system-prompt-only` (`packages/core/src/services/template/default-templates/evaluation/basic/system/evaluation-prompt-only.ts`)
  - `evaluation-pro-system-prompt-iterate` (`packages/core/src/services/template/default-templates/evaluation/pro/system/evaluation-prompt-iterate.ts`)

Note: `TemplateManager.getBuiltinTemplates()` selects the template collection based on the "current language" (`packages/core/src/services/template/manager.ts:208`), so the template **IDs must be identical across language collections**; currently the `id` in the en files matches the zh files (for example `evaluation-basic-system-original`), which complies with this mechanism.

### 2.3 Core: Unit Tests

- Added `packages/core/tests/unit/evaluation/service.test.ts`, covering:
  - `prompt-only/prompt-iterate` validation rules (including that `testResult` is not required and `iterateRequirement` is required)
  - Whether template ID generation and template fetching happen as expected
  - The `evaluateStream` callback path (`packages/core/tests/unit/evaluation/service.test.ts:73`).

### 2.4 UI: Evaluation Composable Extension and Context Injection

- `useEvaluation`:
  - Extended the state with `state['prompt-only']` and `state['prompt-iterate']`
  - Added computed properties (score/grade/is evaluating/has result)
  - Added the methods `evaluatePromptOnly()` and `evaluatePromptIterate()`
  - Changed the request type of `executeEvaluation()` from a union to `EvaluationRequest` (`packages/ui/src/composables/prompt/useEvaluation.ts:375`).
- Added the evaluation context:
  - `provideEvaluation()` / `useEvaluationContext()` / `useEvaluationContextOptional()` (`packages/ui/src/composables/prompt/useEvaluationContext.ts:28`).
- `PromptOptimizerApp` provides the context:
  - `provideEvaluation(evaluation)` (`packages/ui/src/components/app-layout/PromptOptimizerApp.vue:993`).
- i18n adds copy:
  - `prompt.analyze`
  - `prompt.error.noOptimizedPrompt` (`packages/ui/src/i18n/locales/zh-CN.ts:1131`, `packages/ui/src/i18n/locales/en-US.ts:1163`).

### 2.5 UI: PromptPanel Adds the "Analyze" Entry Point and Score Badge

- `PromptPanel`:
  - Reads the context through `useEvaluationContextOptional()` (`packages/ui/src/components/PromptPanel.vue:358`).
  - Computes the evaluation type: if the current version has an `iterationNote`, use `prompt-iterate`; otherwise `prompt-only` (`packages/ui/src/components/PromptPanel.vue:371`).
  - Entry UI:
    - If there is a result or evaluation is in progress: show `EvaluationScoreBadge`
    - Otherwise: show the "Analyze" button (`packages/ui/src/components/PromptPanel.vue:122`).
  - Clicking "Analyze":
    - If `optimizedPrompt` is empty, show the toast `prompt.error.noOptimizedPrompt`
    - Otherwise call `evaluation.evaluatePromptOnly/Iterate` depending on whether there is an `iterationNote` (`packages/ui/src/components/PromptPanel.vue:489`).

## 3. Key Flow Overview (for Locating Problems)

### 3.1 Core Evaluation Execution Flow

1) The UI assembles the `EvaluationRequest`  
2) `EvaluationService.validateRequest()` validates the required fields  
3) The template ID is assembled from `mode` + `type`: `evaluation-{functionMode}-{subMode}-{type}` (`packages/core/src/services/evaluation/service.ts:263`)  
4) `TemplateManager.getTemplate(id)`: selects the built-in template collection by language and looks it up with the same `id` (`packages/core/src/services/template/manager.ts:208`)  
5) `buildTemplateContext()` injects fields (`optimizedPrompt` / `iterateRequirement`, etc.)  
6) Call the LLM (streaming or non-streaming)  
7) `parseEvaluationResult()` → `normalizeEvaluationResponse()` normalizes the output (`packages/core/src/services/evaluation/service.ts:331`).

### 3.2 UI Display Flow (New Types)

- `PromptOptimizerApp`: holds the `evaluation` instance centrally and injects it through `provideEvaluation()`  
- `PromptPanel`: calls the evaluation methods directly via `inject` and displays the result badge  
- `EvaluationPanel`: is still displayed uniformly at the top level (depends on `evaluation.state.activeDetailType`, `evaluation.activeResult`, etc.).

## 3.3 Design Note: Why "Different Formats per Mode" Does Not Require "Multiple Evaluation Instances"

Different modes (basic/pro, system/user) may indeed differ in "the form of the optimization object, the evaluation dimensions, and the context information", but under the current architecture these differences are mainly handled by "request parameters + template selection + context injection", and do not need to be handled by "one evaluation instance per Workspace".

- **Template selection naturally distinguishes the modes**: Core generates the template ID as `evaluation-{functionMode}-{subMode}-{type}`, so different modes hit different templates (`packages/core/src/services/evaluation/service.ts:263`).
- **Context differences are injected through `proContext`**: Pro-System needs multi-message context, and Pro-User needs variable resolution context. Currently these are provided via `provideProContext()` in the Workspace and read and injected during evaluation in `PromptPanel` (`packages/ui/src/components/context-mode/ContextSystemWorkspace.vue:420`, `packages/ui/src/components/PromptPanel.vue:363`, `packages/ui/src/components/PromptPanel.vue:489`).
- **The output structure is uniformly normalized**: Templates can return different `dimensions[]`, but they are ultimately normalized into a unified `EvaluationResponse` structure, so the UI can reuse the same rendering component (`packages/core/src/services/evaluation/service.ts:394`, `packages/core/src/services/evaluation/types.ts:206`).

Conclusion: It is recommended to use "one global evaluation (App-level) + provide/inject", adapting to the differences between modes with `mode/proContext/type`; this avoids the fragmentation in Context mode of "two sets of evaluation state / two panels" (see Section 9).

## 4. Main Issues and Risks (by Priority)

### P0: The evaluation panel's "re-evaluate" has no effect for the new types (functional gap)

**Status**: ✅ Fixed (see Section 8, "P0-1")

**Symptom**
- When "re-evaluate" is triggered in `EvaluationPanel`, if the current detail type is `prompt-only` or `prompt-iterate`, no new request is issued.

**Root cause**
- `handleReEvaluate()` reads `evaluation.state.activeDetailType` and calls `handleEvaluate(currentType)` (`packages/ui/src/composables/prompt/useEvaluationHandler.ts:220`).
- But `handleEvaluate(type)` only handles the three types `original/optimized/compare` (`packages/ui/src/composables/prompt/useEvaluationHandler.ts:183`); there is no branch for the new types, which amounts to "returns without doing anything".

**Impact**
- Re-evaluating the new types from the detail panel gives no response, an inconsistent experience;
- If `EvaluationScoreBadge` also depends on the `EvaluationPanel` re-evaluation flow in the future, the problem will grow.

**Suggestion**
- Add a branch for `prompt-only/prompt-iterate` in `useEvaluationHandler.handleEvaluate()`, and consider obtaining `iterateRequirement` from state or context (or have the UI supply it).

---

### P0: In Context mode, the "@analyze" listener and the `proContext` passing are inconsistent / dead code

**Status**: ✅ Fixed (see Section 8, "P0-2")

**Symptom**
- `ContextSystemWorkspace` and `ContextUserWorkspace` listen to `@analyze="handleAnalyze"`, and in `handleAnalyze` they call `evaluation.evaluatePromptOnly/Iterate` and pass `proContext` (`packages/ui/src/components/context-mode/ContextSystemWorkspace.vue:518`, `packages/ui/src/components/context-mode/ContextUserWorkspace.vue:769`).
- But `PromptPanel` does not define/emit an `analyze` event (`packages/ui/src/components/PromptPanel.vue:413`); clicking "Analyze" goes through `handleEvaluate()` which calls `evaluation.evaluatePromptOnly/Iterate` directly, without passing `proContext` (`packages/ui/src/components/PromptPanel.vue:489`).

**Impact**
- The `@analyze` listener logic will most likely never fire and is "dead code";
- Pro-mode templates depend heavily on `proContext` (especially in the `pro-system` scenario, for understanding multi-message context); not passing it lowers evaluation quality.

**Suggestion (historical record)**
- The original suggestion was to choose either "event-driven" or "direct context access" to avoid a dual track; the current implementation chose "direct context access" and shares `proContext` via `provide/inject` (see Section 8, "P0-2").

---

### P0: New-type evaluation results may be inconsistent with the currently displayed content (risk of stale scores)

**Status**: ✅ Fixed (see Section 8, "P0-3")

**Symptom**
- The `PromptPanel` badge display is based on whether `evaluation.state['prompt-only'|'prompt-iterate']` already has a result (`packages/ui/src/components/PromptPanel.vue:399`).
- When switching versions / switching messages / replacing `optimizedPrompt`, if the corresponding evaluation state is not explicitly cleared, the badge may display the score and details of the previous content.

**Existing safeguards**
- The top level only watches `optimizer.optimizedPrompt` and clears `prompt-only/prompt-iterate` (`packages/ui/src/components/app-layout/PromptOptimizerApp.vue:1340`).

**Risk points**
- In Context mode, `PromptPanel`'s `optimizedPrompt` comes from `displayAdapter.displayedOptimizedPrompt` (`packages/ui/src/components/context-mode/ContextSystemWorkspace.vue:102`), which does not necessarily trigger the above watch;
- Even if it does trigger, `PromptPanel` itself has no precise cleanup logic based on `currentVersionId` or `selectedMessage`.

**Suggestion**
- Inside `PromptPanel`, watch `optimizedPrompt`, `currentVersionId`, and `versions` (or an equivalent "content identifier") and actively clear the corresponding evaluation state, ensuring "content-evaluation result" consistency.

---

### P1: Template output fields are inconsistent with the service normalization logic (isOptimizedBetter is discarded)

**Symptom**
- The JSON output of the `prompt-only/prompt-iterate` templates contains `"isOptimizedBetter"` (for example `packages/core/src/services/template/default-templates/evaluation/basic/system/evaluation-prompt-only.ts`).
- But `normalizeEvaluationResponse()` only writes `isOptimizedBetter` into the response when `type === 'compare'` (`packages/core/src/services/evaluation/service.ts:468`).

**Impact**
- Template token cost increases but the information is discarded;
- Easily misleading: the template requires true/false output, but neither the UI nor the service consumes that field.

**Suggestion**
- Clarify the semantics: if prompt-only/prompt-iterate should also retain this field, extend the response structure and UI display; if not needed, remove the field requirement from the templates (saves tokens and is more consistent).

---

### P1: Switching error messages from Chinese to English may cause a disjointed experience in the Chinese UI

**Symptom**
- The validation/parsing error messages thrown by Core were changed to English (`packages/core/src/services/evaluation/service.ts:160`, etc.).
- The UI toast passes them through via `getErrorMessage(error)` (`packages/ui/src/composables/prompt/useEvaluation.ts:410`), so English errors may show in the Chinese UI.

**Impact**
- The user experience is inconsistent with the i18n copy system;
- Unit tests have locked in the English strings, so restoring Chinese later would require test changes (`packages/core/tests/unit/evaluation/service.test.ts:100`).

**Suggestion**
- If i18n consistency is desired: consider mapping errors to localized keys at the UI layer (by error class / error code) rather than relying on the error message text.

---

### P2: PromptPanel emit declarations are redundant / misleading

**Symptom**
- `PromptPanel`'s `defineEmits` newly adds `"apply-improvement"`, but a comment mentions "evaluation-related events (evaluate and show-evaluation-detail are already handled through inject)" (`packages/ui/src/components/PromptPanel.vue:431`).
- At the same time, the `@analyze` listener still appears in the workspaces (see P0), but `PromptPanel` does not emit it.

**Impact**
- The component interface is unclear, making it hard for callers to tell which events are still valid;
- It easily introduces more event bindings that are "listened to but never triggered".

**Suggestion**
- Unify the component contract: keep only the necessary events externally (for example `apply-improvement`), and handle the rest internally through context.

## 5. Testing and Regression Focus

### Already Covered
- Core `EvaluationService` has unit tests for validation of the new types, template ID generation, and the `evaluateStream` callback path (`packages/core/tests/unit/evaluation/service.test.ts:73`).

### Suggested Additions (Optional)
- At the UI layer, verify at least once that "after switching versions / switching messages, the badge does not linger" (manual testing is enough, or add e2e/component tests later).
- In Pro mode, confirm that `proContext` is indeed carried into the prompt-only/prompt-iterate evaluations and that template rendering is as expected.

## 6. Suggested Action List (Can Be Converted Directly to TODOs)

1) Make `useEvaluationHandler.handleEvaluate()` support `prompt-only/prompt-iterate`, ensuring that re-evaluate in `EvaluationPanel` works.  
2) Unify the architecture of the "Analyze" entry point: remove dead code or add the `analyze` emit to `PromptPanel`, and ensure `proContext` is passed in Pro scenarios.  
3) Add `clearResult('prompt-only'|'prompt-iterate')` inside `PromptPanel`, triggered by content changes, to avoid stale scores.  
4) Clarify and unify the semantics of `isOptimizedBetter` (template / service / frontend consistent).  
5) If i18n consistency is required, consider a "error code / error type → copy key" mapping strategy to reduce dependence on English messages.  

## 7. Appendix: File Change List

### Modified (M)
- `packages/core/src/services/evaluation/service.ts`
- `packages/core/src/services/evaluation/types.ts`
- `packages/core/src/services/template/default-templates/evaluation/basic/system/index.ts`
- `packages/core/src/services/template/default-templates/evaluation/basic/user/index.ts`
- `packages/core/src/services/template/default-templates/evaluation/index.ts`
- `packages/core/src/services/template/default-templates/evaluation/pro/system/index.ts`
- `packages/core/src/services/template/default-templates/evaluation/pro/user/index.ts`
- `packages/core/src/services/template/default-templates/index.ts`
- `packages/ui/src/components/PromptPanel.vue`
- `packages/ui/src/components/app-layout/PromptOptimizerApp.vue`
- `packages/ui/src/components/basic-mode/BasicSystemWorkspace.vue`
- `packages/ui/src/components/basic-mode/BasicUserWorkspace.vue`
- `packages/ui/src/components/context-mode/ContextSystemWorkspace.vue`
- `packages/ui/src/components/context-mode/ContextUserWorkspace.vue`
- `packages/ui/src/composables/prompt/index.ts`
- `packages/ui/src/composables/prompt/useEvaluation.ts`
- `packages/ui/src/composables/prompt/useEvaluationHandler.ts`
- `packages/ui/src/i18n/locales/en-US.ts`
- `packages/ui/src/i18n/locales/zh-CN.ts`
- `packages/ui/src/i18n/locales/zh-TW.ts`

### Added (??)
- `packages/core/src/services/template/default-templates/evaluation/**/evaluation-prompt-only*.ts`
- `packages/core/src/services/template/default-templates/evaluation/**/evaluation-prompt-iterate*.ts`
- `packages/core/tests/unit/evaluation/service.test.ts`
- `packages/ui/src/composables/prompt/useEvaluationContext.ts`
- `packages/ui/src/composables/prompt/useProContext.ts`

---

## 8. Fix Status (Updated 2025-12-20)

### ✅ P0-1: handleReEvaluate supports the new types (fixed)

**Fix details**
- Added handling branches for the `prompt-only` and `prompt-iterate` types in `handleEvaluate()` in `useEvaluationHandler.ts`
- Added an optional `currentIterateRequirement` parameter to `UseEvaluationHandlerOptions`, used for re-evaluating the `prompt-iterate` type
- In `PromptOptimizerApp.vue`, computed `currentIterateRequirement` (taken from the current version's `iterationNote`) and passed it to the evaluationHandler
**Files involved**
- `packages/ui/src/composables/prompt/useEvaluationHandler.ts`
- `packages/ui/src/components/app-layout/PromptOptimizerApp.vue`

---

### ✅ P0-2: proContext injection mechanism and dead code cleanup (fixed)

**Fix approach**
Chose the "direct context access" path: share `proContext` via `provide/inject` rather than event-driven.

**Fix details**
1. Added `useProContext.ts`, providing the `provideProContext()` and `useProContextOptional()` methods
2. Call `provideProContext(proContext)` in `ContextSystemWorkspace.vue` and `ContextUserWorkspace.vue`
3. Call `useProContextOptional()` in `PromptPanel.vue` to obtain proContext, and pass it in when invoking the evaluation
4. Removed the `@analyze` listener and the `handleAnalyze` function in the workspaces (dead code cleanup)
5. Replaced `@analyze` with `@apply-improvement` (used to apply improvement suggestions)

**Files involved**
- `packages/ui/src/composables/prompt/useProContext.ts` (new)
- `packages/ui/src/composables/prompt/index.ts`
- `packages/ui/src/components/PromptPanel.vue`
- `packages/ui/src/components/context-mode/ContextSystemWorkspace.vue`
- `packages/ui/src/components/context-mode/ContextUserWorkspace.vue`

---

### ✅ P0-3: Content changes clear evaluation results (fixed)

**Fix details**
- Added a watch in `PromptPanel.vue` that listens for changes to `optimizedPrompt` and `currentVersionId`
- When the content or version changes, automatically clear the `prompt-only` and `prompt-iterate` evaluation results
- Avoids the problem of stale scores lingering after switching versions/messages

**Files involved**
- `packages/ui/src/components/PromptPanel.vue`

---

### 📋 P1-1: Semantics of the isOptimizedBetter field (design decision)

**Decision**
Keep the current behavior as a known design trade-off:
- The `prompt-only` and `prompt-iterate` templates still output the `isOptimizedBetter` field
- The server-side `normalizeEvaluationResponse()` retains this field only for the `compare` type
- The frontend does not consume `isOptimizedBetter` for the new types

**Rationale**
- The semantics of the new types is "evaluate the quality of a single prompt", and the `isOptimizedBetter` field has limited meaning in this scenario
- Keeping the field in the templates can serve as a validation anchor for the LLM output and does not affect functional correctness
- If it needs to be displayed later, the server and the frontend can be extended in sync

---

### 📋 P1-2: Language of error messages (design decision)

**Decision**
Keep Core-layer errors in English and do localization mapping at the UI layer (a future improvement direction):
- Currently the Core layer's validation/parsing errors are in English, which eases log analysis and problem diagnosis
- The UI layer passes them through with `getErrorMessage(error)`, so English errors may show in the Chinese UI
- This is an acceptable temporary state and does not affect core functionality

**Future improvement directions**
- Implement an "error code → i18n key" mapping mechanism at the UI layer
- Choose the corresponding localized copy based on the error type or error code
- Keep Core-layer error messages stable to avoid frequent test changes caused by copy changes

---

### ✅ P2: PromptPanel emit declaration cleanup (resolved together with P0-2)

- Removed the `@analyze` listener in the workspaces
- `PromptPanel` keeps only the necessary external events: `iterate`, `switchVersion`, `save-favorite`, `apply-improvement`, etc.
- Evaluation-related logic is handled internally through `provide/inject` and does not need to be exposed externally

## 9. Remaining Issues and Recommendations (Handling Guide for Future AI)

This section focuses on "issues that still exist as of the current code state" (the code is authoritative), and is meant to guide future AI in converging and fixing them.

### ✅ P0: Context mode has "two evaluation instances + two panels" (fixed)

**Original problem**
- The App top level already provides a global evaluation context, but the ContextSystem/ContextUser Workspaces each create their own independent `evaluationHandler` and render a local `EvaluationPanel`, causing the state to go out of sync.

**Fix approach** (implemented)
Adopted the "one global evaluation + a single top-level EvaluationPanel" approach:

1. **Modified `useEvaluationHandler.ts`**: added an optional `externalEvaluation` parameter (line 57, lines 183-188), allowing an external evaluation instance to be passed in
2. **Removed `<EvaluationPanel>` from the Workspaces**:
   - `ContextSystemWorkspace.vue:212` - only an explanatory comment remains
   - `ContextUserWorkspace.vue:247` - only an explanatory comment remains
3. **The Workspaces use the global evaluation**:
   - `ContextSystemWorkspace.vue:417` - `const globalEvaluation = useEvaluationContext()`
   - `ContextSystemWorkspace.vue:446` - `externalEvaluation: globalEvaluation`
   - `ContextUserWorkspace.vue:523` - `const globalEvaluation = useEvaluationContext()`
   - `ContextUserWorkspace.vue:552` - `externalEvaluation: globalEvaluation`

**How to verify**
- Searching the context-mode directory for `<EvaluationPanel` should return no matches
- Searching for `externalEvaluation` should find its use in both Workspaces

---

### ✅ P1: The `prompt-iterate` re-evaluate in the Context Workspaces lacks `iterateRequirement` (fixed)

**Original problem**
- The `useEvaluationHandler()` inside the Workspaces was not given `currentIterateRequirement`, which could make the `prompt-iterate` re-evaluate validation fail.

**Fix approach** (implemented)
- Added a `currentIterateRequirement` computed property in both Workspaces:
  - `ContextSystemWorkspace.vue:425-432` - obtained from `displayAdapter.displayedVersions / displayedCurrentVersionId` (ensuring consistency with the UI's "currently displayed version")
  - `ContextUserWorkspace.vue:531-538` - obtained from `contextUserOptimization.currentVersions`
- Passed it into `useEvaluationHandler`:
  - `ContextSystemWorkspace.vue:445` - `currentIterateRequirement,`
  - `ContextUserWorkspace.vue:551` - `currentIterateRequirement,`

---

### ✅ P1: "Apply Improvement" is only responsible for "opening the iteration dialog + prefilling the text" and does not depend on a preselected template (fixed)

**Background/scenario**
- When the user clicks "Apply Improvement" in the evaluation details, the expected behavior is to directly open the iteration dialog and put the suggestion text into the input box; the template is then chosen within the dialog (different modes offer different templates).

**Fix approach** (implemented)
- The iteration dialog in `PromptPanel.vue` already contains a `TemplateSelect` (a template can be chosen inside the dialog).
- `handleIterate()` in `PromptPanel.vue` no longer requires `selectedIterateTemplate` to be preselected; it opens the dialog directly.
- `PromptPanel.vue` exposes `openIterateDialog(input?)`: used by the "Apply Improvement" path to prefill the input and open the dialog.

**How to verify**
- Without preselecting an iteration template, click the "Continue Optimizing" button: the iteration dialog should open and a template can be chosen inside it.
- Click "Apply Improvement" from the evaluation details: the iteration dialog should open with the suggestion text prefilled; clicking confirm without selecting a template should show "Please select an iteration prompt first" (allowed).

---

### ✅ P1: Close and clear evaluation state when switching modes/sub-modes (fixed)

**Background/scenario**
- "Evaluation" always targets the currently displayed content; when switching the function mode (basic/pro/image) or the sub-mode (system/user, etc.), the old evaluation details and scores should not linger.

**Fix approach** (implemented)
- `PromptOptimizerApp.vue` uniformly executes the following at these entry points:
  - `evaluation.closePanel()` (close the detail panel)
  - `evaluation.clearAllResults()` (clear all evaluation results)
- Covers:
  - Function mode switching `handleModeSelect(...)`
  - Context sub-mode switching watch (`contextManagement.contextMode`)
  - Sub-mode switching handlers: `handleBasicSubModeChange(...)` / `handleProSubModeChange(...)` / `handleImageSubModeChange(...)`

**How to verify**
- After completing an evaluation in any mode and switching modes/sub-modes: the evaluation panel should close, and the score badge/details should be cleared.

---

### 📋 P2: Known trade-offs (non-blocking, listed in the optimization backlog)

- **`isOptimizedBetter` is not persisted in prompt-only/prompt-iterate**: The templates require this field in the output, but the server retains it only for compare; it is recommended to either remove the template field to save tokens, or extend the service and UI to consume it consistently (`packages/core/src/services/evaluation/service.ts:468`).
- **Inconsistent error message language**: Core errors are in English and the UI passes English through; an "error type/error code → i18n key" mapping can be introduced later (`packages/core/src/services/evaluation/service.ts:159`, `packages/ui/src/composables/prompt/useEvaluation.ts:410`).

---

### ✅ P0: The re-evaluate / apply-improvement logic of the global EvaluationPanel in Context mode may still be incorrect (fixed)

> This problem is mode coupling caused by "the global panel's event handlers being bound to the basic-mode data source". Although the Context Workspaces already reuse the global evaluation through `externalEvaluation` and have removed the local panels, the interaction of the App top-level panel still needs further decoupling.

**Facts from the code**
- The `@re-evaluate` of the single App top-level `EvaluationPanel` is bound to `handleReEvaluate` (`packages/ui/src/components/app-layout/PromptOptimizerApp.vue:583`), whose implementation comes from the App's internal `evaluationHandler.handleReEvaluate()`, and the data source used by that handler is `optimizer.prompt/optimizer.optimizedPrompt/testResults` (i.e. the basic-mode optimizer and test results).
- In Context mode, evaluation requests are usually initiated by `PromptPanel` directly using the injected global `evaluation`, and the content source is the `originalPrompt/optimizedPrompt` props passed in by the Context Workspace (`packages/ui/src/components/PromptPanel.vue:489`).
- Therefore, when the user opens the evaluation details in Context mode and clicks "Re-evaluate", the evaluation may be re-run with basic-mode data, overwriting the Context evaluation result.

**Fix approach** (implemented)

This time we adopted "Plan B: Provider (data source provider) routing", whose core principles are:
- **Re-evaluation uses the latest state** (the current workspace/current content) and does not save/replay lastRequest.
- The global `EvaluationPanel` is UI only and is no longer bound to the basic-mode data source; its events are routed to the "currently active Workspace" for execution.

1. **Adjusted the semantics of handleReEvaluate in `useEvaluationHandler.ts`**:
   - Changed to always rebuild the request from the current business state and execute one evaluation (not relying on lastRequest).

2. **The Context Workspaces expose Provider capabilities (defineExpose)**:
   - `reEvaluateActive()`: internally calls `evaluationHandler.handleReEvaluate()`, re-evaluating with the current Workspace's data source (original/optimized/proContext/iterateRequirement, etc.).
   - `openIterateDialog()`: internally forwards to `PromptPanel`'s `openIterateDialog`, used to open the iteration dialog when applying an improvement suggestion.

3. **`PromptOptimizerApp.vue` global panel event routing**:
   - `@re-evaluate`: selects `systemWorkspaceRef/userWorkspaceRef` (Context) based on `functionMode/contextMode`, or uses the basic-mode handler, and calls the corresponding provider's `reEvaluateActive()`.
   - `@apply-improvement`: in Context mode, calls the corresponding Workspace's `openIterateDialog(improvement)`; basic mode continues to go through `basicModeWorkspaceRef`.

**How to verify**
- After running an evaluation in Context mode, clicking "Re-evaluate" in the global `EvaluationPanel` should re-evaluate the currently selected message / the current variable prompt (rather than the basic-mode optimizer's data).
- In Context mode, clicking "Apply Improvement" in the global `EvaluationPanel` should open the current Workspace's iteration dialog with the improvement suggestion prefilled.

---

### ✅ P2: The EvaluationPanel title does not cover the new types (fixed)

**Original problem**
- The title switch in `EvaluationPanel.vue` only covers `original/optimized/compare`; `prompt-only/prompt-iterate` fall to `evaluation.title.default` (`packages/ui/src/components/evaluation/EvaluationPanel.vue:185`).

**Fix approach** (implemented)

1. **Added cases for the new types in `EvaluationPanel.vue`** (lines 188-191):
   ```typescript
   case 'prompt-only':
     return t('evaluation.title.promptOnly')
   case 'prompt-iterate':
     return t('evaluation.title.promptIterate')
   ```

2. **Added i18n titles**:
   - `zh-CN.ts` - `promptOnly` and `promptIterate` set to the Chinese equivalents of "Prompt Quality Analysis" and "Iteration Optimization Analysis"
   - `en-US.ts` - `promptOnly: "Prompt Quality Analysis"`, `promptIterate: "Iteration Optimization Analysis"`
   - `zh-TW.ts` - `promptOnly` and `promptIterate` set to the Traditional Chinese equivalents of "Prompt Quality Analysis" and "Iteration Optimization Analysis"

## 10. Usage and Design Notes (For Future Maintenance)

### 10.1 How to Use "Basic Mode (basic)" (Relation to Evaluation)

Typical flow (single prompt optimization):
1) Enter `originalPrompt` (the original prompt)  
2) Click "Optimize" to get `optimizedPrompt` (the currently displayed version)  
3) (Optional) Run a test in the test area to get `testResult` (used for the three evaluation types original/optimized/compare)  
4) Click "Analyze" to run `prompt-only` or `prompt-iterate` (does not depend on test results)  
5) Clicking "Re-evaluate" in the evaluation details evaluates "the currently displayed content + the current mode parameters" once more

The key constraint here: **`originalPrompt` always exists by product definition** (used to align with the original requirement and avoid intent drift), so it is reasonable for the Core layer to validate that `originalPrompt` cannot be empty, and there is no need to relax this for so-called "prompt-only standalone evaluation".

### 10.2 Why the Context of Context Mode Is Different

Context mode (pro) is essentially not a "single prompt" but a "target object with context":
- **Pro-System**: The target is a particular message in the conversation (system/user/assistant/tool), and `proContext` carries the "target message + the full conversation message list", making it easier for the model to understand the contextual semantics.
- **Pro-User**: The target is a "prompt with variables", and `proContext` carries variable resolution information (raw/resolved/variables), so that the evaluation knows how the placeholders are filled.

Therefore:
- The same `EvaluationType` (for example `prompt-only`) may have different "templates and context inputs" in different sub-modes;
- But the server output should still be normalized through `EvaluationResponse` to keep the UI display consistent (score/suggestions/reasons, etc.).

### 10.3 Why Re-evaluate Only Needs the "Current State" and Not lastRequest

The product semantics of "re-evaluate" is: **run the evaluation once more**, and the evaluation target is always "the version currently shown in the UI".

So the implementation needs only two kinds of information:
- "Which type to evaluate": from the currently open detail type `evaluation.state.activeDetailType`
- "The input data to evaluate": from the current business state (current prompt / current version / current proContext / current iterateRequirement, etc.)

The earlier `lastRequest` approach easily introduced "replay of stale state" and cross-mode contamination; the current implementation has removed `lastRequest` and turned re-evaluate into "rebuild the request from the current state and execute it", which better fits the product definition.

### 10.4 Design Trade-off of the Global Evaluation Panel: Plan B (Provider Routing) vs Each Mode Having Its Own Panel

What has landed this time is **Plan B: a single global `EvaluationPanel` + Provider routing**:
- Advantages: consistent UI, a single source of state (avoids two evaluation sets), and easier cross-component sharing (`provide/inject`).
- Risk: the top level needs to know the "currently active workspace", and when a capability is missing it is treated as an "exceptional bug" (to avoid silently falling back to the wrong data source).

Alternative (fallback): each mode renders its own `EvaluationPanel`.
- Advantages: the data source is naturally close by, and routing is simple.
- Disadvantages: prone to "two panels / two states", and brings more mode branches and synchronization problems.

Current conclusion: under the existing UI architecture, **prefer to keep Plan B**; if the Provider interface grows further or becomes hard to maintain in the future, consider falling back to "each mode has its own panel", but duplicate evaluation instances must be strictly avoided.
