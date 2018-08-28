const testUtils = require('../../testUtils');

let variables = {
    "Build.DefinitionName": "excludeEnv",
    "Build.BuildNumber": "3"
};

let inputs = {
    "excludeEnvVars": "*password*"
}

testUtils.runTask(testUtils.publish, variables, inputs);
