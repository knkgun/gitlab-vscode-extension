import * as path from 'path';

import { runTests } from 'vscode-test';

async function go(): Promise<void> {
  try {
    const extensionDevelopmentPath: string = path.resolve(__dirname, '../src');
    const extensionTestsPath: string = path.resolve(__dirname, './unit_tests');

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`Failed to run tests: ${err.name} - ${err.message}\n${err.stack}`);
    process.exit(1);
  }
}

go();
