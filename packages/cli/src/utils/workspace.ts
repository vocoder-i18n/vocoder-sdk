import * as p from '@clack/prompts';
import chalk from 'chalk';

export interface WorkspaceInfo {
  id: string;
  name: string;
  planId: string;
  projectCount: number;
  hasGitHubConnection: boolean;
  connectionLabel: string | null;
}

export interface WorkspaceListResult {
  workspaces: WorkspaceInfo[];
  canCreateWorkspace: boolean;
}

export type WorkspaceSelection =
  | { action: 'use'; workspace: WorkspaceInfo }
  | { action: 'create' }
  | { action: 'cancelled' };

function workspaceLabel(ws: WorkspaceInfo): string {
  const parts: string[] = [ws.name];
  const meta: string[] = [];

  if (ws.projectCount === 1) {
    meta.push('1 project');
  } else if (ws.projectCount > 1) {
    meta.push(`${ws.projectCount} projects`);
  }

  if (ws.connectionLabel) {
    meta.push(`GitHub: ${ws.connectionLabel}`);
  }

  if (meta.length > 0) {
    parts.push(chalk.dim(`(${meta.join(', ')})`));
  }

  return parts.join(' ');
}

/**
 * Prompt the user to select a workspace or create a new one.
 * Returns a `WorkspaceSelection` describing what the user chose.
 */
export async function selectWorkspace(
  result: WorkspaceListResult,
): Promise<WorkspaceSelection> {
  const { workspaces, canCreateWorkspace } = result;

  if (workspaces.length === 0) {
    // No workspaces — must create
    return { action: 'create' };
  }

  type SelectValue = string | 'create';

  const options: Array<{ value: SelectValue; label: string; hint?: string }> =
    workspaces.map((ws) => ({
      value: ws.id,
      label: ws.name,
      hint:
        [
          ws.projectCount > 0 ? `${ws.projectCount} project${ws.projectCount !== 1 ? 's' : ''}` : '',
          ws.connectionLabel ? `GitHub: ${ws.connectionLabel}` : '',
        ]
          .filter(Boolean)
          .join(' · ') || undefined,
    }));

  if (canCreateWorkspace) {
    options.push({ value: 'create', label: 'Create new workspace' });
  }

  const selected = await p.select<SelectValue>({
    message: 'Select workspace',
    options,
  });

  if (p.isCancel(selected)) {
    return { action: 'cancelled' };
  }

  if (selected === 'create') {
    return { action: 'create' };
  }

  const workspace = workspaces.find((ws) => ws.id === selected);
  if (!workspace) {
    return { action: 'cancelled' };
  }

  return { action: 'use', workspace };
}
