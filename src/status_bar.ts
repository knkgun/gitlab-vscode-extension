/* eslint-disable no-unused-expressions */
import * as vscode from 'vscode';
import * as openers from './openers';
import * as gitLabService from './gitlab_service';
import { getCurrentWorkspaceFolder } from './services/workspace_service';
import { UserFriendlyError } from './errors/user_friendly_error';
import { logError } from './log';
import { USER_COMMANDS } from './command_names';

const MAXIMUM_DISPLAYED_JOBS = 4;

// FIXME: if you are touching this configuration statement, move the configuration to get_extension_configuration.ts
const {
  showStatusBarLinks,
  showIssueLinkOnStatusBar,
  showMrStatusOnStatusBar,
  showPipelineUpdateNotifications,
} = vscode.workspace.getConfiguration('gitlab');

const iconForStatus: Record<string, { icon: string; text?: string } | undefined> = {
  running: { icon: 'pulse' },
  pending: { icon: 'clock' },
  success: { icon: 'check', text: 'passed' },
  failed: { icon: 'x' },
  canceled: { icon: 'circle-slash' },
  skipped: { icon: 'diff-renamed' },
};

const getStatusText = (status: string) => iconForStatus[status]?.text || status;

const createStatusTextFromJobs = (jobs: gitLabService.RestJob[], status: string) => {
  let statusText = getStatusText(status);
  const jobNames = jobs.filter(job => job.status === status).map(job => job.name);
  if (jobNames.length > MAXIMUM_DISPLAYED_JOBS) {
    statusText += ' (';
    statusText += jobNames.slice(0, MAXIMUM_DISPLAYED_JOBS).join(', ');
    statusText += `, +${jobNames.length - MAXIMUM_DISPLAYED_JOBS} jobs`;
    statusText += ')';
  } else if (jobNames.length > 0) {
    statusText += ` (${jobNames.join(', ')})`;
  }
  return statusText;
};

const createStatusBarItem = (text: string, command: string) => {
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  statusBarItem.text = text;
  statusBarItem.show();

  if (command) {
    statusBarItem.command = command;
  }

  return statusBarItem;
};

const commandRegisterHelper = (cmdName: string, callback: (...args: any[]) => any) => {
  vscode.commands.registerCommand(cmdName, callback);
};

export class StatusBar {
  pipelineStatusBarItem?: vscode.StatusBarItem;

  pipelinesStatusTimer?: NodeJS.Timeout;

  mrStatusBarItem?: vscode.StatusBarItem;

  mrIssueStatusBarItem?: vscode.StatusBarItem;

  mrStatusTimer?: NodeJS.Timeout;

  issue?: RestIssuable;

  mr?: RestIssuable;

  firstRun = true;

  async refreshPipeline() {
    if (!this.pipelineStatusBarItem) return;
    let workspaceFolder: string | undefined;
    let pipeline = null;

    try {
      workspaceFolder = await getCurrentWorkspaceFolder();
      const result = await gitLabService.fetchPipelineAndMrForCurrentBranch(workspaceFolder!);
      // TODO: the result contains the MR for this branch as well, we can refactor status_bar
      // to use this response instead of making a separate request.
      pipeline = result.pipeline;
    } catch (e) {
      logError(e);
      this.pipelineStatusBarItem.hide();
      return;
    }
    if (!pipeline) {
      this.pipelineStatusBarItem.text = 'GitLab: No pipeline.';
      this.pipelineStatusBarItem.show();
      this.firstRun = false;
      return;
    }
    const { status } = pipeline;
    let statusText = getStatusText(status);

    if (status === 'running' || status === 'failed') {
      try {
        const jobs = await gitLabService.fetchLastJobsForCurrentBranch(pipeline, workspaceFolder!);
        if (jobs) {
          statusText = createStatusTextFromJobs(jobs, status);
        }
      } catch (e) {
        logError(new UserFriendlyError('Failed to fetch jobs for pipeline.', e));
      }
    }

    const msg = `$(${iconForStatus[status]?.icon}) GitLab: Pipeline ${statusText}`;

    if (
      showPipelineUpdateNotifications &&
      this.pipelineStatusBarItem.text !== msg &&
      !this.firstRun
    ) {
      const message = `Pipeline ${statusText}.`;

      vscode.window
        .showInformationMessage(message, { modal: false }, 'View in Gitlab')
        .then(selection => {
          if (selection === 'View in Gitlab') {
            openers.openCurrentPipeline(workspaceFolder!);
          }
        });
    }

    this.pipelineStatusBarItem.text = msg;
    this.pipelineStatusBarItem.show();
    this.firstRun = false;
  }

