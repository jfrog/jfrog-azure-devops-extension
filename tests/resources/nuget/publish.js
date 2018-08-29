const testUtils = require('../../testUtils');

let variables = {
    "Build.DefinitionName": "NuGet",
    "Build.BuildNumber": "3"
};

testUtils.runTask(testUtils.publish, variables, {});