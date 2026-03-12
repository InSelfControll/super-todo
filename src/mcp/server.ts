#!/usr/bin/env node
/**
 * 🛡️ Super Todo MCP Server
 * 
 * Model Context Protocol server with stdio or SSE transport.
 * Integrates with Convex backend for project/task management.
 * 
 * Transport modes:
 * - stdio: Local communication (default, for Kimi Code CLI)
 * - sse: HTTP server for remote connections
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import http from "http";
import fs from "fs";
import path from "path";

import { tools, type ToolName } from "./tools.js";
import { SUPER_TODO_PROTOCOL } from "./prompts.js";
import { ConvexClient, createClientFromEnv } from "../convex/client.js";

// Load environment variables
dotenv.config();

// ============================================
// CONFIGURATION
// ============================================

const TRANSPORT = process.env.MCP_TRANSPORT || "stdio"; // "stdio" | "sse"
const PORT = parseInt(process.env.MCP_PORT || "3000", 10);
const HOST = process.env.MCP_HOST || "0.0.0.0";
const SERVER_NAME = process.env.MCP_SERVER_NAME || "super-todo";
const SERVER_VERSION = process.env.MCP_SERVER_VERSION || "1.0.0";
// Workspace directory - use env var, or cwd (for when MCP is run from project dir)
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || process.env.INIT_CWD || process.cwd();

// Initialize Convex client
let convexClient: ConvexClient;
try {
  convexClient = createClientFromEnv();
} catch (error) {
  console.error("Failed to initialize Convex client:", error);
  process.exit(1);
}

// Track active project for auto-complete detection
let lastAccessedProjectId: string | null = null;

// ============================================
// PROJECT CONTEXT DETECTION
// ============================================

interface ProjectContext {
  name: string;
  description?: string;
  detectedFrom: string;
  suggestedTasks: string[];
}

function detectProjectContext(workspacePath: string = WORKSPACE_DIR): ProjectContext | null {
  try {
    // Try to read package.json
    const packageJsonPath = path.join(workspacePath, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      const name = packageJson.name || path.basename(workspacePath);
      const description = packageJson.description;
      
      // Generate suggested tasks based on project type
      const suggestedTasks = generateTasksFromProjectType(packageJson, workspacePath);
      
      return {
        name: sanitizeProjectName(name),
        description,
        detectedFrom: "package.json",
        suggestedTasks
      };
    }

    // Try to read Cargo.toml (Rust)
    const cargoTomlPath = path.join(workspacePath, "Cargo.toml");
    if (fs.existsSync(cargoTomlPath)) {
      const cargoContent = fs.readFileSync(cargoTomlPath, "utf-8");
      const nameMatch = cargoContent.match(/^name\s*=\s*"([^"]+)"/m);
      const name = nameMatch ? nameMatch[1] : path.basename(workspacePath);
      
      return {
        name: sanitizeProjectName(name),
        detectedFrom: "Cargo.toml",
        suggestedTasks: [
          "Setup Rust environment",
          "Build project with cargo build",
          "Run tests with cargo test",
          "Add documentation"
        ]
      };
    }

    // Try to read README.md for project name
    const readmePath = path.join(workspacePath, "README.md");
    if (fs.existsSync(readmePath)) {
      const readme = fs.readFileSync(readmePath, "utf-8");
      const titleMatch = readme.match(/^#\s+(.+)$/m);
      const name = titleMatch ? titleMatch[1].trim() : path.basename(workspacePath);
      
      // Extract tasks from README sections
      const suggestedTasks = extractTasksFromReadme(readme);
      
      return {
        name: sanitizeProjectName(name),
        detectedFrom: "README.md",
        suggestedTasks
      };
    }

    // Try CHANGELOG.md
    const changelogPath = path.join(workspacePath, "CHANGELOG.md");
    if (fs.existsSync(changelogPath)) {
      const changelog = fs.readFileSync(changelogPath, "utf-8");
      const titleMatch = changelog.match(/^#\s+(.+)$/m);
      const name = titleMatch ? titleMatch[1].trim() : path.basename(workspacePath);
      
      return {
        name: sanitizeProjectName(name),
        detectedFrom: "CHANGELOG.md",
        suggestedTasks: [
          "Review recent changes",
          "Plan next release",
          "Update documentation"
        ]
      };
    }

    // Fallback to directory name
    return {
      name: sanitizeProjectName(path.basename(workspacePath)),
      detectedFrom: "directory name",
      suggestedTasks: [
        "Explore project structure",
        "Review existing code",
        "Identify next steps"
      ]
    };
  } catch (error) {
    console.error("Error detecting project context:", error);
    return null;
  }
}

function sanitizeProjectName(name: string): string {
  // Remove common prefixes/suffixes and clean up
  return name
    .replace(/^@[^/]+\//, "") // Remove npm scope
    .replace(/[-_]/g, " ") // Convert dashes/underscores to spaces
    .replace(/\b\w/g, (c) => c.toUpperCase()) // Capitalize words
    .trim();
}

function generateTasksFromProjectType(packageJson: any, workspacePath: string): string[] {
  const tasks: string[] = [];
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  // Detect project type and suggest relevant tasks
  if (deps["next"] || deps["react"]) {
    tasks.push("Setup development server", "Review component structure", "Check routing configuration");
  }
  if (deps["convex"]) {
    tasks.push("Review Convex schema", "Check queries and mutations", "Test Convex functions");
  }
  if (deps["typescript"]) {
    tasks.push("Run type checking", "Review TypeScript configuration");
  }
  if (deps["jest"] || deps["vitest"]) {
    tasks.push("Run test suite", "Review test coverage");
  }
  if (deps["@modelcontextprotocol/sdk"]) {
    tasks.push("Review MCP tools", "Test MCP server functionality");
  }
  
  // Check for specific files
  if (fs.existsSync(path.join(workspacePath, "Dockerfile"))) {
    tasks.push("Review Docker configuration", "Test container build");
  }
  if (fs.existsSync(path.join(workspacePath, ".github"))) {
    tasks.push("Review CI/CD workflows");
  }
  
  // Default tasks if none detected
  if (tasks.length === 0) {
    tasks.push("Explore project structure", "Review dependencies", "Identify next steps");
  }
  
  return tasks;
}

function extractTasksFromReadme(readme: string): string[] {
  const tasks: string[] = [];
  
  // Look for todo/roadmap sections
  const todoMatch = readme.match(/(?:##?\s*(?:TODO|Roadmap|Features|Tasks)[\s\S]*?)(?=##?\s|$)/i);
  if (todoMatch) {
    const lines = todoMatch[0].split("\n");
    for (const line of lines) {
      const taskMatch = line.match(/^[-*]\s*(.+)$/);
      if (taskMatch && !line.toLowerCase().includes("todo")) {
        tasks.push(taskMatch[1].trim());
      }
    }
  }
  
  // If no tasks found, add defaults
  if (tasks.length === 0) {
    tasks.push("Review README documentation", "Explore project structure", "Identify next steps");
  }
  
  return tasks.slice(0, 5); // Limit to 5 tasks
}

// ============================================
// SERVER SETUP
// ============================================

const server = new Server(
  {
    name: SERVER_NAME,
    version: SERVER_VERSION,
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
    },
  }
);

// ============================================
// TOOL HANDLERS
// ============================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const result = await handleTool(name as ToolName, args);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: errorMessage }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

async function handleTool(name: ToolName, args: unknown): Promise<unknown> {
  switch (name) {
    // ============================================
    // PROJECT CONTEXT DETECTION
    // ============================================
    case "detect_project_context": {
      const { workspacePath } = args as { workspacePath?: string } || {};
      const context = detectProjectContext(workspacePath);
      
      if (!context) {
        return {
          detected: false,
          message: "Could not detect project context from workspace",
          fallback: {
            name: sanitizeProjectName(path.basename(workspacePath || WORKSPACE_DIR)),
            suggestedTasks: ["Explore project structure", "Review existing files"]
          }
        };
      }

      return {
        detected: true,
        context,
        message: `🔍 Detected project "${context.name}" from ${context.detectedFrom}`,
        suggestedNextStep: "Use add_project with the detected name and ask user for group (important/hobbies)"
      };
    }

    // ============================================
    // PROJECT TOOLS
    // ============================================
    case "get_projects": {
      const { group, includeArchived } = args as { group?: "important" | "hobbies"; includeArchived?: boolean };
      const projects = await convexClient.getProjects(group, includeArchived);
      
      // Get task stats for each project
      const projectsWithStats = await Promise.all(
        projects.map(async (p) => {
          const stats = await convexClient.getTaskStats(p._id);
          return {
            id: p._id,
            name: p.name,
            group: p.group,
            status: p.status,
            lastWorkedOn: new Date(p.lastWorkedOn).toLocaleDateString(),
            stats: {
              total: stats.total,
              pending: stats.pending,
              completed: stats.completed
            }
          };
        })
      );

      // Format as Obsidian-style list
      const formattedList = projectsWithStats.map((p) => {
        const progress = p.stats.total > 0 ? Math.round((p.stats.completed / p.stats.total) * 100) : 0;
        return `- **${p.name}** [${p.group.toUpperCase()}] - ${p.stats.pending} pending, ${p.stats.completed} done (${progress}%)`;
      }).join("\n");

      // Group by importance
      const important = projectsWithStats.filter(p => p.group === "important" && p.status === "active");
      const hobbies = projectsWithStats.filter(p => p.group === "hobbies" && p.status === "active");

      return {
        projects: projectsWithStats,
        count: projectsWithStats.length,
        important: {
          count: important.length,
          projects: important.map(p => p.name)
        },
        hobbies: {
          count: hobbies.length,
          projects: hobbies.map(p => p.name)
        },
        formatted: formattedList || "No projects found. Create one with add_project.",
        reminder: "Use add_project to create new projects. Both IMPORTANT and HOBBIES groups are unlimited."
      };
    }

    case "add_project": {
      let { name, group, autoGenerateTasks } = args as { name?: string; group?: "important" | "hobbies"; autoGenerateTasks?: boolean };
      
      // Auto-detect project name if not provided
      if (!name) {
        const context = detectProjectContext();
        if (context) {
          name = context.name;
        } else {
          name = sanitizeProjectName(path.basename(WORKSPACE_DIR));
        }
      }
      
      // REQUIRE GROUP - Ask user if not provided
      if (!group) {
        const context = detectProjectContext();
        return {
          requires_user_input: true,
          question: "📁 Is this project [IMPORTANT] or [HOBBIES]?",
          detectedContext: context,
          project_name: name,
          options: [
            { value: "important", label: "IMPORTANT - Priority projects" },
            { value: "hobbies", label: "HOBBIES - Side projects" }
          ],
          note: "Both groups are unlimited. Choose based on priority level.",
          auto_detected: {
            name: name,
            source: context?.detectedFrom || "workspace directory",
            suggested_tasks: context?.suggestedTasks || ["Explore project structure"]
          }
        };
      }

      // Check if project already exists
      const existingProject = await convexClient.findProjectByName(name);
      if (existingProject && existingProject.status === "active") {
        // Get tasks for existing project
        const tasks = await convexClient.getTasks(existingProject._id, "all");
        const pendingTasks = tasks.filter(t => !t.completed);
        const completedTasks = tasks.filter(t => t.completed);
        
        return {
          success: true,
          existing: true,
          message: `📁 Project "${name}" already exists!`,
          project: {
            projectId: existingProject._id,
            name: existingProject.name,
            group: existingProject.group,
            status: existingProject.status
          },
          stats: {
            total: tasks.length,
            pending: pendingTasks.length,
            completed: completedTasks.length
          },
          tasks: pendingTasks.slice(0, 5).map(t => ({ id: t._id, text: t.text })),
          reminder: "Use get_tasks to see all pending tasks, or create a different project.",
          hint: "If you want to restart this project, archive it first and create a new one."
        };
      }

      const result = await convexClient.createProject(name, group, true);
      
      // Validate result
      if (!result || !result.projectId) {
        throw new Error(`Failed to create project: Invalid response from Convex`);
      }
      
      // If project already existed and was returned
      if (result.existing) {
        return {
          success: true,
          existing: true,
          message: `📁 Project "${name}" already exists!`,
          project: {
            projectId: result.projectId,
            name: result.name,
            group: result.group
          },
          reminder: result.message
        };
      }
      
      // Auto-generate tasks if enabled (default: true)
      let generatedTasks: Array<{ taskId: string; text: string; projectId: string }> = [];
      if (autoGenerateTasks !== false) {
        const context = detectProjectContext();
        if (context && context.suggestedTasks.length > 0) {
          try {
            const taskPromises = context.suggestedTasks.map(taskText => 
              convexClient.createTask(result.projectId, taskText, true)
            );
            generatedTasks = await Promise.all(taskPromises);
          } catch (taskError) {
            console.error("Error generating tasks:", taskError);
            // Continue even if task generation fails
          }
        }
      }

      return {
        success: true,
        existing: false,
        message: `✅ Created project "${name}" [${group.toUpperCase()}]`,
        project: {
          projectId: result.projectId,
          name: result.name,
          group: result.group
        },
        auto_generated_tasks: generatedTasks.length > 0 ? {
          count: generatedTasks.length,
          tasks: generatedTasks.map(t => t.text)
        } : null,
        reminder: "A 1% improvement each time is a big win!",
        next_steps: [
          "View tasks with get_tasks",
          "Add more tasks with add_task",
          "View all projects with get_projects"
        ]
      };
    }

    case "archive_project": {
      const { projectId } = args as { projectId: string };
      const result = await convexClient.archiveProject(projectId);
      return {
        success: true,
        message: "📁 Project archived",
        project: result,
        note: "You can reactivate it later if needed."
      };
    }

    // ============================================
    // TASK TOOLS
    // ============================================
    case "get_tasks": {
      const { projectId, filter = "pending" } = args as { projectId: string; filter?: "pending" | "completed" | "all" };
      
      // Track this project for auto-complete
      lastAccessedProjectId = projectId;
      
      const tasks = await convexClient.getTasks(projectId, filter);
      const project = await convexClient.getProjects().then((p) => p.find((proj) => proj._id === projectId));
      
      // Format as Obsidian checklist
      const formatted = tasks.map((t) => ({
        id: t._id,
        text: t.text,
        completed: t.completed,
        autoGenerated: t.autoGenerated,
        completedAt: t.completedAt ? new Date(t.completedAt).toLocaleString() : null,
      }));

      const checklist = formatted
        .map((t) => `- [${t.completed ? "x" : " "}] ${t.text}${t.autoGenerated ? " 🤖" : ""}`)
        .join("\n");

      return {
        project: project?.name || "Unknown",
        projectId,
        tasks: formatted,
        count: formatted.length,
        checklist: checklist || "No tasks found.",
        filter,
        hint: "Mention completing tasks in conversation for auto-detection!"
      };
    }

    case "add_task": {
      const { projectId, text, autoGenerated = false } = args as { projectId: string; text: string; autoGenerated?: boolean };
      lastAccessedProjectId = projectId;
      const result = await convexClient.createTask(projectId, text, autoGenerated);
      return {
        success: true,
        message: `📝 Added task: "${text}"`,
        task: result,
        hint: "Say things like 'done with ${text}' to auto-complete this task!"
      };
    }

    case "complete_task": {
      const { taskId } = args as { taskId: string };
      const result = await convexClient.completeTask(taskId);
      return {
        success: true,
        message: `✅ Completed: "${result.text}"`,
        task: result,
        reminder: "1% win! Keep the momentum going.",
      };
    }

    case "sync_completed_tasks": {
      const { projectId, detectedText } = args as { projectId: string; detectedText: string };
      lastAccessedProjectId = projectId;
      const result = await convexClient.syncCompletedTasks(projectId, detectedText);
      
      if (result.completed === 0) {
        return {
          scanned: result.scanned,
          completed: 0,
          message: "🤖 No matching tasks found for auto-completion.",
          hint: "Tasks are matched if your message contains the task text or phrases like 'done with', 'finished', 'completed'.",
          example: "Try: 'I finished [task name]' or 'Done with [task name]'"
        };
      }

      const completedList = result.tasks.map((t) => `  ✅ ${t.text}`).join("\n");
      
      return {
        scanned: result.scanned,
        completed: result.completed,
        message: `🤖 Auto-completed ${result.completed} task(s) based on your message!`,
        tasks: result.tasks,
        checklist: completedList,
        reminder: "📈 1% improvement detected!",
        celebration: "🎉 Great work!"
      };
    }

    case "bulk_add_tasks": {
      const { projectId, tasks } = args as { projectId: string; tasks: Array<{ text: string; autoGenerated?: boolean }> };
      lastAccessedProjectId = projectId;
      const result = await convexClient.bulkCreateTasks(projectId, tasks);
      
      const taskList = result.tasks.map((t) => `- [ ] ${t.text}`).join("\n");
      
      return {
        success: true,
        message: `📝 Created ${result.created} tasks`,
        checklist: taskList,
        tasks: result.tasks,
      };
    }

    // ============================================
    // REPORT TOOLS
    // ============================================
    case "daily_report": {
      const { projectId } = args as { projectId?: string } || {};
      
      let report;
      if (projectId) {
        // Get report for specific project
        const tasks = await convexClient.getCompletedToday(projectId);
        const project = await convexClient.getProjects().then((p) => p.find((proj) => proj._id === projectId));
        report = {
          date: new Date().toISOString().split("T")[0],
          totalCompleted: tasks.length,
          byProject: [{
            projectName: project?.name || "Unknown",
            tasks: tasks.map((t) => t.text),
            count: tasks.length
          }]
        };
      } else {
        report = await convexClient.getEveningReport();
      }
      
      if (report.totalCompleted === 0) {
        return {
          date: report.date,
          totalCompleted: 0,
          message: "📊 No tasks completed today.",
          encouragement: "Tomorrow is a new day for 1% improvements!",
          suggestion: "Use get_tasks with filter='pending' to see what's waiting for you."
        };
      }

      let formattedReport = `🏆 **Victory Lap - ${report.date}**\n\n`;
      formattedReport += `✅ **Total Completed: ${report.totalCompleted}**\n\n`;
      
      for (const project of report.byProject) {
        formattedReport += `📁 **${project.projectName}** (${project.count})\n`;
        for (const task of project.tasks) {
          formattedReport += `  ✓ ${task}\n`;
        }
        formattedReport += "\n";
      }
      
      formattedReport += "🎉 *Every 1% adds up to 100%.*";

      return {
        date: report.date,
        totalCompleted: report.totalCompleted,
        byProject: report.byProject,
        formattedReport,
        celebration: "🎉 Great job today!"
      };
    }

    case "get_project_stats": {
      const { projectId } = args as { projectId: string };
      const stats = await convexClient.getTaskStats(projectId);
      const project = await convexClient.getProjects().then((p) => p.find((proj) => proj._id === projectId));
      
      const progress = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
      const progressBar = "█".repeat(Math.round(progress / 10)) + "░".repeat(10 - Math.round(progress / 10));
      
      return {
        projectName: project?.name ?? "Unknown",
        projectGroup: project?.group,
        stats,
        summary: `${stats.completed}/${stats.total} completed (${stats.pending} pending)`,
        progress,
        progressBar: `[${progressBar}] ${progress}%`,
        status: progress === 100 ? "🎉 Complete!" : progress > 50 ? "📈 Making progress!" : "🚀 Just getting started!"
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ============================================
// PROMPT HANDLERS
// ============================================

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "super_todo_protocol",
        description: "Core operational logic for Super Todo MCP",
      },
      {
        name: "morning_sync",
        description: "Morning sync prompt for daily planning",
      },
      {
        name: "victory_lap",
        description: "Evening Victory Lap celebration prompt",
      },
      {
        name: "auto_detect_completion",
        description: "Auto-detect task completions from user messages",
      },
      {
        name: "auto_detect_project",
        description: "Auto-detect project info from workspace files",
      }
    ],
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name } = request.params;

  switch (name) {
    case "super_todo_protocol":
      return {
        messages: [
          {
            role: "system",
            content: {
              type: "text",
              text: SUPER_TODO_PROTOCOL,
            },
          },
        ],
      };
    
    case "morning_sync":
      return {
        messages: [
          {
            role: "system",
            content: {
              type: "text",
              text: "🌅 Morning Sync Mode: Review active projects and plan today's 1% wins.",
            },
          },
        ],
      };
    
    case "victory_lap":
      return {
        messages: [
          {
            role: "system",
            content: {
              type: "text",
              text: "🏆 Victory Lap Mode: Celebrate today's completed tasks and progress.",
            },
          },
        ],
      };

    case "auto_detect_completion":
      return {
        messages: [
          {
            role: "system",
            content: {
              type: "text",
              text: `🤖 Auto-Detection Mode: 
When user mentions completing work (e.g., "I finished X", "Done with Y", "Fixed Z"), 
automatically call sync_completed_tasks with their message.
Track the last accessed project for context.`,
            },
          },
        ],
      };

    case "auto_detect_project":
      return {
        messages: [
          {
            role: "system",
            content: {
              type: "text",
              text: `🔍 Project Auto-Detection Mode:
When user wants to add a project, automatically:
1. Call detect_project_context to read package.json, README.md, etc.
2. Extract project name from these files
3. Generate suggested tasks based on project type
4. Only ask user: "Is this [IMPORTANT] or [HOBBIES]?"
5. Create project with auto-detected name and auto-generate tasks`,
            },
          },
        ],
      };
    
    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
});

// ============================================
// START SERVER
// ============================================

async function main() {
  if (TRANSPORT === "sse") {
    // HTTP/SSE transport for remote connections
    const httpServer = http.createServer(async (req, res) => {
      // CORS headers for cross-origin requests
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
      }

      // Health check endpoint
      if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ 
          status: "ok", 
          server: SERVER_NAME,
          version: SERVER_VERSION,
          convex: process.env.CONVEX_URL 
        }));
        return;
      }

      // SSE endpoint for MCP
      if (req.url === "/sse") {
        const transport = new SSEServerTransport("/message", res);
        await server.connect(transport);
        
        console.error(`🛡️ Super Todo SSE connection established from ${req.socket.remoteAddress}`);
        
        // Keep connection alive
        req.on("close", () => {
          console.error("SSE connection closed");
        });
        return;
      }

      // Handle POST messages
      if (req.url === "/message" && req.method === "POST") {
        // This is handled by SSEServerTransport
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      // Default: 404
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found", endpoints: ["/health", "/sse"] }));
    });

    httpServer.listen(PORT, HOST, () => {
      console.error(`🛡️ Super Todo MCP Server running on SSE`);
      console.error(`📡 Server: http://${HOST}:${PORT}`);
      console.error(`🔗 Health: http://${HOST}:${PORT}/health`);
      console.error(`📬 SSE: http://${HOST}:${PORT}/sse`);
      console.error(`☁️  Convex: ${process.env.CONVEX_URL}`);
    });

    // Graceful shutdown
    process.on("SIGINT", () => {
      console.error("\nShutting down...");
      httpServer.close(() => {
        process.exit(0);
      });
    });

  } else {
    // Stdio transport (default) for local communication
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    // Log to stderr so it doesn't interfere with stdio protocol
    console.error("🛡️ Super Todo MCP Server running on stdio");
    console.error("📡 Connected to Convex at:", process.env.CONVEX_URL);
    console.error("📝 Session started at:", new Date().toISOString());
    
    // Handle session reload / stdin close
    process.stdin.on("end", () => {
      console.error("🔄 Stdin closed (session reload detected), shutting down gracefully...");
      process.exit(0);
    });
    
    process.stdin.on("error", (err) => {
      console.error("❌ Stdin error:", err);
      process.exit(1);
    });
    
    // Handle signals for graceful shutdown
    process.on("SIGINT", () => {
      console.error("\n🛑 SIGINT received, shutting down...");
      process.exit(0);
    });
    
    process.on("SIGTERM", () => {
      console.error("\n🛑 SIGTERM received, shutting down...");
      process.exit(0);
    });
    
    // Keep the process alive
    const keepAlive = setInterval(() => {
      // This keeps the event loop alive
    }, 10000);
    
    // Clean up on exit
    process.on("exit", () => {
      clearInterval(keepAlive);
      console.error("👋 Super Todo MCP Server exited");
    });
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
