const vscode = require('vscode');
const openers = require('./openers');
const tokenInput = require('./token_input');
const { tokenService } = require('./services/token_service');
const tokenServiceWrapper = require('./token_service_wrapper');
const { extensionState } = require('./extension_state');
const pipelineActionsPicker = require('./pipeline_actions_picker');
const searchInput = require('./search_input');
const { createSnippet } = require('./commands/create_snippet');
const { insertSnippet } = require('./commands/insert_snippet');
const sidebar = require('./sidebar');
const ciConfigValidator = require('./ci_config_validator');
const { webviewController } = require('./webview_controller');
const IssuableDataProvider = require('./data_providers/issuable').DataProvider;
const CurrentBranchDataProvider = require('./data_providers/current_branch').DataProvider;
const { initializeLogging, handleError } = require('./log');
const { GitContentProvider } = require('./review/git_content_provider');
const { REVIEW_URI_SCHEME } = require('./constants');
const { USER_COMMANDS, PROGRAMMATIC_COMMANDS } = require('./command_names');
const { CiCompletionProvider } = require('./completion/ci_completion_provider');
const { gitExtensionWrapper } = require('./git/git_extension_wrapper');
const {
  toggleResolved,
  deleteComment,
  editComment: startEdit,
  cancelEdit,
  submitEdit,
  createComment,
} = require('./commands/mr_discussion_commands');
const { fileDecorationProvider } = require('./review/file_decoration_provider');

vscode.gitLabWorkflow = {
  sidebarDataProviders: [],
};

const wrapWithCatch = command => async (...args) => {
  try {
    await command(...args);
  } catch (e) {
    handleError(e);
  }
};

const registerSidebarTreeDataProviders = () => {
  const issuableDataProvider = new IssuableDataProvider();

  const currentBranchDataProvider = new CurrentBranchDataProvider();

  const register = (name, provider) => {
    vscode.window.registerTreeDataProvider(name, provider);
    vscode.gitLabWorkflow.sidebarDataProviders.push(provider);
  };

  register('issuesAndMrs', issuableDataProvider);
  register('currentBranchInfo', currentBranchDataProvider);
};

const registerCommands = (context, outputChannel) => {
  const commands = {
    [USER_COMMANDS.SHOW_ISSUES_ASSIGNED_TO_ME]: openers.showIssues,
    [USER_COMMANDS.SHOW_MERGE_REQUESTS_ASSIGNED_TO_ME]: openers.showMergeRequests,
    [USER_COMMANDS.SET_TOKEN]: tokenInput.showInput,
    [USER_COMMANDS.REMOVE_TOKEN]: tokenInput.removeTokenPicker,
    [USER_COMMANDS.OPEN_ACTIVE_FILE]: openers.openActiveFile,
    [USER_COMMANDS.COPY_LINK_TO_ACTIVE_FILE]: openers.copyLinkToActiveFile,
    [USER_COMMANDS.OPEN_CURRENT_MERGE_REQUEST]: openers.openCurrentMergeRequest,
    [USER_COMMANDS.OPEN_CREATE_NEW_ISSUE]: openers.openCreateNewIssue,
    [USER_COMMANDS.OPEN_CREATE_NEW_MR]: openers.openCreateNewMr,
    [USER_COMMANDS.OPEN_PROJECT_PAGE]: openers.openProjectPage,
    [USER_COMMANDS.OPEN_CURRENT_PIPELINE]: openers.openCurrentPipeline,
    [USER_COMMANDS.PIPELINE_ACTIONS]: pipelineActionsPicker.showPicker,
    [USER_COMMANDS.ISSUE_SEARCH]: searchInput.showIssueSearchInput,
    [USER_COMMANDS.MERGE_REQUEST_SEARCH]: searchInput.showMergeRequestSearchInput,
    [USER_COMMANDS.PROJECT_ADVANCED_SEARCH]: searchInput.showProjectAdvancedSearchInput,
    [USER_COMMANDS.COMPARE_CURRENT_BRANCH]: openers.compareCurrentBranch,
    [USER_COMMANDS.CREATE_SNIPPET]: createSnippet,
    [USER_COMMANDS.INSERT_SNIPPET]: insertSnippet,
    [USER_COMMANDS.VALIDATE_CI_CONFIG]: ciConfigValidator.validate,
    [USER_COMMANDS.REFRESH_SIDEBAR]: sidebar.refresh,
    [PROGRAMMATIC_COMMANDS.SHOW_RICH_CONTENT]: webviewController.create.bind(webviewController),
    [USER_COMMANDS.SHOW_OUTPUT]: () => outputChannel.show(),
    [USER_COMMANDS.RESOLVE_THREAD]: toggleResolved,
    [USER_COMMANDS.UNRESOLVE_THREAD]: toggleResolved,
    [USER_COMMANDS.DELETE_COMMENT]: deleteComment,
    [USER_COMMANDS.START_EDITING_COMMENT]: startEdit,
    [USER_COMMANDS.CANCEL_EDITING_COMMENT]: cancelEdit,
    [USER_COMMANDS.SUBMIT_COMMENT_EDIT]: submitEdit,
    [USER_COMMANDS.CREATE_COMMENT]: createComment,
    [PROGRAMMATIC_COMMANDS.NO_IMAGE_REVIEW]: () =>
      vscode.window.showInformationMessage("GitLab MR review doesn't support images yet."),
  };

  Object.keys(commands).forEach(cmd => {
    context.subscriptions.push(vscode.commands.registerCommand(cmd, wrapWithCatch(commands[cmd])));
  });

  registerSidebarTreeDataProviders();
};

const registerCiCompletion = context => {
  const subscription = vscode.languages.registerCompletionItemProvider(
    { pattern: '**/.gitlab-ci*.{yml,yaml}' },
    new CiCompletionProvider(),
    '$',
  );

  context.subscriptions.push(subscription);
};

const activate = context => {
  const outputChannel = vscode.window.createOutputChannel('GitLab Workflow');
  initializeLogging(line => outputChannel.appendLine(line));
  vscode.workspace.registerTextDocumentContentProvider(REVIEW_URI_SCHEME, new GitContentProvider());
  registerCommands(context, outputChannel);
  const isDev = process.env.NODE_ENV === 'development';
  webviewController.init(context, isDev);
  tokenService.init(context);
  tokenServiceWrapper.init(context);
  extensionState.init(tokenService);
  registerCiCompletion(context);
  gitExtensionWrapper.init();
  context.subscriptions.push(gitExtensionWrapper);
  vscode.window.registerFileDecorationProvider(fileDecorationProvider);
};

exports.activate = activate;
