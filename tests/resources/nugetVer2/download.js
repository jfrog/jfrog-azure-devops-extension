const testUtils = require('../../testUtils');
const path = require('path');

const TEST_NAME = path.basename(__dirname);

let inputs = {
    fileSpec: JSON.stringify({
        files: [
            {
                pattern: testUtils.getRepoKeys().nugetLocalRepo,
                target: path.join(testUtils.getLocalTestDir(TEST_NAME), 'files', '/'),
                build: 'NuGet Test Ver2/3',
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
