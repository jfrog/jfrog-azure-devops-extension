const testUtils = require('../../testUtils');

let variables = {
    "Build.DefinitionName": "buildPromoteDryRun",
    "Build.BuildNumber": "3"
};

testUtils.runTask(testUtils.publish, variables, {});
