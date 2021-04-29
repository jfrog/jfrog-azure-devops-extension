const testUtils = require('../../testUtils');
const path = require('path');

const TEST_NAME = path.basename(__dirname);

let inputs = {
    buildName: 'buildPublish',
    buildNumber: '3',
    module: 'myDownloadModule',
    fileSpec: JSON.stringify({
        files: [
            {
                pattern: testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME),
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
