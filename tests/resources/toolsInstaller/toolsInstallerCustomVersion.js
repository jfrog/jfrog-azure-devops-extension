const testUtils = require('../../testUtils');
const jfrogUtils = require('@jfrog/tasks-utils/utils.js');

let inputs = {
    artifactoryResolverService: 'mock-service',
    cliInstallationRepo: testUtils.getRepoKeys().cliRepo,
    installCustomVersion: true,
    cliVersion: jfrogUtils.defaultJfrogCliVersion
};

testUtils.runArtifactoryTask(testUtils.toolsInstaller, {}, inputs);
