import * as vscode from 'vscode';
import { ProjectSchema } from 'gitlab';
import * as gitLabService from '../services/gitlab_service';
import * as gitLab from '../types/gitlab';
import * as openers from '../actions/openers';

async function parseQuery(
  query: string,
  noteableType: gitLab.GitlabCustomQueryParametersTypes,
  workspaceFolder: string,
): Promise<string | null> {
  const params: gitLab.GitlabCustomQueryParameters = {};
  params.type = noteableType;
  const tokens: string[][] = query
    .replace(/: /g, ':') // Normalize spaces after tokens.
    .replace(/\s[a-z]*:/gi, t => `\n${t}`) // Get tokens and add new line.
    .split('\n') // Create array from tokens.
    .map(t => t.trim().split(':')); // Return new array with token and value arrays.

  // If there is no token it's a basic text search.
  if (tokens.length === 1 && tokens[0][1] === undefined) {
    [[params.search]] = tokens;
  } else {
    tokens.forEach(t => {
      const [token, value] = t;

      switch (token) {
        case 'labels':
          if (params.labels) {
            params.labels += `,${value.replace(/, /g, ',')}`;
          } else {
            params.labels = value.replace(/, /g, ',');
          }
          break;

        // Labels can be multiple and should be comma separated.
        case 'label':
          if (params.labels) {
            params.labels += `,${value}`;
          } else {
            params.labels = value;
          }
          break;

        // GitLab requires Title and Description in `search` query param.
        // Since we are passing this as search query, GL will also search in issue descriptions too.
        case 'title':
          params.search = value;
          break;

        // GitLab UI requires milestone as milestone_title.
        case 'milestone':
          delete params.milestone;
          params.milestone = value;
          break;

        case 'author':
          delete params.author;

          if (value === 'me') {
            params.scope = gitLab.GitlabCustomQueryParametersScopes.createdByMe;
          } else {
            params.author = value;
          }
          break;

        // GitLab requires assignee name as assignee_username[] for issues.
        // and as assignee_username for merge requests `assignee` is syntatic sugar of extension.
        // We currently don't support multiple assignees for issues.
        case 'assignee':
          delete params.assignee;

          if (value === 'me') {
            params.scope = gitLab.GitlabCustomQueryParametersScopes.assignedToMe;
          } else {
            params.assignee = value;
          }
          break;

        // Add other tokens. If there is a typo in token name GL either ignore it or won't find any issue.
        default:
          params[token] = value;
          break;
      }
    });
  }

  const path: string | null = await gitLabService.getSearchUrl(params, workspaceFolder, false);
  const project: ProjectSchema | null = await gitLabService.fetchCurrentProject(workspaceFolder);
  if (path && project) {
    return `${project.web_url}${path}`;
  }
  return null;
}

async function showSearchInputFor(
  noteableType: gitLab.GitlabCustomQueryParametersTypes,
): Promise<void> {
  const query: string | undefined = await vscode.window.showInputBox({
    ignoreFocusOut: true,
    placeHolder: 'Search in title or description. (Check project page for advanced usage)',
  });

  const workspaceFolder: string | null = await gitLabService.getCurrentWorkspaceFolderOrSelectOne();

  if (query && workspaceFolder) {
    const path: string | null = await parseQuery(query, noteableType, workspaceFolder);

    if (path) {
      openers.openUrl(path);
      return;
    }
  }
  vscode.window.showErrorMessage('GitLab Workflow: No project found to search issues');
}

export async function showIssueSearchInput(): Promise<void> {
  await showSearchInputFor(gitLab.GitlabCustomQueryParametersTypes.issues);
}

export async function showMergeRequestSearchInput(): Promise<void> {
  await showSearchInputFor(gitLab.GitlabCustomQueryParametersTypes.mergeRequests);
}
