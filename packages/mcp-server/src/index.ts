#!/usr/bin/env node

/*
 * Prompt Optimizer - AI prompt optimization tool
 * Copyright (C) 2025 linshenkx
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * MCP Server for Prompt Optimizer
 *
 * Provides 3 core tools:
 * - optimize-user-prompt: optimize user prompts
 * - optimize-system-prompt: optimize system prompts
 * - iterate-prompt: iteratively optimize mature prompts
 *
 * Supports both stdio and HTTP transports
 *
 * Note: environment variables are loaded at app startup through environment.ts
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ListToolsRequestSchema, CallToolRequestSchema, isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { CoreServicesManager } from './adapters/core-services.js';
import { loadConfig } from './config/environment.js';
import * as logger from './utils/logging.js';
import { ParameterValidator } from './adapters/parameter-adapter.js';
import { getTemplateOptions, getDefaultTemplateId } from './config/templates.js';
import { randomUUID } from 'node:crypto';
import express from 'express';

// Factory function for creating a server instance
async function createServerInstance(config: any) {
  // Create the MCP Server instance - using the correct API
  const server = new Server({
    name: 'prompt-optimizer-mcp-server',
    version: '0.1.0'
  }, {
    capabilities: {
      tools: {}
    }
  });

  // Initialize the Core services (independent for each server instance)
  const coreServices = CoreServicesManager.getInstance();
  await coreServices.initialize(config);

  return { server, coreServices };
}

// Function that sets up the server tools and handlers
async function setupServerHandlers(server: Server, coreServices: CoreServicesManager) {

  // Get the template options and default template IDs for the tool definitions
  logger.info('Getting template options...');
  const templateManager = coreServices.getTemplateManager();
  const [userOptimizeOptions, systemOptimizeOptions, iterateOptions, userDefaultId, systemDefaultId, iterateDefaultId] = await Promise.all([
    getTemplateOptions(templateManager, 'userOptimize'),
    getTemplateOptions(templateManager, 'optimize'),
    getTemplateOptions(templateManager, 'iterate'),
    getDefaultTemplateId(templateManager, 'user'),
    getDefaultTemplateId(templateManager, 'system'),
    getDefaultTemplateId(templateManager, 'iterate')
  ]);

  // Register the tool list handler
  logger.info('Registering MCP tools...');
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "optimize-user-prompt",
          description: "Optimize user prompts to improve the effect of conversations with AI. Suited to everyday chat, Q&A, creative writing, and similar scenarios.\n\nMain features:\n- Improve the clarity and specificity of the expression\n- Add necessary context information\n- Optimize the language and logical structure\n- Improve the accuracy of the AI's understanding\n\nExample use cases:\n- Turn a vague question into a specific and clear inquiry\n- Add detailed requirements and constraints to a creative task\n- Optimize how a technical question is described",
          inputSchema: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description: "The user prompt to optimize. For example: 'Help me write an article' or 'Explain machine learning'"
              },
              template: {
                type: "string",
                description: `Choose the optimization template; different templates suit different scenarios:\n${userOptimizeOptions.map(opt => `- ${opt.label}: ${opt.description}`).join('\n')}`,
                enum: userOptimizeOptions.map(opt => opt.value),
                default: userDefaultId
              }
            },
            required: ["prompt"]
          }
        },
        {
          name: "optimize-system-prompt",
          description: "Optimize system prompts to improve AI role-playing and behavior control. Suited to customizing AI assistants, creating professional roles, designing dialogue systems, and similar scenarios.\n\nMain features:\n- Strengthen role definition and professionalism\n- Optimize behavior guidance and constraints\n- Improve instruction structure and hierarchy\n- Add necessary domain knowledge\n\nExample use cases:\n- Turn a simple role description into a professional role definition\n- Add detailed behavior rules and limits to an AI assistant\n- Optimize the knowledge framework of a domain-specific expert",
          inputSchema: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description: "The system prompt to optimize. For example: 'You are an assistant' or 'You are a medical consultant'"
              },
              template: {
                type: "string",
                description: `Choose the optimization template; different templates suit different scenarios:\n${systemOptimizeOptions.map(opt => `- ${opt.label}: ${opt.description}`).join('\n')}`,
                enum: systemOptimizeOptions.map(opt => opt.value),
                default: systemDefaultId
              }
            },
            required: ["prompt"]
          }
        },
        {
          name: "iterate-prompt",
          description: "Iteratively improve an existing prompt based on specific requirements. Suited to scenarios where a base prompt already exists but needs fine-grained adjustment for specific needs.\n\nMain features:\n- Preserve the core functionality of the original prompt\n- Make targeted improvements based on specific requirements\n- Solve specific problems of the existing prompt\n- Adapt to new use cases or requirements\n\nExample use cases:\n- The existing prompt does not work well enough and needs improvement\n- Need to adapt to new business requirements or use cases\n- Need to solve a specific output format or content problem\n- Need to strengthen the performance of a specific aspect",
          inputSchema: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description: "The existing prompt to iteratively improve. It should be a complete prompt that is already in use but needs improvement"
              },
              requirements: {
                type: "string",
                description: "The specific improvement requirement or problem description. For example: 'The output format is not standardized' or 'A more professional language style is needed' or 'Want to add more creativity'"
              },
              template: {
                type: "string",
                description: `Choose the iteration optimization template; different templates have different improvement strategies:\n${iterateOptions.map(opt => `- ${opt.label}: ${opt.description}`).join('\n')}`,
                enum: iterateOptions.map(opt => opt.value),
                default: iterateDefaultId
              }
            },
            required: ["prompt", "requirements"]
          }
        }
      ]
    };
  });

  // Register the tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.info(`Handling tool call request: ${name}`);

    try {
      switch (name) {
        case "optimize-user-prompt": {
          const { prompt, template } = args as { prompt?: string; template?: string };

          if (!prompt) {
            return {
              isError: true,
              content: [{
                type: "text",
                text: "Error: missing required parameter 'prompt'"
              }]
            };
          }

          // Parameter validation
          ParameterValidator.validatePrompt(prompt);
          if (template) {
            ParameterValidator.validateTemplate(template);
          }

          // Call the Core service
          const promptService = coreServices.getPromptService();
          const modelManager = coreServices.getModelManager();
          const templateManager = coreServices.getTemplateManager();

          // Check whether the MCP default model is available
          const mcpModel = await modelManager.getModel('mcp-default');
          if (!mcpModel || !mcpModel.enabled) {
            return {
              isError: true,
              content: [{
                type: "text",
                text: "Error: the MCP default model is not configured or not enabled, please check the environment variable config"
              }]
            };
          }

          const templateId = template || await getDefaultTemplateId(templateManager, 'user');
          const result = await promptService.optimizePrompt({
            targetPrompt: prompt,
            modelKey: 'mcp-default',
            optimizationMode: 'user',
            templateId
          });

          return {
            content: [{
              type: "text",
              text: result
            }]
          };
        }

        case "optimize-system-prompt": {
          const { prompt, template } = args as { prompt?: string; template?: string };

          if (!prompt) {
            return {
              isError: true,
              content: [{
                type: "text",
                text: "Error: missing required parameter 'prompt'"
              }]
            };
          }

          // Parameter validation
          ParameterValidator.validatePrompt(prompt);
          if (template) {
            ParameterValidator.validateTemplate(template);
          }

          // Call the Core service
          const promptService = coreServices.getPromptService();
          const modelManager = coreServices.getModelManager();
          const templateManager = coreServices.getTemplateManager();

          // Check whether the MCP default model is available
          const mcpModel = await modelManager.getModel('mcp-default');
          if (!mcpModel || !mcpModel.enabled) {
            return {
              isError: true,
              content: [{
                type: "text",
                text: "Error: the MCP default model is not configured or not enabled, please check the environment variable config"
              }]
            };
          }

          const templateId = template || await getDefaultTemplateId(templateManager, 'system');
          const result = await promptService.optimizePrompt({
            targetPrompt: prompt,
            modelKey: 'mcp-default',
            optimizationMode: 'system',
            templateId
          });

          return {
            content: [{
              type: "text",
              text: result
            }]
          };
        }

        case "iterate-prompt": {
          const { prompt, requirements, template } = args as {
            prompt?: string;
            requirements?: string;
            template?: string
          };

          if (!prompt) {
            return {
              isError: true,
              content: [{
                type: "text",
                text: "Error: missing required parameter 'prompt'"
              }]
            };
          }

          if (!requirements) {
            return {
              isError: true,
              content: [{
                type: "text",
                text: "Error: missing required parameter 'requirements'"
              }]
            };
          }

          // Parameter validation
          ParameterValidator.validatePrompt(prompt);
          ParameterValidator.validateRequirements(requirements);
          if (template) {
            ParameterValidator.validateTemplate(template);
          }

          // Call the Core service
          const promptService = coreServices.getPromptService();
          const modelManager = coreServices.getModelManager();
          const templateManager = coreServices.getTemplateManager();

          // Check whether the MCP default model is available
          const mcpModel = await modelManager.getModel('mcp-default');
          if (!mcpModel || !mcpModel.enabled) {
            return {
              isError: true,
              content: [{
                type: "text",
                text: "Error: the MCP default model is not configured or not enabled, please check the environment variable config"
              }]
            };
          }

          const templateId = template || await getDefaultTemplateId(templateManager, 'iterate');
          const result = await promptService.iteratePrompt(
            prompt,
            prompt, // Use the original prompt as the last optimized prompt
            requirements,
            'mcp-default',
            templateId
          );

          return {
            content: [{
              type: "text",
              text: result
            }]
          };
        }

        default:
          return {
            isError: true,
            content: [{
              type: "text",
              text: `Error: unknown tool '${name}'`
            }]
          };
      }
    } catch (error) {
      logger.error(`Tool execution error ${name}:`, error as Error);
      return {
        isError: true,
        content: [{
          type: "text",
          text: `Tool execution error: ${(error as Error).message}`
        }]
      };
    }
  });

  logger.info('MCP tools registered successfully');
}

async function main() {
  const config = loadConfig();
  logger.setLogLevel(config.logLevel);

  try {
    // Parse the command-line arguments
    const args = process.argv.slice(2);
    const transport = args.find(arg => arg.startsWith('--transport='))?.split('=')[1] || 'stdio';
    const port = parseInt(args.find(arg => arg.startsWith('--port='))?.split('=')[1] || config.httpPort.toString());

    logger.info('Starting MCP Server for Prompt Optimizer');
    logger.info(`Transport: ${transport}, Port: ${port}`);

    // Initialize the Core services (one time, used to validate the config)
    logger.info('Initializing Core services...');
    const coreServices = CoreServicesManager.getInstance();
    await coreServices.initialize(config);
    logger.info('Core services initialized successfully');

    // Start the transport layer
    if (transport === 'http') {
      logger.info('Starting HTTP server with session management...');
      // Use Express and session management to support multi-client connections
      const app = express();
      app.use(express.json());
      logger.info('Express app configured');

      // Store the transport instance of each session
      const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

      // Handle POST requests (client-to-server communication)
      app.post('/mcp', async (req, res) => {
        // Check for an existing session ID
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        let httpTransport: StreamableHTTPServerTransport;

        if (sessionId && transports[sessionId]) {
          // Reuse the existing transport
          httpTransport = transports[sessionId];
        } else if (!sessionId && isInitializeRequest(req.body)) {
          // New initialization request - create an independent server instance for each session
          httpTransport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sessionId) => {
              // Store the transport instance
              transports[sessionId] = httpTransport;
            },
            // The MCP protocol does not need complex CORS config; allow all origins
            allowedOrigins: ['*'],
            enableDnsRebindingProtection: false
          });

          // Clean up the transport instance
          httpTransport.onclose = () => {
            if (httpTransport.sessionId) {
              delete transports[httpTransport.sessionId];
            }
          };

          // Create an independent server instance for each session
          const { server } = await createServerInstance(config);
          await setupServerHandlers(server, coreServices);

          // Connect to the MCP server
          await server.connect(httpTransport);
        } else {
          // Invalid request
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: No valid session ID provided',
            },
            id: null,
          });
          return;
        }

        // Handle the request
        await httpTransport.handleRequest(req, res, req.body);
      });

      // Handle GET requests (server-to-client notifications, via SSE)
      app.get('/mcp', async (req, res) => {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (!sessionId || !transports[sessionId]) {
          res.status(400).send('Invalid or missing session ID');
          return;
        }

        const httpTransport = transports[sessionId];
        await httpTransport.handleRequest(req, res);
      });

      // Handle DELETE requests (session termination)
      app.delete('/mcp', async (req, res) => {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (!sessionId || !transports[sessionId]) {
          res.status(400).send('Invalid or missing session ID');
          return;
        }

        const httpTransport = transports[sessionId];
        await httpTransport.handleRequest(req, res);
      });

      logger.info('Setting up HTTP server listener...');
      app.listen(port, () => {
        logger.info(`MCP Server running on HTTP port ${port} with session management`);
      });
      logger.info('HTTP server setup completed');
    } else {
      // stdio mode - create a single server instance
      const { server } = await createServerInstance(config);
      await setupServerHandlers(server, coreServices);

      const stdioTransport = new StdioServerTransport();
      await server.connect(stdioTransport);
      logger.info('MCP Server running on stdio');
    }

  } catch (error) {
    // Make sure the error message is always shown, even when DEBUG is not enabled
    console.error('❌ MCP Server startup failed:');
    console.error('   ', (error as Error).message);

    // Also log the details using the debug library
    logger.error('Failed to start MCP Server', error as Error);

    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Export the main function for external calls
export { main };

// Create a separate start file to avoid executing at build time
