const testUtils = require('../../testUtils');
const path = require('path');

const TEST_NAME = path.basename(__dirname);

let patternValue = testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME);
let targetValue = testUtils.getLocalTestDir(TEST_NAME);

let inputs = {
    fileSpec: JSON.stringify({
        files: [
            {
                pattern: '${patternVar}',
                target: '${targetVar}',
                flat: 'true'
            }
        ]
    }),
    failNoOp: true,
    dryRun: false,
    insecureTls: false,
    validateSymlinks: false,
    specSource: 'taskConfiguration',
    replaceSpecVars: true,
    specVars: 'patternVar=' + patternValue + ';targetVar=' + targetValue
};

testUtils.runTask(testUtils.download, {}, inputs);
