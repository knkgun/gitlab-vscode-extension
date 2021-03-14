import { TreeItem } from 'vscode';
import { PROGRAMMATIC_COMMANDS } from '../../command_names';
import { WrappedRepository } from '../../git/wrapped_repository';

export class IssueItem extends TreeItem {
  issue: RestIssuable;

  repository: WrappedRepository;

  constructor(issue: RestIssuable, repository: WrappedRepository) {
    super(`#${issue.iid} · ${issue.title}`);
    this.issue = issue;
    this.repository = repository;
    this.command = {
      command: PROGRAMMATIC_COMMANDS.SHOW_RICH_CONTENT,
      arguments: [this.issue, this.repository.rootFsPath],
      title: 'Show Issue',
    };
  }
}
