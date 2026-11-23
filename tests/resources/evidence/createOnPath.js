const testUtils = require('../../testUtils');
const join = require('path').join;

const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    predicateFilePath: join(__dirname, 'files', 'predicate.json'),
    predicateType: 'https://ado-extension-tests/predicate/custom/v1',
    subjectType: 'path',
    subjectRepoPath: testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME) + 'a.in',
    attachmentSource: 'none',
    format: 'none',
};

testUtils.runArtifactoryTask(testUtils.evidence, {}, inputs);
