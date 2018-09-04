const testUtils = require('../../testUtils');
const path = require('path');

const TEST_NAME = path.basename(__dirname);

let variables = {
    "Build.DefinitionName": "dockerTest",
    "Build.BuildNumber": "1"
};

let inputs = {
    "collectBuildInfo": true,
    "targetRepo": testUtils.dockerLocalRepoKey,
    "imageTag": testUtils.artiactoryDockerTag
};

testUtils.runTask(testUtils.docker, variables, inputs);
