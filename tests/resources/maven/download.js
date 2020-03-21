const testUtils = require('../../testUtils');
const path = require('path');

const TEST_NAME = path.basename(__dirname);

let inputs = {
    fileSpec: JSON.stringify({
        files: [
            {
                pattern: testUtils.getRepoKeys().mavenLocalRepo,
                target: path.join(testUtils.getLocalTestDir(TEST_NAME), 'files', '/'),
                build: 'Maven build/3',
                flat: 'true'
            }
        ]
    }),
    failNoOp: true,
    specSource: 'taskConfiguration'
};

testUtils.runTask(testUtils.download, {}, inputs);
