const testUtils = require('../../testUtils');
const path = require('path');
const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    "buildName": "NuGet",
    "buildNumber": "3",
    "command": "restore",
    "solutionPath": path.join(testUtils.getLocalTestDir(TEST_NAME), "**", "*.sln"),
    "targetResolveRepo": testUtils.getRepoKeys().nugetVirtualRepo,
    "packagesDirectory": path.join(testUtils.getLocalTestDir(TEST_NAME), "packages"),
    "verbosityRestore": "Detailed",
    "collectBuildInfo": true
};

testUtils.copyTestFilesToTestWorkDir(TEST_NAME, "restore");
testUtils.runTask(testUtils.nuget, {}, inputs);