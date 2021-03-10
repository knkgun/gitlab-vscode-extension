/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable global-require */
import { CustomQueryType } from './gitlab/custom_query_type';
import { CustomQuery } from './gitlab/custom_query';

jest.mock('./utils/get_instance_url', () => {
  return {
    getInstanceUrl: () => 'INSTANCE_URL',
  };
});
jest.mock('./services/token_service', () => {
  return {
    tokenService: {
      getToken: () => 'TOKEN',
      getInstanceUrls: () => [],
    },
  };
});
jest.mock('./service_factory', () => {
  return {
    createGitLabNewService: () => ({
      getProject: () => ({ groupRestId: 'TEST_PROJECT', restId: 'TEST_PROJECT' }),
    }),
    createGitService: () => ({
      fetchGitRemote: () => ({
        host: 'TEST_HOST',
        namespace: 'TEST_NS',
        project: 'TEST_PROJECT',
      }),
    }),
  };
});
jest.mock('./utils/get_user_agent_header');
jest.mock('./utils/get_http_agent_options');

describe('fetchIssueables', () => {
  beforeEach(() => jest.resetModules());
  // These are required, but not used in the function
  const baseParams = {
    name: '',
    noItemText: '',
  };

  // These are the other parameters used
  const defaultParams = {
    type: CustomQueryType.MR,
    scope: 'all',
    state: 'opened',
    wip: '',
    searchIn: '',
    pipelineId: undefined,
    confidential: false,
    excludeLabels: undefined,
    excludeMilestone: undefined,
    excludeAuthor: undefined,
    excludeAssignee: undefined,
    excludeSearch: undefined,
    excludeSearchIn: '',
    labels: undefined,
    milestone: undefined,
    search: undefined,
    createdBefore: undefined,
    createdAfter: undefined,
    updatedBefore: undefined,
    updatedAfter: undefined,
    orderBy: '',
    sort: '',
    maxResults: 20,
    reportTypes: undefined,
    severityLevels: undefined,
    confidenceLevels: undefined,
  };

  let request: jest.Mock;
  let fetchIssuablesRef: (params: CustomQuery, workspaceFolder: string) => Promise<RestIssuable[]>;
  type MockFn = (...args: any) => any;

  const setupFetchIssuable = ({ version = '13.9', mocks = [] }: Record<string, unknown> = {}) => {
    request = require('request-promise');
    const { fetchIssuables } = require('./gitlab_service');
    jest.mock('request-promise', () => jest.fn(() => ({ response: [] })));
    fetchIssuablesRef = fetchIssuables;

    const implementations = [() => ({ response: { version } }), ...(mocks as MockFn[])];
    implementations.forEach(imp => request.mockImplementationOnce(imp));
  };

  const fetchIssuablesHelper = (params: Partial<CustomQuery> = {}) =>
    fetchIssuablesRef({ ...baseParams, ...defaultParams, ...params }, 'test');

  describe('handles versions', () => {
    it('replaces _ in versions before 11', async () => {
      setupFetchIssuable({ version: '10' });

      await fetchIssuablesHelper({ scope: 'assigned_to_me' });

      expect(request.mock.calls[1][0]).toContain('assigned-to-me');
    });

    it('leaves _ in versions after 10', async () => {
      setupFetchIssuable({ version: '11' });

      await fetchIssuablesHelper({ scope: 'assigned_to_me' });

      expect(request.mock.calls[1][0]).toContain('assigned_to_me');
    });
  });

  describe('handles types', () => {
    it.each`
      type                             | scope               | expectation
      ${CustomQueryType.VULNERABILITY} | ${'all'}            | ${'all'}
      ${CustomQueryType.VULNERABILITY} | ${'dismissed'}      | ${'dismissed'}
      ${CustomQueryType.ISSUE}         | ${'all'}            | ${'all'}
      ${CustomQueryType.ISSUE}         | ${'assigned_to_me'} | ${'assigned_to_me'}
      ${CustomQueryType.ISSUE}         | ${'created_by_me'}  | ${'created_by_me'}
      ${CustomQueryType.MR}            | ${'all'}            | ${'all'}
      ${CustomQueryType.MR}            | ${'assigned_to_me'} | ${'assigned_to_me'}
      ${CustomQueryType.MR}            | ${'created_by_me'}  | ${'created_by_me'}
    `('sets scope based on type: $type', async ({ type, scope, expectation }) => {
      setupFetchIssuable();
      await fetchIssuablesHelper({ type, scope });
      expect(request.mock.calls[1][0]).toContain(expectation);
    });

    it.each`
      type                             | scope    | queries                                | path
      ${CustomQueryType.EPIC}          | ${'all'} | ${{ include_ancestor_groups: 'true' }} | ${'/groups/TEST_PROJECT/epics'}
      ${CustomQueryType.VULNERABILITY} | ${'all'} | ${{ scope: 'all' }}                    | ${'/projects/TEST_PROJECT/vulnerability_findings'}
      ${CustomQueryType.MR}            | ${'all'} | ${{ scope: 'all' }}                    | ${'/projects/TEST_PROJECT/merge_requests'}
    `('sets path based on type: $type', async ({ type, scope, queries, path }) => {
      setupFetchIssuable();
      await fetchIssuablesHelper({ type, scope });
      const url = request.mock.calls[1][0];
      const search = new URLSearchParams(url.split('?')[1]);
      expect(request.mock.calls[1][0]).toContain(path);
      Object.entries(queries).forEach(([key, query]) => {
        expect(search.get(key)).toEqual(query);
      });
    });
  });

  describe('author parameters', () => {
    it('sets no author parameter', async () => {
      setupFetchIssuable();
      await fetchIssuablesHelper({ type: CustomQueryType.ISSUE });
      const search = new URLSearchParams(request.mock.calls[1][0]);
      expect(search.get('author_username')).toBeNull();
      expect(search.get('author_id')).toBeNull();
    });

    it('sets author_username parameter', async () => {
      setupFetchIssuable();
      await fetchIssuablesHelper({ type: CustomQueryType.ISSUE, author: 'testuser' });
      const search = new URLSearchParams(request.mock.calls[1][0]);
      expect(search.get('author_username')).toEqual('testuser');
      expect(search.get('author_id')).toBeNull();
    });

    it('sets author_id parameter if author is found', async () => {
      setupFetchIssuable({
        mocks: [
          () => {
            return { response: [{ id: 1 }] };
          },
        ],
      });
      await fetchIssuablesHelper({ type: CustomQueryType.MR, author: 'testuser' });
      const search = new URLSearchParams(request.mock.calls[2][0]);
      expect(search.get('author_username')).toBeNull();
      expect(search.get('author_id')).toEqual('1');
    });

    it('sets author_id parameter to -1 if author is not found', async () => {
      setupFetchIssuable({
        mocks: [
          () => {
            return { response: [] };
          },
        ],
      });
      await fetchIssuablesHelper({ type: CustomQueryType.MR, author: 'testuser' });
      const search = new URLSearchParams(request.mock.calls[2][0]);
      expect(search.get('author_username')).toBeNull();
      expect(search.get('author_id')).toEqual('-1');
    });
  });

  describe('searchIn parameters', () => {
    it('sets "all" parameter', async () => {
      setupFetchIssuable();
      await fetchIssuablesHelper({ searchIn: 'all' });
      const search = new URLSearchParams(request.mock.calls[1][0]);
      expect(search.get('in')).toEqual('title,description');
    });

    it('sets "in" parameter', async () => {
      setupFetchIssuable();
      await fetchIssuablesHelper({ searchIn: 'title' });
      const search = new URLSearchParams(request.mock.calls[1][0]);
      expect(search.get('in')).toEqual('title');
    });
  });

  describe('WIP/Draft', () => {
    it('sets wip parameter', async () => {
      setupFetchIssuable();
      await fetchIssuablesHelper({ wip: 'true' });
      const search = new URLSearchParams(request.mock.calls[1][0]);
      expect(search.get('wip')).toEqual('true');
    });
  });

  describe('misc query parameters', () => {
    it('sets query parameters', async () => {
      setupFetchIssuable();
      await fetchIssuablesHelper({
        type: CustomQueryType.ISSUE,
        confidential: true,
        excludeLabels: ['label1', 'label2'],
        excludeMilestone: 'excludeMilestone',
        excludeAuthor: 'excludeAuthor',
        excludeAssignee: 'excludeAssignee',
        excludeSearch: 'excludeSearch',
        excludeSearchIn: 'excludeSearchIn',
        labels: ['label1', 'label2'],
        milestone: 'milestone',
        search: 'search',
        createdBefore: 'createdBefore',
        createdAfter: 'createdAfter',
        updatedBefore: 'updatedBefore',
        updatedAfter: 'updatedAfter',
        orderBy: 'orderBy',
        sort: 'sort',
        maxResults: 20,
        reportTypes: ['reportType1', 'reportType2'],
        severityLevels: ['severityLevel1', 'severityLevel2'],
        confidenceLevels: ['confidenceLevel1', 'confidenceLevel2'],
      });
      const search = new URLSearchParams(request.mock.calls[1][0]);

      expect(search.get('confidential')).toEqual('true');
      expect(search.get('not[labels]')).toEqual('label1,label2');
      expect(search.get('not[milestone]')).toEqual('excludeMilestone');
      expect(search.get('not[author_username]')).toEqual('excludeAuthor');
      expect(search.get('not[assignee_username]')).toEqual('excludeAssignee');
      expect(search.get('not[search]')).toEqual('excludeSearch');
      expect(search.get('not[in]')).toEqual('excludeSearchIn');
      expect(search.get('labels')).toEqual('label1,label2');
      expect(search.get('milestone')).toEqual('milestone');
      expect(search.get('search')).toEqual('search');
      expect(search.get('created_before')).toEqual('createdBefore');
      expect(search.get('created_after')).toEqual('createdAfter');
      expect(search.get('updated_before')).toEqual('updatedBefore');
      expect(search.get('updated_after')).toEqual('updatedAfter');
      expect(search.get('order_by')).toEqual('orderBy');
      expect(search.get('sort')).toEqual('sort');
      expect(search.get('per_page')).toEqual('20');
      expect(search.get('report_type')).toEqual('reportType1,reportType2');
      expect(search.get('severity')).toEqual('severityLevel1,severityLevel2');
      expect(search.get('confidence')).toEqual('confidenceLevel1,confidenceLevel2');
    });
  });

  describe('pipeline parameters', () => {
    it('sets pipeline_id when given a number', async () => {
      setupFetchIssuable();
      await fetchIssuablesHelper({ pipelineId: 1 });
      const search = new URLSearchParams(request.mock.calls[1][0]);
      expect(search.get('pipeline_id')).toEqual('1');
    });
  });
});
