import { UserSchema } from 'gitlab';
import { QuickPickItem } from 'vscode';

export interface SaveNote {
  status: boolean;
}

export interface Noteable {
  // eslint-disable-next-line babel/camelcase
  created_at?: string;
  system?: boolean;
  author?: UserSchema;
  user?: UserSchema;
  body?: string;
  markdownRenderedOnServer?: boolean;
  id: number;
  label?: {
    name: string;
  };
  action?: string;
}

export interface DiscussionElement {
  id: string;
  body: string;
  label?: string;
  // eslint-disable-next-line babel/camelcase
  created_at?: string;
  notes?: Noteable[];
  // eslint-disable-next-line babel/camelcase
  individual_note: boolean;
}

export interface ValidCiConfig {
  status?: ValidCiConfigStatus;
  errors?: string[];
  error?: string;
}

export enum PipelineAction {
  view = 'view',
  create = 'create',
  retry = 'retry',
  cancel = 'cancel',
}

export enum SnippetVisibility {
  public = 'public',
  internal = 'internal',
  private = 'private',
}

export interface SnippetOptions {
  id?: number;
  title: string;
  // eslint-disable-next-line babel/camelcase
  file_name: string;
  visibility: SnippetVisibility;
  code?: string;
  content?: string;
}

export enum GitlabCustomQueryParametersTypes {
  issues = 'issues',
  mergeRequests = 'merge_requests',
  epics = 'epics',
  snippets = 'snippets',
  vulnerabilities = 'vulnerabilities',
  vulnerabilityFindings = 'vulnerability_findings',
  customQuery = 'custom_query',
  pipelines = 'pipelines',
  project = 'project',
}

export interface GitlabCustomQueryParameters {
  name?: string;
  type?: GitlabCustomQueryParametersTypes;
  maxResults?: string;
  scope?: GitlabCustomQueryParametersScopes;
  state?: GitlabCustomQueryParametersStates;
  labels?: string;
  milestone?: string;
  author?: string;
  assignee?: string;
  search?: string;
  createdBefore?: string;
  createdAfter?: string;
  updatedBefore?: string;
  updatedAfter?: string;
  wip?: GitlabCustomQueryParametersWip;
  confidential?: string;
  excludeLabels?: string;
  excludeMilestone?: string;
  excludeAuthor?: string;
  excludeAssignee?: string;
  excludeSearch?: string;
  excludeSearchIn?: GitlabCustomQueryParametersSearchIn;
  orderBy?: GitlabCustomQueryParametersOrderBy;
  sort?: GitlabCustomQueryParametersSort;
  reportTypes?: GitlabCustomQueryParametersSort;
  severityLevels?: GitlabCustomQueryParametersSeverityLevels;
  confidenceLevels?: GitlabCustomQueryParametersConfidenceLevels;
  searchIn?: GitlabCustomQueryParametersSearchIn;
  pipelineId?: string;
  noItemText?: string;
  projectUri?: string;
  [additionalParameters: string]: string | undefined;
}

export interface Issuable {
  id?: number;
  iid?: number;
  title?: string;
  name?: string;
  severity?: string;
  // eslint-disable-next-line babel/camelcase
  web_url?: string;
  sha?: string;
  // eslint-disable-next-line babel/camelcase
  squash_commit_sha?: string;
  // eslint-disable-next-line babel/camelcase
  project_id?: number;
  location?: {
    file?: string;
  };
  state?: IssuableState;
  description?: string;
  markdownRenderedOnServer?: boolean;
}

export interface GitlabProject extends QuickPickItem {
  label: string;
  uri: string;
}

enum ValidCiConfigStatus {
  valid = 'valid',
  invalid = 'invalid',
}

enum IssuableState {
  opened = 'opened',
  closed = 'closed',
}

export enum GitlabCustomQueryParametersScopes {
  assignedToMe = 'assigned_to_me',
  createdByMe = 'created_by_me',
  dismissed = 'dismissed',
  all = 'all',
}

export enum GitlabCustomQueryParametersStates {
  all = 'all',
  opened = 'opened',
  closed = 'closed',
}

enum GitlabCustomQueryParametersWip {
  yes = 'yes',
  no = 'no',
}

enum GitlabCustomQueryParametersSearchIn {
  all = 'all',
  title = 'title',
  description = 'description',
}

enum GitlabCustomQueryParametersOrderBy {
  createdAt = 'created_at',
  updatedAt = 'updated_at',
  priority = 'priority',
  dueDate = 'due_date',
  relativePosition = 'relative_position',
  labelPriority = 'label_priority',
  milestoneDue = 'milestone_due',
  popularity = 'popularity',
  weight = 'weight',
}

enum GitlabCustomQueryParametersSort {
  asc = 'asc',
  desc = 'desc',
}

enum GitlabCustomQueryParametersSort {
  sast = 'sast',
  dast = 'dast',
  dependencyScanning = 'dependency_scanning',
  containerScanning = 'container_scanning',
}

enum GitlabCustomQueryParametersSeverityLevels {
  undefined = 'undefined',
  info = 'info',
  unknown = 'unknown',
  low = 'low',
  medium = 'medium',
  high = 'high',
  critical = 'critical',
}

enum GitlabCustomQueryParametersConfidenceLevels {
  undefined = 'undefined',
  ignore = 'ignore',
  unknown = 'unknown',
  experimental = 'experimental',
  low = 'low',
  medium = 'medium',
  high = 'high',
  confirmed = 'confirmed',
}
