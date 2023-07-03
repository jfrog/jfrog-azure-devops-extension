const testUtils = require('../../../testUtils');
const path = require('path');
const TEST_NAME = 'gradle';
let repoKeys = testUtils.getRepoKeys();

let BUILD_NAME = 'Gradle Test';
let BUILD_NUMBER = '3';

let variables = {
    'Build.DefinitionName': BUILD_NAME,
    'Build.BuildNumber': BUILD_NUMBER,
};

let inputs = {
    buildName: BUILD_NAME,
    buildNumber: BUILD_NUMBER,
    artifactoryResolverService: 'mock-service',
    artifactoryDeployerService: 'mock-service',
    sourceRepo: repoKeys.mavenRemoteRepo,
    targetRepo: repoKeys.mavenLocalRepo,
    workDir: testUtils.getLocalTestDir(TEST_NAME),
    tasks: 'clean aP',
    gradleBuildFile: path.join(testUtils.getLocalTestDir(TEST_NAME), 'build.gradle'),
    deployMavenDesc: false,
    deployIvyDesc: false,
    usesPlugin: true,
    useWrapper: true,
    collectBuildInfo: true,
};

testUtils.copyTestFilesToTestWorkDir('gradle', 'resources');
testUtils.runArtifactoryTask(testUtils.gradle, variables, inputs);
