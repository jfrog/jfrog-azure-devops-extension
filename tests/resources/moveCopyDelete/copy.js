const testUtils = require('../../testUtils');

const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    command: 'Copy',
    fileSpec: JSON.stringify({
        files: [
            {
                pattern: testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME) + "*${action}*",
                target: testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME) + "new${action}.in",
                flat: "true"
            }
        ]
    }),
    failNoOp: true,
    dryRun: false,
    insecureTls: false,
    specSource: 'taskConfiguration',
    replaceSpecVars: true,
    specVars: 'action=Copy'
};

testUtils.runArtifactoryTask(testUtils.generic, {}, inputs);
