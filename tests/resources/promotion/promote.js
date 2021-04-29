const testUtils = require('../../testUtils');
let repoKeys = testUtils.getRepoKeys();

let inputs = {
    buildName: 'buildPromote',
    buildNumber: '3',
    sourceRepo: repoKeys.repo1,
    targetRepo: repoKeys.repo2,
    status: 'testStatus',
    comment: 'test comment',
    includeDependencies: 'true',
    copy: 'true',
    dryRun: 'false'
};

testUtils.runArtifactoryTask(testUtils.promote, {}, inputs);
