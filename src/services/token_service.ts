import * as vscode from 'vscode';
import * as openers from '../actions/openers';
import * as statusBar from '../ui/status_bar';

interface TokenMap {
  [instanceUrl: string]: string;
}

let context: vscode.ExtensionContext | null = null;
let active = false;

const currentInstanceUrl = (): string => vscode.workspace.getConfiguration('gitlab').instanceUrl;

const getGlTokenMap = (): TokenMap => {
  if (context) {
    const glTokens: TokenMap = context.globalState.get('glTokens', {});
    return glTokens;
  }
  return {};
};

export const getToken = (instanceUrl = currentInstanceUrl()): string =>
  getGlTokenMap()[instanceUrl];

export const getInstanceUrls = (): string[] => Object.keys(getGlTokenMap());

const updateExtensionStatus = (): void => {
  const tokenExists = Boolean(getToken());

  if (!active && tokenExists && context) {
    statusBar.init(context);
    active = true;
  } else if (active && !tokenExists) {
    statusBar.dispose();
    active = false;
  }
};

export const setToken = (instanceUrl: string, token: string | undefined): void => {
  if (context) {
    const tokenMap: TokenMap = getGlTokenMap();

    if (token) {
      tokenMap[instanceUrl] = token;
    } else {
      delete tokenMap[instanceUrl];
    }

    context.globalState.update('glTokens', tokenMap);
    updateExtensionStatus();
  }
};

const askForToken = async (): Promise<boolean> => {
  if (!getToken() && context && !context.workspaceState.get('askedForToken')) {
    const message =
      'GitLab Workflow: Please set GitLab Personal Access Token to setup this extension.';
    const setButton = { title: 'Set Token Now', action: 'set' };
    const readMore = { title: 'Read More', action: 'more' };

    context.workspaceState.update('askedForToken', true);
    return vscode.window.showInformationMessage(message, readMore, setButton).then(item => {
      if (item) {
        const { action } = item;

        if (action === 'set') {
          vscode.commands.executeCommand('gl.setToken');
        } else {
          openers.openUrl('https://gitlab.com/fatihacet/gitlab-vscode-extension#setup');
        }
      }
      return true;
    });
  }
  return true;
};

const watchConfigurationChanges = (): void => {
  vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('gitlab')) {
      updateExtensionStatus();
    }
  });
};

export const init = (ctx: vscode.ExtensionContext): void => {
  context = ctx;

  askForToken();
  updateExtensionStatus();
  watchConfigurationChanges();
};
