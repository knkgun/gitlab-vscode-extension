import * as vscode from 'vscode';
import { ProjectSchema, PipelineSchema, JobSchema } from 'gitlab';
import * as openers from '../actions/openers';
import * as gitLabService from '../services/gitlab_service';
import * as gitLab from '../types/gitlab';
import { gitlabOutputChannel } from '../extension';

let context: vscode.ExtensionContext;
let pipelineStatusBarItem: vscode.StatusBarItem;
let pipelinesStatusTimer: NodeJS.Timeout | null = null;
let mrStatusBarItem: vscode.StatusBarItem;
let mrIssueStatusBarItem: vscode.StatusBarItem;
let issue: gitLab.Issuable;
let mr: gitLab.Issuable | null;
let firstRun = true;
const {
  showStatusBarLinks,
  showIssueLinkOnStatusBar,
  showMrStatusOnStatusBar,
  showPipelineUpdateNotifications,
} = vscode.workspace.getConfiguration('gitlab');

const createStatusBarItem = (text: string, command: string): vscode.StatusBarItem => {
  const statusBarItem: vscode.StatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
  );
  context.subscriptions.push(statusBarItem);
  statusBarItem.text = text;
  statusBarItem.show();

  if (command) {
    statusBarItem.command = command;
  }

  return statusBarItem;
};

const commandRegisterHelper = (cmdName: string, callback: () => void): void => {
  vscode.commands.registerCommand(cmdName, callback);
};

export async function refreshPipeline(): Promise<void> {
  const editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
  let workspaceFolder: string | undefined;
  let project: ProjectSchema | null = null;
  let pipeline: PipelineSchema | null = null;
  const maxJobs = 4;

  try {
    if (editor?.document?.uri) {
      workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri)?.uri?.fsPath;
      if (workspaceFolder) {
        project = await gitLabService.fetchCurrentPipelineProject(workspaceFolder);
        if (project != null) {
          pipeline = await gitLabService.fetchLastPipelineForCurrentBranch(workspaceFolder);
        } else {
          pipelineStatusBarItem.hide();
        }
      }
    }
  } catch (ex) {
    gitlabOutputChannel.appendLine(
      `ERROR: Failed to refresh pipeline ${ex.name} - ${ex.message}\n${ex.stack}`,
    );
    if (!project) {
      pipelineStatusBarItem.hide();
      return;
    }
  }

  if (pipeline) {
    const { status } = pipeline;
    let statusText: string;
    if (status === 'success') {
      statusText = 'passed';
    } else {
      statusText = status;
    }

    if (status === 'running' || status === 'failed') {
      try {
        let jobs: JobSchema[] | null = null;
        if (workspaceFolder) {
          jobs = await gitLabService.fetchLastJobsForCurrentBranch(pipeline, workspaceFolder);
        }
        if (jobs) {
          const jobsName: string[] = jobs.filter(job => job.status === status).map(job => job.name);
          if (jobsName.length > maxJobs) {
            statusText += ' (';
            statusText += jobsName.slice(0, maxJobs).join(', ');
            statusText += `, +${jobsName.length - maxJobs} jobs`;
            statusText += ')';
          } else {
            statusText += ` (${jobsName.join(', ')})`;
          }
        }
      } catch (ex) {
        gitlabOutputChannel.appendLine(
          `ERROR:  Failed to fetch jobs for pipeline ${ex.name} - ${ex.message}\n${ex.stack}`,
        );
        vscode.window.showErrorMessage(`GitLab Workflow: Failed to fetch jobs for pipeline.`);
      }
    }

    let icon: string;
    switch (status) {
      case 'running':
        icon = 'pulse';
        break;
      case 'pending':
        icon = 'clock';
        break;
      case 'failed':
        icon = 'x';
        break;
      case 'canceled':
        icon = 'circle-slash';
        break;
      case 'skipped':
        icon = 'diff-renamed';
        break;
      case 'success':
      default:
        icon = 'check';
    }

    const msg = `$(${icon}) GitLab: Pipeline ${statusText}`;

    if (showPipelineUpdateNotifications && pipelineStatusBarItem.text !== msg && !firstRun) {
      const message = `Pipeline ${statusText}.`;

      const selection: string | undefined = await vscode.window.showInformationMessage(
        message,
        { modal: false },
        'View in Gitlab',
      );
      if (selection === 'View in Gitlab' && workspaceFolder) {
        openers.openCurrentPipeline(workspaceFolder);
      }
    }

    pipelineStatusBarItem.text = msg;
    pipelineStatusBarItem.show();
  } else {
    pipelineStatusBarItem.text = 'GitLab: No pipeline.';
  }
  firstRun = false;
}

