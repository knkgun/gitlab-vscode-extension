import * as path from 'path';

import { Repository } from '../api/git';
import { GitLabNewService } from '../gitlab/gitlab_new_service';
import { GitLabProject } from '../gitlab/gitlab_project';
import { log, logError } from '../log';
import { getInstanceUrl } from '../utils/get_instance_url';
import { parseGitRemote } from './git_remote_parser';

export class WrappedRepository {
  private repository: Repository;

  private gitlabProject?: GitLabProject;

  gitlabService?: GitLabNewService;

  initialized = false;

  containsGitLabProject = false;

  constructor(repository: Repository) {
    this.repository = repository;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const firstRemote = this.repository.state.remotes[0];
    if (!firstRemote || (!firstRemote.fetchUrl && !firstRemote.pushUrl)) {
      this.initialized = true;
      return;
    }
    const remote = parseGitRemote(firstRemote.fetchUrl || firstRemote.pushUrl || '');
    if (!remote?.namespace) {
      this.initialized = true;
      return;
    }
    const instanceUrl = await getInstanceUrl();
    this.gitlabService = new GitLabNewService(instanceUrl);
    try {
      this.gitlabProject = await this.gitlabService.getProject(
        `${remote.namespace}/${remote.project}`,
      );
      this.initialized = true;
      this.containsGitLabProject = true;
    } catch (e) {
      logError(e);
      log(`repository ${this.repository.rootUri.toString} doesn't contain a GitLab project`);
      this.initialized = true;
    }
  }

  get name(): string {
    return this.gitlabProject?.name ?? path.basename(this.repository.rootUri.toString());
  }

  get rootFsPath(): string {
    return this.repository.rootUri.fsPath;
  }

  // TODO: listen on workspace config changes
}
