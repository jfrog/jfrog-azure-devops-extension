const testUtils = require('../../testUtils');
const jfrogUtils = require('artifactory-tasks-utils/utils.js');

let inputs = {
    artifactoryResolverService: 'mock-service',
    cliInstallationRepo: testUtils.getRepoKeys().cliRepo,
    installCustomVersion: true,
    cliVersion: jfrogUtils.defaultJfrogCliVersion
};

testUtils.runTask(testUtils.toolsInstaller, {}, inputs);
