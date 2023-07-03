const testUtils = require('../../testUtils');

const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    command: 'Delete',
    fileSpec: JSON.stringify({
        files: [
            {
                pattern: testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME) + '*${action}.in',
            },
        ],
    }),
    failNoOp: true,
    dryRun: false,
    insecureTls: false,
    specSource: 'taskConfiguration',
    replaceSpecVars: true,
    specVars: 'action=Delete',
};

testUtils.runArtifactoryTask(testUtils.generic, {}, inputs);
