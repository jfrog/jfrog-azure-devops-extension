const testUtils = require('../../testUtils');
const path = require('path');
const TEST_NAME = testUtils.getTestName(__dirname);

let variables = {
    "Build.DefinitionName": "NuGet",
    "Build.BuildNumber": "3"
};

let inputs = {
    "command": "push",
    "targetDeployRepo": testUtils.localNuGet,
    "pathToNupkg": path.join(testUtils.getLocalTestDir(TEST_NAME), "nugetTest*.nupkg"),
    "collectBuildInfo": true
};

testUtils.copyTestFilesToTestWorkDir(TEST_NAME, "push");
testUtils.runTask(testUtils.nuget, variables, inputs);