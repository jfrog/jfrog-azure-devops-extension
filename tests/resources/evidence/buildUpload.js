const testUtils = require('../../testUtils');

let inputs = {
    command: 'Upload',
    buildName: 'Evidence Test',
    buildNumber: '1',
    fileSpec: JSON.stringify({
        files: [
            {
                pattern: testUtils.getTestLocalFilesDir(__dirname),
                target: testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, testUtils.getTestName(__dirname)),
            },
        ],
    }),
    collectBuildInfo: true,
    failNoOp: true,
    dryRun: false,
    insecureTls: false,
    preserveSymlinks: false,
    specSource: 'taskConfiguration',
};

testUtils.runArtifactoryTask(testUtils.generic, {}, inputs);
