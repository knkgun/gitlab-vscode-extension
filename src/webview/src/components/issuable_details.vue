<script lang="ts">
/* eslint-disable vue/no-v-html */
/* eslint-disable global-require */
/* eslint-disable @typescript-eslint/no-var-requires */
import { Component, Vue, Prop } from 'vue-property-decorator';
import MarkdownIt from 'markdown-it';
import UserAvatar from './user_avatar.vue';
import Date from './date.vue';
import App from '../app.vue';
import { Issuable } from '../../../types/gitlab';
import { WebViewMessage } from '../../../types/webview';

@Component({
  name: 'IssuableDetails',
  components: {
    UserAvatar,
    Date,
  },
})
export default class IssuableDetails extends Vue {
  @Prop({ required: true })
  public issuable!: Issuable;

  get stateText(): string {
    if (this.issuable.state === 'opened') {
      return 'Open';
    }
    if (this.issuable.state === 'closed') {
      return 'Close';
    }
    return '';
  }

  get description(): string {
    if (this.issuable.markdownRenderedOnServer && this.issuable.description) {
      return this.issuable.description;
    }

    const description: string = this.issuable.description || '';
    const webUrl: string = this.issuable.web_url || '';
    const path = `${webUrl.split('/issues/')[0]}/uploads/`;
    const normalized: string = description.replace(/\/uploads/gm, path);
    const md: MarkdownIt = new MarkdownIt();
    return md.use(require('markdown-it-task-lists')).render(normalized);
  }

  mounted(): void {
    App.vsCode.postMessage({
      command: 'renderMarkdown',
      markdown: this.issuable.description,
      object: 'issuable',
      ref: this.issuable.id,
    });
  }

  created(): void {
    window.addEventListener('message', event => {
      const { data }: { data: WebViewMessage } = event;
      if (data.type === 'markdownRendered') {
        const { ref, object, markdown } = data;
        if (object === 'issuable' && ref === this.issuable.id) {
          this.issuable.markdownRenderedOnServer = true;
          this.issuable.description = markdown;
        }
      }
    });
  }
}
</script>

<template>
  <div class="issuable-details">
    <div class="header">
      <span :class="{ [issuable.state]: true }" class="state">{{ stateText }}</span>
      <span class="capitalize"> opened</span>
      <date :date="issuable.created_at" />
      by
      <user-avatar :user="issuable.author" :show-handle="false" />
      <a :href="issuable.web_url" class="view-link">
        Open in GitLab
      </a>
    </div>
    <div class="title">
      <h2>{{ issuable.title }}</h2>
    </div>
    <div class="description" v-html="description"></div>
  </div>
</template>

<style lang="scss">
.issuable-details {
  border-bottom: 1px solid;
  border-color: var(--vscode-panel-border);
  line-height: 21px;

  .badge {
    padding: 0 8px;
    line-height: 16px;
    border-radius: 36px;
    font-size: 12px;
    display: inline-block;
  }

  .header {
    padding: 10px 0 6px;
    line-height: 36px;
    margin-bottom: 8px;
    border-bottom: 1px solid;
    border-color: var(--vscode-panel-border);
    position: relative;

    .view-link {
      position: absolute;
      right: 0;
    }

    .state {
      border-radius: 4px;
      padding: 2px 9px;
      margin-right: 5px;
      font-size: 12px;

      &.opened {
        background-color: #2a9d3f;
      }

      &.closed {
        background-color: #1d64c9;
      }
    }
  }

  .description {
    margin-bottom: 16px;
  }

  table:not(.code) {
    margin: 16px 0;
    border: 0;
    width: auto;
    display: block;
    overflow-x: auto;
    border-collapse: collapse;
  }

  table:not(.code) tbody td {
    border: 1px solid;
    border-color: var(--vscode-panel-border);
    border-collapse: collapse;
    border-image-repeat: stretch;
    padding-bottom: 10px;
    padding-left: 16px;
    padding-right: 16px;
    padding-top: 10px;
    text-align: start;
    text-size-adjust: 100%;
    vertical-align: middle;
    box-sizing: border-box;
  }

  table:not(.code) thead th {
    border-bottom: 2px solid;
    border-right: 1px solid;
    border-left: 1px solid;
    border-top: 1px solid;
    border-color: var(--vscode-panel-border);
    border-collapse: collapse;
    border-image-repeat: stretch;
    padding-bottom: 10px;
    padding-left: 16px;
    padding-right: 16px;
    padding-top: 10px;
    text-align: start;
    text-size-adjust: 100%;
    vertical-align: middle;
    box-sizing: border-box;
  }
}
</style>
