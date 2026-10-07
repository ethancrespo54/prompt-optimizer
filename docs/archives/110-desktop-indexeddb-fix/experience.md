# "Desktop IndexedDB Fix" Task: Lessons Learned

## Core Lessons

### Architecture Design
- **Enforced explicitness over convenience**: The core of this task was deleting convenience methods such as `createDefault()`. This forces developers to specify the storage type explicitly when creating a service, which prevents IndexedDB from being created accidentally in environments such as Electron where it does not belong. This is an important architectural principle that guards against hidden, environment-induced side effects.
- **Avoid module-level side effects**: We found that creating instances (such as storage providers) in the top-level scope of modules like `factory.ts` is a major hazard. A module should not perform any substantive side-effecting work when it is imported. All instantiation should happen through explicit function calls and dependency injection.

### Debugging and Troubleshooting
- **Beware of legacy data**: This is a key lesson. Even after the code is fixed, IndexedDB data left in the browser can cause abnormal app behavior and mask the real effect of the fix. When dealing with problems related to persisted data, "clean up historical data" must be part of the verification steps.
- **Avoid over-fixing**: Early in the investigation we added some complex environment checks and warning logic to the code. The intent was good, but it increased code complexity. Once the more fundamental architectural fix (deleting `createDefault`) was in place, that logic became redundant. This is a reminder to review and clean up temporary or overly defensive code added during troubleshooting once the fix is done.

## Specific Pitfall Guide

- **Problem**: IndexedDB should not appear in the Electron renderer process.
- **Consequence**: It violates the core desktop architecture (data should be managed centrally by the main process) and can cause data inconsistency and unexpected disk I/O.
- **Correct approach**: The renderer process should operate on data entirely by communicating with the main process through IPC proxies, and should not create any storage instance directly. All storage-related logic should be encapsulated in the main process.

- **Problem**: Convenient factory methods (such as `createDefault()`) can hide environment dependencies.
- **Consequence**: Modules behave inconsistently across environments, making debugging harder.
- **Correct approach**: Remove methods that create instances implicitly. Enforce dependency injection so that all dependencies are explicit, controllable, and easy to test.
