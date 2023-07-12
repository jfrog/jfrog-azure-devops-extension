const testUtils = require('../../testUtils');
const basename = require('path').basename;
const join = require('path').join;

const TEST_NAME = basename(__dirname);

let inputs = {
    command: 'Download',
    fileSpec: JSON.stringify({
        files: [
            {
                pattern: testUtils.getRepoKeys().goLocalRepo,
                target: join(testUtils.getLocalTestDir(TEST_NAME), 'files', '/'),
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
