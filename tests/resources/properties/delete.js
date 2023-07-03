const testUtils = require('../../testUtils');

const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    command: 'Delete Properties',
    fileSpec: JSON.stringify({
        files: [
            {
                pattern: testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME) + 'b.in',
            },
        ],
    }),
    specSource: 'taskConfiguration',
    deleteProps: 'propKey1',
};

testUtils.runArtifactoryTask(testUtils.generic, {}, inputs);
