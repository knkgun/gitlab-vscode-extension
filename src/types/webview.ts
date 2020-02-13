import * as gitLab from './gitlab';

export interface WebViewMessage {
  command: string;
  markdown?: string;
  type?: string;
  ref?: number;
  object?: string;
  issuable?: gitLab.Issuable;
  note?: string;
  status?: boolean;
  discussions?: gitLab.DiscussionElement[];
  noteType?: gitLab.GitlabCustomQueryParametersTypes;
}
