const testUtils = require('../../testUtils');

const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    command: 'Download',
    buildName: 'setAndDeleteProps',
    buildNumber: '4',
    fileSpec: JSON.stringify({
        files: [
            {
                pattern: testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME),
                target: testUtils.getLocalTestDir(TEST_NAME),
                flat: 'true',
                props: 'propKey1=propVal1;propKey2=propVal2',
            },
        ],
    }),
    collectBuildInfo: false,
    failNoOp: true,
    dryRun: false,
    insecureTls: false,
    validateSymlinks: false,
    specSource: 'taskConfiguration',
};

testUtils.runArtifactoryTask(testUtils.generic, {}, inputs);
