const testUtils = require('../../testUtils');

let variables = {
    "Build.DefinitionName": "buildPromoteDryRun",
    "Build.BuildNumber": "3"
};
let inputs = {
    "sourceRepo": testUtils.repoKey1,
    "targetRepo": testUtils.repoKey2,
    "status": "testStatus",
    "comment": "test comment",
    "includeDependencies": "true",
    "copy": "true",
    "dryRun": "true"
};

testUtils.runTask(testUtils.promote, variables, inputs);