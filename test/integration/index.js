const path = require('path');
const Mocha = require('mocha');
// glob is available in the VS Code runtime
// eslint-disable-next-line import/no-extraneous-dependencies
const glob = require('glob');

const getAllTestFiles = testsRoot =>
  new Promise((resolve, reject) => {
    glob('**/**.test.js', { cwd: testsRoot }, (err, files) => {
      if (err) reject(err);
      resolve(files);
    });
  });

// Coverage setup taken from https://github.com/microsoft/vscode-js-debug/blob/master/src/test/testRunner.ts
function setupCoverage() {
  // eslint-disable-next-line global-require
  const NYC = require('nyc');
  console.log(path.join(__dirname, '..', '..', '..'));
  const nyc = new NYC({
    cwd: path.join(__dirname, '..', '..', '..'),
    reporter: ['lcov', 'text', 'html'],
    // include: ['src/**/*.js'],
    exclude: ['**/test/**'],
    all: true,
    instrument: true,
    hookRequire: true,
    hookRunInContext: true,
    hookRunInThisContext: true,
  });

  nyc.reset();
  nyc.wrap();

  return nyc;
}

// This function is a public interface that VS Code uses to run the tests
// eslint-disable-next-line import/prefer-default-export
async function run(testsRoot) {
  const nyc = process.env.COVERAGE ? setupCoverage() : null;
  // Create the mocha test
  const mocha = new Mocha();
  mocha.timeout(2000);
  mocha.color(true);
  const files = await getAllTestFiles(testsRoot);

  // Add files to the test suite
  files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

  try {
    // Run the mocha test
    await new Promise((resolve, reject) =>
      mocha.run(failures => (failures ? reject(new Error(`${failures} tests failed`)) : resolve())),
    );
  } finally {
    if (nyc) {
      console.log(nyc);
      nyc.writeCoverageFile();
      nyc.report();
    }
  }
}

module.exports = { run };
