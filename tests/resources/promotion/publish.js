const testUtils = require('../../testUtils');

let variables = {
    "Build.DefinitionName": "buildPromote",
    "Build.BuildNumber": "3"
};

testUtils.runTask(testUtils.publish, variables, {});
