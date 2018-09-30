const testUtils = require('../../testUtils');

let variables = {
    "Build.DefinitionName": "dockerTest",
    "Build.BuildNumber": "1"
};

let inputs = {
    "collectBuildInfo": true,
    "targetRepo": testUtils.artifactoryDockerRepo,
    "imageTag": testUtils.artifactoryDockerDomain + "/docker-test:1"
};

testUtils.runTask(testUtils.docker, variables, inputs);
