const testUtils = require('../../testUtils');

let inputs = {
    "buildName": "buildPromote",
    "buildNumber": "3",
    "sourceRepo": testUtils.repoKey1,
    "targetRepo": testUtils.repoKey2,
    "status": "testStatus",
    "comment": "test comment",
    "includeDependencies": "true",
    "copy": "true",
    "dryRun": "false"
};

testUtils.runTask(testUtils.promote, {}, inputs);