import * as vscode from 'vscode';
import * as request from 'request-promise';
import * as fs from 'fs';
import { ProjectSchema, UserSchema, PipelineSchema, JobSchema } from 'gitlab';
import * as gitService from './git_service';
import * as tokenService from './token_service';
import * as statusBar from '../ui/status_bar';
import * as gitlabProjectInput from '../inputs/gitlab_project_input';
import { gitlabOutputChannel } from '../extension';
import * as gitLab from '../types/gitlab';

interface GitlabProjectPromise {
  label: Promise<ProjectSchema | null>;
  uri: string;
}

const projectCache: Map<string, ProjectSchema> = new Map<string, ProjectSchema>();

// eslint-disable-next-line @typescript-eslint/require-await
async function fetch(
  path: string,
  method = 'GET',
  data: object | null = null,
): Promise<request.RequestPromise | null> {
  const {
    instanceUrl,
    ignoreCertificateErrors,
    ca,
    cert,
    certKey,
  } = vscode.workspace.getConfiguration('gitlab');
  const { proxy } = vscode.workspace.getConfiguration('http');
  const apiRoot = `${instanceUrl}/api/v4`;
  const glToken: string = tokenService.getToken(instanceUrl);
  const tokens: string = tokenService.getInstanceUrls().join(', ');

  if (!glToken) {
    let err = `
      GitLab Workflow: Cannot make request.
      GitLab URL for this workspace is set to ${instanceUrl}
      and there is no matching token for this URL.
    `;

    if (tokens.length) {
      err = `${err} You have configured tokens for ${tokens}.`;
    }

    vscode.window.showInformationMessage(err);
    return null;
  }

  const config: request.Options = {
    url: `${apiRoot}${path}`,
    method,
    headers: {
      'PRIVATE-TOKEN': glToken,
    },
    rejectUnauthorized: !ignoreCertificateErrors,
  };

  if (proxy) {
    config.proxy = proxy;
  }

  if (ca) {
    try {
      config.ca = fs.readFileSync(ca);
    } catch (ex) {
      gitlabOutputChannel.appendLine(
        `ERROR: Cannot read CA ${ex.name} - ${ex.message}\n${ex.stack}`,
      );
      vscode.window.showErrorMessage(`GitLab Workflow: Cannot read CA '${ca}'`);
    }
  }

  if (cert) {
    try {
      config.cert = fs.readFileSync(cert);
    } catch (ex) {
      gitlabOutputChannel.appendLine(
        `ERROR: Cannot read Cert ${ex.name} - ${ex.message}\n${ex.stack}`,
      );
      vscode.window.showErrorMessage(`GitLab Workflow: Cannot read Cert '${cert}'`);
    }
  }

  if (certKey) {
    try {
      config.key = fs.readFileSync(certKey);
    } catch (ex) {
      gitlabOutputChannel.appendLine(
        `ERROR: Cannot read Cert Key ${ex.name} - ${ex.message}\n${ex.stack}`,
      );
      vscode.window.showErrorMessage(`GitLab Workflow: Cannot read Cert Key '${certKey}'`);
    }
  }

  if (data) {
    config.formData = data;
  }

  // eslint-disable-next-line @typescript-eslint/unbound-method
  config.transform = (body, response) => {
    try {
      return {
        response: JSON.parse(body),
        headers: response.headers,
      };
    } catch (ex) {
      vscode.window.showInformationMessage('GitLab Workflow: Failed to perform your operation.');
      gitlabOutputChannel.appendLine(
        `ERROR: Failed to execute fetch ${ex.name} - ${ex.message}\n${ex.stack}`,
      );
      return { error: ex };
    }
  };

  return request(config);
}

