const testUtils = require('../../testUtils');
const path = require('path');

const TEST_NAME = path.basename(__dirname);

let inputs = {
    fileSpec: JSON.stringify({
        files: [
            {
                pattern: testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME),
                target: testUtils.getLocalTestDir(TEST_NAME),
                flat: 'true'
            }
        ]
    }),
    failNoOp: true,
    dryRun: true,
    insecureTls: false,
    validateSymlinks: false,
    specSource: 'taskConfiguration'
};

testUtils.runTask(testUtils.download, {}, inputs);
