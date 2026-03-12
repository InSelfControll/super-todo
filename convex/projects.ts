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
// DUPLICATE DETECTION & FIX
// ============================================

/**
 * Find duplicate projects (same name, different groups)
 * Returns groups of projects with the same name
 */
export const findDuplicateProjects = query({
  args: {},
  handler: async (ctx) => {
    const allProjects = await ctx.db
      .query("projects")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    // Group by normalized name
    const byName = new Map<string, typeof allProjects>();
    
    for (const project of allProjects) {
      const normalizedName = project.name.toLowerCase().trim();
      if (!byName.has(normalizedName)) {
        byName.set(normalizedName, []);
      }
      byName.get(normalizedName)!.push(project);
    }

    // Find duplicates (same name, multiple entries)
    const duplicates = Array.from(byName.entries())
      .filter(([_, projects]) => projects.length > 1)
      .map(([name, projects]) => ({
        normalizedName: name,
        projects: projects.map((p) => ({
          id: p._id,
          name: p.name,
          group: p.group,
          isSubproject: p.isSubproject,
          taskCount: 0, // Will be filled below
        })),
        count: projects.length,
      }));

    // Get task counts for each duplicate
    for (const dup of duplicates) {
      for (const proj of dup.projects) {
        const tasks = await ctx.db
          .query("inProgressTasks")
          .withIndex("by_project", (q) => q.eq("projectId", proj.id))
          .collect();
        proj.taskCount = tasks.length;
      }
    }

    return {
      totalDuplicates: duplicates.length,
      duplicates,
    };
  },
});

/**
 * Merge duplicate projects - keeps the "important" one, migrates tasks, archives others
 */
export const mergeDuplicateProjects = mutation({
  args: {
    keepProjectId: v.id("projects"),
    archiveProjectIds: v.array(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const keepProject = await ctx.db.get(args.keepProjectId);
    if (!keepProject) {
      throw new Error(`Keep project not found: ${args.keepProjectId}`);
    }

    let migratedTasks = 0;
    let archivedProjects = 0;

    for (const archiveId of args.archiveProjectIds) {
      if (archiveId === args.keepProjectId) continue;

      const archiveProject = await ctx.db.get(archiveId);
      if (!archiveProject) continue;

      // Migrate all tasks from archive project to keep project
      const tasks = await ctx.db
        .query("inProgressTasks")
        .withIndex("by_project", (q) => q.eq("projectId", archiveId))
        .collect();

      for (const task of tasks) {
        await ctx.db.patch(task._id, { projectId: args.keepProjectId });
        migratedTasks++;
      }

      // Archive the duplicate project
      await ctx.db.patch(archiveId, { status: "archived" });
      archivedProjects++;
    }

    // Update lastWorkedOn on the kept project
    await ctx.db.patch(args.keepProjectId, { lastWorkedOn: Date.now() });

    return {
      keptProject: {
        id: keepProject._id,
        name: keepProject.name,
        group: keepProject.group,
      },
      archivedProjects,
      migratedTasks,
    };
  },
});

/**
 * Auto-fix all duplicate projects - keeps the one with most tasks
 * If tied, prefers "important" over "hobbies"
 */
export const autoFixDuplicateProjects = mutation({
  args: {
    dryRun: v.optional(v.boolean()), // if true, only shows what would be done
    preferImportant: v.optional(v.boolean()), // if true, prioritize important even with fewer tasks
  },
  handler: async (ctx, args) => {
    const preferImportant = args.preferImportant ?? false;
    const { duplicates } = await ctx.runQuery(
      // @ts-ignore - internal query
      "projects:findDuplicateProjects",
      {}
    );

    const results = [];

    for (const dup of duplicates) {
      // Sort projects: by task count first, then by group preference
      const sorted = [...dup.projects].sort((a, b) => {
        // If task counts are significantly different (more than 5), prefer the one with more tasks
        if (Math.abs(b.taskCount - a.taskCount) > 5) {
          return b.taskCount - a.taskCount;
        }
        // If counts are close, use group preference if enabled
        if (preferImportant) {
          if (a.group === "important" && b.group !== "important") return -1;
          if (a.group !== "important" && b.group === "important") return 1;
        }
        return b.taskCount - a.taskCount;
      });

      const keep = sorted[0];
      const archive = sorted.slice(1);

      if (args.dryRun) {
        results.push({
          action: "would_merge",
          keep: { id: keep.id, name: keep.name, group: keep.group, taskCount: keep.taskCount },
          archive: archive.map((p) => ({ id: p.id, name: p.name, group: p.group, taskCount: p.taskCount })),
          reason: `"${keep.name}" kept as ${keep.group} (${keep.taskCount} tasks)`,
        });
      } else {
        // If we're keeping a "hobbies" project but there's an "important" one, upgrade it
        if (keep.group === "hobbies" && archive.some((p) => p.group === "important")) {
          await ctx.db.patch(keep.id, { group: "important" });
        }
        
        const result = await ctx.runMutation("projects:mergeDuplicateProjects", {
          keepProjectId: keep.id,
          archiveProjectIds: archive.map((p) => p.id),
        });
        results.push({
          action: "merged",
          upgradedToImportant: keep.group === "hobbies" && archive.some((p) => p.group === "important"),
          ...result,
        });
      }
    }

    return {
      dryRun: args.dryRun ?? false,
      fixed: results.length,
      results,
    };
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
 * Permanently delete a project and all its tasks
 * Also deletes all subprojects and their tasks if parent
 */
export const deleteProject = mutation({
  args: { 
    projectId: v.id("projects"),
    confirm: v.boolean(), // safety check
  },
  handler: async (ctx, args) => {
    if (!args.confirm) {
      throw new Error("Must set confirm: true to permanently delete project");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error(`Project not found: ${args.projectId}`);
    }

    let deletedTasks = 0;
    let deletedSubprojects = 0;

    // If this is a parent project, delete all subprojects and their tasks
    if (!project.isSubproject) {
      const subprojects = await ctx.db
        .query("projects")
        .withIndex("by_parent", (q) => q.eq("parentProjectId", args.projectId))
        .collect();

      for (const sub of subprojects) {
        // Delete all tasks for this subproject
        const subTasks = await ctx.db
          .query("inProgressTasks")
          .withIndex("by_project", (q) => q.eq("projectId", sub._id))
          .collect();
        
        for (const task of subTasks) {
          await ctx.db.delete(task._id);
          deletedTasks++;
        }

        // Delete the subproject
        await ctx.db.delete(sub._id);
        deletedSubprojects++;
      }
    }

    // Delete all tasks for this project
    const tasks = await ctx.db
      .query("inProgressTasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    
    for (const task of tasks) {
      await ctx.db.delete(task._id);
      deletedTasks++;
    }

    // Delete the project itself
    await ctx.db.delete(args.projectId);

    return {
      deletedProject: {
        id: args.projectId,
        name: project.name,
        wasSubproject: project.isSubproject,
      },
      deletedTasks,
      deletedSubprojects,
      totalDeleted: 1 + deletedSubprojects + deletedTasks,
    };
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
      .query("inProgressTasks")
      .withIndex("by_project", (q) =>
        q.eq("projectId", args.projectId).eq("completed", false)
      )
      .collect();

    const subprojectData = await Promise.all(
      subprojects.map(async (sub) => {
        const tasks = await ctx.db
          .query("inProgressTasks")
          .withIndex("by_project", (q) =>
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
