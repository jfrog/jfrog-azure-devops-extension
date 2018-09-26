const testUtils = require('../../testUtils');
const path = require('path');
const TEST_NAME = testUtils.getTestName(__dirname);

let variables = {
    "Build.DefinitionName": "NuGet",
    "Build.BuildNumber": "3"
};

let inputs = {
    "command": "restore",
    "solutionPath": path.join(testUtils.getLocalTestDir(TEST_NAME), "**", "*.sln"),
    "targetResolveRepo": testUtils.virtualNuget,
    "packagesDirectory": path.join(testUtils.getLocalTestDir(TEST_NAME), "packages"),
    "verbosityRestore": "Detailed",
    "collectBuildInfo": true
};

testUtils.copyTestFilesToTestWorkDir(TEST_NAME, "restore");
testUtils.runTask(testUtils.nuget, variables, inputs);