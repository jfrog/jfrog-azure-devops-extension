const testUtils = require('../../testUtils');
const path = require('path');

const TEST_NAME = path.basename(__dirname);

let inputs = {
    fileSpec: JSON.stringify({
        files: [
            {
                pattern: testUtils.getRepoKeys().goLocalRepo,
                target: path.join(testUtils.getLocalTestDir(TEST_NAME), 'files', '/'),
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
