const testUtils = require('../../testUtils');
const path = require('path');
const TEST_NAME = testUtils.getTestName(__dirname);
let repoKeys = testUtils.getRepoKeys();

let BUILD_NAME = 'Maven Test';
let BUILD_NUMBER = '3';

let variables = {
    'Build.DefinitionName': BUILD_NAME,
    'Build.BuildNumber': BUILD_NUMBER
};

let inputs = {
    buildName: BUILD_NAME,
    buildNumber: BUILD_NUMBER,
    artifactoryResolverService: 'mock-service',
    artifactoryDeployService: 'mock-service',
    targetResolveSnapshotRepo: repoKeys.mavenRemoteRepo,
    targetResolveReleaseRepo: repoKeys.mavenRemoteRepo,
    targetDeployReleaseRepo: repoKeys.mavenLocalRepo,
    targetDeploySnapshotRepo: repoKeys.mavenLocalRepo,
    goals: 'clean install',
    mavenPOMFile: path.join(TEST_NAME, 'pom.xml'),
    collectBuildInfo: true,
    filterDeployedArtifacts: true,
    includePatterns: '*1.0-*.jar, *pom*',
    excludePatterns: '*sources*'
};

testUtils.copyTestFilesToTestWorkDir(TEST_NAME, 'resources');
testUtils.runArtifactoryTask(testUtils.maven, variables, inputs);
