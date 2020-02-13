import * as path from 'path';
import * as Mocha from 'mocha';
import * as glob from 'glob';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function run(testsRoot: string, cb: (error: any, failures?: number) => void): void {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd',
  });
  mocha.useColors(true);

  glob('**/**_test.js', { cwd: testsRoot }, (err, files) => {
    if (err) {
      return cb(err);
    }

    // Add files to the test suite
    files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

    try {
      // Run the mocha test
      mocha.run(failures => {
        cb(null, failures);
      });
    } catch (ex) {
      // eslint-disable-next-line no-console
      console.error(`Exception: ${ex.name} - ${ex.message}\n${ex.stack}`);
      cb(err);
    }
    return true;
  });
}
