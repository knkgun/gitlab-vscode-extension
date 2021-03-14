import * as vscode from 'vscode';
import * as gitLabService from '../../gitlab_service';
import { handleError } from '../../log';
import { ErrorItem } from './error_item';
import { MrItemModel } from './mr_item_model';
import { ExternalUrlItem } from './external_url_item';
import { IssueItem } from './issue_item';
import { VulnerabilityItem } from './vulnerability_item';
import { CustomQuery } from '../../gitlab/custom_query';
import { CustomQueryType } from '../../gitlab/custom_query_type';
import { ItemModel } from './item_model';
import { WrappedRepository } from '../../git/wrapped_repository';

export class CustomQueryItemModel extends ItemModel {
  private repository: WrappedRepository;

  private customQuery: CustomQuery;

  constructor(
    customQuery: CustomQuery,
    repository: WrappedRepository,
    readonly showProject = false,
  ) {
    super();
    this.repository = repository;
    this.customQuery = customQuery;
  }

  getTreeItem(): vscode.TreeItem {
    if (!this.repository.containsGitLabProject) {
      return new ErrorItem(`${this.repository.name}: Repository is not GitLab repository`);
    }

    const item = new vscode.TreeItem(
      this.showProject ? this.repository.name : this.customQuery.name,
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    item.iconPath = this.showProject
      ? new vscode.ThemeIcon('project')
      : new vscode.ThemeIcon('filter');
    return item;
  }

  private async getProjectIssues(): Promise<vscode.TreeItem[]> {
    const issues = await gitLabService.fetchIssuables(this.customQuery, this.repository.rootFsPath);
    if (issues.length === 0) {
      const noItemText = this.customQuery.noItemText || 'No items found.';
      return [new vscode.TreeItem(noItemText)];
    }

    const { MR, ISSUE, SNIPPET, EPIC, VULNERABILITY } = CustomQueryType;
    switch (this.customQuery.type) {
      case MR: {
        const mrModels = issues.map((mr: RestIssuable) => new MrItemModel(mr, this.repository));
        this.setDisposableChildren(mrModels);
        return mrModels;
      }
      case ISSUE:
        return issues.map((issue: RestIssuable) => new IssueItem(issue, this.repository));
      case SNIPPET:
        return issues.map(
          (snippet: RestIssuable) =>
            new ExternalUrlItem(`$${snippet.id} · ${snippet.title}`, snippet.web_url),
        );
      case EPIC:
        return issues.map(
          (epic: RestIssuable) => new ExternalUrlItem(`&${epic.iid} · ${epic.title}`, epic.web_url),
        );
      case VULNERABILITY:
        return issues.map((v: RestVulnerability) => new VulnerabilityItem(v));
      default:
        throw new Error(`unknown custom query type ${this.customQuery.type}`);
    }
  }

  async getChildren(): Promise<vscode.TreeItem[]> {
    try {
      return await this.getProjectIssues();
    } catch (e) {
      handleError(e);
      return [new ErrorItem()];
    }
  }
}
