const testUtils = require('../../../testUtils');
const join = require('path').join;
const TEST_NAME = 'gradle';
let repoKeys = testUtils.getRepoKeys();

let BUILD_NAME = 'Gradle CI Test';
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
    tasks: 'aP',
    gradleBuildFile: join(testUtils.getLocalTestDir(TEST_NAME), 'build-ci.gradle'),
    deployMavenDesc: false,
    deployIvyDesc: false,
    usesPlugin: false,
    useWrapper: true,
    collectBuildInfo: true,
};

testUtils.copyTestFilesToTestWorkDir('gradle', 'resources');
testUtils.runArtifactoryTask(testUtils.gradle, variables, inputs);
