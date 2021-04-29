const testUtils = require('../../testUtils');

const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    buildName: 'setAndDeleteProps',
    buildNumber: '4',
    fileSpec: JSON.stringify({
        files: [
            {
                pattern: testUtils.getTestLocalFilesDir(__dirname),
                target: testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME)
            }
        ]
    }),
    collectBuildInfo: false,
    failNoOp: true,
    dryRun: false,
    insecureTls: false,
    symlinks: false,
    specSource: 'taskConfiguration'
};

testUtils.runArtifactoryTask(testUtils.upload, {}, inputs);
