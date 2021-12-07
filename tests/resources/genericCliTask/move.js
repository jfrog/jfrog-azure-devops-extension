const testUtils = require('../../testUtils');

const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    artifactoryResolverService: 'mock-service',
    command:
        'jf rt mv ' +
        testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME) +
        'b.in ' +
        testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME) +
        'd.in'
};

testUtils.runArtifactoryTask(testUtils.genericCli, {}, inputs);
