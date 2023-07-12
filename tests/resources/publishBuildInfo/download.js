const testUtils = require('../../testUtils');
const basename = require('path').basename;

const TEST_NAME = basename(__dirname);

let inputs = {
    command: 'Download',
    buildName: 'buildPublish',
    buildNumber: '3',
    module: 'myDownloadModule',
    fileSpec: JSON.stringify({
        files: [
            {
                pattern: testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME),
                target: testUtils.getLocalTestDir(TEST_NAME),
                flat: 'true',
            },
        ],
    }),
    collectBuildInfo: true,
    failNoOp: true,
    dryRun: false,
    insecureTls: false,
    validateSymlinks: false,
    specSource: 'taskConfiguration',
};

testUtils.runArtifactoryTask(testUtils.generic, {}, inputs);
