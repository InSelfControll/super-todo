import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * 🛡️ Project Operations
 * 
 * Projects can be:
 * - Parent/Standalone: Normal projects (parentProjectId = null)
 * - Subproject: Linked to a parent (parentProjectId = parent's ID)
 * 
 * Daily sync rolls subprojects into their parent for combined notifications.
 */

// ============================================
// QUERIES
// ============================================

/**
 * Get all projects, optionally filtered by group
 * By default, returns only parent projects (not subprojects individually)
 */
export const getProjects = query({
  args: {
    group: v.optional(v.union(v.literal("important"), v.literal("hobbies"))),
    includeArchived: v.optional(v.boolean()),
    includeSubprojects: v.optional(v.boolean()), // false = only parents
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("projects");

    // Filter by group if specified
    if (args.group) {
      if (args.includeArchived) {
        query = query.withIndex("by_group", (q) => q.eq("group", args.group));
      } else {
        query = query.withIndex("by_group_status", (q) =>
          q.eq("group", args.group).eq("status", "active")
        );
      }
    } else if (!args.includeArchived) {
      query = query.withIndex("by_status", (q) => q.eq("status", "active"));
    }

    let projects = await query.order("desc").collect();

    // By default, exclude subprojects (they roll into parent notifications)
    if (!args.includeSubprojects) {
      projects = projects.filter((p) => !p.isSubproject);
    }

    return projects;
  },
});

/**
 * Get a single project by ID (with optional subprojects)
 */
export const getProject = query({
  args: { 
    projectId: v.id("projects"),
    withSubprojects: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;

    const result: any = { ...project };

    if (args.withSubprojects && !project.isSubproject) {
      const subprojects = await ctx.db
        .query("projects")
        .withIndex("by_parent", (q) => q.eq("parentProjectId", args.projectId))
        .filter((q) => q.eq(q.field("status"), "active"))
        .collect();
      result.subprojects = subprojects;
    }

    return result;
  },
});

/**
 * Get active projects (parents only by default)
 */
export const getActiveProjects = query({
  args: {
    group: v.optional(v.union(v.literal("important"), v.literal("hobbies"))),
    includeSubprojects: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("projects")
      .withIndex("by_status", (q) => q.eq("status", "active"));

    if (args.group) {
      query = query.filter((q) => q.eq(q.field("group"), args.group));
    }

    let projects = await query.order("desc").collect();

    // Default: exclude subprojects for daily sync
    if (!args.includeSubprojects) {
      projects = projects.filter((p) => !p.isSubproject);
    }

    return projects;
  },
});

/**
 * Get subprojects for a parent project
 */
export const getSubprojects = query({
  args: { parentProjectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("projects")
      .withIndex("by_parent", (q) => q.eq("parentProjectId", args.parentProjectId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();
  },
});

/**
 * Count active important projects (parents only)
 */
export const getImportantProjectCount = query({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_group_status", (q) =>
        q.eq("group", "important").eq("status", "active")
      )
      .collect();
    // Only count parent projects
    return projects.filter((p) => !p.isSubproject).length;
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Find project by name (case-insensitive)
 */
export const findProjectByName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const normalizedName = args.name.toLowerCase().trim();
    const allProjects = await ctx.db.query("projects").collect();
    const existing = allProjects.find(
      (p) => p.name.toLowerCase().trim() === normalizedName
    );
    return existing || null;
  },
});

/**
 * Create a new project (parent/standalone)
 */
export const createProject = mutation({
  args: {
    name: v.string(),
    group: v.union(v.literal("important"), v.literal("hobbies")),
    skipIfExists: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const normalizedName = args.name.trim();

    // Check for existing project with same name
    const existing = await ctx.db
      .query("projects")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .filter((q) => q.eq(q.field("name"), normalizedName))
      .first();

    if (existing) {
      if (args.skipIfExists) {
        return {
          projectId: existing._id,
          name: existing.name,
          group: existing.group,
          existing: true,
        };
      }
      throw new Error(`Project "${normalizedName}" already exists.`);
    }

    const projectId = await ctx.db.insert("projects", {
      name: normalizedName,
      group: args.group,
      status: "active",
      lastWorkedOn: Date.now(),
      parentProjectId: undefined,
      isSubproject: false,
    });

    return { projectId, name: normalizedName, group: args.group, existing: false };
  },
});

/**
 * Create a subproject linked to a parent
 * Example: Parent="DNS-Fabric", Subproject="Backend"
 * Display name becomes "DNS-Fabric / Backend"
 */
export const createSubproject = mutation({
  args: {
    parentProjectId: v.id("projects"),
    name: v.string(), // e.g., "Backend"
    group: v.optional(v.union(v.literal("important"), v.literal("hobbies"))),
    skipIfExists: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Verify parent exists
    const parent = await ctx.db.get(args.parentProjectId);
    if (!parent) {
      throw new Error(`Parent project not found: ${args.parentProjectId}`);
    }

    // Subproject inherits group from parent if not specified
    const group = args.group || parent.group;
    const subprojectName = args.name.trim();
    const fullName = `${parent.name} / ${subprojectName}`;

    // Check for existing subproject with same name under this parent
    const existing = await ctx.db
      .query("projects")
      .withIndex("by_parent", (q) => q.eq("parentProjectId", args.parentProjectId))
      .filter((q) => q.eq(q.field("name"), fullName))
      .first();

    if (existing) {
      if (args.skipIfExists) {
        return {
          projectId: existing._id,
          name: existing.name,
          parentProjectId: args.parentProjectId,
          existing: true,
        };
      }
      throw new Error(`Subproject "${fullName}" already exists.`);
    }

    const projectId = await ctx.db.insert("projects", {
      name: fullName,
      group,
      status: "active",
      lastWorkedOn: Date.now(),
      parentProjectId: args.parentProjectId,
      isSubproject: true,
    });

    // Update parent's lastWorkedOn
    await ctx.db.patch(args.parentProjectId, { lastWorkedOn: Date.now() });

    return {
      projectId,
      name: fullName,
      parentProjectId: args.parentProjectId,
      existing: false,
    };
  },
});

/**
 * Archive a project (soft delete)
 * Also archives all subprojects if parent is archived
 */
export const archiveProject = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error(`Project not found: ${args.projectId}`);
    }

    await ctx.db.patch(args.projectId, { status: "archived" });

    // If archiving a parent, also archive all subprojects
    if (!project.isSubproject) {
      const subprojects = await ctx.db
        .query("projects")
        .withIndex("by_parent", (q) => q.eq("parentProjectId", args.projectId))
        .collect();

      for (const sub of subprojects) {
        await ctx.db.patch(sub._id, { status: "archived" });
      }
    }

    return { 
      projectId: args.projectId, 
      status: "archived",
      archivedSubprojects: !project.isSubproject,
    };
  },
});

