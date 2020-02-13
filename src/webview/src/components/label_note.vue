<script lang="ts">
import { Component } from 'vue-property-decorator';
import { UserSchema } from 'gitlab';
import Note from './note.vue';
import NoteBody from './note_body.vue';
import UserAvatar from './user_avatar.vue';
import Icon from './icon.vue';
import Date from './date.vue';
import { Noteable } from '../../../types/gitlab';

@Component({
  name: 'LabelNote',
  components: {
    NoteBody,
    UserAvatar,
    Date,
    Icon,
  },
})
export default class LabelNote extends Note {
  get note(): Noteable {
    if (this.noteable.body === '') {
      const action: string = this.noteable.action === 'add' ? 'added' : 'removed';
      const { noteable }: { noteable: Noteable } = this;
      noteable.body = `${action} ~"${noteable?.label?.name}" label`;
      return noteable;
    }
    return this.noteable;
  }

  get author(): UserSchema | null {
    return this.noteable?.user ? this.noteable.user : null;
  }
}
</script>

<template>
  <li class="note label-note">
    <div class="timeline-entry-inner">
      <div class="timelineIcon">
        <span class="avatar">
          <icon :icon="'label'" />
        </span>
      </div>
      <div class="timelineContent">
        <div class="note-header">
          <user-avatar :user="author" :show-avatar="false" style="margin-right: 2px;" />
          <note-body :note="note" style="margin-right: 2px;" /> ·
          <date :date="noteable.created_at" style="margin-left: 2px;" />
        </div>
      </div>
    </div>
  </li>
</template>

<style lang="scss">
.label-note {
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
