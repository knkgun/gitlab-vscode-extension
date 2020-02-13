import * as moment from 'moment-timezone';
import { ProjectSchema, PipelineSchema } from 'gitlab';
import * as gitLabService from '../services/gitlab_service';
import * as gitLab from '../types/gitlab';
import { GitlabTreeItem } from '../ui/gitlab_tree_item';
import { GitlabDataProvider } from './gitlab_data_provider';

moment.tz.setDefault(Intl.DateTimeFormat().resolvedOptions().timeZone);

export class CurrentBranchDataProvider extends GitlabDataProvider {
  project?: ProjectSchema | null;

  mr: gitLab.Issuable | null;

  constructor() {
    super();
    this.project = null;
    this.mr = null;
  }

  async fetchProject(workspaceFolder: string): Promise<void> {
    try {
      this.project = await gitLabService.fetchCurrentProject(workspaceFolder);
    } catch (e) {
      this.project = null;
      this.children.push(
        new GitlabTreeItem('No pipeline found.'),
        new GitlabTreeItem('No merge request found.'),
        new GitlabTreeItem('No closing issue found.'),
      );
    }
  }

  async fetchPipeline(workspaceFolder: string): Promise<void> {
    let message = 'No pipeline found.';
    let url: string | undefined;
    if (this.project) {
      const pipeline: PipelineSchema | null = await gitLabService.fetchLastPipelineForCurrentBranch(
        workspaceFolder,
      );

      if (pipeline) {
        const statusText = pipeline.status === 'success' ? 'passed' : pipeline.status;
        let actionText: string;
        switch (pipeline.status) {
          case 'running':
            actionText = 'Started';
            break;
          case 'success':
            actionText = 'Finished';
            break;
          case 'pending':
            actionText = 'Created';
            break;
          case 'canceled':
            actionText = 'Canceled';
            break;
          case 'skipped':
            actionText = 'Skipped';
            break;
          case 'failed':
            actionText = 'Failed';
            break;
          default:
            actionText = '';
        }

        const timeAgo: string = moment(pipeline.updated_at).fromNow();

        message = `Pipeline #${pipeline.id} ${statusText} · ${actionText} ${timeAgo}`;
        url = `${this.project.web_url}/pipelines/${pipeline.id}`;
      }
    }
    this.children.push(
      new GitlabTreeItem(
        message,
        // eslint-disable-next-line @typescript-eslint/camelcase
        { web_url: url },
        gitLab.GitlabCustomQueryParametersTypes.pipelines,
        undefined,
        workspaceFolder,
      ),
    );
  }

  async fetchMR(workspaceFolder: string): Promise<void> {
    this.mr = null;
    let message = 'No merge request found.';

    if (this.project) {
      const mr: gitLab.Issuable | null = await gitLabService.fetchOpenMergeRequestForCurrentBranch(
        workspaceFolder,
      );

      if (mr) {
        this.mr = mr;
        message = `MR: !${mr.iid} · ${mr.title}`;
      }
    }
    this.children.push(
      new GitlabTreeItem(
        message,
        this.mr,
        gitLab.GitlabCustomQueryParametersTypes.mergeRequests,
        undefined,
        workspaceFolder,
      ),
    );
  }

  async fetchClosingIssue(workspaceFolder: string): Promise<void> {
    if (this.project) {
      if (this.mr && this.mr.iid) {
        const issues: gitLab.Issuable[] = await gitLabService.fetchMRIssues(
          this.mr.iid,
          workspaceFolder,
        );

        if (issues.length) {
          issues.forEach(issue => {
            this.children.push(
              new GitlabTreeItem(
                `Issue: #${issue.iid} · ${issue.title}`,
                issue,
                gitLab.GitlabCustomQueryParametersTypes.issues,
                undefined,
                workspaceFolder,
              ),
            );
          });
        } else {
          this.children.push(new GitlabTreeItem('No closing issue found.'));
        }
      } else {
        this.children.push(new GitlabTreeItem('No closing issue found.'));
      }
    } else {
      this.children.push(new GitlabTreeItem('No closing issue found.'));
    }
  }

  async getChildren(): Promise<GitlabTreeItem[]> {
    const workspaceFolder: string | null = await gitLabService.getCurrenWorkspaceFolder();
    if (workspaceFolder) {
      await this.fetchProject(workspaceFolder);
      await this.fetchPipeline(workspaceFolder);
      await this.fetchMR(workspaceFolder);
      await this.fetchClosingIssue(workspaceFolder);
    }
    return this.children;
  }
}