  async initPipelineStatus() {
    this.pipelineStatusBarItem = createStatusBarItem(
      '$(info) GitLab: Fetching pipeline...',
      USER_COMMANDS.PIPELINE_ACTIONS,
    );

    this.pipelinesStatusTimer = setInterval(() => {
      this.refreshPipeline();
    }, 30000);

    await this.refreshPipeline();
  }

  async fetchMRIssues(workspaceFolder: string) {
    if (!this.mrIssueStatusBarItem || !this.mr) return;
    const issues = await gitLabService.fetchMRIssues(this.mr.iid, workspaceFolder);
    let text = `$(code) GitLab: No issue.`;

    if (issues[0]) {
      [this.issue] = issues;
      text = `$(code) GitLab: Issue #${this.issue.iid}`;
    }

    this.mrIssueStatusBarItem.text = text;
  }

  async fetchBranchMR() {
    if (!this.mrIssueStatusBarItem || !this.mrStatusBarItem) return;
    let text = '$(git-pull-request) GitLab: Create MR.';
    let workspaceFolder = null;
    let project = null;

    try {
      workspaceFolder = await getCurrentWorkspaceFolder();
      project = await gitLabService.fetchCurrentProject(workspaceFolder!);
      if (project != null) {
        this.mr =
          (await gitLabService.fetchOpenMergeRequestForCurrentBranch(workspaceFolder!)) ??
          undefined;
        this.mrStatusBarItem.show();
      } else {
        this.mrStatusBarItem.hide();
      }
    } catch (e) {
      logError(e);
      this.mrStatusBarItem.hide();
    }

    if (project && this.mr) {
      text = `$(git-pull-request) GitLab: MR !${this.mr.iid}`;
      await this.fetchMRIssues(workspaceFolder!);
      this.mrIssueStatusBarItem.show();
    } else if (project) {
      this.mrIssueStatusBarItem.text = `$(code) GitLab: No issue.`;
      this.mrIssueStatusBarItem.show();
    } else {
      this.mrIssueStatusBarItem.hide();
    }

    this.mrStatusBarItem.text = text;
  }

  async initMrStatus() {
    const cmdName = `gl.mrOpener${Date.now()}`;
    commandRegisterHelper(cmdName, () => {
      if (this.mr) {
        openers.openUrl(this.mr.web_url);
      } else {
        openers.openCreateNewMr();
      }
    });

    this.mrStatusBarItem = createStatusBarItem('$(info) GitLab: Finding MR...', cmdName);
    this.mrStatusTimer = setInterval(() => {
      this.fetchBranchMR();
    }, 60000);

    await this.fetchBranchMR();
  }

  initMrIssueStatus() {
    const cmdName = `gl.mrIssueOpener${Date.now()}`;
    commandRegisterHelper(cmdName, () => {
      if (this.issue) {
        openers.openUrl(this.issue.web_url);
      } else {
        vscode.window.showInformationMessage(
          'GitLab Workflow: No closing issue found for this MR.',
        );
      }
    });

    this.mrIssueStatusBarItem = createStatusBarItem(
      '$(info) GitLab: Fetching closing issue...',
      cmdName,
    );
  }

  async init() {
    if (showStatusBarLinks) {
      await this.initPipelineStatus();

      // FIXME: add showMrStatusOnStatusBar to the condition
      // because the initMrStatus() method does all the fetching and initMrIssueStatus
      // only introduces a placeholder item
      if (showIssueLinkOnStatusBar) {
        this.initMrIssueStatus();
      }
      if (showMrStatusOnStatusBar) {
        await this.initMrStatus();
      }
    }
  }

  dispose() {
    if (showStatusBarLinks) {
      this.pipelineStatusBarItem?.dispose();

      if (showIssueLinkOnStatusBar) {
        this.mrIssueStatusBarItem?.dispose();
      }
      if (showMrStatusOnStatusBar) {
        this.mrStatusBarItem?.dispose();
      }
    }

    if (this.pipelinesStatusTimer) {
      clearInterval(this.pipelinesStatusTimer);
      this.pipelinesStatusTimer = undefined;
    }

    if (this.mrStatusTimer) {
      clearInterval(this.mrStatusTimer);
      this.mrStatusTimer = undefined;
    }
  }
}

export const instance = new StatusBar();
