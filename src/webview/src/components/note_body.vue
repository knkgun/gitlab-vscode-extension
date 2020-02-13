<script lang="ts">
/* eslint-disable vue/no-v-html */
/* eslint-disable global-require */
/* eslint-disable @typescript-eslint/no-var-requires */
import { Component, Vue, Prop } from 'vue-property-decorator';
import MarkdownIt from 'markdown-it';
import App from '../app.vue';
import { Noteable } from '../../../types/gitlab';
import { WebViewMessage } from '../../../types/webview';

@Component({
  name: 'NoteBody',
})
export default class NoteBody extends Vue {
  @Prop({ required: true })
  note!: Noteable;

  get renderedNoteBody(): string {
    const md = new MarkdownIt();
    if (this.note.body) {
      return this.note.markdownRenderedOnServer
        ? this.note.body
        : md.use(require('markdown-it-task-lists')).render(this.note.body);
    }
    return '';
  }

  mounted(): void {
    App.vsCode.postMessage({
      command: 'renderMarkdown',
      markdown: this.note.body,
      object: 'note',
      ref: this.note.id,
    });
  }

  created(): void {
    window.addEventListener('message', event => {
      if (event.data.type === 'markdownRendered') {
        const { data }: { data: WebViewMessage } = event;
        const { ref, object, markdown } = data;
        if (object === 'note' && ref === this.note.id) {
          this.note.markdownRenderedOnServer = true;
          this.note.body = markdown;
        }
      }
    });
  }
}
</script>

<template>
  <div class="note-body">
    <div class="body" v-html="renderedNoteBody"></div>
  </div>
</template>

<style lang="scss">
.note-body {
  word-wrap: break-word;

  .badge {
    padding: 0 8px;
    line-height: 16px;
    border-radius: 36px;
    font-size: 12px;
    display: inline-block;
  }

  .body p {
    &:first-child {
      margin-top: 0;
    }

    &:last-child {
      margin-bottom: 0;
    }
  }
}
</style>
