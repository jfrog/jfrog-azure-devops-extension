const testUtils = require('../../testUtils');

let variables = {
    "Build.DefinitionName": "dockerTest",
    "Build.BuildNumber": "2"
};

testUtils.runTask(testUtils.publish, variables, {});