async function fetchProjectData(remote: gitService.GitlabRemote): Promise<ProjectSchema | null> {
  if (remote) {
    if (!projectCache.has(`${remote.namespace}_${remote.project}`)) {
      const { namespace, project } = remote;
      const { response } = await fetch(`/projects/${namespace.replace(/\//g, '%2F')}%2F${project}`);
      const projectData = response;
      projectCache.set(`${remote.namespace}_${remote.project}`, projectData);
    }
    const projectData = projectCache.get(`${remote.namespace}_${remote.project}`);
    if (projectData) {
      return projectData;
    }
  }

  return null;
}

export async function fetchCurrentProject(workspaceFolder: string): Promise<ProjectSchema | null> {
  try {
    const remote: gitService.GitlabRemote | null = await gitService.fetchGitRemote(workspaceFolder);
    if (remote) {
      return await fetchProjectData(remote);
    }
  } catch (ex) {
    gitlabOutputChannel.appendLine(
      `ERROR: Failed to fetch current project ${ex.name} - ${ex.message}\n${ex.stack}`,
    );
  }
  return null;
}

export async function fetchCurrentPipelineProject(
  workspaceFolder: string,
): Promise<ProjectSchema | null> {
  try {
    const remote: gitService.GitlabRemote | null = await gitService.fetchGitRemotePipeline(
      workspaceFolder,
    );
    if (remote) {
      return await fetchProjectData(remote);
    }
  } catch (ex) {
    gitlabOutputChannel.appendLine(
      `ERROR: Failed to fetch current pipeline project ${ex.name} - ${ex.message}\n${ex.stack}`,
    );
  }
  return null;
}

export async function fetchUser(userName: string | null = null): Promise<UserSchema | null> {
  let user: UserSchema | null = null;

  try {
    const path = userName ? `/users?username=${userName}` : '/user';

    const { response } = await fetch(path);
    user = response;
    if (Array.isArray(user)) {
      [user] = user;
    }
  } catch (ex) {
    let message = 'GitLab Workflow: GitLab user not found.';

    if (!userName) {
      message += ' Check your Personal Access Token.';
    }

    gitlabOutputChannel.appendLine(`ERROR: ${message} ${ex.name} - ${ex.message}\n${ex.stack}`);

    vscode.window.showInformationMessage(message);
  }

  return user;
}

export async function getAllGitlabProjects(): Promise<gitLab.GitlabProject[]> {
  let workspaceFoldersPromise: GitlabProjectPromise[] = [];
  let workspaceFolders: gitLab.GitlabProject[] = [];
  if (vscode.workspace.workspaceFolders) {
    workspaceFoldersPromise = vscode.workspace.workspaceFolders.map(workspaceFolder => ({
      label: fetchCurrentProject(workspaceFolder.uri.fsPath),
      uri: workspaceFolder.uri.fsPath,
    }));

    const labels = await Promise.all(
      workspaceFoldersPromise.map(workspaceFolder => workspaceFolder.label),
    )
      .then(res => res)
      .catch(err =>
        gitlabOutputChannel.appendLine(
          `ERROR: Failed to fetch data for some workspace folder ${err.name} - ${err.message}\n${err.stack}`,
        ),
      );

    for (let i = 0; i < workspaceFoldersPromise.length; i += 1) {
      workspaceFolders[i] = {
        label: labels[i]?.name ? labels[i]?.name : '',
        uri: workspaceFoldersPromise[i].uri,
      };
    }

    workspaceFolders = workspaceFolders.filter(workspaceFolder => workspaceFolder.label != null);
  }
  return workspaceFolders;
}

export async function fetchLastPipelineForCurrentBranch(
  workspaceFolder: string,
): Promise<PipelineSchema | null> {
  const project: ProjectSchema | null = await fetchCurrentPipelineProject(workspaceFolder);
  let pipeline: PipelineSchema | null = null;

  if (project) {
    const branchName = await gitService.fetchTrackingBranchName(workspaceFolder);
    const pipelinesRootPath = `/projects/${project.id}/pipelines`;
    const { response } = await fetch(`${pipelinesRootPath}?ref=${branchName}`);
    const pipelines = response;

    if (pipelines.length) {
      const { singleResponse } = await fetch(`${pipelinesRootPath}/${pipelines[0].id}`);
      pipeline = singleResponse;
    }
  }

  return pipeline;
}

