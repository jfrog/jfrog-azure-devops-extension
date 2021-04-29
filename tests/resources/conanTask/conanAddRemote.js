const testUtils = require('../../testUtils');
const path = require('path');

const TEST_NAME = path.basename(__dirname);
const BUILD_NAME = TEST_NAME;
const BUILD_NUMBER = '1';

let variables = {
    'System.HostType': 'build',
    'System.DefinitionId': BUILD_NAME,
    'Build.BuildDirectory': '/tmp/' + BUILD_NAME,
    'Build.DefinitionName': BUILD_NAME,
    'Build.BuildNumber': BUILD_NUMBER
};

let inputs = {
    buildName: BUILD_NAME,
    buildNumber: BUILD_NUMBER,
    remoteName: 'artifactory',
    artifactoryService: '40567017-861d-4e23-8ebf-c71c33a72224',
    conanCommand: 'Add Remote',
    conanRepo: testUtils.getRepoKeys().conanLocalRepo,
    purgeExistingRemotes: false
};

testUtils.runArtifactoryTask(testUtils.conan, variables, inputs);
