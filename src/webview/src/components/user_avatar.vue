<script lang="ts">
import { Component, Vue, Prop } from 'vue-property-decorator';
import { UserSchema } from 'gitlab';

@Component({
  name: 'UserAvatar',
})
export default class UserAvatar extends Vue {
  @Prop({ default: 24 })
  size!: number;

  @Prop({ required: true })
  user!: UserSchema;

  @Prop({ default: true })
  showAvatar!: boolean;

  @Prop({ default: true })
  showLink!: boolean;

  @Prop({ default: true })
  showUsername!: boolean;

  @Prop({ default: true })
  showHandle!: boolean;

  get sizeClass(): string {
    return `s${this.size}`;
  }
}
</script>

<template>
  <span>
    <component :is="showLink ? 'a' : 'span'" :href="user.web_url" target="_blank">
      <img v-if="showAvatar" :src="user.avatar_url" :class="sizeClass" class="avatar" />
      <span v-if="showUsername" class="author">
        <strong> {{ user.name }}</strong>
        <span v-if="showHandle"> @{{ user.username }}</span>
      </span>
    </component>
  </span>
</template>

<style lang="scss" scoped>
a {
  color: var(--vscode-foreground);
  text-decoration: none;
}
.avatar {
  float: left;
  margin-right: 16px;
  border-radius: 100%;
  max-width: 64px;
  max-height: 64px;
  vertical-align: middle;
  background: var(--vscode-editor-background);
}

.s24 {
  width: 24px;
  height: 24px;
}

.s40 {
  width: 40px;
  height: 40px;
}

.capitalize {
  text-transform: capitalize;
}
</style>