export async function getSearchUrl(
  params: gitLab.GitlabCustomQueryParameters,
  workspaceFolder: string,
  getApi = true,
): Promise<string | null> {
  const project: ProjectSchema | null = await fetchCurrentProject(workspaceFolder);
  if (!project) {
    return null;
  }
  const config: gitLab.GitlabCustomQueryParameters = params;
  if (!config.type) {
    config.type = gitLab.GitlabCustomQueryParametersTypes.mergeRequests;
  }
  if (!config.scope) {
    config.scope = gitLab.GitlabCustomQueryParametersScopes.all;
  }
  if (!config.state) {
    config.state = gitLab.GitlabCustomQueryParametersStates.opened;
  }
  if (config.type === 'vulnerabilities' && config.scope !== 'dismissed') {
    config.scope = gitLab.GitlabCustomQueryParametersScopes.all;
  } else if (
    (config.type === 'issues' || config.type === 'merge_requests') &&
    config.scope !== 'assigned_to_me' &&
    config.scope !== 'created_by_me'
  ) {
    config.scope = gitLab.GitlabCustomQueryParametersScopes.all;
  }
  if (config.type === 'vulnerabilities') {
    config.type = gitLab.GitlabCustomQueryParametersTypes.vulnerabilityFindings;
  }

  let path = '';

  if (config.type === 'epics') {
    if (project.namespace.kind === 'group') {
      if (getApi) {
        path = `/groups/${project.namespace.id}`;
      }
      path += `/${config.type}?include_ancestor_groups=true&state=${config.state}`;
    } else {
      return null;
    }
  } else {
    if (getApi) {
      path = `/projects/${project.id}`;
    }
    path += `/${config.type}?scope=${config.scope}&state=${config.state}`;
  }
  if (config.labels) {
    path = `${path}&labels=${config.labels}`;
  }
  if (config.milestone) {
    path = `${path}&milestone=${config.milestone}`;
  }
  if (config.type === 'issues') {
    if (config.author) {
      path = `${path}&author_username=${config.author}`;
    }
  } else if (config.author) {
    const authorId = await this.fetchUser(config.author);
    if (authorId) {
      path = `${path}&author_id=${authorId.id}`;
    } else {
      path = `${path}&author_id=-1`;
    }
  }
  if (config.assignee === 'Any' || config.assignee === 'None') {
    path = `${path}&assignee_id=${config.assignee}`;
  } else if (config.assignee && config.type === 'issues') {
    path = `${path}&assignee_username=${config.assignee}`;
  } else if (config.assignee) {
    const assigneeId = await this.fetchUser(config.assignee);
    if (assigneeId) {
      path = `${path}&assignee_id=${assigneeId.id}`;
    } else {
      path = `${path}&assignee_id=-1`;
    }
  }
  if (config.search) {
    path = `${path}&search=${config.search}`;
  }
  if (config.searchIn) {
    let searchInQuery: string = config.searchIn;
    if (config.searchIn === 'all') {
      searchInQuery = 'title,description';
    }
    path = `${path}&in=${searchInQuery}`;
  }
  if (config.createdBefore) {
    path = `${path}&created_before=${config.createdBefore}`;
  }
  if (config.createdAfter) {
    path = `${path}&created_after=${config.createdAfter}`;
  }
  if (config.updatedBefore) {
    path = `${path}&updated_before=${config.updatedBefore}`;
  }
  if (config.updatedAfter) {
    path = `${path}&updated_after=${config.updatedAfter}`;
  }
  if (config.type === 'merge_requests' && config.wip) {
    path = `${path}&wip=${config.wip}`;
  }
  if (config.type === 'issues') {
    if (config.confidential) {
      path = `${path}&confidential=${config.confidential}`;
    }
    if (config.excludeLabels) {
      path = `${path}&not[labels]=${config.excludeLabels}`;
    }
    if (config.excludeMilestone) {
      path = `${path}&not[milestone]=${config.excludeMilestone}`;
    }
    if (config.excludeAuthor) {
      path = `${path}&not[author_username]=${config.excludeAuthor}`;
    }
    if (config.excludeAssignee) {
      path = `${path}&not[assignee_username]=${config.excludeAssignee}`;
    }
    if (config.excludeSearch) {
      path = `${path}&not[search]=${config.excludeSearch}`;
    }
    if (config.excludeSearchIn) {
      let excludeSearchInQuery: string = config.excludeSearchIn;
      if (config.excludeSearchIn === 'all') {
        excludeSearchInQuery = 'title,description';
      }
      path = `${path}&not[in]=${excludeSearchInQuery}`;
    }
  }
  if (config.orderBy) {
    path = `${path}&order_by=${config.orderBy}`;
  }
  if (config.sort) {
    path = `${path}&sort=${config.sort}`;
  }
  if (config.maxResults) {
    path = `${path}&per_page=${parseInt(config.maxResults, 10)}`;
  }
  if (config.reportTypes) {
    path = `${path}&report_type=${config.reportTypes}`;
  }
  if (config.severityLevels) {
    path = `${path}&severity=${config.severityLevels}`;
  }
  if (config.confidenceLevels) {
    path = `${path}&confidence=${config.confidenceLevels}`;
  }
  if (config.pipelineId) {
    if (config.pipelineId === 'branch') {
      config.pipelineId = (await fetchLastPipelineForCurrentBranch(workspaceFolder))?.id.toString();
    }
    if (config.pipelineId) {
      path = `${path}&pipeline_id=${config.pipelineId}`;
    }
  }
  return path;
}

