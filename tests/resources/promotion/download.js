const testUtils = require('../../testUtils');

const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    buildName: 'buildPromote',
    buildNumber: '3',
    fileSpec: JSON.stringify({
        files: [
            {
                pattern: testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo2, TEST_NAME),
                target: testUtils.getLocalTestDir(TEST_NAME),
                flat: 'true'
            }
        ]
    }),
    collectBuildInfo: true,
    failNoOp: true,
    dryRun: false,
    insecureTls: false,
    validateSymlinks: false,
    specSource: 'taskConfiguration'
};

testUtils.runArtifactoryTask(testUtils.download, {}, inputs);
