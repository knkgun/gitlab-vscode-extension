import * as vscode from 'vscode';
import * as path from 'path';
import * as assert from 'assert';
import { promises as fs } from 'fs';
import { VS_COMMANDS } from '../command_names';
import { fromReviewUri } from '../review/review_uri';
import { gitExtensionWrapper } from '../git/git_extension_wrapper';
import { removeLeadingSlash } from '../utils/remove_leading_slash';

/** returns true if file exists, false if it doesn't */
const tryToOpen = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath); // throws if file doesn't exist
  } catch (e) {
    return false;
  }
  await vscode.commands.executeCommand(VS_COMMANDS.OPEN, vscode.Uri.file(filePath));
  return true;
};

const findDiffWithPath = (diffs: RestDiffFile[], relativePath: string): RestDiffFile | undefined =>
  diffs.find(d => d.new_path === relativePath || d.old_path === relativePath);

export const openMrFile = async (uri: vscode.Uri): Promise<void> => {
  const params = fromReviewUri(uri);
  assert(params.path);
  const repository = gitExtensionWrapper.getRepository(params.repositoryRoot);
  const cachedMr = repository.getMr(params.mrId);
  assert(cachedMr);
  const diff = findDiffWithPath(cachedMr.mrVersion.diffs, removeLeadingSlash(params.path));
  assert(diff, 'Extension did not find the file in the MR, please refresh the side panel.');
  const getFullPath = (relative: string) => path.join(params.repositoryRoot, relative);
  const opened =
    (await tryToOpen(getFullPath(diff.new_path))) || (await tryToOpen(getFullPath(diff.old_path)));
  if (!opened)
    await vscode.window.showWarningMessage(
      `The file ${params.path} doesn't exist in your local project`,
    );
};
