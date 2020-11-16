const testUtils = require('../../testUtils');
const path = require('path');

const TEST_NAME = path.basename(__dirname);

let inputs = {
    fileSpec: JSON.stringify({
        files: [
            {
                pattern: testUtils.stripTrailingSlash(testUtils.getRepoKeys().nugetLocalRepo) + '/custom/path/',
                target: path.join(testUtils.getLocalTestDir(TEST_NAME), 'files', '/'),
                build: 'DotNET Test/7',
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
