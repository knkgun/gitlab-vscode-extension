import * as vscode from 'vscode';
import * as gitLabService from '../services/gitlab_service';
import * as gitLab from '../types/gitlab';
import { GitlabTreeItem } from '../ui/gitlab_tree_item';
import { GitlabDataProvider } from './gitlab_data_provider';

export class IssuableDataProvider extends GitlabDataProvider {
  // eslint-disable-next-line class-methods-use-this
  async getProjectIssues(
    parameters: gitLab.GitlabCustomQueryParameters,
    workspaceFolder: string,
  ): Promise<GitlabTreeItem[]> {
    const items: GitlabTreeItem[] = [];
    const queryParameters: gitLab.GitlabCustomQueryParameters = parameters;
    queryParameters.noItemText = queryParameters.noItemText
      ? queryParameters.noItemText
      : 'No items found.';
    const issues: gitLab.Issuable[] | null = await gitLabService.fetchIssuables(
      queryParameters,
      workspaceFolder,
    );
    let issuableSign = '!';
    if (queryParameters.type === 'issues') {
      issuableSign = '#';
    } else if (queryParameters.type === 'epics') {
      issuableSign = '&';
    } else if (queryParameters.type === 'snippets') {
      issuableSign = '$';
    } else if (queryParameters.type === 'vulnerabilities') {
      issuableSign = '-';
    }
    if (issues && issues.length) {
      issues.forEach(issue => {
        let title = `${issuableSign}${issue.iid} · ${issue.title}`;
        if (issuableSign === '$') {
          title = `${issuableSign}${issue.id} · ${issue.title}`;
        } else if (issuableSign === '-') {
          title = `[${issue.severity}] - ${issue.name}`;
        }
        items.push(
          new GitlabTreeItem(title, issue, queryParameters.type, undefined, workspaceFolder),
        );
      });
    } else {
      items.push(new GitlabTreeItem(queryParameters.noItemText));
    }
    return items;
  }

  async getChildren(el?: GitlabTreeItem): Promise<GitlabTreeItem[]> {
    let items: GitlabTreeItem[] = [];
    const { customQueries } = vscode.workspace.getConfiguration('gitlab');
    const projects: gitLab.GitlabProject[] = await gitLabService.getAllGitlabProjects();

    if (el) {
      if (el.contextValue && el.contextValue.startsWith('custom-query-')) {
        const customQuery: string = el.contextValue.split('custom-query-')[1];
        const parameters: gitLab.GitlabCustomQueryParameters = {};
        customQuery.split(';').forEach(cq => {
          const key = cq.split(':')[0];
          const value = cq.split(':')[1];
          parameters[key] = value;
        });
        if (parameters.projectUri) {
          items = await this.getProjectIssues(parameters, parameters.projectUri);
        } else if (projects.length > 1) {
          projects.forEach(project => {
            items.push(
              new GitlabTreeItem(
                project.label ? project.label : 'GitLab Project',
                parameters,
                gitLab.GitlabCustomQueryParametersTypes.project,
                vscode.TreeItemCollapsibleState.Collapsed,
                project.uri,
              ),
            );
          });
        } else if (projects.length === 1) {
          items = await this.getProjectIssues(parameters, projects[0].uri);
        } else {
          items.push(
            new GitlabTreeItem(parameters.noItemText ? parameters.noItemText : 'No items found.'),
          );
        }
      }
    } else {
      customQueries.forEach((customQuery: gitLab.GitlabCustomQueryParameters) => {
        items.push(
          new GitlabTreeItem(
            customQuery.name ? customQuery.name : 'GitLab Items',
            customQuery,
            gitLab.GitlabCustomQueryParametersTypes.customQuery,
            vscode.TreeItemCollapsibleState.Collapsed,
            null,
          ),
        );
      });
    }
    return items;
  }
}
