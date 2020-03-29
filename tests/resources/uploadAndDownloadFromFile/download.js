const testUtils = require('../../testUtils');
const path = require('path');
const fs = require('fs-extra');

const TEST_NAME = testUtils.getTestName(__dirname);

const specPath = path.join(testUtils.testDataDir, 'downloadSpec.json');

fs.writeFileSync(
    specPath,
    JSON.stringify({
        files: [
            {
                pattern: testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME),
                target: testUtils.getLocalTestDir(TEST_NAME),
                flat: 'true'
            }
        ]
    }),
    'utf8'
);

let inputs = {
    specSource: 'file',
    file: specPath,
    failNoOp: true,
    dryRun: false,
    insecureTls: false,
    validateSymlinks: false
};

testUtils.runTask(testUtils.download, {}, inputs);
