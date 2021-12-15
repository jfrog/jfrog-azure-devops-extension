const testUtils = require('../../testUtils');

const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    jfrogPlatformConnection: 'mock-service',
    command: 'jf rt del ' + testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME) + 'a.in'
};

testUtils.runArtifactoryTask(testUtils.genericCli, {}, inputs);