const initPipelineStatus = (): void => {
  pipelineStatusBarItem = createStatusBarItem(
    '$(info) GitLab: Fetching pipeline...',
    'gl.pipelineActions',
  );

  const { pipelineStatusTimeout } = vscode.workspace.getConfiguration('gitlab');

  pipelinesStatusTimer = setInterval(() => {
    refreshPipeline();
  }, pipelineStatusTimeout);

  refreshPipeline();
};

async function fetchMRIssues(workspaceFolder: string) {
  let issues: gitLab.Issuable[] = [];
  if (mr && mr.iid) {
    issues = await gitLabService.fetchMRIssues(mr.iid, workspaceFolder);
  }
  let text = `$(code) GitLab: No issue.`;

  if (issues[0]) {
    [issue] = issues;
    text = `$(code) GitLab: Issue #${issue.iid}`;
  }

  mrIssueStatusBarItem.text = text;
}

async function fetchBranchMR(): Promise<void> {
  const editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
  let text = '$(git-pull-request) GitLab: No MR.';
  let workspaceFolder: string | undefined;
  let project: ProjectSchema | null = null;

  try {
    if (editor?.document?.uri) {
      workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri)?.uri?.fsPath;
      if (workspaceFolder) {
        project = await gitLabService.fetchCurrentProject(workspaceFolder);
        if (project) {
          mr = await gitLabService.fetchOpenMergeRequestForCurrentBranch(workspaceFolder);
          mrStatusBarItem.show();
        } else {
          mrStatusBarItem.hide();
        }
      }
    }
  } catch (ex) {
    gitlabOutputChannel.appendLine(
      `ERROR:  Failed to fetch MR for current Branch ${ex.name} - ${ex.message}\n${ex.stack}`,
    );
    mrStatusBarItem.hide();
  }

  if (project && mr && workspaceFolder) {
    text = `$(git-pull-request) GitLab: MR !${mr.iid}`;
    fetchMRIssues(workspaceFolder);
    mrIssueStatusBarItem.show();
  } else if (project) {
    mrIssueStatusBarItem.text = `$(code) GitLab: No issue.`;
    mrIssueStatusBarItem.show();
  } else {
    mrIssueStatusBarItem.hide();
  }

  mrStatusBarItem.text = text;
}

const initMrStatus = (): void => {
  const cmdName = `gl.mrOpener${Date.now()}`;
  commandRegisterHelper(cmdName, () => {
    if (mr && mr.web_url) {
      openers.openUrl(mr.web_url);
    } else {
      vscode.window.showInformationMessage('GitLab Workflow: No MR found for this branch.');
    }
  });

  mrStatusBarItem = createStatusBarItem('$(info) GitLab: Finding MR...', cmdName);

  fetchBranchMR();
};

const initMrIssueStatus = (): void => {
  const cmdName = `gl.mrIssueOpener${Date.now()}`;
  commandRegisterHelper(cmdName, () => {
    if (issue && issue.web_url) {
      openers.openUrl(issue.web_url);
    } else {
      vscode.window.showInformationMessage('GitLab Workflow: No closing issue found for this MR.');
    }
  });

  mrIssueStatusBarItem = createStatusBarItem('$(info) GitLab: Fetching closing issue...', cmdName);
};

export const init = (ctx: vscode.ExtensionContext): void => {
  context = ctx;

  if (showStatusBarLinks) {
    initPipelineStatus();

    if (showIssueLinkOnStatusBar) {
      initMrIssueStatus();
    }
    if (showMrStatusOnStatusBar) {
      initMrStatus();
    }
  }
};

export const dispose = (): void => {
  mrStatusBarItem.dispose();
  pipelineStatusBarItem.dispose();
  if (showIssueLinkOnStatusBar) {
    mrIssueStatusBarItem.dispose();
  }

  if (pipelinesStatusTimer) {
    clearInterval(pipelinesStatusTimer);
    pipelinesStatusTimer = null;
  }
};

export const refresh = (): void => {
  if (showStatusBarLinks) {
    if (showIssueLinkOnStatusBar || showMrStatusOnStatusBar) {
      fetchBranchMR();
    }
  }
};
