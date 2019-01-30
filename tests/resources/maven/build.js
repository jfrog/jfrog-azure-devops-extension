const testUtils = require('../../testUtils');
const path = require('path');
const TEST_NAME = testUtils.getTestName(__dirname);

let BUILD_NAME = "Maven build";
let BUILD_NUMBER = "3";

let variables = {
    "Build.DefinitionName": BUILD_NAME,
    "Build.BuildNumber": BUILD_NUMBER
};

let inputs = {
    "buildName": BUILD_NAME,
    "buildNumber": BUILD_NUMBER,
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