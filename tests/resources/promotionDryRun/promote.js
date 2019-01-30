const testUtils = require('../../testUtils');

let inputs = {
    "buildName": "buildPromoteDryRun",
    "buildNumber": "3",
    "sourceRepo": testUtils.repoKey1,
    "targetRepo": testUtils.repoKey2,
    "status": "testStatus",
    "comment": "test comment",
    "includeDependencies": "true",
    "copy": "true",
    "dryRun": "true"
};

testUtils.runTask(testUtils.promote, {}, inputs);