export async function fetchIssuables(
  params: gitLab.GitlabCustomQueryParameters,
  workspaceFolder: string,
): Promise<gitLab.Issuable[] | null> {
  let issuable: gitLab.Issuable[] | null = null;

  const path: string | null = await getSearchUrl(params, workspaceFolder);

  if (path) {
    const { response } = await fetch(path);
    issuable = response;
  }
  return issuable;
}

export async function fetchLastJobsForCurrentBranch(
  pipeline: PipelineSchema,
  workspaceFolder: string,
): Promise<JobSchema[] | null> {
  const project: ProjectSchema | null = await fetchCurrentPipelineProject(workspaceFolder);
  if (project) {
    const { response } = await fetch(`/projects/${project.id}/pipelines/${pipeline.id}/jobs`);
    let jobs: JobSchema[] = response;

    // Gitlab return multiple jobs if you retry the pipeline we filter to keep only the last
    const alreadyProcessedJob = new Set();
    jobs = jobs.sort((one, two) => (one.created_at > two.created_at ? -1 : 1));
    jobs = jobs.filter(job => {
      if (alreadyProcessedJob.has(job.name)) {
        return false;
      }
      alreadyProcessedJob.add(job.name);
      return true;
    });

    return jobs;
  }

  return null;
}

export async function fetchOpenMergeRequestForCurrentBranch(
  workspaceFolder: string,
): Promise<gitLab.Issuable | null> {
  const project: ProjectSchema | null = await fetchCurrentProject(workspaceFolder);
  const branchName: string | null = await gitService.fetchTrackingBranchName(workspaceFolder);

  if (project && project.id && branchName) {
    const path = `/projects/${project.id}/merge_requests?state=opened&source_branch=${branchName}`;
    const { response } = await fetch(path);
    const mrs = response;

    if (mrs.length > 0) {
      return mrs[0];
    }
  }

  return null;
}

/**
 * Cancels or retries last pipeline or creates a new pipeline for current branch.
 *
 * @param {string} action create|retry|cancel
 */
