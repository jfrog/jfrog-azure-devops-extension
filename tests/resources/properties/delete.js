const testUtils = require('../../testUtils');

const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    fileSpec: JSON.stringify({
        files: [
            {
                pattern: testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME) + 'b.in'
            }
        ]
    }),
    specSource: 'taskConfiguration',
    command: 'delete',
    deleteProps: 'propKey1'
};

testUtils.runArtifactoryTask(testUtils.properties, {}, inputs);
