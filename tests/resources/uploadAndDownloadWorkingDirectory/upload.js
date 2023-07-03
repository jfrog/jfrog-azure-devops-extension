const testUtils = require('../../testUtils');

const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    command: 'Upload',
    fileSpec: JSON.stringify({
        files: [
            {
                pattern: './subdir/*',
                target: testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME),
            },
        ],
    }),
    failNoOp: true,
    dryRun: false,
    insecureTls: false,
    preserveSymlinks: false,
    specSource: 'taskConfiguration',
    workingDirectory: testUtils.getTestLocalFilesDir(__dirname),
};

testUtils.runArtifactoryTask(testUtils.generic, {}, inputs);
