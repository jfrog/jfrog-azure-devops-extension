const testUtils = require('../../testUtils');
const join = require('path').join;
const writeFileSync = require('fs-extra').writeFileSync;
const TEST_NAME = testUtils.getTestName(__dirname);

const specPath = join(testUtils.testDataDir, 'uploadSpec.json');

writeFileSync(
    specPath,
    JSON.stringify({
        files: [
            {
                pattern: testUtils.getTestLocalFilesDir(__dirname),
                target: testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME),
            },
        ],
    }),
    'utf8'
);

let inputs = {
    command: 'Upload',
    specSource: 'file',
    file: specPath,
    failNoOp: true,
    dryRun: false,
    insecureTls: false,
    preserveSymlinks: false,
};

testUtils.runArtifactoryTask(testUtils.generic, {}, inputs);
