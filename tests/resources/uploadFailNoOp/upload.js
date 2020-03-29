const testUtils = require('../../testUtils');

const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
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
    symlinks: false,
    specSource: 'taskConfiguration'
};

testUtils.runTask(testUtils.upload, {}, inputs);
