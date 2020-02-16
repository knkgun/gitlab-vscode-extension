import * as vscode from 'vscode';
import { OutputChannel } from 'vscode';
import * as openers from './actions/openers';
import * as tokenInput from './inputs/token_input';
import * as tokenService from './services/token_service';
import * as gitService from './services/git_service';
import * as pipelineActionsInput from './inputs/pipeline_actions_input';
import * as searchInput from './inputs/search_input';
import * as snippetInput from './inputs/snippet_input';
import * as sidebar from './ui/sidebar';
import * as ciConfigValidator from './actions/ci_config_validator';
import * as webviewController from './ui/webview_controller';
import { IssuableDataProvider } from './data_providers/issuable';
import { CurrentBranchDataProvider } from './data_providers/current_branch';
import { GitlabDataProvider } from './data_providers/gitlab_data_provider';

export const gitlabOutputChannel: OutputChannel = vscode.window.createOutputChannel('GitLab');

const registerSidebarTreeDataProviders = (): void => {
  gitlabOutputChannel.appendLine('INFO: Registering Data Providers...');
  const issuableDataProvider = new IssuableDataProvider();

  const currentBranchDataProvider = new CurrentBranchDataProvider();

  const register = (name: string, provider: GitlabDataProvider) => {
    vscode.window.registerTreeDataProvider(name, provider);
    sidebar.addDataProvider(provider);
  };

  register('issuesAndMrs', issuableDataProvider);
  register('currentBranchInfo', currentBranchDataProvider);
  gitlabOutputChannel.appendLine('INFO: Data Providers registered.');
};

const registerCommands = (context: vscode.ExtensionContext): void => {
  gitlabOutputChannel.appendLine('INFO: Registering commands...');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const commands: Map<string, (...args: any) => Promise<void> | void> = new Map<
    string,
    () => Promise<void> | void
  >();

  commands.set('gl.showIssuesAssignedToMe', openers.showIssues);
  commands.set('gl.showMergeRequestsAssignedToMe', openers.showMergeRequests);
  commands.set('gl.setToken', tokenInput.showInput);
  commands.set('gl.removeToken', tokenInput.removeTokenPicker);
  commands.set('gl.openActiveFile', openers.openActiveFile);
  commands.set('gl.openCurrentMergeRequest', openers.openCurrentMergeRequest);
  commands.set('gl.openCreateNewIssue', openers.openCreateNewIssue);
  commands.set('gl.openCreateNewMR', openers.openCreateNewMr);
  commands.set('gl.openProjectPage', openers.openProjectPage);
  commands.set('gl.openCurrentPipeline', openers.openCurrentPipeline);
  commands.set('gl.pipelineActions', pipelineActionsInput.showPicker);
  commands.set('gl.issueSearch', searchInput.showIssueSearchInput);
  commands.set('gl.mergeRequestSearch', searchInput.showMergeRequestSearchInput);
  commands.set('gl.compareCurrentBranch', openers.compareCurrentBranch);
  commands.set('gl.createSnippet', snippetInput.showPicker);
  commands.set('gl.validateCIConfig', ciConfigValidator.validate);
  commands.set('gl.refreshSidebar', sidebar.refresh);
  commands.set('gl.showRichContent', webviewController.create);

  commands.forEach((command: () => void, commandName: string) => {
    context.subscriptions.push(vscode.commands.registerCommand(commandName, command));
  });

  registerSidebarTreeDataProviders();
  gitlabOutputChannel.appendLine('INFO: Commands registered.');
};

const init = (context: vscode.ExtensionContext): void => {
  gitlabOutputChannel.appendLine('INFO: Inizializing extension...');
  webviewController.addDeps(context);
  tokenService.init(context);
  gitService.init();
   gitlabOutputChannel.appendLine('INFO: Extension initialized.');
};

export function activate(context: vscode.ExtensionContext): void {
  gitlabOutputChannel.appendLine('INFO: Activating GitLab extension...');
  registerCommands(context);
  init(context);
  gitlabOutputChannel.appendLine('INFO: GitLab extension activated.');
}
