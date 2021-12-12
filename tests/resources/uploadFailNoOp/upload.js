const testUtils = require('../../testUtils');

const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    command: 'Upload',
    fileSpec: JSON.stringify({
        files: [
            {
                pattern: testUtils.getTestLocalFilesDir(__dirname) + 'PathShouldNotExistAndMustContainARegexpChar*',
                target: testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME)
            }
        ]
    }),
    failNoOp: true,
    dryRun: false,
    insecureTls: false,
    preserveSymlinks: false,
    specSource: 'taskConfiguration'
};

testUtils.runArtifactoryTask(testUtils.generic, {}, inputs);
