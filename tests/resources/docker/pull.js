const testUtils = require('../../testUtils');

let variables = {
    "Build.DefinitionName": "dockerTest",
    "Build.BuildNumber": "2"
};

let inputs = {
    "command": "pull",
    "collectBuildInfo": true,
    "sourceRepo": testUtils.artifactoryDockerRepo,
    "imageName": testUtils.artifactoryDockerDomain + "/docker-test:1"
};

testUtils.runTask(testUtils.docker, variables, inputs);
