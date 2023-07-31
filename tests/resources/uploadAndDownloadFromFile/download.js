const testUtils = require('../../testUtils');
const join = require('path').join;
const writeFileSync = require('fs-extra').writeFileSync;

const TEST_NAME = testUtils.getTestName(__dirname);

const specPath = join(testUtils.testDataDir, 'downloadSpec.json');

writeFileSync(
    specPath,
    JSON.stringify({
        files: [
            {
                pattern: testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME),
                target: testUtils.getLocalTestDir(TEST_NAME),
                flat: 'true',
            },
        ],
    }),
    'utf8'
);

let inputs = {
    command: 'Download',
    specSource: 'file',
    file: specPath,
    failNoOp: true,
    dryRun: false,
    insecureTls: false,
    validateSymlinks: false,
};

testUtils.runArtifactoryTask(testUtils.generic, {}, inputs);