export async function handlePipelineAction(
  action: gitLab.PipelineAction,
  workspaceFolder: string,
): Promise<void> {
  const pipeline = await fetchLastPipelineForCurrentBranch(workspaceFolder);
  const project = await fetchCurrentProject(workspaceFolder);

  if (pipeline && project) {
    let endpoint = `/projects/${project.id}/pipelines/${pipeline.id}/${action}`;
    let newPipeline = null;

    if (action === 'create') {
      const branchName = await gitService.fetchTrackingBranchName(workspaceFolder);
      endpoint = `/projects/${project.id}/pipeline?ref=${branchName}`;
    }

    try {
      const { response } = await fetch(endpoint, 'POST');
      newPipeline = response;
    } catch (ex) {
      gitlabOutputChannel.appendLine(
        `ERROR: Failed to ${action} pipeline ${ex.name} - ${ex.message}\n${ex.stack}`,
      );
      vscode.window.showErrorMessage(`GitLab Workflow: Failed to ${action} pipeline.`);
    }

    if (newPipeline) {
      statusBar.refreshPipeline();
    }
  } else {
    vscode.window.showErrorMessage('GitLab Workflow: No project or pipeline found.');
  }
}

export async function fetchMRIssues(
  mrId: number,
  workspaceFolder: string,
): Promise<gitLab.Issuable[]> {
  const project: ProjectSchema | null = await fetchCurrentProject(workspaceFolder);
  let issues: gitLab.Issuable[] = [];

  if (project) {
    try {
      const { response } = await fetch(
        `/projects/${project.id}/merge_requests/${mrId}/closes_issues`,
      );
      issues = response;
    } catch (ex) {
      gitlabOutputChannel.appendLine(
        `ERROR: Failed to execute fetchMRIssue ${ex.name} - ${ex.message}\n${ex.stack}`,
      );
    }
  }

  return issues;
}

export async function createSnippet(data: gitLab.SnippetOptions): Promise<gitLab.Issuable | null> {
  let snippet: gitLab.Issuable | null = null;
  let path = '/snippets';

  if (data.id) {
    path = `/projects/${data.id}/snippets`;
  }

  try {
    const { response } = await fetch(path, 'POST', data);
    snippet = response;
  } catch (ex) {
    vscode.window.showInformationMessage('GitLab Workflow: Failed to create your snippet.');
    gitlabOutputChannel.appendLine(
      `ERROR: Failed to create your snippet ${ex.name} - ${ex.message}\n${ex.stack}`,
    );
  }

  return snippet;
}

export async function validateCIConfig(content: string): Promise<gitLab.ValidCiConfig | null> {
  let validCIConfig: gitLab.ValidCiConfig | null = null;

  try {
    const { response } = await fetch('/ci/lint', 'POST', { content });
    validCIConfig = response;
  } catch (ex) {
    vscode.window.showInformationMessage('GitLab Workflow: Failed to validate CI configuration.');
    gitlabOutputChannel.appendLine(
      `ERROR: Failed to validate CI configuration ${ex.name} - ${ex.message}\n${ex.stack}`,
    );
  }

  return validCIConfig;
}

export async function fetchLabelEvents(
  issuable: gitLab.Issuable,
): Promise<gitLab.DiscussionElement[] | null> {
  let labelEvents: gitLab.DiscussionElement[] = [];

  try {
    const type = issuable.sha ? 'merge_requests' : 'issues';
    const { response } = await fetch(
      `/projects/${issuable.project_id}/${type}/${issuable.iid}/resource_label_events?sort=asc&per_page=100`,
    );
    labelEvents = response;
  } catch (ex) {
    vscode.window.showInformationMessage(
      'GitLab Workflow: Failed to fetch label events for this issuable.',
    );
    gitlabOutputChannel.appendLine(
      `ERROR: Failed to fetch label events ${ex.name} - ${ex.message}\n${ex.stack}`,
    );
    return null;
  }

  labelEvents.forEach(el => {
    el.body = '';
  });
  return labelEvents;
}

