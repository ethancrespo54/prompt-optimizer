const log = require('electron-log');
const path = require('path');
const { app } = require('electron');

class ConsoleLogger {
  constructor() {
    this.originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug
    };
    
    this.setupElectronLog();
    this.setupModuleLoggers();
    this.hijackConsole();
  }

  setupElectronLog() {
    // Get the user data directory
    const userDataPath = app ? app.getPath('userData') : process.cwd();
    const logDir = path.join(userDataPath, 'logs');

    // Main log config
    log.transports.file.level = 'info';
    log.transports.file.maxSize = 10 * 1024 * 1024; // 10MB
    log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
    log.transports.file.resolvePathFn = () => path.join(logDir, 'main.log');

    // Console config
    log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'info';
    log.transports.console.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}';

    // Disable IPC transport
    log.transports.ipc.level = false;
  }

  setupModuleLoggers() {
    // Create loggers for different modules
    this.loggers = {
      main: this.createModuleLogger('main'),
      desktop: this.createModuleLogger('desktop'),
      updater: this.createModuleLogger('updater'),
      ipc: this.createModuleLogger('ipc'),
      error: this.createModuleLogger('error')
    };

    // Special config for the error log
    this.loggers.error.transports.file.level = 'error';
    this.loggers.error.transports.console.level = 'error';
  }

  createModuleLogger(moduleName) {
    const moduleLog = log.create(moduleName);
    const userDataPath = app ? app.getPath('userData') : process.cwd();
    const logDir = path.join(userDataPath, 'logs');
    
    moduleLog.transports.file.resolvePathFn = () => path.join(logDir, `${moduleName}.log`);
    moduleLog.transports.file.maxSize = 5 * 1024 * 1024; // 5MB per module
    moduleLog.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
    moduleLog.transports.console.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}';
    
    return moduleLog;
  }

  // Parse the log message intelligently to decide which logger to use
  parseLogMessage(message) {
    const messageStr = typeof message === 'string' ? message : String(message);
    
    // Module mapping rules
    const modulePatterns = [
      { pattern: /^\[Main Process\]/i, logger: this.loggers.main, prefix: '[Main Process]' },
      { pattern: /^\[DESKTOP\]/i, logger: this.loggers.desktop, prefix: '[DESKTOP]' },
      { pattern: /^\[Updater\]/i, logger: this.loggers.updater, prefix: '[Updater]' },
      { pattern: /^\[.*IPC.*\]/i, logger: this.loggers.ipc, prefix: '[IPC]' },
    ];

    // Find the matching module
    for (const { pattern, logger, prefix } of modulePatterns) {
      if (pattern.test(messageStr)) {
        const cleanMessage = messageStr.replace(pattern, '').trim();
        return { logger, message: cleanMessage, originalPrefix: prefix };
      }
    }

    // Use the main logger by default
    return { logger: this.loggers.main, message: messageStr, originalPrefix: null };
  }

  // Hijack the console methods
  hijackConsole() {
    // Hijack console.log
    console.log = (...args) => {
      const firstArg = args[0];
      const { logger, message, originalPrefix } = this.parseLogMessage(firstArg);
      
      if (originalPrefix && args.length === 1) {
        // A single message with a prefix
        logger.info(message);
      } else if (originalPrefix) {
        // A message with a prefix and extra arguments
        const restArgs = args.slice(1);
        logger.info(message, ...restArgs);
      } else {
        // Normal log
        logger.info(...args);
      }

      // In development, also output to the original console
      if (process.env.NODE_ENV === 'development') {
        this.originalConsole.log(...args);
      }
    };

    // Hijack console.error
    console.error = (...args) => {
      const firstArg = args[0];
      const { logger, message, originalPrefix } = this.parseLogMessage(firstArg);
      
      // Errors are always also recorded in the error log
      this.loggers.error.error(...args);
      
      if (originalPrefix && args.length >= 2) {
        // An error message with a prefix
        const restArgs = args.slice(1);
        logger.error(message, ...restArgs);
      } else {
        // Normal error
        logger.error(...args);
      }

      // Always output to the original console (errors are important)
      this.originalConsole.error(...args);
    };

    // Hijack console.warn
    console.warn = (...args) => {
      const firstArg = args[0];
      const { logger, message, originalPrefix } = this.parseLogMessage(firstArg);
      
      if (originalPrefix && args.length === 1) {
        logger.warn(message);
      } else if (originalPrefix) {
        const restArgs = args.slice(1);
        logger.warn(message, ...restArgs);
      } else {
        logger.warn(...args);
      }

      // In development, also output to the original console
      if (process.env.NODE_ENV === 'development') {
        this.originalConsole.warn(...args);
      }
    };

    // Hijack console.info
    console.info = (...args) => {
      const firstArg = args[0];
      const { logger, message } = this.parseLogMessage(firstArg);
      logger.info(...args);

      if (process.env.NODE_ENV === 'development') {
        this.originalConsole.info(...args);
      }
    };

    // Hijack console.debug
    console.debug = (...args) => {
      const firstArg = args[0];
      const { logger, message } = this.parseLogMessage(firstArg);
      logger.debug(...args);

      if (process.env.NODE_ENV === 'development') {
        this.originalConsole.debug(...args);
      }
    };
  }

  // Restore the original console (if needed)
  restore() {
    Object.assign(console, this.originalConsole);
  }

  // Set up global error handlers
  setupGlobalErrorHandlers() {
    // Capture unhandled exceptions
    process.on('uncaughtException', (error) => {
      const errorInfo = {
        type: 'uncaughtException',
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        pid: process.pid
      };

      // Record to the error log
      this.loggers.error.error('CRITICAL - Uncaught Exception:', JSON.stringify(errorInfo, null, 2));

      // Also output to the console (to make sure it can be seen)
      this.originalConsole.error('[CRITICAL] Uncaught Exception:', error);

      // Give the log system a moment to write to the file
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    });

    // Capture unhandled Promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      const errorInfo = {
        type: 'unhandledRejection',
        reason: reason instanceof Error ? {
          message: reason.message,
          stack: reason.stack
        } : reason,
        promise: promise.toString(),
        timestamp: new Date().toISOString(),
        pid: process.pid
      };

      // Record to the error log
      this.loggers.error.error('CRITICAL - Unhandled Rejection:', JSON.stringify(errorInfo, null, 2));

      // Also output to the console
      this.originalConsole.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);

      // Give the log system a moment to write to the file
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    });

    // Capture process warnings
    process.on('warning', (warning) => {
      const warningInfo = {
        type: 'processWarning',
        name: warning.name,
        message: warning.message,
        stack: warning.stack,
        timestamp: new Date().toISOString()
      };

      this.loggers.error.warn('Process Warning:', JSON.stringify(warningInfo, null, 2));
      this.originalConsole.warn('[WARNING]', warning);
    });

    console.log('[Console Logger] Global error handlers setup completed');
  }

  // Get the log file path
  getLogPaths() {
    const userDataPath = app ? app.getPath('userData') : process.cwd();
    const logDir = path.join(userDataPath, 'logs');

    return {
      logDir,
      main: path.join(logDir, 'main.log'),
      desktop: path.join(logDir, 'desktop.log'),
      updater: path.join(logDir, 'updater.log'),
      ipc: path.join(logDir, 'ipc.log'),
      error: path.join(logDir, 'error.log')
    };
  }
}

module.exports = ConsoleLogger;
