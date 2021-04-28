const testUtils = require('../../testUtils');

const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    artifactoryResolverService: 'mock-service',
    command: 'jfrog rt del ' + testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME) + 'a.in'
};

testUtils.runArtifactoryTask(testUtils.genericCli, {}, inputs);
