const testUtils = require('../../testUtils');
const basename = require('path').basename;

const TEST_NAME = basename(__dirname);

let inputs = {
    definition: 'downloadArtifactSourceBuild',
    version: '5',
    downloadPath: testUtils.getLocalTestDir(TEST_NAME),
    noFlat: false,
    threads: 4,
};

testUtils.runArtifactoryTask(testUtils.generic, {}, inputs);
