const testUtils = require('../../../testUtils');
const path = require('path');

const TEST_NAME = 'npmVer2';

let inputs = {
    fileSpec: JSON.stringify({
        files: [
            {
                pattern: testUtils.getRepoKeys().npmLocalRepo,
                target: path.join(testUtils.getLocalTestDir(TEST_NAME), '2', '/'),
                flat: 'true'
            }
        ]
    }),
    failNoOp: true,
    dryRun: false,
    insecureTls: false,
    validateSymlinks: false,
    specSource: 'taskConfiguration'
};

testUtils.runTask(testUtils.download, {}, inputs);
