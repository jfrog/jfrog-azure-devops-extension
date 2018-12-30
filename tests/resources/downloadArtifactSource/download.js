const testUtils = require('../../testUtils');
const path = require('path');

const TEST_NAME = path.basename(__dirname);

let inputs = {
    "definition": "/downloadArtifactSource",
    "version": "/5",
    "downloadPath": testUtils.getLocalTestDir(TEST_NAME)
};

testUtils.runTask(testUtils.download, {}, inputs);
