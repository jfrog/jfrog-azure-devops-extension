const testUtils = require('../../testUtils');
const join = require('path').join;

let inputs = {
    predicateFilePath: join(__dirname, 'files', 'predicate.json'),
    predicateType: 'https://ado-extension-tests/predicate/custom/v1',
    subjectType: 'build',
    buildName: 'Evidence Test',
    buildNumber: '1',
    attachmentSource: 'local',
    attachLocalFilePath: join(__dirname, 'files', 'attachment.txt'),
    attachArtifactoryTempPath: testUtils.getRepoKeys().repo1 + '/evidence-attachments/',
    format: 'none',
};

testUtils.runArtifactoryTask(testUtils.evidence, {}, inputs);