export async function fetchDiscussions(
  issuable: gitLab.Issuable,
  page = 1,
): Promise<gitLab.DiscussionElement[]> {
  let discussions: gitLab.DiscussionElement[] = [];

  try {
    const type = issuable.sha ? 'merge_requests' : 'issues';
    const { response, headers } = await fetch(
      `/projects/${issuable.project_id}/${type}/${issuable.iid}/discussions?sort=asc&per_page=5&page=${page}`,
      'GET',
      null,
    );
    discussions = response;
    if (page === 1 && headers['x-next-page'] !== '') {
      const pages: Promise<gitLab.DiscussionElement[]>[] = [];
      for (let i = 2; i <= headers['x-total-pages']; i += 1) {
        pages.push(fetchDiscussions(issuable, i));
      }
      const results: gitLab.DiscussionElement[][] = await Promise.all(pages)
        .then(val => {
          return val;
        })
        .catch(e => {
          throw e;
        });
      results.forEach(result => {
        const res: gitLab.DiscussionElement[] = result;
        discussions = discussions.concat(res);
      });
    }
  } catch (ex) {
    vscode.window.showInformationMessage(
      'GitLab Workflow: Failed to fetch discussions for this issuable.',
    );
    gitlabOutputChannel.appendLine(
      `ERROR: Failed to fetch discussion ${ex.name} - ${ex.message}\n${ex.stack}`,
    );
  }

  return discussions;
}

export async function renderMarkdown(markdown: string, workspaceFolder: string): Promise<string> {
  let rendered = { html: markdown };

  try {
    const project: ProjectSchema | null = await fetchCurrentProject(workspaceFolder);
    if (project) {
      const { response } = await fetch('/markdown', 'POST', {
        text: markdown,
        project: project.path_with_namespace,
        gfm: 'true', // Needs to be a string for the API
      });
      rendered = response;
    }
  } catch (ex) {
    gitlabOutputChannel.appendLine(
      `ERROR: Failed to render markdown ${ex.name} - ${ex.message}\n${ex.stack}`,
    );
    return markdown;
  }

  return rendered.html;
}

export async function saveNote(
  issuable: gitLab.Issuable,
  note: string,
  noteType: gitLab.GitlabCustomQueryParametersTypes,
): Promise<gitLab.SaveNote> {
  let savedNote: gitLab.SaveNote;

  try {
    const projectId = issuable.project_id;
    const { iid } = issuable;
    const { response } = await fetch(`/projects/${projectId}/${noteType}/${iid}/notes`, 'POST', {
      body: note,
    });
    savedNote = response;
  } catch (ex) {
    gitlabOutputChannel.appendLine(
      `ERROR: Failed to save note ${ex.name} - ${ex.message}\n${ex.stack}`,
    );
    savedNote = { status: false };
  }

  return savedNote;
}

export async function getCurrenWorkspaceFolder(): Promise<string | null> {
  const editor = vscode.window.activeTextEditor;

  if (
    editor &&
    editor.document &&
    vscode.workspace.getWorkspaceFolder(editor.document.uri) !== undefined
  ) {
    const workspaceFolder: string | undefined = vscode.workspace.getWorkspaceFolder(
      editor.document.uri,
    )?.uri?.fsPath;
    if (workspaceFolder) {
      const project: ProjectSchema | null = await fetchCurrentProject(workspaceFolder);
      if (project != null) {
        return workspaceFolder;
      }
    }
  } else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length === 1) {
    return vscode.workspace.workspaceFolders[0].uri.fsPath;
  }
  return null;
}

export async function getCurrentWorkspaceFolderOrSelectOne(): Promise<string | null> {
  let workspaceFolder: string | null = null;

  workspaceFolder = await getCurrenWorkspaceFolder();

  if (workspaceFolder == null) {
    workspaceFolder = await gitlabProjectInput.showPicker();
  }

  return workspaceFolder;
}
