<script lang="ts">
import { Component } from 'vue-property-decorator';
import NoteBody from './note_body.vue';
import Note from './note.vue';
import UserAvatar from './user_avatar.vue';
import Icon from './icon.vue';
import Date from './date.vue';

@Component({
  name: 'SystemNote',
  components: {
    NoteBody,
    UserAvatar,
    Date,
    Icon,
  },
})
export default class SystemNote extends Note {
  multiLine = false;

  firstLine = '';

  get icon(): string {
    let icon = 'gitLabLogo';
    const { body } = this.noteable;
    if (body) {
      if (body.match(/commit/)) {
        icon = 'commit';
      }
      if (body.match(/moved/)) {
        icon = 'arrowRight';
      }
      if (body.match(/description/)) {
        icon = 'pencilSquare';
      }
      if (body.match(/merge/)) {
        icon = 'gitMerge';
      }
      if (body.match(/merged/)) {
        icon = 'gitMerge';
      }
      if (body.match(/opened/)) {
        icon = 'issueOpen';
      }
      if (body.match(/closed/)) {
        icon = 'issueClose';
      }
      if (body.match(/time estimate/)) {
        icon = 'timer';
      }
      if (body.match(/time spent/)) {
        icon = 'timer';
      }
      if (body.match(/assigned/)) {
        icon = 'user';
      }
      if (body.match(/title/)) {
        icon = 'pencilSquare';
      }
      if (body.match(/task/)) {
        icon = 'taskDone';
      }
      if (body.match(/label/)) {
        icon = 'label';
      }
      if (body.match(/mentioned in/)) {
        icon = 'commentDots';
      }
      if (body.match(/branch/)) {
        icon = 'fork';
      }
      if (body.match(/confidential/)) {
        icon = 'eyeSlash';
      }
      if (body.match(/visible/)) {
        icon = 'eye';
      }
      if (body.match(/milestone/)) {
        icon = 'clock';
      }
      if (body.match(/discussion/)) {
        icon = 'comment';
      }
      if (body.match(/outdated/)) {
        icon = 'pencilSquare';
      }
      if (body.match(/pinned/)) {
        icon = 'thumbtack';
      }
      if (body.match(/duplicate/)) {
        icon = 'issueDuplicate';
      }
      if (body.match(/locked/)) {
        icon = 'lock';
      }
      if (body.match(/unlocked/)) {
        icon = 'lockOpen';
      }
      if (body.match(/due date/)) {
        icon = 'calendar';
      }
      if (body.match(/Compare with/)) {
        icon = 'timeline';
      }
    }
    return icon;
  }

  created(): void {
    const { body } = this.noteable;
    if (body && body.match(/Compare with/)) {
      const lines: string[] = body.split('\n');
      [this.firstLine] = lines;
      lines.splice(0, 1);
      this.noteable.body = lines.join('\n');
      this.multiLine = true;
    }
  }
}
</script>

<template>
  <li class="note system-note">
    <div class="timeline-entry-inner">
      <div class="timelineIcon">
        <icon :icon="icon" />
      </div>
      <div v-if="multiLine" class="timelineContent">
        <div class="note-header">
          <user-avatar :user="author" :show-avatar="false" style="margin-right: 2px;" />
          {{ firstLine }} <date :date="noteable.created_at" style="margin-left: 2px;" />
        </div>
        <note-body :note="noteable" style="margin-left: 25px;" />
      </div>
      <div v-if="!multiLine" class="timelineContent">
        <div class="note-header">
          <user-avatar :user="author" :show-avatar="false" style="margin-right: 2px;" />
          <note-body :note="noteable" style="margin-right: 2px;" /> ·
          <date :date="noteable.created_at" style="margin-left: 2px;" />
        </div>
      </div>
    </div>
  </li>
</template>

<style lang="scss">
.system-note {
  border: none;
  padding-bottom: 4px;
  padding-left: 20px;
  padding-right: 20px;
  padding-top: 4px;
  position: static;

  &:last-child {
    position: relative;
  }

  .timelineContent {
    margin-left: 30px;
  }

  .timelineIcon {
    border: 1px solid;
    border-color: var(--vscode-panel-border);
    background: var(--vscode-editor-background);
    display: flex;
    width: 32px;
    height: 32px;
    border-radius: 32px;
    float: left;
    margin-right: 20px;
    margin-top: -6px;

    svg {
      width: 16px;
      height: 16px;
      margin: 7px;
      overflow-x: hidden;
      overflow-y: hidden;
      display: block;
    }
  }

  ul {
    list-style-type: disc;
    padding-inline-start: 16px;
  }
}
</style>
