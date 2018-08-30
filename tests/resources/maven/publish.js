const testUtils = require('../../testUtils');

let variables = {
    "Build.DefinitionName": "Maven",
    "Build.BuildNumber": "3"
};

testUtils.runTask(testUtils.publish, variables, {});
