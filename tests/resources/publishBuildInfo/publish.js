const testUtils = require('../../testUtils');

let variables = {
    "Build.DefinitionName": "buildPublish",
    "Build.BuildNumber": "3"
};

testUtils.runTask(testUtils.publish, variables, {});
