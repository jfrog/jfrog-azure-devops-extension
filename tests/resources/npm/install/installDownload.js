const testUtils = require('../../../testUtils');
const path = require('path');

const TEST_NAME = 'npmi';

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
    dryRun: false,
    insecureTls: false,
    validateSymlinks: false,
    specSource: 'taskConfiguration'
};

testUtils.runArtifactoryTask(testUtils.download, {}, inputs);
