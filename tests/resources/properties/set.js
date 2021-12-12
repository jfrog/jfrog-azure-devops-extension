const testUtils = require('../../testUtils');

const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    command: 'SetProperties',
    fileSpec: JSON.stringify({
        files: [
            {
                pattern: testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME)
            }
        ]
    }),
    specSource: 'taskConfiguration',
    setProps: 'propKey1=propVal1;propKey2=propVal2'
};

testUtils.runArtifactoryTask(testUtils.generic, {}, inputs);
