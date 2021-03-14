import * as vscode from 'vscode';
import { PROGRAMMATIC_COMMANDS } from '../../command_names';
import { createGitLabNewService } from '../../service_factory';
import { ChangedFileItem } from './changed_file_item';
import { ItemModel } from './item_model';
import { GqlDiscussion, GqlTextDiffDiscussion } from '../../gitlab/gitlab_new_service';
import { handleError } from '../../log';
import { UserFriendlyError } from '../../errors/user_friendly_error';
import { GitLabCommentThread } from '../../review/gitlab_comment_thread';
import { WrappedRepository } from '../../git/wrapped_repository';

const isTextDiffDiscussion = (discussion: GqlDiscussion): discussion is GqlTextDiffDiscussion => {
  const firstNote = discussion.notes.nodes[0];
  return firstNote?.position?.positionType === 'text';
};

export class MrItemModel extends ItemModel {
  constructor(readonly mr: RestIssuable, readonly repository: WrappedRepository) {
    super();
  }

  getTreeItem(): vscode.TreeItem {
    const { iid, title, author } = this.mr;
    const item = new vscode.TreeItem(
      `!${iid} · ${title}`,
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    if (author.avatar_url) {
      item.iconPath = vscode.Uri.parse(author.avatar_url);
    }
    return item;
  }

  async getChildren(): Promise<vscode.TreeItem[]> {
    const description = new vscode.TreeItem('Description');
    description.iconPath = new vscode.ThemeIcon('note');
    description.command = {
      command: PROGRAMMATIC_COMMANDS.SHOW_RICH_CONTENT,
      arguments: [this.mr, this.repository.rootFsPath],
      title: 'Show MR',
    };
    try {
      await this.getMrDiscussions();
    } catch (e) {
      handleError(
        new UserFriendlyError(
          `The extension failed to preload discussions on the MR diff.
            It's possible that you've encountered
            https://gitlab.com/gitlab-org/gitlab/-/issues/298827.`,
          e,
        ),
      );
    }
    const changedFiles = await this.getChangedFiles();
    return [description, ...changedFiles];
  }

  private async getMrDiscussions(): Promise<void> {
    const commentController = vscode.comments.createCommentController(
      this.mr.references.full,
      this.mr.title,
    );

    const gitlabService = await createGitLabNewService(this.repository.rootFsPath);

    const discussions = await gitlabService.getDiscussions({
      issuable: this.mr,
      includePosition: true,
    });
    const discussionsOnDiff = discussions.filter(isTextDiffDiscussion);
    const threads = discussionsOnDiff.map(discussion => {
      return GitLabCommentThread.createThread({
        commentController,
        workspaceFolder: this.repository.rootFsPath,
        gitlabProjectId: this.mr.project_id,
        discussion,
        gitlabService,
      });
    });
    this.setDisposableChildren([...threads, commentController]);
  }

  private async getChangedFiles(): Promise<vscode.TreeItem[]> {
    const gitlabService = await createGitLabNewService(this.repository.rootFsPath);
    const mrVersion = await gitlabService.getMrDiff(this.mr);
    return mrVersion.diffs.map(d => new ChangedFileItem(this.mr, mrVersion, d, this.repository));
  }
}
