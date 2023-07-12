const testUtils = require('../../../testUtils');
const join = require('path').join;

const TEST_NAME = 'npm';

let inputs = {
    command: 'Download',
    fileSpec: JSON.stringify({
        files: [
            {
                pattern: testUtils.getRepoKeys().npmLocalRepo,
                target: join(testUtils.getLocalTestDir(TEST_NAME), '2', '/'),
                flat: 'true',
            },
        ],
    }),
    failNoOp: true,
    dryRun: false,
    insecureTls: false,
    validateSymlinks: false,
    specSource: 'taskConfiguration',
};

testUtils.runArtifactoryTask(testUtils.generic, {}, inputs);
