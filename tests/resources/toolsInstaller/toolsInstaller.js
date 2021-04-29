const testUtils = require('../../testUtils');

let inputs = {
    artifactoryResolverService: 'mock-service',
    cliInstallationRepo: testUtils.getRepoKeys().cliRepo
};

testUtils.runArtifactoryTask(testUtils.toolsInstaller, {}, inputs);
