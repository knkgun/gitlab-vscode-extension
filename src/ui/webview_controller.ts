import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as gitLabService from '../services/gitlab_service';
import * as gitLab from '../types/gitlab';
import { WebViewMessage } from '../types/webview';

interface WebViewPaths {
  appScriptUri: vscode.Uri;
  vendorUri: vscode.Uri;
  styleUri: vscode.Uri;
  devScriptUri: vscode.Uri;
}

let context: vscode.ExtensionContext;

export const addDeps = (ctx: vscode.ExtensionContext) => {
  context = ctx;
};

const getNonce = (): string => {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < 32; i += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
};

const getResources = (panel: vscode.WebviewPanel): WebViewPaths => {
  const paths: WebViewPaths = {
    appScriptUri: panel.webview.asWebviewUri(
      vscode.Uri.file(path.join(context.extensionPath, 'src/webview/dist/js/app.js')),
    ),
    vendorUri: panel.webview.asWebviewUri(
      vscode.Uri.file(path.join(context.extensionPath, 'src/webview/dist/js/chunk-vendors.js')),
    ),
    styleUri: panel.webview.asWebviewUri(
      vscode.Uri.file(path.join(context.extensionPath, 'src/webview/dist/css/app.css')),
    ),
    devScriptUri: panel.webview.asWebviewUri(
      vscode.Uri.file(path.join(context.extensionPath, 'src/webview/dist/app.js')),
    ),
  };

  return paths;
};

const getIndexPath = (): string => {
  const isDev = !fs.existsSync(path.join(context.extensionPath, 'src/webview/dist/js/app.js'));

  return isDev ? 'src/webview/dist/dev.html' : 'src/webview/dist/index.html';
};

const replaceResources = (panel: vscode.WebviewPanel): string => {
  const { appScriptUri, vendorUri, styleUri, devScriptUri }: WebViewPaths = getResources(panel);

  return fs
    .readFileSync(path.join(context.extensionPath, getIndexPath()), 'UTF-8')
    .replace(/{{nonce}}/gm, getNonce())
    .replace('{{styleUri}}', styleUri.toString())
    .replace('{{vendorUri}}', vendorUri.toString())
    .replace('{{appScriptUri}}', appScriptUri.toString())
    .replace('{{devScriptUri}}', devScriptUri.toString());
};

const createPanel = (issuable: gitLab.Issuable): vscode.WebviewPanel => {
  let title = 'Untitle';
  if (issuable.title) {
    title = `${issuable.title.slice(0, 20)}...`;
  }

  return vscode.window.createWebviewPanel('glWorkflow', title, vscode.ViewColumn.One, {
    enableScripts: true,
    localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'src'))],
  });
};

function sendIssuableAndDiscussions(
  panel: vscode.WebviewPanel,
  issuable: gitLab.Issuable,
  discussions: gitLab.DiscussionElement[],
  appIsReady: boolean,
): void {
  if (!discussions || !appIsReady) return;
  panel.webview.postMessage({ type: 'issuableFetch', issuable, discussions });
}

async function handleCreate(
  panel: vscode.WebviewPanel,
  issuable: gitLab.Issuable,
  workspaceFolder: string,
): Promise<void> {
  let appIsReady = false;
  let discussions: gitLab.DiscussionElement[];
  panel.webview.onDidReceiveMessage(async (message: WebViewMessage) => {
    if (message.command === 'appReady') {
      appIsReady = true;
      sendIssuableAndDiscussions(panel, issuable, discussions, appIsReady);
    }

    if (message.command === 'renderMarkdown') {
      if (message.markdown) {
        let rendered: string = message.markdown.replace(
          /\(\/.*(\/-)?\/merge_requests\//,
          '(/-/merge_requests/',
        );
        rendered = await gitLabService.renderMarkdown(rendered, workspaceFolder);
        rendered = (rendered || '')
          .replace(/ src=".*" alt/gim, ' alt')
          .replace(/" data-src/gim, '" src')
          .replace(
            / href="\//gim,
            ` href="${vscode.workspace.getConfiguration('gitlab').instanceUrl}/`,
          )
          .replace(/\/master\/-\/merge_requests\//gim, '/-/merge_requests/');

        panel.webview.postMessage({
          type: 'markdownRendered',
          ref: message.ref,
          object: message.object,
          markdown: rendered,
        });
      }
    }

    if (message.command === 'saveNote') {
      if (message.issuable && message.note && message.noteType) {
        const response: gitLab.SaveNote = await gitLabService.saveNote(
          message.issuable,
          message.note,
          message.noteType,
        );

        if (response.status !== false) {
          const newDiscussions: gitLab.DiscussionElement[] = await gitLabService.fetchDiscussions(
            issuable,
          );
          panel.webview.postMessage({
            type: 'issuableFetch',
            issuable,
            discussions: newDiscussions,
          });
          panel.webview.postMessage({ type: 'noteSaved' });
        } else {
          panel.webview.postMessage({ type: 'noteSaved', status: false });
        }
      }
    }
  });

  // TODO: Call APIs in parallel
  discussions = await gitLabService.fetchDiscussions(issuable);
  const labelEvents: gitLab.DiscussionElement[] | null = await gitLabService.fetchLabelEvents(
    issuable,
  );
  let discussionWithLabels: gitLab.DiscussionElement[] = discussions;
  if (labelEvents) {
    discussionWithLabels = discussionWithLabels.concat(labelEvents);
  }
  discussionWithLabels.sort((a: gitLab.DiscussionElement, b: gitLab.DiscussionElement) => {
    let aCreatedAt: string | null = null;
    let bCreatedAt: string | null = null;
    if (a.label && a.created_at) {
      aCreatedAt = a.created_at;
    } else if (a.notes && a.notes.length > 0 && a.notes[0].created_at) {
      aCreatedAt = a.notes[0].created_at;
    }
    if (b.label && b.created_at) {
      bCreatedAt = b.created_at;
    } else if (b.notes && b.notes.length > 0 && b.notes[0].created_at) {
      bCreatedAt = b.notes[0].created_at;
    }
    if (aCreatedAt && bCreatedAt) {
      return aCreatedAt < bCreatedAt ? -1 : 1;
    }
    return 1;
  });
  sendIssuableAndDiscussions(panel, issuable, discussionWithLabels, appIsReady);
}

export async function create(issuable: gitLab.Issuable, workspaceFolder: string): Promise<void> {
  const panel: vscode.WebviewPanel = createPanel(issuable);
  const html: string = replaceResources(panel);
  panel.webview.html = html;

  let lightIconUri: vscode.Uri = vscode.Uri.file(
    path.join(context.extensionPath, 'src', 'assets', 'images', 'light', 'issues.svg'),
  );
  let darkIconUri: vscode.Uri = vscode.Uri.file(
    path.join(context.extensionPath, 'src', 'assets', 'images', 'dark', 'issues.svg'),
  );
  if (issuable.squash_commit_sha !== undefined) {
    lightIconUri = vscode.Uri.file(
      path.join(context.extensionPath, 'src', 'assets', 'images', 'light', 'merge_requests.svg'),
    );
    darkIconUri = vscode.Uri.file(
      path.join(context.extensionPath, 'src', 'assets', 'images', 'dark', 'merge_requests.svg'),
    );
  }
  panel.iconPath = { light: lightIconUri, dark: darkIconUri };

  panel.onDidChangeViewState(() => {
    handleCreate(panel, issuable, workspaceFolder);
  });

  await handleCreate(panel, issuable, workspaceFolder);
}
