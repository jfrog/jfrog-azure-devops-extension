const testUtils = require('../../testUtils');
const TEST_NAME = testUtils.getTestName(__dirname);

let patternValue = testUtils.getTestLocalFilesDir(__dirname);

let inputs = {
    fileSpec: JSON.stringify({
        files: [
            {
                pattern: '${patternVar}',
                target: testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME)
            }
        ]
    }),
    failNoOp: true,
    dryRun: false,
    insecureTls: false,
    symlinks: false,
    specSource: 'taskConfiguration',
    replaceSpecVars: true,
    specVars: 'patternVar=' + patternValue
};

testUtils.runTask(testUtils.upload, {}, inputs);
