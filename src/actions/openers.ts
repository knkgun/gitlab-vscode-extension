import * as vscode from 'vscode';
import { UserSchema, ProjectSchema, PipelineSchema } from 'gitlab';
import * as gitService from '../services/git_service';
import * as gitLabService from '../services/gitlab_service';
import * as gitLab from '../types/gitlab';
import { gitlabOutputChannel } from '../extension';

export const openUrl = (url: string): void => {
  vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url));
};

/**
 * Fetches user and project before opening a link.
 * Link can contain some placeholders which will be replaced by this method
 * with relevant information. Implemented placeholders below.
 *
 * $projectUrl
 * $userId
 *
 * An example link is `$projectUrl/issues?assignee_id=$userId` which will be
 * `gitlab.com/gitlab-org/gitlab-ce/issues?assignee_id=502136`.
 *
 * @param {string} link
 */
async function openLink(link: string, workspaceFolder: string) {
  const user: UserSchema | null = await gitLabService.fetchUser();

  if (user) {
    const project: ProjectSchema | null = await gitLabService.fetchCurrentProject(workspaceFolder);

    if (project) {
      openUrl(link.replace('$userId', user.id.toString()).replace('$projectUrl', project.web_url));
    } else {
      vscode.window.showInformationMessage(
        'GitLab Workflow: Failed to open file on web. No GitLab project.',
      );
    }
  } else {
    vscode.window.showInformationMessage(
      'GitLab Workflow: GitLab user not found. Check your Personal Access Token.',
    );
  }
}

export async function showIssues(): Promise<void> {
  const workspaceFolder: string | null = await gitLabService.getCurrentWorkspaceFolderOrSelectOne();
  if (workspaceFolder) {
    openLink('$projectUrl/issues?assignee_id=$userId', workspaceFolder);
    return;
  }
  vscode.window.showInformationMessage('GitLab Workflow: Failed to open file on web.');
}

export async function showMergeRequests(): Promise<void> {
  const workspaceFolder: string | null = await gitLabService.getCurrentWorkspaceFolderOrSelectOne();
  if (workspaceFolder) {
    openLink('$projectUrl/merge_requests?assignee_id=$userId', workspaceFolder);
    return;
  }
  vscode.window.showInformationMessage('GitLab Workflow: Failed to open file on web.');
}

export async function openActiveFile(): Promise<void> {
  const editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;

  if (editor) {
    const workspaceFolder: string | undefined = vscode.workspace.getWorkspaceFolder(
      editor.document.uri,
    )?.uri?.fsPath;
    if (workspaceFolder) {
      const currentProject: ProjectSchema | null = await gitLabService.fetchCurrentProject(
        workspaceFolder,
      );

      if (currentProject) {
        const branchName: string | null = await gitService.fetchTrackingBranchName(workspaceFolder);
        const filePath: string = editor.document.uri.path.replace(`${workspaceFolder}/`, '');
        const fileUrl = `${currentProject.web_url}/blob/${branchName}/${filePath}`;
        let anchor = '';

        if (editor.selection) {
          const { start, end } = editor.selection;
          anchor = `#L${start.line + 1}`;

          if (end.line > start.line) {
            anchor += `-${end.line + 1}`;
          }
        }

        openUrl(`${fileUrl}${anchor}`);
        return;
      }
    }
  }
  vscode.window.showInformationMessage('GitLab Workflow: Failed to open file on web.');
}

export async function openCurrentMergeRequest(): Promise<void> {
  const workspaceFolder: string | null = await gitLabService.getCurrentWorkspaceFolderOrSelectOne();
  if (workspaceFolder) {
    const mr: gitLab.Issuable | null = await gitLabService.fetchOpenMergeRequestForCurrentBranch(
      workspaceFolder,
    );

    if (mr && mr.web_url) {
      openUrl(mr.web_url);
      return;
    }
  }
  vscode.window.showInformationMessage('GitLab Workflow: Failed to open file on web.');
}

export async function openCreateNewIssue(): Promise<void> {
  const workspaceFolder: string | null = await gitLabService.getCurrentWorkspaceFolderOrSelectOne();
  if (workspaceFolder) {
    openLink('$projectUrl/issues/new', workspaceFolder);
    return;
  }
  vscode.window.showInformationMessage('GitLab Workflow: Failed to open file on web.');
}

export async function openCreateNewMr(): Promise<void> {
  const workspaceFolder: string | null = await gitLabService.getCurrentWorkspaceFolderOrSelectOne();

  if (workspaceFolder) {
    const project: ProjectSchema | null = await gitLabService.fetchCurrentProject(workspaceFolder);
    const branchName: string | null = await gitService.fetchTrackingBranchName(workspaceFolder);

    if (project && branchName) {
      openUrl(
        `${project.web_url}/merge_requests/new?merge_request%5Bsource_branch%5D=${branchName}`,
      );
      return;
    }
  }
  vscode.window.showInformationMessage(
    'GitLab Workflow: Failed to open file on web. No GitLab project.',
  );
}

export async function openProjectPage(): Promise<void> {
  const workspaceFolder: string | null = await gitLabService.getCurrentWorkspaceFolderOrSelectOne();
  if (workspaceFolder) {
    openLink('$projectUrl', workspaceFolder);
  }
  vscode.window.showInformationMessage(
    'GitLab Workflow: Failed to open file on web. No GitLab project.',
  );
}

export async function openCurrentPipeline(workspaceFolder: string | null = null): Promise<void> {
  let workspace: string | null = workspaceFolder;
  if (!workspace) {
    workspace = await gitLabService.getCurrentWorkspaceFolderOrSelectOne();
  }
  if (workspace) {
    const project: ProjectSchema | null = await gitLabService.fetchCurrentPipelineProject(
      workspace,
    );

    if (project) {
      const pipeline: PipelineSchema | null = await gitLabService.fetchLastPipelineForCurrentBranch(
        workspace,
      );

      if (pipeline) {
        openUrl(`${project.web_url}/pipelines/${pipeline.id}`);
        return;
      }
    }
  }
  vscode.window.showInformationMessage('GitLab Workflow: Failed to open file on web.');
}

export async function compareCurrentBranch(): Promise<void> {
  let project: ProjectSchema | null = null;
  let lastCommitId: string | null = null;
  const workspaceFolder: string | null = await gitLabService.getCurrentWorkspaceFolderOrSelectOne();

  try {
    if (workspaceFolder) {
      project = await gitLabService.fetchCurrentProject(workspaceFolder);
      lastCommitId = gitService.fetchLastCommitId(workspaceFolder);
    }
  } catch (ex) {
    gitlabOutputChannel.appendLine(
      `ERROR: Failed to run compareCurrentBranch command ${ex.name} - ${ex.message}\n${ex.stack}`,
    );
  }

  if (project && lastCommitId) {
    openUrl(`${project.web_url}/compare/master...${lastCommitId}`);
    return;
  }
  vscode.window.showInformationMessage('GitLab Workflow: Failed to open file on web.');
}
