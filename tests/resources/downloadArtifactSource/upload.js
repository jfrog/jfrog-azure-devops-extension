const testUtils = require('../../testUtils');

const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    buildName: 'downloadArtifactSourceBuild',
    buildNumber: '5',
    fileSpec: JSON.stringify({
        files: [
            {
                pattern: testUtils.getTestLocalFilesDir(__dirname),
                target: testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME)
            }
        ]
    }),
    failNoOp: true,
    dryRun: false,
    insecureTls: false,
    symlinks: false,
    collectBuildInfo: true,
    specSource: 'taskConfiguration'
};

testUtils.runArtifactoryTask(testUtils.upload, {}, inputs);
