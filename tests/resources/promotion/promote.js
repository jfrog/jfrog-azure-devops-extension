const testUtils = require('../../testUtils');

let variables = {
    "Build.DefinitionName": "buildPromote",
    "Build.BuildNumber": "3"
};
let inputs = {
    "sourceRepo": testUtils.repoKey1,
    "targetRepo": testUtils.repoKey2,
    "status": "testStatus",
    "comment": "test comment",
    "includeDependencies": "true",
    "copy": "true",
    "dryRun": "false"
};

testUtils.runTask(testUtils.promote, variables, inputs);