/**
 * Update the lastWorkedOn timestamp
 */
export const updateLastWorkedOn = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error(`Project not found: ${args.projectId}`);
    }

    await ctx.db.patch(args.projectId, { lastWorkedOn: Date.now() });

    // Also update parent's timestamp if this is a subproject
    if (project.parentProjectId) {
      await ctx.db.patch(project.parentProjectId, { lastWorkedOn: Date.now() });
    }

    return { projectId: args.projectId, lastWorkedOn: Date.now() };
  },
});

/**
 * Reactivate an archived project
 */
export const reactivateProject = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error(`Project not found: ${args.projectId}`);
    }

    await ctx.db.patch(args.projectId, {
      status: "active",
      lastWorkedOn: Date.now(),
    });

    return { projectId: args.projectId, status: "active" };
  },
});

/**
 * Get project tree (parent with all subprojects and their task counts)
 */
export const getProjectTree = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const parent = await ctx.db.get(args.projectId);
    if (!parent) return null;

    const subprojects = await ctx.db
      .query("projects")
      .withIndex("by_parent", (q) => q.eq("parentProjectId", args.projectId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    // Get task counts for each
    const parentTasks = await ctx.db
      .query("tasks")
      .withIndex("by_project_completion", (q) =>
        q.eq("projectId", args.projectId).eq("completed", false)
      )
      .collect();

    const subprojectData = await Promise.all(
      subprojects.map(async (sub) => {
        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_project_completion", (q) =>
            q.eq("projectId", sub._id).eq("completed", false)
          )
          .collect();
        return {
          ...sub,
          pendingCount: tasks.length,
        };
      })
    );

    const totalPending =
      parentTasks.length + subprojectData.reduce((sum, s) => sum + s.pendingCount, 0);

    return {
      parent: {
        ...parent,
        pendingCount: parentTasks.length,
      },
      subprojects: subprojectData,
      totalPending,
    };
  },
});
