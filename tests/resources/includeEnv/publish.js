const testUtils = require('../../testUtils');

let variables = {
    "Build.DefinitionName": "includeEnv",
    "Build.BuildNumber": "3"
};

testUtils.runTask(testUtils.publish, variables, {});
