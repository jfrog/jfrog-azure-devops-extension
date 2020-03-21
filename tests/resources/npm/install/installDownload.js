const testUtils = require('../../../testUtils');
const path = require('path');

const TEST_NAME = 'npm';

let inputs = {
    fileSpec: JSON.stringify({
        files: [
            {
                pattern: testUtils.getRepoKeys().npmLocalRepo,
                target: path.join(testUtils.getLocalTestDir(TEST_NAME), '1', '/'),
                flat: 'true'
            }
        ]
    }),
    failNoOp: true,
    specSource: 'taskConfiguration'
};

testUtils.runTask(testUtils.download, {}, inputs);
