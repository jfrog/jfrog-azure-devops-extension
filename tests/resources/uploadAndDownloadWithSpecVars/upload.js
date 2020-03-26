const testUtils = require('../../testUtils');

const TEST_NAME = testUtils.getTestName(__dirname);

let patternValue = testUtils.getTestLocalFilesDir(__dirname);
let targetValue = testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME);

let inputs = {
    fileSpec: JSON.stringify({
        files: [
            {
                pattern: '${patternVar}',
                target: '${targetVar}'
            }
        ]
    }),
    failNoOp: true,
    dryRun: false,
    insecureTls: false,
    symlinks: false,
    specSource: 'taskConfiguration',
    replaceSpecVars: true,
    specVars: 'patternVar=' + patternValue + ';targetVar=' + targetValue
};

testUtils.runTask(testUtils.upload, {}, inputs);
