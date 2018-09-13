const testUtils = require('../../testUtils');

let variables = {
    "Build.DefinitionName": "dockerTest",
    "Build.BuildNumber": "1"
};

testUtils.runTask(testUtils.publish, variables, {});
