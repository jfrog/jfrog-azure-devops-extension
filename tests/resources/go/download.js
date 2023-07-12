const testUtils = require('../../testUtils');
const basename = require('path').basename;

const TEST_NAME = basename(__dirname);

let inputs = {
    command: 'Download',
    fileSpec: JSON.stringify({
        files: [
            {
                pattern: testUtils.getRepoKeys().goLocalRepo,
                target: path.join(testUtils.getLocalTestDir(TEST_NAME), 'files', '/'),
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
