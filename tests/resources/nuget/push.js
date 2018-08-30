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
    "pathToNupkg": testUtils.fixWinPath(path.join(testUtils.getLocalTestDir(TEST_NAME), "nugetTestExample.nupkg")),
    "collectBuildInfo": true
};

testUtils.copyTestFilesToTestWorkDir(TEST_NAME, "push");
testUtils.runTask(testUtils.nuget, variables, inputs);