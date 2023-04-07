const testUtils = require('../../testUtils');
const path = require('path');

const TEST_NAME = path.basename(__dirname);

let inputs = {
    command: 'Download',
    fileSpec: JSON.stringify({
        files: [
            {
                pattern: testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME),
                target: './subdir/',
                flat: 'true'
            }
        ]
    }),
    failNoOp: true,
    dryRun: false,
    insecureTls: false,
    validateSymlinks: false,
    specSource: 'taskConfiguration',
    workingDirectory: testUtils.getLocalTestDir(TEST_NAME)
};

testUtils.runArtifactoryTask(testUtils.generic, {}, inputs);
