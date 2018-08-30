const testUtils = require('../../testUtils');

let variables = {
    "Build.DefinitionName": "npmTest",
    "Build.BuildNumber": "1"
};

testUtils.runTask(testUtils.publish, variables, {});
