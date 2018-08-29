const testUtils = require('../../testUtils');
const path = require('path');
const TEST_NAME = testUtils.getTestName(__dirname);

let variables = {
    "Build.DefinitionName": "Maven",
    "Build.BuildNumber": "3"
};

let inputs = {
    "artifactoryResolverService": "mock-service",
    "targetResolveSnapshotRepo": testUtils.remoteMaven,
    "targetResolveReleaseRepo": testUtils.remoteMaven,
    "targetDeployReleaseRepo": testUtils.localMaven,
    "targetDeploySnapshotRepo": testUtils.localMaven,
    "goals": "clean install",
    "mavenPOMFile": path.join(TEST_NAME, "pom.xml"),
    "collectBuildInfo": true
};

testUtils.copyTestFilesToTestWorkDir(TEST_NAME, "resources");
testUtils.runTask(testUtils.maven, variables, inputs);